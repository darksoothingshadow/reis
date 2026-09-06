import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * CI guard for reIS's central promise: student data never leaves the device.
 *
 * This is a REGRESSION FENCE, not a proof. It cannot understand data flow, so
 * it enforces three things a reviewer would otherwise have to notice by eye:
 *
 *  1. Only reviewed files may talk to Supabase at all.
 *  2. No student-identifying name may appear near a Supabase call.
 *  3. Hashing is not laundering. `SHA-256(studentId)` is NOT anonymisation —
 *     IS student ids are six or seven digits, so the entire preimage space is
 *     under ten million and a rainbow table reverses it in seconds. Digest
 *     calls are therefore allow-listed by file, so a new one has to be argued
 *     for rather than slipped in.
 *
 * When this fails, the fix is almost never to widen the list. It is to stop
 * sending the thing. Widening requires a reviewer to agree the payload carries
 * no student identity — write down why in the entry's comment.
 */

const ROOT = join(__dirname, '../../..');
const SRC = join(ROOT, 'src');

/** Names that identify a student, in any casing seen in this codebase. */
const IDENTIFYING = [
  'studentId',
  'student_id',
  'studentID',
  'uic',
  'fullName',
  'userEmail',
  'birthNumber',
  'rodneCislo',
  'personalNumber',
  'studiumId',
  'personId',
  'isLogin',
];

/**
 * Files permitted to reach Supabase. Each one has been read and confirmed to
 * send no student identity.
 */
const SUPABASE_CALLERS = new Set([
  // Student suggestions, via the submit_suggestion RPC. The payload is the
  // student's own words plus `screen` (an AppView name) and browser/version —
  // no IS id, no name, and deliberately NOT the host URL, which on IS carries
  // studium=/obdobi=/predmet=/termin=. `contact` is personal data but is opt-in
  // and hand-typed: it exists so we can reply, and is empty unless the student
  // fills it in. Nothing here is collected automatically.
  //
  // This file already sent exactly this payload to Supabase before — through
  // the submit-suggestion edge function. Only the transport changed (fetch ->
  // supabase.rpc), which is why the guard newly matches it; the privacy posture
  // is unchanged.
  'src/api/suggestions.ts',
  // Housing board. Sends the post the student composed plus their IS login
  // and IS person id — ONLY after the consent tick on the form, shown to every
  // reIS user so the poster can be verified in IS, deleted with the post after
  // 14 days. Reads take no identity. The install id is the random per-install
  // UUID, never anything derived from the student. Disclosed in PRIVACY.md
  // ("Housing board") and docs/privacy-policy-app.md item 4.
  'src/api/housing.ts',
  // Random install id only. Reads take no identity argument at all.
  'src/api/eventRsvp.ts',
  // Random install id only, since the privacy refactor. Since September 2026
  // the daily-usage event also carries two GROUP labels (faculty, platform) —
  // counts over thousands of installs, not per-student data. Disclosed in
  // PRIVACY.md ("Daily Usage & NPS Feedback") and docs/privacy-policy-app.md.
  'src/api/feedback.ts',
  // Society post view/click counters; sends a post row id and nothing else.
  'src/services/spolky/spolkyService.ts',
  // Reads the public society events feed. No student data in either direction.
  'src/api/mapEvents.ts',
]);

/**
 * Files permitted to call crypto.subtle.digest. None of these hash a student
 * identifier: PKCE verifiers and image fingerprints.
 */
const DIGEST_CALLERS = new Set(['src/utils/pkce.ts', 'src/services/notes/imageNormalize.ts']);

/**
 * (file path) -> identifying names THAT SPECIFIC FILE is allowed to send to
 * Supabase, because a reviewer read the file and confirmed the reason below.
 * Unlike SUPABASE_CALLERS this exempts individual names, not the whole file:
 * a new identifying field appearing in an already-exempted file still has to
 * be argued for and added here explicitly.
 */
const IDENTIFYING_EXCEPTIONS: Record<string, string[]> = {
  // Housing board. isLogin and personId are the poster's IS login and IS
  // person id, sent ONLY after the consent tick on the housing form, shown
  // to every reIS user so a reader can verify the poster in IS, and deleted
  // with the post. Disclosed in PRIVACY.md ("Housing board") and
  // docs/privacy-policy-app.md.
  'src/api/housing.ts': ['isLogin', 'personId'],
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__' || entry === 'test') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(SRC).map((f) => ({ path: relative(ROOT, f), text: readFileSync(f, 'utf-8') }));

/**
 * Every non-MENDELU host the app may contact. An audit found reIS talking to
 * Microsoft, Komoot and a personal HuggingFace Space while
 * PRIVACY.md claimed it spoke "exclusively" to IS Mendelu, WebISKAM and
 * Supabase. Adding a destination now means adding it here AND to PRIVACY.md.
 * WebISKAM left the list when the integration was removed.
 */
const ALLOWED_HOSTS = [
  // --- reIS's own / the university's ---
  'is.mendelu.cz',
  'mendelu.cz',
  'supabase.co',

  // --- fetched from, carrying no student identity ---
  'cdn.jsdelivr.net', // static subject-difficulty JSON. NOTE: the request set
  // reveals which subjects are enrolled, so it is an enrolment fingerprint to
  // the CDN even though no identifier is sent.
  'openstreetmap.org', // campus map tiles
  'photon.komoot.io', // off-campus venue search — SOCIETY ADMINS only
  'hei.api.uni-foundation.eu', // public Erasmus university directory (read-only)

  // --- fetched from, carrying student data. Each must stay disclosed. ---

  // --- deep links the STUDENT opens; no background request is made ---
  'google.com', // maps links, Play Store, Chrome Web Store, a society's Apps Script
  'teams.microsoft.com',
  'outlook.office.com',
  'www.geteduroam.app',
  'supef.cz',

  // --- not destinations ---
  'localhost.that.never.exists', // CORS sentinel in capacitorTransport
  'is.mendelu.cz.evil.com', // negative example in the URL validator
  'is.mendelu.cz.evil.example', // ditto, in trustedOrigin
];

describe('no student data leaves the device', () => {
  it('contacts no undeclared third-party host', () => {
    const offences: string[] = [];
    for (const f of files) {
      for (const m of f.text.matchAll(/https:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) {
        const host = m[1]!.toLowerCase();
        if (ALLOWED_HOSTS.some((a) => host === a || host.endsWith('.' + a))) continue;
        offences.push(`${f.path}  ${host}`);
      }
    }
    expect(
      [...new Set(offences)],
      `Undeclared outbound host(s). Every destination must be listed here AND ` +
        `disclosed in PRIVACY.md, which is what backs the App Store and Play ` +
        `Store privacy filings:\n` +
        [...new Set(offences)].join('\n')
    ).toEqual([]);
  });

  it('only reviewed files talk to Supabase', () => {
    const callers = files
      .filter((f) => /\bsupabase\s*\.\s*(rpc|from)\s*\(/.test(f.text))
      .map((f) => f.path)
      .filter((p) => !SUPABASE_CALLERS.has(p));

    expect(
      callers,
      `New Supabase call site(s). Confirm the payload carries NO student identity, ` +
        `then add the file to SUPABASE_CALLERS with a note saying why it is safe:\n` +
        callers.join('\n')
    ).toEqual([]);
  });

  it('sends no student-identifying field to Supabase', () => {
    const offences: string[] = [];
    for (const f of files) {
      if (!/\bsupabase\s*\.\s*(rpc|from)\s*\(/.test(f.text)) continue;
      const lines = f.text.split('\n');
      lines.forEach((line, i) => {
        // Look inside the payload region of a Supabase call: the call line and
        // the object literal that follows it.
        const near = lines.slice(Math.max(0, i - 2), i + 14).join('\n');
        if (!/\bsupabase\s*\.\s*(rpc|from)\s*\(/.test(near)) return;
        for (const name of IDENTIFYING) {
          if (IDENTIFYING_EXCEPTIONS[f.path]?.includes(name)) continue;
          // `p_student_id:` is the column name on legacy tables; flag only when
          // an identifying VALUE is being passed, not the parameter name. The
          // second alternative catches the ES2015 shorthand property
          // (`{ personId }`), which carries the identifying value with no
          // colon at all.
          const re = new RegExp(`:\\s*[^,\\n]*\\b${name}\\b|[{,]\\s*${name}\\s*[,}]`);
          if (re.test(line) && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
            offences.push(`${f.path}:${i + 1}  ${line.trim()}`);
          }
        }
      });
    }
    expect(
      [...new Set(offences)],
      `A student identifier is being passed to Supabase. Hashing it does NOT make ` +
        `this safe — IS ids are 6-7 digits and reverse in seconds. Use the random ` +
        `install id (src/services/identity/installId.ts) instead:\n` +
        offences.join('\n')
    ).toEqual([]);
  });

  it('does not hash identifiers outside the reviewed list', () => {
    const hashers = files
      .filter((f) => /crypto\.subtle\.digest/.test(f.text))
      .map((f) => f.path)
      .filter((p) => !DIGEST_CALLERS.has(p));

    expect(
      hashers,
      `New crypto.subtle.digest call site(s). A hash of a low-entropy identifier ` +
        `is NOT anonymisation. If this hashes anything derived from a student, ` +
        `remove it; otherwise add the file to DIGEST_CALLERS with a note:\n` +
        hashers.join('\n')
    ).toEqual([]);
  });

  // The install id is the sanctioned replacement, so it must stay random and
  // must never be derived from anything the student is.
  it('derives the install id from randomness, not from the student', () => {
    const src = readFileSync(join(SRC, 'services/identity/installId.ts'), 'utf-8');
    expect(src).toMatch(/crypto\.randomUUID\(\)/);
    for (const name of IDENTIFYING) {
      expect(src.includes(name), `installId.ts must not reference ${name}`).toBe(false);
    }
  });

  // reIS transmits nothing about a failure. This is the enforcement for that
  // decision, not a description of it: deleting `services/errorReporter/` is a
  // one-time act that any later PR could undo by adding an innocuous-looking
  // `sendTelemetry` back into `logError`, which ~195 sites already call.
  //
  // The bar is deliberately the whole vocabulary rather than one symbol. An
  // error reporter reintroduced under a different name still trips this if it
  // reaches for the old RPCs, and the RPCs are gone from the database anyway,
  // so a reintroduction has to be a conscious, visible act.
  it('sends no error, stack or file path anywhere', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = relative(ROOT, file);
      if (rel.includes('__tests__') || rel.includes('/test/')) continue;
      const src = readFileSync(file, 'utf-8');
      for (const banned of ['report_error', 'report_error_v2', 'sendTelemetry', 'initTelemetry']) {
        if (src.includes(banned)) offenders.push(`${rel} → ${banned}`);
      }
    }

    expect(
      offenders,
      `Error telemetry is back. reIS's stated position is that no failure ` +
        `information leaves the device — no error type, message, stack, file ` +
        `path or session id, on any platform. The Supabase tables and RPCs ` +
        `behind these names were dropped, so this cannot work anyway.\n` +
        `If the project has genuinely changed its mind, update PRIVACY.md, ` +
        `docs/privacy-policy-app.md and the published policy gist FIRST, then ` +
        `this test:\n` +
        offenders.join('\n')
    ).toEqual([]);
  });
});

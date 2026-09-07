/**
 * Decides whether a built reIS web bundle is healthy, from observations a
 * browser collected.
 *
 * Split from the Playwright driver on purpose: every rule below is a judgement
 * that can be got wrong, and a judgement in a browser callback is a judgement
 * nobody tests. The driver's only job is to gather facts.
 *
 * The rules are the checks that were being reassembled by hand on 2026-09-04,
 * once per verification, while six real defects went unnoticed between runs:
 * a build that rendered skeletons forever, a page writing to production
 * Supabase, a real student record copied into the output, and three guards
 * that were dead in a production build.
 */

import { SUPABASE_URL } from '../src/services/supabase/config';
import type { Finding } from './lib/uiFindings';

/** URLs the built preview must never request, whatever the method. */
const FORBIDDEN_URL_PATTERNS: { pattern: RegExp; why: string }[] = [
  {
    pattern: /is\.mendelu\.cz/,
    why: 'the preview has no IS session, so this can only ever be a CORS failure — and on a hosted page it means the university is being called on every visit',
  },
  {
    pattern: /dev-real-data\.json/,
    why: 'that is the RAW scrape — the build must only ever read the sanitised preview-data.json',
  },
];

/**
 * Supabase RPCs known to be read-only.
 *
 * An allowlist, not a denylist of the writes we happened to think of. Naming
 * the writes was the first version and it missed `increment_post_view` and
 * `increment_post_click` — the same mistake the build-env guard made before it
 * was inverted. Anything not listed here is treated as a write.
 *
 * The reason this cannot simply key off the HTTP method: PostgREST sends EVERY
 * `supabase.rpc()` as a POST, read-only ones included, so `get_event_rsvps` is
 * a POST that is perfectly fine.
 */
const READ_ONLY_SUPABASE_RPCS = [
  'get_event_rsvps',
  'usage_stats' /* read-only aggregate, no writes */,
];

const READ_ONLY_METHODS = ['GET', 'HEAD', 'OPTIONS'];

export interface ObservedRequest {
  url: string;
  method: string;
}

export interface HealthObservations {
  /** Every network request the page made, in order. */
  requests: ObservedRequest[];
  /** Row counts per IndexedDB store, after the app settled. */
  storeCounts: Record<string, number>;
  /** Elements still carrying DaisyUI's `skeleton` class after settling. */
  skeletonCount: number;
  /** Visible text length, as a crude "did anything render at all" signal. */
  textLength: number;
  /** Files present in the built output directory. */
  outputFiles: string[];
  /** Which data the build was meant to be showing. */
  mode: 'demo' | 'real';
  /** Findings from `analyzeProbe`, keyed by "<view> <width>px <theme>". */
  visual: Record<string, Finding[]>;
}

export interface HealthFailure {
  check: string;
  detail: string;
}

/**
 * Stores that must hold at least one row, per mode.
 *
 * `demo` is deliberately short: the synthetic dataset fills only what
 * MockManager writes, and asserting more would fail for a reason that is not a
 * defect. `real` is the fuller set, which is the whole point of real data.
 */
const REQUIRED_STORES: Record<'demo' | 'real', string[]> = {
  demo: ['schedule'],
  real: ['schedule', 'subjects', 'study_plan', 'files', 'syllabuses'],
};

export function evaluateHealth(o: HealthObservations): {
  ok: boolean;
  failures: HealthFailure[];
} {
  const failures: HealthFailure[] = [];

  for (const { pattern, why } of FORBIDDEN_URL_PATTERNS) {
    const hits = o.requests.filter((r) => pattern.test(r.url));
    if (hits.length > 0) {
      failures.push({
        check: 'forbidden request',
        detail: `${hits.length} request(s) matching ${pattern} — ${why}`,
      });
    }
  }

  // Anything to Supabase that is not a plain read, and not one of the RPCs
  // known to be read-only, is treated as a write. The preview must not write.
  const writes = o.requests.filter((r) => {
    if (!r.url.startsWith(SUPABASE_URL)) return false;
    if (READ_ONLY_METHODS.includes(r.method.toUpperCase())) return false;
    const rpc = r.url.match(/\/rest\/v1\/rpc\/([a-z0-9_]+)/i)?.[1];
    return !(rpc && READ_ONLY_SUPABASE_RPCS.includes(rpc));
  });
  if (writes.length > 0) {
    const named = [...new Set(writes.map((r) => `${r.method} ${r.url.replace(SUPABASE_URL, '')}`))];
    failures.push({
      check: 'supabase write',
      detail: `the preview wrote to Supabase: ${named.join(', ')}. Preview traffic must never reach production rows — add it to READ_ONLY_SUPABASE_RPCS only if it genuinely writes nothing.`,
    });
  }

  if (o.outputFiles.includes('dev-real-data.json')) {
    failures.push({
      check: 'raw scrape in output',
      detail:
        'dev-real-data.json is present in the build output. It is a real student record and must be stripped unconditionally.',
    });
  }

  // The failure that motivated this whole script: the app booted, fetched its
  // data, and sat on skeletons forever because nothing was listening. It looked
  // like a slow page rather than a broken one.
  if (o.skeletonCount > 0) {
    failures.push({
      check: 'stuck on skeletons',
      detail: `${o.skeletonCount} element(s) still carry the DaisyUI \`skeleton\` class after the app settled — the data never arrived.`,
    });
  }

  for (const store of REQUIRED_STORES[o.mode]) {
    const count = o.storeCounts[store];
    if (count === undefined) {
      failures.push({
        check: 'store missing',
        detail: `IndexedDB has no \`${store}\` store at all.`,
      });
    } else if (count < 0) {
      // The driver reports a failed count as -1. Failing closed matters: a
      // negative slipping through the `=== 0` test would have read as healthy.
      failures.push({
        check: 'store unreadable',
        detail: `Counting \`${store}\` failed. An unreadable store is not a populated one.`,
      });
    } else if (count === 0) {
      failures.push({
        check: 'store empty',
        detail: `\`${store}\` is empty; in ${o.mode} mode it should hold at least one row.`,
      });
    }
  }

  // Layout geometry, at every width the app claims to support.
  //
  // Only `error` severity fails. `uiFindings` already draws that line where it
  // belongs: overflow and collision are objective — an element is off-screen or
  // it is not — while contrast is `warn`, because its thresholds carry judgement
  // and the repo has pre-existing theme-token findings that must not block an
  // unrelated PR. Warnings are printed, never fatal.
  for (const [where, findings] of Object.entries(o.visual)) {
    for (const f of findings.filter((x) => x.severity === 'error')) {
      failures.push({
        check: `layout ${f.kind} · ${where}`,
        detail: `${f.sel} — ${f.detail}`,
      });
    }
  }

  // A blank page passes every check above, because nothing rendered to be
  // wrong. The threshold is deliberately low: a legitimate screen can be
  // short — the calendar on a day with no lessons renders about 190
  // characters, all of it correct — so this only catches a page that did not
  // render at all, not one that rendered little.
  if (o.textLength < 80) {
    failures.push({
      check: 'nothing rendered',
      detail: `The page has only ${o.textLength} characters of visible text — it did not render.`,
    });
  }

  return { ok: failures.length === 0, failures };
}

/** Human-readable summary for the CLI and for a CI log. */
export function formatHealthReport(
  result: { ok: boolean; failures: HealthFailure[] },
  mode: string
): string {
  if (result.ok) return `✓ app health OK (${mode} data)`;
  const lines = [`✗ app health FAILED (${mode} data) — ${result.failures.length} problem(s):`, ''];
  for (const f of result.failures) lines.push(`  [${f.check}] ${f.detail}`);
  return lines.join('\n');
}

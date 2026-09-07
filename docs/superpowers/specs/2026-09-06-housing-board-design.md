# Housing board, anonymous usage dimensions, and admin statistics

> **Withdrawn — never released.** The housing board was merged to `test` but
> pulled before any release: it was the only reIS feature that asked a student
> to attach their IS login and IS person id to something published to every
> other install. The code, the Supabase tables and RPCs, and the privacy-policy
> paragraphs were all removed. `housing_posts` held 0 rows when it was dropped,
> so no student identity was ever collected. Kept for the record only.
>
> **The housing board only.** The anonymous usage dimensions and admin
> statistics described in this same document shipped and remain in place —
> they carry group labels (faculty, platform) over thousands of installs, not
> per-student data.

Date: 2026-09-06. Authors: Dominik Holek with Claude. Status: draft for review.

## Why

Mendel University admitted more students than its dormitories can house; 100 to 150 students sit on the dorm waiting list in September 2026, and the same happens every February when exchange students leave and arrive. Market research (same date) showed that a search or alert tool on top of Sreality, Bezrealitky or Facebook would fail: scraping is forbidden by their terms, the alert niche is taken, and information alone cannot fix a supply shortage. What survives is a board where Mendelu students hand rooms to Mendelu students, reachable inside reIS and the reIS app, trusted because every post is tied to a verifiable IS login, and opened by the reIS society through the existing society post channel.

The same work settles a privacy question that came up on the way: reIS will record **which faculty and platform** its users come from (a count), and will never record **which student** uses it (a record). Identity travels only with an action a student takes on purpose, for a stated reason, for a bounded time.

## Decisions already taken

- Target: every Mendelu student who needs or offers a room, Czech or international. Every post carries a free-from date, so today's waiting list and the February handover use the same board.
- Students only, both sides. No landlords, no agencies, no other universities in v1.
- Every reIS user sees both lists, including the contact the poster typed and the poster's IS login. The reIS admins can hide or delete any post.
- No email verification. The IS login plus the existing person sheet proves more, for free.
- No student identifier is stored outside housing rows. Analytics use faculty and platform only.
- Admin statistics are visible only to the `reis_admin` role (two people), in the console, including on the phone.

## Scope

Three parts, one spec, one release:

- **Part A**: faculty and platform on the anonymous daily usage event.
- **Part B**: the housing board.
- **Part C**: usage statistics in the admin console for `reis_admin`.

Out of scope for v1: matching logic, chat, photos, landlords, other universities, payments, a public web page, per-post view analytics, a pre-arrival flow for exchange incomings.

## Part A: usage dimensions

**What changes.** The `track_daily_usage` RPC (called from `src/api/feedback.ts`) gains two optional arguments, `p_faculty text` and `p_platform text`. The table behind it gains two nullable columns of the same meaning. The migration is additive: the old signature keeps working so released clients are unaffected.

**Values.** `faculty` is the faculty acronym the store already holds as `userFaculty` (`src/store/types.ts`, sourced from `UserParams.facultyLabel`), the same key `FACULTY_TO_ASSOCIATION` uses, or null when unknown. `platform` is one of `extension`, `ios`, `android`, `web`, derived from the platform layer (`src/platform/`), never from the user agent string.

**Why this is still anonymous.** Six faculties times four platforms is a coarse grouping of thousands of installs. The row still carries only the random install id. Nothing about the person is added.

**Privacy text.** `PRIVACY.md`, `docs/privacy-policy-app.md` and the published gist gain one sentence: the daily count now carries faculty and platform, these are group labels, nothing else changed. No new file joins the guard's allow-list; `src/api/feedback.ts` is already on it and its comment is updated.

## Part B: housing board

### Data

One table, `public.housing_posts`:

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| kind | text | `offer` or `request` |
| room_type | text | `bed_shared`, `room_private`, `flat` |
| district | text, max 60 | free text, e.g. "Královo Pole" |
| price_czk | int, nullable | per month |
| free_from | date | required |
| free_until | date, nullable | |
| note | text, max 500 | hand-typed |
| contact | text, max 120 | hand-typed: email, phone, Instagram, whatever the poster chooses |
| is_login | text | the poster's IS login, attached by the app after consent |
| is_person_id | text | the poster's IS person id, attached with the login; it is what opens the person sheet |
| install_id | uuid | random per-install id, so the owner can close their own post (pattern from `event_rsvps`) |
| expires_at | timestamptz | `created_at + 14 days`, fixed; a student whose room is still open re-posts |
| hidden_by_admin | bool | default false |
| created_at | timestamptz | |

Row level security is deny-all for `anon` and `authenticated`. Every access goes through a function:

- `list_housing_posts()` returns rows that are not hidden and not expired, all columns except `install_id`. Callable with the publishable key: the board is visible to anyone running reIS.
- `submit_housing_post(...)` validates lengths and enum values, enforces at most three live posts per `install_id` and a coarse hourly flood bucket (same shape as `check_and_log_suggestion_bucket`), and returns the new id or false.
- `close_housing_post(p_id uuid, p_install_id uuid)` deletes the row when the install id matches.
- Hide and delete for admins run through the signed-in console client under a `reis_admin`-only policy, the way `suggestions` reads do.

Expired rows are deleted opportunistically by `submit_housing_post`, the way `set_event_rsvp` sweeps tombstones. Deletion is real deletion; nothing is archived.

### Trust

- The form shows a consent line before the publish button: "Your IS login and the contact you type will be visible to other reIS users until this post expires or you close it." The button is disabled until the box is ticked.
- Every card shows the poster's login. Tapping it opens the existing person sheet (`{ kind: 'person' }`), so the reader confirms a real Mendelu student in one tap.
- Every card has a report action. It calls the existing `submit_suggestion` RPC with the post id and a fixed prefix, so moderation arrives in the suggestions inbox with no new plumbing.
- Posts disappear 14 days after posting, on owner close, or on admin hide. Two weeks is enough for a room to be taken; a re-post costs one tap from "My posts".

### Surfaces

- New `housing` member of the `MobileSheet` union (`src/store/types.ts`) and a matching desktop panel. Permanent entry in the profile tab on the phone and in the desktop navigation, labelled "Bydlení" / "Housing".
- Inside: two tabs, "Nabízím" / "Offering" and "Hledám" / "Looking". A list of cards showing kind, room type, district, price, free from, note, poster login, contact. A floating add button opens the form. A "Moje inzeráty" / "My posts" row lists this install's live posts with a close action.
- The form has one screen: kind, room type, district, price, free from, free until, note, contact, consent. The IS login is read from the store, shown read-only on the form, never typed.
- Launch distribution: the reIS society publishes a normal post from the console whose `url` is the in-app token `reis://housing`. `NotificationItem` recognises the token and opens the housing sheet instead of a browser tab. The token recogniser is a pure function with tests.
- Strings live in `src/i18n/locales/cs.json` and `en.json`. DaisyUI semantic classes only. Files stay under 200 lines; the sheet, the card, the form and the API client are separate files.

### State and data flow

- A `createHousingSlice` in `src/store/slices/` holds the post list, the loading flag, and this install's post ids. Components read the slice synchronously. Fetching happens in the slice action, not in `useEffect`.
- `src/api/housing.ts` is the only file that talks to Supabase for this feature, wrapping the three RPCs and validating rows with a zod schema before they reach the store. It joins the guard's allow-list with a comment stating that `is_login` and `contact` are sent only on a post the student composed and consented to, and that reads carry no identity.

### Privacy order of operations

1. `PRIVACY.md`, `docs/privacy-policy-app.md` and the published gist gain a housing paragraph: what is stored (the fields above), who sees it (every reIS user, plus the two admins), for how long (14 days from posting, or until the poster closes it), how to delete (close your post; or ask via the suggestion form and an admin deletes it).
2. `src/test/guards/noStudentDataLeaves.test.ts` gets `src/api/housing.ts` in `SUPABASE_CALLERS` with the justification written in the comment.
3. Only then does the client code that sends anything land.

## Part C: admin statistics

**What.** A "Statistiky" / "Statistics" panel in the admin console, desktop and `MobileAdminConsole`, rendered only when `adminRole === 'reis_admin'`. Society accounts never see it.

**Numbers shown.** Active installs today, last 7 days, last 30 days. A breakdown of the last 30 days by faculty and by platform. A 12-week trend of weekly active installs. All numbers are counts of installs, never of people, and the panel says so in one line, because one student on a phone and a laptop counts twice.

**How it is read.** One RPC, `usage_stats(p_days int)`, `SECURITY DEFINER`, that aggregates the daily usage table and returns grouped counts. It is granted to `authenticated` only and checks inside that the caller's account holds the `reis_admin` role, mirroring how suggestions reads are scoped to that role. It never returns install ids or rows, only counts per group and per day. Groups with fewer than five installs in the window are reported as "under 5" so a tiny faculty on a rare platform cannot be narrowed to a person.

**Charts.** Bars for faculty and platform, a line for the trend, built as plain inline SVG in a component under 200 lines, styled with DaisyUI colour classes; no chart library is added. Verified with the verify-ui skill at 320, 390 and 430 widths in both themes.

## Testing

Test first, per the iron rules.

- Unit: housing payload builder, zod row schema, 14-day expiry computation, the `reis://housing` token recogniser, the platform derivation, the `usage_stats` response mapper, the "under 5" suppression helper.
- SQL: a test migration or script asserting that `anon` cannot select from `housing_posts`, that `list_housing_posts` excludes hidden and expired rows and never returns `install_id`, that `submit_housing_post` refuses a fourth live post per install, that `usage_stats` refuses a non-admin session.
- Guard: `noStudentDataLeaves.test.ts` passes with `src/api/housing.ts` allow-listed and fails if any other file reaches Supabase.
- UI: verify-ui screenshots of the board, the form, the consent state, an empty board, and the statistics panel at phone and tablet widths, light and dark.

## Launch

1. Ship the release with all three parts.
2. From the console, publish the society post "Hledáš bydlení? Nabízíš pokoj?" with `url = reis://housing`.
3. Post the same call in the Mendelu Facebook groups with the install link, since many waitlisted first-years do not have reIS yet.
4. In February, publish a second post aimed at students leaving for exchange.

## Deliberately not doing

- No email verification.
- No student identifier stored outside housing rows, and none on the usage event.
- No analytics on who viewed or contacted which post.
- No landlord side. If student supply proves too thin, a landlord flow is a separate spec.
- No public web page. The Facebook post links to the install page instead.

# Privacy Policy for reIS

**Last Updated: 6 September 2026**

reIS is a student-built project that simplifies the Mendel University in Brno
Information System (IS Mendelu). It is a browser extension (Chrome, Edge,
Firefox) and a mobile app (Android, iPhone, iPad). It is not an official
application of Mendel University.

## Your academic data stays on your device

Your name, personal number, study details, timetable, grades, assessment, exam
dates, courses, materials and submission folders are fetched from MENDELU using
your own session — the way your browser would — and kept on your device.
**None of it reaches us. We run no server that holds it.** It moves only between
your device and MENDELU, both ways, since signing up for an exam sends it back.
Uninstalling removes the local copy.

You sign in on IS Mendelu's own page; your password goes straight to
`is.mendelu.cz` and **reIS never sees it**. The session token is kept encrypted
(Android Keystore; iOS Keychain, **never synced to iCloud or another device**;
a normal cookie in the extension). Signing out deletes it.

**No crash or error information is ever transmitted**, from any surface, on any
platform.

## What we do send

| what | when | what it carries |
|---|---|---|
| Daily count | once a day | a random install identifier — a UUID unrelated to you. Counts **installs, not people**, plus faculty and platform as group labels. |
| Feedback | you press send | your message, any contact detail you type, the screen name, app version, browser, window size |
| In-app survey, event RSVP | you answer / RSVP | the same random install identifier |
| Society post view or click | you open one | a post id |

Nothing else. Feedback is read by the developers and passed to nobody.

**Your network address is not recorded** — this version writes straight to the
database, which cannot see your connection. Versions released before September
2026 store a salted hash of it for up to an hour to limit the form; never the
address, never beside your message. That component goes when those versions do.

*Lawful basis: legitimate interest, GDPR Art. 6(1)(f) — knowing the project is
used, and fixing what you report.*

## Who else reIS talks to

**IS Mendelu** receives your academic data, authenticated as you — it is the
university's own system and the only recipient of it. **jsDelivr** serves public
course-difficulty statistics; no identifier is sent, though the set of subjects
requested does reveal which courses you take. **Supabase** hosts reIS's own
database — infrastructure, not a recipient doing anything of its own.

We do **not** sell or trade your personal information, and transfer it to no one
else.

## Permissions

**Android:** internet; notifications (so a download can say it finished); Wi-Fi
state, only for optional one-tap eduroam, where Android's own dialog saves the
network. **iOS: none.** **Neither app requests location** — the campus map shows
the campus, not you.

## Your control

Sign out to delete the token and cookies. Uninstall to delete everything local.
For feedback you sent, write to the address below and we will delete it; the
daily-count rows hold nothing that identifies you.

## Changes

We may update this policy; changes appear here with a new date. Google Drive
backup, Outlook calendar sync, WebISKAM, library study-room booking, AI syllabus
comparison and automatic error reporting have all been removed from reIS, along
with everything they sent.

## Contact

`reis.mendelu@gmail.com`

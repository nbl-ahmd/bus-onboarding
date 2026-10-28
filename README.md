# Nightline

A mobile-first passenger announcement PWA for a small overnight sleeper-bus fleet. The first pilot is intentionally manual: choose a trip, confirm the facts and tap an announcement. One tap plays the saved Malayalam/English sequence; Edit or long-press opens details when needed. The device sends ordinary media audio through the output selected in phone settings, including paired bus Bluetooth.

## Start locally

Requires Node.js 20.9+ (developed on Node 24).

```sh
npm install
npm run dev -- --port 3100
```

Open http://localhost:3100. No keys are needed for local pilot mode. Playback requires saved audio or actually available device voices in both selected languages; a missing voice opens the editor with a recovery action. Sample departure/arrival times are explicitly illustrative; distance and stops start empty. Configure the actual operator, timetable and crew before passenger use.

Offline app caching is enabled in **production**, not the development server:

```sh
npm run build
npm run start -- --port 3100
```

Open the production app online once, then prepare or upload audio. Ordinary LAN HTTP on a phone is not a secure context: installation, recording, service workers and some storage APIs require HTTPS (or localhost). Use an HTTPS deployment to test on physical phones.

## What works without accounts or keys

- Simplified desktop workspace and mobile quick-play list; editing lives in a separate sheet.
- Saved English/Malayalam order with 1–3 repeats, alternating or grouped (EN → ML → EN → ML or EN → EN → ML → ML). Audio files are reused.
- One Stop action cancels the entire sequence, even during a pause.
- Optional long-press to edit, swipe-player-left to stop, swipe-editor-header-down to dismiss and light haptics on browsers with vibration support. iPhone Safari does not support web vibration; visible controls always remain available.
- 15 bilingual pilot templates (including per-stop approach, boarding and drop-off): welcome, briefing, safety, departure, refreshment break, resume, unscheduled stop, traffic/delay, quiet reminder, approaching destination, arrival and thanks.
- Custom bilingual announcements, script edits, search, category filters and favourites.
- Manual route distance, overnight departure/arrival dates, bus, crew, stops, delay cause and revised arrival.
- Trip creation, return-journey duplication, editing, JSON import/export.
- Local bus and driver profiles, clearly distinguished from real cloud accounts.
- Device TTS **when the device actually provides the selected language**; missing voices produce a clear error, not a silent English substitution.
- Microphone recording, audio upload, local saved-audio playback and file download.
- Offline trip persistence and audio library using IndexedDB.
- Played/stopped/failed activity, JSON export, speaker-test tone, non-blocking quiet-journey notes, day/night appearance and optional screen wake lock during active trips.
- PWA manifest, local app icons, service worker and install guidance.

Malayalam scripts are draft pilot content: have a native speaker approve copy and pronunciation. Device TTS may still depend on installed voices or the device's internet connection. Only downloaded/recorded audio is explicitly offline-ready.

## Guided journeys

Set up the route once, with up to **200 stops** in travel order. Each boarding, drop-off and rest stop has an optional IST clock time and duration. Drag on desktop or use the accessible up/down buttons on a phone. A stop's stable ID keeps it associated with its announcements after reordering.

**Start trip** opens a focused guide: welcome, journey summary, departure, each stop's approach and stopped messages, final approach/arrival and thanks. Rest stops also get a return-to-bus message. One tap plays the entire saved bilingual sequence, with an optional bundled two-note chime once at the beginning. Successful completion advances the guide. Stop, missing audio and failed generation leave the current step in place. Skip advances explicitly. View route lets you replay another step. Traffic, summary, unplanned stop and return-to-bus shortcuts leave your route position unchanged. Progress is persisted with the trip and included in fleet sync. One controlling phone per active trip remains the pilot constraint.

The full announcement library is collapsed during an active trip. Editing lives in a sheet. Completed trips offer **Run again**, which copies the route and crew, resets progress and rolls the schedule to the next occurrence of its departure time. Confirm the timetable before each run; no automatic traffic/ETA inference occurs.

**Download trip audio** prepares all steps with the exact facts for each stop, in both selected languages. Matching files are skipped, interrupted batches can resume, and repeat playback never generates another file. Only messages whose rendered words, language, model or selected voice change need new audio. Bulk preparation saves a reusable summary without forecast data. Arrival uses relative wording such as “tomorrow 7 AM” relative to departure, allowing unchanged daily runs to share audio. Live summaries use the current day, add a fresh matching destination forecast, and generate missing audio on playback when enabled. Offline playback uses the reusable summary. There is no automatic regeneration of the whole library on a weather refresh.

Settings includes live generation, summary mode, per-language voice/model selection, pace, chime, night appearance, gestures and haptics. Audio library can export every locally saved voice and its exact script in one ZIP. Device speech cannot be downloaded as an audio file through the browser; use generated voices or recordings for an explicitly offline-ready pack. A large route can exceed a free TTS daily quota: prepare across days, reuse recordings, or use installed device voices.

The PWA precaches the app's initial JS, CSS, bundled fonts, icons and chime. An update banner applies a waiting version only on your tap, with the action disabled during playback/preparation. Trips and audio stay in IndexedDB. Browser eviction, calls, screen locking and OS audio routing still need physical-phone testing.

## Optional environment configuration

Copy `.env.example` to `.env.local` and restart the server. Never commit secrets.

| Variable                        | Purpose                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                                                                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon/publishable key; protected by RLS                                                   |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-only admin key, needed only to create real driver accounts                               |
| `GEMINI_API_KEY`                | Server-only Gemini Developer API key                                                            |
| `GEMINI_LIVE_MODEL`             | Live fallback model; defaults to `gemini-3.8-live`                                              |
| `GEMINI_TTS_MODEL`              | Eligible speech model in your AI Studio project; defaults to `gemini-3.8-flash-lite-tts`        |
| `GEMINI_TTS_VOICE`              | Compatible prebuilt voice, defaults to `Kore`                                                   |
| `PILOT_ACCESS_CODE`             | Optional shared secret of at least 12 characters to unlock Gemini when testing without Supabase |
| `WEATHER_CONTACT`               | Your public support URL/email identifying the app to MET Norway                                 |

### Live voice preparation · default

Choose **Settings → Audio generation service → Gemini Live**. This is the default preparation engine for existing and new phones that have not chosen another engine. Playback remains a separate preference: Device voices allows device fallback; Saved voices only requires a matching prepared recording.

Live uses the existing server-only `GEMINI_API_KEY`; `GEMINI_LIVE_MODEL` optionally sets the server fallback (default `gemini-3.8-live`). The app also offers the 2.5 Native Audio model in Settings. No microphone permission, extra API key, paid Maps integration or database migration is required. Model availability and free-tier eligibility remain properties of the Google project.

1. Sign in to the fleet or unlock the pilot voice service using the existing access code.
2. Choose **Download trip audio** or **Prepare voice**. Languages are grouped during preparation so a bounded connection can record several independent clips.
3. Review clips in **Audio library**. The expected script and optional output transcript appear beside each clip. Play the full recording, check wording/names/times and pronunciation, then choose **Approve for bus**. Transcript matching is an aid, never automatic approval.
4. Incorrect output can be regenerated one clip at a time. Regeneration skips the local/fleet copy, keeps other files, and requires fresh listening/approval. Failed or cancelled regeneration keeps the previous clip.
5. Approved files work offline and repeated playback uses no generation requests. Pending Live clips are excluded from announcement readiness, playback and trip advancement. A new Live clip made on demand opens the review screen instead of broadcasting automatically.

The browser receives a single-use, five-minute token through authenticated `/api/live/session`. The token is restricted to the chosen model, voice, audio output and announcement instructions. The permanent API key stays on Vercel. Audio travels directly over the constrained Google Live WebSocket endpoint, avoiding a long-running Vercel WebSocket proxy. The installed SDK's ephemeral-token transport uses `v1alpha`; token provisioning and the browser connection use the same version.

Each complete turn is assembled as its own 24 kHz mono WAV, with its transcript and review state stored in IndexedDB. Connections rotate after six clips, three minutes or a language change; batches close them at completion/cancellation. Incomplete/interrupted recordings are discarded. A stopped batch can be restarted to skip already saved files, including pending review files. Only approved Live clips are uploaded to the private fleet bucket; another phone must review its downloaded copy before bus playback.

Live's request limits are separate from dedicated TTS, so preparation does not use the TTS 21-second queue or `consume_speech_quota` counter. Token/session limits, model access and provider free-tier terms still apply. The token endpoint uses the existing trusted fleet/pilot authorization and does not claim a distributed Live-session billing quota. Existing dedicated TTS files are kept; selecting Dedicated TTS reuses matching files without generating them again.

### Dedicated TTS alternative

Use a free-tier-enabled **Gemini Developer API** project. Model availability, language coverage, quotas and provider terms must be checked in your account. Flash-Lite 3.8 uses the documented `interactions` speech endpoint; the legacy 2.5 model remains available through `generateContent`. Settings lets the crew select an allowlisted model and independent English/Malayalam prebuilt voices. Device voices remain the option without API quotas. Google AI Studio currently shows 3 requests/minute and 10 requests/day for the available free TTS models in the inspected project; switching models does not guarantee a larger quota. Requests from this phone are spaced at least 21 seconds apart.

Click **Prepare voice** on a preview or **Prepare audio**. The server returns a WAV file; the phone saves it under a content hash of fleet, language, exact script, model and voice. Matching recordings are preferred over generated voices. Changes to the facts or script intentionally invalidate old cached audio.

Generation requires a signed-in fleet member or a server-configured pilot access code. Enter the shared code in Settings; it creates a 12-hour HttpOnly cookie. The code is never an API key. Supabase members have a persistent 40-request/day application limit in addition to provider limits. Shared-code mode is for a small trusted test group and has no distributed per-user quota; keep the provider project on its free tier and do not expose this mode as a public speech service.

With Supabase connected, audio generated during bulk/preview preparation is also uploaded to a private fleet storage bucket. Preparation first checks for matching private fleet audio and downloads it before requesting a new voice. Playback always uses local audio; a cloud upload is not an assertion that every fleet phone already downloaded it. User recordings remain local. No external API has been live-tested without supplied credentials.

### Supabase: accounts, database and storage

1. Create a free Supabase project.
2. Run `supabase/migrations/001_pilot.sql` once in SQL Editor.
3. Set the public URL and anon key. Add the server service-role key if creating drivers from the Fleet screen.
4. Configure Auth site URL/redirect URLs for the deployment. Email confirmation follows your project settings.
5. In Nightline choose **Connect account → New fleet? Create an administrator account**. Confirm your email if required, sign in, then create a fleet.
6. Add buses and driver accounts as administrator; give each driver their credentials directly. This pilot does not use paid SMS or invitation email integrations.
7. Create a trip and press **Sync fleet**. Drivers sign in to see their assigned trips, download/prepare their own audio and use **Sync fleet** to upload changes and playback logs.

Local pilot profiles/data are a separate workspace and **are not automatically promoted to cloud accounts**. Export/import a trip if you want to copy a prepared itinerary into a cloud fleet.

Tables: `fleets`, `fleet_members`, `vehicles`, `trips`, `announcement_templates`, `announcement_events`, `speech_usage`. RLS isolates fleets, restricts administration, and limits drivers to their assigned trips. Service-role credentials stay in the server-only driver provisioning route. Membership cannot be edited directly by a browser client.

Use one controlling phone per trip in this pilot. Synchronization is explicit, with an IndexedDB outbox and idempotent inserts. Concurrent trip edits use last successful write, not a multi-writer conflict-resolution algorithm. Local changes survive a failed sync and are retried; a local pending copy wins over downloaded state until it is sent. Fleet sign-out retains the account-scoped local cache for offline re-entry on trusted devices. Clear site data when handing a phone to someone else.

### Weather

Set `WEATHER_CONTACT` to a real support URL/email. The server requests only Bengaluru or Kozhikode, caches the destination forecast for an hour and chooses the forecast nearest the scheduled arrival. Live summary mode refreshes the forecast online on route/arrival changes, reconnect and every 30 minutes. **Fetch** can also refresh it manually. Missing, stale or wrong-destination weather is omitted from the script. The forecast is never represented as a live observation.

Data: [MET Norway](https://api.met.no/) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), with service identification, caching and fair-use requirements. The app displays attribution and translates the forecast into a passenger summary. Follow [MET Norway service terms](https://docs.api.met.no/doc/TermsOfService.html).

No Google Maps, traffic, SMS, payments or other billing-dependent integration is enabled.

## Deploy to Vercel

Recommended for this **non-commercial evaluation prototype**, as requested. Next.js App Router and route handlers deploy directly without extra adapters.

1. Push this folder to a Git repository and import it into Vercel as Next.js.
2. Add environment variables in the project settings (only those you need).
3. Deploy. Add the HTTPS deployment URL to Supabase Auth if connected.
4. Open online, install on each driver's phone, configure the actual trip, test the speaker output and prepare voices.

A paid/commercial operating service needs hosting terms to be reassessed: Vercel Hobby is limited to personal/non-commercial use. Cloudflare remains an alternative but full Next.js server features need an appropriate Workers adapter; this repository targets Vercel, not a static-only Pages export. The pilot is deployed at https://bus-onboarding.vercel.app and connected to the main branch of https://github.com/nbl-ahmd/bus-onboarding.

## Verify

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Playwright uses port 3100, and either reuses this app's production server or starts it. Install browsers with `npx playwright install chromium` if necessary. E2E tests cover overnight trip preparation, manual delay facts, editing, offline reload, custom announcements, uploaded-audio playback/activity, mobile navigation, profiles, night mode and server authorization. These are browser tests, not physical Bluetooth or iOS certification.

See [architecture](docs/ARCHITECTURE.md), [pilot procedure](docs/PILOT.md) and [future changes](docs/ROADMAP.md).

### Quick-play refresh

The UI uses the local `gpt-taste` skill with its cinematic marketing patterns intentionally omitted in favor of the user's minimal-tap driver workflow. English typography is locally bundled Outfit. GSAP drives brief row transitions and respects reduced motion. Existing workspaces receive the new repeat/haptic/gesture preferences without clearing trips or audio; existing language choice is preserved. Sequence changes are committed to IndexedDB before the sequence dialog closes.

Quick-play facts remain scoped to their announcement for the current trip. A refreshment location does not overwrite the arrival location. Unconfirmed delay lengths are omitted; unknown break timing uses a generic crew-instruction message. Changing trips clears temporary stop/delay context.

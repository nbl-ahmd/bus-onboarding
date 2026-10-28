# Verification record

Verified on 25 October 2026 after the quick-play UX refinement, with no external-service credentials configured.

- Next.js production build: passed.
- TypeScript strict typecheck: passed.
- ESLint: passed with no warnings.
- Vitest: 19 tests passed. Coverage includes bilingual scripts, omission of unknown distance/weather/timing, confirmed delay causes, stale forecasts, overnight dates, language order, trigger dispatch, fleet sync dependency order, per-language readiness, preference migration, finite alternating/grouped repetitions, sequenced playback, and stopping during the pause.
- Playwright Chromium: 10 end-to-end tests passed. Existing checks cover trip editing and offline reload, script editing, custom announcements, uploaded WAV playback/activity, mobile navigation/profiles/preferences and API authorization. New checks cover one-tap bilingual playback, grouped sequence persistence across reload, haptic calls, long-press without a ghost play, swipe-stop, immediate manual playback in quiet mode and isolation of stop facts between announcements.
- Render inspection: 1440px desktop, 390px phone, dark/light appearance, sequence presets, editor and settings. The four default favourite rows fit above the mobile dock at 390×844. Settings were additionally checked for horizontal overflow at 320, 375, 390, 768 and 1440px; none found. Captures are local development artifacts under `.impeccable/review/quick-*.png`.
- Dark heading-button contrast was corrected and checked from rendered computed colors.

The new speech-order tests use controlled browser speech/voice doubles to verify sequencing, progress, cancellation and activity. The uploaded test WAV is generated silence used to verify media lifecycle. Neither assesses actual pronunciation, volume or cabin sound. Vibration calls are verified with a test double; physical haptic feedback has not been tested.

Not verified: a real Supabase project or migration execution, actual authenticated cross-tenant RLS, live Gemini generation/quotas, live weather credentials, a Vercel deployment, physical iOS/Safari behavior, hardware microphone access, haptic hardware or a bus Bluetooth/head-unit connection. No automatic traffic detection or background PWA guarantee is claimed.

## Guided-trip update · 28 October 2026

- Production build, strict typecheck and warning-free ESLint pass.
- 30 unit tests pass. Added route compilation, per-stop facts, stable ordering/progress, 200-stop validation, reusable relative arrival wording, independent language voice hashes, both speech API adapters with mocked responses, voice validation, sanitized quota errors, request pacing/cancellation, and one chime per bilingual sequence.
- 11 Chromium end-to-end tests pass against a local production build. The new journey test sets up/reorders stops, plays a guided announcement, interrupts with traffic, skips, reaches the next stop's approach/stopped messages, reloads and then reloads fully offline while retaining route progress. The existing quick-play, recordings, mobile navigation, preferences and authorization checks still pass.
- Chrome phone-size visual review covers sequential stop editing and active-trip controls. The active-trip page heading is removed from visual layout to keep more controls above the mobile dock; its accessible heading remains.
- Service-worker installation precaches the initial JS/CSS/fonts and local chime. Offline reload is verified in the journey test. Builds generate a unique worker version so a new deployment can offer an explicit update. Browser eviction and physical iOS update behavior remain unverified.
- Live speech protocol tests use controlled API responses. No claim of live pronunciation quality or a successful new-model request is made. Existing Vercel service configuration was inspected through its public boolean config endpoint without exporting keys.
- The inspected Google AI Studio free-tier project shows 3 RPM / 10 RPD for the available TTS models, including 3.8 Flash-Lite; a larger quota is not promised. Text-only Flash-Lite quotas do not apply to speech.

Physical bus speakers/Bluetooth routing, background/locked-phone playback, native microphone permission and Malayalam pronunciation still require the operator's device pilot.

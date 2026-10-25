# Architecture

## Stack decisions

Next.js App Router + TypeScript, responsive CSS, Supabase Auth/PostgreSQL/private Storage, IndexedDB using `idb`, standard browser media APIs, optional Gemini REST speech generation and MET Norway forecasts. Vercel is the simplest deployment for this non-commercial Next.js pilot. Icons are Lucide; Outfit and Noto Sans Malayalam fonts are bundled locally. GSAP supplies bounded row transitions with reduced-motion support.

Supabase fits this fleet's relational access model: users belong to fleets, trips have drivers/vehicles, and activity belongs to trips. PostgreSQL foreign keys and row-level security enforce those relationships. Neon would provide PostgreSQL but need separate authentication and file storage. MongoDB is viable but adds no advantage for these relationships and would also need those services. Supabase reduces independent integrations for this prototype.

## Boundaries

| Boundary             | Current adapter                                                 | Replacement seam                                                                                                            |
| -------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Announcement facts   | `ManualRouteFactsProvider`, typed trip and context facts        | A route/ETA API can implement `RouteFactsProvider` and persist confirmed estimates separately from the scheduled timetable. |
| Triggers             | `ManualAnnouncementTrigger` with typed `TriggerEvent`           | GPS, schedule or traffic triggers implement `AnnouncementTrigger` and dispatch the same payload.                            |
| Composition          | Pure `renderAnnouncement`                                       | Extend templates and facts without changing playback or trigger delivery.                                                   |
| Speech               | `GeminiSpeechProvider` implements `SpeechProvider`              | Replace with another remote service, a server-hosted local model or recorded voice preparation.                             |
| Playback             | `BrowserPlaybackAdapter` implements `PlaybackAdapter`           | Capacitor/native audio and focus handling.                                                                                  |
| Offline persistence  | `IndexedDBWorkspaceRepository` implements `WorkspaceRepository` | Capacitor SQLite or another platform store.                                                                                 |
| Shared persistence   | `SupabaseWorkspaceGateway` implements `CloudWorkspaceGateway`   | Another backend preserving the tenant/role model.                                                                           |
| Destination forecast | `MetNorwayWeatherProvider` implements `WeatherProvider`         | Another licensed forecast source.                                                                                           |
| Speaker selection    | Operating system audio routing                                  | Platform-specific native adapter; do not use Web Bluetooth as a speaker transport.                                          |

Do not add adapters for every utility. These interfaces isolate actual external sources and platform behaviours. Provider selection is currently deliberate and small; there is no runtime plugin loader or automation pretending to be active.

## Announcement flow

1. A direct play tap preflights both selected languages and dispatches a typed manual trigger with template identifier, confirmed facts and the exact checked scripts. Editing is optional.
2. The shared playback path resolves the template and exact bilingual scripts.
3. It resolves requested language order and checks matching cached recordings/generated audio.
4. It expands the saved language order into a bounded alternating or grouped sequence (one to three repeats), reusing the same cached files. It preflights all required device voices before starting if saved audio is absent. Gemini preference requires explicit preparation rather than an unexpected live API call.
5. Browser playback handles one announcement sequence at a time and reuses its media element. Immediate Stop cancels media/device speech, any between-language pause and pending preflight. A synchronous operation lock guards repeated taps and competing preparation.
6. A single played/stopped/failed event, including the actual full sequence, is saved locally and queued for fleet synchronization.

Recorded playback completion means the media engine completed, not that a passenger actually heard the bus speakers. A cabin speaker test is explicitly confirmed by a human.

## Offline and caches

The production service worker caches only the app shell, same-origin static chunks, fonts and icons. It excludes API and React Server Component requests. Sensitive account/route-handler responses are not service-worker cached. Workspaces are separated by local-pilot/user identity; audio keys include fleet ID, exact spoken text, language, model and voice. Recordings use a distinct variant and take priority.

Trip data, preferences, outbox and audio blobs are in IndexedDB. No API keys or driver passwords are stored there. Browser storage remains evictable; request persistence and verify downloads before a journey. The shell uses network-first navigation with offline fallback. A changed service worker waits until a later app session rather than interrupting a trip.

Device TTS is not classified as saved/offline-ready audio. iOS/Android may suspend a hidden PWA; screen wake lock is best-effort, applies only while visible, and does not unlock background capabilities. No silent audio loop is used to circumvent browser limits.

## Cloud security and synchronization

Browser Supabase clients use a public key with per-fleet RLS. Speech authorization verifies the bearer token with Supabase and looks up membership; driver creation also requires administrator role. Bootstrap is an authenticated security-definer RPC with controlled search path and a per-user advisory lock. Driver provisioning rolls back a newly-created auth user if membership insertion fails.

Private storage paths are fleet-prefixed; storage policies verify the prefix against authenticated membership. No service-role client reaches a browser bundle. Preparation downloads matching cloud audio when available before making a speech request. Generated audio is also backed up to cloud storage, while playback readiness describes the current phone's actual local files.

Trips are JSON payloads inside relational records with typed fleet/driver/vehicle foreign keys. Templates are fleet scoped; event inserts are append-only and tied to an authorized trip. The pilot uses explicit sync, coalesces pending updates by entity, orders vehicles/trips before dependent events, retries idempotently, and preserves edits made while a sync was in flight. This is last-write-wins for multi-device trip edits; shared editing/conflict resolution and account revocation during offline operation are outside this pilot's guarantees.

## Capacitor path

Keep the domain renderer, templates, trigger payload and Supabase schema. Package the frontend for a native shell and select native implementations for storage, audio, permissions and lifecycle. Next.js server route handlers stay deployed on the HTTPS backend; a static native bundle cannot execute them. Configure an explicit API base URL, bearer auth, origins, and callback/deep-link handling for that native client. Do not expect wrapping alone to make background location or audio reliable. Native permissions, platform policies and device tests are a separate delivery phase.

## Interaction adapters

`HapticsAdapter` isolates the browser Vibration API from future native implementations. Feedback is optional and a no-op where unsupported; it never gates playback. Quick rows distinguish taps, long presses and scrolling movement, suppressing a tap after a recognized hold. The persistent player has a horizontal stop gesture and a visible Stop button. The editor header alone accepts a downward close gesture. All gesture actions have ordinary button alternatives.

`normalizePlaybackPreferences` upgrades existing IndexedDB workspaces with finite repeat settings, gestures and haptics without deleting audio or changing the selected language order. Preparation still fetches each unique voice only once; repeats affect playback, not TTS generation cost.

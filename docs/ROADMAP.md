# Evolution without rebuilding the core

## Pilot follow-ups

- Configure and test real Supabase accounts, RLS, private audio uploads and tenant isolation in a disposable project.
- Evaluate Gemini free-tier Malayalam pronunciation with the actual route and crew names.
- Add explicit fleet audio download/metadata management and approved reusable voice packs.
- Add administrator bus/profile editing, account password reset and device cache removal for shared phones.
- Add multi-device conflict detection if more than one phone controls a trip.

## Routing and automation

Implement a billing-enabled route provider only when authorized. Keep scheduled arrival distinct from derived estimated arrival, attach source/freshness metadata, honor the operator's approved corridor and add remaining break durations. Add a traffic trigger that dispatches the existing `TriggerEvent` only after sustained material change, cooldown, data-freshness checks and optional crew approval. A delayed ETA does not prove a specific incident.

GPS triggers need route order, direction, accurate recent location, stop state and once-per-trip deduplication. Manual buttons remain available. On browser platforms, automation remains foreground/best-effort.

## Native phase

Use Capacitor when field evidence warrants native audio/lifecycle/location work. Add native adapters and explicit API base URL/deep-link authentication. Background location/audio requires native implementation and real OS/head-unit tests, not just packaging. Keep Bluetooth ordinary system audio unless the hardware exposes a separately documented control protocol.

## SaaS phase

Hosting commercial-use eligibility, billing, subscription controls, membership revocation, audit retention, backups, fleet/device administration, distributed quotas, approved content workflow, observability and stronger conflict resolution. Preserve RLS and append-only journey activity.

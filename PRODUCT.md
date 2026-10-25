# Nightline passenger announcements

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

User recommends Next.js PWA and delegates implementation choices. Selected: Next.js App Router, TypeScript, Supabase Auth/PostgreSQL/Storage, IndexedDB, Vercel for this non-commercial pilot. Future Capacitor integration belongs behind platform adapters.

## Users

One fleet administrator and drivers managing one or two scheduled sleeper buses between Kozhikode and Bengaluru, in either direction.

## Product Purpose

Test bilingual passenger announcements with manual triggers on personal Android/iOS phones connected to bus Bluetooth. Prove offline usability and audio clarity before further investment.

## Operating Context

Drivers prepare trips while parked, choose announcements such as welcome, journey summary, congestion, unscheduled stop, break, arrival, and closing. Malayalam and English audio plays through the operating system's selected output. Routine night announcements should be restrained.

## Capabilities and Constraints

No billing-dependent mapping API in this pilot. Distance, ETA, stops and incidents are editable manual facts. Providers and triggers must be replaceable with later automated sources. First use and new cloud data need internet; downloaded trip data and audio work offline. Background monitoring and Bluetooth connection detection are not promised. External credentials have not been supplied; local mode must be usable and clearly distinct from cloud accounts. No invented live data.

## Evidence on Hand

Empty workspace. No operator branding, credentials, actual timetable, approved route distance, crew roster, or verified audio supplied. Example fleet and journey data must be labelled sample data.

## Product Principles

- Prepare once and replay locally.
- Prepare and review the exact announcement once; keep routine playback one tap.
- Human-confirmed facts are explicit and replaceable providers supply future facts.
- Manual and automatic triggers share a single announcement pipeline.
- Honest integration status and offline readiness.

## Accessibility & Inclusion

Mobile-first large touch targets, keyboard access, readable night mode, Malayalam script support, reduced motion, visible audio-stop control. Drivers interact only when parked or through an attendant.

## Open Decisions

Nightline is an implementation working name, not a confirmed brand. Initial route, names, distance and timetable are editable illustrative values.

## Quick-play interaction requirements

The user requested simplification using the local gpt-taste skill. Main actions play directly; edit controls and long-press open details. A saved finite sequence supports alternating language pairs or grouped language repetitions, with English/Malayalam order and one to three repeats. Default for new workspaces is EN → ML → EN → ML. Stop cancels the entire sequence, including pauses. Optional browser haptics and gestures must degrade gracefully. No marketing hero, scrolling spectacle or extra confirmation step on an explicit manual play.

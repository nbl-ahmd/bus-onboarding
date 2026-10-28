---
name: Nightline
description: One tap for the whole passenger announcement sequence.
colors:
  "background": "#f5f7fa"
  "surface": "#fff"
  "surface-muted": "#f6f8fa"
  "ink": "#213748"
  "ink-strong": "#172c3d"
  "muted": "#657583"
  "line": "#e4e9ef"
  "nav": "#193b57"
  "nav-muted": "#a9c1d4"
  "nav-active": "#2c526c"
  "brand": "#197568"
  "brand-hover": "#125f55"
  "brand-soft": "#e9f5ef"
  "mint": "#bce8d5"
  "warning": "#996017"
  "warning-soft": "#fff5e5"
  "danger": "#af4145"
  "danger-soft": "#fff0f0"
  "blue": "#456d9d"
  "blue-soft": "#edf2fa"
  "night-background": "#142330"
  "night-surface": "#1d3040"
  "night-surface-muted": "#24394b"
  "night-ink": "#d9e6ee"
  "night-ink-strong": "#f0f6fa"
  "night-muted": "#a9bdcc"
  "night-line": "#344b5d"
  "night-nav": "#112b40"
  "night-nav-active": "#2c5068"
  "night-brand": "#b4e5ce"
  "night-brand-hover": "#d0f2e0"
  "night-brand-soft": "#254c45"
  "night-warning": "#f1ce95"
  "night-warning-soft": "#453d32"
  "night-danger": "#ffc2c5"
  "night-danger-soft": "#4d303a"
  "night-blue": "#b7cff3"
  "night-blue-soft": "#2c435c"
typography:
  headline:
    fontFamily: "Outfit, Arial, Noto Sans Malayalam, sans-serif"
    fontSize: "30px"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Outfit, Arial, Noto Sans Malayalam, sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
  row-title:
    fontFamily: "Outfit, Arial, Noto Sans Malayalam, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.4
  script:
    fontFamily: "Outfit, Arial, Noto Sans Malayalam, sans-serif"
    fontSize: "13px"
    lineHeight: 1.9
  script-malayalam:
    fontFamily: "Noto Sans Malayalam, sans-serif"
    fontSize: "12px"
    lineHeight: 2.1
rounded:
  control: "7px"
  row: "12px"
  surface: "14px"
  sheet: "16px"
spacing:
  compact: "8px"
  row-gap: "12px"
  mobile-inset: "17px"
  desktop-inset: "28px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  quick-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.row}"
  quick-row-active:
    backgroundColor: "{colors.brand-soft}"
  sequence-part:
    backgroundColor: "{colors.brand-soft}"
    textColor: "{colors.brand}"
    padding: "7px 9px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    padding: "9px 11px"
---

# Design System: Nightline

## Overview

A compact driver tool: prepare once, then tap an announcement to play its complete sequence. The existing cool blue and sea-green palette remains. Outfit is locally bundled for English controls and headings, with Noto Sans Malayalam for Malayalam scripts.

The gpt-taste refinement removes the marketing heading, persistent administration sidebar and compulsory preview. The user's minimal-tap requirement takes priority over the skill's landing-page heroes, imagery and scroll choreography.

## Colors

Use ink on surface for reading, brand for play/selection, blue for information, warning for preparation and sample data, and danger for failure/stop. Pair semantic foregrounds with their soft backgrounds. The night theme overrides both members; light-green actions use dark labels in that theme.

## Typography

Page headings are Outfit 500, 30px on desktop and 27px on mobile. Row titles are 15px/500; control labels are 12–13px. Script text remains a separate reading surface with generous Malayalam line spacing. Small secondary labels do not carry the only explanation of a state.

## Layout

A 76px desktop header contains the brand, three working destinations and utility actions. Main content has a 1100px cap and 28px side insets. The route strip leads into a two-column list of favourite announcements. Search and the full library are optional controls, and there are no empty grid spans.

Below 850px the rows become a single column. Below 600px a 64px header and fixed four-item bottom navigation replace desktop navigation, with 17px content insets. Mobile rows are at least 80px tall. The trip start button shares the route area's lower row to keep the four common actions near the first screen.

Editing is a right-hand sheet, up to 460px wide with 20px insets on desktop, and full screen on mobile. A separate scrim blocks underlying pointers; focus stays in the sheet, and nested native dialogs take priority. The active player stays above mobile navigation and exposes Stop at every sequence step.

## Elevation & Depth

Ordinary rows remain flat with one border. Sea-green fill and a stronger border identify active playback. Shadow belongs to sheets, dialogs and the persistent player. Existing native-dialog backdrops keep a translucent blue scrim and restrained blur.

## Shapes

Rows have 12px corners, reducing to 11px on mobile. Icon wells are 40–43px. Control corners are 7px, with full-height separated Edit actions at the end of each row. Route markers are simple geometry, not imagery.

## Components

### Announcement row

The large left button plays directly; the separated sliders button edits. Holding the play area for 480ms also edits, and the resulting release never plays. Movement over 10px cancels the hold, preserving scrolling. Every gesture has a standard button alternative.

### Sequence controls

One saved preference sets language order, one to three repeats and alternating/grouped structure. A literal sequence preview shows what one tap will do. Generated files are reused across repeats. The sequence dialog waits for local persistence before closing.

### Playback

The persistent player shows the title, current language and part count. Finite progress segments represent actual sequence parts. Stop cancels current audio, pauses and remaining parts. A left swipe is an optional stop shortcut. Missing voices open the editor with an explicit recovery action; no silent language substitution occurs.

### Editing

Scripts, facts, favourites, recording and voice preparation remain in the editor. A downward swipe is limited to its header. A close button and Escape are always available. The language preview and repeated playback order are separate concerns.

### Feedback and motion

Browser vibration is optional and best-effort. Use small tap/play/stop/completion pulses only; unsupported browsers are a no-op. GSAP supplies brief 5px row-settle movement (0.2s with 0.018s stagger); reduced-motion media queries disable that setup. No scroll pinning, marquee or animation delays obstruct controls.

## Do's and Don'ts

- Do make routine playback one tap, including both languages and every repeat.
- Do keep edit, stop and audio-preparation actions explicit and reachable.
- Do preserve trips, recordings and existing language choice when migrating preferences.
- Do keep warning and missing-audio states honest in both themes.
- Don't require a preview or quiet-mode confirmation after an explicit manual play tap.
- Don't use haptic support as a prerequisite for operation.
- Don't replace practical controls with marketing effects or gesture-only interactions.

## Guided trip operation

The driving surface now leads with a route console. It shows one announcement, a large full-width play action, the literal bilingual sequence, the following step, and Skip. Route progress is a thin horizontal track. Successful playback advances; failure or Stop preserves position. Common interruptions sit directly below the play action and never change that position. The larger favourites/library workspace is collapsed during an active trip and remains available through Other announcements.

The guide uses the existing blue/green palette and locally bundled type. Current-step titles use 28px on desktop and 25px on phones; the primary action uses 19px and 17px respectively. A 14px bordered surface, 10px play control and 44px secondary targets separate the hierarchy without decorative imagery. Night appearance retains dark text on mint play controls. The route list is a bounded scroll region with numbered steps, current-step state and explicit replay actions.

Stops are an ordered editor with a location field, type, optional IST time and duration. The handle supports desktop dragging; explicit up/down controls remain available on touch screens and keyboards. Stop IDs stay stable when reordered. Up to 200 stops are supported. The guide, template rendering, voice generation and storage remain separate modules so future geofence or traffic triggers can supply the same announcement events.

Settings exposes English/Malayalam cloud voices, an allowlisted model choice, a local two-note chime, live generation and reusable/live summary modes. Preparation offers a whole-trip scope. Offline state and app updates use small, contextual notices; an update never reloads during active playback or audio preparation.

## Voice review

Generation settings now separate playback policy from the preparation provider. Live is the default preparation engine; dedicated TTS and device fallback remain explicit choices. The library promotes pending recordings above approved files, shows the full script and optional transcript, and enables Approve for bus only after full playback. An approval never comes from an automatic transcript match. Each replacement has a new recording identity and must be heard again. Regenerate clip affects only that recording. On phones, the library heading and explanation occupy a full row above the download/refresh actions; playback, approval and regeneration retain visible controls.

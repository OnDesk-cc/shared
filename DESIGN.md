---
name: OnDesk products
description: Inside an app you ride one line. The six product apps (Pulse, Vault, Orbit, Nexus, Halo, Atlas) are the Network Map's route strip and ledger sheet extended to a product, with the app's own line lit in the six-line band and every stop mark drawn in its colour; the world's CSS and its primitives ship from @ondesk/shared.
colors:
  paper: "#ffffff"
  paper-2: "#f3f3f1"
  ink: "#111111"
  ink-2: "#4d4d4d"
  ink-deep: "#000000"
  rule: "#cfcfcf"
  rule-2: "#e6e6e6"
  share-grey: "#8a8a8a"
  board-muted: "rgba(255, 255, 255, 0.72)"
  line-pulse: "#e2231a"
  line-vault: "#00843d"
  line-orbit: "#0019a8"
  line-nexus: "#ef7b10"
  line-halo: "#b3007a"
  line-atlas: "#0098a6"
  destructive: "#b3261e"
typography:
  display:
    fontFamily: "Fira Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "2.2rem (768px: 2.8rem); the plate H1 of the workspace picker and the root 404"
    fontWeight: 800
    lineHeight: "0.98 (1.42 inside .plate-lines so stacked plates touch)"
    letterSpacing: "-0.025em"
  figure:
    fontFamily: "Fira Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "2rem (768px: 2.5rem); a StatTile value in the zone table"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\" 1"
  headline:
    fontFamily: "Fira Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "1.5rem (768px: 1.625rem); the title of PageHeader and of every Section"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Fira Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "1.25rem (Dialog, AlertDialog and Sheet titles); 1.125rem (CardTitle)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.012em"
  body:
    fontFamily: "Fira Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "17px on body; a page head's description 1.05rem; notes, descriptions, menu rows, rail links and the board 0.95rem; field hints, StatTile hints and monogram e-mail lines 0.9rem; presence descriptions, taglines in the apps menu and shortcuts 0.85rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
    fontFeature: "\"tnum\" 1, \"kern\" 1"
  label:
    fontFamily: "Fira Sans Condensed, Fira Sans, Arial Narrow, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.06em"
  condensed:
    fontFamily: "Fira Sans Condensed, Fira Sans, Arial Narrow, system-ui, sans-serif"
    fontSize: "1rem (fare cells), 0.85rem–0.95rem (slugs, addresses, shortcuts, chart ticks at 12px)"
    fontWeight: 500
    letterSpacing: "0.01em"
  stamp:
    fontFamily: "Fira Sans Condensed, Fira Sans, Arial Narrow, system-ui, sans-serif"
    fontSize: "0.75rem; also the floor for every tiny size in a screen not yet recomposed"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.06em"
  tip:
    fontFamily: "Fira Sans Condensed, Fira Sans, Arial Narrow, system-ui, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.01em"
  brand:
    fontFamily: "Fira Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "1.15rem (the OnDesk plate in the strip and the board); 1.05rem (the app's name beside its swatch)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
  workspace-plate:
    fontFamily: "Fira Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 800
    lineHeight: "1.15 (1 from 640px)"
    letterSpacing: "-0.01em"
  rail:
    fontFamily: "Fira Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
  ticket:
    fontFamily: "Fira Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "1rem (full ticket), 0.9375rem (ticket--sm, the Button default), 0.875rem (ticket--xs)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.005em"
  monogram:
    fontFamily: "Fira Sans Condensed, Fira Sans, Arial Narrow, system-ui, sans-serif"
    fontSize: "0.8rem / 0.9rem / 1.05rem (Monogram sm / md / lg); 0.65rem / 0.8rem / 0.95rem uppercase (Avatar sm / default / lg)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
rounded:
  none: "0"
  ring: "999px"
spacing:
  stroke: "3px"
  line: "10px"
  band-row: "4px"
  band: "1.5rem"
  strip-row: "4rem"
  rail: "2.75rem"
  gutter-sm: "1rem"
  gutter-md: "2rem"
  gutter-lg: "3rem"
  wrap: "88rem"
  page-top: "1.5rem"
  page-bottom: "6rem"
  stop-gap: "2.5rem"
  column-gap: "3rem"
  zone-cell: "1rem"
  zone-cell-md: "1.25rem"
  menu-row: "0.6rem 1rem"
  panel-pad: "1.25rem"
  message-line: "1.4rem"
  board: "2.5rem"
components:
  ticket:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.ticket}"
    rounded: "{rounded.none}"
    padding: "0.7rem 1.4rem"
    height: "3.25rem"
  ticket-hover:
    backgroundColor: "{colors.paper-2}"
  ticket-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  ticket-sm:
    padding: "0.45rem 1rem"
    height: "2.5rem"
  ticket-xs:
    padding: "0.35rem 0.8rem"
    height: "2.25rem"
  ticket-solid-stub:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.ticket}"
    rounded: "{rounded.none}"
    padding: "0.45rem 1rem 0.45rem 1.5rem"
    height: "2.5rem"
  ticket-solid-stub-hover:
    backgroundColor: "{colors.ink-deep}"
  ticket-stub-xs:
    padding: "0.35rem 0.8rem 0.35rem 1.35rem"
    height: "2.25rem"
  ticket-secondary:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.45rem 1rem"
    height: "2.5rem"
  ticket-ghost:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
  ticket-danger:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.destructive}"
    rounded: "{rounded.none}"
    padding: "0.45rem 1rem"
    height: "2.5rem"
  ticket-danger-hover:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.paper}"
  ticket-link:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    padding: "0"
  ticket-glyph:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0"
    width: "2.25rem"
    height: "2.25rem"
  ticket-glyph-xs:
    padding: "0"
    width: "2rem"
    height: "2rem"
  ticket-glyph-lg:
    padding: "0"
    width: "2.75rem"
    height: "2.75rem"
  stamp:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.stamp}"
    rounded: "{rounded.none}"
    padding: "0.1rem 0.45rem"
  stamp-solid:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.stamp}"
    rounded: "{rounded.none}"
    padding: "0.1rem 0.45rem"
  stamp-alert:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.destructive}"
    typography: "{typography.stamp}"
    rounded: "{rounded.none}"
    padding: "0.1rem 0.45rem"
  field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0.7rem 0.9rem"
  field-focus:
    backgroundColor: "{colors.paper-2}"
  field-sm:
    padding: "0.4rem 0.9rem"
    height: "2.5rem"
  field-search:
    padding: "0.4rem 0.9rem 0.4rem 2.4rem"
    height: "2.5rem"
  field-readonly:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink-2}"
  strip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    height: "{spacing.strip-row}"
  strip-plate:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.brand}"
    rounded: "{rounded.none}"
    padding: "0.375rem 0.625rem"
  workspace-plate:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.workspace-plate}"
    rounded: "{rounded.none}"
    padding: "0.375rem 0.625rem"
    width: "14rem max (20rem from 1024px)"
  workspace-plate-hover:
    backgroundColor: "{colors.ink-deep}"
  band-row:
    height: "{spacing.band-row}"
  rail-link:
    textColor: "{colors.ink-2}"
    typography: "{typography.rail}"
    height: "{spacing.rail}"
  rail-link-active:
    textColor: "{colors.ink}"
  page-header:
    textColor: "{colors.ink}"
    typography: "{typography.headline}"
    padding: "1rem 0 0"
  zone:
    backgroundColor: "{colors.ink}"
    rounded: "{rounded.none}"
  zone-cell:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "{spacing.zone-cell}"
  stat-figure:
    textColor: "{colors.ink}"
    typography: "{typography.figure}"
  stat-figure-alert:
    textColor: "{colors.destructive}"
  menu-paper:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0"
    width: "12rem min"
  menu-paper-content:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "1rem"
    width: "18rem (Popover), 16rem (HoverCard)"
  menu-panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    width: "20rem"
  menu-row:
    textColor: "{colors.ink}"
    padding: "{spacing.menu-row}"
  menu-row-hover:
    backgroundColor: "{colors.paper-2}"
  menu-row-danger:
    textColor: "{colors.destructive}"
  menu-label:
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    padding: "0.75rem 1rem 0.25rem"
  tip-paper:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.tip}"
    rounded: "{rounded.none}"
    padding: "0.35rem 0.6rem"
  check-box:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.none}"
    size: "1.25rem"
  check-box-checked:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  switch-track:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.none}"
    width: "2.5rem (sm 2rem)"
    height: "1.35rem (sm 1.1rem)"
  switch-track-on:
    backgroundColor: "{colors.ink}"
  switch-thumb:
    backgroundColor: "{colors.ink}"
    rounded: "{rounded.none}"
    size: "0.85rem (sm 0.6rem)"
  switch-thumb-on:
    backgroundColor: "{colors.paper}"
  progress-track:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.none}"
    height: "0.85rem"
  progress-fill:
    backgroundColor: "{colors.ink}"
  scrim:
    backgroundColor: "rgba(17, 17, 17, 0.7)"
  sheet-paper:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "{spacing.panel-pad}"
    width: "min(32rem, 100% - 2rem) as a dialog; 75vw up to 24rem as a side sheet"
  sheet-paper-sm:
    width: "20rem"
  monogram:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.monogram}"
    rounded: "{rounded.none}"
    size: "2.25rem / 2.75rem / 3.5rem (Monogram); 1.5rem / 2rem / 2.5rem (Avatar)"
  presence-ring:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.ring}"
    size: "0.85rem (PresenceRing); 0.6rem / 0.75rem / 0.85rem (PresenceDot xs / sm / md)"
  presence-ring-online:
    backgroundColor: "{colors.ink}"
    rounded: "{rounded.ring}"
  presence-choice-chosen:
    backgroundColor: "{colors.paper-2}"
    padding: "0.375rem 0.5rem"
  card-header:
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    padding: "1rem 0 0"
  table-row-hover:
    backgroundColor: "{colors.paper-2}"
  skeleton:
    backgroundColor: "{colors.paper-2}"
    rounded: "{rounded.none}"
  toast:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
  board:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    padding: "{spacing.board} 0"
  board-plate:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.brand}"
    rounded: "{rounded.none}"
    padding: "0.375rem 0.625rem"
  mobile-row:
    textColor: "{colors.ink-2}"
    padding: "0.75rem 0"
  mobile-row-active:
    textColor: "{colors.ink}"
---

# Design System: OnDesk products

## Overview

**Creative North Star: "The Network Map"**

The six product apps are the Network Map seen from inside one of its lines. The public site draws six apps as six coloured transit lines on white paper; the signed-in console reads as a stack of ledger sheets; a product is where a member spends the day riding one of those lines, so its shell is the map's route strip with the app's own line lit in the six-line band and the other five dimmed to 18%, its destinations are the strip's second tier, and every screen is a sheet of stops whose marks are drawn in the app's colour. A member opening Pulse sees the OnDesk plate and the band before anything else, the same network as the site and the console; the red row at full colour says which line they are riding, the rail under it says where the line stops, and each page reads top to bottom as stops with every state printed as a word. Switching app is switching line: hovering another app in the Apps menu lights that line in the band before the jump.

The material is unchanged from the incumbent world (`ondesk/DESIGN.md`): paper and ink at daylight contrast, one 3px stroke for every ring, tick, plate edge, ticket outline, field and container, one 10px line for every transit line, swatch, stop segment and band, Fira Sans with its Condensed cut for labels and tables, tabular figures everywhere, one 12 s clock that every duration divides. The app's line colour appears only at line scale: the band, the swatch beside the app's name in the strip and the board, the stop marks, the rail's current bar, the primary series of a chart. It is never a text colour, never a background behind text and never a tint.

What a product adds is a way to be in the world without rewriting every screen. The world's CSS ships from `@ondesk/shared/styles/` (`site.css`, a byte-identical copy of `ondesk/src/site.css`, and `product.css`, the product additions), each app mounts `.site` on `<html>` so Radix portals (dialogs, menus, tooltips, toasts) fall inside it, and the 24 shadcn primitives under `@ondesk/shared/ui/` are rewritten once as map components with their shadcn API intact: a `Button` is a ticket, a `Badge` is a stamp, a `Table` is a fare table, `Tabs` are a page rail, a `Card` is a stop without a box, a `Dialog` is the paper dialog on the one scrim. A screen that has not been recomposed inherits the world through those primitives and through a short list of aliases and retirements in `product.css` (the old telemetry `console-label` becomes the platform label, `font-mono` resolves to Fira Sans Condensed in each app's `index.css`, sizes under 12px rise to the 0.75rem stamp floor, `rounded-*`, `shadow-*`, `backdrop-blur-*`, `gradient-text`, `blink-cursor` and `scan-line` paint nothing). It refuses the incumbent dark telemetry console (a sidebar over stat tiles, monospaced kickers with blinking cursors, lime accents, a theme toggle) and the category app shell (a left sidebar, an avatar circle, a card grid).

**What changed versus the console's DESIGN.md.** These are the rules that differ from `ondesk/DESIGN.md` and win inside a product:
- `.site` is on `<html>`, not on a `<div>`: `html.site` keeps `font-size: 100%` so Tailwind's rem utilities stay measured against 16px, and `html.site body` carries the world's 17px / 1.55 reading size. The console's `.site` div sets 17px on itself.
- The chart palette: the app's own series in its line colour, the counterpart series in ink, shares as the grey ramp (ink, Secondary Ink, Share Grey #8a8a8a, Rule, Rule Light). The shadcn chart tokens are remapped to it (`--chart-1` ink, `--chart-2` the app's `--stop-color`, `--chart-3` Secondary Ink, `--chart-4` Rule, `--chart-5` Share Grey); a chart never carries a seventh hue.
- `Button` `default` is the solid stub ticket (`ticket--solid ticket--stub`), and `ghost` renders the plain outline ticket: the world has no shapeless button, so a glyph alone sits in a square outline ticket in every app. `outline` is the same outline ticket; `secondary` is an outline ticket on Platform Grey; `destructive` is the red-stroked ticket; `link` is an underlined word. The default size is `ticket--sm` (2.5rem); `xs`/`sm` are `ticket--xs` (2.25rem); `lg`/`xl` are the full 3.25rem ticket; `icon*` are the glyph ticket at 2rem / 2.25rem / 2.75rem.
- Presence: `STATUS_META.dot` now holds ring classes, not a background colour (`ring ring--filled` Online, `ring` Away, `ring ring--dot` Busy, `ring is-offline` Invisible and Offline), so a screen that still paints `meta.dot` draws the ring.
- Tailwind's `ring` utility shares its name with the interchange ring and is neutralised (`.site .ring { box-shadow: none }`); the ring is a 3px border and never a 1px shadow.
- The tiny-size floor: `text-[9px]`, `text-[10px]` and `text-[11px]` inside `.site` render at 0.75rem, the stamp size. Nothing prints smaller than a stamp.
- Semantic state colours (`--warning`, `--success`, `--info`) resolve to ink (info to Secondary Ink), the sidebar tokens to paper and ink, `--radius` to 0: a state is a word in a stamp, not a colour.

**Scope boundary.** Everything in this file applies to the six product SPAs (`pulse/`, `vault/`, `orbit/`, `nexus/`, `halo/`, `atlas/`) wherever `.site` reaches, which is the whole document. The shell of each app is its own `src/shell/workspace-shell.tsx` (the six are one template; Pulse is the reference read here) composed from `shared/components/product-shell.tsx`; the page pieces are `shared/components/console.tsx` (`PageHeader`, `PanelHeader`, `StatGrid`, `StatTile`, `EmptyState`, `ConsoleTag`) and `shared/components/console-kit.tsx` (`Section`, `Masthead`, `Monogram`, `Stamp`, the fields, `SaveRow`, `SheetDialog`, `ActionMenu`, `Spine`, `Skeleton`); the map pieces are `shared/components/map.tsx` (`LineBand` with `focus`, `LineStub`, `AppLine`) and `shared/lib/lines.ts` (`PRODUCT_IDS` in band order, `APP_NAME`, `APP_TAGLINE`, `APP_ORIGIN`, `lineColor`, `labelClass`); presence is `shared/presence/status.ts` and `presence-dot.tsx`; `shared/components/theme-provider.tsx` is a light-only shim that strips a leftover `dark` class and always answers "light". Halo's in-call room and Atlas's capture HUD keep their own full-screen chrome; only their entry pages are in scope. The direction contract is `pulse/.impeccable/surfaces/pulse-src-shell-workspace-shell-tsx.md`; nothing from it is copied into shipped code.

**Cross-repo copies.** `shared/styles/site.css` must stay byte-identical to `ondesk/src/site.css` (verified identical on 2026-09-30; the partners, developers and admin copies are meant to match it too, see the not-canonized line). The products import it as `@import "@ondesk/shared/styles/site.css"` followed by `@import "@ondesk/shared/styles/product.css"` from each app's `src/index.css`, with `@source "../node_modules/@ondesk/shared"` so Tailwind scans the primitives. The package declares version 1.6.0 and its newest git tag is v1.4.0, so 1.6.0 is untagged as of 2026-09-30.

**Key Characteristics:**
- White paper, black ink, the app's line colour only at line scale (band, swatch, stop mark, rail bar, chart series), never as text.
- Inside an app one line is lit: the band dims the other five to 18% and the Apps menu previews a line on hover.
- The strip has three tiers (row, band, rail); the rail carries the app's destinations and its one creating action as a small solid stub ticket.
- Every page opens with a Stop (3px rule, the mark crossing the axis in the app's colour, the live datum as station meta, the 1.5rem title) and closes with a board.
- Every shadcn primitive is a map component with its API kept: ticket, stamp, fare table, page rail, paper dialog, paper menu, ink tooltip, square check and switch.
- Light only; `.site` on `<html>`; no theme toggle; the theme provider is a shim.
- Square everywhere; round only the interchange ring and the presence ring.
- Flat; the only translucency is the 70% ink scrim; depth is a 3px border or an inversion.
- One clock (12 s); the band fades in clock/24, menus arrive in clock/24, tooltips in clock/40, state changes in clock/60.
- States are words: a stamp, a status line, a ring beside its label; ticket status and priority read as ink words, not coloured pills.
- Nothing prints below 0.75rem; nothing spins while loading except the toaster's own loading glyph (not canonized).

### Assets & provenance

The products ship no new rasters. The band, the stub, the swatch, the stop mark, the rings, the switch, the check and the progress track are CSS or inline SVG in `shared/styles/site.css`, `shared/styles/product.css` and `shared/components/map.tsx`; the monogram is a person's or workspace's own uploaded logo when there is one and two Condensed initials in a 3px square otherwise. The rasters that remain in each app's `public/` (favicon, apple-touch-icon, `brand/`) are pre-existing brand icons untouched by this build. Fonts load from Google Fonts through the same `<link>` in each app's `index.html` (the six links are identical): Fira Sans 400 / 500 / 700 / 800 plus italic 400, and Fira Sans Condensed 500 / 700. Icons are Lucide stroke SVGs used only as functional glyphs beside text or alone in a square glyph ticket with an accessible label (menu, X, chevron, arrow, arrow-up-right, layout-grid, sparkles, search, check, copy, more, plus, external-link, and the toaster's five state glyphs); no decorative feature icons remain in the recomposed screens, and `StatTile`, `EmptyState` and `AlertDialogMedia` accept an `icon` for compatibility and paint nothing. The review captures under each app's `.impeccable/review/` (`overview-`, `tickets-`, `my-tickets-`, `workspaces-`, `profile-`, `items-`, `tasks-`, `channels-`, `meetings-`, `library-` at desktop and mobile, and `states/` for the open menus) were taken against synthetic fixtures by a puppeteer script in the session scratchpad; none of that data ships and none of it is real.

## Colors

The incumbent palette unchanged, plus one grey for chart shares; the app's line colour is the only colour a product screen may add, and only at line scale.

### Primary
- **Map Ink** (#111111): every heading, body word, plate, solid ticket, stamp border, focus outline, the switch and check when on, the progress fill, the tooltip background, the zone table's joints, the resolved series of a chart.
- **Deep Ink** (#000000): the hover of a solid ticket and of the workspace plate button.

### Secondary
The six line colours, applied through `lineColor(id)` (`var(--l-<app>)`) and never typed directly.
- **Pulse Red** (#e2231a), **Vault Green** (#00843d), **Orbit Blue** (#0019a8), **Nexus Orange** (#ef7b10), **Halo Magenta** (#b3007a), **Atlas Teal** (#0098a6). Inside an app its own line is `--stop-color` on the shell root and on the strip, so the stop marks, the rail's current bar and `--chart-2` take it; the other five appear only in the band at 18%, in the Apps menu and phone panel as swatches, and in the `AppLine` of a row. Nexus and Atlas are the light lines: a label on their rect is ink (`labelClass`).

### Neutral
- **Map Paper** (#ffffff): the page, the strip, the tickets, the fields, the rings, the menu and dialog paper, the board's plate and links.
- **Platform Grey** (#f3f3f1): hover of tickets, menu rows and linked table rows; a focused field; the `secondary` ticket; the chosen presence status; a read-only field; the skeleton; the sub-menu trigger while open; the selected table row. The one tint.
- **Secondary Ink** (#4d4d4d): descriptions, hints, station meta, rail links at rest, menu group labels, slugs and addresses, chart ticks, `--info`, the second share in a chart.
- **Share Grey** (#8a8a8a): the third step of the share ramp and `--chart-5`. It exists only for charts.
- **Rule** (#cfcfcf): thin dividers, fare row borders, the rail row's rule, the chart grid, `--border`, the fourth share.
- **Rule Light** (#e6e6e6): row borders in the phone panel and the Apps list; the fifth share.
- **Board Muted** (rgba(255, 255, 255, 0.72)): body copy on the board.
- **Destructive** (#b3261e): a field's error line, the `Alert`, the alert stamp, a `StatTile` whose `tone` is alert, the danger ticket and menu row. Nothing else.

### Named Rules
**The Lines Are Not Text Rule.** A line colour goes on `stroke`, `background`, a rect `fill` or a chart series, never on `color`. Inside a product this includes its own line: the app's name in the strip is ink beside a swatch, its stop marks are coloured segments beside ink titles, and its rail bar is a coloured 3px line under an ink word.

**The One Line Lit Rule.** The band inside an app has one row at full colour and five at 18% (`band--focus`, `.band-row:not(.is-lit)`), fading over clock/24; hovering or focusing an app in the Apps menu lights that row instead, and leaving the menu returns the band to the app's line. A product never shows the band fully lit except on a screen with no app context (there is none; the picker and the 404 light the app's line).

**The Chart Ramp Rule.** A chart draws the app's own series in its line colour, the counterpart in ink, and proportions as the grey ramp from ink to Rule Light; every chart is accompanied by the same numbers as a fare table. There is no second hue and no red-for-down, green-for-up: direction is a sentence ("Up 12% on the previous 30 days, the wrong way").

**The Words Not Colours Rule.** `--warning`, `--success` and `--info` are ink and Secondary Ink inside `.site`, so a status or priority badge from an older screen reads as an ink word in a stamp. Red is reserved for what stopped or is irreversible (`stamp--alert`, `ticket--danger`, `StatTile tone="alert"`).

## Typography

**Display Font:** Fira Sans (with Segoe UI, system-ui, sans-serif)
**Body Font:** Fira Sans (with Segoe UI, system-ui, sans-serif)
**Label / Table Font:** Fira Sans Condensed (with Fira Sans, Arial Narrow, system-ui, sans-serif)

**Character:** One transit family, set heavy and tight for plates and page heads, quiet at body size, with the Condensed cut as the platform-sign voice for labels, stamps, tables, slugs, shortcuts and tooltips. Tabular figures are on everywhere. A product is worked in all day, so its ramp is the console's working ramp: nothing above 2.8rem, and that only on the two screens with no shell (the picker and the 404).

### Hierarchy
- **Display** (800, 2.2rem → 2.8rem at 768px, tracking -0.025em, line-height 1.42 in `.plate-lines`): the plate H1 of the workspace picker ("Ana, choose a workspace") and of the root 404 ("No stop at this address"). Also the figure in a `StatTile` (`t-display t-num`, 2rem → 2.5rem, line-height 0.98).
- **Headline** (800, 1.5rem → 1.625rem at 768px, line-height 1.04, tracking -0.02em): the title of `PageHeader`, of every `Section` and of the in-workspace 404. The page's first Stop.
- **Title** (700, 1.25rem, line-height 1.15, tracking -0.012em): `DialogTitle`, `AlertDialogTitle`, `SheetTitle`, `SheetDialog`; `CardTitle` at 1.125rem.
- **Body** (400, 17px on `body`, line-height 1.55): a page head's description at 1.05rem (72ch, Secondary Ink); notes, `CardDescription`, dialog descriptions, `EmptyState` descriptions (60ch), menu rows, rail links, the board's tagline and links, `TableCaption` and the Save row's word at 0.95rem; field hints and messages, `StatTile` hints, the monogram e-mail line and the rights line at 0.9rem; presence descriptions, app taglines in the Apps menu, shortcuts and stacked-rail descriptions at 0.85rem.
- **Brand** (800, 1.15rem, tracking -0.02em, line-height 1): the OnDesk plate in the strip, the picker, the 404 and the board; the app's name beside its swatch at 1.05rem. The workspace plate in the strip is 0.95rem 800 tracked -0.01em, wrapping inside its plate on a phone and truncating from 640px (max 14rem, 20rem from 1024px).
- **Rail** (700, 0.95rem): the page rail's destinations and the `Tabs` triggers; Secondary Ink at rest, ink when hovered or current.
- **Label** (Condensed 700, 0.8125rem, 0.06em, uppercase, line-height 1.2): `t-tab`, `Label`, `ConsoleTag`, `PanelHeader`, station meta, menu group labels, `Select` and `Command` group headings, the "Change line" and "Your status" headings.
- **Stamp** (Condensed 700, 0.75rem, 0.06em, uppercase, line-height 1.3): every `Badge`, every `Stamp`, the reflowed table's floated labels, and the floor for the old `text-[9px]` / `text-[10px]` / `text-[11px]`.
- **Condensed** (Condensed 500, 0.01em): fare cells at 1rem; slugs, addresses and e-mails at 0.9–0.95rem; shortcuts at 0.85rem; chart axis ticks at 12px; the tooltip at 0.85rem (`tip-paper`, line-height 1.3); a `field--cond` for identifiers.
- **Ticket** (700, tracking -0.005em, line-height 1): 1rem on the full ticket, 0.9375rem on `ticket--sm` (the `Button` default), 0.875rem on `ticket--xs`.
- **Monogram** (Condensed 700): 0.8rem / 0.9rem / 1.05rem in `Monogram` sm / md / lg; the Radix `Avatar` fallback is 0.65rem / 0.8rem / 0.95rem uppercase.

### Named Rules
**The One Family Rule.** Fira Sans and Fira Sans Condensed are the only families. `--font-mono` in each app's `index.css` `@theme` resolves to Fira Sans Condensed, so a screen still asking for `font-mono` prints platform-sign type, never monospace.

**The Stamp Floor Rule.** Nothing inside `.site` prints below 0.75rem. `product.css` raises `text-[9px]`, `text-[10px]` and `text-[11px]` to that floor; a new screen does not use them at all.

**The Word Rule.** Every state prints as a word: a stamp, a status line, a ring beside its label (`PresenceRing` prints its word or an `sr-only` word). The strip's account ticket shows the person's chosen status as a ring and hides the name below 1024px, but the ring keeps its `title`.

**The No Kicker Rule.** Nothing sits above a title. `PageHeader` prints a `tag` only as station meta on the rule, only when it says something the title does not, and strips a leading ordinal ("01 — Overview" prints nothing); `Card` has no kicker slot; the old `console-label` renders as a platform label and belongs on the rule or beside a value, not over a heading.

## Layout

A product page is one column of map paper under a three-tier sticky strip. The strip (`header.strip`, `position: sticky; top: 0; z-index: 50`, paper) is: a `.wrap` row 4rem tall (the OnDesk plate, the app's swatch at 1.6rem × 10px with its name from 640px, the workspace plate; the search field centred from 768px at small-ticket height with its glyph inset, `field--sm field--search`, padding-left 2.4rem; the action tickets from 768px, `gap-2`; the phone menu button below 768px); the six-line band (six 4px rows, 1.5rem) with the app's row lit; and the rail row on a 1px Rule, whose `.wrap` holds the page rail (`flex-1`, its own rule removed) and, from 640px, the app's one creating action at the right end (`ticket ticket--xs ticket--solid ticket--stub`: "New channel" in Nexus behind `channels.create`, "Start now" in Halo behind `meetings.create`, "New space" in Atlas behind `folders.create`; Pulse, Vault and Orbit have none). The strip is about 8.25rem tall in all; the shell root carries `--stop-color: lineColor(app)` so every stop mark and the rail bar below take the app's colour.

**The rail.** `.page-rail`: bold 0.95rem destinations 1.75rem apart, 2.75rem tall, Secondary Ink at rest, ink on hover or current, the 3px bar under the current one in `--stop-color`, sideways scroll without a scrollbar. Pulse's destinations: Overview · My tickets · Tickets · Teams · Analytics · Marketplace · Audit (only with `audit.view`) · Settings; who is offered a destination is decided where the rail is drawn, so nobody is offered a page that answers 403. The same class dresses `Tabs` (`TabsList` is `page-rail`, triggers are its buttons with `aria-selected`) and, from 1024px, a long page's section rail stacked at the left (`lg:page-rail--stack`: column, destinations 0.75rem tall on 1px Rules, the 3px bar on the left edge of the current one, an optional 0.85rem description under each word), as the Pulse profile does in a `lg:grid-cols-4` with the content in the other three columns.

**The sheet.** `main.axis` (`flex-1`, `min-height: 40vh`) draws the 3px ink axis in the left gutter from 1024px at `max(1.25rem, calc(50% - 44rem + 1.25rem))`; inside it one `.wrap` column (max 88rem, gutters 1rem → 2rem at 640px → 3rem at 1024px) with 1.5rem above the first stop and 6rem below the last. A page is a `flex-col` of stops 2.5rem apart (`gap-10`; the profile uses 1.5rem). The first stop is `PageHeader`: the 3px rule, a row with the stop mark (2.25rem segment and 1.6rem tick, pulled 1.75rem left and widened to 2.5rem inside the axis) and the station meta right, then 1.25rem to the title row with the page's actions at its right end. Facts are a zone table (`StatGrid`, a grid with 3px ink gaps on an ink background, `sm:grid-cols-2 lg:grid-cols-4`, cells padded 1rem → 1.25rem); lists are `.fare` tables that reflow into label/value blocks below 47.9rem (`fare--reflow`, `data-label` on each cell, `cell-title`, `cell-actions`); paired content splits 7/5 on a 12-column grid with 3rem column gap and 2.5rem row gap from 1024px, and a chart is 16rem tall with its table under a `<details>`.

**The board.** Every shell closes with `Board`: `.board` (ink, paper text), a `.wrap` with 2.5rem vertical padding, the paper OnDesk plate, the app's swatch and name at 1.05rem, a `t-body` tagline at 0.95rem (max 28rem), the app's links at 0.95rem (`gap-x-6`), stacked on a phone and one row from 768px; then a 3px white rule over the rights line (1rem padding, 0.9rem, © left and the legal entity in Condensed right).

**The phone.** Below 768px the search field and the action tickets go; a 3px-bordered menu button (border transparent until hover) opens a full-screen paper panel fixed from `4rem + 1.5rem` to the bottom, arriving with `arrive`, body scroll locked, closing on Escape and on navigation: the person's monogram, name and e-mail on a Rule; the destinations as bold rows on Rule Light with an arrow (`mobileRowClass`, ink when current); a "Change line" label and the other five apps as swatch rows with their taglines; the presence choices; a full-width Sign out ticket. Below 640px the app's name leaves the strip and the workspace plate wraps its name inside itself; below 1024px the "Apps" word and the account name leave their tickets (glyph and ring remain) and the axis is not drawn.

**Panels.** Product-shell menus (`menu-panel`) are 20rem wide, 0.5rem under their ticket, right-aligned for Apps and Account and left-aligned for the workspace switcher (capped at `100vw - 2rem`). Radix panels (`menu-paper`) are at least 12rem wide, 6px off their trigger (tooltips 4px); a `Popover` is 18rem and a `HoverCard` 16rem with 1rem padding. A `Dialog` is `min(32rem, 100% - 2rem)` wide, at most `100vh - 3rem` tall, padded 1.25rem, its header bleeding to the edges and closed by a 3px ink rule, its footer on a 1px Rule with the tickets stacked reversed on a phone and in a row from 640px; an `AlertDialog` is the same at 32rem or 20rem (`size="sm"`); a `Sheet` is 75vw up to 24rem from its side.

**Two screens without a shell.** The workspace picker and the root 404 draw their own strip (the row without actions, the band lit on the app's line, no rail) and open one stop with the person or the address on a plate at Display size; the picker lists workspaces as a reflowing fare table (monogram, bold name at 1.05rem, role stamp, `/w/slug` in Condensed, an `Open` xs ticket) capped at `max-w-4xl`, with the empty state as a 3px ink box carrying a "No workspaces" stamp, and ends in the rights line alone; the 404 ends without a board. The in-workspace 404 keeps the shell and prints a Headline-size stop.

**Breakpoints in use.** 640px (`sm`): the app's name in the strip, the rail action, the account name in the picker, dialog footers in a row. 766px (`max-width: 47.9rem`): fare headers wrap, `fare--reflow` recomposes. 768px (`md`): the search field and action tickets, the menu button goes, the board in a row, cell padding 1.25rem, the Headline and Display steps. 1024px (`lg`): the axis, the "Apps" word and account name, `page-rail--stack`, the 7/5 split, the workspace plate at 20rem.

## Elevation & Depth

Flat. There are no box shadows, gradients, blurs or lifted states inside `.site`; `product.css` sets `box-shadow: none` on `menu-paper`, `tip-paper`, `check-box`, `switch-track`, `sheet-paper` and on Tailwind's `shadow-*`, `backdrop-filter: none` on `backdrop-blur-*`, and `box-shadow: none` on the `ring` utility. Depth is a 3px ink border (a field, a panel, a dialog, the zone table's joints, the picker's empty-state box) or an inversion (a solid ticket, a stamp, the tooltip, the board, the switch when on). Hover is Platform Grey or a swap of ink and paper, never a lift. The only translucency is the scrim under a dialog, an alert dialog and a side sheet: ink at 70% (`rgba(17, 17, 17, 0.7)`), fading in over clock/24; menus, popovers, hover cards and tooltips sit on paper with a border and no scrim.

### Named Rules
**The Ink-on-Paper Rule.** Depth is a border or an inversion. A panel is 3px ink on paper; emphasis is ink and paper swapped; there is no third option.

**The One Stroke Rule.** `--stroke` (3px) is the only border weight: rings, ticks, plate edges, ticket outlines, fields, panels, dialogs, the switch track, the check, the progress track, the monogram, focus outlines, table head and foot rules, the zone table's joints and the dialog header's rule. The 1px Rule is the only thinner divider (fare rows, the rail row, menu separators, dialog footers, the strip's mobile rows); 2px is the underline of a link. `--line` (10px) is the only line weight: the band's six rows sum to it, the swatch, the stop mark, the share band, the spine.

**The Printed States Rule.** A control's state is printed, not lit. A ticket is an outline at rest and solid ink when primary; pressed, any ticket inverts (`:active:not(:disabled)`); disabled, it dims to 45% and keeps its shape; a solid ticket disabled because there is nothing to do yet prints as the dimmed outline (stub and `aria-busy` tickets keep their ink). A check is an empty 3px square that fills ink; a switch is an empty 3px track whose ink square crosses to the right and the track inks while the square turns paper; a progress bar is an empty 3px track filling with ink; a radio choice (a presence status, a `DropdownMenuRadioItem`) is a filled interchange ring; the chosen presence row is Platform Grey. Focus is the world's 3px ink outline offset 3px. Nothing glows, lifts or changes hue.

**The One Scrim Rule.** The 70% ink scrim appears only under a `Dialog`, an `AlertDialog`, a `Sheet` or the native `SheetDialog`. It is the one translucency in the world, and it is never used to dim a page for a menu.

## Shapes

Square everywhere, round only where the map is round. Plates, tickets, fields, stamps, panels, dialogs, sheets, tooltips, the check, the switch and its thumb, the progress track, the monogram and the Radix `Avatar` are all 0 radius (`--radius: 0` on `html.site`, every Tailwind radius step mapped to it in each app's `index.css`, `rounded-full` zeroed in `product.css` for everything except `.ring`, `.presence-ring`, `.animate-spin` and `[role="radio"]`). The interchange ring (`.ring`, 1.1rem, paper fill, 3px ink; 0.9rem inside a menu radio) and the presence ring (`.presence-ring`, 0.85rem in `PresenceRing`; 0.6 / 0.75 / 0.85rem in `PresenceDot`) are the only round shapes: filled is Online, a ring with a 4px ink dot is Busy, empty is Away, an empty ring at 45% is Offline or Invisible.

The switch is a 2.5rem × 1.35rem track (2rem × 1.1rem small) with a 0.85rem (0.6rem) ink square that travels 1.15rem (0.92rem) to the right when on; the check is a 1.25rem square; the progress track is 0.85rem tall. The stub ticket's perforation is a 2px dashed `currentColor` line at 55% opacity, 0.85rem in from the left (0.7rem on `ticket--sm`, 0.6rem on `ticket--xs`). The band is six 4px rows; the share band in a chart is a 10px row split by 2px paper gaps. `AvatarBadge` is an ink square with a 2px paper border pinned to the monogram's corner, and `AvatarGroup` and a pinned `PresenceDot` separate themselves from the face below with a 2px paper outline (recorded as built; see the not-canonized line). Line direction never curves: the band, the stub and the stop mark are straight runs and 90° ticks.

## Components

### Buttons (Tickets)
Every button in a product is a ticket, whether written as `<button class="ticket">` or as the shadcn `Button` (`shared/ui/button.tsx`), whose `cva` root is `ticket` and whose variants are ticket cuts.
- **Shape:** square, 3px ink border, `inline-flex` with a 0.6rem gap (0.45rem on xs), Fira Sans 700, line-height 1, tracking -0.005em.
- **Sizes:** the `Button` default is `ticket--sm` (2.5rem, padding 0.45rem 1rem, 0.9375rem); `xs` and `sm` are `ticket--xs` (2.25rem, 0.35rem 0.8rem, 0.875rem) for dense toolbars and table rows; `lg` and `xl` are the full ticket (3.25rem, 0.7rem 1.4rem, 1rem) for the two shell-less screens; `icon` is `ticket--glyph` (2.25rem square), `icon-xs` 2rem, `icon-lg` 2.75rem.
- **Primary (`default` = `ticket--solid ticket--stub`):** ink on paper with the perforated stub (padding-left 1.5rem at sm, 1.35rem at xs); hover Deep Ink. One per form, page or rail: the rail action ("New channel", "Start now", "New space"), the picker's and 404's first ticket, a dialog's confirming act.
- **Outline (`outline`, `ghost`, `lg`/`xl` without a variant):** paper with ink text, hover Platform Grey. `ghost` deliberately renders this outline ticket, not a shapeless button: the world's glyph-only actions (Apps, help, bell, the dialog's X) sit in a square outline ticket. The CSS cut `ticket--ghost` (border transparent until hover) exists for a glyph inside a row where a second stroke would be noise; the notifications panel's per-row action uses it. Nothing in the shared primitives applies it.
- **Secondary (`secondary`):** the outline ticket on Platform Grey.
- **Destructive (`destructive` = `ticket--danger`):** the stroke and word in Destructive; hover fills red with paper text. Only for an act that cannot be undone.
- **Link (`link` = `ticket--link`):** no border, no padding, the word underlined at 2px (4px on hover); the only button without a ticket's shape, and it looks like a link because it behaves like one.
- **States:** pressed inverts to ink; disabled dims to 45% with `not-allowed`; pending is the disabled ticket with its label swapped and `aria-busy`; a `secondary` or outline ticket pressed prints solid. `SaveRow` keeps its Save ticket an outline until there is something valid to save.
- **Motion:** background, colour and transform in clock/60 ease-out; `:active` drops 1px. Arrows inside a `.group` ticket slide 0.25rem right on hover using Tailwind's `transition-transform` (off the clock, not canonized).

### Stamps (Badge)
`shared/ui/badge.tsx` is a `stamp`: 3px ink box, Condensed 700 0.75rem uppercase, padding 0.1rem 0.45rem, `white-space: nowrap`. `default`, `outline`, `ghost` and `link` print the outline stamp (a fact or a waiting state: "Owner", "Member"); `secondary` prints `stamp--solid` (what is current or in motion); `destructive` prints `stamp--alert` (what stopped). A colour that means a state does not exist: `Stamp` in `console-kit.tsx` exposes the same three tones as `tone`.

### Fields (Input, Textarea, Label, Select, Checkbox, Switch)
- **Input:** `field`: full width, 3px ink, paper, padding 0.7rem 0.9rem, inherited font at line-height 1.3, placeholder Secondary Ink at 80%; focus tints Platform Grey in clock/60 and shows the 3px outline. `field--sm` (2.5rem, 0.4rem 0.9rem, 0.95rem) is the strip's search height; `field--search` insets the text 2.4rem for a glyph; `field.pl-8/9/10` and `pr-9/10` keep an older screen's glyph inset instead of the world's padding; `field--cond` sets identifiers in Condensed; disabled and read-only are Platform Grey with Secondary Ink and `not-allowed`.
- **Textarea:** `field` with `field-sizing: content` and a 4rem minimum (the console-kit `TextArea` lets `rows` measure it instead).
- **Label:** `t-tab` as a flex row with a 0.5rem gap; 45% when its control is disabled.
- **Select:** the trigger is a `field` at `w-fit` with a Lucide chevron; its list is a `menu-paper` (8rem minimum, 6px off the trigger), the chosen option carrying a 3-stroke check at the right; group labels are platform labels.
- **Checkbox:** `check-box`, a 1.25rem 3px square on paper that fills ink when checked or indeterminate, a 3.5-stroke paper check inside, 45% when disabled, the fill in clock/60.
- **Switch:** `switch-track` and `switch-thumb` as described in Shapes; the state reads by position and inversion.
- **Message line:** `FieldShell` reserves a 1.4rem line under every field for the hint (Secondary Ink 0.9rem) or the error (bold Destructive), so a message never pushes the form; `CharCount` appears at 75% of a ceiling of 20 or more and turns red at the ceiling.

### Page Header (the first Stop)
`PageHeader` in `console.tsx`: a `header.rule` with 1rem top padding; a row (`min-h-7`) with the stop mark left and, on the right, `meta` (the page's live datum: "4 open · 2 pending · 1 unassigned") or the stripped `tag` when it differs from the title; 1.25rem below, the title as `t-h2` at 1.5rem → 1.625rem (`max-w-3xl`) with an optional description at 1.05rem (72ch, Secondary Ink) and the page's actions right-aligned at its baseline. `Section` in `console-kit.tsx` is the same stop for the errands below it (`scroll-mt-40`, `h2`, content 1.5rem below). `PanelHeader` is a minor stop: the 3px rule with a platform label left and controls right, 0.75rem padding above and below. `ConsoleTag` is the platform label in Secondary Ink.

### Zone Table (StatGrid / StatTile)
`StatGrid` is `.zone`: a grid with `gap: var(--stroke)` on an ink background inside a 3px ink border, so the joints show as 3px ink like the pricing tiers; columns come from the caller (`sm:grid-cols-2 lg:grid-cols-4`). Each `StatTile` is a paper cell padded 1rem (1.25rem from 768px): the platform label in Secondary Ink, the figure in `t-display t-num` at 2rem → 2.5rem (0.75rem below), the hint at 0.9rem Secondary Ink (0.5rem below). `tone` distinguishes only `alert` / `destructive` (the figure in Destructive); `accent` and `warning` print ink because a good or bad number is said in the hint, not in a colour; `icon` is accepted and not painted.

### Fare Table (Table)
`shared/ui/table.tsx` wraps `<table class="fare">` in an `overflow-x-auto` container: Condensed 1rem with tabular figures, headers as platform labels closed by a 3px ink rule, 0.6rem 0.75rem cells on 1px Rules, the last row closed by 3px ink, `tfoot` bold. Every `TableRow` is `is-link` (Platform Grey on hover in clock/60, never a lift) and Platform Grey when `data-state="selected"`. Hand-written tables in recomposed screens add `fare--reflow` and `data-label` so they recompose below 47.9rem, `cell-title` for the naming cell (a monogram, a bold name, a 0.9rem sub-line) and `cell-actions` for the tickets; a chart's numbers repeat as a `fare` under a `<details>` summary.

### Page Rail (Tabs)
`Tabs` is the page rail: `TabsList` is `page-rail` (bold 0.95rem, 2.75rem tall, 1.75rem apart, on a 1px Rule; vertical orientation drops the rule and stacks with a 0.25rem gap), a `TabsTrigger` is a rail button that turns ink and takes the 3px bar in `--stop-color` when `aria-selected`, and disabled triggers dim to 45%. It never becomes a grey tray with a white pill.

### Card (a stop without a box)
`Card` is a `flex-col` with a 1rem gap and no border, background or shadow; `CardHeader` is the 3px rule with 1rem top padding, a two-row grid that yields a right column for `CardAction`; `CardTitle` is `t-h3` at 1.125rem; `CardDescription` 0.95rem Secondary Ink at 72ch; `CardContent` `min-w-0`; `CardFooter` a 1px Rule with 1rem above and a 0.75rem gap. A grid of two cards is two stops in columns.

### Paper Panels (DropdownMenu, Select, Popover, HoverCard, Command)
`menu-paper`: 3px ink on paper, 12rem minimum, no radius or shadow, arriving in clock/24. Rows (`menuitem`, `menuitemcheckbox`, `menuitemradio`, `option`, `cmdk-item`) are bold 0.95rem, padded 0.6rem 1rem, 0.6rem gap, Platform Grey when hovered, focused or highlighted, 45% when disabled, Destructive when `variant="destructive"` or `is-danger`; group labels are platform labels in Secondary Ink padded 0.75rem 1rem 0.25rem; separators are 1px Rules with 0.25rem above and below; shortcuts are Condensed 0.85rem Secondary Ink at the right; a checkbox item carries a 3-stroke check at the left, a radio item an interchange ring filled when chosen, a sub-trigger tints Platform Grey while open. `menu-paper--content` (Popover, HoverCard) pads 1rem and carries content, with a bold title and a 0.95rem description. `Command` is the same paper with its search row closed by a 3px ink rule (a search glyph, a bold input 3rem tall with a normal-weight placeholder), a 300px list and a centred 0.95rem empty line; `CommandDialog` puts it in a `Dialog` with no padding.

### Tooltip
`tip-paper`: ink with paper text, Condensed 500 0.85rem, padding 0.35rem 0.6rem, no radius, no arrow, 4px off its trigger, arriving in clock/40, `delayDuration` 0.

### Dialogs and Sheets
`Dialog`, `AlertDialog` and `Sheet` share `scrim` and `sheet-paper` (3px ink on paper, arriving in clock/24). A dialog is centred, `min(32rem, 100% - 2rem)` wide, at most `100vh - 3rem`, padded 1.25rem with a 1rem gap; its header bleeds to the edges (`-mx-5 -mt-5`) with the title at 1.25rem and a 0.95rem description, closed by a 3px ink rule and leaving 3.5rem on the right for the glyph close ticket at `top-3 right-3`; its footer bleeds to the edges on a 1px Rule, tickets column-reversed on a phone and right-aligned in a row from 640px, with an optional outline "Close". `AlertDialog` does not close on an outside click, has no X, hides `AlertDialogMedia`, and its `Action` and `Cancel` are `buttonVariants` (`default` solid stub and `outline`) so the confirming act is the stub ticket or, with `variant="destructive"`, the red one. `Sheet` slides from its side (`sheet-paper--side` with `slide-in` from 1.5rem, clock/24), drops the stroke on the screen edge (`sheet-paper--right` has no right border), is 75vw up to 24rem, and carries the same header, footer and glyph X; Nova and the apps' side panels live here. `SheetDialog` in `console-kit.tsx` is the native `<dialog>` twin used by hand-written screens, with `ConfirmRow` starting focus on Cancel.

### Monogram (Avatar)
`Avatar` is `monogram`: a 3px ink square on paper, 2rem (`sm` 1.5rem, `lg` 2.5rem), the image `object-fit: cover`, the fallback two Condensed uppercase letters. `Monogram` in `console-kit.tsx` is the hand-written twin at 2.25rem / 2.75rem / 3.5rem (two initials by `markOf`). `AvatarBadge` is an ink square with a 2px paper border at the corner; `AvatarGroup` overlaps by 0.375rem with 2px paper outlines; `AvatarGroupCount` is a monogram with the count in Condensed.

### Presence (PresenceDot, PresenceRing, PresenceChoices)
`STATUS_META[status].dot` holds the ring classes; `PresenceDot` renders `presence-ring` + those classes with `title` set to the word (0.75rem by default, 0.6rem `xs`, 0.85rem `md`, a 2px paper outline with `ring`), and `PresenceRing` renders the 0.85rem dot with its word visible (`showLabel`) or `sr-only` ("Busy · In meeting" via `presenceLabel`). `PresenceChoices` is a `radiogroup` under the label "Your status": the four choosable statuses as full-width rows bleeding 0.5rem past the panel edge (`-mx-2 px-2 py-1.5`), each a ring, a bold word and a 0.85rem description, the chosen one on Platform Grey, 45% while a choice is saving; below, a 0.85rem `aria-live` line with the consequence ("Everyone sees you as offline, in every OnDesk product.", the meeting sentence, the last-seen sentence, or "Visible in every OnDesk product."). Offline and Invisible rings print at 45% (`.ring.is-offline` in `product.css` for old screens, `.presence-ring.is-offline` in `site.css`).

### Route Strip (ProductStrip and its parts)
- **StripBrand:** the OnDesk plate (`plate`, 1.15rem 800, padding 0.375rem 0.625rem) linking to the workspaces page; the app's 1.6rem swatch with its name at 1.05rem 800 from 640px, wrapped in a span labelled with the app's name; then the children (the workspace switch).
- **WorkspaceSwitch:** with one workspace a still `plate-block` (0.95rem 800, wrapping inside on a phone, truncating from 640px at 14rem, 20rem from 1024px); with several, the same plate as a button with a chevron (Deep Ink on hover, the chevron rotating on open) opening a 20rem `menu-panel` labelled "Workspaces": one row per workspace with an interchange ring filled for the current one, the name and the slug in Condensed 0.85rem, a 1px Rule and "Manage in the console" with an arrow-up-right. Choosing navigates to that workspace's overview.
- **Search:** `GlobalSearch` in the centre from 768px as a `field field--sm field--search` with its glyph inside.
- **AppsMenu:** a small ticket with a layout-grid glyph and the word "Apps" from 1024px (`aria-label="Switch app"`), opening a 20rem `menu-panel` labelled "Change line": the other five apps in band order as rows with a 1.25rem swatch, the bold name and the 0.85rem tagline (`APP_TAGLINE`), then a 1px Rule and "OnDesk console"; hovering or focusing a row previews that line in the band, leaving the panel restores the app's line.
- **Nova, help, notifications:** a small ticket with a sparkles glyph and "Nova" (opening the Nova sheet), the help glyph ticket (whose "Ask Nova instead" opens the same sheet), the bell glyph ticket (opening the notifications panel).
- **AccountMenu:** a small ticket up to 16rem with the presence ring (the person's chosen status), the name from 1024px (truncated) and a chevron, opening a 20rem `menu-panel` labelled "Your account": the monogram, name and Condensed 0.9rem e-mail on a Rule; `PresenceChoices`; the app's `menuitem` links ("Profile and notifications", "Account on OnDesk", "Security on OnDesk") on a Rule; "Sign out" ("Signing out…" while pending) on a Rule.
- **Menu button (phone):** a 3px-bordered square with the menu or X glyph, border transparent until hover, `aria-expanded`.
- **Rail row:** `.rail-row` on a 1px Rule with a `.wrap` holding the `page-rail` (`aria-label="Pages"`) and, from 640px, the rail action.

### Board
`Board` in `product-shell.tsx`, as described in Layout: plate, swatch and name, tagline (Pulse: "Support that knows who is on your team."; default: "One account, one team list, and one invoice per app."), five links (Overview, the app's main list, "Workspace on OnDesk", Status, Legal) at 80% white and 100% when hovered or current, the 3px white rule, the rights line with "Northstar Platforms LLC" in Condensed.

### LineBand, LineStub, AppLine
`LineBand` in `map.tsx`: six `band-row` spans 4px tall in `PRODUCT_IDS` order, each in its line colour; `focus` adds `band--focus` and lights one row (`is-lit`), the rest fading to 18% over clock/24; `focus={null}` lights all six. `LineStub`: six short 10px round-capped lines ending in 4px `currentColor` bars in a 240 × 142 box. `AppLine`: a 1.25rem swatch and the app's bold name, truncating; how an app is named in a row.

### Empty State and Skeleton
`EmptyState`: a bold sentence naming the gap and a 0.95rem Secondary Ink note (60ch) saying how it fills, an optional action 0.75rem below, 2rem vertical padding, no icon ("No tickets yet." / "The first email to a connected mailbox, or the first message from the widget, opens one."). `Skeleton` (both the `ui` one and the console-kit one): Platform Grey bars in the shape of what is coming, no radius, `animation: none`.

### Toasts
Sonner inside `.site`, `theme="light"`: a paper ticket with the 3px stroke, bold, no radius, no shadow, with Lucide state glyphs; the loading glyph spins (`animate-spin`, exempted from the `rounded-full` reset; not canonized).

### Recomposed screens (Pulse)
- **Overview** (`overview-view.tsx`): `PageHeader` "Overview" with the live datum in the meta and one sentence; the four thirty-day facts as a zone table whose hints say the change in words; a 7/5 split with "Ticket volume" (a legend of two swatches, Pulse red for Opened and ink for Resolved, then a Recharts `LineChart` 16rem tall with 2px linear lines, 4px paper-filled dots, a 1px Rule grid, a 1px ink x-axis, Condensed 12px ticks, a 3px-bordered paper tooltip with a platform label and swatch rows, no animation, described by the fare table under a `<details>`) and "Where tickets come from" (a 10px share band split by 2px paper gaps in the grey ramp from largest to smallest, then a fare table of channel and share); "Recent tickets" as a `fare fare--reflow` (number in Condensed Secondary Ink, the ticket with a small monogram and a bold subject over a 0.9rem contact line, priority, status and AI stamps) with an underlined "All tickets" link and arrow at the panel header's right.
- **Workspace picker** (`workspace-selector-view.tsx`) and **404** (`not-found.tsx`): as described in Layout.
- **Profile** (`profile-view.tsx`): `PageHeader` "Your profile in Pulse" and a four-section rail stacked from 1024px; the Appearance section (light, dark, system) was retired with the world.

### Motion
Every duration in `product.css` is a fraction of `--clock` (12 s): the band's dim and the progress fill over clock/24 with `cubic-bezier(0.16, 1, 0.3, 1)`; `menu-paper`, `sheet-paper`, the side sheet's `slide-in` and the scrim over clock/24; the tooltip over clock/40; the rail's colour, a menu row's tint, the check's fill, the switch's travel and inversion over clock/60 ease-out; the phone panel `arrive`. `prefers-reduced-motion` removes them all, the skeleton never moves, and a chart's lines draw without animation (`isAnimationActive={false}`). What still runs on Tailwind's 150ms default (`transition-colors`, `transition-transform` on the menu button, the chevrons, the arrows, the presence rows and `StripLink`) is recorded below, not canonized.

## Do's and Don'ts

### Do:
- **Do** mount `.site` on `<html>` (`<html lang="en" class="site">`) and import `@ondesk/shared/styles/site.css` then `product.css` from `src/index.css`, with `@source "../node_modules/@ondesk/shared"`; set `--font-sans` to Fira Sans and `--font-mono` to Fira Sans Condensed in `@theme`, and every `--radius-*` to `var(--radius)` (0).
- **Do** build the shell from `ProductStrip` with `StripBrand` + `WorkspaceSwitch` as `brand`, `GlobalSearch` as `nav`, `AppsMenu` · Nova · help · bell · `AccountMenu` as `actions`, the app's destinations as `rail` (`Link`s with `aria-current="page"`), the one creating action as `railAction` (`ticket ticket--xs ticket--solid ticket--stub`, behind its permission), and `MobileIdentity`, the rows via `mobileRowClass`, "Change line" + `MobileApps`, `PresenceChoices` and a full-width Sign out as `mobile`; set `--stop-color: lineColor(APP)` on the shell root; wrap the `Outlet` in `main.axis > .wrap.pt-6.pb-24`; close with `Board`.
- **Do** pass `focus={preview ?? APP}` to the strip and let `AppsMenu`'s `onPreview` drive it, so hovering an app lights its line in the band.
- **Do** open every page with `PageHeader` (the live datum in `meta`, the page's primary action in `actions`) and every errand below it with `Section`; put facts in `StatGrid`/`StatTile` with the change said in the hint, lists in `.fare fare--reflow` with `data-label`, `cell-title` and `cell-actions`, and a chart's numbers in a fare table under `<details>`.
- **Do** use the shadcn primitives from `@ondesk/shared/ui` as they are: `Button` (`default` for the one primary act, `outline`/`ghost` for the rest, `destructive` for the irreversible, `size="icon"` for a glyph), `Badge` (`default` fact, `secondary` current, `destructive` stopped), `Input`/`Textarea`/`Label`/`Select`/`Checkbox`/`Switch`, `Table`, `Tabs`, `Card`, `Dialog`/`AlertDialog`/`Sheet`, `DropdownMenu`/`Popover`/`HoverCard`/`Tooltip`/`Command`, `Avatar`, `Progress`, `Separator`, `Skeleton`, `Toaster`; or the console-kit twins (`Stamp`, `TextField`, `SaveRow`, `SheetDialog`, `ActionMenu`, `Monogram`) in a hand-written screen.
- **Do** draw a chart with the app's series in `lineColor(APP)`, the counterpart in `var(--ink)`, shares in the grey ramp (ink, #4d4d4d, #8a8a8a, #cfcfcf, #e6e6e6), grid in `var(--rule)`, ticks in Condensed 12px Secondary Ink, dots paper-filled, no animation, and a 3px paper tooltip.
- **Do** print presence with `PresenceRing` (or `PresenceDot` + `STATUS_META.dot`) and its word, and show the person's own choice in the account ticket.
- **Do** write every duration as `calc(var(--clock) / n)`; entrances and fades use `cubic-bezier(0.16, 1, 0.3, 1)`, state uses `ease-out`.
- **Do** keep `shared/styles/site.css` byte-identical to `ondesk/src/site.css` and put every product-only rule in `product.css`; keep the six `workspace-shell.tsx` files one template that differs only in `APP`, destinations, rail action, links and tagline.
- **Do** reserve the message line under a field (`FieldShell`), print a stop with nothing in it as an `EmptyState` sentence, and say a good or bad figure in words.
- **Do** keep a screen not yet recomposed compiling and inheriting: it may still say `console-label`, `font-mono`, `text-[10px]`, `rounded-lg` or `shadow-sm`, and the aliases will print the world; recompose it by replacing those with `PageHeader`, `Section`, `StatGrid`, `.fare`, tickets and stamps.

### Don't:
- **Don't** add a dark mode, a `.dark` variant, a theme toggle or an Appearance setting; `ThemeProvider` is a shim and `useTheme` always answers "light".
- **Don't** typeset anything in the app's line colour or any line colour, and don't tint a background with one; the line lives in the band, the swatch, the stop mark, the rail bar and a chart series.
- **Don't** colour a status or priority (green resolved, amber pending, blue open, red urgent); a state is a word in a stamp, and only what stopped or cannot be undone is red.
- **Don't** put a sidebar over stat tiles, a card grid, an avatar circle or a mono kicker with a blinking cursor back; the strip's rail is the navigation, the zone table is the facts, the monogram is square, the platform label is the caption.
- **Don't** use a shapeless button: a glyph alone goes in `Button size="icon"` (the square outline ticket); `ticket--ghost` is for a glyph inside a row and nothing else.
- **Don't** print anything below 0.75rem, and don't add `text-[9px]`, `text-[10px]` or `text-[11px]` to a new screen even though the floor would catch them.
- **Don't** add a radius, a shadow, a blur, a gradient or a lift; `rounded-*`, `shadow-*` and `backdrop-blur-*` are neutralised in `.site` and belong to no new screen.
- **Don't** use Tailwind's `ring` utility for focus; the world's focus is the 3px ink outline and `.ring` is the interchange ring.
- **Don't** hardcode a millisecond duration or a Tailwind `duration-*`, `transition-colors` or `transition-transform`; a transition that is not a fraction of `--clock` is off the timetable.
- **Don't** light the whole band inside an app, and don't leave another app's line lit after the Apps menu closes.
- **Don't** add a seventh hue, a coloured arrow for up or down, or an animated chart; direction is a sentence and the numbers are a table.
- **Don't** split a URL, slug or e-mail with `break-all`; use `Breakable` or `overflow-wrap: anywhere`.
- **Don't** spin anything while loading; the skeleton is still and a pending ticket says "Saving…".
- **Don't** edit `shared/styles/site.css` for a product need or copy `product.css` into an app; the world is one file and the product additions are the other.
- **Not canonized:** (1) Pulse's `StatusBadge` and `PriorityBadge` (`pulse/src/shared/components/`) still use `text-[9px]`/`text-[10px]` (caught by the floor), a `rounded-full` dot (rendered as a 6px ink square), `font-mono text-xs` in the indicator variant, and `bg-info/8`, `bg-warning/8`, `bg-primary/8`, `/30` and `/25` alpha borders of ink, which print faint second tints; they read as ink words but are not the stamp and should be recomposed to `Badge` tones. (2) Screens not recomposed in the six apps keep the old devices behind the aliases: in `pulse/src/features` alone 27 files use `rounded-*`, 62 `text-muted-foreground`, 29 `border-border`/`bg-card`; across the six 95 files still say `console-label` and 204 `font-mono`; they inherit the world and are listed here as work to do, not as system. (3) Tailwind's 150ms `transition-colors`/`transition-transform` on the strip's menu button, the chevrons, the arrows in tickets and links, the presence rows and `StripLink`, off the clock as in the incumbent. (4) `product.css` declares `.site .strip .page-rail { border-bottom: 1px solid var(--rule) }` and later `{ border-bottom: 0 }`; the later wins and `ProductStrip` also sets it inline; the first rule is dead. (5) `--chart-1` is ink and `--chart-2` the app's line, while the recomposed chart draws the app's series first; two orderings of the same two colours. (6) `Avatar` (1.5 / 2 / 2.5rem) and `Monogram` (2.25 / 2.75 / 3.5rem) are two monogram scales; `AvatarBadge`'s 2px paper border, `AvatarGroup`'s and `PresenceDot ring`'s 2px paper outlines are off the 3px stroke. (7) `Textarea` carries a 4rem minimum where the console-kit `TextArea` has none. (8) The root 404 prints the requested path with `break-all`. (9) The toaster's loading glyph spins and is exempted from the `rounded-full` reset. (10) The board's link white (80%, 100% current) and rights line (70%) sit beside the world's Board Muted (72%): three whites. (11) `--info` is Secondary Ink while `--warning` and `--success` are ink, so an "open" status word prints one step lighter than "pending" or "resolved". (12) `pulse/src/index.css` keeps `--pulse-ink`, `--pulse-ink-deep` and `--pulse-lime` (the last remapped to paper) for screens that still read them. (13) On 2026-09-30 `partners/src/site.css` and `developers/src/site.css` (identical to each other) and `admin/src/site.css` each differ from `ondesk/src/site.css`; only `shared/styles/site.css` matches it, so the incumbent's "identical copies in the four consoles" is not currently true. (14) `shared/ui` holds 24 primitives, not the 25 the brief named.

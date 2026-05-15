---
name: Vietnam Japan Capital Atlas
description: Multi-language investment intelligence platform mapping Japanese FDI flows across Vietnam
colors:
  mekong-teal: "oklch(47% 0.11 162)"
  jade-wave: "oklch(62% 0.13 168)"
  dispatch-ink: "oklch(22% 0.018 176)"
  night-ground: "oklch(18% 0.02 176)"
  field-muted: "oklch(46% 0.028 176)"
  thread-line: "oklch(82% 0.022 154)"
  surface-tonal: "oklch(91.4% 0.041 154)"
  surface-mid: "oklch(95.8% 0.012 112)"
  paper-warm: "oklch(97.7% 0.009 98)"
  data-gold: "oklch(69% 0.14 76)"
  data-coral: "oklch(60% 0.16 38)"
  data-sky: "oklch(54% 0.12 235)"
  data-violet: "oklch(55% 0.16 286)"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.65rem"
    fontWeight: 950
    lineHeight: 1.15
    letterSpacing: "normal"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 950
    lineHeight: 1.25
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 950
    lineHeight: 1.25
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.98rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0.12em"
  caption:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 800
    lineHeight: 1.55
rounded:
  xs: "0.45rem"
  sm: "0.5rem"
  md: "0.6rem"
  lg: "0.65rem"
  pill: "999px"
spacing:
  xs: "0.45rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.25rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.mekong-teal}"
    textColor: "{colors.paper-warm}"
    rounded: "{rounded.sm}"
    padding: "0.58rem 0.78rem"
    typography: "{typography.title}"
  button-primary-hover:
    backgroundColor: "oklch(41% 0.105 162)"
    textColor: "{colors.paper-warm}"
  button-secondary:
    backgroundColor: "{colors.paper-warm}"
    textColor: "{colors.dispatch-ink}"
    rounded: "{rounded.sm}"
    padding: "0.58rem 0.78rem"
  button-secondary-hover:
    backgroundColor: "{colors.surface-tonal}"
    textColor: "oklch(24% 0.045 162)"
  nav-tab:
    backgroundColor: "transparent"
    textColor: "oklch(35% 0.023 176)"
    rounded: "{rounded.xs}"
    padding: "0.48rem 0.72rem"
  nav-tab-active:
    backgroundColor: "oklch(90.5% 0.04 156)"
    textColor: "oklch(27% 0.058 162)"
  status-chip:
    backgroundColor: "color-mix(in oklch, {colors.mekong-teal} 12%, {colors.paper-warm})"
    textColor: "oklch(24% 0.035 176)"
    rounded: "{rounded.xs}"
    padding: "0.42rem 0.56rem"
---

# Design System: Vietnam Japan Capital Atlas

## 1. Overview

**Creative North Star: "The Dispatch Table"**

A senior analyst's command surface: every element positioned with purpose, density calibrated to expertise, confidence expressed through precision not decoration. The palette reads like a document printed on good paper, the typography carries institutional weight through weight contrast alone, and the single accent earns its authority by appearing rarely. When this tool is open on a screen at the front of a meeting room, the room should read it as credible before anyone speaks.

The system is warm without being soft. The paper tone leans amber, the neutrals carry a persistent green tint toward hue 154-176, the borders share that tint. Nothing is the default gray of a system that forgot to think about color. Depth is expressed through a tonal stack (Paper Warm, Surface Mid, Surface Tonal) reinforced by 1px green-tinted borders. Shadows are earned by interaction, not assigned to status.

This system explicitly rejects two failure modes documented in PRODUCT.md: the government data portal (austere, under-designed, spiritually resigned to its institutional role) and the startup pitch deck (oversized metric heroes, bar charts that animate on scroll for spectacle, "Series A" energy). The Dispatch Table is neither a public register nor a fundraising deck. It is an intelligence product used by people who already know the thesis and need evidence to travel credibly across three languages and two national investment cultures.

**Key Characteristics:**
- Warm-neutral light mode base (Paper Warm → Surface Mid → Surface Tonal hierarchy)
- Single structural accent (Mekong Teal) on under 15% of any screen at any time
- Weight contrast (950 vs 400) as the primary typographic hierarchy signal, not just size
- State-reactive elevation: zero resting shadow, lifted on hover and interaction
- Six-series data color vocabulary reserved strictly for encoding, never decoration
- All text and data must read at presentation distance (2 meters from a projector)
- OKLCH-only color doctrine throughout the codebase

## 2. Colors: The Mekong Tonal System

A restrained palette built around two anchors: the warm amber of paper stock and the cooled green of river-stone jade. Every neutral leans toward hue 154-176; no value is purely achromatic.

### Primary
- **Mekong Teal** (`oklch(47% 0.11 162)`): The sole structural accent. Used on active navigation, primary buttons, map pin fill, bar fill gradient start, timeline dots, and focus rings. Appears on under 15% of any given surface. The depth of this color is deliberate: at full chroma it reads as institutional green, not tech teal.
- **Jade Wave** (`oklch(62% 0.13 168)`): The lighter companion accent. Gradient endpoint on bar fills (`linear-gradient(90deg, mekong-teal, jade-wave)`), second data series on charts, never used independently as a UI state color.

### Neutral
- **Paper Warm** (`oklch(97.7% 0.009 98)`): The base page background, elevated overlay surfaces (language menu, investor rows). The amber tint (hue 98) is the baseline warmth. Never substitute pure white.
- **Surface Mid** (`oklch(95.8% 0.012 112)`): Secondary container backgrounds: chart cards, company drawer panel, page-select input, filter buttons at rest. One step cooler than Paper Warm.
- **Surface Tonal** (`oklch(91.4% 0.041 154)`): Third depth layer. Map stage background, active chip and filter fills, hover state backgrounds. Green-tinted; signals geospatial context without a label.
- **Thread Line** (`oklch(82% 0.022 154)`): All borders and dividers. Hue 154 keeps borders inside the system's color temperature. Never use a gray or neutral border.
- **Field Muted** (`oklch(46% 0.028 176)`): Secondary text: captions, chart sub-descriptions, eyebrow labels in prose context, secondary metadata. Dark enough for AAA contrast at large sizes; clearly secondary at body size.
- **Dispatch Ink** (`oklch(22% 0.018 176)`): Primary text, headings, navigation labels, all data-dense labels. The near-black anchor.
- **Night Ground** (`oklch(18% 0.02 176)`): The deepest value. Chart ink (`chartPalette.ink`), signal index backgrounds, darkest overlays. Reserved for maximum-contrast contexts.

### Secondary (Data Series)
- **Data Gold** (`oklch(69% 0.14 76)`): Third data series. Warm, amber-yellow. Logistic and regulatory timeline data.
- **Data Coral** (`oklch(60% 0.16 38)`): Fourth data series. Warm red-orange. Energy sector, counterpoint to cool tones.
- **Data Sky** (`oklch(54% 0.12 235)`): Fifth data series. Mid-blue. Urban / public capital sectors.
- **Data Violet** (`oklch(55% 0.16 286)`): Sixth data series. Muted purple. Soft-infrastructure or retail data.

### Named Rules

**The Mekong Rule.** Mekong Teal appears on under 15% of any screen. Its rarity is its authority. If teal covers more than 15% of the viewport at once, it has become a theme, not an accent, and the system's restraint collapses.

**The Six-Series Rule.** The data palette (Jade Wave, Data Gold, Data Coral, Data Sky, Data Violet, plus Mekong Teal as series one) is reserved for encoding data series on charts and map markers. Never apply a data color to a UI state, status badge, or decorative element. The moment a data color appears outside a chart or map, the chart's encoding becomes ambiguous.

**The Tint Rule.** Every neutral in the system carries a nonzero chroma toward hue 150-176. Chroma ranges from 0.009 (Paper Warm) to 0.041 (Surface Tonal). No new neutral may be added at chroma 0 — that is a pure gray and it does not belong in this palette.

## 3. Typography

**Body Font:** Inter (ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)

The system uses a single typeface. All hierarchy is expressed through weight contrast (400 body to 950 display) and size scaling. Inter's variable axis runs from 100 to 950; this system uses the top of that range deliberately. The contrast between a 950-weight heading and a 400-weight body paragraph is the typographic event; no display face is needed to create drama.

Rendering: `text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale`.

### Hierarchy

- **Display** (950, 1.65rem, lh 1.15): Section analysis headings on overview and regions pages. Major report titles. The heaviest text the interface produces.
- **Headline** (950, 1.25rem, lh 1.25): Value numbers in bar chart cards, investor drawer titles, prominent metric labels.
- **Title** (950, 1rem, lh 1.25): Chart card headings, navigation tab labels (850), signal-row headings, most sub-section titles. The workhorse heading level.
- **Body** (400, 0.98rem, lh 1.7): All running prose. Overview thesis paragraphs, chart card descriptions, signal body text. Maximum line length: 54-65ch (enforced via `max-width` on paragraph containers).
- **Label** (900, 0.72rem, lh 1, letter-spacing 0.12em, uppercase): Eyebrow identifiers above headings. Category markers. The `.eyebrow` class. The only typographic context where letter-spacing is used.
- **Caption** (800-900, 0.75-0.82rem, lh 1.35-1.55): Chart sub-descriptions, investor card metadata, coordinate and confidence labels in the map panel, language option secondary text.

### Named Rules

**The Weight Stack Rule.** No heading level may increase in size without also increasing in weight, and no weight increase is meaningful without a size shift. Hierarchy is always both dimensions together.

**The Eyebrow Rule.** The `.eyebrow` pattern (uppercase, weight 900, letter-spacing 0.12em, 0.72rem, Field Muted color) is the only typographic context in the entire system that uses letter-spacing for spacing. Do not add tracking to any other text element. Letter-spacing is a reserved signal, not a style choice.

**The Line Length Rule.** Body text containers are capped at 54-65ch. Analysis paragraphs on the overview page use `max-width: 54rem`. No body paragraph runs wall-to-wall at wide viewport widths.

## 4. Elevation

Flat by default, lifted on interaction. At rest, all surfaces carry zero box-shadow. Depth is communicated through the tonal stack (Paper Warm, Surface Mid, Surface Tonal) and the shared Thread Line border. The moment a component receives focus or hover, it earns a shadow — this reactive pattern makes the interaction model legible without a single annotation.

### Shadow Vocabulary

- **Ambient Lift** (`0 16px 48px rgb(23 43 38 / 0.08)`): The lightest shadow. Used on the language dropdown panel and the soft-entry `shadow-soft` Tailwind token. Barely perceptible; just enough to separate an overlapping surface from the page.
- **Hover Pull** (`0 10px 28px rgb(23 43 38 / 0.16)`): The standard interactive lift applied to all hovered clickable surfaces. Buttons, markers, cluster pills.
- **Drawer Dominance** (`-22px 0 70px rgb(23 43 38 / 0.18)`): The company drawer's left-edge shadow. Its scale signals that the drawer is the dominant surface while open; nothing else uses a shadow this large.
- **Marker Glow** (`0 16px 36px oklch(22% 0.018 176 / 0.26)` + two concentric ring pseudo-shadows): Map investor pins only. The outer ring uses `color-mix(in oklch, var(--marker-color) 20%, transparent)` to tint the shadow toward the pin's sector color, creating a colored halo effect.
- **Company Icon** (`0 8px 24px rgb(23 43 38 / 0.14)`): The floating company logo badge inside company visual figures. Smaller and tighter than Hover Pull; the icon sits on top of imagery, not on the page surface.

### Named Rules

**The Flat-First Rule.** Shadows are earned by state change, not assigned to hierarchy. A chart card, a signal row, and a nav tab have zero resting shadow. Only interactive elements (buttons, map markers, dropdowns) receive shadows, and only on hover or open states. If a resting surface has a box-shadow, remove it.

## 5. Components

### Buttons

Character: Authoritative and direct. The primary button is the one action worth taking on the screen; the secondary/filter button is a working surface control.

- **Shape:** Gently rounded (0.48-0.5rem radius). Not pill, not square.
- **Primary:** Mekong Teal fill, Paper Warm text. Font-weight 900, 0.88rem. All three button types share `min-height: 2.35rem` and `padding: 0.58rem 0.78rem`.
- **Hover/Focus Primary:** Background shifts to `oklch(41% 0.105 162)` (darker teal). `translateY(-1px)` lift. No shadow added on hover; the lift is the affordance.
- **Secondary / Filter:** Paper Warm fill, Dispatch Ink text, Thread Line border at rest. On hover: Surface Tonal fill, Mekong Teal border, dark green text (`oklch(24% 0.045 162)`). The filter button uses `.is-active` class for selected state (same styles as hover; no lift animation).
- Transition: `background-color 180ms ease-out, border-color 180ms ease-out, color 180ms ease-out, transform 180ms ease-out`.

### Navigation

- **Tabs (`.primary-nav`):** Flex row, wraps on overflow. Each `.nav-tab`: transparent background, borderless at rest. Font-weight 850, 0.88rem. On hover: Surface Tonal fill + Thread Line border color (`oklch(82% 0.022 154)`) + Dispatch Ink text. Active (`.is-active`): `oklch(90.5% 0.04 156)` fill, `oklch(67% 0.09 162)` border, `oklch(27% 0.058 162)` text.
- **Mobile collapse:** At <1180px viewport, the tab row is hidden and replaced by a `<select>` element with a custom-styled wrapper (`.page-select-wrap`). The select uses Surface Mid fill, Thread Line border. At <560px the topbar collapses to stacked rows with the select spanning full width.

### Map Markers

The signature component. Investor pins (`.investor-marker`) are 34px rotated-square teardrops: `border-radius: 50% 50% 50% 7px; transform: rotate(-45deg)`. A 2px Paper Warm border creates separation from the map. Initials render inside a circular pseudo-element that counter-rotates (`transform: rotate(45deg)`) to stay upright.

- **Default color:** Mekong Teal via `--marker-color` CSS custom property. Each sector overrides via inline style.
- **Resting:** Drop shadow + a diffuse color ring (`0 0 0 7px color-mix(in oklch, var(--marker-color) 18%, transparent)`).
- **Active/hover:** `scale(1.16)`, intensified ring shadows, `saturate(1.14)` filter.
- **Cluster pills (`.cluster-marker`):** Pill-shaped (`border-radius: 999px`), Mekong Teal fill, shows member count. Three concentric ring shadows at decreasing opacity. Hover: `translateY(-1px) scale(1.06)`.

### Status Chips

- `color-mix(in oklch, var(--chip-color) 12%, Paper Warm)` fill. `color-mix(..., 28%, Thread Line)` border.
- Font-weight 900, 0.75rem. `min-height: 1.8rem`. Radius: 0.45rem.
- Used as sector category labels in the investor directory. Color-mixed to remain readable at all background tints.

### Cards and Containers

- **Chart cards (`.chart-card`):** 1px Thread Line border, 0.65rem radius, Surface Mid fill, 1rem padding. No resting shadow. The `.chart-body` area is `height: 20rem` by default, `22rem` for `.is-wide` variants that span the full grid column.
- **Region panels (`.region-panel`):** Thread Line border, 0.6rem radius. Background gradient: `linear-gradient(180deg, Surface Mid, Paper Warm)`. 1.25rem padding.
- **Signal rows (`.signal-row`):** Thread Line border, 0.6rem radius, Surface Mid fill. Two-column grid: `4.25rem` left for the index badge + `1fr` for content. The index badge (`.signal-index`) is Night Ground fill with Paper Warm text; it is a structural counter, not a decorative icon.
- **Investor directory rows (`.investor-directory-row`):** Paper Warm fill, Thread Line border, 0.5rem radius. Responsive grid: single column on mobile, five-column on md+.

### Company Drawer

- Slide-in panel from the right edge, `min(430px, 100vw)` wide, full viewport height.
- Surface Mid fill, Thread Line left border.
- Transition: `transform 240ms cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo). Closed state: `translateX(104%)`, `visibility: hidden`. Open: `translateX(0)`, `visibility: visible`.
- Drawer Dominance shadow (`-22px 0 70px rgb(23 43 38 / 0.18)`).

### Language Dropdown

Custom-built; not a native `<select>`. The trigger button (`.language-dropdown-button`) uses a CSS-only caret via `::after` pseudo-element (`border-top: 5px solid Field Muted` chevron). The panel (`.language-menu`) positions `top: calc(100% + 0.35rem)`, right-aligned. Each option is a full-width button with flag rendered in pure CSS (no images). Flags use layered gradients and pseudo-elements for VN, US, JP patterns.

## 6. Do's and Don'ts

### Do:

- **Do** use OKLCH for every color value in the codebase. No hex, HSL, or RGB literals for new tokens. The OKLCH doctrine is total; every addition must join it.
- **Do** keep Mekong Teal under 15% surface coverage at any viewport state. Count button fills, active tab backgrounds, bar chart fills, and map markers together. If the total exceeds 15%, the system has lost its restraint.
- **Do** encode data series using the six-series vocabulary in order: Mekong Teal, Jade Wave, Data Gold, Data Coral, Data Sky, Data Violet. Never invent a new data color.
- **Do** apply Thread Line borders (`oklch(82% 0.022 154)`) on all container borders. Never use a gray, neutral, or default border color.
- **Do** make shadows reactive. Start every component at zero box-shadow. Elevate only on `:hover`, `:focus-visible`, or `.is-active`/`.is-open` states.
- **Do** use `ease-out` curves for all transitions: `cubic-bezier(0.16, 1, 0.3, 1)` for entrances (drawer, dropdown), `ease-out` (or `180ms ease-out`) for micro-interactions (buttons, markers).
- **Do** reserve the `.eyebrow` label pattern (uppercase, weight 900, 0.12em letter-spacing, 0.72rem) for section markers and category identifiers. It is a named element, not a freestyle text style.
- **Do** test all critical data labels at presentation distance. Chart legends, map legend entries, region labels on the static map, and signal index numbers must be readable at 2 meters.
- **Do** maintain the tonal stack when adding new surfaces: new containers that sit inside Paper Warm should use Surface Mid fill; containers inside Surface Mid should use Surface Tonal or Paper Warm (for contrast reversal).

### Don't:

- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on any card, callout, list item, or alert. This is an absolute ban. Use full border + background tint, or a leading number/icon, or nothing.
- **Don't** use `background-clip: text` with a gradient for decorative gradient text. All emphasis in this system is weight and size. Gradient text has no role here and no visual home.
- **Don't** apply the government data portal aesthetic: unstyled system font, default-gray surfaces at any chroma, flat tables with no visual hierarchy. This product was worth commissioning; the design must reflect that.
- **Don't** apply startup pitch energy: a hero section leading with a big number in a large font, small supporting label, gradient accent behind the number, and a CTA button. That is the hero-metric anti-pattern. If a section needs to lead with a metric, use the eyebrow + display + body pattern instead.
- **Don't** use glassmorphism. No `backdrop-filter: blur()` as decoration on any card, panel, or overlay. The map band uses a semi-transparent background with no blur; that is the correct pattern.
- **Don't** add shadows to resting surfaces. A `.chart-card` at rest has no box-shadow. A `.signal-row` at rest has no box-shadow. A `.nav-tab` at rest has no box-shadow. Shadows appear only on interaction.
- **Don't** use `#000000` or `#ffffff` anywhere. Night Ground (`oklch(18% 0.02 176)`) and Paper Warm (`oklch(97.7% 0.009 98)`) are the system extremes. Pure black and pure white do not exist in this palette.
- **Don't** nest two bordered containers with the same border style inside each other. A `.region-panel` containing a `.chart-card` is acceptable because their backgrounds differ. A `.chart-card` containing another `.chart-card` is never acceptable.
- **Don't** use the data palette colors (Data Gold, Data Coral, Data Sky, Data Violet, Jade Wave) as UI state colors, status indicators, or decorative accents. The moment they appear outside a chart or map, they corrupt the encoding system.
- **Don't** add a sixth section or rename any of the six sections in this file. Tools that consume DESIGN.md parse exact header text.

# Atlas Command Redesign Design

## Context

Vietnam Japan Capital Atlas is a product interface for investment intelligence, used by analysts and stakeholders who need geographic evidence, credible framing, and presentation-ready navigation. The redesign direction selected by the user is **Atlas Command**.

## Goal

Make the site feel significantly more impressive while preserving the product's measured, institutional character. The map and geographic thesis will become the visual center of gravity, with richer surfaces, stronger contrast, and purposeful transitions.

## Visual Direction

The interface will feel like a commissioned strategy atlas: warm report-paper base, ink-heavy typography, a composed command surface, and a map-led first impression. It must avoid government portal austerity, startup pitch-deck hype, neon effects, glassmorphism, and decorative animation.

## Palette

Keep the existing warm paper and Mekong teal identity, but strengthen the palette:

- Use deeper ink and warmer paper for clearer contrast.
- Make Mekong teal more authoritative and rarer, used for primary actions, selected navigation, active map markers, and key focus rings.
- Reduce washed-out pale greens where they flatten the page.
- Reserve gold, coral, sky, violet, jade, and teal for charts and map/category encoding.
- Use OKLCH for new CSS color values.

## Layout

The redesign will keep the current React structure and page set:

- Overview
- Presentation map
- Growth poles
- Value chain
- Analysis
- Method

The overview will become a more memorable atlas entry point, with a geographic visual panel and report spine that supports the thesis. The map page will feel like the main command surface. Secondary pages will use stronger section rhythm and better panel hierarchy without adding unrelated content.

## Motion And Effects

Motion will communicate state and orientation:

- Page transitions: short opacity plus vertical settle.
- Buttons and tabs: small hover lift, active state, and focus ring.
- Map markers: selected pulse only, hover expansion, stronger but controlled shadow.
- Drawer: smooth slide with ease-out-expo behavior.
- Cards and rows: restrained hover elevation and border changes.
- Respect `prefers-reduced-motion`.

## Implementation Scope

Modify:

- `src/App.jsx`: add semantic class hooks and modest structure where the current Tailwind-only markup prevents stronger styling.
- `src/styles.css`: redesign surfaces, palette, motion, map, cards, hero, navigation, responsive behavior, and component states.

Avoid:

- Adding new dependencies.
- Rewriting data or translations.
- Replacing Google Maps behavior.
- Changing core navigation or investor selection logic.

## Verification

Run:

- `npm run build`

Inspect visually:

- Overview at desktop and mobile widths.
- Map page with and without Google Maps API fallback.
- Navigation, language menu, filter controls, drawer entry, selected markers, chart cards, and responsive collapse.

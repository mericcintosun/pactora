# IDENTITY (contract; every later phase obeys this file)

DIRECTION: D7 pressroom
GROUND: #f2efe8 newsprint
SURFACE: #eae6dc
DEEP: #dfdacd
LINE: #111111
INK: #111111
ACCENT: #d8261c signal-red
ON_ACCENT: #ffffff
SECOND: none
OK: #2e7d4f
WARN: #a8641c
BAD: #b3382c
FONT_DISPLAY: F8 Libre Caslon Text (next/font/google: Libre_Caslon_Text, weight: ["400", "700"] is required)
FONT_BODY: Libre Franklin (next/font/google: Libre_Franklin)
FONT_MONO: none
STRUCTURE: S2 landing-workspace
ARCHETYPE: L7 diagonal
MOTION: M3 scale, prefix pactora-
KIT: K7 flip
RADIUS: sharp
HEADER: solid ground, border-b in LINE, sticky
LOGO_POLICY: brand-mark

## Why

The farm assigned this identity so that no two projects share a look, a route map or an interaction style. The most recent projects it differs from: Open Agentic Web Challenge (D15, S3, L1, K2); Relate by Neo4j Hackathon (D20, S4, L6, K5); Build with CMC: API Hackathon (Plushie) (D2, S6, L5, K6). It is not a suggestion. Tie the product's own nouns to it; do not swap any row for a familiar one.

## Direction: D7 pressroom

Newsprint with true black and one signal red on a brutal grid.

Surface treatment: 2px solid black rules and borders, a strict visible column grid, headline bars in solid black with reversed type, signal red spent on one element per screen.

Every hex in app/globals.css comes from the key block above. RADIUS sharp means 0 to 0.125rem on every card, panel and control. ON_ACCENT is the text color on an ACCENT fill. The semantic colors (OK, WARN, BAD) mark state only, never brand.

## Structure: S2 landing-workspace

A story landing page that leads into a separate workspace, with shareable result pages.

Route map (name the bracketed parts with the product's own words):
- `/` : the landing page
- `/<verb>` : the workspace, named with the product's own verb (for example `/measure`, never `/app` or `/dashboard`)
- `/<verb>/[id]` : one result as its own shareable page
- `/how` : method and sponsor tech

Rules:
- the landing's one CTA opens the workspace with an example already loaded
- every result has its own URL and a share or copy-link control
- the header has at most three links plus the CTA

## Archetype: L7 diagonal (the composition of the home route)

The first screen is split by a diagonal or curved clip-path between the ground and an accent or surface block; the headline sits on one side and the live product on the other.

MUSTs: the split is a clip-path, not a rectangular grid; both halves use IDENTITY colors; mobile stacks the halves.
Bans: a straight vertical two-column grid at lg; a masked image wash.

## Motion: M3 scale (the entrance signature)

scale(0.96) to 1 plus fade, ease-out, 380ms. One keyframe block implements it; every keyframe name starts with `pactora-`. A `prefers-reduced-motion: reduce` block disables it.

## Interaction kit: K7 flip

AutoAnimate with Motion layout: lists that reorder and views that morph.

Packages for package.json dependencies: "@formkit/auto-animate": "^0.11.0", "motion": "^14.14.0".

Typical import: `import { useAutoAnimate } from "@formkit/auto-animate/react"; import { motion, LayoutGroup } from "motion/react";`

Signature interactions (the scaffold ships the first; all three exist by the end of the frontend phase):
1. auto-animated collections: adding, removing, filtering and reordering the seed records animates their positions (`useAutoAnimate`)
2. a view morph: clicking a record morphs it into its detail through `layoutId`
3. an inline sort or compare control that visibly reorders rows

Rules:
- the reorder is driven by real seed values, never a decorative shuffle
- add the packages above to package.json `dependencies` (and `devDependencies` where listed) with exactly these ranges; the runner installs them
- every import of a kit package lives in a component that starts with `"use client"`
- server HTML must be readable with JavaScript off: never server-render content at opacity 0 or off screen; animate from the visible state or on interaction
- honor `prefers-reduced-motion: reduce`: the content and every control stay usable with motion off
- every interaction is driven by the real seed data; a decorative animation with no product meaning does not count as a signature

## Amendments (append-only; later phases add dated lines here, never edit anything above)

- 2026-11-24 (phase 5): `app/globals.css` adds a second keyframe, `pactora-diagonal-in`, that eases the L7 clip-path from a slightly steeper angle on load with the M3 timing (380ms ease-out). The same `prefers-reduced-motion: reduce` block switches it off. The entrance itself is still only `pactora-scale-in`.

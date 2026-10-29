# Manual sweep, 28 and 29 October 2026

Every catalog guide is being rebuilt to follow its product's IKEA assembly manual: the same steps in the same order, the same parts, fittings and counts, the build poses the manual shows (lying on its back, upside down) and two people where it shows two. The drawings and words are our own.

**Status: 2,139 of 2,166 guides (99%) are built from their manuals; every guide builds.** The 27 left have no manual anywhere (discontinued products); they keep the old builder.

On 29 October every guide was also checked for impossible moves: a part sliding across dowels or cam bolts instead of along them, and screws or bolts that end in thin air. Those were fixed family by family; what the check still reports (about 190 guides) was looked at and is a false alarm (a frame that moves in one piece, a screw into a handle or the floor).

## How it works

- `src/lib/plan/families/<family>.ts`: one file per IKEA family (461 files). Each exports a `Family` (`family.ts`): a `recipe` (parts as boxes and steps, turned into a guide by `src/lib/plan/custom.ts`), a `build` drawn with `PlanBuilder`, and optionally a `row` for sets of frames. A family returns null for a product it doesn't cover, which keeps the old builder for that guide.
- `src/lib/plan/index.ts` asks the family first, then falls back to the kind's builder.
- `npm run families` rewrites `families/index.ts` from the files in the folder.
- New fitting kinds: clip, strap, nut, washer, stud, clamp, angle, foot, cap, spacer; fittings can carry their own name. New part material `glass`, half-disc pieces for split round tops.
- Product data: `src/data/fixes.ts` holds about 90 single-product corrections; `scripts/ikea/classify.ts` now reads corner sofas, bed frames, sofa-beds, office chairs and more from IKEA's measurements.

## To do next

- Record voice clips for the new step lines (`npm run voice -- --dry` first for the cost); until then, new lines are spoken live only for visitors with their own key.
- Re-render the share images (`scripts/og/render.mjs`), which still show the old models.
- Page weight: the family files are in the client bundle that every page loads (about 1.5 MB gzipped for that chunk). Load them only on guide pages, or per family.
- `npm run ikea:check` reports 7 guides with a part outside the product's listed size (KLIPPUGGLA, LILLEHEM, MORABO add-on, STORÅ full, VIHALS trundle): their sizes need checking.

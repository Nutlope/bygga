import type { CustomParams, CustomPart, CustomStep, ProductSpec, Vec3 } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";
import { buildCustom } from "../custom";
import { buildRow, type RowJoint } from "../row";
import { buildUnits, unitOf } from "../units";
import type { Family } from "./family";

/*
 * PAX, read from IKEA's frame manuals (the folding frame of 2024 onwards).
 *
 * The frame comes folded: two sides and a back in two halves, hinged together. Two people stand the pack up
 * against the wall, pull off the tapes and open it out. It stays standing from then on. Four feet clip onto the
 * bottoms of the sides, the back plinth drops into brackets on the back feet and the front plinth hooks onto the
 * front feet. Corner fittings go on at the top back, the top panel is lifted in from a stepladder and its pegs
 * slide into the sides, then the corner fittings are pushed up to lock it and two fittings at the front turn to
 * hold it. The feet are levelled, two dowels go into the front feet, the frame is fixed to the wall through the
 * corner fittings and the bottom panel is pressed in last.
 *
 * The 201.5 and 236.5 cm frames sold in the US hang on a wall rail instead: the rail is screwed to the wall first,
 * the corner fittings hook over it and are screwed to it, with no spacers.
 *
 * Wardrobes add the KOMPLEMENT clothes rail (two holders, four screws) and shelves on four pins each, and hinged
 * doors go on with KOMPLEMENT soft-closing hinges (three a door on 201 cm frames, four on 236 cm): screwed into
 * the door lying flat, then to the side, and two bumpers each. Sliding doors are drawn across a whole row by the
 * row builder.
 *
 * The add-on corner unit has its own manual and is the older flat pack: the sides take cam bolts, the top, bottom
 * and plinth dowels; one side is laid down, the others stood onto it, the cams turned, the second side put on from
 * above and four long bolts go through the sides into the bottom. Turned over, the back is nailed on, a joining
 * bracket is screwed across the top and the bottom, it is stood up and fixed to the wall, then the corner
 * fittings, bumpers and four shelves on pins go in.
 */

const t = 19; // sides, top and bottom
const bt = 8; // the two back halves
const PH = 70; // plinth height, from 10 mm off the floor

// fittings, sized so different ones stay apart in the list
const FOOT: HwDef = { kind: "foot", len: 60, dia: 30 };
const PLINTH_BRACKET: HwDef = { kind: "clamp", len: 30, dia: 16 };
const PLINTH_CLIP: HwDef = { kind: "clip", len: 20, dia: 18 };
const BOTTOM_CLIP: HwDef = { kind: "clip", len: 16, dia: 26 };
const CORNER: HwDef = { kind: "angle", len: 60, dia: 50 };
const FRONT_LOCK: HwDef = { kind: "connector", len: 40, dia: 20 };
const SPACER: HwDef = { kind: "stud", len: 30, dia: 14 };
const WASHER: HwDef = { kind: "washer", len: 1.5, dia: 20 };
const COVER: HwDef = { kind: "cap", len: 2, dia: 44 };
const WALL_SCREW: HwDef = { kind: "screw", len: 70, dia: 5, notIncluded: true };
// the US frame's own wall fixing, all in the box
const RAIL_SCREW: HwDef = { kind: "screw", len: 50, dia: 5 };
const RAIL_PLUG: HwDef = { kind: "plug", len: 40, dia: 8 };
const RAIL_WASHER: HwDef = { kind: "washer", len: 1.5, dia: 16 };
const LOCK_SCREW: HwDef = { kind: "screw", len: 14, dia: 6 };
const LOCK_RING: HwDef = { kind: "washer", len: 2, dia: 24 };
const LOCK_PLATE: HwDef = { kind: "clamp", len: 40, dia: 22 };
// KOMPLEMENT
const RAIL_HOLDER: HwDef = { kind: "clip", len: 14, dia: 32 };
const BUMPER: HwDef = { kind: "glide", len: 3, dia: 12 };

const WIDTHS = [50, 75, 100];

/** The US frames (201.5 and 236.5 cm) hang on a wall rail. */
const onRail = (s: ProductSpec) => /\b(201|236)\.5\b/.test(s.variant);

/**
 * A frame that is one of several in a row or a corner: its spec is narrower than the product the variant names.
 * Its wall fixing then waits until they all stand together, so it has to be the last step.
 */
function inRow(s: ProductSpec) {
  if (/corner wardrobe|wardrobe frames/i.test(s.variant)) return true;
  const m = /(\d+(?:\.\d+)?)\s*[×x]/.exec(s.variant);
  return !!m && Math.abs(Number(m[1]) - s.size.w) > 1;
}

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (!WIDTHS.includes(Math.round(s.size.w))) return false; // the add-on corner unit has its own manual
  if (/corner unit/i.test(s.variant)) return false;
  const W = s.size.w * 10, H = Math.round(s.size.h * 10), D = s.size.d * 10;
  const us = onRail(s);
  const row = inRow(s);
  const frameOnly = /wardrobe frame/i.test(s.variant);
  const cab = s.cabinet ?? {};
  const doors = Math.max(0, Math.min(2, cab.doors ?? 0));
  const shelves = frameOnly ? 0 : Math.max(0, Math.min(4, cab.shelves ?? 0));
  const rail = !frameOnly && !!cab.rail;

  // the frame is 58 (or 35) deep; hinged doors stand in front of it
  const fd = D >= 600 ? D - 20 : D;
  const zb = -D / 2, zf = zb + fd;
  const xi = W / 2 - t; // inner faces of the sides
  const bw = (W - 2 * t) / 2;
  const zIn = zb + bt; // front face of the back
  const inD = fd - bt; // depth inside, in front of the back
  const zMid = zIn + inD / 2;
  const yBot = 10 + PH; // underside of the bottom panel
  const sg = [-1, 1] as const;

  /* ---------- parts, where they sit in the finished frame ---------- */
  const sideT = b.part("Side panel", [t, H - 10, fd]);
  const sides = sg.map((x) => b.place(sideT, [x * (W / 2 - t / 2), 10 + (H - 10) / 2, zb + fd / 2]));
  const backT = b.part("Back panel", [bw, H - 10, bt]);
  const backs = sg.map((x) => b.place(backT, [(x * bw) / 2, 10 + (H - 10) / 2, zb + bt / 2]));
  const plinthT = b.part("Plinth", [W - 2 * t, PH, 16]);
  const zBackPlinth = zIn + 50, zFrontPlinth = zf - 28;
  const backPlinth = b.place(plinthT, [0, 10 + PH / 2, zBackPlinth]);
  const frontPlinth = b.place(plinthT, [0, 10 + PH / 2, zFrontPlinth]);
  const topT = b.part("Top panel", [W - 2 * t, t, inD]);
  const top = b.place(topT, [0, H - t / 2, zMid]);
  const bottomT = b.part("Bottom panel", [W - 2 * t, t, inD]);
  const bottom = b.place(bottomT, [0, yBot + t / 2, zMid]);
  const railY = H - 90;
  const wallRail = us ? b.place(b.part("Wall rail", [W - 2 * t - 40, 40, 10], { material: "metal" }), [0, railY, zb - 5]) : undefined;

  const footX = (x: number) => x * (xi - 17);
  const zFootF = zFrontPlinth - 8 - 22, zFootB = zBackPlinth + 8 + 22;
  const sideOf = (x: number) => sides[x < 0 ? 0 : 1];
  const both = (f: (x: -1 | 1) => FitOpts) => sg.map(f);

  /* ---------- the folded frame, opened out ---------- */
  const yc = 10 + (H - 10) / 2;
  const folded: [string, Vec3, Vec3][] = [
    [sides[0], [0, yc, zb + t / 2], [0, Math.PI / 2, 0]],
    [backs[0], [0, yc, zb + t + bt / 2], [0, 0, 0]],
    [backs[1], [0, yc, zb + t + bt * 1.5], [0, 0, 0]],
    [sides[1], [0, yc, zb + t + 2 * bt + t / 2], [0, -Math.PI / 2, 0]],
  ];
  const fin = (k: string) => b.partItem(k).final;
  const halfway = (k: string, p: Vec3, r: Vec3): [Vec3, Vec3] => {
    const f = fin(k);
    return [[(p[0] + f.pos[0]) / 2, p[1], (p[2] + f.pos[2]) / 2 + 60], [0, r[1] / 2, 0]];
  };

  if (us) railSteps(b, wallRail!, W, railY, zb);

  b.step(
    {
      title: "Stand the folded frame up against the wall",
      detail: "It comes folded in one piece. Lift it from lying flat together, with a cloth under the bottom edge.",
      people: 2,
      kind: "standup",
      warnings: ["two", "floor"],
    },
    () => {
      b.stagger(0);
      for (const [k, p, r] of folded) b.stage(k, p, r, [0, 0, 500]);
    },
  );
  b.step(
    { title: "Pull off the two tapes", detail: "Pull them upwards. Don't cut them: a knife would scratch the panels.", kind: "general" },
    () => {},
  );
  b.step(
    { title: "Unfold it together", detail: "One of you on each side. Open it slowly so it doesn't tip.", people: 2, kind: "general", warnings: ["two", "tip"] },
    () => {
      b.stagger(0);
      for (const [k, p, r] of folded) {
        const [hp, hr] = halfway(k, p, r);
        b.stage(k, hp, hr);
      }
    },
  );
  b.step(
    { title: "Open the sides out", detail: "Swing them out until they stand square to the back.", kind: "join" },
    () => {
      b.stagger(0);
      for (const [k] of folded) b.add(k);
    },
  );

  /* ---------- feet and plinths ---------- */
  b.step(
    { title: "Clip the four feet onto the sides", detail: "Screw each foot all the way up first, then push it onto the two pegs at the bottom of the side.", kind: "legs" },
    () => {
      const list: FitOpts[] = [];
      for (const x of sg) for (const z of [zFootB, zFootF]) list.push({ on: sideOf(x), at: [footX(x), 60, z], dir: [0, 1, 0], hole: false });
      b.fits(FOOT, list, 0.15);
    },
  );
  b.step(
    { title: "Clip a bracket onto each back foot", detail: "Push it on from the front, then down until it sits.", kind: "general" },
    () => {
      b.fits(PLINTH_BRACKET, both((x) => ({ on: sideOf(x), at: [footX(x), 66, zBackPlinth + 9], dir: [0, -1, 0], hole: false })), 0.2);
    },
  );
  b.step(
    { title: "Drop the back plinth into the brackets", detail: "Slide it down from above, behind both back feet.", kind: "join" },
    () => b.add(backPlinth, [0, 380, 0]),
  );
  b.step(
    {
      title: "Hook the front plinth onto the front feet",
      detail: "Check the frame stands square first. Push the plinth onto the feet, then press it down.",
      kind: "join",
      check: "square",
    },
    () => b.add(frontPlinth, [0, 0, 380]),
  );
  b.step(
    { title: "Push in the two plinth clips", detail: "One at each end, behind the front plinth.", kind: "general" },
    () => {
      b.fits(PLINTH_CLIP, both((x) => ({ on: frontPlinth, at: [x * (xi - 40), 50, zFrontPlinth - 8], dir: [0, 0, 1], hole: false })), 0.2);
    },
  );
  b.step(
    { title: "Clip two holders onto the back plinth", detail: "They sit over the top edge and hold the bottom panel later.", kind: "general" },
    () => {
      b.fits(BOTTOM_CLIP, both((x) => ({ on: backPlinth, at: [x * (W / 4), 10 + PH, zBackPlinth], dir: [0, -1, 0], hole: false })), 0.2);
    },
  );

  /* ---------- the top, and the wall ---------- */
  const cornerAt = (x: number): Vec3 => [x * xi, H - t - 45, zIn + 40];
  const corner = (x: -1 | 1): FitOpts => ({ on: sideOf(x), at: cornerAt(x), dir: [x, 0, 0], hole: false });
  const frontLock = (x: -1 | 1): FitOpts => ({ on: sideOf(x), at: [x * (xi - 18), H - t, zf - 40], dir: [0, 1, 0], hole: false });
  const wallX = (x: number) => x * (xi - 35);
  const wallY = H - t - 70;

  const cornerSteps = () => {
    b.step(
      { title: "Press the R corner fitting onto the right side", detail: "At the top, at the back. It clicks onto the two pegs.", kind: "general" },
      () => b.fit(CORNER, corner(1)),
    );
    b.step(
      { title: "Press the L corner fitting onto the left side", detail: "The same way, at the top of the left side.", kind: "general" },
      () => b.fit(CORNER, corner(-1)),
    );
  };
  const topStep = () =>
    b.step(
      {
        title: "Lift the top panel in from below",
        detail: us
          ? "One of you on a stepladder. Tilt it in, back edge first, then raise the front until the four pegs slide into the sides."
          : "Stand on a stepladder inside the frame. Tilt it in, back edge first, then raise the front until the four pegs slide into the sides.",
        kind: "join",
        people: us ? 2 : 1,
        warnings: us ? ["two"] : [],
      },
      () => b.add(top, [0, -420, 160]),
    );
  const pushUpStep = () =>
    b.step({ title: "Push both corner fittings up", detail: "Push hard until they lock under the top. The top should sit flush with the sides.", kind: "general" }, () => {});
  const levelStep = () =>
    b.step(
      { title: "Level the feet", detail: "Turn each foot with the Allen key through the hole in the bottom until the frame stands level.", tools: ["allen", "level"], kind: "legs" },
      () => {},
    );
  const dowelStep = () =>
    b.step({ title: "Push a dowel into each front foot", detail: "Into the hole on top of the foot. The bottom panel sits on them.", kind: "dowels" }, () => {
      b.fits(HW.dowel, both((x) => ({ on: frontPlinth, at: [footX(x), yBot, zFootF], dir: [0, -1, 0], hole: false, mate: bottom })), 0.2);
    });
  const coverFits = () => b.fits(COVER, both((x) => ({ on: sideOf(x), at: [wallX(x) + x * 5, H - t - 50, zIn + 52], dir: [0, 0, -1], hole: false })), 0.2);
  const coverStep = (detail: string) => b.step({ title: "Click the covers onto the corner fittings", detail, kind: "general" }, () => void coverFits());
  const bottomStep = () =>
    b.step({ title: "Press the bottom panel in", detail: "Lay it on the plinths and press down over the dowels until it sits flat.", kind: "join" }, () => b.add(bottom, [0, 300, 120]));

  if (us) {
    cornerSteps();
    b.step(
      { title: "Hook the frame onto the wall rail", detail: "Push it back to the wall so both corner fittings hook over the rail, then slide it sideways into place.", kind: "join", people: 2, warnings: ["two"], wall: true },
      () => {},
    );
    levelStep();
    dowelStep();
    b.step(
      { title: "Screw the corner fittings to the rail", detail: "A plate, a toothed ring and a screw in each. Leave them a little loose for now.", tools: ["screwdriver"], kind: "screws", wall: true },
      () => {
        const at = (x: number, dz: number): FitOpts => ({ on: sideOf(x), at: [wallX(x), wallY, zIn + dz], dir: [0, 0, -1], hole: false });
        b.fits(LOCK_PLATE, both((x) => at(x, 34)), 0.2);
        b.then(0.05);
        b.fits(LOCK_RING, both((x) => at(x, 36)), 0.2);
        b.then(0.05);
        b.fits(LOCK_SCREW, both((x) => at(x, 38)), 0.2);
      },
    );
    b.step({ title: "Push the two front fittings into the sides", detail: "One at the top front corner of each side, peg upwards.", kind: "general" }, () => {
      b.fits(FRONT_LOCK, both(frontLock), 0.2);
    });
    topStep();
    pushUpStep();
    b.step({ title: "Turn the front fittings to lock the top", detail: "Turn each one and press it up against the side.", kind: "general" }, () => {});
    b.step({ title: "Tighten the screws in the corner fittings", detail: "By hand with a screwdriver, not with a drill.", tools: ["screwdriver"], kind: "screws", wall: true }, () => {});
    coverStep("Hook the L cover on the left and the R cover on the right, then swing them shut until they click.");
    bottomStep();
    interior();
    if (doors) doorSteps();
    return true;
  }

  cornerSteps();
  topStep();
  pushUpStep();
  b.step(
    { title: "Lock the front of the top", detail: "Push a fitting into the hole under each front corner, turn it, then press it up against the side.", kind: "general" },
    () => {
      b.fits(FRONT_LOCK, both(frontLock), 0.2);
    },
  );
  levelStep();
  dowelStep();
  b.step({ title: "Screw a spacer into each corner fitting", detail: "Turn them out until they touch the wall, at most 22 mm, to clear a skirting board.", kind: "general" }, () => {
    b.fits(SPACER, both((x) => ({ on: sideOf(x), at: [wallX(x), H - t - 50, zIn + 30], dir: [0, 0, -1], hole: false })), 0.2);
  });
  const anchor = (title: string, withCovers: boolean) =>
    b.step(
      {
        title,
        detail: "Through the corner fittings, a washer on each screw. Wall screws and plugs aren't included: pick ones made for your wall.",
        tools: ["drill", "screwdriver", "pencil", "level"],
        kind: "anchor",
        wall: true,
        warnings: ["wall", "tip"],
      },
      () => {
        b.stagger(0.2);
        for (const x of sg) b.fit(HW.plug, { at: [wallX(x), wallY, zb - 20], dir: [0, 0, -1] });
        b.then(0.05);
        b.fits(WASHER, both((x) => ({ on: sideOf(x), at: [wallX(x), wallY, zIn + 36], dir: [0, 0, -1], hole: false })), 0.2);
        b.then(0.05);
        b.fits(WALL_SCREW, both((x) => ({ on: sideOf(x), at: [wallX(x), wallY, zIn + 37.5], dir: [0, 0, -1], hole: false })), 0.2);
        if (withCovers) {
          b.then(0.1);
          coverFits();
        }
      },
    );
  if (!row) {
    // a frame on its own: the manual's order, the wall fixing before the covers and the bottom
    anchor("Fix it to the wall", false);
    coverStep("Swing each one shut until it clicks.");
    bottomStep();
    interior();
    if (doors) doorSteps();
  } else {
    // in a row the frames are fixed once they all stand together, so that waits until last
    bottomStep();
    interior();
    if (doors) doorSteps();
    anchor("Fix it to the wall and click on the covers", true);
  }
  return true;

  /* ---------- KOMPLEMENT clothes rail and shelves ---------- */
  function interior() {
    if (rail) {
      const ry = H - t - 200, rz = zMid;
      const holders = sg.map((x) => ({ x, at: [x * xi, ry, rz] as Vec3 }));
      b.step(
        { title: "Screw the clothes rail holders to the sides", detail: "Opposite each other, near the top. Two screws in each.", tools: ["screwdriver"], kind: "screws" },
        () => {
          b.fits(RAIL_HOLDER, holders.map(({ x, at }) => ({ on: sideOf(x), at, dir: [x, 0, 0], hole: false })), 0.2);
          b.then(0.05);
          b.fits(HW.screwS, holders.flatMap(({ x, at }) => [-12, 12].map((dz): FitOpts => ({ on: sideOf(x), at: [at[0], at[1], at[2] + dz], dir: [x, 0, 0] }))), 0.08);
        },
      );
      const rod = b.place(b.part("Clothes rail", [25, W - 2 * t - 10, 25], { shape: "cyl", material: "metal" }), [0, ry - 16, rz], [0, 0, Math.PI / 2]);
      b.step({ title: "Click the clothes rail into the holders", detail: "Push each end in until it clicks.", kind: "join" }, () => b.add(rod, [0, -260, 0]));
    }
    if (shelves) {
      const st = 19;
      const shelfT = b.part("Shelf", [W - 2 * t - 4, st, inD - 20]);
      const lo = yBot + t;
      const ys = Array.from({ length: shelves }, (_, i) => (rail ? lo + 340 * (i + 1) : lo + ((H - t - lo) * (i + 1)) / (shelves + 1)));
      const keys = ys.map((y) => b.place(shelfT, [0, y + st / 2, zMid - 10]));
      b.step(
        {
          title: shelves > 1 ? "Push in the shelf pins and lay the shelves on them" : "Push in the shelf pins and lay the shelf on them",
          detail: "Four pins for each shelf, in the same hole at all four corners.",
          kind: "shelves",
        },
        () => {
          const pins: FitOpts[] = [];
          for (const y of ys) for (const x of sg) for (const z of [zIn + 50, zf - 50]) pins.push({ on: sideOf(x), at: [x * xi, y - 4, z], dir: [x, 0, 0], hole: false });
          b.fits(HW.pin, pins, 0.05);
          b.then(0.12);
          b.stagger(0.3);
          for (const k of keys) b.add(k, [0, 0, 380]);
        },
      );
    }
  }

  /* ---------- hinged doors on KOMPLEMENT soft-closing hinges ---------- */
  function doorSteps() {
    const dt = 20;
    const dh = H >= 2200 ? H - 70 : H - 62;
    const dw = doors === 2 ? W / 2 - 3 : W - 4;
    const dy = H - 2 - dh / 2;
    const doorT = b.part("Door", [dw, dh, dt]);
    // the left door hinges on the left side, the right one on the right; a single door on the left
    const list = Array.from({ length: doors }, (_, i) => {
      const x = doors === 2 ? (i === 0 ? -1 : 1) * (W / 4) : 0;
      const sgn: -1 | 1 = doors === 2 && i === 1 ? 1 : -1;
      return { key: b.place(doorT, [x, dy, zf + dt / 2]), sgn };
    });
    const hn = dh > 2000 ? 4 : 3;
    const hy = Array.from({ length: hn }, (_, i) => dy - dh / 2 + 110 + (i * (dh - 220)) / (hn - 1));
    const tall = dh > 1500;
    b.step(
      {
        title: doors > 1 ? "Screw the hinges into the doors" : "Screw the hinges into the door",
        detail: `Lay ${doors > 1 ? "each door" : "the door"} on something soft. ${hn} hinges a door, two screws each.`,
        tools: ["screwdriver"],
        scene: "doors",
        kind: "hinges",
        warnings: ["floor"],
      },
      () => {
        b.stagger(0.2);
        list.forEach(({ key }, i) => b.stage(key, [(i - (doors - 1) / 2) * (dw + 80), dt / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]));
        b.then(0.1);
        const hinges: FitOpts[] = [];
        const screws: FitOpts[] = [];
        for (const { key, sgn } of list) {
          const x = sgn * (W / 2 - 24);
          for (const y of hy) {
            hinges.push({ on: key, at: [x, y, zf], dir: [0, 0, 1], twist: sgn > 0 ? Math.PI : 0 });
            for (const d2 of [-24, 24]) screws.push({ on: key, at: [x + sgn * 4, y + d2, zf], dir: [0, 0, 1], hole: false });
          }
        }
        b.fits(HW.hinge, hinges, 0.1);
        b.then(0.05);
        b.fits(HW.screwS, screws, 0.03);
      },
    );
    b.step(
      {
        title: doors > 1 ? "Screw the doors to the sides" : "Screw the door to the side",
        detail: "Hold the door in place and screw each hinge plate to the front of the side, two screws each.",
        tools: ["screwdriver"],
        kind: "doors",
        people: tall ? 2 : 1,
        warnings: tall ? ["two"] : [],
      },
      () => {
        b.stagger(0.35);
        for (const { key } of list) b.add(key, [0, 0, 380]);
        b.then(0.1);
        const screws: FitOpts[] = [];
        for (const { sgn } of list) for (const y of hy) for (const d2 of [-16, 16]) screws.push({ on: sideOf(sgn), at: [sgn * xi, y + d2, zf - 37], dir: [sgn, 0, 0] });
        b.fits(HW.screwS, screws, 0.03);
      },
    );
    b.step(
      { title: "Line up the doors", detail: "Turn the screws on the hinges a little until the gaps look even.", tools: ["screwdriver"], kind: "doors" },
      () => {},
    );
    b.step(
      { title: "Stick on the bumpers", detail: "Two on the front edges of the frame for each door, where it closes against them.", kind: "general" },
      () => {
        const pads: FitOpts[] = [];
        for (const { key, sgn } of list) {
          const xFree = b.partItem(key).final.pos[0] - sgn * (dw / 2 - 40);
          pads.push({ on: top, at: [xFree, H - t / 2, zf], dir: [0, 0, -1], hole: false });
          pads.push({ on: bottom, at: [xFree, yBot + t / 2, zf], dir: [0, 0, -1], hole: false });
        }
        b.fits(BUMPER, pads, 0.15);
      },
    );
  }
}

/** The US frames: the wall rail goes up first, level, screwed to the wall with the plugs and screws in the box. */
function railSteps(b: PlanBuilder, rail: string, W: number, y: number, zb: number) {
  const xs = [-1, 1].map((x) => x * (W / 2 - 80));
  b.step(
    { title: "Click the end stops onto the wall rail", detail: "Fold the stop at each end over until it clicks.", scene: "prep", kind: "general" },
    () => b.stage(rail, [0, 20, 0], [0, 0, 0], [0, 160, 0]),
  );
  b.step(
    { title: "Mark where the rail goes on the wall", detail: "Measure up from the floor as the drawing shows and draw a level line.", tools: ["tape", "pencil", "level"], kind: "general", wall: true, warnings: ["wall"] },
    () => b.stage(rail, b.partItem(rail).final.pos, [0, 0, 0], [0, 0, 260]),
  );
  b.step(
    { title: "Drill the holes and push in the plugs", detail: "Use the drill bit for your wall. In a wooden stud, skip the plugs.", tools: ["drill"], kind: "general", wall: true, warnings: ["wall"] },
    () => {
      b.fits(RAIL_PLUG, xs.map((x) => ({ on: rail, at: [x, y, zb - 10] as Vec3, dir: [0, 0, -1] as Vec3, hole: false })), 0.2);
    },
  );
  b.step(
    { title: "Screw the rail to the wall", detail: "A washer on each screw. Check it is level before you tighten the second one.", tools: ["screwdriver", "level"], kind: "screws", wall: true, warnings: ["wall"] },
    () => {
      b.add(rail);
      b.then(0.05);
      b.fits(RAIL_WASHER, xs.map((x) => ({ on: rail, at: [x, y, zb] as Vec3, dir: [0, 0, -1] as Vec3, hole: false })), 0.2);
      b.then(0.05);
      b.fits(RAIL_SCREW, xs.map((x) => ({ on: rail, at: [x, y, zb + 1.5] as Vec3, dir: [0, 0, -1] as Vec3, hole: false })), 0.2);
    },
  );
}

/*
 * Frames side by side are joined as the frame manual's last page shows: clamp them together, drill 5 mm through
 * hole 5 of the front row near the top and near the bottom, and put a connecting screw in from one frame and a
 * barrel nut in from the other at each.
 */
const JOIN_SCREW: HwDef = { kind: "screw", len: 34, dia: 4.5, name: "Connecting screw" };
const BARREL_NUT: HwDef = { kind: "nut", len: 30, dia: 7, name: "Barrel nut" };
const JOINT: RowJoint = {
  ys: (H) => [H - t - 165, 10 + PH + t + 165],
  back: 37,
  fits: [{ def: JOIN_SCREW }, { def: BARREL_NUT, far: true }],
  title: "Screw the frames to each other",
  detail: "Clamp them together, fronts and tops in line. Drill 5 mm through hole 5 near the top and near the bottom, then a screw from one side and a barrel nut from the other in each.",
  tools: ["drill", "screwdriver"],
};

/** The add-on corner unit, from its own manual. In a corner wardrobe its wall fixing waits until last. */
function cornerUnit(s: ProductSpec, inSet: boolean): CustomParams {
  const W = s.size.w * 10, H = Math.round(s.size.h * 10), D = s.size.d * 10;
  const ct = 18, PH = 80;
  const xs = W / 2 - ct / 2, xi = W / 2 - ct;
  const zf = D / 2;
  const n = 4;
  const y0 = PH + ct, y1 = H - ct;
  const shelfY = (i: number) => Math.round(y0 + ((y1 - y0) * (i + 1)) / (n + 1));
  const parts: CustomPart[] = [
    { id: "SL", name: "Side panel", size: [ct, H, D], pos: [-xs, H / 2, 0] },
    { id: "SR", name: "Side panel", size: [ct, H, D], pos: [xs, H / 2, 0] },
    { id: "T", name: "Top panel", size: [W - 2 * ct, ct, D], pos: [0, H - ct / 2, 0] },
    { id: "B", name: "Bottom panel", size: [W - 2 * ct, ct, D], pos: [0, PH + ct / 2, 0] },
    { id: "P", name: "Plinth", size: [W - 2 * ct, PH, ct], pos: [0, PH / 2, zf - 30 - ct / 2] },
    { id: "K", name: "Back panel", size: [W, H, 3], pos: [0, H / 2, -D / 2 - 1.5], material: "fiber" },
    { id: "J1", name: "Joining bracket", size: [W - 2 * ct - 20, 2, 40], pos: [0, H + 1, zf - 30], material: "metal" },
    { id: "J2", name: "Joining bracket", size: [W - 2 * ct - 20, 2, 40], pos: [0, y0 + 1, zf - 30], material: "metal" },
  ];
  for (let i = 0; i < n; i++) parts.push({ id: `S${i}`, name: "Shelf", size: [W - 2 * ct - 4, ct, D - 20], pos: [0, shelfY(i), 10] });
  const sg = [-1, 1];
  const boltZ = [-D / 4, D / 4];
  const wallX = [-(xi - 60), xi - 60];
  const wallStep: CustomStep = {
    title: "Fix it to the wall",
    detail: "Screw the two wall brackets under the top at the back, then screw them to the wall. Wall screws and plugs aren't included: pick ones made for your wall.",
    kind: "anchor",
    wall: true,
    fix: [
      { kind: "bracket", count: 2, at: wallX.map((x): Vec3 => [x, H - ct, -D / 2 + 20]), dir: [0, 1, 0], on: "T" },
      { kind: "plug", count: 2, len: 35, dia: 8, at: wallX.map((x): Vec3 => [x, H - 60, -D / 2 - 40]), dir: [0, 0, -1] },
      { kind: "screw", count: 2, len: 50, dia: 5, at: wallX.map((x): Vec3 => [x, H - 60, -D / 2 - 3]), dir: [0, 0, -1] },
    ],
    tools: ["drill", "screwdriver", "pencil"],
    warnings: ["wall", "tip"],
  };
  const steps: CustomStep[] = [
    {
      title: "Screw the two feet under the bottom panel",
      detail: "Tap the two T-nuts into the holes near the front edge first, then screw the feet in.",
      fix: [{ kind: "foot", count: 2, len: 50, dia: 30, at: sg.map((x): Vec3 => [x * (xi - 60), PH, zf - 90]), dir: [0, 1, 0], on: "B" }],
      wait: ["B"],
      from: { B: [500, 0, 0] },
      tools: ["hammer"],
    },
    {
      title: "Screw the cam bolts into the sides",
      detail: "Into the holes at the top and the bottom, by hand until they stop.",
      fix: [{ kind: "camScrew", count: 8, to: ["SL", "SR"] }],
      wait: ["SL", "SR"],
      // they wait out to the sides, so they only ever move along their bolts and dowels
      from: { SL: [-500, 0, 0], SR: [900, 0, 0] },
    },
    {
      title: "Tap the dowels into the top, bottom and plinth",
      detail: "Into the holes in their ends, all the way in.",
      fix: [
        { id: "T", y: H - ct / 2, zs: [-D / 2 + 40, zf - 40] },
        { id: "B", y: PH + ct / 2, zs: [-D / 2 + 35, 0, zf - 35] },
        { id: "P", y: 0, zs: [] },
      ].flatMap(({ id, y, zs }) =>
        sg.map((x) => {
          const at: Vec3[] = id === "P" ? [20, PH - 20].map((py): Vec3 => [x * xi, py, zf - 30 - ct / 2]) : zs.map((z): Vec3 => [x * xi, y, z]);
          return { kind: "dowel" as const, count: at.length, len: 30, dia: 8, at, dir: [-x, 0, 0] as Vec3, on: id };
        }),
      ),
      wait: ["T", "B", "P"],
      from: { T: [500, 0, 0], B: [500, 0, 0], P: [500, 0, 0] },
      tools: ["hammer"],
    },
    {
      title: "Lay a side down and stand the panels on it",
      detail: "On a rug, holes up. Stand the top, the bottom and the plinth on its dowels.",
      add: ["SL", "T", "B", "P"],
      pose: "+x",
      warnings: ["floor"],
    },
    { title: "Turn the cams to lock them", detail: "Drop each cam in with the arrow towards the bolt and turn it clockwise.", fix: [{ kind: "cam", count: 8, to: ["T", "B", "P"] }] },
    {
      title: "Put the other side on",
      detail: "Lower it onto the dowels from above, then lock its cams the same way.",
      add: ["SR"],
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Bolt the sides to the bottom",
      detail: "Two long bolts through each side into the ends of the bottom panel.",
      fix: sg.map((x) => ({ kind: "bolt", count: 2, len: 50, dia: 7, at: boltZ.map((z): Vec3 => [x * (W / 2), PH + ct / 2, z]), dir: [-x, 0, 0] as Vec3, on: x < 0 ? "SL" : "SR" })),
      tools: ["allen"],
    },
    {
      title: "Turn it over and nail the back on",
      detail: "Lay it on its front, check it's square and nail the back to all the edges.",
      add: ["K"],
      fix: [{ kind: "nail", count: 47, to: ["K"] }],
      pose: "-z",
      check: "square",
    },
    {
      title: "Screw a joining bracket across the top and the bottom",
      detail: "Along the front edge, three screws each. They join it to the wardrobe beside it later.",
      add: ["J1", "J2"],
      fix: [{ kind: "screw", count: 6, len: 12, dia: 4, at: [H + 2, y0 + 2].flatMap((y) => [-150, 0, 150].map((x): Vec3 => [x, y, zf - 30])), dir: [0, -1, 0] }],
    },
    { title: "Stand it up together", detail: "Lift it from the top end and walk it up, with a cloth under the bottom edge.", pose: "+y", people: 2, kind: "standup", warnings: ["two", "floor"] },
  ];
  if (!inSet) steps.push(wallStep, { title: "Screw it to the wardrobe beside it", detail: "Push it against the side of the next frame, fronts in line, and screw the joining brackets into it.", tools: ["screwdriver"] });
  steps.push(
    {
      title: "Click in the four corner fittings",
      detail: "Two on the inside of each side at the front, near the top and near the bottom. They hold the corner doors.",
      fix: sg.map((x) => ({ kind: "clip", name: "Corner fitting", count: 2, len: 20, dia: 30, at: [y0 + 200, H - 200].map((y): Vec3 => [x * xi, y, zf - 20]), dir: [x, 0, 0] as Vec3, on: x < 0 ? "SL" : "SR" })),
    },
    {
      title: "Press on the four bumpers",
      detail: "On the front edges of the sides, near the top and near the bottom.",
      fix: [{ kind: "glide", count: 4, len: 3, dia: 12, at: sg.flatMap((x) => [y0 + 100, H - 100].map((y): Vec3 => [x * xs, y, zf])), dir: [0, 0, -1] }],
    },
    {
      title: "Push in the pins and lay the shelves on",
      detail: "Four pins a shelf, at the same height on both sides.",
      add: parts.filter((p) => p.name === "Shelf").map((p) => p.id),
      fix: [{ kind: "pin", count: 16, to: ["SL", "SR"] }],
    },
  );
  if (inSet) steps.push(wallStep);
  return { parts, steps };
}

/** A frame of a row: a PAX frame, or the add-on corner unit from its own manual. */
function frame(b: PlanBuilder, s: ProductSpec) {
  if (unitOf(s)?.corner || /corner unit/i.test(s.variant)) buildCustom(b, { ...s, custom: cornerUnit(s, !!unitOf(s)) });
  else build(b, s);
}

const family: Family = {
  names: ["PAX"],
  build(b, s) {
    // the add-on corner unit has its own manual
    if (unitOf(s)?.corner || /corner unit/i.test(s.variant)) {
      buildCustom(b, { ...s, custom: cornerUnit(s, !!unitOf(s)) });
      return true;
    }
    return build(b, s);
  },
  row(b, s) {
    if (!s.row) return false;
    if (s.row.units) buildUnits(b, s, frame, { joint: JOINT });
    else buildRow(b, s, frame, { joint: JOINT });
    return true;
  },
};
export default family;

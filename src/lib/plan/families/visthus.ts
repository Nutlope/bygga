import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, HwKind, ProductSpec, Vec3 } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/*
 * VISTHUS, read from IKEA's manuals for the chest of 6 drawers and the wardrobe.
 *
 * The carcass is built lying on its front. Cabinet runners are screwed onto the sides and dividers while they lie
 * flat, the fixed shelves click into one side on their factory-fitted connectors, the other side clicks on, and the
 * top (with the divider clicked into it) closes the end. Long screws hold the divider, the hardboard back slides down
 * the grooves and is held with plastic plugs and pins, the wall brackets go into the top and the adjustable feet into
 * the sides. Stood up, it is levelled with the spanner and screwed to the wall. The drawers are built on their fronts:
 * the sides click on, the bottom slides down the grooves, the back goes on with push-in pins and cam locks, then the
 * runners (or, for the bottom drawers, castors) and a grip on the top edge of the front.
 */

const T = 18;
const S = [-1, 1];
const pt = (x: number, y: number, z: number): Vec3 => [x, y, z];
const fx = (kind: HwKind, at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });

/* ---------------------------------------------------------------- shared carcass bits */

/** A cabinet runner on the face of a panel at x (dir points into the panel), with its three screws. */
const runner = (on: string, x: number, y: number, d: number, z: number): CustomFix[] => [
  fx("runner", [pt(x, y, z)], [d, 0, 0], { len: 400, dia: 30, name: "Cabinet runner", on }),
  fx("screw", [-160, 0, 160].map((dz) => pt(x, y, z + dz)), [d, 0, 0], { len: 12, dia: 4, on }),
];

/** Plastic plugs pushed through the back into the edges of the shelves, then a pin into each. */
const backFix = (pts: Vec3[], on: string): CustomStep[] => [
  { title: "Push the plugs through the back", detail: `${pts.length} plastic plugs, into the holes over the fixed shelves.`, fix: [fx("clip", pts, [0, 0, 1], { name: "Back plug", len: 14, dia: 10, on })] },
  { title: "Push a pin into each plug", detail: "Press them in until the heads sit flat. That spreads the plug and holds the back.", fix: [fx("clip", pts.map((p) => pt(p[0], p[1], p[2] - 0.5)), [0, 0, 1], { name: "Back pin", len: 16, dia: 6, on })] },
];

/** Leveling, then the wall fixing: spacers, mark, drill, then a screw and washer through each bracket. */
function wallSteps(o: { xs: number[]; y: number; zBack: number; feet: number }): CustomStep[] {
  const { xs, y, zBack } = o;
  return [
    {
      title: "Screw the spacers onto the brackets if you need them",
      detail: "Only when a skirting board keeps it off the wall: they hold the top as far out as the bottom.",
      fix: [fx("spacer", xs.map((x) => pt(x, y, zBack - 2)), [0, 0, 1], { name: "Wall spacer", len: 20, dia: 30 })],
      warnings: ["wall"],
    },
    {
      title: "Push it to the wall and level it",
      detail: `Turn the ${o.feet} feet with the spanner until it stands level and steady.`,
      tools: ["wrench", "level"],
      kind: "legs",
    },
    { title: "Mark the holes through the brackets", detail: "Read the safety leaflet first. Mark through both brackets, then move it away.", tools: ["pencil"], warnings: ["wall", "tip"], wall: true },
    {
      title: "Drill and plug the holes",
      detail: "The plugs in the box are for solid walls. For other walls, use fixings made for them.",
      fix: [fx("plug", xs.map((x) => pt(x, y, zBack - 22)), [0, 0, -1], { included: true })],
      tools: ["drill"],
      wall: true,
    },
    {
      title: "Screw it to the wall",
      detail: "Push it back, then a screw with a washer through each bracket. Click a cover cap over each screw head.",
      fix: [
        fx("washer", xs.map((x) => pt(x, y, zBack - 6)), [0, 0, -1], { included: true }),
        fx("screw", xs.map((x) => pt(x, y, zBack - 6)), [0, 0, -1], { len: 50, dia: 5, included: true }),
        fx("cap", xs.map((x) => pt(x, y, zBack - 8)), [0, 0, -1], { name: "Cover cap", len: 8, dia: 22 }),
      ],
      tools: ["screwdriver"],
      wall: true,
      warnings: ["wall", "tip"],
    },
  ];
}

/* ---------------------------------------------------------------- drawers */

const D_PIN: HwDef = { kind: "camScrew", len: 34, dia: 8, name: "Cam pin" };
const D_CAM: HwDef = { kind: "cam", len: 12, dia: 15 };
const D_RUNNER: HwDef = { kind: "runner", len: 400, dia: 30, name: "Drawer runner" };
const D_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };
const D_GRIP: HwDef = { kind: "handle", len: 40, dia: 20, name: "Grip" };
const D_GRIP_SCREW: HwDef = { kind: "screw", len: 12, dia: 4, name: "Grip screw" };
const D_CLIP: HwDef = { kind: "clip", len: 20, dia: 30, name: "Front clip" };
const D_CASTOR: HwDef = { kind: "castor", len: 40, dia: 40 };
const D_CASTOR_SCREW: HwDef = { kind: "screw", len: 12, dia: 3.5 };
const D_LONG: HwDef = { kind: "bolt", len: 50, dia: 6, name: "Long connecting screw" };
const D_STOP: HwDef = { kind: "cap", len: 8, dia: 10, name: "Bumper" };

interface Drawer {
  front: string;
  sides: string[];
  back: string;
  bottom: string;
  cx: number;
  fcx: number; // centre of the front, which covers the divider's edge
  y0: number; // underside of the box
  bh: number;
  bw: number;
  zf: number; // back face of the front
  zb: number; // back face of the drawer back
  fy: number;
  fh: number;
  fw: number;
  castor: boolean;
}

/** A drawer whose front spans x cx±fw/2, y fy0..fy1, face at zFace; the box `dd` deep in an opening `ow` wide from `yb`. */
function drawer(b: PlanBuilder, types: Map<string, string>, o: { cx: number; fcx?: number; fw: number; fy0: number; fy1: number; zFace: number; ow: number; yb: number; dd: number; bh: number; castor?: boolean }): Drawer {
  const type = (name: string, size: Vec3, material?: "fiber") => {
    const k = `${name}|${size.map(Math.round).join("x")}`;
    let t = types.get(k);
    if (!t) types.set(k, (t = b.part(name, size, { material })));
    return t;
  };
  const castor = o.castor ?? false;
  const fh = o.fy1 - o.fy0, fy = (o.fy0 + o.fy1) / 2;
  const zf = o.zFace - T;
  const bw = castor ? o.ow - 10 : o.ow - 26;
  const y0 = castor ? 41 : o.yb + 15;
  const zb = zf - o.dd;
  const fcx = o.fcx ?? o.cx;
  const front = b.place(type("Drawer front", [o.fw, fh, T]), [fcx, fy, o.zFace - T / 2]);
  const sides = S.map((g) => b.place(type("Drawer side", [12, o.bh, o.dd]), [o.cx + g * (bw / 2 - 6), y0 + o.bh / 2, zb + o.dd / 2]));
  // the back sits between the sides, above the bottom
  const lift = castor ? 22 : 14;
  const back = b.place(type("Drawer back", [bw - 24, o.bh - lift, 12]), [o.cx, y0 + lift + (o.bh - lift) / 2, zb + 6]);
  const bottom = castor
    ? b.place(type("Drawer bottom", [bw - 16, 16, o.dd - 4]), [o.cx, y0 + 12, zb + 2 + (o.dd - 4) / 2])
    : b.place(type("Drawer bottom", [bw - 16, 3, o.dd - 2], "fiber"), [o.cx, y0 + 10, zb + 1 + (o.dd - 2) / 2]);
  return { front, sides, back, bottom, cx: o.cx, fcx, y0, bh: o.bh, bw, zf, zb, fy, fh, fw: o.fw, castor };
}

function drawerFits(d: Drawer) {
  const xs = d.bw / 2;
  const lift = d.castor ? 22 : 14;
  const ys = [d.y0 + lift + 25, d.y0 + d.bh - 25];
  const side = (g: number) => d.sides[g < 0 ? 0 : 1];
  const fTop = d.fy + d.fh / 2;
  const cz = [d.zb + 50, d.zb + 200, d.zf - 50];
  return {
    clips: !d.castor ? [] : S.map((g): FitOpts => ({ on: side(g), at: [d.cx + g * (xs - 6), d.y0 + d.bh / 2, d.zf], dir: [0, 0, -1], hole: false })),
    pins: S.flatMap((g) => ys.map((y): FitOpts => ({ on: side(g), at: [d.cx + g * xs, y, d.zb + 6], dir: [-g, 0, 0], mate: d.back }))),
    cams: S.flatMap((g) => ys.map((y): FitOpts => ({ on: d.back, at: [d.cx + g * (xs - 12 - 28), y, d.zb], dir: [0, 0, 1] }))),
    castors: !d.castor ? [] : S.flatMap((g) => [d.zb + 60, d.zf - 60].map((z): FitOpts => ({ on: d.bottom, at: [d.cx + g * (xs - 70), d.y0 + 4, z], dir: [0, 1, 0], hole: false }))),
    castorScrews: !d.castor ? [] : S.flatMap((g) => [d.zb + 60, d.zf - 60].flatMap((z) => [-14, 14].map((dz): FitOpts => ({ on: d.bottom, at: [d.cx + g * (xs - 70), d.y0 + 4, z + dz], dir: [0, 1, 0] })))),
    longScrews: !d.castor ? [] : S.flatMap((g) => [d.zb + 80, d.zf - 80].map((z): FitOpts => ({ on: side(g), at: [d.cx + g * xs, d.y0 + 12, z], dir: [-g, 0, 0], mate: d.bottom }))),
    runners: d.castor ? [] : S.map((g): FitOpts => ({ on: side(g), at: [d.cx + g * xs, d.y0 + 12, (d.zb + d.zf) / 2], dir: [-g, 0, 0], hole: false })),
    runnerScrews: d.castor ? [] : S.flatMap((g) => cz.map((z): FitOpts => ({ on: side(g), at: [d.cx + g * xs, d.y0 + 12, z], dir: [-g, 0, 0] }))),
    grip: [{ on: d.front, at: [d.fcx, fTop, d.zf + T - 6], dir: [0, -1, 0], hole: false } as FitOpts],
    gripScrew: [{ on: d.front, at: [d.fcx, fTop - 12, d.zf], dir: [0, 0, 1] } as FitOpts],
    stops: d.castor ? S.map((g): FitOpts => ({ on: d.front, at: [d.cx + g * (d.fw / 2 - 12), d.fy - d.fh / 2 + 40, d.zf], dir: [0, 0, 1] })) : [],
  };
}

type Fits = ReturnType<typeof drawerFits>;
const FIT_DEFS: [keyof Fits, HwDef][] = [
  ["clips", D_CLIP],
  ["pins", D_PIN],
  ["cams", D_CAM],
  ["castors", D_CASTOR],
  ["castorScrews", D_CASTOR_SCREW],
  ["longScrews", D_LONG],
  ["runners", D_RUNNER],
  ["runnerScrews", D_SCREW],
  ["grip", D_GRIP],
  ["gripScrew", D_GRIP_SCREW],
  ["stops", D_STOP],
];

/** The steps of one kind of drawer, shown on the first and repeated for the rest. */
function drawerSteps(b: PlanBuilder, ds: Drawer[], o: { scene: string; label: string; clips?: boolean }) {
  if (!ds.length) return;
  const d0 = ds[0];
  const f = drawerFits(d0);
  const base: Vec3 = [d0.cx, d0.fy - d0.fh / 2, 0];
  const rel = (k: string, dx = 0): Vec3 => {
    const p = b.partItem(k).final.pos;
    return [p[0] - base[0] + dx, p[1] - base[1], p[2]];
  };
  const stage = (k: string, from?: Vec3) => b.stage(k, rel(k), [0, 0, 0], from);
  const sc = { scene: o.scene, repeat: ds.length > 1 ? ds.length : undefined };
  const on = { ...sc, pose: "-z" as const };
  if (o.clips)
    b.step({ title: "Tap the clips into the sides", detail: "One into the front end of each side, gently with a hammer.", kind: "general", tools: ["hammer"], warnings: ["floor"], ...sc }, () => {
      for (const k of d0.sides) stage(k, [0, 160, 0]);
      b.then(0.1);
      b.fits(D_CLIP, f.clips, 0.12);
    });
  b.step({ title: `Click the sides onto the ${o.label} front`, detail: "Lay the front face down on a rug. Slide each side into its connectors, then press it down until it clicks.", kind: "join", warnings: ["floor"], ...on }, () => {
    stage(d0.front, [0, 0, -160]);
    b.then(0.1);
    for (const k of d0.sides) stage(k, [0, 0, -300]);
  });
  if (d0.castor) {
    b.step({ title: "Put the back on", detail: "Lay it between the ends of the sides, cam holes facing out.", kind: "join", ...on }, () => stage(d0.back, [0, 0, -260]));
  } else {
    b.step({ title: "Slide in the drawer bottom", detail: "Smooth side in, down the grooves until it reaches the front.", kind: "join", ...on }, () => stage(d0.bottom, [0, 0, -420]));
    b.step({ title: "Put the back on", detail: "The notch in its edge goes over the drawer bottom.", kind: "join", ...on }, () => stage(d0.back, [0, 0, -260]));
  }
  b.step({ title: "Push the cam pins in", detail: "Four, through the sides into the ends of the back.", kind: "cams", ...on }, () => b.fits(D_PIN, f.pins, 0.08));
  b.step({ title: "Lock the cam locks", detail: "Four, in the back. Turn each clockwise until it grips its pin.", kind: "cams", tools: ["screwdriver"], ...on }, () => b.fits(D_CAM, f.cams, 0.08));
  if (d0.castor) {
    b.step({ title: "Screw the castors onto the bottom", detail: "Four castors, two screws each, near the corners.", kind: "screws", tools: ["screwdriver"], ...sc }, () => {
      b.stage(d0.bottom, rel(d0.bottom, d0.bw + 160), [0, 0, 0], [0, 160, 0]);
      b.then(0.1);
      b.fits(D_CASTOR, f.castors, 0.12);
      b.then(0.05);
      b.fits(D_CASTOR_SCREW, f.castorScrews, 0.04);
    });
    b.step({ title: "Slide the bottom in", detail: "Castors out, down the grooves until it reaches the front.", kind: "join", ...on }, () => stage(d0.bottom, [0, 0, -420]));
    b.step({ title: "Screw the bottom to the sides", detail: "Four long screws with the Allen key, two through each side.", kind: "bolts", tools: ["allen"], ...on }, () => b.fits(D_LONG, f.longScrews, 0.1));
  } else {
    b.step({ title: "Screw the runners onto the drawer", detail: "Along the bottom edge of each side, wheel at the back. Three screws each.", kind: "runners", tools: ["screwdriver"], ...on }, () => {
      b.fits(D_RUNNER, f.runners, 0.15);
      b.then(0.05);
      b.fits(D_SCREW, f.runnerScrews, 0.05);
    });
  }
  b.step({ title: "Turn it over and fit the grip", detail: "Hook the grip over the top edge of the front and screw it from the inside, with its washer.", kind: "screws", tools: ["screwdriver"], ...sc }, () => {
    b.fits(D_GRIP, f.grip, 0.1);
    b.then(0.05);
    b.fits(D_GRIP_SCREW, f.gripScrew, 0.1);
  });
  if (d0.castor)
    b.step({ title: "Push in the two bumpers", detail: "Into the holes low on the back of the front, one near each end.", kind: "general", ...sc }, () => b.fits(D_STOP, f.stops, 0.1));
  if (ds.length > 1) {
    const n = ds.length - 1;
    b.step({ title: n === 1 ? `Build the other ${o.label} drawer` : `Build the other ${n} ${o.label} drawers`, detail: "Each one goes together like the first.", kind: "drawer", scene: o.scene }, () => {
      b.stagger(0.12);
      ds.slice(1).forEach((d, i) => {
        const dx = (i + 1) * (d0.fw + 120);
        for (const k of [d.front, ...d.sides, d.back, d.bottom]) {
          const p = b.partItem(k).final.pos;
          b.stage(k, [p[0] - d.cx + dx, p[1] - (d.fy - d.fh / 2), p[2]], [0, 0, 0]);
        }
        const fd = drawerFits(d);
        for (const [key, def] of FIT_DEFS) for (const x of fd[key]) b.preset(def, x);
      });
    });
  }
}

function drawersIn(b: PlanBuilder, groups: Drawer[][], title: string, detail: string) {
  b.step({ title, detail, kind: "drawer", warnings: ["tip"] }, () => {
    for (const g of groups)
      for (const d of g) {
        b.stagger(0);
        for (const k of [d.front, ...d.sides, d.back, d.bottom]) b.add(k, [0, 0, 520]);
        b.wait(0.15);
      }
  });
}

/* ---------------------------------------------------------------- chest of 6 drawers */

function chest(b: PlanBuilder, s: ProductSpec) {
  const W = 630, H = 1260, D = 490, F = 10;
  const xo = W / 2 - 3 - T / 2, xi = W / 2 - 3 - T;
  const yt = H - T; // underside of the top
  const zb = -D / 2, zf = D / 2 - 4; // back and front edges of the sides
  const zBk = zb + 10; // the back, in its grooves
  const z0 = zBk + 1.5, z1 = zf - T - 2; // shelves and divider run between these
  const sd = z1 - z0, sz = (z0 + z1) / 2;
  const yB = 300, yA = 612, yL = 928; // lower fixed shelf, middle fixed shelf, loose shelves (undersides)
  const LT = 16;
  const ru = (y: number) => y + 30; // runner height in an opening from y
  const rz = zf - T - 210;
  const parts: CustomPart[] = [
    { id: "SR", name: "Side", size: [T, yt - F, D - 4], pos: [xo, (yt + F) / 2, (zb + zf) / 2] },
    { id: "SL", name: "Side", size: [T, yt - F, D - 4], pos: [-xo, (yt + F) / 2, (zb + zf) / 2] },
    { id: "DV", name: "Divider", size: [T, yt - yA - T, sd], pos: [0, (yt + yA + T) / 2, sz] },
    { id: "SB", name: "Fixed shelf", size: [2 * xi, T, sd], pos: [0, yB + T / 2, sz] },
    { id: "SA", name: "Fixed shelf", size: [2 * xi, T, sd], pos: [0, yA + T / 2, sz] },
    { id: "TP", name: "Top", size: [W, T, D], pos: [0, H - T / 2, 0] },
    { id: "BK", name: "Back panel", size: [2 * xi + 2, yt - F - 8, 3], pos: [0, (yt + F + 8) / 2, zBk], material: "fiber" },
    ...S.map((g, i): CustomPart => ({ id: `L${i}`, name: "Shelf", size: [xi - T / 2 - 2, LT, sd - 14], pos: [g * (xi + T / 2) / 2, yL + LT / 2, sz - 7] })),
  ];
  const small = [yA + T, yL + LT];
  const plugs = [yB, yA].flatMap((y) => [-150, 150].map((x) => pt(x, y + T / 2, zBk - 1.5)));
  const feet = S.flatMap((g) => [zb + 40, zf - 40].map((z) => pt(g * xo, F, z)));
  const bx = [-200, 200];
  const steps: CustomStep[] = [
    {
      title: "Screw on the right-hand runners",
      detail: "Lay the right side and the divider on a rug, inside up. Three runners on the side, two on the divider, three screws each.",
      add: ["SR"],
      fix: [...[yB + T, ...small].flatMap((y) => runner("SR", xi, ru(y), 1, rz)), ...small.flatMap((y) => runner("DV", T / 2, ru(y), -1, rz))],
      wait: ["DV"],
      tools: ["screwdriver"],
      pose: "-z",
      warnings: ["floor"],
    },
    {
      title: "Turn the divider over and screw on the left-hand runners",
      detail: "The marks on the runners show left and right. Three on the left side, two on the divider.",
      fix: [...[yB + T, ...small].flatMap((y) => runner("SL", -xi, ru(y), -1, rz)), ...small.flatMap((y) => runner("DV", -T / 2, ru(y), 1, rz))],
      wait: ["SL"],
      tools: ["screwdriver"],
    },
    { title: "Click the fixed shelves into the right side", detail: "Stand the side on its front edge. Slide each shelf onto its connectors, then press it down until it clicks.", add: ["SB", "SA"], from: { SB: [-400, 0, 0], SA: [-400, 0, 0] } },
    { title: "Click the left side on", detail: "Onto the other ends of the shelves, then press down along the joints.", add: ["SL"], from: { SL: [-400, 0, 0] } },
    {
      title: "Click the divider into the top and fit them on",
      detail: "Divider first, into the middle of the top. Then slide the top onto the ends of the sides, divider between them, until it clicks.",
      add: ["DV", "TP"],
      from: { DV: [0, 600, 0], TP: [0, 600, 0] },
    },
    { title: "Screw the shelf to the divider", detail: "Two long screws with the Allen key, up through the middle shelf into the divider.", fix: [fx("bolt", [z0 + 120, z1 - 120].map((z) => pt(0, yA, z)), [0, 1, 0], { len: 70, dia: 6, name: "Long connecting screw", on: "SA", mate: "DV" })], tools: ["allen"] },
    { title: "Slide the back panel in", detail: "Smooth side in, from the bottom end along the grooves, until it sits in the groove of the top.", add: ["BK"], from: { BK: [0, -1300, 0] } },
    ...backFix(plugs, "BK"),
    { title: "Screw the wall brackets into the top", detail: "Two, into the holes in the back edge of the top.", fix: [fx("angle", bx.map((x) => pt(x, H - T / 2, zb)), [0, 0, 1], { name: "Wall bracket", len: 40, dia: 30, on: "TP" })], tools: ["screwdriver"] },
    { title: "Screw in the feet", detail: "Four, into the bottom ends of the sides. Turn each in by hand.", fix: [fx("foot", feet, [0, 1, 0], { name: "Adjustable foot", len: 20, dia: 30 })] },
    { title: "Stand it up", detail: "Lift it upright, near the wall where it will stand.", pose: "+y", people: 2 },
    ...wallSteps({ xs: bx, y: H - T / 2, zBack: zb, feet: 4 }),
    {
      title: "Push in the shelf supports",
      detail: "Eight, in the holes halfway up the top compartments: four on each side of the divider.",
      fix: [0, 1].flatMap((i) => {
        const g = S[i], x0 = g * T / 2, x1 = g * xi;
        return [fx("pin", [z0 + 50, z1 - 50].map((z) => pt(x0, yL - 4, z)), [-g, 0, 0], { name: "Shelf support", len: 14, dia: 10 }), fx("pin", [z0 + 50, z1 - 50].map((z) => pt(x1, yL - 4, z)), [g, 0, 0], { name: "Shelf support", len: 14, dia: 10 })];
      }),
    },
    { title: "Lay the shelves on the supports", detail: "One in each top compartment, pushed down over the supports.", add: ["L0", "L1"], from: { L0: [0, 0, 400], L1: [0, 0, 400] } },
  ];
  buildCustom(b, { ...s, custom: { parts, steps } });
  const types = new Map<string, string>();
  const dd = 400;
  const half = (xi - T / 2) / 2;
  const bottom = drawer(b, types, { cx: 0, fw: 2 * xi - 4, fy0: 3, fy1: yB + T / 2 - 2, zFace: zf, ow: 2 * xi, yb: 0, dd, bh: 230, castor: true });
  const wide = drawer(b, types, { cx: 0, fw: 2 * xi - 4, fy0: yB + T / 2 + 2, fy1: yA + T / 2 - 2, zFace: zf, ow: 2 * xi, yb: yB + T, dd, bh: 200 });
  const rows = [
    [yA + T / 2 + 2, yL + LT / 2 - 2, yA + T],
    [yL + LT / 2 + 2, yt - 2, yL + LT],
  ];
  const smalls = rows.flatMap(([f0, f1, yb]) => S.map((g) => drawer(b, types, { cx: g * (T / 2 + half), fcx: (g * xi) / 2, fw: xi - 4, fy0: f0, fy1: f1, zFace: zf, ow: half * 2, yb, dd, bh: 200 })));
  drawerSteps(b, [bottom], { scene: "castor", label: "bottom", clips: true });
  drawerSteps(b, [wide], { scene: "wide", label: "wide" });
  drawerSteps(b, smalls, { scene: "small", label: "small" });
  drawersIn(b, [smalls, [wide], [bottom]], "Put the drawers in", "Small ones at the top, then the wide one onto its runners. The bottom drawer rolls in on its castors.");
}

/* ---------------------------------------------------------------- wardrobe */

function wardrobe(b: PlanBuilder, s: ProductSpec) {
  const W = 1220, H = 2160, D = 590, F = 10;
  const xo = W / 2 - 3 - T / 2, xi = W / 2 - 3 - T;
  const yt = H - T;
  const zb = -D / 2, zf = D / 2 - 4;
  const zBk = zb + 10;
  const z0 = zBk + 1.5, z1 = zf - T - 2;
  const sd = z1 - z0, sz = (z0 + z1) / 2;
  const dvx = -40; // the middle divider: the left column is a little narrower
  const mL = dvx - T / 2, mR = dvx + T / 2; // its faces
  const cL = (-xi + mL) / 2, wL = mL + xi; // left column centre and width
  const cR = (mR + xi) / 2, wR = xi - mR;
  const yC = 330; // fixed shelves over the castor drawers (undersides)
  const yA = yC + T, yS = 625, yB = yS + 16, yK = 918; // small drawer rows, the shelf between them, the block shelf
  const sdx = cL; // the small divider
  const sL = (-xi + sdx - T / 2) / 2, sR = (sdx + T / 2 + mL) / 2, sw = sdx - T / 2 + xi;
  const LT = 16;
  const ru = (y: number) => y + 30;
  const rz = zf - T - 250;
  const upper = [1200, 1490, 1780]; // shelves behind the left doors (undersides)
  const lower = [700, 1000]; // shelves under the clothes rail
  const yRail = 1950;
  const shelf = (id: string, x: number, w: number, y: number): CustomPart => ({ id, name: "Shelf", size: [w - 2, LT, sd - 14], pos: [x, y + LT / 2, sz - 7] });
  const door = (id: string, x0: number, x1: number, y0: number, y1: number): CustomPart => ({ id, name: "Door", size: [x1 - x0, y1 - y0, T], pos: [(x0 + x1) / 2, (y0 + y1) / 2, zf - T / 2] });
  const parts: CustomPart[] = [
    { id: "MD", name: "Middle divider", size: [T, yt - F, zf - z0], pos: [dvx, (yt + F) / 2, (zf + z0) / 2] },
    { id: "SD", name: "Small divider", size: [T, yK - yA, sd], pos: [sdx, (yK + yA) / 2, sz] },
    { id: "TP", name: "Top", size: [W, T, D], pos: [0, H - T / 2, 0] },
    { id: "SL", name: "Side", size: [T, yt - F, D - 4], pos: [-xo, (yt + F) / 2, (zb + zf) / 2] },
    { id: "SR", name: "Side", size: [T, yt - F, D - 4], pos: [xo, (yt + F) / 2, (zb + zf) / 2] },
    { id: "FL", name: "Fixed shelf", size: [wL, T, sd], pos: [cL, yC + T / 2, sz] },
    { id: "FR", name: "Fixed shelf", size: [wR, T, sd], pos: [cR, yC + T / 2, sz] },
    { id: "BL", name: "Back panel", size: [-dvx + xi + 1, yt - F - 8, 3], pos: [(-xi - 1 + dvx) / 2, (yt + F + 8) / 2, zBk], material: "fiber" },
    { id: "BR", name: "Back panel", size: [xi + 1 - dvx, yt - F - 8, 3], pos: [(xi + 1 + dvx) / 2, (yt + F + 8) / 2, zBk], material: "fiber" },
    { id: "BS", name: "Drawer shelf", size: [wL - 2, T, sd], pos: [cL, yK + T / 2, sz] },
    shelf("K0", sL, sw, yS),
    shelf("K1", sR, sw, yS),
    ...upper.map((y, i) => shelf(`U${i}`, cL, wL, y)),
    ...lower.map((y, i) => shelf(`W${i}`, cR, wR, y)),
    { id: "RL", name: "Clothes rail", size: [wR - 4, 25, 25], pos: [cR, yRail, sz], shape: "cyl", material: "metal" },
    door("DT", mR + 2, xi - 2, yC + T / 2 + 2, yt - 2),
    door("DM", -xi + 2, mL - 2, yK + T / 2 + 2, 1498),
    door("DU", -xi + 2, mL - 2, 1502, yt - 2),
  ];
  const plugs = [
    ...[cL - 150, cL + 150].map((x) => pt(x, yC + T / 2, zBk - 1.5)),
    ...[cR - 150, cR + 150].map((x) => pt(x, yC + T / 2, zBk - 1.5)),
  ];
  const midPlugs = [900, 1600].flatMap((y) => [pt(dvx - 5, y, zBk - 1.5), pt(dvx + 5, y, zBk - 1.5)]);
  const feet = [-xo, dvx, xo].flatMap((x) => [zb + 45, zf - 40].map((z) => pt(x, F, z)));
  const bx = [-400, 400];
  const support = (x: number, y: number, d: number) => fx("pin", [z0 + 50, z1 - 50].map((z) => pt(x, y - 4, z)), [d, 0, 0], { name: "Shelf support", len: 14, dia: 10 });
  const support3 = (x: number, y: number, d: number) => fx("pin", [z0 + 50, sz, z1 - 50].map((z) => pt(x, y - 4, z)), [d, 0, 0], { name: "Shelf support", len: 14, dia: 10 });
  // two kinds of hinge: one kind at the ends of the tall door and the top of each small door, the other in between
  const hinges = (id: string, x: number, a: number[], c: number[], d: number): CustomFix[] => [
    fx("hinge", a.map((y) => pt(x, y, zf - T / 2)), [d, 0, 0], { name: "Hinge (type A)", on: id, twist: d < 0 ? Math.PI : 0 }),
    fx("hinge", c.map((y) => pt(x, y, zf - T / 2)), [d, 0, 0], { name: "Hinge (type B)", on: id, twist: d < 0 ? Math.PI : 0 }),
  ];
  const grip = (id: string, x: number, y: number, d: number): CustomFix[] => [
    fx("handle", [pt(x, y, zf - 6)], [d, 0, 0], { name: "Grip", len: 40, dia: 20, on: id }),
    fx("screw", [pt(x + d * 12, y, zf - T)], [0, 0, 1], { name: "Grip screw", len: 12, dia: 4, on: id }),
  ];
  const steps: CustomStep[] = [
    {
      title: "Screw on the right-hand runners",
      detail: "Lay the middle divider and the small divider on a rug. Two runners on each, three screws each.",
      add: ["MD"],
      fix: [yA, yB].flatMap((y) => [...runner("MD", mL, ru(y), 1, rz), ...runner("SD", sdx - T / 2, ru(y), 1, rz)]),
      wait: ["SD"],
      tools: ["screwdriver"],
      pose: "-z",
      warnings: ["floor"],
    },
    {
      title: "Turn the small divider over and screw on the left-hand runners",
      detail: "Two on the left side and two on the other face of the small divider.",
      fix: [yA, yB].flatMap((y) => [...runner("SL", -xi, ru(y), -1, rz), ...runner("SD", sdx + T / 2, ru(y), -1, rz)]),
      wait: ["SL"],
      tools: ["screwdriver"],
    },
    { title: "Click the top onto the middle divider", detail: "Stand the divider on its front edge. Slide the top onto its connectors, then press down until it clicks.", add: ["TP"], from: { TP: [0, 500, 0] } },
    { title: "Click the left side on", detail: "Swing it up onto the end of the top, runners inside.", add: ["SL"], from: { SL: [-500, 0, 0] } },
    { title: "Click the right side on", detail: "The same at the other end of the top.", add: ["SR"], from: { SR: [500, 0, 0] } },
    { title: "Click in the two fixed shelves", detail: "At the bottom end, one in each column, pressed down until they click.", add: ["FL", "FR"], from: { FL: [0, 0, -500], FR: [0, 0, -500] } },
    { title: "Slide the back panels in", detail: "Smooth side in, from the bottom end along the grooves, then push them into the groove of the top.", add: ["BL", "BR"], from: { BL: [0, -2300, 0], BR: [0, -2300, 0] }, people: 2 },
    ...backFix([...plugs, ...midPlugs], "BL").map((st) => ({ ...st, fix: st.fix!.map((f) => ({ ...f, on: undefined })) })),
    { title: "Screw the wall brackets into the top", detail: "Two, into the holes in the back edge of the top.", fix: [fx("angle", bx.map((x) => pt(x, H - T / 2, zb)), [0, 0, 1], { name: "Wall bracket", len: 40, dia: 30, on: "TP" })], tools: ["screwdriver"] },
    { title: "Screw in the feet", detail: "Six, into the bottom ends of the sides and the middle divider.", fix: [fx("foot", feet, [0, 1, 0], { name: "Adjustable foot", len: 20, dia: 30 })] },
    { title: "Stand it up", detail: "Together, and mind the ceiling: stand it up near where it goes.", pose: "+y", people: 2 },
    {
      title: "Push in four shelf supports",
      detail: "For the drawer shelf in the left column: two on the left side, two on the middle divider.",
      fix: [support(-xi, yK, -1), support(mL, yK, 1)],
    },
    {
      title: "Click the small divider under its shelf and put them in",
      detail: "The divider clicks into the middle of the drawer shelf. Lay the shelf on the supports, divider standing on the fixed shelf.",
      add: ["SD", "BS"],
      from: { SD: [0, 0, 500], BS: [0, 0, 500] },
    },
    { title: "Screw the small divider to the fixed shelf", detail: "Two long screws with the Allen key, up through the fixed shelf.", fix: [fx("bolt", [z0 + 150, z1 - 150].map((z) => pt(sdx, yC, z)), [0, 1, 0], { len: 70, dia: 6, name: "Long connecting screw", on: "FL", mate: "SD" })], tools: ["allen"] },
    ...wallSteps({ xs: bx, y: H - T / 2, zBack: zb, feet: 6 }),
    {
      title: "Push in the supports for the small shelves",
      detail: "Eight, between the two rows of small drawers.",
      fix: [support(-xi, yS, -1), support(sdx - T / 2, yS, 1), support(sdx + T / 2, yS, -1), support(mL, yS, 1)],
    },
    { title: "Lay in the two small shelves", detail: "One in each half, over the supports.", add: ["K0", "K1"], from: { K0: [0, 0, 400], K1: [0, 0, 400] } },
    {
      title: "Push in the rest of the shelf supports",
      detail: "Thirty: three on each side of every shelf, at the heights you want. Three shelves on the left, two under the rail on the right.",
      fix: [...upper.flatMap((y) => [support3(-xi, y, -1), support3(mL, y, 1)]), ...lower.flatMap((y) => [support3(mR, y, -1), support3(xi, y, 1)])],
    },
    { title: "Lay the shelves on the supports", detail: "Pushed down over the supports until they sit flat.", add: [...upper.map((_, i) => `U${i}`), ...lower.map((_, i) => `W${i}`)] },
    {
      title: "Screw on the rail holders",
      detail: "Near the top of the right column, one on the middle divider and one on the right side, two screws each.",
      fix: [
        fx("clip", [pt(mR, yRail, sz)], [-1, 0, 0], { name: "Rail holder", len: 30, dia: 40, on: "MD" }),
        fx("clip", [pt(xi, yRail, sz)], [1, 0, 0], { name: "Rail holder", len: 30, dia: 40, on: "SR" }),
        fx("screw", [-20, 20].map((dz) => pt(mR, yRail + 18, sz + dz)), [-1, 0, 0], { len: 14, dia: 4, on: "MD" }),
        fx("screw", [-20, 20].map((dz) => pt(xi, yRail + 18, sz + dz)), [1, 0, 0], { len: 14, dia: 4, on: "SR" }),
      ],
      tools: ["screwdriver"],
    },
    { title: "Click the clothes rail in", detail: "Push its ends into the holders until they click.", add: ["RL"], from: { RL: [0, 0, 400] } },
    { title: "Fit the hinges on the tall door", detail: "Lay it face down on a rug. Two of one kind at the ends, two of the other in between, pressed into the holes and screwed.", fix: hinges("DT", xi - 1, [450, 2030], [950, 1550], -1), wait: ["DT"], tools: ["screwdriver"], warnings: ["floor"] },
    { title: "Hang the tall door", detail: "Together: click each hinge onto its plate on the right side.", add: ["DT"], from: { DT: [0, 0, 400] }, people: 2 },
    { title: "Adjust the tall door", detail: "Turn the hinge screws until it hangs straight and the gaps are even.", tools: ["screwdriver"], check: "square" },
    { title: "Fit the grip on the tall door", detail: "Over its left edge, screwed from the inside with the washer.", fix: grip("DT", mR + 2, 1240, 1), tools: ["screwdriver"] },
    { title: "Fit the hinges on the two small doors", detail: "One of each kind on each door, pressed into the holes and screwed.", fix: [...hinges("DM", -xi + 1, [1420], [1010], 1), ...hinges("DU", -xi + 1, [2060], [1590], 1)], wait: ["DM", "DU"], tools: ["screwdriver"], warnings: ["floor"] },
    { title: "Hang the small doors and adjust them", detail: "Click their hinges onto the plates on the left side, then line them up.", add: ["DM", "DU"], from: { DM: [0, 0, 400], DU: [0, 0, 400] }, tools: ["screwdriver"] },
    { title: "Fit their grips", detail: "Over the right edges, near where the doors meet.", fix: [...grip("DM", mL - 2, 1420, -1), ...grip("DU", mL - 2, 1580, -1)], tools: ["screwdriver"] },
  ];
  buildCustom(b, { ...s, custom: { parts, steps } });
  const types = new Map<string, string>();
  const dd = 480;
  const castors = [
    drawer(b, types, { cx: cL, fw: wL - 4, fy0: 3, fy1: yC + T / 2 - 2, zFace: zf, ow: wL, yb: 0, dd, bh: 250, castor: true }),
    drawer(b, types, { cx: cR, fw: wR - 4, fy0: 3, fy1: yC + T / 2 - 2, zFace: zf, ow: wR, yb: 0, dd, bh: 250, castor: true }),
  ];
  const rows = [
    [yC + T / 2 + 2, yS + LT / 2 - 2, yA],
    [yS + LT / 2 + 2, yK + T / 2 - 2, yB],
  ];
  const fwS = (mL + xi) / 2 - 4;
  const smalls = rows.flatMap(([f0, f1, yb]) =>
    [sL, sR].map((cx, i) => drawer(b, types, { cx, fcx: i ? (sdx + mL) / 2 : (-xi + sdx) / 2, fw: fwS, fy0: f0, fy1: f1, zFace: zf, ow: sw, yb, dd, bh: 200 })),
  );
  drawerSteps(b, castors, { scene: "castor", label: "bottom", clips: true });
  drawerSteps(b, smalls, { scene: "small", label: "small" });
  drawersIn(b, [smalls, castors], "Put the drawers in", "The small ones onto their runners under the drawer shelf. The two bottom drawers roll in on their castors.");
}

const family: Family = {
  names: ["VISTHUS"],
  build(b, s) {
    if (/chest of 6 drawers/i.test(s.variant) || s.slug === "visthus-chest-6-drawers-63-x-49-x-126") return chest(b, s), true;
    if (/^wardrobe/i.test(s.variant) || s.slug === "visthus-wardrobe-122-x-216") return wardrobe(b, s), true;
    return false;
  },
};
export default family;

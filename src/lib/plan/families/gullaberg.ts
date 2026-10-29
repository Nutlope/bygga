import type { PartPiece, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";
import { rotate } from "../math";
import type { Family } from "./family";

/*
 * GULLABERG, read from IKEA's manuals.
 *
 * Bed frame (single/twin and double/king manuals): the headboard is built flat on a rug, back up: cam bolts in the
 * head rail, dowels round the panel, the rail on its bottom edge with small cam locks, the panel's top rail on long
 * bolts and barrel nuts. Turned over, dowels and big cam locks go in the head rail and the footboard; the posts take
 * cam bolts and glides and lock on. Stood up, small cams hold the panel to the posts and the cap sits on studs. The
 * side rails take dowels and cams on the floor, two people join them to the headboard and then the footboard, the
 * slat ledges are screwed on, then a telescopic brace (the double: a centre beam on brackets and four braces in a
 * diamond). Anti-slip strips go on the ledges, and the bed takes LURÖY slats (with clips) or two LÖNSET bases.
 * Storage boxes: front face down with cam bolts, sides on dowels, the back on push-in pins, the bottom slid in and
 * screwed, castors upside down, then they roll in under the side rail.
 */

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, c: number, n: number) => range(n).map((i) => (n === 1 ? (a + c) / 2 : a + ((c - a) * i) / (n - 1)));
const sg = (i: number) => (i === 0 ? -1 : 1);

type StepOpts = {
  title: string;
  detail?: string;
  tools?: ToolId[];
  pose?: Pose;
  scene?: string;
  kind?: StepKind;
  warnings?: WarnId[];
  people?: 1 | 2;
  repeat?: number;
  check?: "square";
  wall?: boolean;
};
const step = (b: PlanBuilder, o: StepOpts, body: () => void = () => {}) =>
  b.step({ kind: "general", ...o, warnings: o.warnings ?? (o.people === 2 ? ["two"] : []) }, body);

/** Show parts in another scene where they lie as in the finished product, turned by `rot` about `pivot` and moved to `at`. */
function lay(b: PlanBuilder, keys: string[], pivot: Vec3, at: Vec3 = [0, 0, 0], rot: Vec3 = [0, 0, 0], from: Vec3 = [0, 160, 0]) {
  for (const k of keys) {
    const it = b.partItem(k);
    const p = rotate([it.final.pos[0] - pivot[0], it.final.pos[1] - pivot[1], it.final.pos[2] - pivot[2]], rot);
    const r: Vec3 = rot.some((v) => v) ? rot : it.final.rot;
    b.stage(k, [p[0] + at[0], p[1] + at[1], p[2] + at[2]], r, from);
  }
}

const pts = (on: string, list: Vec3[], dir: Vec3, mate?: string, o: Partial<FitOpts> = {}): FitOpts[] => list.map((at) => ({ on, at, dir, mate, ...o }));

/* ---------- bed ---------- */

const POST_BOLT: HwDef = { kind: "camScrew", len: 44, dia: 7 };
const SMALL_BOLT: HwDef = HW.camScrew;
const BIG_CAM: HwDef = { kind: "cam", len: 16, dia: 25 };
const SMALL_CAM: HwDef = HW.cam;
const PANEL_DOWEL: HwDef = { kind: "dowel", len: 40, dia: 8 };
const RAIL_DOWEL: HwDef = { kind: "dowel", len: 40, dia: 10 };
const LONG_BOLT: HwDef = { kind: "bolt", len: 100, dia: 6 };
const BARREL_NUT: HwDef = { kind: "nut", len: 12, dia: 10 };
const STUD: HwDef = { kind: "stud", len: 30, dia: 8 };
const POST_GLIDE: HwDef = { kind: "glide", len: 6, dia: 30 };
const LEDGE_SCREW: HwDef = { kind: "screw", len: 16, dia: 5 };
const BRACE_SCREW: HwDef = { kind: "screw", len: 10, dia: 4 };
const CLIP_SCREW: HwDef = { kind: "screw", len: 12, dia: 6 };
const SLAT_CLIP: HwDef = { kind: "clip", len: 30, dia: 40 };
const BEAM_BRACKET: HwDef = { kind: "angle", len: 60, dia: 50 };
const BEAM_LEG: HwDef = { kind: "foot", len: 230, dia: 36 };
const LONSET_SCREW: HwDef = { kind: "screw", len: 50, dia: 6 };

function bedBoxes(s: ProductSpec) {
  const m = /with (\d) storage boxes/i.exec(s.variant);
  return m ? Number(m[1]) : 0;
}

function buildBed(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, L = s.size.d * 10, H = s.size.h * 10;
  const mw = (s.bed?.mattressW ?? s.size.w - 16) * 10;
  const wide = mw >= 1200; // the double manual: four bolts and cams in the headboard, a centre beam, four braces
  const slug = s.slug ?? "";
  const boxes = bedBoxes(s);
  const lonset = /4-storage-boxes|2-storage-boxes-standard-dou/.test(slug); // these bundles come with LÖNSET bases
  const slatsIn = !lonset && (boxes > 0 || /standard-double/.test(slug)); // the single frame alone has no slats
  const P = 45, T = 20; // post section, rail thickness
  const RB = 180, RT = 380; // underside and top of the side rails and end boards
  const HP = H - 25; // head post height (the cap sits on top)
  const zH = -L / 2 + P / 2, zF = L / 2 - P / 2;
  const xi = W / 2 - P; // inner faces of the posts
  const xr = xi + T / 2; // side rail centres
  const ST = HP - 45; // top of the panel, under its top rail
  const nb = wide ? 4 : 3; // bolts and cams along the panel

  // parts where they sit in the bed
  const postT = b.part("Head post", [P, HP, P], { material: "wood" });
  const hp = [0, 1].map((i) => b.place(postT, [sg(i) * (W / 2 - P / 2), HP / 2, zH]));
  const fpostT = b.part("Foot post", [P, RT, P], { material: "wood" });
  const fp = [0, 1].map((i) => b.place(fpostT, [sg(i) * (W / 2 - P / 2), RT / 2, zF]));
  const endT = b.part("End board", [2 * xi, RT - RB, T]);
  const hr = b.place(endT, [0, (RB + RT) / 2, zH]);
  const fb = b.place(endT, [0, (RB + RT) / 2, zF]);
  // the panel's front is cut in narrow vertical boards
  const nBeads = Math.round((2 * xi) / 95);
  const beadPieces: PartPiece[] = [
    { shape: "box", size: [2 * xi, ST - RT, 14], pos: [0, 0, -1], material: "board" },
    ...range(nBeads - 1).map((i): PartPiece => ({ shape: "box", size: [5, ST - RT - 30, 3], pos: [-xi + ((i + 1) * 2 * xi) / nBeads, 0, 7], material: "board" })),
  ];
  const pc = b.compound("Headboard panel", beadPieces);
  const panel = b.place(pc.type, [pc.mid[0], (RT + ST) / 2 + pc.mid[1], zH + pc.mid[2]]);
  const strip = b.place(b.part("Panel top rail", [2 * xi, 45, 30], { material: "wood" }), [0, ST + 22.5, zH]);
  const cap = b.place(b.part("Headboard cap", [W + 20, 25, 75], { material: "wood" }), [0, HP + 12.5, zH]);
  const sideT = b.part("Side rail", [T, RT - RB, L - 2 * P]);
  const sides = [0, 1].map((i) => b.place(sideT, [sg(i) * xr, (RB + RT) / 2, 0]));
  const LY = 275; // centre of the slat ledges
  const ledgeT = b.part("Slat ledge", [30, 30, L - 2 * P - 20], { material: "metal" });
  const ledges = [0, 1].map((i) => b.place(ledgeT, [sg(i) * (xi - 15), LY, 0]));
  const top = LY + 15; // where the slats rest
  const beam = wide ? b.place(b.part("Centre beam", [50, 60, L - 2 * P], { material: "wood" }), [0, top - 30, 0]) : "";
  const padT = b.part("Anti-slip strip", [26, 2, 300], { material: "soft" });
  const padZ = spread(-(L / 2 - P - 250), L / 2 - P - 250, 3);
  const pads = [
    ...[0, 1].flatMap((i) => padZ.map((z) => b.place(padT, [sg(i) * (xi - 15), top + 1, z]))),
    ...(wide ? padZ.map((z) => b.place(padT, [0, top + 1, z])) : []),
  ];

  // braces under the ledges: one corner to corner on the single, a diamond off the beam brackets on the double
  const yb = LY - 17;
  const zEnd = L / 2 - P - 40, xL = xi - 15;
  // each brace telescopes: two halves overlapping in the middle, the one from c just under the one from a
  const braceT = (len: number) => b.part("Cross brace", [20, 3, Math.round(len / 2 + 100)], { material: "metal" });
  const segs: { a: [number, number]; c: [number, number]; key: string; key2: string }[] = [];
  const segOf = (a: [number, number], c: [number, number], t: string) => {
    const dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz), h = len / 2 + 100;
    const ux = dx / len, uz = dz / len, r: Vec3 = [0, Math.atan2(dx, dz), 0];
    const key = b.place(t, [a[0] + (ux * h) / 2, yb, a[1] + (uz * h) / 2], r);
    const key2 = b.place(t, [c[0] - (ux * h) / 2, yb - 3, c[1] - (uz * h) / 2], r);
    segs.push({ a, c, key, key2 });
  };
  if (wide) {
    const len = Math.hypot(xL, zEnd);
    const t = braceT(len);
    for (const [a, c] of [
      [[0, -zEnd], [-xL, 0]],
      [[-xL, 0], [0, zEnd]],
      [[0, zEnd], [xL, 0]],
      [[xL, 0], [0, -zEnd]],
    ] as [[number, number], [number, number]][])
      segOf(a, c, t);
  } else {
    const t = braceT(Math.hypot(2 * xL, 2 * zEnd));
    segOf([-xL, -zEnd], [xL, zEnd], t);
  }

  // the slats: LURÖY rolls (two on the double) or two LÖNSET bases
  const inner = 2 * xi;
  const roll = (x0: number, w: number) => {
    const n = 17;
    const len = L - 2 * P - 20;
    const pieces: PartPiece[] = range(n).map((i) => ({ shape: "box", size: [w, 8, 64], pos: [0, 0, -len / 2 + 32 + (i * (len - 64)) / (n - 1)], material: "wood" }));
    pieces.push({ shape: "box", size: [30, 3, len], pos: [-w / 2 + 40, -5, 0], material: "fiber" }, { shape: "box", size: [30, 3, len], pos: [w / 2 - 40, -5, 0], material: "fiber" });
    const { type, mid } = b.compound("Slatted base", pieces, { material: "wood", extra: !slatsIn });
    return b.place(type, [x0 + mid[0], top + 6 + mid[1], mid[2]]);
  };
  const lonsetBase = (x0: number, w: number) => {
    const len = L - 2 * P - 20;
    const pieces: PartPiece[] = [
      { shape: "box", size: [40, 50, len], pos: [-w / 2 + 20, 0, 0], material: "wood" },
      { shape: "box", size: [40, 50, len], pos: [w / 2 - 20, 0, 0], material: "wood" },
      ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [w - 80, 30, 40], pos: [0, -10, g * (len / 2 - 20)], material: "wood" })),
      { shape: "box", size: [w - 80, 30, 40], pos: [0, -10, 0], material: "wood" },
      ...range(28).map((i): PartPiece => ({ shape: "box", size: [w - 30, 8, 38], pos: [0, 29, -len / 2 + 40 + (i * (len - 80)) / 27], material: "wood" })),
    ];
    const { type, mid } = b.compound("LÖNSET slatted base", pieces, { material: "wood" });
    return b.place(type, [x0 + mid[0], top + 25 + mid[1], mid[2]]);
  };
  const bases = lonset
    ? [0, 1].map((i) => lonsetBase(sg(i) * (inner / 4), inner / 2 - 4))
    : wide
      ? [0, 1].map((i) => roll(sg(i) * (inner / 4 + 2), inner / 2 - 20))
      : [roll(0, inner - 30)];

  // where each fitting goes
  const people = 2 as const;
  const xBolt = xi - 40; // bolts and cams along the panel, inset from the posts
  const panelX = spread(-xBolt, xBolt, nb);
  const boltY = [250, 310], dowelY = [205, 355];
  const cH: Vec3 = [0, HP / 2, zH], cF: Vec3 = [0, RT / 2, zF];
  const footAt: Vec3 = [0, -(HP / 2 + RT / 2 + 200), 0];
  const FLIP: Vec3 = [0, Math.PI, 0]; // the footboard lies inner face up, like the headboard
  const headParts = [hr, panel, strip];

  step(b, { title: "Screw the small cam bolts into the head rail", detail: "Lay it on a rug. They go in the top edge, the one with the holes.", tools: ["screwdriver"], scene: "ends", pose: "-z", kind: "cams", warnings: ["floor"] }, () => {
    lay(b, [hr], cH, [0, -220, 0]);
    b.then(0.15);
    b.fits(SMALL_BOLT, pts(hr, panelX.map((x): Vec3 => [x, RT, zH]), [0, -1, 0], panel, { mateHole: 4 }), 0.1);
  });
  step(b, { title: "Tap the dowels into the headboard panel", detail: "Back face up on the rug. Use the thinner dowels: four along each long edge and two in each end.", tools: ["hammer"], scene: "ends", pose: "-z", kind: "dowels" }, () => {
    lay(b, [panel], cH);
    b.then(0.15);
    const dx = spread(-xi + 120, xi - 120, 4);
    b.fits(PANEL_DOWEL, [
      ...pts(panel, dx.map((x): Vec3 => [x, RT, zH]), [0, 1, 0], hr),
      ...pts(panel, dx.map((x): Vec3 => [x, ST, zH]), [0, -1, 0], strip),
      ...[-1, 1].flatMap((g) => pts(panel, [RT + 120, ST - 120].map((y): Vec3 => [g * xi, y, zH]), [-g, 0, 0], hp[g < 0 ? 0 : 1])),
    ], 0.05);
  });
  step(b, { title: "Put the head rail on the panel's bottom edge", detail: "Turn it over so the cam bolts face the panel and push it onto the dowels.", scene: "ends", pose: "-z", kind: "join" }, () => lay(b, [hr], cH, [0, 0, 0], [0, 0, 0], [0, -200, 0]));
  step(b, { title: "Lock the small cam locks", detail: "In the back of the panel, just above the rail. Turn each one clockwise until it pulls tight.", tools: ["screwdriver"], scene: "ends", pose: "-z", kind: "cams" }, () =>
    b.fits(SMALL_CAM, pts(panel, panelX.map((x): Vec3 => [x, RT + 25, zH - 8]), [0, 0, 1]), 0.12),
  );
  step(b, { title: "Bolt the top rail onto the panel", detail: "Drop the barrel nuts into the back of the panel, slot facing the bolt, then push the long bolts through the rail and tighten.", tools: ["allen"], scene: "ends", pose: "-z", kind: "bolts" }, () => {
    b.fits(BARREL_NUT, pts(panel, panelX.map((x): Vec3 => [x, ST - 40, zH - 8]), [0, 0, 1], undefined, { hole: 5 }), 0.1);
    b.then(0.1);
    lay(b, [strip], cH, [0, 0, 0], [0, 0, 0], [0, 200, 0]);
    b.then(0.1);
    b.fits(LONG_BOLT, pts(strip, panelX.map((x): Vec3 => [x, HP, zH]), [0, -1, 0], panel), 0.12);
  });
  step(b, { title: "Tap a dowel into each end of the top rail", detail: "Thin dowels again. They go into the head posts.", tools: ["hammer"], scene: "ends", pose: "-z", kind: "dowels" }, () =>
    b.fits(PANEL_DOWEL, [-1, 1].flatMap((g) => pts(strip, [[g * xi, ST + 22, zH]], [-g, 0, 0], hp[g < 0 ? 0 : 1])), 0.15),
  );
  const endDowels = (k: string, z: number, posts: string[]) => [-1, 1].flatMap((g) => pts(k, dowelY.map((y): Vec3 => [g * xi, y, z]), [-g, 0, 0], posts[g < 0 ? 0 : 1]));
  step(b, { title: "Turn the headboard over and dowel the head rail and the footboard", detail: "Front face up now. Two of the thicker dowels in each end of both boards.", tools: ["hammer"], scene: "ends", pose: "+z", kind: "dowels" }, () => {
    lay(b, [fb], cF, footAt, FLIP);
    b.then(0.15);
    b.fits(RAIL_DOWEL, [...endDowels(hr, zH, hp), ...endDowels(fb, zF, fp)], 0.05);
  });
  const endCams = (k: string, z: number, face: number) => [-1, 1].flatMap((g) => pts(k, boltY.map((y): Vec3 => [g * (xi - 35), y, z + face * (T / 2)]), [0, 0, -face], undefined, { turn: 0 }));
  step(b, { title: "Press the big cam locks into both boards", detail: "Two near each end, arrows pointing to the end. Don't turn them yet.", scene: "ends", pose: "+z", kind: "cams" }, () =>
    b.fits(BIG_CAM, [...endCams(hr, zH, 1), ...endCams(fb, zF, -1)], 0.08),
  );
  const postBolts = (k: string, g: number, z: number, dz: number, board: string, rail: string) => [
    ...pts(k, boltY.map((y): Vec3 => [g * xi, y, z]), [g, 0, 0], board, { mateHole: 4 }),
    ...pts(k, boltY.map((y): Vec3 => [g * xr, y, z + dz * (P / 2)]), [0, 0, -dz], rail, { mateHole: 4 }),
  ];
  step(b, { title: "Screw the cam bolts into the posts", detail: "Four in each post: two facing the end board, two facing the side rail. Turn them in by hand until the collar touches.", scene: "ends", pose: "+z", kind: "cams" }, () => {
    b.stagger(0.15);
    // they appear where they lie (dropping them in would cross the dowels already in the boards)
    for (const i of [0, 1]) lay(b, [hp[i]], cH, [sg(i) * 250, 0, 0], [0, 0, 0], [0, 0, 0]);
    for (const i of [0, 1]) lay(b, [fp[i]], cF, [-sg(i) * 250 + footAt[0], footAt[1], 0], FLIP, [0, 0, 0]);
    b.then(0.15);
    b.fits(POST_BOLT, [0, 1].flatMap((i) => [...postBolts(hp[i], sg(i), zH, 1, hr, sides[i]), ...postBolts(fp[i], sg(i), zF, -1, fb, sides[i])]), 0.05);
  });
  step(b, { title: "Screw the small cam bolts into the head posts", detail: "Two in each, on the side that faces the panel.", scene: "ends", pose: "+z", kind: "cams" }, () =>
    b.fits(SMALL_BOLT, [0, 1].flatMap((i) => pts(hp[i], [RT + 120, ST - 120].map((y): Vec3 => [sg(i) * xi, y, zH + 2]), [sg(i), 0, 0], panel, { mateHole: 4 })), 0.1),
  );
  step(b, { title: "Screw a glide into the foot of each post", detail: "By hand, all the way in.", scene: "ends", pose: "+z", kind: "legs" }, () =>
    b.fits(POST_GLIDE, [...hp.map((k, i) => ({ on: k, at: [sg(i) * (W / 2 - P / 2), 0, zH] as Vec3, dir: [0, 1, 0] as Vec3, hole: false as const })), ...fp.map((k, i) => ({ on: k, at: [sg(i) * (W / 2 - P / 2), 0, zF] as Vec3, dir: [0, 1, 0] as Vec3, hole: false as const }))], 0.1),
  );
  step(b, { title: "Push the posts on and lock the cams", detail: "Long posts on the headboard, short ones on the footboard. Turn each big cam clockwise with the Allen key until the post pulls tight.", tools: ["allen"], scene: "ends", pose: "+z", kind: "cams" }, () => {
    b.stagger(0.2);
    for (const i of [0, 1]) lay(b, [hp[i]], cH, [0, 0, 0], [0, 0, 0], [sg(i) * 250, 0, 0]);
    for (const i of [0, 1]) lay(b, [fp[i]], cF, footAt, FLIP, [-sg(i) * 250, 0, 0]);
  });
  step(b, { title: "Stand the headboard up and lock the panel", detail: "Small cam locks in the back of the panel, two at each post.", tools: ["screwdriver"], kind: "cams" }, () => {
    b.stagger(0.05);
    for (const k of [...headParts, ...hp]) b.add(k, [0, 0, -200]);
    b.then(0.2);
    b.fits(SMALL_CAM, [0, 1].flatMap((i) => pts(panel, [RT + 120, ST - 120].map((y): Vec3 => [sg(i) * (xi - 35), y, zH - 8]), [0, 0, 1])), 0.12);
  });
  const studX = [-(W / 2 - P / 2), ...spread(-xi / 2, xi / 2, wide ? 4 : 2), W / 2 - P / 2];
  step(b, { title: "Tap the studs into the top", detail: wide ? "One in each post and four along the top rail." : "One in each post and two along the top rail.", tools: ["hammer"], kind: "dowels" }, () =>
    b.fits(STUD, studX.map((x) => ({ on: Math.abs(x) > xi ? hp[x < 0 ? 0 : 1] : strip, at: [x, HP, zH] as Vec3, dir: [0, -1, 0] as Vec3, mate: cap })), 0.1),
  );
  step(b, { title: "Press the cap onto the headboard", detail: "Push it straight down onto the studs. A tap with your fist closes the gap.", kind: "join" }, () => b.add(cap, [0, 250, 0]));
  const railRot = (i: number): Vec3 => [0, 0, sg(i) * -Math.PI / 2];
  const railC = (i: number): Vec3 => [sg(i) * xr, (RB + RT) / 2, 0];
  step(b, { title: "Tap the dowels into the side rails", detail: "Lay both rails flat, inside face up. Two thick dowels in each end.", tools: ["hammer"], scene: "rails", kind: "dowels", warnings: ["floor"] }, () => {
    b.stagger(0.2);
    for (const i of [0, 1]) lay(b, [sides[i]], railC(i), [sg(i) * 160, T / 2, 0], railRot(i), [0, 0, 0]);
    b.then(0.15);
    b.fits(RAIL_DOWEL, [0, 1].flatMap((i) => [-1, 1].flatMap((g) => pts(sides[i], dowelY.map((y): Vec3 => [sg(i) * xr, y, g * (L / 2 - P)]), [0, 0, -g], g < 0 ? hp[i] : fp[i]))), 0.05);
  });
  step(b, { title: "Press the cam locks into the side rails", detail: "Two at each end, on the inside face. Don't turn them yet.", scene: "rails", kind: "cams" }, () =>
    b.fits(BIG_CAM, [0, 1].flatMap((i) => [-1, 1].flatMap((g) => pts(sides[i], boltY.map((y): Vec3 => [sg(i) * xi, y, g * (L / 2 - P - 35)]), [sg(i), 0, 0], undefined, { turn: 0 }))), 0.06),
  );
  step(b, { title: "Join the side rails to the headboard", detail: "One of you holds the headboard. Push each rail onto the bolts and dowels, then turn its two cam locks clockwise.", tools: ["allen"], people, kind: "join" }, () => {
    b.stagger(0.3);
    for (const i of [0, 1]) b.add(sides[i], [sg(i) * 300, 0, 200]);
  });
  step(b, { title: "Put the footboard on", detail: "Lift it onto the other ends of the rails together, then lock the last four cams.", tools: ["allen"], people, kind: "join" }, () => {
    b.stagger(0.05);
    for (const k of [fb, ...fp]) b.add(k, [0, 0, 300]);
  });
  step(b, { title: "Screw the slat ledges to the side rails", detail: "Lip facing in, along the row of holes. Eight screws in each.", tools: ["screwdriver"], kind: "screws" }, () => {
    b.stagger(0.3);
    for (const i of [0, 1]) b.add(ledges[i], [sg(i) * -200, 0, 0]);
    b.then(0.15);
    b.fits(LEDGE_SCREW, [0, 1].flatMap((i) => pts(ledges[i], spread(-(L / 2 - P - 60), L / 2 - P - 60, 8).map((z): Vec3 => [sg(i) * (xi - 30), LY, z]), [sg(i), 0, 0], sides[i])), 0.04);
  });
  const braceEnds = (seg: { a: [number, number]; c: [number, number] }) => [seg.a, seg.c];
  if (wide) {
    step(b, { title: "Screw the beam brackets to the end boards", detail: "One in the middle of each, on the inside, with two screws.", tools: ["screwdriver"], kind: "screws" }, () => {
      b.fits(BEAM_BRACKET, [{ on: hr, at: [0, top - 60, zH + T / 2], dir: [0, 0, -1], hole: false }, { on: fb, at: [0, top - 60, zF - T / 2], dir: [0, 0, 1], hole: false }], 0.2);
      b.then(0.1);
      b.fits(LEDGE_SCREW, [...pts(hr, [-20, 20].map((x): Vec3 => [x, top - 45, zH + T / 2 + 3]), [0, 0, -1]), ...pts(fb, [-20, 20].map((x): Vec3 => [x, top - 45, zF - T / 2 - 3]), [0, 0, 1])], 0.1);
    });
    step(b, { title: "Drop the centre beam into the brackets", detail: "Holes facing up.", kind: "join" }, () => b.add(beam, [0, 300, 0]));
    step(b, { title: "Screw on the cross braces", detail: "Pull each one out to length. They run from the beam brackets to the middle of the ledges in a diamond: one screw at each bracket, two where they meet a ledge.", tools: ["screwdriver"], kind: "screws" }, () => {
      b.stagger(0.2);
      for (const sgm of segs) for (const k of [sgm.key, sgm.key2]) b.add(k, [0, -160, 0]);
      b.then(0.15);
      const list: FitOpts[] = [];
      for (const sgm of segs) {
        const [a, c] = braceEnds(sgm);
        const atBracket = a[0] === 0 ? a : c, atLedge = a[0] === 0 ? c : a;
        list.push({ on: atBracket === a ? sgm.key : sgm.key2, at: [atBracket[0], yb, atBracket[1] + (atBracket[1] < 0 ? 20 : -20)], dir: [0, 1, 0] });
        list.push({ on: ledges[atLedge[0] < 0 ? 0 : 1], at: [atLedge[0], yb + 2, atLedge[1] + (a[0] === 0 ? -14 : 14)], dir: [0, 1, 0] });
      }
      b.fits(BRACE_SCREW, list, 0.08);
    });
    step(b, { title: "Square the frame and lock the braces", detail: "Measure both diagonals. When they match, put one screw in the slot of each brace.", tools: ["screwdriver", "tape"], kind: "square", check: "square", warnings: ["square"] }, () =>
      b.fits(BRACE_SCREW, segs.map((sgm) => ({ on: sgm.key2, at: [(sgm.a[0] + sgm.c[0]) / 2, yb - 4.5, (sgm.a[1] + sgm.c[1]) / 2] as Vec3, dir: [0, 1, 0] as Vec3, hole: false as const })), 0.1),
    );
  } else {
    const sgm = segs[0];
    step(b, { title: "Screw on the cross brace", detail: "Pull it out to length and run it corner to corner under the ledges. A screw at each end and one where the halves overlap.", tools: ["screwdriver"], kind: "screws" }, () => {
      for (const k of [sgm.key, sgm.key2]) b.add(k, [0, -160, 0]);
      b.then(0.15);
      b.fits(BRACE_SCREW, [
        { on: ledges[0], at: [sgm.a[0], yb + 2, sgm.a[1]], dir: [0, 1, 0] },
        { on: sgm.key2, at: [-40 * Math.sin(Math.atan2(2 * xL, 2 * zEnd)), yb - 4.5, -40 * Math.cos(Math.atan2(2 * xL, 2 * zEnd))], dir: [0, 1, 0], hole: false },
        { on: ledges[1], at: [sgm.c[0], yb + 2, sgm.c[1]], dir: [0, 1, 0] },
      ], 0.12);
    });
    step(b, { title: "Square the frame and lock the brace", detail: "Measure both diagonals. When they match, put two screws in the slot.", tools: ["screwdriver", "tape"], kind: "square", check: "square", warnings: ["square"] }, () =>
      b.fits(BRACE_SCREW, [30, 70].map((d) => ({ on: sgm.key2, at: [d * Math.sin(Math.atan2(2 * xL, 2 * zEnd)), yb - 4.5, d * Math.cos(Math.atan2(2 * xL, 2 * zEnd))] as Vec3, dir: [0, 1, 0] as Vec3, hole: false as const })), 0.12),
    );
  }
  const clipPts: FitOpts[] = [-1, 1].flatMap((g) => [0, 1].map((i): FitOpts => ({ on: ledges[i], at: [sg(i) * (xi - 15), top, g * (L / 2 - P - 30)], dir: [0, -1, 0], hole: false })));
  if (!lonset)
    step(b, { title: wide ? "Fit the slat clips and the beam legs" : "Screw the slat clips onto the ledges", detail: wide ? "A clip at each end of both ledges, one screw each. Push the two legs into the underside of the beam." : "A clip at each end of both ledges, one screw each. They hold the ends of the slats.", tools: ["screwdriver"], kind: "screws" }, () => {
      b.fits(SLAT_CLIP, clipPts, 0.1);
      b.then(0.1);
      b.fits(CLIP_SCREW, clipPts.map((o) => ({ ...o, at: [o.at[0], o.at[1] + 3, o.at[2]] as Vec3, hole: undefined })), 0.08);
      if (wide) {
        b.then(0.1);
        b.fits(BEAM_LEG, [-1, 1].map((g): FitOpts => ({ on: beam, at: [0, top - 60, g * (L / 4)], dir: [0, 1, 0], hole: false })), 0.15);
      }
    });
  step(b, { title: "Stick the anti-slip strips on", detail: wide ? "Three along each ledge and three on the beam. Peel off the backing and press them down; cut them to fit if you need to." : "Three along each ledge. Peel off the backing and press them down.", kind: "general" }, () => {
    b.stagger(0.1);
    for (const k of pads) b.add(k, [0, 120, 0]);
  });
  if (lonset) {
    const len = L - 2 * P - 20, w = inner / 2 - 4;
    step(b, { title: "Build the two LÖNSET bases", detail: "Their own manual: screw the crossbars between the side rails, three screws at each joint, then click the slats into their holders.", tools: ["allen"], scene: "base", repeat: 2, kind: "slats" }, () => {
      lay(b, [bases[0]], b.partItem(bases[0]).final.pos, [0, 25, 0], [0, 0, 0], [0, 200, 0]);
      b.then(0.15);
      const list: FitOpts[] = [];
      // two screws through the side rail into each end of the three crossbars
      for (const g of [-1, 1]) for (const z of [-(len / 2 - 20), 0, len / 2 - 20]) for (const dz of [-10, 10]) list.push({ on: bases[0], at: [-inner / 4 + g * (w / 2), top + 15, z + dz], dir: [-g, 0, 0] });
      b.fits(LONSET_SCREW, list, 0.04);
    });
    step(b, { title: "Lay the bases in the frame", detail: "Side by side, resting on the ledges and the beam.", people, kind: "slats" }, () => {
      b.stagger(0.4);
      for (const k of bases) b.add(k, [0, 300, 0]);
    });
  } else
    step(b, {
      title: wide ? "Roll out the slats" : "Roll out the slats",
      detail: (slatsIn ? "" : "The slats are sold separately. ") + (wide ? "Two rolls, one each side of the beam. Tuck the end slats under the clips." : "Start at the head end and tuck the end slats under the clips."),
      kind: "slats",
    }, () => {
      b.stagger(0.3);
      for (const k of bases) b.add(k, [0, 200, -400]);
    });
  if (boxes) storageBoxes(b, { W, L, P, xo: W / 2 - P / 2 + 10, n: boxes, yTop: RB - 6 });
  return true;
}

const BOX_PIN: HwDef = { kind: "camScrew", len: 28, dia: 8 };
const BOX_SCREW: HwDef = { kind: "screw", len: 30, dia: 4 };
const CASTOR_SCREW: HwDef = { kind: "screw", len: 14, dia: 4 };

/** The storage boxes: front face down with cam bolts, sides on dowels, back on push-in pins, bottom, castors. */
function storageBoxes(b: PlanBuilder, o: { W: number; L: number; P: number; xo: number; n: number; yTop: number }) {
  const { L, P, xo, n, yTop } = o;
  const lb = (L - 2 * P - 60) / 2, BD = Math.min(560, xo - 20);
  const FH = yTop - 12, SH = FH - 40; // front height (it hides the castors), side height
  const yF = 12 + FH / 2, yS = 52 + SH / 2;
  const frT = b.part("Box front", [18, FH, lb]);
  const sdT = b.part("Box side", [BD - 34, SH, 16]);
  const bkT = b.part("Box back", [16, SH, lb - 32]);
  const btT = b.part("Box bottom", [BD - 30, 3, lb - 20], { material: "fiber" });
  interface Box {
    g: number;
    zc: number;
    front: string;
    sides: string[];
    back: string;
    bottom: string;
  }
  // two boxes go under the right-hand rail; four fill both sides
  const slots: [number, number][] = n >= 4 ? [[1, -1], [1, 1], [-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
  const all: Box[] = slots.map(([g, k]) => {
    const zc = k * (lb / 2 + 15);
    return {
      g,
      zc,
      front: b.place(frT, [g * (xo - 9), yF, zc]),
      sides: [-1, 1].map((e) => b.place(sdT, [g * (xo - 18 - (BD - 34) / 2), yS, zc + e * (lb / 2 - 8)])),
      back: b.place(bkT, [g * (xo - BD + 8), yS, zc]),
      bottom: b.place(btT, [g * (xo - 18 - (BD - 34) / 2), 58, zc]),
    };
  });
  const xF = (x: Box) => x.g * (xo - 18), xB = (x: Box) => x.g * (xo - BD + 16);
  const fitsOf = (x: Box) => {
    const ends = [-1, 1];
    const zIn = (e: number) => x.zc + e * (lb / 2 - 16);
    const zs = (e: number) => x.zc + e * (lb / 2 - 8);
    const ys = [yS - SH / 4, yS + SH / 4];
    return {
      frontBolts: ends.flatMap((e, i) => ys.map((y): FitOpts => ({ on: x.front, at: [xF(x), y, zs(e)], dir: [x.g, 0, 0], mate: x.sides[i], mateHole: 4 }))),
      dowels: ends.flatMap((e, i) => ys.map((y): FitOpts => ({ on: x.sides[i], at: [xF(x), y + 14, zs(e)], dir: [-x.g, 0, 0], mate: x.front }))),
      frontCams: ends.flatMap((e, i) => ys.map((y): FitOpts => ({ on: x.sides[i], at: [xF(x) - x.g * 30, y, zIn(e)], dir: [0, 0, e] }))),
      pins: ends.flatMap((e, i) => ys.map((y): FitOpts => ({ on: x.back, at: [xB(x) - x.g * 8, y, x.zc + e * (lb / 2 - 16)], dir: [0, 0, -e], mate: x.sides[i], mateHole: 4 }))),
      backCams: ends.flatMap((e, i) => ys.map((y): FitOpts => ({ on: x.sides[i], at: [xB(x) + x.g * 30, y, zIn(e)], dir: [0, 0, e] }))),
      screws: [
        ...spread(x.zc - lb / 2 + 70, x.zc + lb / 2 - 70, 5).map((z): FitOpts => ({ on: x.bottom, at: [xB(x) - x.g * 8, 56.5, z], dir: [0, 1, 0], mate: x.back })),
        ...ends.flatMap((e, i) => [0.3, 0.7].map((t): FitOpts => ({ on: x.bottom, at: [xF(x) - x.g * (BD - 34) * t, 56.5, zs(e)], dir: [0, 1, 0], mate: x.sides[i] }))),
      ],
      castors: [xF(x) - x.g * 60, xB(x) + x.g * 50].flatMap((cx) => ends.map((e): FitOpts => ({ on: x.bottom, at: [cx, 56, x.zc + e * (lb / 2 - 60)], dir: [0, 1, 0], hole: false }))),
      castorScrews: [xF(x) - x.g * 60, xB(x) + x.g * 50].flatMap((cx) => ends.flatMap((e) => [-16, 16].map((dz): FitOpts => ({ on: x.bottom, at: [cx, 56, x.zc + e * (lb / 2 - 60) + dz], dir: [0, 1, 0] })))),
    };
  };
  const x0 = all[0];
  const c0: Vec3 = [x0.g * (xo - BD / 2), yS, x0.zc];
  const st = (k: string, from: Vec3) => lay(b, [k], c0, [0, 0, 0], [0, 0, 0], from);
  const f0 = fitsOf(x0);
  const rep = all.length;
  const bstep = (title: string, detail: string, kind: StepKind, body: () => void, pose: Pose = "-x", tools?: ToolId[]) => step(b, { title, detail, scene: "box", pose, repeat: rep, kind, tools }, body);
  bstep("Screw the cam bolts into a box front", "Lay the front face down on a rug. Two at each end.", "cams", () => {
    st(x0.front, [-200, 0, 0]);
    b.then(0.15);
    b.fits(HW.camScrew, f0.frontBolts, 0.1);
  }, "-x", ["screwdriver"]);
  bstep("Tap the dowels into the box sides", "Two in the front end of each side.", "dowels", () => {
    b.stagger(0.2);
    for (const k of x0.sides) st(k, [300, 0, 0]);
    b.then(0.15);
    b.fits(HW.dowel, f0.dowels, 0.1);
  }, "-x", ["hammer"]);
  bstep("Stand the sides on the front and lock them", "Grooves facing in. Turn the cam locks clockwise until they pull tight.", "cams", () => b.fits(HW.cam, f0.frontCams, 0.1), "-x", ["screwdriver"]);
  bstep("Put the back on", "Press the plastic pins into the ends of the back, then push it down between the sides.", "cams", () => {
    b.fits(BOX_PIN, f0.pins, 0.08);
    b.then(0.15);
    st(x0.back, [-260, 0, 0]);
  }, "-x");
  bstep("Lock the back with cam locks", "Two in each side, then a clockwise turn.", "cams", () => b.fits(HW.cam, f0.backCams, 0.1), "-x", ["screwdriver"]);
  bstep("Slide in the bottom", "Smooth side up, along the grooves until it meets the front.", "join", () => st(x0.bottom, [0, 0, -500]), "-x");
  bstep("Turn the box over and screw the bottom on", "Into the back and the sides, nine screws in all.", "screws", () => b.fits(BOX_SCREW, f0.screws, 0.06), "-y", ["screwdriver"]);
  bstep("Screw on the castors", "One near each corner, two screws each.", "legs", () => {
    b.fits(HW.castor, f0.castors, 0.15);
    b.then(0.1);
    b.fits(CASTOR_SCREW, f0.castorScrews, 0.04);
  }, "-y", ["screwdriver"]);
  step(b, { title: all.length > 2 ? `Roll all ${all.length} boxes under the bed` : "Roll the boxes under the bed", detail: "Lift the front a little and push it in under the side rail. Pull it out by the front, not by one side.", kind: "drawer" }, () => {
    for (const [i, x] of all.entries()) {
      b.stagger(0);
      for (const k of [x.front, ...x.sides, x.back, x.bottom]) b.add(k, [x.g * 700, 0, 0]);
      if (i > 0) {
        const f = fitsOf(x);
        const list: [HwDef, FitOpts[]][] = [
          [HW.camScrew, f.frontBolts],
          [HW.dowel, f.dowels],
          [HW.cam, [...f.frontCams, ...f.backCams]],
          [BOX_PIN, f.pins],
          [BOX_SCREW, f.screws],
          [HW.castor, f.castors],
          [CASTOR_SCREW, f.castorScrews],
        ];
        for (const [def, l] of list) for (const op of l) b.preset(def, op);
      }
      b.wait(0.25);
    }
  });
  b.steps[b.steps.length - 1].quiet = true;
}


/* ---------- chests of drawers ---------- */

/*
 * Chests (3, 6 and 8 drawer manuals): the sides come as ready frames of posts, a panel and runner battens. They lie
 * inside up for their clips and the cabinet runners. The top lies upside down and takes the back rail on dowels and
 * L brackets, then the chest is built upside down on it: a side hooks onto the clips, then the other side (the wide
 * chest slides a middle frame in between), metal bars across the front, front rails on push-in connectors, the back
 * panel down the grooves and the bottom panels with plastic plugs. Feet go in the post ends, it's turned over and
 * fixed to the wall with a sliding bracket. Drawers are built on their fronts: the sides hook on, the bottom slides
 * in, the back goes on with push-in pins and cam locks, then the runners and knobs.
 */

interface Opening {
  x: number; // centre
  w: number;
  y0: number; // bottom
  h: number;
  pair: boolean; // one of two small drawers side by side
}
interface ChestCfg {
  rows: { k: number; pair?: boolean }[]; // relative heights, top first
  cols: 1 | 2;
  smallPins: number; // push-in pins (and cams) in the back of a small drawer
  stops: number; // plastic stops on the sides
  clips: number; // clips that hold the top and back rail
  brackets: number; // L brackets under the top
  topDowels: number;
  topScrews: number; // up through the front bar into the top, once it stands
  plugs: number; // plastic plugs holding the bottom panels
  walls: number;
  legH?: number;
  runScrews?: 2 | 3; // screws in each runner
  knob2?: number; // drawers wider than this get two knobs
  topLast?: boolean; // built upside down without the top; the top goes on at the end (the bench)
  bottomRails?: boolean; // wooden bottom rails in each half instead of a metal bar
  spacers?: boolean; // fixed to the wall through two spacers instead of a sliding bracket
  word?: string;
}

const FRAME_CLIP: HwDef = { kind: "clip", len: 20, dia: 24 };
const STOP: HwDef = { kind: "clip", len: 16, dia: 18 };
const CLIP_SCREW_S: HwDef = { kind: "screw", len: 12, dia: 4 };
const RUNNER_SCREW: HwDef = { kind: "screw", len: 13, dia: 4 };
const L_BRACKET: HwDef = { kind: "angle", len: 40, dia: 24 };
const SLEEVE: HwDef = { kind: "clip", len: 12, dia: 8 };
const RAIL_CONNECTOR: HwDef = { kind: "connector", len: 22, dia: 14 };
const BAR_SCREW: HwDef = { kind: "screw", len: 12, dia: 6 };
const BIG_SCREW: HwDef = { kind: "screw", len: 60, dia: 6 };
const BOTTOM_PLUG: HwDef = { kind: "clip", len: 18, dia: 10 };
const ADJ_FOOT: HwDef = { kind: "foot", len: 25, dia: 30 };
const MID_BOLT: HwDef = { kind: "bolt", len: 70, dia: 6 };
const DRAWER_PIN: HwDef = { kind: "camScrew", len: 30, dia: 8 };
const DRAWER_CAM: HwDef = { kind: "cam", len: 13, dia: 17 };
const DRAWER_STOP: HwDef = { kind: "clip", len: 100, dia: 12 };
const KNOB_SCREW: HwDef = { kind: "screw", len: 32, dia: 4 };
const SLIDE_BRACKET: HwDef = { kind: "bracket", len: 90, dia: 40 };
const WALL_PLATE: HwDef = { kind: "connector", len: 60, dia: 30 };
const WALL_SCREW: HwDef = { kind: "screw", len: 50, dia: 5 };
const WALL_PLUG: HwDef = { kind: "plug", len: 40, dia: 8, notIncluded: false };
const runnerDef = (len: number): HwDef => ({ kind: "runner", len: Math.round(len / 10) * 10, dia: 20 });

const CHESTS: Record<number, ChestCfg> = {
  3: { rows: [{ k: 1 }, { k: 1 }, { k: 1 }], cols: 1, smallPins: 4, stops: 2, clips: 4, brackets: 3, topDowels: 2, topScrews: 2, plugs: 4, walls: 1 },
  6: { rows: [{ k: 1, pair: true }, { k: 1 }, { k: 1.45 }, { k: 1.45 }, { k: 1.45 }], cols: 1, smallPins: 2, stops: 0, clips: 8, brackets: 2, topDowels: 2, topScrews: 0, plugs: 4, walls: 1 },
  8: { rows: [{ k: 1, pair: true }, { k: 1.4 }, { k: 1.4 }], cols: 2, smallPins: 4, stops: 0, clips: 8, brackets: 4, topDowels: 4, topScrews: 4, plugs: 8, walls: 2 },
};
const BENCH: ChestCfg = { rows: [{ k: 1 }], cols: 2, smallPins: 4, stops: 0, clips: 4, brackets: 4, topDowels: 4, topScrews: 0, plugs: 6, walls: 2, legH: 200, runScrews: 2, knob2: 9999, topLast: true, bottomRails: true, spacers: true };
const SPACER: HwDef = { kind: "spacer", len: 20, dia: 30 };

function buildChest(b: PlanBuilder, s: ProductSpec, cfg: ChestCfg) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const TT = 20, ov = 15, P = 45, legH = cfg.legH ?? 160;
  const xo = W / 2 - ov, xi = xo - P;
  const zf = D / 2 - ov, zb = -D / 2;
  const yTU = H - TT;
  const rs = cfg.runScrews ?? 3;
  const two = cfg.cols === 2;
  const barH = 30, railH = 40, PT = 40, DV = 18;
  const lowBar = two && !cfg.bottomRails;
  const botTop = legH + (lowBar ? barH : railH); // top of the bottom panels
  const yT = yTU - barH;
  const zFace = zf - 3; // front face of the rails and drawer fronts
  const nr = cfg.rows.length;
  const usable = yT - botTop - (nr - 1) * railH;
  const kSum = cfg.rows.reduce((a, r) => a + r.k, 0);
  // rows, top first
  const rows: { y0: number; h: number; pair: boolean }[] = [];
  let y = yT;
  for (const r of cfg.rows) {
    const h = (usable * r.k) / kSum;
    rows.push({ y0: y - h, h, pair: !!r.pair });
    y -= h + railH;
  }
  const colsX: [number, number][] = two ? [[-xi, -PT / 2], [PT / 2, xi]] : [[-xi, xi]];
  const openings: Opening[] = [];
  for (const [a, c] of colsX)
    for (const r of rows) {
      if (r.pair) {
        const w = (c - a - DV) / 2;
        openings.push({ x: a + w / 2, w, y0: r.y0, h: r.h, pair: true }, { x: c - w / 2, w, y0: r.y0, h: r.h, pair: true });
      } else openings.push({ x: (a + c) / 2, w: c - a, y0: r.y0, h: r.h, pair: false });
    }

  // the side frames: posts, a panel and a batten behind every runner
  const zIn0 = zb + P, zIn1 = zf - P;
  const runY = (o: { y0: number }) => o.y0 + 8;
  const sideFrame = (g: number) => {
    const xc = g * (xo - P / 2);
    const xb = g * (xi + 7.25);
    const pieces: PartPiece[] = [
      { shape: "box", size: [P, yTU, P], pos: [xc, yTU / 2, zf - P / 2], material: "wood" },
      { shape: "box", size: [P, yTU, P], pos: [xc, yTU / 2, zb + P / 2], material: "wood" },
      { shape: "box", size: [16, yTU - legH, zIn1 - zIn0], pos: [xc, (legH + yTU) / 2, (zIn0 + zIn1) / 2], material: "board" },
      { shape: "box", size: [14.5, 60, zIn1 - zIn0], pos: [xb, yTU - 30, (zIn0 + zIn1) / 2], material: "wood" },
      { shape: "box", size: [14.5, 60, zIn1 - zIn0], pos: [xb, legH + 30, (zIn0 + zIn1) / 2], material: "wood" },
      // a batten behind every runner (the top row's sits under the top one)
      ...rows.map((r): PartPiece => ({ shape: "box", size: [14.5, 36, zIn1 - zIn0], pos: [xb, runY(r) + 4, (zIn0 + zIn1) / 2], material: "wood" })),
    ];
    const { type, mid } = b.compound("Side frame", pieces, { material: "wood" });
    return b.place(type, mid);
  };
  const sides = [sideFrame(-1), sideFrame(1)];
  const topP = b.place(b.part("Top", [W, TT, D]), [0, H - TT / 2, 0]);
  const backRail = b.place(b.part("Back rail", [2 * xi, 80, 20], { material: "wood" }), [0, yTU - 40, zb + 35]);
  const backPanel = b.place(b.part("Back panel", [2 * xi + 16, yTU - 80 - legH, 10]), [0, (legH + yTU - 80) / 2, zb + 15]);
  const barT = b.part("Front bar", [two ? 2 * xi : 2 * xi, barH, 30], { material: "metal" });
  const bars = [b.place(barT, [0, yTU - barH / 2, zFace - 15])];
  if (lowBar) bars.push(b.place(barT, [0, legH + barH / 2, zFace - 15]));
  // front rails under every row but the last (on the single-column chests also one at the bottom)
  const rails: { key: string; x0: number; x1: number; y: number }[] = [];
  let tee = "";
  for (const [a, c] of colsX) {
    const rt = b.part("Front rail", [c - a, railH, 20], { material: "wood" });
    rows.forEach((r, i) => {
      if (i === nr - 1) return;
      const yr = r.y0 - railH / 2;
      if (r.pair && !two) return; // the divider comes with its own rail
      rails.push({ key: b.place(rt, [(a + c) / 2, yr, zFace - 10]), x0: a, x1: c, y: yr });
    });
    if (!lowBar) rails.push({ key: b.place(rt, [(a + c) / 2, legH + railH / 2, zFace - 10]), x0: a, x1: c, y: legH + railH / 2 });
  }
  const depthIn = zFace - (zb + 20);
  const zMidIn = (zFace + zb + 20) / 2;
  const dividers: { key: string; x: number; y0: number; h: number }[] = [];
  for (const [a, c] of colsX) {
    const pr = rows.find((r) => r.pair);
    if (!pr) continue;
    const x = (a + c) / 2;
    if (!two) {
      // a T: the divider between the two small drawers, on its rail
      const { type, mid } = b.compound("Divider", [
        { shape: "box", size: [DV, pr.h, depthIn], pos: [x, pr.y0 + pr.h / 2, zMidIn], material: "board" },
        { shape: "box", size: [c - a, railH, 20], pos: [x, pr.y0 - railH / 2, zFace - 10], material: "wood" },
      ]);
      tee = b.place(type, mid);
      dividers.push({ key: tee, x, y0: pr.y0, h: pr.h });
    } else dividers.push({ key: b.place(b.part("Divider", [DV, pr.h, depthIn]), [x, pr.y0 + pr.h / 2, zMidIn]), x, y0: pr.y0, h: pr.h });
  }
  let part = "";
  if (two) {
    const { type, mid } = b.compound("Middle frame", [
      { shape: "box", size: [20, yTU - 80 - legH, depthIn - 40], pos: [0, (legH + yTU - 80) / 2, zMidIn - 20], material: "board" },
      { shape: "box", size: [PT, yTU, 40], pos: [0, yTU / 2, zFace - 20], material: "wood" },
      // the block at the top back that takes the bolt through the back rail
      { shape: "box", size: [20, 80, 60], pos: [0, yTU - 40, zb + 75], material: "wood" },
      ...rows.filter((_, i) => i > 0).flatMap((r): PartPiece[] => [-1, 1].map((g) => ({ shape: "box", size: [10, 36, depthIn - 60], pos: [g * 15, runY(r) + 4, zMidIn - 20], material: "wood" }))),
    ], { material: "wood" });
    part = b.place(type, mid);
  }
  const midRail = two ? "" : b.place(b.part("Bottom rail", [40, 30, depthIn - 20]), [0, botTop - 10 - 15, zMidIn - 10]);
  const bottoms = (two ? colsX : ([[-xi, 0], [0, xi]] as [number, number][])).map(([a, c]) => b.place(b.part("Bottom panel", [c - a, 10, depthIn - 20]), [(a + c) / 2, botTop - 5, zMidIn - 10]));

  // fittings in the frame
  const runLen = Math.round((zFace - 18 - (zb + 30) - 10) / 10) * 10;
  const zRun = zFace - 21 - runLen / 2;
  const hostAt = (x: number) => {
    if (x <= -xi + 1) return sides[0];
    if (x >= xi - 1) return sides[1];
    if (two && Math.abs(x) <= PT / 2 + 1) return part;
    return dividers.reduce((a, d) => (Math.abs(d.x - x) < Math.abs(a.x - x) ? d : a)).key;
  };
  const runnerFits = (host: string) => {
    const r: FitOpts[] = [], sc: FitOpts[] = [];
    for (const o of openings)
      for (const g of [-1, 1]) {
        const wx = o.x + (g * o.w) / 2;
        if (hostAt(wx) !== host) continue;
        r.push({ on: host, at: [wx, runY(o), zRun], dir: [g, 0, 0], hole: false });
        for (const z of rs === 3 ? [zFace - 40, zRun, zFace - 21 - runLen + 20] : [zFace - 40, zFace - 21 - runLen + 20]) sc.push({ on: host, at: [wx, runY(o), z], dir: [g, 0, 0] });
      }
    return { r, sc };
  };
  const clipsPer = cfg.clips / (two ? 4 : 2);
  const clipFits = (host: string, g: number, x: number) => spread(yTU - 50, two ? yTU - 120 : legH + 60, clipsPer).map((yy): FitOpts => ({ on: host, at: [x, yy, zb + 60], dir: [g, 0, 0], hole: false }));
  const frameClips = [
    ...[0, 1].map((i) => clipFits(sides[i], sg(i), sg(i) * xi)),
    ...(two ? [clipFits(part, -1, -PT / 2), clipFits(part, 1, PT / 2)] : []),
  ];
  const stopFits = cfg.stops ? [0, 1].map((i): FitOpts => ({ on: sides[i], at: [sg(i) * xi, yTU - 20, zFace - 60], dir: [sg(i), 0, 0], hole: false })) : [];
  const sideRot = (i: number): Vec3 => [0, 0, sg(i) * -Math.PI / 2];
  const sideC = (i: number) => b.partItem(sides[i]).final.pos;
  const spacing = yTU + 120;

  step(b, { title: cfg.stops ? "Screw the clips and stops to the sides" : "Screw the clips to the sides", detail: "Lay the side frames on a rug, inside up. Use a screwdriver, not a drill.", tools: ["screwdriver"], scene: "prep", kind: "screws", warnings: ["floor"] }, () => {
    b.stagger(0.2);
    for (const i of [0, 1]) lay(b, [sides[i]], sideC(i), [sg(i) * (two ? spacing : spacing / 2), P / 2, 0], sideRot(i));
    if (two) lay(b, [part], b.partItem(part).final.pos, [0, 25, 0], [0, 0, Math.PI / 2]);
    b.then(0.15);
    const all = [...frameClips.flat(), ...stopFits];
    b.fits(FRAME_CLIP, frameClips.flat(), 0.08);
    if (stopFits.length) b.fits(STOP, stopFits, 0.1);
    b.then(0.05);
    b.fits(CLIP_SCREW_S, all.map((o) => ({ ...o, hole: undefined, at: [o.at[0] + o.dir[0] * -3, o.at[1], o.at[2]] as Vec3 })), 0.06);
  });
  const frameHosts = [sides[0], sides[1], ...(two ? [part] : [])];
  const frameRun = frameHosts.map(runnerFits);
  step(b, { title: two ? "Screw the runners to the sides and the middle frame" : "Screw the runners to the sides", detail: rs === 3 ? "Left and right runners are marked. Three screws each: front, back, then middle. Flip the levers at the front so they stand clear." : "Left and right runners are marked. Two screws each.", tools: ["screwdriver"], scene: "prep", kind: "runners" }, () => {
    frameRun.forEach((f) => b.fits(runnerDef(runLen), f.r, 0.15));
    b.then(0.1);
    frameRun.forEach((f) => b.fits(RUNNER_SCREW, f.sc, 0.04));
  });
  const brX = spread(-xi + 120, xi - 120, cfg.brackets);
  const dX = spread(-xi + 200, xi - 200, cfg.topDowels);
  const cTop: Vec3 = [0, H - TT / 2, 0];
  if (!cfg.topLast) {
  step(b, { title: "Fix the back rail to the top", detail: `Lay the top upside down on the rug. Dowels into the top, then the rail on them with ${cfg.brackets} L brackets, each held with a plastic plug into the rail and into the top.`, tools: ["hammer", "screwdriver"], scene: "top", pose: "-y", kind: "screws" }, () => {
    lay(b, [topP], cTop);
    b.then(0.1);
    b.fits(HW.dowel, dX.map((x): FitOpts => ({ on: topP, at: [x, yTU, zb + 35], dir: [0, 1, 0], mate: backRail })), 0.1);
    b.then(0.1);
    lay(b, [backRail], cTop, [0, 0, 0], [0, 0, 0], [0, -200, 0]);
    b.then(0.1);
    b.fits(L_BRACKET, brX.map((x): FitOpts => ({ on: backRail, at: [x, yTU - 20, zb + 45], dir: [0, 0, -1], hole: false })), 0.1);
    b.then(0.05);
    b.fits(SLEEVE, brX.flatMap((x): FitOpts[] => [{ on: backRail, at: [x, yTU - 30, zb + 46], dir: [0, 0, -1] }, { on: topP, at: [x, yTU - 1, zb + 62], dir: [0, 1, 0] }]), 0.06);
  });
  step(b, { title: "Hook the top onto a side", detail: "Stand the left side upside down and hook the back rail into its clips, then press down until it clicks.", pose: "-y", kind: "join" }, () => {
    b.stagger(0.25);
    for (const k of [topP, backRail]) b.add(k, [0, 0, 0]);
    b.add(sides[0], [-300, 0, 0]);
  });
  } else
    step(b, { title: "Hook the back rail onto a side", detail: "Stand the left side upside down on the rug and hook the back rail into its clips until it clicks.", pose: "-y", kind: "join", warnings: ["floor"] }, () => {
      b.stagger(0.25);
      b.add(backRail, [0, 0, -200]);
      b.add(sides[0], [-300, 0, 0]);
    });
  step(b, { title: "Put the other side on", detail: "Hook it onto the back rail the same way.", pose: "-y", kind: "join", people: two ? 2 : 1 }, () => b.add(sides[1], [300, 0, 0]));
  if (two)
    step(b, { title: "Slide in the middle frame", detail: "Between the two halves of the back rail's clips, then a long bolt through the back rail into it.", tools: ["allen"], pose: "-y", kind: "bolts" }, () => {
      b.add(part, [0, 400, 0]);
      b.then(0.15);
      b.fit(MID_BOLT, { on: backRail, at: [0, yTU - 40, zb + 25], dir: [0, 0, 1], mate: part });
    });
  step(b, { title: bars.length > 1 ? "Screw in the metal bars" : "Screw in the metal bar", detail: bars.length > 1 ? "One under the top at the front and one at the bottom, two screws in each end." : "Across the front under the top, two screws in each end.", tools: ["screwdriver"], pose: "-y", kind: "screws" }, () => {
    b.stagger(0.3);
    for (const k of bars) b.add(k, [0, 0, 250]);
    b.then(0.15);
    b.fits(BAR_SCREW, bars.flatMap((k) => [-1, 1].flatMap((g) => [-8, 8].map((dy): FitOpts => ({ on: k, at: [g * xi, b.partItem(k).final.pos[1] + dy, zFace - 15], dir: [g, 0, 0], mate: sides[g < 0 ? 0 : 1] })))), 0.05);
  });
  const railConn = rails.flatMap((r) => [[r.x0, -1], [r.x1, 1]].map(([x, g]): FitOpts => ({ on: r.key, at: [x, r.y, zFace - 10], dir: [-g, 0, 0], hole: false })));
  step(b, { title: "Push the connectors into the front rails", detail: "One in each end, pressed in until they sit flush.", pose: "-y", kind: "general" }, () => {
    b.stagger(0.1);
    for (const r of rails) b.stage(r.key, [b.partItem(r.key).final.pos[0], b.partItem(r.key).final.pos[1], zFace + 260], [0, 0, 0], [0, 0, 200]);
    b.then(0.1);
    b.fits(RAIL_CONNECTOR, railConn, 0.05);
  });
  step(b, { title: "Click the front rails in", detail: "Push each one straight back between the posts until both ends click.", pose: "-y", kind: "join" }, () => {
    b.stagger(0.15);
    for (const r of rails) b.add(r.key, [0, 0, 260]);
  });
  if (dividers.length) {
    const dRun = dividers.map((d) => runnerFits(d.key));
    step(b, { title: dividers.length > 1 ? "Screw the runners to the dividers" : "Screw the runners to the divider", detail: "One on each face, for the small drawers either side. Three screws each.", tools: ["screwdriver"], scene: "divider", kind: "runners", repeat: dividers.length > 1 ? dividers.length : undefined }, () => {
      const d = dividers[0];
      lay(b, [d.key], b.partItem(d.key).final.pos, [0, 0, 0], [0, 0, Math.PI / 2]);
      for (const k of dividers.slice(1)) lay(b, [k.key], b.partItem(k.key).final.pos, [0, 0, 600], [0, 0, Math.PI / 2]);
      b.then(0.15);
      dRun.forEach((f) => b.fits(runnerDef(runLen), f.r, 0.2));
      b.then(0.1);
      dRun.forEach((f) => b.fits(RUNNER_SCREW, f.sc, 0.05));
    });
    step(b, { title: dividers.length > 1 ? "Hook the dividers in" : "Click the divider in", detail: two ? "Between the top bar and the front rail of each half, in the middle." : "Its rail clicks in between the sides like the others, the divider standing in the middle of the top row.", pose: "-y", kind: "join" }, () => {
      b.stagger(0.2);
      for (const d of dividers) b.add(d.key, [0, 0, 300]);
    });
  }
  step(b, { title: "Slide in the back panel", detail: two ? "Down the grooves in the back posts, then two screws through it into the middle frame." : "Down the grooves in the back posts until it meets the back rail.", tools: two ? ["screwdriver"] : undefined, pose: "-y", kind: two ? "screws" : "join" }, () => {
    b.add(backPanel, [0, 500, 0]);
    if (two) {
      b.then(0.15);
      b.fits(HW.screwM, [0.35, 0.7].map((t): FitOpts => ({ on: backPanel, at: [0, legH + (yTU - 80 - legH) * t, zb + 10], dir: [0, 0, 1], mate: part })), 0.15);
    }
  });
  if (!two) {
    step(b, { title: "Tap the dowels into the bottom rail", detail: "Two in each end and two along the top.", tools: ["hammer"], scene: "prep", kind: "dowels" }, () => {
      lay(b, [midRail], b.partItem(midRail).final.pos, [0, 15, 0]);
      b.then(0.1);
      const it = b.partItem(midRail).final.pos;
      const L2 = (depthIn - 20) / 2;
      b.fits(HW.dowel, [
        ...[-1, 1].flatMap((g) => [-10, 10].map((dx): FitOpts => ({ on: midRail, at: [dx, it[1], it[2] + g * L2], dir: [0, 0, -g] }))),
        ...[-0.4, 0.4].map((t): FitOpts => ({ on: midRail, at: [0, it[1] + 15, it[2] + t * L2], dir: [0, -1, 0] })),
      ], 0.08);
    });
    step(b, { title: "Put the bottom rail in", detail: "Front to back in the middle, onto the front rail and the back panel.", pose: "-y", kind: "join" }, () => b.add(midRail, [0, 300, 0]));
  }
  step(b, { title: "Slide in the bottom panels", detail: "From the front, one each side, along the grooves.", pose: "-y", kind: "join" }, () => {
    b.stagger(0.3);
    for (const k of bottoms) b.add(k, [0, 0, 500]);
  });
  if (!two)
    step(b, { title: "Screw the bottom panels to the rail", detail: "Two screws through each into the bottom rail, with the Allen key.", tools: ["allen"], pose: "-y", kind: "screws" }, () => {
      const it = b.partItem(midRail).final.pos;
      b.fits(BIG_SCREW, [-1, 1].flatMap((g) => [-0.3, 0.3].map((t): FitOpts => ({ on: bottoms[g < 0 ? 0 : 1], at: [g * 12, botTop, it[2] + t * depthIn], dir: [0, -1, 0], mate: midRail }))), 0.1);
    });
  step(b, { title: "Push in the plastic plugs", detail: "Through the holes in the bottom panels into the front rail, then press each pin into its plug.", pose: "-y", kind: "general" }, () => {
    const per = cfg.plugs / bottoms.length;
    b.fits(BOTTOM_PLUG, bottoms.flatMap((k) => {
      const p = b.partItem(k).final.pos, w = b.parts.find((t) => t.id === b.partItem(k).ref)!.size[0];
      return spread(p[0] - w / 2 + 60, p[0] + w / 2 - 60, per).map((x): FitOpts => ({ on: k, at: [x, botTop - 10, zFace - 25 - (two ? 0 : 0)], dir: [0, 1, 0], hole: false }));
    }), 0.08);
  });
  const feet: FitOpts[] = [
    ...[0, 1].flatMap((i) => [zf - P / 2, zb + P / 2].map((z): FitOpts => ({ on: sides[i], at: [sg(i) * (xo - P / 2), 0, z], dir: [0, 1, 0], hole: 3 }))),
    ...(two ? [{ on: part, at: [0, 0, zFace - 20] as Vec3, dir: [0, 1, 0] as Vec3, hole: 3 }] : []),
  ];
  step(b, { title: "Screw in the feet", detail: `One in the end of each ${two ? "leg" : "post"}, all the way in for now.`, pose: "-y", kind: "legs" }, () => b.fits(ADJ_FOOT, feet, 0.12));
  if (cfg.topLast) {
    const brk = brX.map((x, i): { key: string; x: number; z: number } => (i % 2 ? { key: bars[0], x, z: zFace - 30 } : { key: backRail, x, z: zb + 45 }));
    step(b, { title: "Turn it over and screw on the L brackets", detail: "Two on the back rail and two on the front bar, each held with a plastic plug.", tools: ["screwdriver"], people: 2, kind: "screws" }, () => {
      b.fits(L_BRACKET, brk.map((k): FitOpts => ({ on: k.key, at: [k.x, yTU - 20, k.z], dir: [0, 0, k.z > 0 ? 1 : -1], hole: false })), 0.12);
      b.then(0.05);
      b.fits(SLEEVE, brk.map((k): FitOpts => ({ on: k.key, at: [k.x, yTU - 30, k.z + (k.z > 0 ? -1 : 1)], dir: [0, 0, k.z > 0 ? 1 : -1] })), 0.08);
    });
    step(b, { title: "Tap the dowels in and put the top on", detail: "One dowel in the top of each corner leg. Lay the top on and push a plug up through each bracket into it.", tools: ["hammer"], kind: "join" }, () => {
      b.fits(HW.dowel, [0, 1].flatMap((i) => [zf - P / 2, zb + P / 2].map((z): FitOpts => ({ on: sides[i], at: [sg(i) * (xo - P / 2), yTU, z], dir: [0, -1, 0], mate: topP }))), 0.1);
      b.then(0.1);
      b.add(topP, [0, 300, 0]);
      b.then(0.15);
      b.fits(SLEEVE, brk.map((k): FitOpts => ({ on: topP, at: [k.x, yTU - 1, k.z + (k.z > 0 ? -18 : 18)], dir: [0, 1, 0] })), 0.08);
    });
  } else
    step(b, { title: cfg.topScrews ? "Turn it over and screw the top to the front bar" : "Turn the chest over", detail: cfg.topScrews ? `Stand it on its feet. ${cfg.topScrews} screws up through the front bar into the top, with the Allen key.` : "Stand it on its feet, two of you if it's heavy.", tools: cfg.topScrews ? ["allen"] : undefined, people: two ? 2 : 1, kind: cfg.topScrews ? "screws" : "standup" }, () => {
    if (cfg.topScrews) b.fits(BIG_SCREW, spread(-xi + 150, xi - 150, cfg.topScrews).map((x): FitOpts => ({ on: bars[0], at: [x, yTU - barH, zFace - 15], dir: [0, 1, 0], mate: topP })), 0.12);
  });
  step(b, { title: "Level it with the feet", detail: "Turn each foot until the chest stands steady and doesn't rock.", kind: "general" });
  // the wall fixing: a sliding bracket on the back rail, a plate on the wall
  const wx = spread(-xi / 2, xi / 2, cfg.walls).map((x) => (cfg.walls === 1 ? xi / 2 : x));
  if (cfg.spacers)
    step(b, { title: "Fix it to the wall", detail: "Two spacers behind the back rail, a screw through each into the wall. Pick plugs and screws that suit your wall.", tools: ["screwdriver", "drill", "pencil"], kind: "anchor", wall: true, warnings: ["wall", "tip"] }, () => {
      b.fits(SPACER, wx.map((x): FitOpts => ({ on: backRail, at: [x, yTU - 40, zb + 25], dir: [0, 0, 1], hole: false })), 0.15);
      b.then(0.1);
      b.fits(WALL_PLUG, wx.map((x): FitOpts => ({ at: [x, yTU - 40, zb - 30], dir: [0, 0, -1] })), 0.1);
      b.fits(HW.washer, wx.map((x): FitOpts => ({ on: backRail, at: [x, yTU - 40, zb + 46], dir: [0, 0, -1], hole: false })), 0.1);
      b.fits(WALL_SCREW, wx.map((x): FitOpts => ({ on: backRail, at: [x, yTU - 40, zb + 47], dir: [0, 0, -1] })), 0.1);
    });
  else
  step(b, { title: "Fix it to the wall", detail: "Screw the sliding bracket to the back rail, then the wall plate to the wall and join them with the long screw. Pick plugs and screws that suit your wall.", tools: ["screwdriver", "drill", "pencil"], kind: "anchor", wall: true, warnings: ["wall", "tip"] }, () => {
    b.fits(SLIDE_BRACKET, wx.map((x): FitOpts => ({ on: backRail, at: [x, yTU - 30, zb + 25], dir: [0, 0, 1], hole: false })), 0.15);
    b.then(0.05);
    b.fits(HW.screwS, wx.map((x): FitOpts => ({ on: backRail, at: [x, yTU - 30, zb + 26], dir: [0, 0, -1] })), 0.15);
    b.then(0.1);
    b.fits(WALL_PLUG, wx.flatMap((x) => [-25, 25].map((dx): FitOpts => ({ at: [x + dx, yTU - 30, zb - 30], dir: [0, 0, -1] }))), 0.08);
    b.fits(WALL_PLATE, wx.map((x): FitOpts => ({ at: [x, yTU - 30, zb - 28], dir: [0, 0, -1] })), 0.1);
    b.fits(HW.washer, wx.flatMap((x) => [-25, 25].map((dx): FitOpts => ({ at: [x + dx, yTU - 30, zb - 26], dir: [0, 0, -1] }))), 0.08);
    b.fits(WALL_SCREW, wx.flatMap((x) => [-25, 25].map((dx): FitOpts => ({ at: [x + dx, yTU - 30, zb - 25], dir: [0, 0, -1] }))), 0.08);
    b.then(0.05);
    b.fits(HW.screwM, wx.map((x): FitOpts => ({ on: backRail, at: [x, yTU - 30, zb - 20], dir: [0, 0, 1] })), 0.1);
  });
  chestDrawers(b, openings, { zFace, zBack: zb + 30, runLen, smallPins: cfg.smallPins, stops: true, runScrews: rs, knob2: cfg.knob2, word: cfg.word });
  return true;
}

interface DrawerMade {
  o: Opening;
  front: string;
  sides: [string, string];
  bottom: string;
  back: string;
  xs: number;
  ys: number;
  sh: number;
  dd: number;
  pins: number;
  knobs: number;
  stop: boolean;
}

/** GULLABERG drawers built on their fronts. One of each size is built on screen; the rest slide in finished. */
function chestDrawers(b: PlanBuilder, list: Opening[], o: { zFace: number; zBack: number; runLen: number; smallPins: number; stops: boolean; word?: string; runScrews?: 2 | 3; knob2?: number }) {
  const ft = 18, st = 14;
  const zIn = o.zFace - ft;
  const made: DrawerMade[] = list.map((op) => {
    const fw = op.w - 4, fh = op.h - 4;
    const xs = op.w / 2 - 13 - st / 2;
    const sh = Math.max(70, Math.min(fh - 40, 240));
    const dd = Math.round((zIn - o.zBack) / 10) * 10;
    const ys = op.y0 + 14;
    const zd = zIn - dd / 2;
    const frT = b.part("Drawer front", [fw, fh, ft]);
    const sdT = b.part("Drawer side", [st, sh, dd]);
    const btT = b.part("Drawer bottom", [2 * xs - 4, 3, dd - 16], { material: "fiber" });
    const bkT = b.part("Drawer back", [2 * xs - st, sh - 16, st]);
    const small = op.pair || op.h < 180;
    return {
      o: op,
      xs,
      sh,
      dd,
      ys,
      front: b.place(frT, [op.x, op.y0 + 2 + fh / 2, o.zFace - ft / 2]),
      sides: [b.place(sdT, [op.x - xs, ys + sh / 2, zd]), b.place(sdT, [op.x + xs, ys + sh / 2, zd])],
      bottom: b.place(btT, [op.x, ys + 10, zd - 6]),
      back: b.place(bkT, [op.x, ys + 16 + (sh - 16) / 2, zIn - dd + st / 2]),
      pins: small ? o.smallPins : 4,
      knobs: op.w > (o.knob2 ?? 450) ? 2 : 1,
      stop: o.stops && !op.pair,
    };
  });
  const fitsOf = (d: DrawerMade) => {
    const { o: op, xs, ys, sh, dd } = d;
    const zBk = zIn - dd + st / 2;
    const per = d.pins / 2;
    const py = per === 1 ? [ys + 16 + (sh - 16) / 2] : [ys + 30, ys + sh - 25];
    const kx = d.knobs === 2 ? [op.x - op.w * 0.27, op.x + op.w * 0.27] : [op.x];
    const ky = op.y0 + op.h / 2;
    return {
      stop: d.stop ? [{ on: d.back, at: [op.x, ys + sh, zBk] as Vec3, dir: [0, -1, 0] as Vec3, hole: false as const }] : [],
      pins: [-1, 1].flatMap((g) => py.map((yy): FitOpts => ({ on: d.back, at: [op.x + g * (xs - st / 2), yy, zBk], dir: [g, 0, 0], mate: d.sides[g < 0 ? 0 : 1], mateHole: 4 }))),
      cams: [-1, 1].flatMap((g) => py.map((yy): FitOpts => ({ on: d.sides[g < 0 ? 0 : 1], at: [op.x + g * (xs + st / 2), yy, zBk], dir: [-g, 0, 0] }))),
      runners: [-1, 1].map((g): FitOpts => ({ on: d.sides[g < 0 ? 0 : 1], at: [op.x + g * xs, ys, zIn - 10 - o.runLen / 2], dir: [0, 1, 0], hole: false })),
      runnerScrews: [-1, 1].flatMap((g) => ((o.runScrews ?? 3) === 3 ? [zIn - 30, zIn - 10 - o.runLen / 2, zIn - o.runLen + 10] : [zIn - 30, zIn - o.runLen + 10]).map((z): FitOpts => ({ on: d.sides[g < 0 ? 0 : 1], at: [op.x + g * xs, ys - 2, z], dir: [0, 1, 0] }))),
      knobs: kx.map((x): FitOpts => ({ on: d.front, at: [x, ky, o.zFace], dir: [0, 0, -1], hole: false })),
      knobScrews: kx.map((x): FitOpts => ({ on: d.front, at: [x, ky, zIn - 4], dir: [0, 0, 1] })),
    };
  };
  // one of each size is built on screen, side by side
  const kinds = new Map<string, DrawerMade[]>();
  for (const d of made) {
    const k = `${Math.round(d.o.w)}x${Math.round(d.o.h)}`;
    kinds.set(k, [...(kinds.get(k) ?? []), d]);
  }
  const shown = [...kinds.values()].map((g) => g[0]);
  const n = made.length;
  const word = o.word ?? "drawer";
  const rep = n > 1 ? n : undefined;
  const c0 = (d: DrawerMade): Vec3 => [d.o.x, d.ys + d.sh / 2, zIn - d.dd / 2];
  const gap = Math.max(...shown.map((d) => d.o.w)) + 200;
  const offs = shown.map((_, i) => (i - (shown.length - 1) / 2) * gap);
  const stageD = (d: DrawerMade, i: number, k: string, from?: Vec3) => lay(b, [k], c0(d), [offs[i], 0, 0], [0, 0, 0], from ?? [0, 160, 0]);
  const fs = shown.map(fitsOf);
  const each = (fn: (d: DrawerMade, i: number) => void) => shown.forEach((d, i) => fn(d, i));
  const dstep = (title: string, detail: string, body: () => void, x: { tools?: ToolId[]; kind?: StepKind; pose?: Pose } = {}) =>
    step(b, { title, detail, tools: x.tools, scene: "drawer", pose: x.pose ?? "-z", repeat: rep, kind: x.kind ?? "drawer" }, body);
  dstep(`Hook the sides onto the ${word} front`, "Front face down on a rug. Slide each side's hooks into the slots in the front and push down until they lock.", () => {
    b.stagger(0.2);
    each((d, i) => stageD(d, i, d.front, [0, 0, -160]));
    b.then(0.15);
    each((d, i) => d.sides.forEach((k, j) => stageD(d, i, k, [(j ? 1 : -1) * 120, 0, -200])));
  }, { kind: "join" });
  dstep("Slide in the bottom", "Smooth side up, down the grooves until it reaches the front.", () => each((d, i) => stageD(d, i, d.bottom, [0, 0, -420])));
  const anyStop = shown.some((d) => d.stop);
  if (anyStop)
    dstep("Clip the stop onto the drawer back", "The wire stop hooks over the top edge of the back, the right way round. It stops the drawer coming all the way out.", () => {
      each((d, i) => stageD(d, i, d.back, [0, 0, -260]));
      b.then(0.15);
      each((_, i) => b.fits(DRAWER_STOP, fs[i].stop, 0.2));
    }, { kind: "general" });
  dstep("Put the back on", "Press the plastic pins into the ends of the back, then push it down between the sides.", () => {
    if (!anyStop) each((d, i) => stageD(d, i, d.back, [0, 0, -260]));
    else each((d, i) => (d.stop ? undefined : stageD(d, i, d.back, [0, 0, -260])));
    b.then(0.15);
    each((_, i) => b.fits(DRAWER_PIN, fs[i].pins, 0.08));
  }, { kind: "join" });
  dstep("Lock the cam locks", "In the outside of each side, then a clockwise turn until it pulls tight.", () => each((_, i) => b.fits(DRAWER_CAM, fs[i].cams, 0.1)), { tools: ["screwdriver"], kind: "cams" });
  dstep("Screw the runners onto the drawer", (o.runScrews ?? 3) === 3 ? "Stand it up. Left and right are marked: hook each one on at the front, then three screws." : "Stand it up. Left and right are marked: hook each one on at the front, then two screws.", () => {
    each((_, i) => b.fits(runnerDef(o.runLen), fs[i].runners, 0.25));
    b.then(0.1);
    each((_, i) => b.fits(RUNNER_SCREW, fs[i].runnerScrews, 0.05));
  }, { tools: ["screwdriver"], kind: "runners", pose: "+y" });
  dstep(shown.every((d) => d.knobs === 1) ? "Screw on the knob" : "Screw on the knobs", "The screw goes in from inside the drawer. Snug is enough.", () => {
    each((_, i) => b.fits(HW.knob, fs[i].knobs, 0.2));
    b.then(0.05);
    each((_, i) => b.fits(KNOB_SCREW, fs[i].knobScrews, 0.15));
  }, { tools: ["screwdriver"], kind: "screws", pose: "+y" });
  step(b, { title: n > 2 ? `Slide in all ${n} ${word}s` : n === 2 ? `Slide in both ${word}s` : `Slide in the ${word}`, detail: "Pull the runners in the frame out, rest the drawer on them and push it in until it clicks. Open only one at a time.", kind: "drawer", warnings: ["tip"] }, () => {
    for (const d of made) {
      b.stagger(0);
      for (const k of [d.front, ...d.sides, d.bottom, d.back]) b.add(k, [0, 0, 520]);
      if (!shown.includes(d)) {
        const f = fitsOf(d);
        const all: [HwDef, FitOpts[]][] = [
          [DRAWER_STOP, f.stop],
          [DRAWER_PIN, f.pins],
          [DRAWER_CAM, f.cams],
          [runnerDef(o.runLen), f.runners],
          [RUNNER_SCREW, f.runnerScrews],
          [HW.knob, f.knobs],
          [KNOB_SCREW, f.knobScrews],
        ];
        for (const [def, l] of all) for (const x of l) b.preset(def, x);
      }
      b.wait(0.22);
    }
  });
}


/* ---------- bedside tables ---------- */

/*
 * Bedside tables (with a drawer and a shelf; with a drawer and a door): the sides are ready frames. They lie on a
 * rug for the runners and cam bolts, the boards take dowels, then the table is built lying on its left side: the
 * back and the rails stand in it, cams, the other side on top and cams again. Upside down for the glides, upright
 * for the top on dowels, cam bolts and cams. The shelf rests on supports (or pins behind the door), the door hangs
 * on two hinges, and the drawer is built on its front: cam bolts, side dowels, cams, the bottom slid in, the back on
 * push-in pins and cams, runners and a knob.
 */

const TABLE_BOLT: HwDef = HW.camScrew;
const TABLE_CAM: HwDef = HW.cam;
const TABLE_CAM2: HwDef = { kind: "cam", len: 12, dia: 17 };
const SHELF_SUPPORT: HwDef = { kind: "pin", len: 16, dia: 8 };
const SHELF_PIN: HwDef = HW.pin;
const STRAP: HwDef = { kind: "strap", len: 160, dia: 25 };
const HINGE_PLATE: HwDef = { kind: "plate", len: 40, dia: 20 };
const HINGE_SCREW: HwDef = { kind: "screw", len: 14, dia: 4 };
const BUMPER: HwDef = { kind: "glide", len: 3, dia: 10 };

interface Board {
  key: string;
  y: number; // centre height
  z: number; // centre depth
  h: number; // height (vertical boards) or thickness
  d: number; // depth along z
  flat: boolean; // lies flat (a shelf) or stands (the back, a rail)
}

/** Fittings at both ends of a board where it meets the side frames. */
function boardJoint(bd: Board, xi: number, sides: string[], o: { dowels: number; cams: number; camFace: Vec3 }) {
  const span = bd.flat ? bd.d : bd.h;
  const thick = bd.flat ? bd.h : bd.d;
  // points along the board's end, front to back (flat) or bottom to top (standing)
  const at = (t: number): [number, number] => (bd.flat ? [bd.y, bd.z + t] : [bd.y + t, bd.z]);
  const dT = o.dowels > 1 ? spread(-span / 2 + Math.min(30, span / 4), span / 2 - Math.min(30, span / 4), o.dowels) : [o.cams ? -span / 4 : 0];
  const cT = o.cams >= 2 ? [-span / 5, span / 5] : o.dowels > 1 ? [0] : [span / 4];
  const dw: FitOpts[] = [], bolts: FitOpts[] = [], cams: FitOpts[] = [];
  for (const g of [-1, 1]) {
    const side = sides[g < 0 ? 0 : 1];
    for (const t of dT) {
      const [y, z] = at(t);
      dw.push({ on: bd.key, at: [g * xi, y, z], dir: [-g, 0, 0], mate: side });
    }
    for (const t of cT.slice(0, o.cams)) {
      const [y, z] = at(t);
      const f = o.camFace;
      bolts.push({ on: side, at: [g * xi, y, z], dir: [g, 0, 0], mate: bd.key, mateHole: 4 });
      cams.push({ on: bd.key, at: [g * (xi - 30), y - (f[1] * thick) / 2, z - (f[2] * thick) / 2], dir: f });
    }
  }
  return { dw, bolts, cams };
}

function buildTable(b: PlanBuilder, s: ProductSpec, door: boolean) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const TT = 20, ov = 15, P = 40, legH = 150;
  const xo = W / 2 - ov, xi = xo - P;
  const zf = D / 2 - ov, zb = -D / 2;
  const yTU = H - TT;
  const zFace = zf - 3;
  const railH = 40;
  const dh = door ? 130 : 150; // drawer opening
  const yD0 = yTU - railH - dh; // bottom of the drawer opening
  const ySide0 = door ? legH : yD0 - railH; // the side panels: full height behind a door, only round the drawer otherwise
  const zIn0 = zb + P, zIn1 = zf - P;
  const sideFrame = (g: number) => {
    const xc = g * (xo - P / 2);
    const pieces: PartPiece[] = [
      { shape: "box", size: [P, yTU, P], pos: [xc, yTU / 2, zf - P / 2], material: "wood" },
      { shape: "box", size: [P, yTU, P], pos: [xc, yTU / 2, zb + P / 2], material: "wood" },
      { shape: "box", size: [16, yTU - ySide0, zIn1 - zIn0], pos: [xc, (ySide0 + yTU) / 2, (zIn0 + zIn1) / 2], material: "board" },
      { shape: "box", size: [P / 2 + 4, 36, zIn1 - zIn0], pos: [g * (xi + P / 4 + 2), yD0 + 4, (zIn0 + zIn1) / 2], material: "wood" },
      ...(door ? [] : [{ shape: "box", size: [P - 10, 40, zIn1 - zIn0], pos: [g * (xo - P / 2 - 5), legH + 20, (zIn0 + zIn1) / 2], material: "wood" } as PartPiece]),
    ];
    const { type, mid } = b.compound("Side frame", pieces, { material: "wood" });
    return b.place(type, mid);
  };
  const sides = [sideFrame(-1), sideFrame(1)];
  const topP = b.place(b.part("Top", [W, TT, D]), [0, H - TT / 2, 0]);
  const backY0 = door ? legH : yD0 - railH;
  const back: Board = { key: b.place(b.part("Back panel", [2 * xi, yTU - backY0, 16]), [0, (backY0 + yTU) / 2, zb + P / 2]), y: (backY0 + yTU) / 2, z: zb + P / 2, h: yTU - backY0, d: 16, flat: false };
  const railT = b.part("Front rail", [2 * xi, railH, 20], { material: "wood" });
  const rail = (y: number): Board => ({ key: b.place(railT, [0, y, zFace - 10]), y, z: zFace - 10, h: railH, d: 20, flat: false });
  const topRail = rail(yTU - railH / 2);
  const midRail = rail(yD0 - railH / 2);
  const shelfD = zFace - 20 - (zb + P / 2 + 8);
  const shelfZ = (zFace - 20 + zb + P / 2 + 8) / 2;
  const flat = (name: string, y: number, w = 2 * xi, d = shelfD, z = shelfZ): Board => ({ key: b.place(b.part(name, [w, 18, d]), [0, y, z]), y, z, h: 18, d, flat: true });
  const botY = legH + 9;
  const bottom = door ? flat("Bottom shelf", botY + 20, 2 * xi, zFace - (zb + P / 2 + 8), (zFace + zb + P / 2 + 8) / 2) : null;
  const botRail = door ? rail(legH + railH / 2 + 2) : null;
  const midShelf = door ? flat("Middle shelf", yD0 - railH - 9) : null;
  const shelf = door ? flat("Shelf", (legH + 40 + yD0 - railH) / 2, 2 * xi - 4, shelfD - 30) : flat("Shelf", legH + 49, 2 * xi + 2 * (P - 15) - 4, zIn1 - zIn0 + P);
  const doorH = yD0 - railH - 18 - (legH + 40);
  const doorP = door ? b.place(b.part("Door", [2 * xi - 4, doorH, 18]), [0, legH + 40 + doorH / 2, zFace - 9]) : "";

  const people = 1 as const;
  void people;
  // drawer first on the shelf table, last on the door table (as the manuals do)
  const opening: Opening = { x: 0, w: 2 * xi, y0: yD0, h: dh, pair: false };
  const drawer = boxDrawer(b, opening, { zFace, zBack: zb + P + 10, pins: door ? 2 : 4 });
  if (!door) drawer.build();

  const runLen = drawer.runLen, zRun = zFace - 21 - runLen / 2;
  const frameRun = [0, 1].map((i) => ({ on: sides[i], at: [sg(i) * xi, yD0 + 8, zRun] as Vec3, dir: [sg(i), 0, 0] as Vec3, hole: false as const }));
  const frameRunSc = [0, 1].flatMap((i) => [zFace - 40, zFace - 21 - runLen + 20].map((z): FitOpts => ({ on: sides[i], at: [sg(i) * xi, yD0 + 8, z], dir: [sg(i), 0, 0] })));
  const sideRot = (i: number): Vec3 => [0, 0, sg(i) * -Math.PI / 2];
  const sideC = (i: number) => b.partItem(sides[i]).final.pos;
  step(b, { title: "Screw the runners to the sides", detail: "Lay both side frames on a rug, inside up. Left and right runners are marked; two screws each.", tools: ["screwdriver"], scene: "prep", kind: "runners", warnings: ["floor"] }, () => {
    b.stagger(0.2);
    for (const i of [0, 1]) lay(b, [sides[i]], sideC(i), [sg(i) * (yTU / 2 + 80), P / 2, 0], sideRot(i));
    b.then(0.15);
    b.fits(runnerDef(runLen), frameRun, 0.2);
    b.then(0.1);
    b.fits(RUNNER_SCREW, frameRunSc, 0.06);
  });
  const backFace: Vec3 = [0, 0, -1], railFace: Vec3 = [0, 0, 1], shelfFace: Vec3 = [0, -1, 0];
  const joints = door
    ? [
        boardJoint(back, xi, sides, { dowels: 2, cams: 1, camFace: backFace }),
        boardJoint(bottom!, xi, sides, { dowels: 2, cams: 1, camFace: shelfFace }),
        boardJoint(topRail, xi, sides, { dowels: 1, cams: 1, camFace: railFace }),
        boardJoint(botRail!, xi, sides, { dowels: 1, cams: 1, camFace: railFace }),
      ]
    : [
        boardJoint(back, xi, sides, { dowels: 2, cams: 1, camFace: backFace }),
        boardJoint(topRail, xi, sides, { dowels: 1, cams: 1, camFace: railFace }),
        boardJoint(midRail, xi, sides, { dowels: 1, cams: 1, camFace: railFace }),
      ];
  const midJ = door ? [boardJoint(midShelf!, xi, sides, { dowels: 2, cams: 0, camFace: shelfFace })] : [];
  const half = (l: FitOpts[], g: number) => l.filter((f) => Math.sign(f.at[0]) === g);
  step(b, { title: "Screw the cam bolts into the sides", detail: `${joints.length} in each side, where the back and the ${door ? "shelves and rails" : "rails"} meet it.`, tools: ["screwdriver"], scene: "prep", kind: "cams" }, () =>
    b.fits(TABLE_BOLT, joints.flatMap((j) => j.bolts), 0.08),
  );
  const boards = door ? [back, bottom!, topRail, botRail!] : [back, topRail, midRail];
  step(b, { title: "Tap the dowels into the back and the rails", detail: door ? "Two in each end of the back and the bottom shelf, one in each end of the rails." : "Two in each end of the back, one in each end of the rails.", tools: ["hammer"], scene: "boards", kind: "dowels" }, () => {
    b.stagger(0.15);
    boards.forEach((bd, i) => lay(b, [bd.key], b.partItem(bd.key).final.pos, [0, 20, (i - (boards.length - 1) / 2) * 260], [bd.flat ? 0 : -Math.PI / 2, 0, 0]));
    b.then(0.15);
    b.fits(HW.dowel, joints.flatMap((j) => j.dw), 0.05);
  });
  step(b, { title: door ? "Stand the back and the bottom shelf in a side" : "Stand the back in a side", detail: "Lay the left side on the rug, inside up, and push the dowels and bolts into their holes.", pose: "+x", kind: "join", warnings: ["floor"] }, () => {
    b.add(sides[0], [-200, 0, 0]);
    b.then(0.1);
    b.add(back.key, [200, 0, 0]);
    if (door) b.add(bottom!.key, [200, 0, 0]);
  });
  step(b, { title: "Stand the front rails in", detail: door ? "The top rail and the bottom rail." : "One above and one below the drawer.", pose: "+x", kind: "join" }, () => {
    b.stagger(0.25);
    for (const r of door ? [topRail, botRail!] : [topRail, midRail]) b.add(r.key, [200, 0, 0]);
  });
  step(b, { title: "Lock the cam locks", detail: "Arrow towards the bolt, then turn clockwise until it pulls tight.", tools: ["screwdriver"], pose: "+x", kind: "cams" }, () => b.fits(TABLE_CAM, joints.flatMap((j) => half(j.cams, -1)), 0.12));
  if (door) {
    step(b, { title: "Put the middle rail and the middle shelf in", detail: "The rail under the drawer has its pegs in already. Tap two dowels into each end of the shelf and stand it in under the rail.", tools: ["hammer"], pose: "+x", kind: "dowels" }, () => {
      b.add(midRail.key, [200, 0, 0]);
      b.then(0.1);
      b.fits(HW.dowel, half(midJ[0].dw, -1).concat(half(midJ[0].dw, 1)), 0.08);
      b.then(0.1);
      b.add(midShelf!.key, [200, 0, 0]);
    });
  }
  step(b, { title: "Put the other side on", detail: "Lower it onto all the dowels and bolts at once, then lock its cam locks.", tools: ["screwdriver"], pose: "+x", kind: "cams" }, () => {
    b.add(sides[1], [300, 0, 0]);
    b.then(0.15);
    b.fits(TABLE_CAM, joints.flatMap((j) => half(j.cams, 1)), 0.12);
  });
  step(b, { title: "Turn it upside down and push in the glides", detail: "One in the end of each leg.", pose: "-y", kind: "legs" }, () =>
    b.fits(POST_GLIDE, [0, 1].flatMap((i) => [zf - P / 2, zb + P / 2].map((z): FitOpts => ({ on: sides[i], at: [sg(i) * (xo - P / 2), 0, z], dir: [0, 1, 0], hole: false }))), 0.1),
  );
  const topDowels = [0, 1].flatMap((i) => [zf - P / 2, zb + P / 2].map((z): FitOpts => ({ on: sides[i], at: [sg(i) * (xo - P / 2), yTU, z], dir: [0, -1, 0], mate: topP })));
  step(b, { title: "Stand it up and tap the dowels into the legs", detail: "One in the top of each leg.", tools: ["hammer"], kind: "dowels" }, () => b.fits(HW.dowel, topDowels, 0.1));
  const topBolts = [0, 1].flatMap((i) => [zf - 90, zb + 90].map((z): FitOpts => ({ on: topP, at: [sg(i) * (xi - 10), yTU, z], dir: [0, 1, 0], mate: sides[i], mateHole: 4 })));
  step(b, { title: "Screw the cam bolts into the top", detail: "Lay it upside down on the rug. Four, near the corners.", tools: ["screwdriver"], scene: "top", pose: "-y", kind: "cams" }, () => {
    lay(b, [topP], [0, H - TT / 2, 0]);
    b.then(0.15);
    b.fits(TABLE_BOLT, topBolts, 0.1);
  });
  step(b, { title: "Put the top on and lock it", detail: "Onto the dowels and bolts, then turn the four cam locks inside the sides.", tools: ["screwdriver"], kind: "cams" }, () => {
    b.add(topP, [0, 300, 0]);
    b.then(0.2);
    b.fits(TABLE_CAM2, [0, 1].flatMap((i) => [zf - 90, zb + 90].map((z): FitOpts => ({ on: sides[i], at: [sg(i) * xi, yTU - 25, z], dir: [sg(i), 0, 0] }))), 0.12);
  });
  if (door) {
    step(b, { title: "Strap it to the wall", detail: "Screw the strap under the top at the back, then to the wall through a washer. Pick a plug and screw that suit your wall.", tools: ["screwdriver", "drill", "pencil"], kind: "anchor", wall: true, warnings: ["wall", "tip"] }, () => {
      b.fit(STRAP, { on: back.key, at: [0, yTU - 20, zb], dir: [0, -1, 0], travel: 60 });
      b.then(0.1);
      b.fits(HW.washer, [{ on: back.key, at: [0, yTU - 30, zb - 1], dir: [0, 0, 1], hole: false }, { at: [0, yTU + 20, zb - 30], dir: [0, 0, -1], hole: false }], 0.1);
      b.fit(HW.screwS, { on: back.key, at: [0, yTU - 30, zb - 2], dir: [0, 0, 1] });
      b.then(0.1);
      b.fit(WALL_PLUG, { at: [0, yTU + 20, zb - 34], dir: [0, 0, -1] });
      b.fit(WALL_SCREW, { at: [0, yTU + 20, zb - 28], dir: [0, 0, -1] });
    });
    const pinY = shelf ? b.partItem(shelf.key).final.pos[1] - 9 : 0;
    step(b, { title: "Push in the shelf pins and lay the shelf on", detail: "Four pins at the same height behind the door.", kind: "shelves" }, () => {
      b.fits(SHELF_PIN, [0, 1].flatMap((i) => [zFace - 60, zb + P + 40].map((z): FitOpts => ({ on: sides[i], at: [sg(i) * xi, pinY - 3, z], dir: [sg(i), 0, 0] }))), 0.08);
      b.then(0.1);
      b.add(shelf.key, [0, 0, 300]);
    });
    const hy = [legH + 40 + 70, legH + 40 + doorH - 70];
    step(b, { title: "Screw the hinge plates to the side", detail: "Inside the left front leg, two screws each.", tools: ["screwdriver"], kind: "hinges" }, () => {
      b.fits(HINGE_PLATE, hy.map((y): FitOpts => ({ on: sides[0], at: [-xi, y, zFace - 40], dir: [-1, 0, 0], hole: false })), 0.15);
      b.then(0.05);
      b.fits(HINGE_SCREW, hy.flatMap((y) => [-12, 12].map((dz): FitOpts => ({ on: sides[0], at: [-xi + 2, y, zFace - 40 + dz], dir: [-1, 0, 0] }))), 0.06);
    });
    step(b, { title: "Screw the hinges to the door", detail: "Lay the door face down. Hinges in the round holes, two screws each.", tools: ["screwdriver"], scene: "door", pose: "-z", kind: "hinges" }, () => {
      lay(b, [doorP], b.partItem(doorP).final.pos);
      b.then(0.15);
      b.fits(HW.hinge, hy.map((y): FitOpts => ({ on: doorP, at: [-xi + 40, y, zFace - 18], dir: [0, 0, 1] })), 0.15);
      b.then(0.05);
      b.fits(HINGE_SCREW, hy.flatMap((y) => [-15, 15].map((dy): FitOpts => ({ on: doorP, at: [-xi + 50, y + dy, zFace - 19], dir: [0, 0, 1] }))), 0.06);
    });
    step(b, { title: "Hang the door", detail: "Slide each hinge onto its plate and press until it clicks. Adjust the screws on the hinges until the gaps are even.", tools: ["screwdriver"], kind: "doors" }, () => b.add(doorP, [0, 0, 300]));
    step(b, { title: "Stick on the bumper and screw on the knob", detail: "The bumper goes inside the frame where the door closes; the knob screw goes in from behind the door.", tools: ["screwdriver"], kind: "screws" }, () => {
      b.fit(BUMPER, { on: midShelf!.key, at: [xi - 30, yD0 - railH - 18, zFace - 20], dir: [0, 1, 0], hole: false });
      b.then(0.1);
      const ky = legH + 40 + doorH * 0.75;
      b.fit(HW.knob, { on: doorP, at: [xi - 50, ky, zFace], dir: [0, 0, -1], hole: false });
      b.fit(KNOB_SCREW, { on: doorP, at: [xi - 50, ky, zFace - 18 - 4], dir: [0, 0, 1] });
    });
  } else {
    const sy = legH + 40;
    step(b, { title: "Press in the shelf supports and lay the shelf on", detail: "Two on each lower side rail. The shelf drops in between the legs.", kind: "shelves" }, () => {
      b.fits(SHELF_SUPPORT, [0, 1].flatMap((i) => [zf - 90, zb + 90].map((z): FitOpts => ({ on: sides[i], at: [sg(i) * (xo - P / 2 - 5), sy, z], dir: [0, -1, 0] }))), 0.1);
      b.then(0.1);
      b.add(shelf.key, [0, 300, 0]);
    });
  }
  if (door) drawer.build();
  drawer.slide();
  return true;
}

/** One drawer built on its front, like the bed boxes: cam bolts, side dowels, cams, bottom, back on pins, runners, knob. */
function boxDrawer(b: PlanBuilder, op: Opening, o: { zFace: number; zBack: number; pins: number; knobs?: number; runScrews?: 2 | 3; dowels?: boolean; repeat?: number; title?: string; shift?: Vec3 }) {
  const ft = 18, st = 14;
  const zIn = o.zFace - ft;
  const fw = op.w - 4, fh = op.h - 4;
  const xs = op.w / 2 - 13 - st / 2;
  const sh = Math.max(70, fh - 30);
  const dd = Math.round((zIn - o.zBack) / 10) * 10;
  const ys = op.y0 + 10;
  const zd = zIn - dd / 2;
  const runLen = Math.round((dd - 20) / 10) * 10;
  const front = b.place(b.part("Drawer front", [fw, fh, ft]), [op.x, op.y0 + 2 + fh / 2, o.zFace - ft / 2]);
  const sdT = b.part("Drawer side", [st, sh, dd]);
  const sides = [b.place(sdT, [op.x - xs, ys + sh / 2, zd]), b.place(sdT, [op.x + xs, ys + sh / 2, zd])];
  const bottom = b.place(b.part("Drawer bottom", [2 * xs - 4, 3, dd - 16], { material: "fiber" }), [op.x, ys + 10, zd - 6]);
  const back = b.place(b.part("Drawer back", [2 * xs - st, sh - 16, st]), [op.x, ys + 16 + (sh - 16) / 2, zIn - dd + st / 2]);
  const per = o.pins / 2;
  const py = per === 1 ? [ys + sh / 2] : [ys + sh * 0.3, ys + sh * 0.7];
  const zBk = zIn - dd + st / 2;
  const kx = (o.knobs ?? 1) === 2 ? [op.x - op.w * 0.27, op.x + op.w * 0.27] : [op.x];
  const ky = op.y0 + op.h / 2;
  const rz = (o.runScrews ?? 2) === 3 ? [zIn - 30, zIn - 10 - runLen / 2, zIn - runLen + 10] : [zIn - 30, zIn - runLen + 10];
  const withDowels = o.dowels ?? true;
  const fits: Record<string, [HwDef, FitOpts[]]> = {
    bolts: [HW.camScrew, [-1, 1].flatMap((g) => py.map((y): FitOpts => ({ on: front, at: [op.x + g * xs, y, zIn], dir: [0, 0, 1], mate: sides[g < 0 ? 0 : 1], mateHole: 4 })))],
    dowels: [HW.dowel, withDowels ? [-1, 1].flatMap((g) => py.map((y): FitOpts => ({ on: sides[g < 0 ? 0 : 1], at: [op.x + g * xs, y + 18, zIn], dir: [0, 0, -1], mate: front }))) : []],
    cams: [TABLE_CAM, [-1, 1].flatMap((g) => py.map((y): FitOpts => ({ on: sides[g < 0 ? 0 : 1], at: [op.x + g * (xs - st / 2), y, zIn - 28], dir: [g, 0, 0] })))],
    pins: [DRAWER_PIN, [-1, 1].flatMap((g) => py.map((y): FitOpts => ({ on: sides[g < 0 ? 0 : 1], at: [op.x + g * (xs + st / 2), y, zBk], dir: [-g, 0, 0], mate: back, mateHole: 4 })))],
    backCams: [TABLE_CAM2, [-1, 1].flatMap((g) => py.map((y): FitOpts => ({ on: back, at: [op.x + g * (xs - st / 2 - 25), y, zBk + st / 2], dir: [0, 0, -1] })))],
    runners: [runnerDef(runLen), [-1, 1].map((g): FitOpts => ({ on: sides[g < 0 ? 0 : 1], at: [op.x + g * xs, ys, zIn - 10 - runLen / 2], dir: [0, 1, 0], hole: false }))],
    runnerScrews: [RUNNER_SCREW, [-1, 1].flatMap((g) => rz.map((z): FitOpts => ({ on: sides[g < 0 ? 0 : 1], at: [op.x + g * xs, ys - 2, z], dir: [0, 1, 0] })))],
    knobs: [HW.knob, kx.map((x): FitOpts => ({ on: front, at: [x, ky, o.zFace], dir: [0, 0, -1], hole: false }))],
    knobScrews: [KNOB_SCREW, kx.map((x): FitOpts => ({ on: front, at: [x, ky, zIn - 4], dir: [0, 0, 1] }))],
  };
  const fit = (k: string, gap: number) => b.fits(fits[k][0], fits[k][1], gap);
  const c0: Vec3 = [op.x, ys + sh / 2, zd];
  const st0 = (k: string, from: Vec3) => lay(b, [k], c0, o.shift ?? [0, 0, 0], [0, 0, 0], from);
  const dstep = (title: string, detail: string, body: () => void, x: { tools?: ToolId[]; kind?: StepKind; pose?: Pose } = {}) =>
    step(b, { title, detail, tools: x.tools, scene: "drawer", pose: x.pose ?? "-z", kind: x.kind ?? "drawer", repeat: o.repeat }, body);
  const build = () => {
    dstep(o.title ?? "Screw the cam bolts into the drawer front", "Lay the front face down on a rug.", () => {
      st0(front, [0, 0, -160]);
      b.then(0.15);
      fit("bolts", 0.1);
    }, { tools: ["screwdriver"], kind: "cams" });
    dstep(withDowels ? "Tap the dowels into the drawer sides" : "Stand the drawer sides ready", withDowels ? (per === 1 ? "One in the front end of each side." : "Two in the front end of each side.") : "Grooves facing in and down.", () => {
      b.stagger(0.2);
      // they wait beside the front, standing on end, until they go onto its bolts
      const sh0 = o.shift ?? [0, 0, 0];
      sides.forEach((k, j) => lay(b, [k], c0, [sh0[0] + (j ? 1 : -1) * 90, sh0[1], sh0[2] - 150], [0, 0, 0], [0, 0, -200]));
      b.then(0.15);
      if (withDowels) fit("dowels", 0.1);
    }, { tools: withDowels ? ["hammer"] : undefined, kind: withDowels ? "dowels" : "join" });
    dstep("Stand the sides on the front and lock them", "Grooves facing in. Turn each cam lock clockwise until it pulls tight.", () => {
      b.stagger(0.2);
      sides.forEach((k) => st0(k, [0, 0, 0]));
      b.then(0.15);
      fit("cams", 0.1);
    }, { tools: ["screwdriver"], kind: "cams" });
    dstep("Slide in the bottom and drop the back on", "The bottom runs down the grooves; the back sits on top of it between the sides.", () => {
      st0(bottom, [0, 0, -420]);
      b.then(0.2);
      st0(back, [0, 0, -260]);
    }, { kind: "join" });
    dstep("Fix the back", "Push the plastic pins through the sides into the back, then lock a cam on each.", () => {
      fit("pins", 0.1);
      b.then(0.1);
      fit("backCams", 0.1);
    }, { tools: ["screwdriver"], kind: "cams" });
    dstep("Screw the runners onto the drawer", `Turn it over. Left and right are marked: ${rz.length === 3 ? "three" : "two"} screws each.`, () => {
      fit("runners", 0.25);
      b.then(0.1);
      fit("runnerScrews", 0.06);
    }, { tools: ["screwdriver"], kind: "runners", pose: "-y" });
    dstep(kx.length > 1 ? "Screw on the knobs" : "Screw on the knob", "The screw goes in from inside the drawer.", () => {
      fit("knobs", 0.2);
      b.then(0.05);
      fit("knobScrews", 0.15);
    }, { tools: ["screwdriver"], kind: "screws", pose: "+y" });
  };
  const keys = [front, ...sides, bottom, back];
  const preset = () => {
    for (const [def, l] of Object.values(fits)) for (const x of l) b.preset(def, x);
  };
  const slide = () =>
    step(b, { title: "Slide in the drawer", detail: "Rest its runners on the ones in the frame and push it in until it clicks.", kind: "drawer" }, () => {
      b.stagger(0);
      for (const k of keys) b.add(k, [0, 0, 480]);
    });
  return { build, slide, preset, keys, runLen };
}


/* ---------- desks ---------- */

/*
 * Desks (120 with one drawer unit, 155 with one at each end): the leg frame on the drawer side and the drawer panel
 * take their runners and cam bolts on the rug, the panel gets two angle brackets. The top lies upside down; the leg
 * frames stand on it with corner fittings, glides go in the legs, the back and front rails go in on dowels, then the
 * drawer unit's back panel and bottom on dowels and the drawer panel, all locked with cams in the top and the
 * brackets screwed down. Two people turn it over. The drawers are built on their fronts (the deep one without
 * dowels) and slide in on full-extension runners.
 */

const CORNER: HwDef = { kind: "clamp", len: 60, dia: 30 };
const DESK_BRACKET: HwDef = { kind: "angle", len: 50, dia: 40 };

function buildDesk(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const TT = 28, ov = 15, P = 45;
  const yTU = H - TT;
  const xo = W / 2 - ov, xi = xo - P;
  const zf = D / 2 - ov, zb = -D / 2 + ov;
  const zFace = zf - 3;
  const peds = W > 1400 ? [-1, 1] : [-1];
  const pw = 400, pedBot = 170;
  const zIn0 = zb + P, zIn1 = zf - P;
  const xInner = (g: number) => g * (xi - pw - 8);
  // drawer openings in each unit, top first: two shallow, one deep
  const yB = pedBot + 18, yTop = yTU - 5;
  const hs = 125, hd = yTop - yB - 2 * hs;
  const opens = peds.flatMap((g) => {
    const x = g * (xi - pw / 2);
    return [
      { g, deep: false, o: { x, w: pw, y0: yTop - hs, h: hs, pair: false } },
      { g, deep: false, o: { x, w: pw, y0: yTop - 2 * hs, h: hs, pair: false } },
      { g, deep: true, o: { x, w: pw, y0: yB, h: hd, pair: false } },
    ];
  });
  const runY = (o: Opening) => o.y0 + 8;
  const frame = (g: number) => {
    const ped = peds.includes(g);
    const xc = g * (xo - P / 2);
    const pieces: PartPiece[] = [
      { shape: "box", size: [P, yTU, P], pos: [xc, yTU / 2, zf - P / 2], material: "wood" },
      { shape: "box", size: [P, yTU, P], pos: [xc, yTU / 2, zb + P / 2], material: "wood" },
      ped
        ? { shape: "box", size: [16, yTU - pedBot, zIn1 - zIn0], pos: [xc, (pedBot + yTU) / 2, (zIn0 + zIn1) / 2], material: "board" }
        : { shape: "box", size: [16, 80, zIn1 - zIn0], pos: [xc, yTU - 40, (zIn0 + zIn1) / 2], material: "board" },
      ...(ped
        ? opens.filter((x) => x.g === g).map((x): PartPiece => ({ shape: "box", size: [14.5, 36, zIn1 - zIn0], pos: [g * (xi + 7.25), runY(x.o) + 4, (zIn0 + zIn1) / 2], material: "wood" }))
        : [{ shape: "box", size: [P - 15, 30, zIn1 - zIn0], pos: [xc, 130, (zIn0 + zIn1) / 2], material: "wood" } as PartPiece]),
    ];
    const { type, mid } = b.compound("Leg frame", pieces, { material: "wood" });
    return b.place(type, mid);
  };
  const frames = [frame(-1), frame(1)];
  const topP = b.place(b.part("Top", [W, TT, D]), [0, H - TT / 2, 0]);
  const panelT = b.part("Drawer panel", [16, yTU - pedBot, zFace - zIn0]);
  const panels = peds.map((g) => b.place(panelT, [xInner(g), (pedBot + yTU) / 2, (zFace + zIn0) / 2]));
  const backRail = b.place(b.part("Back rail", [2 * xi, 80, 18], { material: "wood" }), [0, yTU - 40, zb + P / 2]);
  const fx0 = peds.includes(-1) ? xInner(-1) + 8 : -xi, fx1 = peds.includes(1) ? xInner(1) - 8 : xi;
  const frontRail = b.place(b.part("Front rail", [fx1 - fx0, 60, 18], { material: "wood" }), [(fx0 + fx1) / 2, yTU - 30, zFace - 9]);
  const backPanels = peds.map((g) => b.place(b.part("Drawer unit back", [pw, yTU - 80 - pedBot, 10]), [g * (xi - pw / 2), (pedBot + yTU - 80) / 2, zb + P / 2]));
  const bottoms = peds.map((g) => b.place(b.part("Drawer unit bottom", [pw, 18, zFace - zIn0 + P / 2 - 10]), [g * (xi - pw / 2), pedBot + 9, (zFace + zb + P / 2 + 10) / 2]));

  // the frame's fittings
  const runLen = Math.round((zFace - 18 - (zb + P + 10) - 20) / 10) * 10;
  const zRun = zFace - 21 - runLen / 2;
  const runOn = (host: string, x: number, g: number, list: typeof opens) => ({
    r: list.map((u): FitOpts => ({ on: host, at: [x, runY(u.o), zRun], dir: [g, 0, 0], hole: false })),
    sc: list.flatMap((u) => [zFace - 40, zRun, zFace - 21 - runLen + 20].map((z): FitOpts => ({ on: host, at: [x, runY(u.o), z], dir: [g, 0, 0] }))),
  });
  const pr = peds.flatMap((g, i) => {
    const mine = opens.filter((u) => u.g === g);
    return [runOn(frames[g < 0 ? 0 : 1], g * xi, g, mine), runOn(panels[i], xInner(g) + g * 8, -g, mine)];
  });
  const topBolts: FitOpts[] = [
    ...[0, 1].flatMap((i) => spread(zIn0 + 40, zIn1 - 40, 3).map((z): FitOpts => ({ on: frames[i], at: [sg(i) * (xo - P / 2), yTU, z], dir: [0, -1, 0], mate: topP, mateHole: 4 }))),
  ];
  const panelBolts: FitOpts[] = panels.flatMap((k, i) => spread(zIn0 + 30, zFace - 40, 4).map((z): FitOpts => ({ on: k, at: [xInner(peds[i]), yTU, z], dir: [0, -1, 0], mate: topP, mateHole: 4 })));
  const camAt = (o: FitOpts, g: number): FitOpts => ({ on: topP, at: [o.at[0] - g * 30, yTU, o.at[2]], dir: [0, 1, 0] });
  const brackets = panels.flatMap((k, i) => [zIn0 + 80, zFace - 80].map((z): FitOpts => ({ on: k, at: [xInner(peds[i]) - peds[i] * 8, yTU - 25, z], dir: [peds[i], 0, 0], hole: false })));
  const sideRot = (i: number): Vec3 => [0, 0, sg(i) * -Math.PI / 2];

  step(b, { title: peds.length > 1 ? "Screw the runners into both drawer units" : "Screw the runners into the drawer unit", detail: "Lay the leg frame and the drawer panel on a rug, inside up. Left and right runners are marked, three screws each.", tools: ["screwdriver"], scene: "prep", kind: "runners", warnings: ["floor"] }, () => {
    b.stagger(0.2);
    peds.forEach((g, i) => {
      const fk = frames[g < 0 ? 0 : 1];
      lay(b, [fk], b.partItem(fk).final.pos, [g * (yTU / 2 + 60) * (peds.length > 1 ? 2 : 1), P / 2, 0], sideRot(g < 0 ? 0 : 1));
      lay(b, [panels[i]], b.partItem(panels[i]).final.pos, [peds.length > 1 ? g * (yTU / 2 + 40) : -g * (yTU / 2 + 60), 8, 0], sideRot(g < 0 ? 1 : 0));
    });
    if (peds.length === 1) lay(b, [frames[1]], b.partItem(frames[1]).final.pos, [3 * (yTU / 2 + 60), P / 2, 0], sideRot(1));
    b.then(0.15);
    pr.forEach((f) => b.fits(runnerDef(runLen), f.r, 0.15));
    b.then(0.1);
    pr.forEach((f) => b.fits(RUNNER_SCREW, f.sc, 0.04));
  });
  step(b, { title: "Screw the cam bolts into the top edges", detail: "Three in each leg frame and four in each drawer panel. In by hand until the collar touches.", scene: "prep", kind: "cams" }, () => b.fits(HW.camScrew, [...topBolts, ...panelBolts], 0.05));
  step(b, { title: "Screw the angle brackets to the drawer panel", detail: "Two near the top edge, on the side away from the drawers.", tools: ["screwdriver"], scene: "prep", kind: "screws" }, () => {
    b.fits(DESK_BRACKET, brackets, 0.15);
    b.then(0.05);
    b.fits(HW.screwS, brackets.flatMap((o) => [-10, 10].map((dz) => ({ ...o, at: [o.at[0] + o.dir[0] * 2, o.at[1] - 12, o.at[2] + dz] as Vec3, dir: [-o.dir[0], 0, 0] as Vec3, hole: undefined }))), 0.1);
  });
  const legDowels = [0, 1].flatMap((i) => [zf - P / 2, zb + P / 2].map((z): FitOpts => ({ on: frames[i], at: [sg(i) * (xo - P / 2), yTU, z], dir: [0, -1, 0], mate: topP })));
  step(b, { title: "Stand the leg frames on the top", detail: "Lay the top upside down on the rug. Dowels in the leg tops, then both frames onto the top, bolts into their holes.", tools: ["hammer"], pose: "-y", kind: "join", warnings: ["floor"] }, () => {
    b.add(topP, [0, -200, 0]);
    b.then(0.1);
    b.fits(HW.dowel, legDowels, 0.08);
    b.then(0.1);
    b.stagger(0.3);
    for (const k of frames) b.add(k, [0, -300, 0]);
  });
  step(b, { title: "Lock the leg frames to the top", detail: "Turn the six cam locks in the top until they pull tight.", tools: ["screwdriver"], pose: "-y", kind: "cams" }, () =>
    b.fits(HW.cam, topBolts.map((o) => camAt(o, Math.sign(o.at[0]))), 0.1),
  );
  step(b, { title: "Fit the corner fittings", detail: "One inside each leg, hooked over the frame and tightened with the Allen key.", tools: ["allen"], pose: "-y", kind: "bolts" }, () =>
    b.fits(CORNER, [0, 1].flatMap((i) => [zf - P - 10, zb + P + 10].map((z): FitOpts => ({ on: frames[i], at: [sg(i) * (xi - 10), yTU - 30, z], dir: [sg(i), 0, 0], hole: false }))), 0.12),
  );
  step(b, { title: "Push the glides into the legs", detail: "One in the end of each leg.", pose: "-y", kind: "legs" }, () =>
    b.fits(POST_GLIDE, [0, 1].flatMap((i) => [zf - P / 2, zb + P / 2].map((z): FitOpts => ({ on: frames[i], at: [sg(i) * (xo - P / 2), 0, z], dir: [0, 1, 0], hole: false }))), 0.1),
  );
  const railBolts = [0, 1].map((i): FitOpts => ({ on: frames[i], at: [sg(i) * xi, yTU - 40, zb + P / 2], dir: [sg(i), 0, 0], mate: backRail, mateHole: 4 }));
  const railDowels: FitOpts[] = [
    ...[-1, 1].map((g): FitOpts => ({ on: backRail, at: [g * xi, yTU - 20, zb + P / 2], dir: [-g, 0, 0], mate: frames[g < 0 ? 0 : 1] })),
    ...[[fx0, -1], [fx1, 1]].map(([x, g]): FitOpts => ({ on: frontRail, at: [x, yTU - 30, zFace - 9], dir: [-g, 0, 0] })),
  ];
  step(b, { title: "Put the back rail and the front rail in", detail: "Small cam bolts in the back legs and a dowel in each rail end, then lock the back rail's two cams.", tools: ["hammer", "screwdriver"], pose: "-y", kind: "cams" }, () => {
    b.fits(HW.camScrew, railBolts, 0.1);
    b.then(0.05);
    b.stagger(0.15);
    for (const k of [backRail, frontRail]) b.stage(k, [b.partItem(k).final.pos[0], b.partItem(k).final.pos[1] - 300, b.partItem(k).final.pos[2]], [0, 0, 0]);
    b.then(0.1);
    b.fits(HW.dowel, railDowels, 0.06);
  });
  step(b, { title: "Lock the rails", detail: "Push both rails in against the legs and turn the cams in the back rail.", tools: ["screwdriver"], pose: "-y", kind: "cams" }, () => {
    b.stagger(0.2);
    for (const k of [backRail, frontRail]) b.add(k, [0, -300, 0]);
    b.then(0.15);
    b.fits(HW.cam, [-1, 1].map((g): FitOpts => ({ on: backRail, at: [g * (xi - 30), yTU - 40, zb + P / 2 + 9], dir: [0, 0, -1] })), 0.15);
  });
  const unitDowels: FitOpts[] = peds.flatMap((g, i) => {
    const xa = g * xi, xb = xInner(g);
    return [
      ...[xa, xb].flatMap((x) => [0.3, 0.7].map((t): FitOpts => ({ on: backPanels[i], at: [x, pedBot + (yTU - 80 - pedBot) * t, zb + P / 2], dir: [x === xa ? -g : g, 0, 0] }))),
      ...[xa, xb].flatMap((x) => [-0.3, 0.3].map((t): FitOpts => ({ on: bottoms[i], at: [x, pedBot + 9, t * (zFace - zIn0)], dir: [x === xa ? -g : g, 0, 0] }))),
    ];
  });
  step(b, { title: peds.length > 1 ? "Put in the backs and bottoms of the drawer units" : "Put in the back and the bottom of the drawer unit", detail: "Two dowels in each end of both boards. The back slides down against the leg frame, the bottom goes in under the runners.", tools: ["hammer"], pose: "-y", kind: "dowels" }, () => {
    b.fits(HW.dowel, unitDowels, 0.06);
    b.then(0.1);
    b.stagger(0.25);
    // each slides sideways onto the leg frame's holes, the panel side still open
    peds.forEach((g, i) => {
      for (const k of [backPanels[i], bottoms[i]]) b.add(k, [-g * 250, 0, 0]);
    });
  });
  step(b, { title: peds.length > 1 ? "Put the drawer panels in and lock them" : "Put the drawer panel in and lock it", detail: "Onto the dowels and into the top, then turn its cam locks.", tools: ["screwdriver"], pose: "-y", kind: "cams" }, () => {
    b.stagger(0.25);
    for (const k of panels) b.add(k, [0, -300, 0]);
    b.then(0.15);
    b.fits(HW.cam, panelBolts.map((o) => camAt(o, -Math.sign(o.at[0]))), 0.08);
  });
  step(b, { title: "Screw the brackets to the top", detail: "Two short screws through each bracket.", tools: ["screwdriver"], pose: "-y", kind: "screws" }, () =>
    b.fits(HW.screwS, brackets.flatMap((o) => [-10, 10].map((dz): FitOpts => ({ on: topP, at: [o.at[0] + o.dir[0] * 15, yTU, o.at[2] + dz], dir: [0, 1, 0] }))), 0.08),
  );
  step(b, { title: "Turn the desk over", detail: "Lift it together and stand it on its legs.", people: 2, kind: "standup" });
  // the drawers: one of each kind built on screen, the rest in place
  const made = opens.map((u) => ({ u, d: boxDrawer(b, u.o, { zFace, zBack: zb + P + 10, pins: u.deep ? 4 : 2, runScrews: 3, dowels: !u.deep, repeat: u.deep ? (peds.length > 1 ? peds.length : undefined) : 2 * peds.length, title: u.deep ? "Screw the cam bolts into the deep drawer's front" : "Screw the cam bolts into a shallow drawer front", shift: u.deep ? [pw + 250, 0, 0] : undefined }) }));
  const shownS = made.find((m) => !m.u.deep)!, shownD = made.find((m) => m.u.deep)!;
  shownS.d.build();
  shownD.d.build();
  step(b, { title: `Slide in all ${made.length} drawers`, detail: "Pull the runners out, rest each drawer on them and push it in until it clicks.", kind: "drawer" }, () => {
    for (const m of made) {
      b.stagger(0);
      for (const k of m.d.keys) b.add(k, [0, 0, 480]);
      if (m !== shownS && m !== shownD) m.d.preset();
      b.wait(0.22);
    }
  });
  return true;
}


/* ---------- shoe cabinets ---------- */

/*
 * Shoe cabinets (2 compartments with two small drawers on top; 4 compartments in two columns): the sides lie on a
 * rug for their cam bolts (and the small drawers' runners), the shelves and rails take dowels, and the cabinet is
 * built lying on its left side: back, shelves and rails stand in it (on the 4 compartment cabinet the middle
 * divider too), cams, then the other side. A metal bar goes across the back, glides in the legs, it stands up for
 * the pivot hooks and the top, and is screwed to the wall. Each tilting front takes its plastic shoe rack, hinge
 * pins, screws and a knob, then hooks onto the pivots. The small drawers are built on their fronts.
 */

const PIVOT: HwDef = { kind: "hook", len: 50, dia: 22 };
const PIVOT_SCREW: HwDef = { kind: "screw", len: 40, dia: 5 };
const RACK_CLIP: HwDef = { kind: "clip", len: 14, dia: 12 };
const HINGE_PIN: HwDef = { kind: "stud", len: 20, dia: 6 };
const RACK_SCREW: HwDef = { kind: "screw", len: 12, dia: 3.5 };

function buildShoe(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const four = /4-compartments/.test(s.slug ?? "");
  const TT = 20, ov = 15, P = 40, legH = 150;
  const xo = W / 2 - ov, xi = xo - P;
  const zf = D / 2 - ov, zb = -D / 2;
  const yTU = H - TT;
  const zFace = zf - 3;
  const railH = 30;
  const dh = four ? 0 : 110; // the small drawers
  const zIn0 = zb + P, zIn1 = zf - P;
  const sideFrame = (g: number) => {
    const xc = g * (xo - P / 2);
    const { type, mid } = b.compound("Side frame", [
      { shape: "box", size: [P, yTU, P], pos: [xc, yTU / 2, zf - P / 2], material: "wood" },
      { shape: "box", size: [P, yTU, P], pos: [xc, yTU / 2, zb + P / 2], material: "wood" },
      // the panel's inside face is flush with the legs', so the runners and the bar screw into it
      { shape: "box", size: [16, yTU - legH, zIn1 - zIn0], pos: [g * (xi + 8), (legH + yTU) / 2, (zIn0 + zIn1) / 2], material: "board" },
    ], { material: "wood" });
    return b.place(type, mid);
  };
  const sides = [sideFrame(-1), sideFrame(1)];
  const topP = b.place(b.part("Top", [W, TT, D]), [0, H - TT / 2, 0]);
  // a divider reaches up behind the top rail, which is screwed into it from the front
  const tongueD = zFace - 22 - (zb + P + 30);
  const divPart = (name: string, h: number, y: number) => {
    const { type, mid } = b.compound(name, [
      { shape: "box", size: [18, h, shelfD], pos: [0, y, shelfZ], material: "board" },
      ...(y + h / 2 >= yTU - railH - 1 ? [{ shape: "box", size: [18, railH, tongueD], pos: [0, yTU - railH / 2, zFace - 22 - tongueD / 2], material: "board" } as PartPiece] : []),
    ]);
    return b.place(type, mid);
  };
  const back: Board = { key: b.place(b.part("Back panel", [2 * xi, yTU - legH, 10]), [0, (legH + yTU) / 2, zb + P / 2]), y: (legH + yTU) / 2, z: zb + P / 2, h: yTU - legH, d: 10, flat: false };
  const shelfD = zFace - (zb + P / 2 + 5);
  const shelfZ = (zFace + zb + P / 2 + 5) / 2;
  const shelfT = b.part("Shelf", [2 * xi, 18, shelfD]);
  const shelfAt = (y: number): Board => ({ key: b.place(shelfT, [0, y, shelfZ]), y, z: shelfZ, h: 18, d: shelfD, flat: true });
  const railT = b.part("Front rail", [2 * xi, railH, 20], { material: "wood" });
  const railAt = (y: number): Board => ({ key: b.place(railT, [0, y, zFace - 10]), y, z: zFace - 10, h: railH, d: 20, flat: false });
  // rows of tilting fronts, top first
  const yTopOpen = yTU - railH - (four ? 0 : dh + railH);
  const botShelf = shelfAt(legH + 9);
  const avail = yTopOpen - (legH + 18) - railH;
  const ch = avail / 2;
  const midShelf = shelfAt(legH + 18 + ch + railH / 2);
  const topRail = railAt(yTU - railH / 2);
  const drawerRail = four ? null : railAt(yTU - railH - dh - railH / 2);
  const boards: Board[] = [botShelf, midShelf, topRail, ...(drawerRail ? [drawerRail] : [])];
  // the 4 compartment cabinet has a divider above and below the middle shelf
  const divider = four ? divPart("Middle divider", yTU - railH - (midShelf.y + 9), (midShelf.y + 9 + yTU - railH) / 2) : divPart("Drawer divider", dh, yTU - railH - dh / 2);
  const divider2 = four ? b.place(b.part("Middle divider", [18, midShelf.y - 9 - (legH + 18), shelfD]), [0, (midShelf.y - 9 + legH + 18) / 2, shelfZ]) : "";
  const divAt = (y: number) => (four && y < midShelf.y ? divider2 : divider);
  const bar = b.place(b.part("Back bar", [2 * xi, 30, 20], { material: "metal" }), [0, yTU - 40, zb + P + 12]);
  const colsX: [number, number][] = four ? [[-xi, -9], [9, xi]] : [[-xi, xi]];
  const doors: { key: string; x: number; y0: number; w: number; h: number }[] = [];
  for (const [a, c] of colsX)
    for (const y0 of [midShelf.y + railH / 2, legH + 18]) {
      const w = c - a - 4, h = (y0 > legH + 30 ? yTopOpen : midShelf.y - railH / 2) - y0 - 4;
      const x = (a + c) / 2;
      const { type, mid } = b.compound("Tilting front", [
        { shape: "box", size: [w, h, 18], pos: [x, y0 + 2 + h / 2, zFace - 9], material: "board" },
        { shape: "box", size: [w - 30, 12, shelfD - 60], pos: [x, y0 + 30, zFace - 18 - (shelfD - 60) / 2], material: "fiber" },
        { shape: "box", size: [w - 30, h * 0.6, 8], pos: [x, y0 + 30 + h * 0.3, zFace - 18 - shelfD + 64], material: "fiber" },
      ]);
      doors.push({ key: b.place(type, mid), x, y0, w, h });
    }

  // fittings
  const jOpts = { dowels: 2, cams: 1, camFace: [0, -1, 0] as Vec3 };
  const joints = [
    boardJoint(back, xi, sides, { dowels: 2, cams: 2, camFace: [0, 0, -1] }),
    ...boards.map((bd) => boardJoint(bd, xi, sides, bd.flat ? jOpts : { dowels: 1, cams: 1, camFace: [0, 0, 1] })),
  ];
  const half = (l: FitOpts[], g: number) => l.filter((f) => Math.sign(f.at[0]) === g);
  const pivots = doors.flatMap((d) => [-1, 1].map((g): FitOpts => {
    const x = d.x + g * (d.w / 2 + 2);
    const host = Math.abs(x) > xi - 3 ? sides[x < 0 ? 0 : 1] : divAt(d.y0 + 25);
    return { on: host, at: [x, d.y0 + 25, zFace - 40], dir: [Math.sign(x - d.x), 0, 0], hole: false };
  }));
  const sideRot = (i: number): Vec3 => [0, 0, sg(i) * -Math.PI / 2];
  const sideC = (i: number) => b.partItem(sides[i]).final.pos;
  const drawerOps: Opening[] = four ? [] : [-1, 1].map((g) => ({ x: g * (xi + 9) / 2, w: xi - 9, y0: yTU - railH - dh, h: dh, pair: true }));
  const zBack = zb + P + 10;
  const drawers = drawerOps.map((op, i) => boxDrawer(b, op, { zFace, zBack, pins: 4, repeat: 2, shift: [i * 0, 0, 0] }));
  const runLen = drawers[0]?.runLen ?? 0;
  const frameRun: FitOpts[] = drawerOps.flatMap((op) => [-1, 1].map((g): FitOpts => {
    const x = op.x + g * (op.w / 2);
    return { on: Math.abs(x) > xi - 3 ? sides[x < 0 ? 0 : 1] : divider, at: [x, op.y0 + 8, zFace - 21 - runLen / 2], dir: [Math.sign(x - op.x), 0, 0], hole: false };
  }));
  const frameRunSc = frameRun.flatMap((o) => [zFace - 40, zFace - 21 - runLen + 20].map((z): FitOpts => ({ ...o, at: [o.at[0], o.at[1], z], hole: undefined })));

  step(b, { title: "Screw the cam bolts into the sides", detail: "Lay both side frames on a rug, inside up. In by hand until the collar touches.", tools: ["screwdriver"], scene: "prep", kind: "cams", warnings: ["floor"] }, () => {
    b.stagger(0.2);
    for (const i of [0, 1]) lay(b, [sides[i]], sideC(i), [sg(i) * (yTU / 2 + 80), P / 2, 0], sideRot(i));
    b.then(0.15);
    b.fits(TABLE_BOLT, joints.flatMap((j) => j.bolts), 0.05);
  });
  // the sides take their drawer runners while they lie on the rug, the divider once it stands in the cabinet
  const onSide = (o: FitOpts) => o.on !== divider;
  if (!four)
    step(b, { title: "Screw the drawer runners to the sides", detail: "Near the top front of each side. Left and right are marked; two screws each.", tools: ["screwdriver"], scene: "prep", kind: "runners" }, () => {
      b.fits(runnerDef(runLen), frameRun.filter(onSide), 0.15);
      b.then(0.1);
      b.fits(RUNNER_SCREW, frameRunSc.filter(onSide), 0.05);
    });
  const shown = [back, ...boards];
  step(b, { title: "Tap the dowels into the back, shelves and rails", detail: "Two in each end of the back and the shelves, one in each end of the rails.", tools: ["hammer"], scene: "boards", kind: "dowels" }, () => {
    b.stagger(0.12);
    shown.forEach((bd, i) => lay(b, [bd.key], b.partItem(bd.key).final.pos, [0, 20, (i - (shown.length - 1) / 2) * 240], [bd.flat ? 0 : -Math.PI / 2, 0, 0]));
    b.then(0.15);
    b.fits(HW.dowel, joints.flatMap((j) => j.dw), 0.04);
  });
  step(b, { title: "Stand the back and the shelves in a side", detail: "Lay the left side on the rug, inside up, and push everything onto its dowels and bolts.", pose: "+x", kind: "join", warnings: ["floor"] }, () => {
    b.add(sides[0], [-200, 0, 0]);
    b.then(0.1);
    b.stagger(0.15);
    for (const bd of shown) b.add(bd.key, [200, 0, 0]);
  });
  step(b, { title: "Lock the cam locks", detail: "Arrow towards the bolt, then turn clockwise until it pulls tight.", tools: ["screwdriver"], pose: "+x", kind: "cams" }, () => b.fits(TABLE_CAM, joints.flatMap((j) => half(j.cams, -1)), 0.08));
  step(b, { title: four ? "Put the middle dividers in" : "Put the drawer divider in", detail: four ? "One above and one below the middle shelf, with a screw through the top rail." : "Between the two small drawers, with a screw through the top rail.", tools: ["screwdriver"], pose: "+x", kind: "screws" }, () => {
    b.stagger(0.2);
    for (const k of [divider, ...(divider2 ? [divider2] : [])]) b.add(k, [200, 0, 0]);
    b.then(0.15);
    b.fit(HW.screwM, { on: topRail.key, at: [0, yTU - railH / 2, zFace], dir: [0, 0, -1], mate: divider });
  });
  if (!four)
    step(b, { title: "Screw the drawer runners to the divider", detail: "One on each face. Left and right are marked; two screws each.", tools: ["screwdriver"], pose: "+x", kind: "runners" }, () => {
      b.fits(runnerDef(runLen), frameRun.filter((o) => !onSide(o)), 0.15);
      b.then(0.1);
      b.fits(RUNNER_SCREW, frameRunSc.filter((o) => !onSide(o)), 0.05);
    });
  step(b, { title: "Put the other side on", detail: "Lower it onto all the dowels and bolts, then lock its cam locks.", tools: ["screwdriver"], pose: "+x", people: 2, kind: "cams" }, () => {
    b.add(sides[1], [300, 0, 0]);
    b.then(0.15);
    b.fits(TABLE_CAM, joints.flatMap((j) => half(j.cams, 1)), 0.08);
  });
  step(b, { title: "Screw in the back bar", detail: "Across the back under the top, two screws in each end.", tools: ["screwdriver"], pose: "+x", kind: "screws" }, () => {
    b.add(bar, [0, 0, -200]);
    b.then(0.1);
    b.fits(BAR_SCREW, [-1, 1].flatMap((g) => [-6, 6].map((dz): FitOpts => ({ on: bar, at: [g * xi, yTU - 40, zb + P + 12 + dz], dir: [g, 0, 0], mate: sides[g < 0 ? 0 : 1] }))), 0.08);
  });
  step(b, { title: "Push the glides into the legs", detail: "Turn it upside down. One in the end of each leg.", pose: "-y", kind: "legs" }, () =>
    b.fits(POST_GLIDE, [0, 1].flatMap((i) => [zf - P / 2, zb + P / 2].map((z): FitOpts => ({ on: sides[i], at: [sg(i) * (xo - P / 2), 0, z], dir: [0, 1, 0], hole: false }))), 0.1),
  );
  step(b, { title: "Stand it up and screw in the pivot hooks", detail: `Two for each tilting front, low down near the front, with the Allen key.`, tools: ["allen"], kind: "bolts" }, () => {
    b.fits(PIVOT, pivots, 0.08);
    b.then(0.05);
    b.fits(PIVOT_SCREW, pivots.map((o) => ({ ...o, at: [o.at[0] - o.dir[0] * 2, o.at[1], o.at[2]] as Vec3, dir: [o.dir[0], 0, 0] as Vec3, hole: undefined })), 0.06);
  });
  const topBolts = [0, 1].flatMap((i) => [zf - 60, zb + 60].map((z): FitOpts => ({ on: topP, at: [sg(i) * (xi - 10), yTU, z], dir: [0, 1, 0], mate: sides[i], mateHole: 4 })));
  step(b, { title: "Put the top on", detail: "Dowels in the tops of the legs and cam bolts in the top, then lay it on and turn the cam locks inside the sides.", tools: ["hammer", "screwdriver"], kind: "cams" }, () => {
    b.fits(HW.dowel, [0, 1].flatMap((i) => [zf - P / 2, zb + P / 2].map((z): FitOpts => ({ on: sides[i], at: [sg(i) * (xo - P / 2), yTU, z], dir: [0, -1, 0], mate: topP }))), 0.08);
    b.then(0.1);
    b.fits(TABLE_BOLT, topBolts, 0.08);
    b.then(0.1);
    b.add(topP, [0, 300, 0]);
    b.then(0.15);
    b.fits(TABLE_CAM2, [0, 1].flatMap((i) => [zf - 60, zb + 60].map((z): FitOpts => ({ on: sides[i], at: [sg(i) * xi, yTU - 25, z], dir: [sg(i), 0, 0] }))), 0.1);
  });
  const wx = [-xi / 2, xi / 2];
  step(b, { title: "Fix it to the wall", detail: "Two screws through the back bar into the wall, each with a washer. Pick plugs and screws that suit your wall.", tools: ["screwdriver", "drill", "pencil"], kind: "anchor", wall: true, warnings: ["wall", "tip"] }, () => {
    b.fits(WALL_PLUG, wx.map((x): FitOpts => ({ at: [x, yTU - 40, zb - 30], dir: [0, 0, -1] })), 0.1);
    b.fits(HW.washer, wx.map((x): FitOpts => ({ on: bar, at: [x, yTU - 40, zb + P + 23], dir: [0, 0, -1], hole: false })), 0.1);
    b.fits(WALL_SCREW, wx.map((x): FitOpts => ({ on: bar, at: [x, yTU - 40, zb + P + 24], dir: [0, 0, -1] })), 0.1);
  });
  // the tilting fronts: one built on screen, the rest hang finished
  const d0 = doors[0];
  const doorFits = (d: (typeof doors)[number]) => {
    const zr = zFace - 18;
    const kx = four ? [d.x] : [d.x - d.w * 0.27, d.x + d.w * 0.27];
    const ky = d.y0 + d.h * 0.8;
    return {
      clips: [-1, 1].flatMap((g) => [0.2, 0.5, 0.8].concat(four ? [] : [0.65]).slice(0, 4).map((t): FitOpts => ({ on: d.key, at: [d.x + g * (d.w / 2 - 20), d.y0 + 30 + d.h * 0.6 * t, zr - 4], dir: [0, 0, 1], hole: false }))),
      pins: [-1, 1].map((g): FitOpts => ({ on: d.key, at: [d.x + g * (d.w / 2 - 6), d.y0 + 25, zr - 20], dir: [-g, 0, 0] })),
      // through the rack's front lip into the back of the front
      screws: spread(d.x - d.w / 2 + 30, d.x + d.w / 2 - 30, four ? 4 : 6).map((x): FitOpts => ({ on: d.key, at: [x, d.y0 + 30, zr - 8], dir: [0, 0, 1] })),
      knobs: kx.map((x): FitOpts => ({ on: d.key, at: [x, ky, zFace], dir: [0, 0, -1], hole: false })),
      knobScrews: kx.map((x): FitOpts => ({ on: d.key, at: [x, ky, zr - 4], dir: [0, 0, 1] })),
    };
  };
  const f0 = doorFits(d0);
  const fstep = (title: string, detail: string, body: () => void, x: { tools?: ToolId[]; kind?: StepKind; pose?: Pose } = {}) =>
    step(b, { title, detail, tools: x.tools, scene: "front", pose: x.pose ?? "-z", repeat: doors.length, kind: x.kind ?? "general" }, body);
  fstep("Click the shoe rack onto a tilting front", "Lay the front face down. The rack's end brackets clip onto the back of the front, right and left as marked.", () => {
    lay(b, [d0.key], b.partItem(d0.key).final.pos, [0, 0, 0], [0, 0, 0], [0, 0, -200]);
    b.then(0.15);
    b.fits(RACK_CLIP, f0.clips, 0.06);
  });
  fstep("Tap in the hinge pins and screw the rack down", "A pin in each end bracket, then screws through the rack into the front.", () => {
    b.fits(HINGE_PIN, f0.pins, 0.15);
    b.then(0.1);
    b.fits(RACK_SCREW, f0.screws, 0.08);
  }, { tools: ["hammer", "screwdriver"], kind: "screws" });
  fstep(f0.knobs.length > 1 ? "Screw on the knobs" : "Screw on the knob", "The screw goes in from behind the front.", () => {
    b.fits(HW.knob, f0.knobs, 0.15);
    b.then(0.05);
    b.fits(KNOB_SCREW, f0.knobScrews, 0.1);
  }, { tools: ["screwdriver"], kind: "screws", pose: "+y" });
  step(b, { title: doors.length > 2 ? `Hang all ${doors.length} tilting fronts` : "Hang both tilting fronts", detail: "Tilt each one forward, rest its pins in the pivot hooks and swing it shut.", kind: "doors" }, () => {
    for (const d of doors) {
      b.stagger(0);
      b.add(d.key, [0, 0, 400]);
      if (d !== d0) {
        const f = doorFits(d);
        const all: [HwDef, FitOpts[]][] = [[RACK_CLIP, f.clips], [HINGE_PIN, f.pins], [RACK_SCREW, f.screws], [HW.knob, f.knobs], [KNOB_SCREW, f.knobScrews]];
        for (const [def, l] of all) for (const x of l) b.preset(def, x);
      }
      b.wait(0.25);
    }
  });
  if (drawers.length) {
    drawers[0].build();
    step(b, { title: "Slide in both drawers", detail: "Rest their runners on the ones in the frame and push them in until they click.", kind: "drawer" }, () => {
      drawers.forEach((d, i) => {
        b.stagger(0);
        for (const k of d.keys) b.add(k, [0, 0, 480]);
        if (i > 0) d.preset();
        b.wait(0.22);
      });
    });
  }
  return true;
}


/* ---------- wardrobe ---------- */

/*
 * Wardrobe with three doors and two drawers: the side frames lie on a rug for their cam bolts and the drawer runners,
 * the top, bottom and drawer shelf take dowels, and it's built lying on its back: the left side, the boards, the
 * dividers, then the right side, all on cams. The two back panels slide into the grooves and are held with plugs and
 * clips, glides go in the five legs, and two people stand it up and fix it to the wall through two spacers. The
 * clothes rail clicks into its brackets and the shelves go in on pins. Each door takes three hinges and hangs on the
 * mounting plates, then the knobs; the drawers are built on their fronts like the chests'.
 */

const W_PLUG: HwDef = { kind: "clip", len: 16, dia: 10 };
const BACK_CLIP: HwDef = { kind: "clip", len: 20, dia: 16 };
const RAIL_BRACKET: HwDef = { kind: "bracket", len: 40, dia: 30 };
const MOUNT_PLATE: HwDef = { kind: "plate", len: 40, dia: 20 };

function buildWardrobe(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const TT = 20, ov = 15, P = 45, legH = 150;
  const xo = W / 2 - ov, xi = xo - P;
  const zf = D / 2 - ov, zb = -D / 2;
  const yTU = H - TT;
  const zFace = zf - 3;
  const zIn0 = zb + P, zIn1 = zf - P;
  const drawH = 200, topRailH = 60;
  const yShelf = legH + 18 + drawH; // underside of the drawer shelf
  const doorW = (2 * xi) / 3;
  const xDiv = -xi + 2 * doorW; // the divider behind the right-hand door
  const sideFrame = (g: number) => {
    const xc = g * (xo - P / 2);
    const { type, mid } = b.compound("Side frame", [
      { shape: "box", size: [P, yTU, P], pos: [xc, yTU / 2, zf - P / 2], material: "wood" },
      { shape: "box", size: [P, yTU, P], pos: [xc, yTU / 2, zb + P / 2], material: "wood" },
      { shape: "box", size: [16, yTU - legH, zIn1 - zIn0], pos: [xc, (legH + yTU) / 2, (zIn0 + zIn1) / 2], material: "board" },
      { shape: "box", size: [14.5, 36, zIn1 - zIn0], pos: [g * (xi + 7.25), legH + 18 + 12, (zIn0 + zIn1) / 2], material: "wood" },
    ], { material: "wood" });
    return b.place(type, mid);
  };
  const sides = [sideFrame(-1), sideFrame(1)];
  const topP = b.place(b.part("Top", [W, TT, D]), [0, H - TT / 2, 0]);
  const inD = zFace - (zb + 20);
  const inZ = (zFace + zb + 20) / 2;
  const boardT = b.part("Bottom and drawer shelf", [2 * xi, 18, inD]);
  const bottom: Board = { key: b.place(boardT, [0, legH + 9, inZ]), y: legH + 9, z: inZ, h: 18, d: inD, flat: true };
  const dShelf: Board = { key: b.place(boardT, [0, yShelf + 9, inZ]), y: yShelf + 9, z: inZ, h: 18, d: inD, flat: true };
  const ceiling: Board = { key: b.place(b.part("Inner top", [2 * xi, 18, inD]), [0, yTU - 9, inZ]), y: yTU - 9, z: inZ, h: 18, d: inD, flat: true };
  const topRail = b.place(b.part("Front rail", [2 * xi, topRailH, 20], { material: "wood" }), [0, yTU - 18 - topRailH / 2, zFace - 10]);
  const { type: ddT, mid: ddM } = b.compound("Drawer divider", [
    { shape: "box", size: [18, drawH, inD], pos: [0, legH + 18 + drawH / 2, inZ], material: "board" },
    { shape: "box", size: [40, legH + 18 + drawH, 40], pos: [0, (legH + 18 + drawH) / 2, zFace - 20], material: "wood" },
  ]);
  const drawDiv = b.place(ddT, ddM);
  const divider = b.place(b.part("Divider", [18, yTU - 18 - (yShelf + 18), inD]), [xDiv, (yShelf + 18 + yTU - 18) / 2, inZ]);
  const backT = b.part("Back panel", [xi + 8, yTU - legH, 4], { material: "fiber" });
  const backs = [-1, 1].map((g) => b.place(backT, [g * (xi + 8) / 2, (legH + yTU) / 2, zb + 12]));
  const railY = yTU - 18 - 120;
  const rail = b.place(b.part("Clothes rail", [xDiv - 9 + xi - 10, 25, 25], { material: "metal" }), [(xDiv - 9 - xi) / 2, railY, inZ]);
  const shelfT = b.part("Shelf", [xi - xDiv - 9 - 4, 18, inD - 30]);
  const shelfYs = spread(yShelf + 18 + 380, yTU - 18 - 300, 3);
  const shelves = shelfYs.map((y) => b.place(shelfT, [(xDiv + 9 + xi) / 2, y, inZ - 10]));
  const doorH = yTU - 18 - topRailH - (yShelf + 18) - 4;
  const doorY = yShelf + 18 + 2 + doorH / 2;
  const doors = [0, 1, 2].map((i) => {
    const x = -xi + doorW * (i + 0.5);
    const pieces: PartPiece[] = [{ shape: "box", size: [doorW - 4, doorH, 20], pos: [x, doorY, zFace - 10], material: "board" }];
    if (i === 1) pieces.push({ shape: "box", size: [doorW - 120, doorH - 200, 4], pos: [x, doorY, zFace + 1], material: "metal" });
    else for (const k of range(5)) pieces.push({ shape: "box", size: [5, doorH - 160, 3], pos: [x - (doorW - 4) / 2 + ((k + 1) * (doorW - 4)) / 6, doorY, zFace + 1], material: "board" });
    const { type, mid } = b.compound(i === 1 ? "Mirror door" : "Door", pieces);
    return { key: b.place(type, mid), x, hingeX: i === 0 ? -xi : i === 1 ? xDiv : xi, i };
  });

  const jF = { dowels: 2, cams: 1, camFace: [0, -1, 0] as Vec3 };
  const joints = [boardJoint(ceiling, xi, sides, { ...jF, cams: 2 }), boardJoint(bottom, xi, sides, { ...jF, cams: 2 }), boardJoint(dShelf, xi, sides, { ...jF, cams: 2 })];
  const half = (l: FitOpts[], g: number) => l.filter((f) => Math.sign(f.at[0]) === g);
  const divBolt: FitOpts = { on: ceiling.key, at: [xDiv, yTU - 18, inZ], dir: [0, 1, 0], mate: divider, mateHole: 4 };
  const ops: Opening[] = [-1, 1].map((g) => ({ x: g * (xi + 9) / 2, w: xi - 9, y0: legH + 18, h: drawH, pair: false }));
  const runLen = Math.round((zFace - 18 - (zb + 40) - 10) / 10) * 10;
  const zRun = zFace - 21 - runLen / 2;
  const frameRun: FitOpts[] = ops.flatMap((op) => [-1, 1].map((g): FitOpts => {
    const x = op.x + g * (op.w / 2);
    return { on: Math.abs(x) > xi - 3 ? sides[x < 0 ? 0 : 1] : drawDiv, at: [x, op.y0 + 8, zRun], dir: [Math.sign(x - op.x), 0, 0], hole: false };
  }));
  const frameRunSc = frameRun.flatMap((o) => [zFace - 40, zRun, zFace - 21 - runLen + 20].map((z): FitOpts => ({ ...o, at: [o.at[0], o.at[1], z], hole: undefined })));
  const sideRot = (i: number): Vec3 => [0, 0, sg(i) * -Math.PI / 2];

  step(b, { title: "Screw the cam bolts and runners into the sides", detail: "Lay both side frames on a rug, inside up. The cam bolts go in by hand; the drawer runners take three screws each.", tools: ["screwdriver"], scene: "prep", kind: "runners", warnings: ["floor"] }, () => {
    b.stagger(0.2);
    for (const i of [0, 1]) lay(b, [sides[i]], b.partItem(sides[i]).final.pos, [sg(i) * (yTU / 2 + 100), P / 2, 0], sideRot(i));
    b.then(0.15);
    b.fits(TABLE_BOLT, joints.flatMap((j) => j.bolts), 0.05);
    b.then(0.1);
    const onSides = frameRun.filter((o) => o.on !== drawDiv);
    b.fits(runnerDef(runLen), onSides, 0.2);
    b.fits(RUNNER_SCREW, frameRunSc.filter((o) => o.on !== drawDiv), 0.05);
  });
  step(b, { title: "Screw the runners to the drawer divider", detail: "One on each face, three screws each.", tools: ["screwdriver"], scene: "divider", kind: "runners" }, () => {
    lay(b, [drawDiv], b.partItem(drawDiv).final.pos, [0, 0, 0], [0, 0, Math.PI / 2]);
    b.then(0.15);
    b.fits(runnerDef(runLen), frameRun.filter((o) => o.on === drawDiv), 0.2);
    b.fits(RUNNER_SCREW, frameRunSc.filter((o) => o.on === drawDiv), 0.05);
  });
  const boards = [ceiling, bottom, dShelf];
  step(b, { title: "Tap the dowels into the boards", detail: "Two in each end of the inner top, the bottom and the drawer shelf, and screw the divider's cam bolt into the inner top.", tools: ["hammer"], scene: "boards", kind: "dowels" }, () => {
    b.stagger(0.15);
    // The inner top lies underside up, so the divider's bolt goes in from above.
    boards.forEach((bd, i) => lay(b, [bd.key], b.partItem(bd.key).final.pos, [0, 20, (i - 1) * (inD + 120)], bd === ceiling ? [0, 0, Math.PI] : [0, 0, 0]));
    b.then(0.15);
    b.fits(HW.dowel, joints.flatMap((j) => j.dw), 0.05);
    b.fit(TABLE_BOLT, divBolt);
  });
  step(b, { title: "Stand the tall divider on the inner top", detail: "Lower it straight onto the bolt and turn its cam to lock it. Keep the two together from now on.", tools: ["screwdriver"], scene: "boards", kind: "cams" }, () => {
    lay(b, [divider], b.partItem(ceiling.key).final.pos, [0, 20, -(inD + 120)], [0, 0, Math.PI], [0, 400, 0]);
    b.then(0.15);
    b.fit(TABLE_CAM, { on: divider, at: [xDiv + 9, yTU - 18 - 30, inZ], dir: [-1, 0, 0] });
  });
  step(b, { title: "Lay the left side down and stand the boards in it", detail: "The wardrobe is built lying on its back. Push the boards onto their dowels and bolts, the divider with the inner top, and lock the cams.", tools: ["screwdriver"], pose: "+z", kind: "cams", people: 2, warnings: ["two", "floor"] }, () => {
    b.add(sides[0], [-300, 0, 0]);
    b.then(0.1);
    for (const bd of boards) {
      b.stagger(bd === ceiling ? 0 : 0.2);
      b.add(bd.key, [300, 0, 0]);
      if (bd === ceiling) {
        b.stagger(0.2);
        b.add(divider, [300, 0, 0]);
      }
    }
    b.then(0.15);
    b.fits(TABLE_CAM, joints.flatMap((j) => half(j.cams, -1)), 0.08);
  });
  step(b, { title: "Put the drawer divider in", detail: "Between the bottom and the drawer shelf, its leg at the front.", pose: "+z", kind: "join" }, () => {
    b.add(drawDiv, [0, 0, 400]);
  });
  step(b, { title: "Put the right side on", detail: "Lower it onto the boards together and lock its cams.", tools: ["screwdriver"], pose: "+z", people: 2, kind: "cams" }, () => {
    b.add(sides[1], [300, 0, 0]);
    b.then(0.15);
    b.fits(TABLE_CAM, joints.flatMap((j) => half(j.cams, 1)), 0.08);
  });
  step(b, { title: "Click in the front rail", detail: "Under the top at the front, between the posts.", pose: "+z", kind: "join" }, () => b.add(topRail, [0, 0, 300]));
  step(b, { title: "Slide in the back panels", detail: "Down the grooves in the back posts, one each side. Plugs through the panels into the boards, clips along the middle joint.", pose: "+z", kind: "general" }, () => {
    b.stagger(0.3);
    for (const k of backs) b.add(k, [0, 600, 0]);
    b.then(0.15);
    b.fits(W_PLUG, backs.flatMap((k, i) => [bottom.y, dShelf.y, ceiling.y].flatMap((y) => [0.3, 0.75].map((t): FitOpts => ({ on: k, at: [sg(i) * xi * t, y, zb + 10], dir: [0, 0, 1], hole: false })))), 0.05);
    b.then(0.1);
    b.fits(BACK_CLIP, spread(legH + 60, yTU - 60, 13).map((y): FitOpts => ({ on: backs[0], at: [0, y, zb + 14], dir: [0, 0, -1], hole: false })), 0.04);
  });
  const feet: FitOpts[] = [
    ...[0, 1].flatMap((i) => [zf - P / 2, zb + P / 2].map((z): FitOpts => ({ on: sides[i], at: [sg(i) * (xo - P / 2), 0, z], dir: [0, 1, 0], hole: false }))),
    { on: drawDiv, at: [0, 0, zFace - 20], dir: [0, 1, 0], hole: false },
  ];
  step(b, { title: "Push the glides into the legs", detail: "One in each of the five legs.", pose: "+z", kind: "legs" }, () => b.fits(POST_GLIDE, feet, 0.1));
  const tdw = [0, 1].flatMap((i) => [zf - P / 2, zb + P / 2].map((z): FitOpts => ({ on: sides[i], at: [sg(i) * (xo - P / 2), yTU, z], dir: [0, -1, 0], mate: topP })));
  step(b, { title: "Stand it up and put the top on", detail: "Lift it up together. Dowels in the post tops, then the top on them, screwed up through the inner top.", tools: ["hammer", "screwdriver"], people: 2, kind: "join", warnings: ["two"] }, () => {
    b.fits(HW.dowel, tdw, 0.08);
    b.then(0.1);
    b.add(topP, [0, 300, 0]);
    b.then(0.15);
    b.fits(HW.screwM, [-0.5, 0, 0.5].map((t): FitOpts => ({ on: ceiling.key, at: [t * xi, yTU - 18, inZ], dir: [0, 1, 0], mate: topP })), 0.1);
  });
  const wx = [-xi / 2, xi / 2];
  step(b, { title: "Fix it to the wall", detail: "Two spacers behind the top at the back, a long screw through each into the wall with a washer. Pick plugs and screws that suit your wall.", tools: ["screwdriver", "drill", "pencil"], kind: "anchor", wall: true, warnings: ["wall", "tip"] }, () => {
    b.fits(SPACER, wx.map((x): FitOpts => ({ on: ceiling.key, at: [x, yTU - 60, zb], dir: [0, 0, 1], hole: false })), 0.12);
    b.then(0.1);
    b.fits(WALL_PLUG, wx.map((x): FitOpts => ({ at: [x, yTU - 60, zb - 30], dir: [0, 0, -1] })), 0.1);
    b.fits(HW.washer, wx.map((x): FitOpts => ({ at: [x, yTU - 60, zb + 40], dir: [0, 0, -1], hole: false })), 0.1);
    b.fits(WALL_SCREW, wx.map((x): FitOpts => ({ at: [x, yTU - 60, zb + 41], dir: [0, 0, -1] })), 0.1);
  });
  step(b, { title: "Hang the clothes rail", detail: "Screw a bracket to the side and one to the divider, two screws each, then click the rail in.", tools: ["screwdriver"], kind: "screws" }, () => {
    const br: FitOpts[] = [{ on: sides[0], at: [-xi, railY, inZ], dir: [-1, 0, 0], hole: false }, { on: divider, at: [xDiv - 9, railY, inZ], dir: [1, 0, 0], hole: false }];
    b.fits(RAIL_BRACKET, br, 0.15);
    b.then(0.05);
    b.fits(HW.screwS, br.flatMap((o) => [-12, 12].map((dz): FitOpts => ({ ...o, at: [o.at[0] - o.dir[0] * 2, o.at[1], o.at[2] + dz], hole: undefined }))), 0.06);
    b.then(0.1);
    b.add(rail, [0, -200, 0]);
  });
  step(b, { title: "Push in the shelf pins and lay the shelves on", detail: "Four pins for each shelf, at the heights you want, in the right-hand section.", kind: "shelves" }, () => {
    b.fits(SHELF_PIN, shelfYs.flatMap((y) => [[xDiv + 9, 1], [xi, -1]].flatMap(([x, g]) => [zFace - 80, zb + 80].map((z): FitOpts => ({ on: x === xi ? sides[1] : divider, at: [x, y - 12, z], dir: [-g, 0, 0] })))), 0.04);
    b.then(0.1);
    b.stagger(0.2);
    for (const k of shelves) b.add(k, [0, 0, 400]);
  });
  const hy = [doorY - doorH / 2 + 120, doorY, doorY + doorH / 2 - 120];
  const d0 = doors[0];
  const hingeFits = (d: (typeof doors)[number]) => {
    const edge = d.hingeX === xDiv ? d.x + doorW / 2 - 40 : d.hingeX < 0 ? d.x - doorW / 2 + 40 : d.x + doorW / 2 - 40;
    return {
      hinges: hy.map((y): FitOpts => ({ on: d.key, at: [edge, y, zFace - 20], dir: [0, 0, 1] })),
      screws: hy.flatMap((y) => [-15, 15].map((dy): FitOpts => ({ on: d.key, at: [edge + (edge > d.x ? -10 : 10), y + dy, zFace - 21], dir: [0, 0, 1] }))),
    };
  };
  const f0 = hingeFits(d0);
  step(b, { title: "Screw the hinges to the doors", detail: "Lay each door face down. Three hinges in the round holes, two screws each.", tools: ["screwdriver"], scene: "door", pose: "-z", repeat: 3, kind: "hinges" }, () => {
    lay(b, [d0.key], b.partItem(d0.key).final.pos);
    b.then(0.15);
    b.fits(HW.hinge, f0.hinges, 0.15);
    b.then(0.05);
    b.fits(HINGE_SCREW, f0.screws, 0.05);
  });
  const plates = doors.flatMap((d) => hy.map((y): FitOpts => {
    const host = d.hingeX === xDiv ? divider : sides[d.hingeX < 0 ? 0 : 1];
    const x = d.hingeX === xDiv ? xDiv + 9 : d.hingeX;
    return { on: host, at: [x, y, zFace - 40], dir: [d.hingeX === xDiv ? -1 : Math.sign(d.hingeX), 0, 0], hole: false };
  }));
  step(b, { title: "Screw on the mounting plates and hang the doors", detail: "Nine plates, two screws each. Click each hinge onto its plate, then adjust the hinge screws until the gaps are even.", tools: ["screwdriver"], people: 2, kind: "doors", warnings: ["two"] }, () => {
    b.fits(MOUNT_PLATE, plates, 0.05);
    b.then(0.05);
    b.fits(HINGE_SCREW, plates.flatMap((o) => [-10, 10].map((dz): FitOpts => ({ ...o, at: [o.at[0] - o.dir[0] * 2, o.at[1], o.at[2] + dz], hole: undefined }))), 0.03);
    b.then(0.1);
    for (const d of doors) {
      b.stagger(0);
      b.add(d.key, [0, 0, 400]);
      if (d !== d0) {
        const f = hingeFits(d);
        for (const x of f.hinges) b.preset(HW.hinge, x);
        for (const x of f.screws) b.preset(HINGE_SCREW, x);
      }
      b.wait(0.25);
    }
  });
  const knobX = (d: (typeof doors)[number]) => (d.i === 0 ? d.x + doorW / 2 - 50 : d.x - doorW / 2 + 50);
  step(b, { title: "Screw on the door knobs", detail: "On the edge away from the hinges. The screw goes in from behind.", tools: ["screwdriver"], kind: "screws" }, () => {
    b.fits(HW.knob, doors.map((d): FitOpts => ({ on: d.key, at: [knobX(d), doorY, zFace], dir: [0, 0, -1], hole: false })), 0.12);
    b.then(0.05);
    b.fits(KNOB_SCREW, doors.map((d): FitOpts => ({ on: d.key, at: [knobX(d), doorY, zFace - 24], dir: [0, 0, 1] })), 0.1);
  });
  chestDrawers(b, ops, { zFace, zBack: zb + 40, runLen, smallPins: 4, stops: true, knob2: 9999 });
  return true;
}

/* ---------- add-on unit ---------- */

/*
 * Add-on unit (desk riser with two drawers): each drawer housing is two sides with runners and cam bolts, a back and
 * a rail on dowels, locked with cams. The top lies face down, both housings stand upside down on it and long screws
 * go down through their sides into the top; glides cover the screw heads. The drawers are built on their fronts
 * (cam bolts, sides on dowels, bottom down the grooves, the back on push-in dowels), take a knob, and are screwed to
 * the pulled-out runners.
 */

const ADDON_SCREW: HwDef = { kind: "screw", len: 115, dia: 5 };
const ADDON_GLIDE: HwDef = { kind: "glide", len: 6, dia: 16, name: "Glide" };
const ADDON_CAM: HwDef = { kind: "cam", len: 10, dia: 12 };
const PUSH_DOWEL: HwDef = { kind: "dowel", len: 30, dia: 8, name: "Push-in dowel" };
const ADDON_RUN_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };
const DRAWER_FIX: HwDef = { kind: "screw", len: 14, dia: 4 };
const ADDON_KNOB_SCREW: HwDef = { kind: "screw", len: 22, dia: 4 };

function buildAddOn(b: PlanBuilder) {
  // IKEA's page: 110 wide, 12 high, 31 deep
  const W = 1100, H = 120, TT = 18, zB = -155, zT = 135;
  const yT = H - TT, st = 16, hw = 280, hd = 280;
  const top = b.place(b.part("Top", [W, TT, zT - zB]), [0, yT + TT / 2, (zB + zT) / 2]);
  const xs = [-1, 1].map((g) => g * (W / 2 - hw / 2)); // housing centres
  const xi = hw / 2 - st; // centre to the inside of a side
  const sideT = b.part("Side panel", [st, yT, hd]);
  const zs = zB + hd / 2;
  const sides = xs.flatMap((x) => [b.place(sideT, [x - xi - st / 2, yT / 2, zs]), b.place(sideT, [x + xi + st / 2, yT / 2, zs])]);
  const backT = b.part("Back panel", [2 * xi, yT, st]);
  const backs = xs.map((x) => b.place(backT, [x, yT / 2, zB + st / 2]));
  const railT = b.part("Rail", [2 * xi, 20, 50]);
  const zR = 20;
  const rails = xs.map((x) => b.place(railT, [x, 10, zR]));
  const sideOf = (h: number, g: number) => sides[h * 2 + (g < 0 ? 0 : 1)];

  // drawers: a front between the sides, the box riding on the runners
  const fw = 2 * xi - 4, fh = 80, ft = 16, zF = zs + hd / 2 - 5, zIn = zF - ft;
  const ds = 12, dd = 230, dh = 60, dy0 = 30, rt = 13;
  const dx = xi - rt - ds / 2;
  const frontT = b.part("Drawer front", [fw, fh, ft]);
  const fronts = xs.map((x) => b.place(frontT, [x, 20 + fh / 2, zF - ft / 2]));
  const dsT = b.part("Drawer side", [ds, dh, dd]);
  const dSides = xs.flatMap((x) => [b.place(dsT, [x - dx, dy0 + dh / 2, zIn - dd / 2]), b.place(dsT, [x + dx, dy0 + dh / 2, zIn - dd / 2])]);
  const botT = b.part("Drawer bottom", [2 * dx - 4, 3, dd - 14], { material: "fiber" });
  const dBots = xs.map((x) => b.place(botT, [x, dy0 + 8, zIn - dd / 2 - 4]));
  const dBackT = b.part("Drawer back", [2 * dx - ds, dh - 12, ds]);
  const dBacks = xs.map((x) => b.place(dBackT, [x, dy0 + 12 + (dh - 12) / 2, zIn - dd + ds / 2]));
  const dSide = (h: number, g: number) => dSides[h * 2 + (g < 0 ? 0 : 1)];

  const runLen = 240, yRun = dy0 + 20, zRun = zIn - 5 - runLen / 2;
  const each = (f: (h: number, g: number, x: number) => FitOpts[]) => [0, 1].flatMap((h) => [-1, 1].flatMap((g) => f(h, g, xs[h])));
  const runners = each((h, g, x) => [{ on: sideOf(h, g), at: [x + g * xi, yRun, zRun], dir: [g, 0, 0], hole: false }]);
  const runScrews = each((h, g, x) => [zIn - 30, zIn - runLen + 20].map((z): FitOpts => ({ on: sideOf(h, g), at: [x + g * (xi - 4), yRun, z], dir: [g, 0, 0] })));
  // the back and the rail: a dowel in each of their ends, one in the side beside it, and a cam bolt in the side
  const zBk = zB + st / 2;
  const joint = (h: number, back: boolean) => (back ? backs[h] : rails[h]);
  const boltPts = each((h, g, x) => [true, false].map((bk): FitOpts => ({ on: sideOf(h, g), at: [x + g * xi, bk ? yT / 2 : 10, bk ? zBk : zR - 12], dir: [g, 0, 0], mate: joint(h, bk), mateHole: 4 })));
  const boardDowels = each((h, g, x) => [true, false].map((bk): FitOpts => ({ on: joint(h, bk), at: [x + g * xi, bk ? yT * 0.8 : 10, bk ? zBk : zR + 12], dir: [-g, 0, 0], mate: sideOf(h, g) })));
  const sideDowels = each((h, g, x) => [true, false].map((bk): FitOpts => ({ on: sideOf(h, g), at: [x + g * xi, bk ? yT * 0.2 : 10, bk ? zBk : zR], dir: [g, 0, 0], mate: joint(h, bk) })));
  const cams = each((h, g, x) => [
    { on: backs[h], at: [x + g * (xi - 30), yT / 2, zB + st], dir: [0, 0, -1] },
    { on: rails[h], at: [x + g * (xi - 30), 0, zR - 12], dir: [0, 1, 0] },
  ]);
  const scr = each((h, g, x) => [zB + 30, zs + hd / 2 - 30].map((z): FitOpts => ({ on: sideOf(h, g), at: [x + g * (xi + st / 2), 0, z], dir: [0, 1, 0], mate: top })));

  step(b, { title: "Screw the runners into the sides", detail: "Lay the four sides on a rug, inside up. Two screws hold each runner.", tools: ["screwdriver"], scene: "prep", kind: "runners", warnings: ["floor"] }, () => {
    b.stagger(0.15);
    sides.forEach((k, i) => lay(b, [k], b.partItem(k).final.pos, [(i - 1.5) * 330, st / 2, 0], [0, 0, (i % 2 ? -1 : 1) * Math.PI / 2]));
    b.then(0.15);
    b.fits(runnerDef(runLen), runners, 0.15);
    b.then(0.1);
    b.fits(ADDON_RUN_SCREW, runScrews, 0.05);
  });
  step(b, { title: "Screw the cam bolts into the sides", detail: "Two in each side, by hand until they stop.", tools: ["screwdriver"], scene: "prep", kind: "cams" }, () => b.fits(HW.camScrew, boltPts, 0.06));
  step(b, { title: "Tap the dowels into the backs and the rails", detail: "One in each end.", tools: ["hammer"], scene: "boards", kind: "dowels" }, () => {
    b.stagger(0.15);
    [...backs, ...rails].forEach((k, i) => lay(b, [k], b.partItem(k).final.pos, [0, i < 2 ? st / 2 : 10, (i - 1.5) * 160], i < 2 ? [-Math.PI / 2, 0, 0] : [0, 0, 0]));
    b.then(0.15);
    b.fits(HW.dowel, boardDowels, 0.05);
  });
  step(b, { title: "Tap the dowels into the sides", detail: "Two in each side, next to the cam bolts.", tools: ["hammer"], scene: "prep", kind: "dowels" }, () => b.fits(HW.dowel, sideDowels, 0.05));
  step(b, { title: "Push the sides onto the back and the rail", detail: "Upside down, cam bolts towards the boards. Build both housings.", pose: "-y", kind: "join" }, () => {
    b.stagger(0.1);
    for (const k of [...backs, ...rails]) b.add(k, [0, -160, 0]);
    b.then(0.15);
    b.stagger(0.15);
    for (const h of [0, 1]) for (const g of [-1, 1]) b.add(sideOf(h, g), [g * 220, 0, 0]);
  });
  step(b, { title: "Lock the cam locks", detail: "Arrow towards the bolt, then turn clockwise until it pulls tight.", tools: ["screwdriver"], pose: "-y", kind: "cams" }, () => b.fits(HW.cam, cams, 0.1));
  step(b, { title: "Stand both housings on the top", detail: "Lay the top face down on the rug and set the housings on it, upside down, flush with the ends and the back.", pose: "-y", kind: "join", warnings: ["floor"] }, () => b.add(top, [0, 260, 0]));
  step(b, { title: "Screw the housings to the top", detail: "Eight long screws, down through the sides into the top.", tools: ["screwdriver"], pose: "-y", kind: "screws" }, () => b.fits(ADDON_SCREW, scr, 0.08));
  step(b, { title: "Press the glides over the screw heads", detail: "One in each hole; the unit stands on them.", pose: "-y", kind: "legs" }, () =>
    b.fits(ADDON_GLIDE, scr.map((f): FitOpts => ({ on: f.on, at: f.at, dir: f.dir, hole: false })), 0.06),
  );

  // drawers, built on their fronts beside the unit
  const c0 = (h: number): Vec3 => [xs[h], dy0 + dh / 2, zIn - dd / 2];
  const st0 = (k: string, h: number, from: Vec3, shift: Vec3 = [0, 0, 0]) => lay(b, [k], c0(h), [(h ? 1 : -1) * 220 + shift[0], shift[1], shift[2]], [0, 0, 0], from);
  const dy = dy0 + dh / 2;
  const per = (f: (h: number, g: number) => FitOpts[]) => [0, 1].flatMap((h) => [-1, 1].flatMap((g) => f(h, g)));
  const dfit = {
    bolts: per((h, g) => [{ on: fronts[h], at: [xs[h] + g * dx, dy, zIn], dir: [0, 0, 1], mate: dSide(h, g), mateHole: 4 }]),
    dowels: per((h, g) => [{ on: dSide(h, g), at: [xs[h] + g * dx, dy0 + 14, zIn], dir: [0, 0, -1], mate: fronts[h] }]),
    cams: per((h, g) => [{ on: dSide(h, g), at: [xs[h] + g * (dx - ds / 2), dy, zIn - 25], dir: [g, 0, 0] }]),
    pins: per((h, g) => [dy0 + 22, dy0 + dh - 10].map((y): FitOpts => ({ on: dSide(h, g), at: [xs[h] + g * (dx + ds / 2), y, zIn - dd + ds / 2], dir: [-g, 0, 0], mate: dBacks[h] }))),
    knobs: xs.map((x, h): FitOpts => ({ on: fronts[h], at: [x, 60, zF], dir: [0, 0, -1], hole: false })),
    knobScrews: xs.map((x, h): FitOpts => ({ on: fronts[h], at: [x, 60, zIn - 4], dir: [0, 0, 1] })),
    fix: per((h, g) => [{ on: dSide(h, g), at: [xs[h] + g * (dx + ds / 2 + rt - 1), yRun, zIn - 60], dir: [-g, 0, 0] }]),
  };
  const dstep = (title: string, detail: string, body: () => void, x: { tools?: ToolId[]; kind?: StepKind; pose?: Pose } = {}) =>
    step(b, { title, detail, tools: x.tools, scene: "drawer", pose: x.pose ?? "-z", kind: x.kind ?? "drawer" }, body);
  dstep("Screw the cam bolts into the drawer fronts", "Lay each front face down on the rug. Two bolts each.", () => {
    b.stagger(0.2);
    for (const h of [0, 1]) st0(fronts[h], h, [0, 0, -160]);
    b.then(0.15);
    b.fits(HW.camScrew, dfit.bolts, 0.1);
  }, { tools: ["screwdriver"], kind: "cams" });
  dstep("Tap a dowel into each drawer side", "In the front end, below the cam bolt hole.", () => {
    b.stagger(0.15);
    for (const h of [0, 1]) for (const g of [-1, 1]) st0(dSide(h, g), h, [0, 0, -200], [g * 60, 0, -180]);
    b.then(0.15);
    b.fits(HW.dowel, dfit.dowels, 0.1);
  }, { tools: ["hammer"], kind: "dowels" });
  dstep("Stand the sides on the front and lock them", "Grooves facing in. Turn each cam lock clockwise until it pulls tight.", () => {
    b.stagger(0.15);
    for (const h of [0, 1]) for (const g of [-1, 1]) st0(dSide(h, g), h, [0, 0, -180]);
    b.then(0.15);
    b.fits(ADDON_CAM, dfit.cams, 0.1);
  }, { tools: ["screwdriver"], kind: "cams" });
  dstep("Slide the bottom down the grooves", "The smooth side faces into the drawer.", () => {
    b.stagger(0.2);
    for (const h of [0, 1]) st0(dBots[h], h, [0, 0, -400]);
  }, { kind: "join" });
  dstep("Put the back on and hammer in the push-in dowels", "The back drops in over the bottom. Two dowels through each side into the back.", () => {
    b.stagger(0.2);
    for (const h of [0, 1]) st0(dBacks[h], h, [0, 0, -240]);
    b.then(0.15);
    b.fits(PUSH_DOWEL, dfit.pins, 0.08);
  }, { tools: ["hammer"], kind: "dowels" });
  dstep("Screw on the knobs", "The screw goes in from inside the drawer.", () => {
    b.fits(HW.knob, dfit.knobs, 0.2);
    b.then(0.05);
    b.fits(ADDON_KNOB_SCREW, dfit.knobScrews, 0.15);
  }, { tools: ["screwdriver"], kind: "screws", pose: "+y" });
  step(b, { title: "Turn the unit over and pull out the runners", detail: "Stand it on its glides and pull each runner all the way out.", kind: "flip" });
  step(b, { title: "Screw the drawers onto the runners", detail: "Rest each drawer on its runners, then one screw on each side through the runner.", tools: ["screwdriver"], kind: "drawer" }, () => {
    b.stagger(0.04);
    for (const h of [0, 1]) for (const k of [fronts[h], dSide(h, -1), dSide(h, 1), dBots[h], dBacks[h]]) b.add(k, [0, 0, 320]);
    b.then(0.2);
    b.fits(DRAWER_FIX, dfit.fix, 0.1);
  });
  step(b, { title: "Push the drawers in", detail: "They run in until the fronts sit flush with the housings.", kind: "drawer" });
  return true;
}

/* ---------- gateleg desk ---------- */

/*
 * Gateleg desk: the desk shelf takes dowels, an angle bracket and the two leaf hinges underneath; the cubby back
 * stands on it on cam bolts. Lying on its side, the shelf goes onto one leg frame (cam bolts, cams), the front rail
 * goes in on dowels and is screwed to the bracket; on its back, the low back rail and the first frame are bolted
 * through the legs into barrel nuts, then the second frame goes on and is bolted the same way. The grommet and the
 * top dowels go in, two people turn it upside down onto the top, long screws go through the shelf and the cubby
 * back into the top and the glides are tapped in. The two gate frames are dowelled and bolted, take their hinges
 * and glides, and are hinged to the front legs; the leaf takes its bumpers and stops and is screwed to the hinges.
 */

const GATE_BOLT: HwDef = { kind: "bolt", len: 90, dia: 6 };
const GATE_NUT: HwDef = { kind: "nut", len: 12, dia: 10, name: "Barrel nut" };
const GATE_LONG_SCREW: HwDef = { kind: "screw", len: 125, dia: 5 };
const GATE_BRACKET_SCREW: HwDef = { kind: "screw", len: 12, dia: 5 };
const GATE_HINGE_SCREW: HwDef = { kind: "screw", len: 14, dia: 5 };
const GATE_BIG_HINGE: HwDef = { kind: "flatHinge", len: 70, dia: 50 };
const GATE_HINGE: HwDef = { kind: "flatHinge", len: 50, dia: 30, name: "Gate hinge" };
const GATE_GLIDE: HwDef = { kind: "glide", len: 12, dia: 30, name: "Glide" };
const GATE_SMALL_GLIDE: HwDef = { kind: "glide", len: 8, dia: 20, name: "Glide" };
const GATE_BUMPER: HwDef = { kind: "glide", len: 10, dia: 24, name: "Bumper" };
const GATE_BUMPER_SCREW: HwDef = { kind: "screw", len: 16, dia: 3.5 };
const GATE_STOP: HwDef = { kind: "clip", len: 40, dia: 20, name: "Stop" };
const GROMMET: HwDef = { kind: "cap", len: 10, dia: 60, name: "Cable grommet" };

function buildGateleg(b: PlanBuilder) {
  // closed it is 84 x 85 x 41; drawn open, with the leaf up on the gate legs (91 deep)
  const W = 840, H = 850, TT = 18, L = 40;
  const zB = -455, zF = -45, zL = 455; // back, front of the fixed part, front of the leaf
  const xL = W / 2 - L / 2; // leg centre
  const xi = xL - L / 2; // inside face of the frames
  const yTop = H - TT, yS = 720, ST = 18; // underside of the top, of the shelf
  const zFL = zF - L / 2, zBL = zB + L / 2; // front and back leg centres
  const railY = [700, 760], strY = [200, 250];
  const frameT = b.compound("Leg frame", [
    { shape: "box", size: [L, yTop, L], pos: [0, yTop / 2, zFL], material: "wood" },
    { shape: "box", size: [L, yTop, L], pos: [0, yTop / 2, zBL], material: "wood" },
    { shape: "box", size: [L, railY[1] - railY[0], zFL - zBL - L], pos: [0, (railY[0] + railY[1]) / 2, (zFL + zBL) / 2], material: "wood" },
    { shape: "box", size: [L, strY[1] - strY[0], zFL - zBL - L], pos: [0, (strY[0] + strY[1]) / 2, (zFL + zBL) / 2], material: "wood" },
  ], { material: "wood" });
  const frames = [-1, 1].map((g) => b.place(frameT.type, [g * xL, frameT.mid[1], frameT.mid[2]]));
  const shelf = b.place(b.part("Desk shelf", [2 * xi, ST, zF - zB]), [0, yS + ST / 2, (zB + zF) / 2]);
  const zSt = zB + 9, yS1 = yS + ST;
  const strip = b.place(b.part("Cubby back", [2 * xi, yTop - yS1, 18]), [0, (yS1 + yTop) / 2, zSt]);
  const zR1 = zF - 10, zR2 = zB + 30;
  const rail1 = b.place(b.part("Front rail", [2 * xi, 60, 20], { material: "wood" }), [0, yS - 30, zR1]);
  const rail2 = b.place(b.part("Back rail", [2 * xi, 50, 20], { material: "wood" }), [0, 225, zR2]);
  const top = b.place(b.part("Top", [W, TT, zF - zB]), [0, yTop + TT / 2, (zB + zF) / 2]);
  const leaf = b.place(b.part("Leaf", [W, TT, zL - zF]), [0, yS + ST / 2, (zF + zL) / 2]);
  // gate frames: an outer leg under the leaf's front corner, a short stile hinged to the front leg, two cross bars
  const gH = yS - 10, zO = zL - L / 2 - 20, zSt2 = zF + L / 2, bar = [[650, 690], [180, 220]];
  const gLegT = b.part("Gate leg", [L, gH, L], { material: "wood" });
  const gStileT = b.part("Gate stile", [L, 540, L], { material: "wood" });
  const gBarT = b.part("Gate bar", [L, L, zO - zSt2 - L], { material: "wood" });
  const gates = [-1, 1].map((g) => ({
    g,
    leg: b.place(gLegT, [g * xL, gH / 2, zO]),
    stile: b.place(gStileT, [g * xL, 690 - 270, zSt2]),
    bars: bar.map(([y0, y1]) => b.place(gBarT, [g * xL, (y0 + y1) / 2, (zO + zSt2) / 2])),
  }));
  const fr = (g: number) => frames[g < 0 ? 0 : 1];
  const sides = (f: (g: number) => FitOpts[]) => [-1, 1].flatMap(f);

  // fittings
  const shelfDowels = [
    ...sides((g) => [zB + 80, zF - 80].map((z): FitOpts => ({ on: shelf, at: [g * xi, yS + ST / 2, z], dir: [-g, 0, 0], mate: fr(g) }))),
    ...[-250, 250].map((x): FitOpts => ({ on: shelf, at: [x, yS1, zSt], dir: [0, -1, 0], mate: strip })),
  ];
  const bracketAt: Vec3 = [0, yS, zR1 - 22];
  const bracketScrews = [-12, 12].map((x): FitOpts => ({ on: shelf, at: [x, yS - 2, bracketAt[2] - 10], dir: [0, 1, 0] }));
  const railScrews = [-12, 12].map((x): FitOpts => ({ on: rail1, at: [x, yS - 30, zR1 - 12], dir: [0, 0, 1] }));
  const hx = [-250, 250];
  const shelfHinge = hx.flatMap((x) => [-20, 20].flatMap((dx) => [-35, -15].map((dz): FitOpts => ({ on: shelf, at: [x + dx, yS - 2, zF + dz], dir: [0, 1, 0] }))));
  const leafHinge = hx.flatMap((x) => [-20, 20].flatMap((dx) => [15, 35].map((dz): FitOpts => ({ on: leaf, at: [x + dx, yS - 2, zF + dz], dir: [0, 1, 0] }))));
  const stripBolts = [-150, 150].map((x): FitOpts => ({ on: strip, at: [x, yS1, zSt], dir: [0, 1, 0], mate: shelf, mateHole: 4 }));
  const stripCams = [-150, 150].map((x): FitOpts => ({ on: shelf, at: [x, yS + ST / 2, zB], dir: [0, 0, 1] }));
  const stripDowels = sides((g) => [yS1 + 25, yTop - 25].map((y): FitOpts => ({ on: strip, at: [g * xi, y, zSt], dir: [-g, 0, 0], mate: fr(g) })));
  const frameBolts = sides((g) => [zB + 150, zF - 150].map((z): FitOpts => ({ on: fr(g), at: [g * xi, yS + ST / 2, z], dir: [g, 0, 0], mate: shelf, mateHole: 4 })));
  const frameCams = (g: number) => [zB + 150, zF - 150].map((z): FitOpts => ({ on: shelf, at: [g * (xi - 30), yS1, z], dir: [0, -1, 0] }));
  const railDowels = [rail1, rail2].flatMap((r, i) => sides((g): FitOpts[] => [{ on: r, at: [g * xi, i ? 238 : yS - 15, i ? zR2 : zR1], dir: [-g, 0, 0], mate: fr(g) }]));
  // three bolts through each frame: into the front rail, the back rail and the cubby back, each into a barrel nut
  const bolts = (g: number): FitOpts[] => [
    { on: fr(g), at: [g * (xi + L), yS - 42, zR1], dir: [-g, 0, 0], mate: rail1 },
    { on: fr(g), at: [g * (xi + L), 212, zR2], dir: [-g, 0, 0], mate: rail2 },
    { on: fr(g), at: [g * (xi + L), (yS1 + yTop) / 2, zSt], dir: [-g, 0, 0], mate: strip },
  ];
  const nuts = (g: number): FitOpts[] => [
    { on: rail1, at: [g * (xi - 40), yS - 60, zR1], dir: [0, 1, 0], hole: 5 },
    { on: rail2, at: [g * (xi - 40), 200, zR2], dir: [0, 1, 0], hole: 5 },
    { on: strip, at: [g * (xi - 40), (yS1 + yTop) / 2, zB], dir: [0, 0, 1], hole: 5 },
  ];
  const topDowels = [
    ...sides((g) => [zFL, zBL].map((z): FitOpts => ({ on: fr(g), at: [g * xL, yTop, z], dir: [0, -1, 0], mate: top }))),
    ...[-200, 200].map((x): FitOpts => ({ on: strip, at: [x, yTop, zSt], dir: [0, -1, 0], mate: top })),
  ];
  const longScrews = [-330, -60, 60, 330].map((x): FitOpts => ({ on: shelf, at: [x, yS, zSt], dir: [0, 1, 0], mate: top }));
  const glides = sides((g) => [zFL, zBL].map((z): FitOpts => ({ on: fr(g), at: [g * xL, 0, z], dir: [0, 1, 0], hole: false })));
  const gateDowels = gates.flatMap((t) => t.bars.flatMap((k, j) => [
    { on: k, at: [t.g * xL, (bar[j][0] + bar[j][1]) / 2 + 8, zO - L / 2], dir: [0, 0, -1], mate: t.leg } as FitOpts,
    { on: k, at: [t.g * xL, (bar[j][0] + bar[j][1]) / 2 + 8, zSt2 + L / 2], dir: [0, 0, 1], mate: t.stile } as FitOpts,
  ]));
  const gateBolts = gates.flatMap((t) => t.bars.flatMap((k, j) => [
    { on: t.leg, at: [t.g * xL, (bar[j][0] + bar[j][1]) / 2 - 8, zO + L / 2], dir: [0, 0, -1], mate: k } as FitOpts,
    { on: t.stile, at: [t.g * xL, (bar[j][0] + bar[j][1]) / 2 - 8, zSt2 - L / 2], dir: [0, 0, 1], mate: k } as FitOpts,
  ]));
  const gateNuts = gates.flatMap((t) => t.bars.flatMap((k, j) => [zO - L / 2 - 40, zSt2 + L / 2 + 40].map((z): FitOpts => ({ on: k, at: [t.g * xL, bar[j][0], z], dir: [0, 1, 0], hole: 5 }))));
  const hy = [260, 600];
  const gateHinges = gates.flatMap((t) => hy.map((y): FitOpts => ({ on: t.stile, at: [t.g * (xL + L / 2), y, zF], dir: [-t.g, 0, 0], hole: false })));
  const gateHingeScrews = gates.flatMap((t) => hy.flatMap((y) => [-15, 15].map((dy): FitOpts => ({ on: t.stile, at: [t.g * (xL + L / 2 + 1), y + dy, zF + 14], dir: [-t.g, 0, 0] }))));
  const legHingeScrews = gates.flatMap((t) => hy.flatMap((y) => [-15, 15].map((dy): FitOpts => ({ on: fr(t.g), at: [t.g * (xL + L / 2 + 1), y + dy, zF - 14], dir: [-t.g, 0, 0] }))));
  const gateGlides = gates.map((t): FitOpts => ({ on: t.leg, at: [t.g * xL, 0, zO], dir: [0, 1, 0], hole: false }));
  const bumpers = gates.map((t): FitOpts => ({ on: leaf, at: [t.g * xL, yS - 1, zO], dir: [0, 1, 0], hole: false }));
  const bumperScrews = gates.map((t): FitOpts => ({ on: leaf, at: [t.g * xL, yS - 8, zO], dir: [0, 1, 0] }));
  const stops = gates.map((t): FitOpts => ({ on: leaf, at: [t.g * (xi - 25), yS, zO - 30], dir: [0, 1, 0], hole: false }));

  const flatOn = (k: string, at: Vec3, rot: Vec3 = [0, 0, 0]) => lay(b, [k], b.partItem(k).final.pos, at, rot);
  step(b, { title: "Tap the dowels into the desk shelf", detail: "Lay it upside down on a rug. Two in each end and two along the back edge.", tools: ["hammer"], pose: "-y", kind: "dowels", warnings: ["floor"] }, () => {
    b.add(shelf, [0, -200, 0]);
    b.then(0.15);
    b.fits(HW.dowel, shelfDowels, 0.06);
  });
  step(b, { title: "Screw the angle bracket under the shelf", detail: "In the middle, near the front edge. Use the short screws.", tools: ["screwdriver"], pose: "-y", kind: "screws" }, () => {
    b.fit(HW.angle, { on: shelf, at: bracketAt, dir: [0, 1, 0], hole: false });
    b.then(0.1);
    b.fits(GATE_BRACKET_SCREW, bracketScrews, 0.1);
  });
  step(b, { title: "Screw the leaf hinges to the shelf", detail: "Knuckles along the front edge. Four screws each.", tools: ["screwdriver"], pose: "-y", kind: "hinges" }, () => {
    b.fits(GATE_BIG_HINGE, hx.map((x): FitOpts => ({ on: shelf, at: [x, yS, zF], dir: [0, 1, 0], hole: false })), 0.15);
    b.then(0.1);
    b.fits(GATE_HINGE_SCREW, shelfHinge, 0.04);
  });
  step(b, { title: "Screw the cam bolts into the cubby back", detail: "Two in its bottom edge.", tools: ["screwdriver"], scene: "strip", kind: "cams" }, () => {
    flatOn(strip, [0, 9, 0], [-Math.PI / 2, 0, 0]);
    b.then(0.15);
    b.fits(HW.camScrew, stripBolts, 0.1);
  });
  step(b, { title: "Tap the dowels into the cubby back", detail: "Two in each end.", tools: ["hammer"], scene: "strip", kind: "dowels" }, () => b.fits(HW.dowel, stripDowels, 0.06));
  step(b, { title: "Stand the cubby back on the shelf", detail: "Turn the shelf over. The back goes on the dowels and bolts along its back edge.", kind: "join" }, () => b.add(strip, [0, 220, 0]));
  step(b, { title: "Lock the cubby back", detail: "Two cam locks in the back edge of the shelf, turned clockwise until tight.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(HW.cam, stripCams, 0.12));
  step(b, { title: "Screw the cam bolts into the leg frames", detail: "Two in each frame, on the inside of the upper rail.", tools: ["screwdriver"], scene: "frames", kind: "cams" }, () => {
    b.stagger(0.2);
    frames.forEach((k, i) => flatOn(k, [0, L / 2, (i ? 1 : -1) * 260], [0, 0, (i ? 1 : -1) * Math.PI / 2]));
    b.then(0.15);
    b.fits(HW.camScrew, frameBolts, 0.08);
  });
  step(b, { title: "Lay a leg frame down and stand the shelf in it", detail: "Frame flat on the rug, bolts up. The shelf and the cubby back go onto its dowels and bolts.", pose: "+x", kind: "join", warnings: ["floor"] }, () => b.add(frames[0], [-260, 0, 0]));
  step(b, { title: "Lock the shelf to the frame", detail: "Two cam locks, turned clockwise until tight.", tools: ["screwdriver"], pose: "+x", kind: "cams" }, () => b.fits(HW.cam, frameCams(-1), 0.12));
  step(b, { title: "Tap the dowels into the two rails", detail: "One in each end.", tools: ["hammer"], scene: "rails", kind: "dowels" }, () => {
    b.stagger(0.15);
    flatOn(rail1, [0, 30, 120]);
    flatOn(rail2, [0, 25, -120]);
    b.then(0.15);
    b.fits(HW.dowel, railDowels, 0.08);
  });
  step(b, { title: "Stand the front rail in the frame", detail: "Under the front of the shelf, its dowels in the front leg.", pose: "+x", kind: "join" }, () => b.add(rail1, [260, 0, 0]));
  step(b, { title: "Screw the bracket to the front rail", detail: "Two screws through the bracket into the rail.", tools: ["screwdriver"], pose: "+x", kind: "screws" }, () => b.fits(GATE_BRACKET_SCREW, railScrews, 0.1));
  step(b, { title: "Turn it onto its back and bolt the frame", detail: "Fit the back rail on its dowels, then three bolts through the frame into barrel nuts. Slot up on each nut.", tools: ["allen", "flathead"], pose: "+z", kind: "bolts" }, () => {
    b.add(rail2, [260, 0, 0]);
    b.then(0.15);
    b.fits(GATE_NUT, nuts(-1), 0.1);
    b.then(0.1);
    b.fits(GATE_BOLT, bolts(-1), 0.12);
  });
  step(b, { title: "Put the other leg frame on", detail: "Onto the dowels and bolts of the shelf, the cubby back and both rails at once.", pose: "+z", kind: "join" }, () => b.add(frames[1], [300, 0, 0]));
  step(b, { title: "Lock the shelf to the second frame", detail: "Two cam locks, turned clockwise until tight.", tools: ["screwdriver"], pose: "+z", kind: "cams" }, () => b.fits(HW.cam, frameCams(1), 0.12));
  step(b, { title: "Bolt the second frame", detail: "Three bolts into barrel nuts, like the first frame.", tools: ["allen", "flathead"], pose: "+z", kind: "bolts" }, () => {
    b.fits(GATE_NUT, nuts(1), 0.1);
    b.then(0.1);
    b.fits(GATE_BOLT, bolts(1), 0.12);
  });
  step(b, { title: "Press the cable grommet into the shelf", detail: "Into the round hole.", pose: "+z", kind: "general" }, () => b.fit(GROMMET, { on: shelf, at: [220, yS1, -280], dir: [0, -1, 0], hole: false }));
  step(b, { title: "Tap the dowels into the tops of the legs", detail: "One in each leg and two in the top edge of the cubby back.", tools: ["hammer"], pose: "+z", kind: "dowels" }, () => b.fits(HW.dowel, topDowels, 0.08));
  step(b, { title: "Turn it upside down onto the top", detail: "Lay the top face down on the rug. Lift the frame together and lower it onto the top's holes.", pose: "-y", people: 2, kind: "flip", warnings: ["two", "floor"] }, () => b.add(top, [0, 300, 0]));
  step(b, { title: "Screw the shelf to the top", detail: "Four long screws through the shelf and the cubby back into the top.", tools: ["screwdriver"], pose: "-y", kind: "screws" }, () => b.fits(GATE_LONG_SCREW, longScrews, 0.1));
  step(b, { title: "Tap the glides into the legs", detail: "One in the end of each leg.", tools: ["hammer"], pose: "-y", kind: "legs" }, () => b.fits(GATE_GLIDE, glides, 0.1));

  // the gate frames, built flat on their sides
  const gPivot = (g: number): Vec3 => [g * xL, 360, (zO + zSt2) / 2];
  const gStage = (k: string, g: number) => lay(b, [k], gPivot(g), [0, L / 2, g * 300], [0, 0, Math.PI / 2]);
  step(b, { title: "Tap the dowels into the gate bars", detail: "One in each end of the four short bars.", tools: ["hammer"], scene: "gates", kind: "dowels", repeat: 2 }, () => {
    b.stagger(0.12);
    for (const t of gates) for (const k of t.bars) gStage(k, t.g);
    b.then(0.15);
    b.fits(HW.dowel, gateDowels, 0.05);
  });
  step(b, { title: "Bolt the gate frames together", detail: "Push the bars onto the leg and the stile, then a bolt into a barrel nut at each joint.", tools: ["allen", "flathead"], scene: "gates", kind: "bolts", repeat: 2 }, () => {
    b.stagger(0.12);
    for (const t of gates) for (const k of [t.leg, t.stile]) gStage(k, t.g);
    b.then(0.15);
    b.fits(GATE_NUT, gateNuts, 0.06);
    b.then(0.1);
    b.fits(GATE_BOLT, gateBolts, 0.08);
  });
  step(b, { title: "Screw the hinges to the stiles", detail: "Two hinges on each stile, two screws in each.", tools: ["screwdriver"], scene: "gates", kind: "hinges", repeat: 2 }, () => {
    b.fits(GATE_HINGE, gateHinges, 0.12);
    b.then(0.1);
    b.fits(GATE_HINGE_SCREW, gateHingeScrews, 0.05);
  });
  step(b, { title: "Tap a glide into each gate leg", detail: "Into the bottom end of the long leg.", tools: ["hammer"], scene: "gates", kind: "legs" }, () => b.fits(GATE_SMALL_GLIDE, gateGlides, 0.15));
  step(b, { title: "Hinge the gate frames to the front legs", detail: "Turn the desk upright. Hold each frame against the front leg and screw the hinges on, two screws each.", tools: ["screwdriver"], kind: "hinges" }, () => {
    b.stagger(0.04);
    for (const t of gates) for (const k of [t.leg, t.stile, ...t.bars]) b.add(k, [t.g * 240, 0, 0]);
    b.then(0.2);
    b.fits(GATE_HINGE_SCREW, legHingeScrews, 0.05);
  });
  step(b, { title: "Screw the bumpers under the leaf", detail: "Lay the leaf face down. One near each front corner, where the gate legs meet it.", tools: ["screwdriver"], scene: "leaf", pose: "-y", kind: "screws" }, () => {
    flatOn(leaf, [0, ST / 2, 0]);
    b.then(0.15);
    b.fits(GATE_BUMPER, bumpers, 0.12);
    b.then(0.05);
    b.fits(GATE_BUMPER_SCREW, bumperScrews, 0.1);
  });
  step(b, { title: "Press in the stops", detail: "One on each side, just inside the bumpers. They keep the gate legs from swinging too far.", scene: "leaf", pose: "-y", kind: "general" }, () => b.fits(GATE_STOP, stops, 0.12));
  step(b, { title: "Screw the leaf to the hinges", detail: "Swing the gate legs out, rest the leaf on them and screw it to the two hinges, four screws each.", tools: ["screwdriver"], kind: "hinges" }, () => {
    b.add(leaf, [0, 260, 0]);
    b.then(0.2);
    b.fits(GATE_HINGE_SCREW, leafHinge, 0.04);
  });
  return true;
}

const family: Family = {
  names: ["GULLABERG"],
  build(b, s) {
    const slug = s.slug ?? "";
    if (s.archetype === "bed") return buildBed(b, s);
    const chest = /^gullaberg-chest-(\d)-drawers/.exec(slug);
    if (chest && CHESTS[Number(chest[1])]) return buildChest(b, s, CHESTS[Number(chest[1])]);
    if (/^gullaberg-wardrobe/.test(slug)) return buildWardrobe(b, s);
    if (/^gullaberg-shoe-cabinet/.test(slug)) return buildShoe(b, s);
    if (/^gullaberg-desk/.test(slug)) return buildDesk(b, s);
    if (/^gullaberg-add-on-unit/.test(slug)) return buildAddOn(b);
    if (/^gullaberg-gateleg-desk/.test(slug)) return buildGateleg(b);
    if (/^gullaberg-storage-bench/.test(slug)) return buildChest(b, s, BENCH);
    const table = /^gullaberg-bedside-table/.exec(slug);
    if (table) return buildTable(b, s, /door/i.test(s.variant) || s.size.w < 45);
    return false;
  },
};
export default family;

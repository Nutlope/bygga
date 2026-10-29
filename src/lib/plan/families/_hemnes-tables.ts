import type { PartMaterial, PartPiece, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";
import { rotate } from "../math";

/*
 * HEMNES desks and dressing tables, read from IKEA's manuals and drawn straight with PlanBuilder, since the drawers
 * of these pieces hang on runners under the top and are fixed to it while it lies upside down.
 */

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, c: number, n: number) => range(n).map((i) => (n === 1 ? (a + c) / 2 : a + ((c - a) * i) / (n - 1)));

// fittings, sized so different ones stay apart in the list
const DOWEL: HwDef = { kind: "dowel", len: 30, dia: 8 };
const BIG_DOWEL: HwDef = { kind: "dowel", len: 40, dia: 10 };
const CAM_BOLT: HwDef = HW.camScrew;
const DRAWER_BOLT: HwDef = { kind: "camScrew", len: 24, dia: 6 };
const CAM: HwDef = HW.cam;
const DRAWER_CAM: HwDef = { kind: "cam", len: 12, dia: 12 };
const ROD: HwDef = { kind: "stud", len: 60, dia: 8, name: "Threaded rod" };
const NUT: HwDef = { kind: "nut", len: 7, dia: 8 };
const WEDGE: HwDef = { kind: "washer", len: 4, dia: 22, name: "Wedge washer" };
const LONG_SCREW: HwDef = { kind: "screw", len: 100, dia: 6 };
const TOP_SCREW: HwDef = { kind: "screw", len: 60, dia: 6 };
const SMALL_SCREW: HwDef = { kind: "screw", len: 16, dia: 4 };
const TAB_SCREW: HwDef = { kind: "screw", len: 16, dia: 3.5 };
const HINGE_SCREW: HwDef = { kind: "screw", len: 14, dia: 4 };
const KNOB: HwDef = HW.knob;
const KNOB_BOLT: HwDef = { kind: "screw", len: 32, dia: 4, name: "Knob bolt" };
const HINGE: HwDef = HW.hinge;
const HINGE_PLATE: HwDef = { kind: "plate", len: 40, dia: 20, name: "Hinge plate" };
const GROMMET: HwDef = { kind: "cap", len: 20, dia: 60, name: "Cable grommet" };
const runnerDef = (len: number): HwDef => ({ kind: "runner", len: Math.round(len / 10) * 10, dia: 20 });

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

/** Parts by our own ids, so the steps read like the manual. */
class Kit {
  private keys = new Map<string, string>();
  private types = new Map<string, string>();
  constructor(readonly b: PlanBuilder) {}
  part(id: string, name: string, size: Vec3, pos: Vec3, o: { material?: PartMaterial; shape?: "box" | "cyl"; pieces?: PartPiece[]; rot?: Vec3 } = {}) {
    const tk = `${name}|${size.map(Math.round).join("x")}|${o.shape ?? "box"}|${o.material ?? "board"}|${o.pieces ? JSON.stringify(o.pieces) : ""}`;
    let ref = this.types.get(tk);
    if (!ref) {
      ref = this.b.part(name, size, { shape: o.shape, material: o.material });
      if (o.pieces) this.b.parts[this.b.parts.length - 1].pieces = o.pieces;
      this.types.set(tk, ref);
    }
    this.keys.set(id, this.b.place(ref, pos, o.rot ?? [0, 0, 0]));
    return id;
  }
  k(id: string) {
    const k = this.keys.get(id);
    if (!k) throw new Error("no part " + id);
    return k;
  }
  step(o: StepOpts, body: () => void = () => {}) {
    return this.b.step({ kind: "general", ...o, warnings: o.warnings ?? (o.people === 2 ? ["two"] : []) }, body);
  }
  add(ids: string[], from?: Vec3) {
    for (const id of ids) this.b.add(this.k(id), from);
  }
  /** Fittings at points of the finished product, going in along `dir`, into `on`, their other end into `mate`. */
  pts(on: string | undefined, dir: Vec3, at: Vec3[], mate?: string, o: Partial<FitOpts> = {}): FitOpts[] {
    return at.map((p) => ({ at: p, dir, on: on ? this.k(on) : undefined, mate: mate ? this.k(mate) : undefined, ...o }));
  }
  fit(def: HwDef, list: FitOpts[], gap = 0.06) {
    return this.b.fits(def, list, gap);
  }
  preset(def: HwDef, list: FitOpts[]) {
    for (const o of list) this.b.preset(def, o);
  }
  /** Parts shown together somewhere else: turned by `rot` about `pivot`, then moved to `at`. */
  stage(ids: string[], pivot: Vec3, rot: Vec3, at: Vec3, from?: Vec3) {
    for (const id of ids) {
      const it = this.b.partItem(this.k(id));
      const p = rotate([it.final.pos[0] - pivot[0], it.final.pos[1] - pivot[1], it.final.pos[2] - pivot[2]], rot);
      this.b.stage(this.k(id), [p[0] + at[0], p[1] + at[1], p[2] + at[2]], rot, from);
    }
  }
}

/** A side frame that comes in one piece: two legs and the rails between them. */
function legFrame(kit: Kit, id: string, o: { x: number; P: number; legH: number; zf: number; zb: number; rails: { y: number; h: number; t: number }[] }) {
  const zm = (o.zf + o.zb) / 2;
  const len = o.zf - o.zb - o.P;
  const pieces: PartPiece[] = [
    { shape: "box", size: [o.P, o.legH, o.P], pos: [0, 0, o.zf - zm], material: "wood" },
    { shape: "box", size: [o.P, o.legH, o.P], pos: [0, 0, o.zb - zm], material: "wood" },
    ...o.rails.map((r): PartPiece => ({ shape: "box", size: [r.t, r.h, len], pos: [Math.sign(o.x) * (o.P / 2 - r.t / 2 - 5), r.y - o.legH / 2, 0], material: "wood" })),
  ];
  return kit.part(id, "Leg frame", [o.P, o.legH, o.zf - o.zb + o.P], [o.x, o.legH / 2, zm], { material: "wood", pieces });
}

/*
 * Drawers built on their fronts (desk with 2 drawers, dressing table 110): cam bolts in the front, the sides stand
 * on them and lock, the bottom slides down the grooves, the back sits on it with two screws a side, then the knob and
 * a runner screwed to each side. One is built on screen; the rest are the same.
 */
interface HungBox {
  id: string;
  x: number;
  y0: number; // underside of the front
  fw: number;
  fh: number;
  zf: number; // front face
  dd: number; // depth, front face to back face
}
interface Hung {
  box: HungBox;
  parts: string[];
  fits: Record<"bolts" | "cams" | "back" | "knob" | "knobBolt" | "runner" | "runnerScrews", [HwDef, FitOpts[]]>;
  xs: number;
  zc: number;
  runners: boolean;
}
const DRAWER_NAIL: HwDef = { kind: "nail", len: 30, dia: 3 };
function hungDrawers(kit: Kit, list: HungBox[], o: { runners: boolean }): Hung[] {
  const ft = 20, st = 14;
  return list.map((box) => {
    const id = box.id;
    const xs = box.fw / 2 - (o.runners ? 35 : 16); // side centres from the middle: room for the runners outside them
    const sh = box.fh - 22;
    const ys = box.y0 + 6;
    const zIn = box.zf - ft;
    const sl = box.dd - ft;
    const zc = zIn - sl / 2;
    kit.part(`${id}f`, "Drawer front", [box.fw, box.fh, ft], [box.x, box.y0 + box.fh / 2, box.zf - ft / 2]);
    kit.part(`${id}l`, "Drawer side", [st, sh, sl], [box.x - xs, ys + sh / 2, zc]);
    kit.part(`${id}r`, "Drawer side", [st, sh, sl], [box.x + xs, ys + sh / 2, zc]);
    const bw = 2 * xs - st;
    kit.part(`${id}b`, "Drawer bottom", [bw + 8, 4, sl - st - 4], [box.x, ys + 8, zc + st / 2 + 2], { material: "fiber" });
    kit.part(`${id}k`, "Drawer back", [bw, sh - 14, st], [box.x, ys + 14 + (sh - 14) / 2, zIn - sl + st / 2]);
    const per = (fn: (g: number, side: string) => FitOpts[]) => [...fn(-1, `${id}l`), ...fn(1, `${id}r`)];
    const yr = ys + sh - 18;
    const zBk = zIn - sl + st / 2;
    const runners = per((g, sd) => kit.pts(sd, [-g, 0, 0], [[box.x + g * (xs + st / 2 + 6), yr, zc]], undefined, { hole: false }));
    const fits: Hung["fits"] = {
      bolts: [DRAWER_BOLT, per((g, sd) => [ys + 20, ys + sh - 20].flatMap((y) => kit.pts(`${id}f`, [0, 0, 1], [[box.x + g * xs, y, zIn]], sd, { mateHole: 3 })))],
      cams: [DRAWER_CAM, per((g, sd) => [ys + 20, ys + sh - 20].flatMap((y) => kit.pts(sd, [g, 0, 0], [[box.x + g * (xs - st / 2), y, zIn - 25]])))],
      back: [o.runners ? SMALL_SCREW : DRAWER_NAIL, per((g, sd) => [ys + 30, ys + sh - 20].flatMap((y) => kit.pts(sd, [-g, 0, 0], [[box.x + g * (xs + st / 2), y, zBk]], `${id}k`)))],
      knob: [KNOB, kit.pts(`${id}f`, [0, 0, -1], [[box.x, box.y0 + box.fh / 2, box.zf]], undefined, { hole: false })],
      knobBolt: [KNOB_BOLT, kit.pts(`${id}f`, [0, 0, 1], [[box.x, box.y0 + box.fh / 2, zIn - 2]])],
      runner: [runnerDef(sl - 20), o.runners ? runners : []],
      runnerScrews: [SMALL_SCREW, o.runners ? per((g, sd) => [zIn - 40, zIn - sl + 40].flatMap((z) => kit.pts(sd, [-g, 0, 0], [[box.x + g * (xs + st / 2 + 8), yr, z]]))) : []],
    };
    return { box, parts: [`${id}f`, `${id}l`, `${id}r`, `${id}b`, `${id}k`], fits, xs, zc, runners: o.runners };
  });
}
const allFits = (d: Hung) => Object.values(d.fits).filter(([, l]) => l.length);

/** The first drawer built on screen in its own scene, lying on its front; "do this for each". */
function buildHung(kit: Kit, d: Hung, n: number) {
  const b = kit.b;
  const id = d.box.id;
  const c: Vec3 = [d.box.x, d.box.y0 + d.box.fh / 2, d.zc];
  const st = (k: string, from?: Vec3) => {
    const it = b.partItem(kit.k(k));
    b.stage(kit.k(k), [it.final.pos[0] - c[0], it.final.pos[1] - c[1], it.final.pos[2] - c[2]], it.final.rot, from);
  };
  const f = d.fits;
  const put = (x: [HwDef, FitOpts[]], gap: number) => kit.fit(x[0], x[1], gap);
  const o = (title: string, detail: string, body: () => void, x: { tools?: ToolId[]; kind?: StepKind; pose?: Pose } = {}) =>
    kit.step({ title, detail, tools: x.tools, scene: "drawer", pose: x.pose ?? "-z", repeat: n > 1 ? n : undefined, kind: x.kind ?? "drawer" }, body);
  o("Screw the cam bolts into the drawer front", "Lay it face down on a rug. Four bolts, by hand until they stop.", () => {
    st(`${id}f`, [0, 0, -160]);
    b.then(0.15);
    put(f.bolts, 0.08);
  }, { tools: ["screwdriver"], kind: "cams" });
  o("Stand the sides on the front", "Onto the bolts, with the grooves for the bottom facing in and down.", () => {
    b.stagger(0.2);
    st(`${id}l`, [0, 0, -260]);
    st(`${id}r`, [0, 0, -260]);
  }, { kind: "join" });
  o("Lock the cam locks", "Arrow towards the bolt, then turn each one clockwise.", () => put(f.cams, 0.1), { tools: ["screwdriver"], kind: "cams" });
  o("Slide in the drawer bottom", "It runs down the grooves in the sides until it reaches the front.", () => st(`${id}b`, [0, 0, -380]));
  if (d.runners) {
    o("Lay the drawer back on", "It sits on the bottom, between the sides.", () => st(`${id}k`, [0, 0, -240]), { kind: "join" });
    o("Screw the back on", "Two screws through each side into the back.", () => put(f.back, 0.1), { tools: ["screwdriver"], kind: "screws" });
  } else {
    o("Put the drawer back on", "It sits on the bottom, between the sides. Tap two fasteners through each side into it.", () => {
      st(`${id}k`, [0, 0, -240]);
      b.then(0.15);
      put(f.back, 0.1);
    }, { tools: ["hammer"], kind: "nails" });
  }
  o("Screw on the knob", "The bolt goes in from inside the drawer.", () => {
    put(f.knob, 0.2);
    b.then(0.05);
    put(f.knobBolt, 0.15);
  }, { tools: ["screwdriver"], kind: "screws", pose: "+y" });
  if (!d.runners) return;
  o("Screw the runners to the sides", "One along the top of each side, two screws each.", () => {
    put(f.runner, 0.25);
    b.then(0.1);
    put(f.runnerScrews, 0.08);
  }, { tools: ["screwdriver"], kind: "runners", pose: "+y" });
  o("Check the runners", "Turn the drawer over, slide the outer part of each runner off towards the front, then push it back on from the back and turn the drawer back over.", () => {}, { pose: "-y" });
}

/* ---------- desk with 2 drawers 120 x 47 ---------- */

/*
 * Two ready-made leg frames. It is built standing on its left end: the left frame lies on a rug, the drawer shelf,
 * the front rail, the back board (on threaded rods and nuts) and the low stretcher stand in it on dowels and cam
 * locks, then the right frame goes on top. The drawers are built on their fronts and screwed by their runners under
 * the top while it lies upside down, with a block between them; the top goes on with dowels and long screws, and the
 * cable flap at the back clicks onto two hinges.
 */
function desk2(b: PlanBuilder, s: ProductSpec) {
  const kit = new Kit(b);
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const topT = 28, P = 50, legH = H - topT, ov = 10;
  const xo = W / 2 - ov, xp = xo - P / 2, xi = xo - P; // leg outer face, leg centre, leg inner face
  const xr = xo - 15, xri = xr - 10; // side rail centre and inner face
  const zf = D / 2 - ov, zb = -D / 2 + ov; // front and back faces of the legs
  const zpf = zf - P / 2, zpb = zb + P / 2;
  const apron = 140, yA = legH - apron; // underside of the side rails
  const yL = 180; // low rails
  const flapD = 140;
  const zBoard = -D / 2 + flapD + 9; // back board centre, under the back edge of the top
  for (const L of ["L", "R"]) {
    const g = L === "L" ? -1 : 1;
    legFrame(kit, `f${L}`, { x: g * xp, P, legH, zf: zpf, zb: zpb, rails: [{ y: legH - apron / 2, h: apron, t: 20 }, { y: yL, h: 50, t: 20 }] });
  }
  kit.part("shelf", "Drawer shelf", [2 * xri, 16, zpf - P / 2 - (zBoard + 9)], [0, yA + 8, (zpf - P / 2 + zBoard + 9) / 2]);
  kit.part("rail", "Front rail", [2 * xi, 28, 40], [0, yA + 14, zf - 20], { material: "wood" });
  kit.part("board", "Back board", [2 * xri, apron, 18], [0, legH - apron / 2, zBoard]);
  kit.part("str", "Stretcher", [2 * xri, 50, 20], [0, yL, 0], { material: "wood" });
  const zTop = -D / 2 + flapD;
  kit.part("top", "Top", [W, topT, D / 2 - zTop], [0, legH + topT / 2, (D / 2 + zTop) / 2], { material: "wood" });
  kit.part("flap", "Cable flap", [W, topT, flapD], [0, legH + topT / 2, (zTop - D / 2) / 2], { material: "wood" });
  const zBf = zBoard + 9; // front face of the back board
  kit.part("block", "Middle block", [20, apron - 30, zf - 30 - zBf], [0, legH - (apron - 30) / 2, (zf - 30 + zBf) / 2]);
  const ow = (2 * xi - 20) / 2; // each drawer opening
  const drawers = hungDrawers(
    kit,
    [-1, 1].map((g, i) => ({ id: `d${i}`, x: g * (10 + ow / 2), y0: yA + 28, fw: ow - 4, fh: apron - 28 - 6, zf, dd: zf - zBf - 10 })),
    { runners: true },
  );
  const ys = (y: number) => [y - 30, y + 30];

  const sideFits = (L: string) => {
    const g = L === "L" ? -1 : 1;
    const zs = spread(zBf + 25, zpf - P / 2 - 25, 4);
    return {
      rods: kit.pts(`f${L}`, [g, 0, 0], ys(legH - apron / 2).map((y): Vec3 => [g * xri, y, zBoard]), "board", { mateHole: 5 }),
      bolts: [
        ...kit.pts(`f${L}`, [g, 0, 0], zs.map((z): Vec3 => [g * xri, yA + 8, z]), "shelf", { mateHole: 4 }),
        ...kit.pts(`f${L}`, [g, 0, 0], [[g * xi, yA + 14, zf - 20]], "rail", { mateHole: 4 }),
        ...kit.pts(`f${L}`, [g, 0, 0], [[g * xri, yL, 0]], "str", { mateHole: 4 }),
      ],
      shelfDowels: kit.pts("shelf", [-g, 0, 0], [zs[0] + 30, zs[3] - 30].map((z): Vec3 => [g * xri, yA + 8, z]), `f${L}`),
      shelfCams: kit.pts("shelf", [0, -1, 0], zs.map((z): Vec3 => [g * (xri - 26), yA + 16, z])),
      railDowel: kit.pts("rail", [-g, 0, 0], [[g * xi, yA + 14, zf - 32]], `f${L}`),
      railCam: kit.pts("rail", [0, -1, 0], [[g * (xi - 26), yA + 28, zf - 20]]),
      boardDowels: kit.pts("board", [-g, 0, 0], [yA + 40, legH - 20].map((y): Vec3 => [g * xri, y, zBoard]), `f${L}`),
      nuts: kit.pts("board", [g, 0, 0], ys(legH - apron / 2).map((y): Vec3 => [g * (xri - 40), y, zBoard])),
      strDowel: kit.pts("str", [-g, 0, 0], [[g * xri, yL + 12, 0]], `f${L}`),
      strCam: kit.pts("str", [0, -1, 0], [[g * (xri - 26), yL + 25, 0]]),
    };
  };
  const fl = sideFits("L"), fr = sideFits("R");
  const pose = "+x" as const;

  kit.step({ title: "Screw the threaded rods into the leg frames", detail: "Both frames on a rug, inside up. Two rods in each, by hand, into the holes near the back legs.", tools: [], pose, kind: "bolts", repeat: 2, warnings: ["floor"] }, () => {
    kit.add(["fL"], [0, 200, 0]);
    b.then(0.15);
    kit.fit(ROD, fl.rods, 0.12);
  });
  kit.step({ title: "Screw the cam bolts into the leg frames", detail: "Six in each: four along the top rail, one in the front leg and one in the low rail.", tools: ["screwdriver"], pose, kind: "cams", repeat: 2 }, () => kit.fit(CAM_BOLT, fl.bolts, 0.08));
  kit.step({ title: "Stand the drawer shelf in", detail: "The left frame stays on the rug. Two dowels in the end of the shelf, then push it onto the bolts, cable hole at the bottom.", tools: ["hammer"], pose, kind: "join" }, () => {
    kit.fit(DOWEL, fl.shelfDowels, 0.1);
    b.then(0.15);
    kit.add(["shelf"], [300, 0, 0]);
  });
  kit.step({ title: "Lock the shelf", detail: "Four cam locks, arrow towards the bolt, then a clockwise turn.", tools: ["screwdriver"], pose, kind: "cams" }, () => kit.fit(CAM, fl.shelfCams, 0.1));
  kit.step({ title: "Stand the front rail in", detail: "One dowel in its end. The flat side faces the front.", tools: ["hammer"], pose, kind: "join" }, () => {
    kit.fit(DOWEL, fl.railDowel);
    b.then(0.15);
    kit.add(["rail"], [300, 0, 0]);
  });
  kit.step({ title: "Lock the front rail", detail: "One cam lock.", tools: ["screwdriver"], pose, kind: "cams" }, () => kit.fit(CAM, fl.railCam));
  const plates = kit.pts("board", [0, 0, 1], [-1, 1].map((g): Vec3 => [g * W * 0.3, legH - 14, zBoard - 9]), undefined, { hole: false });
  kit.step({ title: "Fit the hinge plates on the back board", detail: "Press each plate into its holes on the back face, then turn its two screws in.", tools: ["screwdriver"], pose, scene: "board", kind: "hinges" }, () => {
    b.stage(kit.k("board"), [9, 0, 0], [0, -Math.PI / 2, 0], [200, 0, 0]);
    b.then(0.15);
    kit.fit(HINGE_PLATE, plates, 0.2);
  });
  kit.step({ title: "Stand the back board onto the rods", detail: "Two dowels in its end, then slide its holes over the rods. Hinge plates at the back, at the top.", tools: ["hammer"], pose, kind: "join" }, () => {
    kit.fit(DOWEL, fl.boardDowels, 0.1);
    b.then(0.15);
    kit.add(["board"], [300, 0, 0]);
  });
  kit.step({ title: "Tighten the rods with nuts", detail: "A wedge washer and a nut on each rod, through the holes in the board. Tighten with the spanner.", tools: ["wrench"], pose, kind: "bolts" }, () => {
    kit.fit(WEDGE, fl.nuts, 0.12);
    b.then(0.05);
    kit.fit(NUT, fl.nuts, 0.12);
  });
  kit.step({ title: "Stand the stretcher in", detail: "One dowel in its end, at the low rail.", tools: ["hammer"], pose, kind: "join" }, () => {
    kit.fit(DOWEL, fl.strDowel);
    b.then(0.15);
    kit.add(["str"], [300, 0, 0]);
  });
  kit.step({ title: "Lock the stretcher", detail: "One cam lock.", tools: ["screwdriver"], pose, kind: "cams" }, () => kit.fit(CAM, fl.strCam));
  kit.step({ title: "Lower the right frame on", detail: "Tap six dowels into the free ends, then press the frame down onto them, rods and bolts into their holes.", tools: ["hammer"], pose, kind: "join", people: 2 }, () => {
    kit.fit(DOWEL, [...fr.shelfDowels, ...fr.railDowel, ...fr.boardDowels, ...fr.strDowel], 0.08);
    b.then(0.15);
    kit.add(["fR"], [360, 0, 0]);
    kit.preset(ROD, fr.rods);
    kit.preset(CAM_BOLT, fr.bolts);
  });
  kit.step({ title: "Lock the cam locks on this side", detail: "Six of them, arrow towards the bolt.", tools: ["screwdriver"], pose, kind: "cams" }, () => kit.fit(CAM, [...fr.shelfCams, ...fr.railCam, ...fr.strCam], 0.1));
  kit.step({ title: "Tighten the nuts on this side", detail: "A wedge washer and a nut on each rod, with the spanner.", tools: ["wrench"], pose, kind: "bolts" }, () => {
    kit.fit(WEDGE, fr.nuts, 0.12);
    b.then(0.05);
    kit.fit(NUT, fr.nuts, 0.12);
  });
  kit.step({ title: "Screw the back board to the shelf", detail: "Three long screws through the board into the edge of the shelf. Then stand the frame up.", tools: ["allen"], pose, kind: "screws" }, () =>
    kit.fit(TOP_SCREW, kit.pts("board", [0, 0, 1], spread(-xri + 150, xri - 150, 3).map((x): Vec3 => [x, yA + 8, zBoard - 9]), "shelf"), 0.15),
  );

  buildHung(kit, drawers[0], drawers.length);

  // the top upside down on a rug, the drawers on it
  const flip: Vec3 = [Math.PI, 0, 0];
  const pivot: Vec3 = [0, legH + topT / 2, 0];
  const group = ["top", "block", ...drawers.flatMap((d) => d.parts)];
  const tabs = drawers.flatMap((d) => [-1, 1].flatMap((g) => kit.pts("top", [0, 1, 0], [d.zc + 100, d.zc - 100].map((z): Vec3 => [d.box.x + g * (d.xs + 7 + 6), legH, z]))));
  kit.step({ title: "Screw the drawers under the top", detail: "Lay the top upside down on a rug and the drawers upside down on it, fronts flush with its front edge. Two screws through the tabs of each runner.", tools: ["screwdriver"], scene: "top", kind: "drawer", warnings: ["floor"] }, () => {
    kit.stage(["top"], pivot, flip, [0, topT / 2, 0], [0, 160, 0]);
    b.then(0.15);
    b.stagger(0.12);
    for (const d of drawers) kit.stage(d.parts, pivot, flip, [0, topT / 2, 0], [0, 260, 0]);
    for (const d of drawers.slice(1)) for (const [def, l] of allFits(d)) kit.preset(def, l);
    b.then(0.15);
    kit.fit(TAB_SCREW, tabs, 0.06);
  });
  kit.step({ title: "Fit the middle block", detail: "Two dowels into the top between the drawers, then push the block onto them.", tools: ["hammer"], scene: "top", kind: "join" }, () => {
    kit.fit(DOWEL, kit.pts("top", [0, 1, 0], [-1, 1].map((g): Vec3 => [0, legH, (zf - 30 + zBf) / 2 + g * 70]), "block"), 0.1);
    b.then(0.15);
    kit.stage(["block"], pivot, flip, [0, topT / 2, 0], [0, 200, 0]);
  });
  kit.step({ title: "Screw the block to the top", detail: "Two long screws through the block into the top.", tools: ["allen"], scene: "top", kind: "screws" }, () =>
    kit.fit(LONG_SCREW, kit.pts("block", [0, 1, 0], [-1, 1].map((g): Vec3 => [0, legH - 80, (zf - 30 + zBf) / 2 + g * 110]), "top"), 0.15),
  );
  kit.step({ title: "Tap two dowels into the top", detail: "Near each end, where it meets the side rails.", tools: ["hammer"], scene: "top", kind: "dowels" }, () =>
    kit.fit(DOWEL, [-1, 1].flatMap((g) => kit.pts("top", [0, 1, 0], [[g * xr, legH, 40]], g < 0 ? "fL" : "fR")), 0.1),
  );
  void group;
  kit.step({ title: "Tap dowels into the back board", detail: "Two in its top edge.", tools: ["hammer"], kind: "dowels" }, () =>
    kit.fit(DOWEL, kit.pts("board", [0, -1, 0], [-1, 1].map((g): Vec3 => [g * W * 0.2, legH, zBoard]), "top"), 0.1),
  );
  kit.step({ title: "Lower the top on", detail: "Two thick dowels in the tops of the front legs, then two people turn the top over and lower it on, drawers and all.", tools: ["hammer"], kind: "join", people: 2 }, () => {
    kit.fit(BIG_DOWEL, kit.pts("fL", [0, -1, 0], [[-xp, legH, zpf]], "top").concat(kit.pts("fR", [0, -1, 0], [[xp, legH, zpf]], "top")), 0.1);
    b.then(0.15);
    b.stagger(0);
    kit.add(group, [0, 320, 0]);
  });
  kit.step({ title: "Screw the top on through the side rails", detail: "Two long screws up through each side rail, with the Allen key.", tools: ["allen"], kind: "screws" }, () =>
    kit.fit(LONG_SCREW, [-1, 1].flatMap((g) => kit.pts(g < 0 ? "fL" : "fR", [0, 1, 0], [zpf - P / 2 - 60, zBf + 40].map((z): Vec3 => [g * xr, legH - 75, z]), "top")), 0.15),
  );
  kit.step({ title: "Screw the top to the back board", detail: "Four screws up through the board, with the Allen key in the long holder.", tools: ["allen"], kind: "screws" }, () =>
    kit.fit(TOP_SCREW, kit.pts("board", [0, 1, 0], spread(-xri + 120, xri - 120, 4).map((x): Vec3 => [x, legH - 40, zBoard]), "top"), 0.15),
  );
  kit.step({ title: "Screw the back board to the middle block", detail: "One screw from behind, through the board into the block.", tools: ["allen"], kind: "screws" }, () =>
    kit.fit(TOP_SCREW, kit.pts("board", [0, 0, 1], [[0, legH - 50, zBoard - 9]], "block")),
  );
  const zF = (zTop - D / 2) / 2;
  const hinges = kit.pts("flap", [0, 1, 0], [-1, 1].map((g): Vec3 => [g * W * 0.3, legH, zTop - 10]), undefined, { hole: false });
  kit.step({ title: "Screw the hinges onto the cable flap", detail: "Flap upside down. Each hinge sits in its round hole, two screws each.", tools: ["screwdriver"], scene: "flap", kind: "hinges" }, () => {
    kit.stage(["flap"], [0, legH + topT / 2, zF], flip, [0, topT / 2, 0], [0, 160, 0]);
    b.then(0.15);
    kit.fit(HINGE, hinges, 0.2);
    b.then(0.05);
    kit.fit(HINGE_SCREW, kit.pts("flap", [0, 1, 0], [-1, 1].flatMap((g) => [-16, 16].map((dx): Vec3 => [g * W * 0.3 + dx, legH, zTop - 30])), undefined), 0.08);
  });
  kit.step({ title: "Click the flap onto the hinge plates", detail: "Hook each hinge onto its plate at the front, then press the back until it clicks.", kind: "hinges" }, () => kit.add(["flap"], [0, 120, -160]));
  kit.step({ title: "Press in the cable grommet", detail: "Into the round hole in the flap.", kind: "general" }, () =>
    kit.fit(GROMMET, kit.pts("flap", [0, -1, 0], [[-W * 0.38, H, zF]], undefined, { hole: false })),
  );
  return true;
}

/* ---------- dressing table with mirror 110 x 45 ---------- */

const BIG_CAM_BOLT: HwDef = { kind: "camScrew", len: 40, dia: 8 };
const BIG_CAM: HwDef = { kind: "cam", len: 16, dia: 25 };
const TOP_BOLT: HwDef = { kind: "camScrew", len: 28, dia: 6 };
const RAIL_SCREW: HwDef = { kind: "screw", len: 50, dia: 5 };
const STOP_SCREW: HwDef = { kind: "screw", len: 12, dia: 3.5 };
const PAD: HwDef = { kind: "glide", len: 2, dia: 12 };
const GLASS_CLIP: HwDef = { kind: "clip", len: 40, dia: 20, name: "Glass holder" };
const MIRROR_KNOB: HwDef = { kind: "knob", len: 30, dia: 40, name: "Mirror knob" };
const MIRROR_ROD: HwDef = { kind: "stud", len: 80, dia: 6, name: "Threaded rod" };
const BUSH: HwDef = { kind: "spacer", len: 20, dia: 30, name: "Pivot bush" };
const MIRROR_BOLT: HwDef = { kind: "bolt", len: 60, dia: 6 };
const WASHER: HwDef = HW.washer;

/*
 * The 110 dressing table is built like the desk with 2 drawers: two ready-made leg frames, built standing on the left
 * end. The drawers come first, built on their fronts. The frames take cam bolts and runners, the drawer shelf, the
 * back board (big cam locks) and the stretcher stand in the left frame and the right one goes on. Upside down, the
 * top takes cam bolts and the two dividers with their runners; the round mirror hangs between two posts that bolt
 * through the top. Two people lower the top on, the drawers slide in, and the glass top lies on felt pads.
 */
function dressing110(b: PlanBuilder, s: ProductSpec) {
  const kit = new Kit(b);
  const W = s.size.w * 10, D = s.size.d * 10, Htot = s.size.h * 10;
  const topT = 22, glass = 5, P = 45, ov = 10, legH = 750 - topT - glass - 2;
  const xo = W / 2 - ov, xp = xo - P / 2, xi = xo - P;
  const xr = xo - 15, xri = xr - 10;
  const zf = D / 2 - ov, zb = -D / 2 + ov, zpf = zf - P / 2, zpb = zb + P / 2;
  const apron = 140, yA = legH - apron, yL = 180;
  const zBoard = zpb + P / 2 + 9, zBf = zBoard + 9;
  for (const L of ["L", "R"]) {
    const g = L === "L" ? -1 : 1;
    legFrame(kit, `f${L}`, { x: g * xp, P, legH, zf: zpf, zb: zpb, rails: [{ y: legH - apron / 2, h: apron, t: 20 }, { y: yL, h: 50, t: 20 }] });
  }
  const zs0 = zBf, zs1 = zf;
  const zsc = (zs0 + zs1) / 2;
  const main = zpf - P / 2 - zs0;
  kit.part("shelf", "Drawer shelf", [2 * xri, 16, zs1 - zs0], [0, yA + 8, zsc], {
    pieces: [
      { shape: "box", size: [2 * xri, 16, main], pos: [0, 0, zs0 + main / 2 - zsc] },
      { shape: "box", size: [2 * xi, 16, P], pos: [0, 0, zpf - zsc] },
    ],
  });
  kit.part("board", "Back board", [2 * xri, apron, 18], [0, legH - apron / 2, zBoard]);
  kit.part("str", "Stretcher", [2 * xri, 50, 20], [0, yL, 0], { material: "wood" });
  kit.part("top", "Top", [W, topT, D], [0, legH + topT / 2, 0], { material: "wood" });
  const niche = Math.round(W * 0.22);
  const xd = niche / 2 + 8; // divider centres
  const yd0 = yA + 18;
  for (const [i, g] of [-1, 1].entries()) kit.part(`dv${i}`, "Divider", [16, legH - yd0, zf - zBf], [g * xd, (legH + yd0) / 2, (zf + zBf) / 2]);
  kit.part("glass", "Glass top", [W, glass, D - 60], [0, legH + topT + 2 + glass / 2, 30], { material: "glass" });
  const R = 250, my = Htot - R, mz = zb + 30;
  const px = R + 40;
  const postH = my + 30 - (legH + topT);
  for (const [i, g] of [-1, 1].entries()) kit.part(`po${i}`, "Mirror post", [40, postH, 40], [g * px, legH + topT + postH / 2, mz], { material: "wood" });
  kit.part("mirror", "Mirror", [2 * R, 2 * R, 26], [0, my, mz], {
    pieces: [
      { shape: "cyl", size: [2 * R, 24, 2 * R], pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0], material: "wood" },
      { shape: "cyl", size: [2 * R - 70, 26, 2 * R - 70], pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0], material: "glass" },
    ],
  });
  const bay = (xri - (xd + 8));
  const drawers = hungDrawers(
    kit,
    [-1, 1].map((g, i) => ({ id: `d${i}`, x: g * (xd + 8 + bay / 2), y0: yd0 + 2, fw: bay - 4, fh: legH - yd0 - 8, zf, dd: zf - zBf - 10 })),
    { runners: false },
  );
  const zc = drawers[0].zc, runLen = Math.round((zf - zBf - 40) / 10) * 10;
  const yRun = yd0 + 4;
  const runnersOn = (on: string, x: number, g: number) => ({
    run: kit.pts(on, [g, 0, 0], [[x, yRun, zc]], undefined, { hole: false }),
    screws: kit.pts(on, [g, 0, 0], [zc - runLen / 2 + 30, zc + runLen / 2 - 30].map((z): Vec3 => [x - g * 4, yRun, z])),
    stop: kit.pts(on, [g, 0, 0], [[x - g * 4, yRun, zf - 30]]),
  });
  const side = (L: string) => {
    const g = L === "L" ? -1 : 1;
    const zsS = spread(zBf + 25, zpf - P / 2 - 25, 4);
    const yb = [legH - apron / 2 - 35, legH - apron / 2 + 35];
    return {
      big: kit.pts(`f${L}`, [g, 0, 0], yb.map((y): Vec3 => [g * xri, y, zBoard]), "board", { mateHole: 5 }),
      bolts: [...kit.pts(`f${L}`, [g, 0, 0], zsS.map((z): Vec3 => [g * xri, yA + 8, z]), "shelf", { mateHole: 4 }), ...kit.pts(`f${L}`, [g, 0, 0], [[g * xri, yL, 0]], "str", { mateHole: 4 })],
      run: runnersOn(`f${L}`, g * (xri - 6), g),
      shelfDowels: kit.pts("shelf", [-g, 0, 0], [zsS[0] + 30, zsS[3] - 30].map((z): Vec3 => [g * xri, yA + 8, z]), `f${L}`),
      shelfCams: kit.pts("shelf", [0, -1, 0], zsS.map((z): Vec3 => [g * (xri - 26), yA + 16, z])),
      bigCams: kit.pts("board", [0, 0, -1], yb.map((y): Vec3 => [g * (xri - 30), y, zBf])),
      boardDowels: kit.pts("board", [-g, 0, 0], [yA + 20, legH - 20].map((y): Vec3 => [g * xri, y, zBoard]), `f${L}`),
      strDowel: kit.pts("str", [-g, 0, 0], [[g * xri, yL + 12, 0]], `f${L}`),
      strCam: kit.pts("str", [0, -1, 0], [[g * (xri - 26), yL + 25, 0]]),
      topCams: kit.pts(`f${L}`, [g, 0, 0], [-100, 0, 100].map((z): Vec3 => [g * xri, legH - 25, z])),
    };
  };
  const fl = side("L"), fr = side("R");
  const pose = "+x" as const;

  for (const d of drawers.slice(0, 1)) buildHung(kit, d, drawers.length);

  kit.step({ title: "Screw the big cam bolts into the leg frames", detail: "Both frames on a rug, inside up. Two in each top rail, near the back leg, by hand.", tools: ["screwdriver"], pose, kind: "cams", repeat: 2, warnings: ["floor"] }, () => {
    kit.add(["fL"], [0, 200, 0]);
    b.then(0.15);
    kit.fit(BIG_CAM_BOLT, fl.big, 0.1);
  });
  kit.step({ title: "Screw in the cam bolts", detail: "Five in each frame: four along the top rail and one in the low rail.", tools: ["screwdriver"], pose, kind: "cams", repeat: 2 }, () => kit.fit(CAM_BOLT, fl.bolts, 0.08));
  kit.step({ title: "Screw a runner to each frame", detail: "Along the bottom of the top rail, the arrow pointing to the front. Two screws each.", tools: ["screwdriver"], pose, kind: "runners", repeat: 2 }, () => {
    kit.fit(runnerDef(runLen), fl.run.run, 0.2);
    b.then(0.1);
    kit.fit(SMALL_SCREW, fl.run.screws, 0.08);
  });
  kit.step({ title: "Stand the drawer shelf in", detail: "Tap two dowels into each end of the shelf, then push it onto the left frame, cable hole at the bottom.", tools: ["hammer"], pose, kind: "join" }, () => {
    kit.fit(DOWEL, [...fl.shelfDowels, ...fr.shelfDowels], 0.08);
    b.then(0.15);
    kit.add(["shelf"], [300, 0, 0]);
  });
  kit.step({ title: "Lock the shelf", detail: "Four cam locks, arrow towards the bolt.", tools: ["screwdriver"], pose, kind: "cams" }, () => kit.fit(CAM, fl.shelfCams, 0.1));
  kit.step({ title: "Press the big cam locks into the back board", detail: "Two at this end, open side towards the end.", pose, scene: "board", kind: "cams" }, () => {
    b.stage(kit.k("board"), [9, 0, 0], [0, -Math.PI / 2, 0], [200, 0, 0]);
    b.then(0.15);
    kit.fit(BIG_CAM, fl.bigCams, 0.15);
  });
  kit.step({ title: "Stand the back board in", detail: "Two dowels in each end, then push it onto the big bolts.", tools: ["hammer"], pose, kind: "join" }, () => {
    kit.fit(DOWEL, [...fl.boardDowels, ...fr.boardDowels], 0.08);
    b.then(0.15);
    kit.add(["board"], [300, 0, 0]);
  });
  kit.step({ title: "Lock the big cam locks", detail: "Turn both clockwise with the Allen key until they pull tight.", tools: ["allen"], pose, kind: "cams" });
  kit.step({ title: "Stand the stretcher in", detail: "One dowel in each end, at the low rail.", tools: ["hammer"], pose, kind: "join" }, () => {
    kit.fit(DOWEL, [...fl.strDowel, ...fr.strDowel], 0.1);
    b.then(0.15);
    kit.add(["str"], [300, 0, 0]);
  });
  kit.step({ title: "Lock the stretcher", detail: "One cam lock.", tools: ["screwdriver"], pose, kind: "cams" }, () => kit.fit(CAM, fl.strCam));
  kit.step({ title: "Press in the big cam locks at this end", detail: "Two more in the free end of the back board.", pose, kind: "cams" }, () => kit.fit(BIG_CAM, fr.bigCams, 0.15));
  kit.step({ title: "Lower the right frame on", detail: "Two people. Press it down onto the dowels and bolts.", pose, kind: "join", people: 2 }, () => {
    kit.add(["fR"], [360, 0, 0]);
    for (const [def, l] of [[BIG_CAM_BOLT, fr.big], [CAM_BOLT, fr.bolts], [runnerDef(runLen), fr.run.run], [SMALL_SCREW, fr.run.screws]] as [HwDef, FitOpts[]][]) kit.preset(def, l);
  });
  kit.step({ title: "Lock the big cam locks on this side", detail: "With the Allen key, clockwise.", tools: ["allen"], pose, kind: "cams" });
  kit.step({ title: "Lock the cam locks on this side", detail: "Five of them. Then stand the frame up on its legs.", tools: ["screwdriver"], pose, kind: "cams" }, () => kit.fit(CAM, [...fr.shelfCams, ...fr.strCam], 0.1));
  kit.step({ title: "Press in the cable grommet", detail: "Into the round hole in the drawer shelf.", kind: "general" }, () =>
    kit.fit(GROMMET, kit.pts("shelf", [0, -1, 0], [[0, yA + 16, zBf + 40]], undefined, { hole: false })),
  );
  kit.step({ title: "Tap the thick dowels into the front legs", detail: "One in the top of each front leg.", tools: ["hammer"], kind: "dowels" }, () =>
    kit.fit(BIG_DOWEL, [...kit.pts("fL", [0, -1, 0], [[-xp, legH, zpf]], "top"), ...kit.pts("fR", [0, -1, 0], [[xp, legH, zpf]], "top")], 0.1),
  );
  const dv = [0, 1].map((i) => {
    const g = i ? 1 : -1;
    const x = g * xd;
    return {
      run: runnersOn(`dv${i}`, x + g * 14, -g),
      dowels: kit.pts("top", [0, 1, 0], [zBf + 60, zf - 60].map((z): Vec3 => [x, legH, z]), `dv${i}`),
      bolts: kit.pts("top", [0, 1, 0], [zBf + 110, zf - 110].map((z): Vec3 => [x, legH, z]), `dv${i}`, { mateHole: 4 }),
      cams: kit.pts(`dv${i}`, [g, 0, 0], [zBf + 110, zf - 110].map((z): Vec3 => [x - g * 8, legH - 25, z])),
    };
  });
  kit.step({ title: "Screw a runner to each divider", detail: "On the face away from the middle, arrow to the front. Two screws each.", tools: ["screwdriver"], scene: "dividers", kind: "runners" }, () => {
    b.stagger(0.2);
    for (const [i, g] of [-1, 1].entries()) {
      b.stage(kit.k(`dv${i}`), [g * 160, 8, 0], [0, 0, (g * Math.PI) / 2], [0, 120, 0]);
    }
    b.then(0.15);
    for (const d of dv) kit.fit(runnerDef(runLen), d.run.run, 0.2);
    b.then(0.1);
    for (const d of dv) kit.fit(SMALL_SCREW, d.run.screws, 0.08);
  });
  const flip: Vec3 = [Math.PI, 0, 0];
  const pivot: Vec3 = [0, legH + topT / 2, 0];
  const backBolts = kit.pts("top", [0, 1, 0], [-W * 0.3, 0, W * 0.3].map((x): Vec3 => [x, legH, zBoard]), "board", { mateHole: 4 });
  const sideBolts = [-1, 1].flatMap((g) => kit.pts("top", [0, 1, 0], [-100, 0, 100].map((z): Vec3 => [g * xr, legH, z]), g < 0 ? "fL" : "fR", { mateHole: 4 }));
  kit.step({ title: "Screw the long cam bolts into the top", detail: "Lay the top upside down on a rug. Three along the back edge.", tools: ["screwdriver"], scene: "top", kind: "cams", warnings: ["floor", "face"] }, () => {
    kit.stage(["top"], pivot, flip, [0, topT / 2, 0], [0, 160, 0]);
    b.then(0.15);
    kit.fit(CAM_BOLT, backBolts, 0.1);
  });
  kit.step({ title: "Screw in the other cam bolts", detail: "Ten more: three near each end and two for each divider.", tools: ["screwdriver"], scene: "top", kind: "cams" }, () => kit.fit(TOP_BOLT, [...sideBolts, ...dv.flatMap((d) => d.bolts)], 0.06));
  kit.step({ title: "Stand the dividers on the top", detail: "Two dowels for each, runners facing out towards the ends.", tools: ["hammer"], scene: "top", kind: "join" }, () => {
    kit.fit(DOWEL, dv.flatMap((d) => d.dowels), 0.08);
    b.then(0.15);
    kit.stage(["dv0", "dv1"], pivot, flip, [0, topT / 2, 0], [0, 220, 0]);
  });
  kit.step({ title: "Lock the dividers", detail: "Two cam locks each, from the middle. Then turn the top back over.", tools: ["screwdriver"], scene: "top", kind: "cams" }, () => kit.fit(CAM, dv.flatMap((d) => d.cams), 0.1));
  const knobs = [0, 1].map((i) => {
    const g = i ? 1 : -1;
    return {
      knob: kit.pts(`po${i}`, [-g, 0, 0], [[g * (px + 20), my, mz]], undefined, { hole: false }),
      rod: kit.pts(`po${i}`, [-g, 0, 0], [[g * (px + 20), my, mz]], "mirror", { mateHole: 3 }),
      bush: kit.pts(`po${i}`, [-g, 0, 0], [[g * (R + 10), my, mz]], undefined, { hole: false }),
    };
  });
  const mpivot: Vec3 = [0, my, mz];
  kit.step({ title: "Put the mirror knobs through the posts", detail: "A washer on each threaded rod, then push it through the hole near the top of each post and screw on the knob.", tools: [], scene: "mirror", kind: "general" }, () => {
    kit.stage(["po0", "po1"], mpivot, [0, 0, 0], [0, 0, 0], [0, 160, 0]);
    b.then(0.15);
    for (const k of knobs) {
      kit.fit(WASHER, k.knob, 0.1);
      kit.fit(MIRROR_ROD, k.rod, 0.1);
      kit.fit(MIRROR_KNOB, k.knob, 0.15);
    }
  });
  kit.step({ title: "Hang the mirror between the posts", detail: "A pivot bush on each rod, then screw the rods into the sides of the mirror frame. Not too tight, so it can tilt.", tools: [], scene: "mirror", kind: "general" }, () => {
    for (const k of knobs) kit.fit(BUSH, k.bush, 0.12);
    b.then(0.15);
    kit.stage(["mirror"], mpivot, [0, 0, 0], [0, 0, 0], [0, 0, 260]);
  });
  kit.step({ title: "Tap a dowel into each post", detail: "Into the bottom end.", tools: ["hammer"], scene: "mirror", kind: "dowels" }, () =>
    kit.fit(DOWEL, [0, 1].flatMap((i) => kit.pts(`po${i}`, [0, 1, 0], [[(i ? 1 : -1) * px, legH + topT, mz + 12]], "top")), 0.1),
  );
  const top = ["top", "dv0", "dv1"];
  const mir = ["po0", "po1", "mirror"];
  kit.step({ title: "Bolt the mirror onto the top", detail: "Two people. Stand the posts on their dowels at the back of the top, then a washer and a bolt up through the top into each post.", tools: ["allen"], scene: "top", kind: "join", people: 2 }, () => {
    b.stagger(0);
    kit.stage(top, [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 80, 0]);
    b.then(0.2);
    kit.stage(mir, [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 240, 0]);
    b.then(0.15);
    const pts = [0, 1].flatMap((i) => kit.pts("top", [0, 1, 0], [[(i ? 1 : -1) * px, legH, mz]], `po${i}`));
    kit.fit(WASHER, pts.map((p) => ({ ...p, mate: undefined, hole: false })), 0.1);
    kit.fit(MIRROR_BOLT, pts, 0.12);
  });
  const frameCams = [...fl.topCams, ...fr.topCams, ...kit.pts("board", [0, 0, -1], [-W * 0.3, 0, W * 0.3].map((x): Vec3 => [x, legH - 25, zBf]))];
  kit.step({ title: "Press the cam locks into the frame", detail: "Nine of them: three in each top rail and three in the back board, open side up.", kind: "cams" }, () => kit.fit(CAM, frameCams, 0.06));
  kit.step({ title: "Lower the top on", detail: "Two people, one at each end. The bolts drop into the cam locks and the thick dowels into the top.", kind: "join", people: 2 }, () => {
    b.stagger(0);
    kit.add([...top, ...mir], [0, 300, 0]);
  });
  kit.step({ title: "Screw the top on through the side rails", detail: "Two screws up through each top rail.", tools: ["screwdriver"], kind: "screws" }, () =>
    kit.fit(RAIL_SCREW, [-1, 1].flatMap((g) => kit.pts(g < 0 ? "fL" : "fR", [0, 1, 0], [-60, 60].map((z): Vec3 => [g * xr, legH - 40, z]), "top")), 0.12),
  );
  kit.step({ title: "Lock the nine cam locks", detail: "Arrow towards the bolt, then turn each one clockwise.", tools: ["screwdriver"], kind: "cams" });
  kit.step({ title: "Slide in the drawers", detail: "Rest them on the runners and push them in, then a stop screw into the front of each runner so they can't come right out.", tools: ["screwdriver"], kind: "drawer" }, () => {
    for (const [i, d] of drawers.entries()) {
      b.stagger(0);
      kit.add(d.parts, [0, 0, 460]);
      if (i > 0) for (const [def, l] of allFits(d)) kit.preset(def, l);
      b.wait(0.2);
    }
    b.then(0.15);
    kit.fit(STOP_SCREW, [...fl.run.stop, ...fr.run.stop, ...dv.flatMap((d) => d.run.stop)], 0.1);
  });
  const padPts = [-1, 1].flatMap((g) => [zf - 30, 30, -130].flatMap((z) => (z === 30 ? [] : [[g * (W / 2 - 40), legH + topT, z] as Vec3]))).concat([-1, 1].flatMap((g) => [[g * (W / 4), legH + topT, zf - 30] as Vec3, [g * (W / 4), legH + topT, -130] as Vec3]));
  kit.step({ title: "Stick the felt pads on the top", detail: "Eight of them, near the edges where the glass will rest.", kind: "general" }, () => kit.fit(PAD, kit.pts("top", [0, -1, 0], padPts, undefined, { hole: false }), 0.06));
  kit.step({ title: "Lay the glass top on", detail: "Two people. In front of the mirror posts, onto the pads.", kind: "join", people: 2 }, () => kit.add(["glass"], [0, 200, 0]));
  kit.step({ title: "Fit the glass holders", detail: "Three of them over the back edge of the top, so the glass can't slide back.", kind: "general" }, () =>
    kit.fit(GLASS_CLIP, kit.pts("top", [0, 0, 1], [-W * 0.3, 0, W * 0.3].map((x): Vec3 => [x, legH + topT / 2, -D / 2]), undefined, { hole: false }), 0.12),
  );
  return true;
}

/* ---------- dressing table with mirror 100 x 50 ---------- */

const CROSS_DOWEL: HwDef = { kind: "nut", len: 30, dia: 10, name: "Cross dowel" };
const LEG_ROD: HwDef = { kind: "stud", len: 80, dia: 8, name: "Threaded rod" };
const LEG_NUT: HwDef = { kind: "nut", len: 7, dia: 10 };
const LEG_WASHER: HwDef = { kind: "washer", len: 2, dia: 20 };
const CORNER: HwDef = { kind: "angle", len: 80, dia: 40, name: "Corner bracket" };
const CORNER_SCREW: HwDef = { kind: "screw", len: 16, dia: 4.5 };
const RUNNER_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };
const SMALL_DOWEL: HwDef = { kind: "dowel", len: 25, dia: 6 };
const WING_SCREW: HwDef = { kind: "screw", len: 70, dia: 4.5 };
const BACK_SCREW: HwDef = { kind: "screw", len: 40, dia: 4 };
const BOX_BOLT: HwDef = { kind: "bolt", len: 50, dia: 6 };
const BOX_NUT: HwDef = { kind: "nut", len: 5, dia: 6 };
const BOX_WASHER: HwDef = { kind: "washer", len: 1.5, dia: 16 };
const BARREL_NUT: HwDef = { kind: "nut", len: 14, dia: 10, name: "Barrel nut" };
const PIVOT_BOLT: HwDef = { kind: "bolt", len: 80, dia: 6 };
const PIVOT_WASHER: HwDef = { kind: "washer", len: 2, dia: 18, name: "Plastic washer" };
const STRAP: HwDef = { kind: "strap", len: 160, dia: 25 };
const STRAP_SCREW: HwDef = { kind: "screw", len: 13, dia: 4.2 };
const WALL_SCREW: HwDef = { kind: "screw", len: 50, dia: 5, notIncluded: true };
const WALL_PLUG: HwDef = HW.plug;

/** A flat shape standing upright, facing the front: outline as [x, y] corners from its centre. */
function upright(outline: [number, number][], t: number, material: PartMaterial, round = 0): PartPiece {
  const xs = outline.map((p) => p[0]), ys = outline.map((p) => p[1]);
  return { shape: "slab", size: [Math.max(...xs) - Math.min(...xs), t, Math.max(...ys) - Math.min(...ys)], pos: [0, 0, 0], rot: [-Math.PI / 2, 0, 0], outline: outline.map(([x, y]) => [x, y]), round, material };
}
const ellipse = (rx: number, ry: number, n = 28): [number, number][] => range(n).map((i) => [Math.round(rx * Math.cos((2 * Math.PI * i) / n)), Math.round(ry * Math.sin((2 * Math.PI * i) / n))]);

/*
 * The 100 dressing table is built upside down: the top lies face down on a rug with its cam bolts, the apron boards
 * stand on it on dowels and lock, four corner brackets screw into the corners, the two runner boards go in, and each
 * leg (cross dowel and threaded rod) bolts through a bracket with a washer and nut. Turned over, the glass lies on
 * the top, two little boxes bolt through it, and the mirror stands between two shaped side pieces joined by the back
 * board; it pivots on two bolts. A strap holds it to the wall. The big drawer is built on its front, with two
 * dividers inside, and slides in on its runners; the two little drawers come ready made and only take a knob.
 */
function dressing100(b: PlanBuilder, s: ProductSpec) {
  const kit = new Kit(b);
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const topT = 18, glassT = 4, yT = 728, yG = yT + topT; // underside of the top, top of the wooden top
  const yS = yG + glassT; // the surface
  const t = 18, ah = 120, yA = yT - ah;
  const xa = W / 2 - 30, za = D / 2 - 30; // outer faces of the apron
  const op = Math.round(W * 0.37); // half the drawer opening
  kit.part("top", "Top", [W, topT, D], [0, yT + topT / 2, 0]);
  kit.part("glass", "Glass top", [W, glassT, D], [0, yG + glassT / 2, 0], { material: "glass" });
  const endW = xa - op;
  kit.part("af", "Front apron", [2 * xa, ah, t], [0, yA + ah / 2, za - t / 2], {
    pieces: [
      { shape: "box", size: [endW, ah, t], pos: [-(op + endW / 2), 0, 0] },
      { shape: "box", size: [endW, ah, t], pos: [op + endW / 2, 0, 0] },
      { shape: "box", size: [2 * op, 16, t], pos: [0, ah / 2 - 8, 0] },
    ],
  });
  kit.part("ab", "Back apron", [2 * xa, ah, t], [0, yA + ah / 2, -za + t / 2]);
  for (const [i, g] of [-1, 1].entries()) kit.part(`as${i}`, "Side apron", [t, ah, 2 * (za - t)], [g * (xa - t / 2), yA + ah / 2, 0]);
  const xb = op + 8;
  for (const [i, g] of [-1, 1].entries()) kit.part(`rb${i}`, "Runner board", [16, 100, 2 * (za - t)], [g * xb, yT - 50, 0]);
  // legs: a straight block in the corner, a knee that swells out and a slim lower leg that kicks out to the foot
  const legTop = yT - 38, P = 50;
  const lx = xa - t - P / 2, lz = za - t - P / 2;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([gx, gz], i) => {
    const c = legTop / 2;
    const pieces: PartPiece[] = [
      { shape: "box", size: [P, 160, P], pos: [0, legTop - 80 - c, 0], material: "board" },
      { shape: "box", size: [44, 250, 44], pos: [gx * 7, legTop - 160 - 115 - c, gz * 7], rot: [-gz * 0.05, 0, gx * 0.05], material: "board" },
      { shape: "box", size: [36, 300, 36], pos: [gx * 6, 150 - c, gz * 6], rot: [gz * 0.04, 0, -gx * 0.04], material: "board" },
    ];
    kit.part(`leg${i}`, "Leg", [P + 20, legTop, P + 20], [gx * lx, c, gz * lz], { pieces });
  });
  const legs = range(4).map((i) => `leg${i}`);
  const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  // the mirror stand at the back of the top
  const mh = Math.round((H - yS) * 0.8), mw = Math.round(mh * 0.62);
  const my = H - 30 - mh / 2, mz = -D / 2 + 40;
  const xw = mw / 2 + 15; // inner edge of each side piece
  const wingW = Math.round(W * 0.19);
  const wingH = H - yS;
  for (const [i, g] of [-1, 1].entries()) {
    const o: [number, number][] = [[0, -wingH / 2], [g * wingW, -wingH / 2], [g * wingW, -wingH / 2 + 60], [g * 50, wingH / 2 - 120], [g * 50, wingH / 2], [0, wingH / 2]];
    const cx = g * wingW / 2;
    kit.part(`w${i}`, "Mirror side", [wingW, wingH, 18], [g * xw + cx, yS + wingH / 2, mz], { pieces: [upright(o.map(([x, y]) => [x - cx, y]), 18, "board", 12)] });
  }
  kit.part("bb", "Back board", [2 * xw, 120, 18], [0, yS + 60, mz]);
  kit.part("mirror", "Mirror", [mw, mh, 24], [0, my, mz], { pieces: [upright(ellipse(mw / 2, mh / 2), 22, "board"), { ...upright(ellipse(mw / 2 - 35, mh / 2 - 35), 24, "glass"), pos: [0, 0, 0] }] });
  const bx = xw + wingW / 2, bw = wingW - 30, bh = 110, bd = 190, bz = mz + 9 + bd / 2;
  for (const [i, g] of [-1, 1].entries()) {
    kit.part(`bx${i}`, "Small box", [bw, bh, bd], [g * bx, yS + bh / 2, bz], {
      pieces: [
        { shape: "box", size: [bw, 10, bd], pos: [0, -bh / 2 + 5, 0] },
        { shape: "box", size: [bw, 10, bd], pos: [0, bh / 2 - 5, 0] },
        { shape: "box", size: [10, bh - 20, bd], pos: [-bw / 2 + 5, 0, 0] },
        { shape: "box", size: [10, bh - 20, bd], pos: [bw / 2 - 5, 0, 0] },
        { shape: "box", size: [bw - 20, bh - 20, 8], pos: [0, 0, -bd / 2 + 4] },
      ],
    });
    kit.part(`sd${i}`, "Small drawer", [bw - 24, bh - 24, bd - 12], [g * bx, yS + bh / 2, bz + 6]);
  }
  // the big drawer
  const ft = 18, st = 14, dz = za - ft; // inside face of its front
  const xs = op - 12 - st / 2, sh = 80, ys = yA + 10, dl = 2 * (za - t) - 20;
  kit.part("df", "Drawer front", [2 * op - 4, ah - 20, ft], [0, yA + (ah - 20) / 2 + 2, za - ft / 2]);
  for (const [i, g] of [-1, 1].entries()) kit.part(`ds${i}`, "Drawer side", [st, sh, dl], [g * xs, ys + sh / 2, dz - dl / 2]);
  kit.part("dbt", "Drawer bottom", [2 * xs, 4, dl - 20], [0, ys + 8, dz - dl / 2 + 6], { material: "fiber" });
  for (const [i, g] of [-1, 1].entries()) kit.part(`dd${i}`, "Drawer divider", [12, sh - 16, dl - st], [g * xs * 0.34, ys + 16 + (sh - 16) / 2, dz - (dl - st) / 2]);
  kit.part("dbk", "Drawer back", [2 * xs + st, sh, st], [0, ys + sh / 2, dz - dl - st / 2]);
  const drawer = ["df", "ds0", "ds1", "dbt", "dd0", "dd1", "dbk"];

  // fittings
  const apronBolts = [
    ...kit.pts("top", [0, 1, 0], [-xa + endW / 2, 0, xa - endW / 2].map((x): Vec3 => [x, yT, za - t / 2]), "af", { mateHole: 4 }),
    ...kit.pts("top", [0, 1, 0], [-xa * 0.6, xa * 0.6].map((x): Vec3 => [x, yT, -za + t / 2]), "ab", { mateHole: 4 }),
    ...[0, 1].flatMap((i) => kit.pts("top", [0, 1, 0], [-za * 0.5, za * 0.5].map((z): Vec3 => [(i ? 1 : -1) * (xa - t / 2), yT, z]), `as${i}`, { mateHole: 4 })),
  ];
  const boardBolts = [0, 1].flatMap((i) => kit.pts("top", [0, 1, 0], [-za * 0.6, 0, za * 0.6].map((z): Vec3 => [(i ? 1 : -1) * xb, yT, z]), `rb${i}`, { mateHole: 4 }));
  const apronDowels = [
    ...kit.pts("top", [0, 1, 0], [-xa + 30, -op - 30, op + 30, xa - 30].map((x): Vec3 => [x, yT, za - t / 2]), "af"),
    ...kit.pts("top", [0, 1, 0], spread(-xa + 60, xa - 60, 4).map((x): Vec3 => [x, yT, -za + t / 2]), "ab"),
    ...[0, 1].flatMap((i) => kit.pts("top", [0, 1, 0], [-za * 0.75, za * 0.75].map((z): Vec3 => [(i ? 1 : -1) * (xa - t / 2), yT, z]), `as${i}`)),
  ];
  const camAt = (on: string, p: Vec3, dir: Vec3) => kit.pts(on, dir, [p]);
  const apronCams = [
    ...[-xa + endW / 2, 0, xa - endW / 2].flatMap((x) => camAt("af", [x, yT - 25, za - t], [0, 0, 1])),
    ...[-xa * 0.6, xa * 0.6].flatMap((x) => camAt("ab", [x, yT - 25, -za + t], [0, 0, -1])),
    ...[0, 1].flatMap((i) => [-za * 0.5, za * 0.5].flatMap((z) => camAt(`as${i}`, [(i ? 1 : -1) * (xa - t), yT - 25, z], [i ? 1 : -1, 0, 0]))),
  ];
  const boardDowels = [0, 1].flatMap((i) => kit.pts("top", [0, 1, 0], [-za * 0.8, za * 0.8].map((z): Vec3 => [(i ? 1 : -1) * xb, yT, z]), `rb${i}`));
  const boardCams = [0, 1].flatMap((i) => [-za * 0.6, 0, za * 0.6].flatMap((z) => camAt(`rb${i}`, [(i ? 1 : -1) * (xb + 8), yT - 25, z], [i ? -1 : 1, 0, 0])));
  const yC = legTop + 8;
  const brackets = corners.flatMap(([gx, gz]) => kit.pts(gz > 0 ? "af" : "ab", [0, 1, 0], [[gx * (lx - 10), yC, gz * (lz - 10)]], undefined, { hole: false }));
  const cornerScrews = corners.flatMap(([gx, gz]) => [
    ...kit.pts(gz > 0 ? "af" : "ab", [0, 0, gz], [-14, 14].map((dy): Vec3 => [gx * (lx - 40), yC + dy, gz * (za - t)])),
    ...kit.pts(`as${gx < 0 ? 0 : 1}`, [gx, 0, 0], [-14, 14].map((dy): Vec3 => [gx * (xa - t), yC + dy, gz * (lz - 40)])),
  ].map((o) => ({ ...o, mate: undefined })));
  const rods = legs.map((l, i) => kit.pts(l, [0, -1, 0], [[corners[i][0] * lx, legTop, corners[i][1] * lz]])[0]);
  const cross = legs.map((l, i) => kit.pts(l, [corners[i][0], 0, 0], [[corners[i][0] * (lx - P / 2), legTop - 40, corners[i][1] * lz]])[0]);
  const nutsAt = legs.map((l, i) => kit.pts(l, [0, -1, 0], [[corners[i][0] * lx, yC + 6, corners[i][1] * lz]], undefined, { hole: false })[0]);
  const runBoard = [0, 1].map((i) => kit.pts(`rb${i}`, [i ? 1 : -1, 0, 0], [[(i ? 1 : -1) * (xb - 8), ys + 30, -10]], undefined, { hole: false }));
  const runBoardScrews = [0, 1].flatMap((i) => kit.pts(`rb${i}`, [i ? 1 : -1, 0, 0], [-za * 0.6, za * 0.6].map((z): Vec3 => [(i ? 1 : -1) * (xb - 10), ys + 30, z])));
  const pose = "-y" as const;

  kit.step({ title: "Screw the cam bolts into the top", detail: "Lay the top upside down on a rug. Fifteen bolts, by hand until they stop.", tools: ["screwdriver"], pose, kind: "cams", warnings: ["floor", "face"] }, () => {
    kit.add(["top"], [0, -160, 0]);
    b.then(0.15);
    kit.fit(CAM_BOLT, [...apronBolts, ...boardBolts], 0.05);
  });
  kit.step({ title: "Stand the apron on the top", detail: "Twelve dowels into the top, then the front, back and side boards onto them and the bolts. The drawer opening goes at the front.", tools: ["hammer"], pose, kind: "join" }, () => {
    kit.fit(DOWEL, apronDowels, 0.05);
    b.then(0.15);
    kit.add(["af", "ab", "as0", "as1"], [0, -220, 0]);
  });
  kit.step({ title: "Lock the apron", detail: "Nine cam locks, arrow towards the bolt, then a clockwise turn.", tools: ["screwdriver"], pose, kind: "cams" }, () => kit.fit(CAM, apronCams, 0.08));
  kit.step({ title: "Screw the corner brackets in", detail: "One in each corner, four screws each.", tools: ["screwdriver"], pose, kind: "screws" }, () => {
    kit.fit(CORNER, brackets, 0.15);
    b.then(0.1);
    kit.fit(CORNER_SCREW, cornerScrews, 0.04);
  });
  kit.step({ title: "Stand the runner boards in", detail: "Two dowels for each, either side of the drawer opening.", tools: ["hammer"], pose, kind: "join" }, () => {
    kit.fit(DOWEL, boardDowels, 0.08);
    b.then(0.15);
    kit.add(["rb0", "rb1"], [0, -200, 0]);
  });
  kit.step({ title: "Lock the runner boards", detail: "Six cam locks.", tools: ["screwdriver"], pose, kind: "cams" }, () => kit.fit(CAM, boardCams, 0.08));
  kit.step({ title: "Screw the runners to the runner boards", detail: "On the faces towards the opening, marked side to the front. Two screws each.", tools: ["screwdriver"], pose, kind: "runners" }, () => {
    for (const r of runBoard) kit.fit(runnerDef(dl - 40), r, 0.2);
    b.then(0.1);
    kit.fit(RUNNER_SCREW, runBoardScrews, 0.08);
  });
  kit.step({ title: "Get the legs ready", detail: "A cross dowel into the side hole of each leg, slot lined up, then screw a threaded rod into the top end until it catches.", tools: ["flathead"], scene: "legs", kind: "legs", repeat: 4 }, () => {
    kit.stage(["leg0"], [-lx, legTop / 2, -lz], [0, 0, 0], [0, legTop / 2, 0], [0, 160, 0]);
    b.then(0.15);
    kit.fit(CROSS_DOWEL, [cross[0]], 0.1);
    kit.fit(LEG_ROD, [rods[0]], 0.1);
  });
  kit.step({ title: "Bolt the legs to the brackets", detail: "Push each rod through its bracket, then a washer and a nut, tightened with the spanner. The legs curve outwards.", tools: ["wrench"], pose, kind: "legs" }, () => {
    b.stagger(0.2);
    for (const [i, l] of legs.entries()) {
      b.add(kit.k(l), [0, -260, 0]);
      if (i) {
        kit.preset(CROSS_DOWEL, [cross[i]]);
        kit.preset(LEG_ROD, [rods[i]]);
      }
    }
    b.then(0.15);
    kit.fit(LEG_WASHER, nutsAt, 0.1);
    kit.fit(LEG_NUT, nutsAt, 0.1);
  });
  kit.step({ title: "Turn it over and lay the glass on", detail: "Two people turn it onto its legs. Lower the glass onto the top, edges flush.", pose: "+y", kind: "join", people: 2 }, () => kit.add(["glass"], [0, 160, 0]));
  const boxBolts = [0, 1].flatMap((i) => kit.pts(`bx${i}`, [0, -1, 0], [[(i ? 1 : -1) * bx, yS + 10, bz]], "top", { mateHole: 4 }));
  kit.step({ title: "Bolt the little boxes on", detail: "Set the two boxes at the back of the glass and drop a bolt through the bottom of each.", tools: ["allen"], kind: "join" }, () => {
    kit.add(["bx0", "bx1"], [0, 180, 0]);
    b.then(0.15);
    kit.fit(BOX_BOLT, boxBolts, 0.12);
  });
  const under = [0, 1].flatMap((i) => kit.pts("top", [0, 1, 0], [[(i ? 1 : -1) * bx, yT, bz]], undefined, { hole: false }));
  kit.step({ title: "Tighten the bolts from below", detail: "A washer and a nut on each, with the spanner, holding the bolt with the Allen key.", tools: ["wrench", "allen"], kind: "bolts" }, () => {
    kit.fit(BOX_WASHER, under, 0.12);
    kit.fit(BOX_NUT, under, 0.12);
  });
  const wingBox = (i: number) => kit.pts(`w${i}`, [0, 0, 1], [-40, 40].map((dx): Vec3 => [(i ? 1 : -1) * bx + dx, yS + 5, mz - 9]), `bx${i}`);
  kit.step({ title: "Screw on the left mirror side", detail: "It stands behind the left box. Two screws through it into the box.", tools: ["screwdriver"], kind: "screws" }, () => {
    kit.add(["w0"], [0, 0, -260]);
    b.then(0.15);
    kit.fit(WING_SCREW, wingBox(0), 0.12);
  });
  kit.step({ title: "Fit the back board", detail: "Four dowels in its ends, then push it into the left side, scalloped edge up.", tools: ["hammer"], kind: "join" }, () => {
    kit.fit(DOWEL, [-1, 1].flatMap((g) => kit.pts("bb", [-g, 0, 0], [yS + 30, yS + 90].map((y): Vec3 => [g * xw, y, mz]), g < 0 ? "w0" : "w1")), 0.08);
    b.then(0.15);
    kit.add(["bb"], [260, 0, 0]);
  });
  kit.step({ title: "Screw on the right mirror side", detail: "Onto the dowels, then two screws into the box and two through its edge into the back board.", tools: ["screwdriver"], kind: "screws" }, () => {
    kit.add(["w1"], [260, 0, 0]);
    b.then(0.15);
    kit.fit(WING_SCREW, wingBox(1), 0.12);
    kit.fit(WING_SCREW, kit.pts("w1", [-1, 0, 0], [yS + 40, yS + 90].map((y): Vec3 => [xw + 60, y, mz]), "bb"), 0.12);
  });
  void WALL_SCREW;
  kit.step({ title: "Lower the mirror between the sides", detail: "It rests on the peg in the middle of the back board while you fit the bolts.", kind: "join" }, () => kit.add(["mirror"], [0, 300, 0]));
  const piv = [0, 1].map((i) => {
    const g = i ? 1 : -1;
    return {
      nut: kit.pts("mirror", [0, 0, 1], [[g * (mw / 2 - 20), my, mz - 12]]),
      bolt: kit.pts(`w${i}`, [-g, 0, 0], [[g * (xw + 50), my, mz]], "mirror", { mateHole: 3 }),
      washers: kit.pts(`w${i}`, [-g, 0, 0], [g * (xw + 50), g * (xw - 4), g * (xw - 10)].map((x): Vec3 => [x, my, mz]), undefined, { hole: false }),
    };
  });
  kit.step({ title: "Bolt the mirror in place", detail: "Two people. A barrel nut into each side of the mirror frame, then a bolt through each side piece with three washers: one under the head, two between the side and the mirror.", tools: ["allen", "flathead"], kind: "bolts", people: 2 }, () => {
    for (const p of piv) kit.fit(BARREL_NUT, p.nut, 0.12);
    b.then(0.1);
    for (const p of piv) {
      kit.fit(PIVOT_WASHER, p.washers, 0.08);
      kit.fit(PIVOT_BOLT, p.bolt, 0.12);
    }
  });
  kit.step({ title: "Fix it to the wall", detail: "Screw the strap to the back of the back board, mark the wall, drill and screw it on. Wall screws and plugs aren't included: use ones made for your wall.", tools: ["screwdriver", "drill", "pencil"], kind: "anchor", wall: true, warnings: ["wall", "tip"] }, () => {
    kit.fit(STRAP, kit.pts("bb", [0, 0, 1], [[0, yS + 80, mz - 9]], undefined, { hole: false }));
    kit.fit(STRAP_SCREW, kit.pts("bb", [0, 0, 1], [[0, yS + 70, mz - 9]]));
    kit.fit(WALL_PLUG, kit.pts(undefined, [0, 0, 1], [[0, yS + 150, -D / 2 - 40]]));
    kit.fit(WALL_SCREW, kit.pts(undefined, [0, 0, 1], [[0, yS + 150, -D / 2 - 30]]));
  });
  // the big drawer, on its front
  const c: Vec3 = [0, ys + sh / 2, dz - dl / 2];
  const ds = (k: string, from?: Vec3) => {
    const it = b.partItem(kit.k(k));
    b.stage(kit.k(k), [it.final.pos[0] - c[0], it.final.pos[1] - c[1], it.final.pos[2] - c[2]], it.final.rot, from);
  };
  const dstep = (o: StepOpts, body: () => void) => kit.step({ scene: "drawer", pose: "-z", kind: "drawer", ...o }, body);
  const per = (fn: (g: number, i: number) => FitOpts[]) => [...fn(-1, 0), ...fn(1, 1)];
  dstep({ title: "Screw the cam bolts into the drawer front", detail: "Face down on a rug, with the lip for your fingers at the bottom. Four bolts.", tools: ["screwdriver"], kind: "cams" }, () => {
    ds("df", [0, 0, -160]);
    b.then(0.15);
    kit.fit(DRAWER_BOLT, per((g, i) => kit.pts("df", [0, 0, 1], [ys + 20, ys + sh - 20].map((y): Vec3 => [g * xs, y, dz]), `ds${i}`, { mateHole: 3 })), 0.08);
  });
  dstep({ title: "Stand the sides on the front", detail: "Grooves facing in.", kind: "join" }, () => {
    ds("ds0", [0, 0, -260]);
    ds("ds1", [0, 0, -260]);
  });
  dstep({ title: "Lock the cam locks", detail: "Four of them.", tools: ["screwdriver"], kind: "cams" }, () => kit.fit(DRAWER_CAM, per((g, i) => kit.pts(`ds${i}`, [g, 0, 0], [ys + 20, ys + sh - 20].map((y): Vec3 => [g * (xs - st / 2), y, dz - 25]))), 0.1));
  dstep({ title: "Slide in the drawer bottom", detail: "Down the grooves to the front.", kind: "drawer" }, () => ds("dbt", [0, 0, -380]));
  const ddz = (i: number) => kit.b.partItem(kit.k(`dd${i}`)).final.pos;
  dstep({ title: "Stand the dividers in", detail: "Two dowels in each end, then push them into the front.", tools: ["hammer"], kind: "join" }, () => {
    kit.fit(SMALL_DOWEL, [0, 1].flatMap((i) => {
      const p = ddz(i);
      return [...kit.pts(`dd${i}`, [0, 0, -1], [[p[0], p[1] - 15, dz], [p[0], p[1] + 15, dz]], "df"), ...kit.pts(`dd${i}`, [0, 0, 1], [[p[0], p[1] - 15, dz - dl + st], [p[0], p[1] + 15, dz - dl + st]], "dbk")];
    }), 0.06);
    b.then(0.15);
    ds("dd0", [0, 0, -260]);
    ds("dd1", [0, 0, -260]);
  });
  dstep({ title: "Lay the drawer back on", detail: "Onto the dividers' dowels, between the sides.", kind: "join" }, () => ds("dbk", [0, 0, -240]));
  dstep({ title: "Screw the back on", detail: "Two screws through the back into each side.", tools: ["screwdriver"], kind: "screws" }, () =>
    kit.fit(BACK_SCREW, per((g, i) => kit.pts("dbk", [0, 0, 1], [ys + 25, ys + sh - 25].map((y): Vec3 => [g * xs, y, dz - dl - st]), `ds${i}`)), 0.1),
  );
  const runDrawer = per((g, i) => kit.pts(`ds${i}`, [-g, 0, 0], [[g * (xs + st / 2 + 4), ys + 30, dz - dl / 2]], undefined, { hole: false }));
  dstep({ title: "Screw the runners to the drawer", detail: "One on each side, two screws each.", tools: ["screwdriver"], kind: "runners", pose: "+y" }, () => {
    kit.fit(runnerDef(dl - 40), runDrawer, 0.2);
    b.then(0.1);
    kit.fit(RUNNER_SCREW, per((g, i) => kit.pts(`ds${i}`, [-g, 0, 0], [dz - 40, dz - dl + 40].map((z): Vec3 => [g * (xs + st / 2 + 4), ys + 30, z]))), 0.08);
  });
  kit.step({ title: "Slide the drawer in", detail: "Set its runners on the ones under the top and push it in until it closes.", kind: "drawer" }, () => {
    b.stagger(0);
    kit.add(drawer, [0, 0, 460]);
  });
  kit.step({ title: "Screw the knobs on the little drawers", detail: "They come ready made. The screw goes in from inside.", tools: ["screwdriver"], scene: "small", kind: "screws", repeat: 2 }, () => {
    kit.stage(["sd0"], [-bx, yS + bh / 2, bz + 6], [0, 0, 0], [0, bh / 2, 0], [0, 160, 0]);
    b.then(0.15);
    kit.fit(KNOB, kit.pts("sd0", [0, 0, -1], [[-bx, yS + bh / 2, bz + 6 + (bd - 12) / 2]], undefined, { hole: false }), 0.15);
    kit.fit(KNOB_BOLT, kit.pts("sd0", [0, 0, 1], [[-bx, yS + bh / 2, bz + 6 + (bd - 12) / 2 - 10]]), 0.12);
  });
  kit.step({ title: "Slide in the little drawers", detail: "One into each box.", kind: "drawer" }, () => {
    kit.add(["sd0", "sd1"], [0, 0, 300]);
    const z = bz + 6 + (bd - 12) / 2;
    kit.preset(KNOB, kit.pts("sd1", [0, 0, -1], [[bx, yS + bh / 2, z]], undefined, { hole: false }));
    kit.preset(KNOB_BOLT, kit.pts("sd1", [0, 0, 1], [[bx, yS + bh / 2, z - 10]]));
  });
  return true;
}

/* ---------- desk 155 x 65 ---------- */

const FASTENER: HwDef = { kind: "nail", len: 35, dia: 5, name: "Push-in fastener" };
const DOWEL_PED: HwDef = { kind: "dowel", len: 40, dia: 8 };
const DRAWER_DOWEL: HwDef = { kind: "dowel", len: 30, dia: 6 };
const SCREW_DR: HwDef = { kind: "screw", len: 13, dia: 4 };
const PED_RUNNER_SCREW: HwDef = { kind: "screw", len: 12, dia: 4.5 };
const LONG_JOIN_SCREW: HwDef = { kind: "screw", len: 70, dia: 6 };
const STRIP_SCREW: HwDef = { kind: "screw", len: 50, dia: 4 };
const UP_SCREW: HwDef = { kind: "screw", len: 60, dia: 5 };
const TRAY_SCREW: HwDef = { kind: "screw", len: 12, dia: 3.5 };
const FILE_HOLDER: HwDef = { kind: "clip", len: 30, dia: 16, name: "File rail holder" };
const FILE_RAIL: HwDef = { kind: "hook", len: 500, dia: 6, name: "File rail" };
const TRAY_RAIL: HwDef = { kind: "runner", len: 480, dia: 12, name: "Tray rail" };
const FELT_STRIP: HwDef = { kind: "glide", len: 2, dia: 15, name: "Felt strip" };
const SHELF_PIN: HwDef = { kind: "pin", len: 16, dia: 5 };
const DOOR_STOP: HwDef = { kind: "pin", len: 12, dia: 8, name: "Door stop" };
const CATCH: HwDef = { kind: "plate", len: 40, dia: 20, name: "Door catch" };
const BUMPER: HwDef = { kind: "glide", len: 3, dia: 10, name: "Bumper" };

/*
 * Desk 155: two pedestals, each built on its side from two ready-made side frames (legs, rails and a panel): one lies
 * on a rug, the four cross rails stand in it on dowels and cam locks, the hardboard back slides down the grooves and
 * the other frame goes on. Between them go the cable shelf with its back board and top strip, and the front rail on
 * long screws. Runners go in the right pedestal for its two drawers (one with file rails, built on their fronts), the
 * left one takes a tray on rails, a shelf and a door on two clip hinges. The top goes on with dowels and cam locks.
 */
function desk155(b: PlanBuilder, s: ProductSpec) {
  const kit = new Kit(b);
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const topT = 30, legH = H - topT, P = 45, ov = 10;
  const zf = D / 2 - ov, zb = -D / 2 + ov; // leg faces
  const zpf = zf - P / 2, zpb = zb + P / 2;
  const pw = Math.round(W * 0.26); // pedestal width
  const xo = W / 2 - ov; // pedestal outer faces
  const yR0 = 90, yRb = 150, yRt = legH - 80; // bottom rail, top of the bottom rail, underside of the top rail
  const peds = [-1, 1].map((g) => {
    const out = g * xo, inn = g * (xo - pw);
    const lo = Math.min(out, inn), hi = Math.max(out, inn);
    return { g, lo, hi, cx: (lo + hi) / 2, xa: lo + P / 2, xb: hi - P / 2, ia: lo + P, ib: hi - P };
  });
  const frame = (id: string, x: number) => {
    const len = zpf - zpb - P;
    kit.part(id, "Side frame", [P, legH, zf - zb], [x, legH / 2, 0], {
      material: "wood",
      pieces: [
        { shape: "box", size: [P, legH, P], pos: [0, 0, zpf], material: "wood" },
        { shape: "box", size: [P, legH, P], pos: [0, 0, zpb], material: "wood" },
        { shape: "box", size: [30, 80, len], pos: [0, legH - 40 - legH / 2, 0], material: "wood" },
        { shape: "box", size: [30, yRb - yR0, len], pos: [0, (yR0 + yRb) / 2 - legH / 2, 0], material: "wood" },
        { shape: "box", size: [14, yRt - yRb, len], pos: [0, (yRt + yRb) / 2 - legH / 2, 0], material: "board" },
      ],
    });
  };
  for (const [i, p] of peds.entries()) {
    frame(`p${i}a`, p.xa);
    frame(`p${i}b`, p.xb);
    const rw = p.ib - p.ia;
    kit.part(`p${i}ft`, "Top rail", [rw, 60, 20], [p.cx, legH - 30, zf - 10], { material: "wood" });
    kit.part(`p${i}fb`, "Bottom rail", [rw, yRb - yR0, 20], [p.cx, (yR0 + yRb) / 2, zf - 10], { material: "wood" });
    kit.part(`p${i}bt`, "Top rail", [rw, 60, 20], [p.cx, legH - 30, zb + 10], { material: "wood" });
    kit.part(`p${i}bb`, "Bottom rail", [rw, yRb - yR0, 20], [p.cx, (yR0 + yRb) / 2, zb + 10], { material: "wood" });
    kit.part(`p${i}bk`, "Back panel", [rw + 10, legH - 60 - yRb, 4], [p.cx, (legH - 60 + yRb) / 2, zb + 24], { material: "fiber" });
  }
  const pedParts = (i: number) => [`p${i}a`, `p${i}ft`, `p${i}fb`, `p${i}bt`, `p${i}bb`, `p${i}bk`, `p${i}b`];
  // between the pedestals
  const xm = W / 2 - ov - pw; // inner faces of the pedestals
  const yShelf = legH - 120;
  kit.part("cs", "Cable shelf", [2 * xm, 16, 220], [0, yShelf, zb + 110]);
  kit.part("cb", "Back board", [2 * xm, legH - 20 - yShelf - 8, 18], [0, (yShelf + 8 + legH - 20) / 2, zb + 9]);
  kit.part("st", "Top strip", [2 * xm, 20, 40], [0, legH - 10, zb + 20], { material: "wood" });
  kit.part("fr", "Front rail", [2 * xm, 60, 20], [0, legH - 30, zf - 10], { material: "wood" });
  const middle = ["cs", "cb", "st"];
  kit.part("top", "Top", [W, topT, D], [0, legH + topT / 2, 0], { material: "wood" });
  // left: door, shelf and tray; right: two drawers
  const L = peds[0], R = peds[1];
  const ow = L.ib - L.ia;
  kit.part("door", "Door", [ow - 4, yRt - yRb - 4, 20], [L.cx, (yRt + yRb) / 2, zf - 10]);
  kit.part("shelf", "Shelf", [ow - 4, 18, zf - zb - 90], [L.cx, 330, -10]);
  const tw = ow - 16, td = zf - zb - 110, tyB = yRt - 70, tz = (zf - 20 - 10 + zb + 40) / 2;
  kit.part("tf", "Tray front", [tw, 60, 14], [L.cx, tyB + 30, tz + td / 2 - 7]);
  kit.part("tl", "Tray side", [14, 60, td - 28], [L.cx - tw / 2 + 7, tyB + 30, tz]);
  kit.part("tr", "Tray side", [14, 60, td - 28], [L.cx + tw / 2 - 7, tyB + 30, tz]);
  kit.part("tk", "Tray back", [tw, 60, 14], [L.cx, tyB + 30, tz - td / 2 + 7]);
  kit.part("tb", "Tray bottom", [tw - 20, 4, td - 20], [L.cx, tyB + 8, tz], { material: "fiber" });
  const tray = ["tf", "tl", "tr", "tk", "tb"];
  const rw2 = R.ib - R.ia;
  const dSplit = yRb + Math.round((yRt - yRb) * 0.66);
  type Dr = { id: string; y0: number; fh: number; file: boolean };
  const drs: Dr[] = [
    { id: "e0", y0: dSplit, fh: yRt - dSplit - 2, file: false },
    { id: "e1", y0: yRb + 2, fh: dSplit - yRb - 4, file: true },
  ];
  const ft = 20, st = 14, xs = (rw2 - 4) / 2 - 24, dl = zf - ft - (zb + 40), zIn = zf - ft, zc = zIn - dl / 2;
  for (const d of drs) {
    const sh = d.fh - 34, ys = d.y0 + 14;
    kit.part(`${d.id}f`, "Drawer front", [rw2 - 4, d.fh, ft], [R.cx, d.y0 + d.fh / 2, zf - ft / 2]);
    kit.part(`${d.id}l`, "Drawer side", [st, sh, dl], [R.cx - xs, ys + sh / 2, zc]);
    kit.part(`${d.id}r`, "Drawer side", [st, sh, dl], [R.cx + xs, ys + sh / 2, zc]);
    kit.part(`${d.id}b`, "Drawer bottom", [2 * xs, 4, dl - 20], [R.cx, ys + 8, zc + 6], { material: "fiber" });
    kit.part(`${d.id}k`, "Drawer back", [2 * xs - st, sh - 14, st], [R.cx, ys + 14 + (sh - 14) / 2, zIn - dl + st / 2]);
  }
  const drParts = (d: Dr) => ["f", "l", "r", "b", "k"].map((k) => `${d.id}${k}`);

  /* --- the pedestals --- */
  const pedFits = (i: number) => {
    const p = peds[i];
    const rails: [string, number, number][] = [[`p${i}ft`, legH - 30, zf - 10], [`p${i}fb`, (yR0 + yRb) / 2, zf - 10], [`p${i}bt`, legH - 30, zb + 10], [`p${i}bb`, (yR0 + yRb) / 2, zb + 10]];
    const one = (fr: string, x: number, g: number) => ({
      bolts: rails.flatMap(([r, y, z]) => kit.pts(fr, [g, 0, 0], [[x, y - 12, z]], r, { mateHole: 4 })),
      dowels: rails.flatMap(([r, y, z]) => kit.pts(fr, [g, 0, 0], [[x, y + 14, z]], r)),
      cams: rails.flatMap(([r, y, z]) => kit.pts(r, [0, y > 300 ? 1 : -1, 0], [[x - g * 26, y > 300 ? legH - 60 : yRb, z]])),
    });
    return { a: one(`p${i}a`, p.ia, -1), b: one(`p${i}b`, p.ib, 1) };
  };
  const pf = [pedFits(0), pedFits(1)];
  const pedSteps = (i: number) => {
    const scene = i ? "ped2" : undefined;
    const put = (ids: string[], from: Vec3) => {
      if (!scene) return kit.add(ids, from);
      for (const id of ids) {
        const it = b.partItem(kit.k(id));
        b.stage(kit.k(id), it.final.pos, it.final.rot, from);
      }
    };
    const f = pf[i];
    const pose = "+x" as const;
    const which = i ? "the second pedestal" : "the first pedestal";
    kit.step({ title: `Screw the cam bolts into the side frames`, detail: `For ${which}: both frames on a rug, inside up. Four bolts in each.`, tools: ["screwdriver"], pose, scene, kind: "cams", repeat: 2, warnings: ["floor"] }, () => {
      put([`p${i}a`], [0, 200, 0]);
      b.then(0.15);
      kit.fit(CAM_BOLT, f.a.bolts, 0.08);
    });
    kit.step({ title: "Tap the dowels into the side frames", detail: "Four in each, next to the bolts.", tools: ["hammer"], pose, scene, kind: "dowels", repeat: 2 }, () => kit.fit(DOWEL_PED, f.a.dowels, 0.08));
    kit.step({ title: "Stand the four rails in", detail: "One frame stays on the rug. Top and bottom rails at the front and the back; the holes for the cam locks face in.", pose, scene, kind: "join" }, () => {
      b.stagger(0.18);
      put([`p${i}ft`, `p${i}fb`, `p${i}bt`, `p${i}bb`], [300, 0, 0]);
    });
    kit.step({ title: "Lock the rails", detail: "Four cam locks, arrow towards the bolt.", tools: ["screwdriver"], pose, scene, kind: "cams" }, () => kit.fit(CAM, f.a.cams, 0.1));
    kit.step({ title: "Slide in the back panel", detail: "Patterned side in, down the grooves in the back legs.", pose, scene, kind: "join" }, () => put([`p${i}bk`], [300, 0, 0]));
    kit.step({ title: "Lower the other side frame on", detail: "It has its bolts and dowels in. Press it down evenly.", pose, scene, kind: "join" }, () => {
      put([`p${i}b`], [320, 0, 0]);
      kit.preset(CAM_BOLT, f.b.bolts);
      kit.preset(DOWEL_PED, f.b.dowels);
    });
    kit.step({ title: "Stand it up and lock the other side", detail: "Four more cam locks.", tools: ["screwdriver"], scene, kind: "cams" }, () => kit.fit(CAM, f.b.cams, 0.1));
  };
  pedSteps(0);
  pedSteps(1);

  /* --- the middle --- */
  const mscene = "middle";
  const mstage = (ids: string[], from: Vec3) => {
    for (const id of ids) {
      const it = b.partItem(kit.k(id));
      b.stage(kit.k(id), it.final.pos, it.final.rot, from);
    }
  };
  const xb2 = [-xm * 0.6, xm * 0.6];
  kit.step({ title: "Screw two cam bolts into the cable shelf", detail: "Lay it flat, holes up.", tools: ["screwdriver"], scene: mscene, kind: "cams" }, () => {
    mstage(["cs"], [0, 160, 0]);
    b.then(0.15);
    kit.fit(CAM_BOLT, kit.pts("cs", [0, -1, 0], xb2.map((x): Vec3 => [x, yShelf + 8, zb + 9]), "cb", { mateHole: 4 }), 0.1);
  });
  kit.step({ title: "Stand the back board on the shelf", detail: "Three dowels into the shelf, then the board onto them and the bolts.", tools: ["hammer"], scene: mscene, kind: "join" }, () => {
    kit.fit(DOWEL_PED, kit.pts("cs", [0, -1, 0], [-xm * 0.85, 0, xm * 0.85].map((x): Vec3 => [x, yShelf + 8, zb + 9]), "cb"), 0.08);
    b.then(0.15);
    mstage(["cb"], [0, 200, 0]);
  });
  kit.step({ title: "Lock the back board", detail: "Two cam locks.", tools: ["screwdriver"], scene: mscene, kind: "cams" }, () =>
    kit.fit(CAM, kit.pts("cb", [0, 0, -1], xb2.map((x): Vec3 => [x, yShelf + 30, zb + 18])), 0.1),
  );
  kit.step({ title: "Put the top strip on", detail: "Two small dowels in its underside, then onto the top edge of the board.", tools: ["hammer"], scene: mscene, kind: "join" }, () => {
    kit.fit(SMALL_DOWEL, kit.pts("st", [0, 1, 0], xb2.map((x): Vec3 => [x, legH - 20, zb + 9]), "cb"), 0.1);
    b.then(0.15);
    mstage(["st"], [0, 160, 0]);
  });
  kit.step({ title: "Screw the strip down", detail: "Two screws through the strip into the board.", tools: ["screwdriver"], scene: mscene, kind: "screws" }, () =>
    kit.fit(STRIP_SCREW, kit.pts("st", [0, -1, 0], [-xm * 0.3, xm * 0.3].map((x): Vec3 => [x, legH, zb + 9]), "cb"), 0.12),
  );
  // the right pedestal waits beside the left one
  const sideOff: Vec3 = [520, 0, 0];
  const midJoin = (g: number) => {
    const fr0 = g < 0 ? "p0b" : "p1a";
    const x = g * xm;
    return {
      bolts: [...kit.pts(fr0, [g, 0, 0], xb2.map((z, k): Vec3 => [x, yShelf, zb + 60 + k * 120]), "cs", { mateHole: 4 }), ...kit.pts(fr0, [g, 0, 0], [[x, yShelf + 40, zb + 9]], "cb", { mateHole: 4 })],
      dowels: [...kit.pts(fr0, [g, 0, 0], [[x, yShelf, zb + 120]], "cs"), ...kit.pts(fr0, [g, 0, 0], [[x, yShelf + 60, zb + 9]], "cb")],
      cams: [...kit.pts("cs", [0, -1, 0], [0, 1].map((k): Vec3 => [x - g * 26, yShelf + 8, zb + 60 + k * 120])), ...kit.pts("cb", [0, 0, -1], [[x - g * 26, yShelf + 40, zb + 18]])],
      railDowel: kit.pts("fr", [-g, 0, 0], [[x, legH - 30, zf - 10]], fr0),
      railScrews: kit.pts(fr0, [-g, 0, 0], [legH - 45, legH - 15].map((y): Vec3 => [x + g * P, y, zf - 10]), "fr"),
    };
  };
  const mj = [midJoin(-1), midJoin(1)];
  kit.step({ title: "Screw cam bolts into the left pedestal", detail: "Three into the inner side, for the shelf and the back board. Stand the right pedestal next to it.", tools: ["screwdriver"], kind: "cams" }, () => {
    for (const id of pedParts(1)) {
      const it = b.partItem(kit.k(id));
      b.stage(kit.k(id), [it.final.pos[0] + sideOff[0], it.final.pos[1], it.final.pos[2]], it.final.rot, [0, 0, 300]);
    }
    b.then(0.15);
    kit.fit(CAM_BOLT, [...mj[0].bolts, ...mj[1].bolts], 0.08);
  });
  kit.step({ title: "Tap dowels into the right pedestal", detail: "Two into its inner side. Four in all, two on each pedestal.", tools: ["hammer"], kind: "dowels" }, () => kit.fit(DOWEL_PED, [...mj[0].dowels, ...mj[1].dowels], 0.08));
  kit.step({ title: "Tap a dowel into each end of the front rail", detail: "The small dowels.", tools: ["hammer"], scene: "rail", kind: "dowels" }, () => {
    mstage(["fr"], [0, 160, 0]);
    b.then(0.15);
    kit.fit(SMALL_DOWEL, [...mj[0].railDowel, ...mj[1].railDowel], 0.1);
  });
  kit.step({ title: "Join the pedestals", detail: "Slide the shelf unit and the front rail between them and push the right pedestal on. Two long screws through each front leg into the rail.", tools: ["allen"], kind: "join", people: 2 }, () => {
    b.stagger(0.1);
    kit.add([...middle, "fr"], [300, 0, 0]);
    b.then(0.15);
    b.stagger(0);
    kit.add(pedParts(1), sideOff.map((v) => v * 0.6) as Vec3);
    b.then(0.2);
    kit.fit(LONG_JOIN_SCREW, [...mj[0].railScrews, ...mj[1].railScrews], 0.1);
  });
  kit.step({ title: "Lock the shelf unit", detail: "Six cam locks, three at each end.", tools: ["screwdriver"], kind: "cams" }, () => kit.fit(CAM, [...mj[0].cams, ...mj[1].cams], 0.1));
  const runLen = Math.round((dl - 40) / 10) * 10;
  const pedRun = (fr: string, x: number, g: number) => drs.map((d) => ({
    run: kit.pts(fr, [g, 0, 0], [[x, d.y0 + 30, zc]], undefined, { hole: false }),
    screws: kit.pts(fr, [g, 0, 0], [zc - runLen / 2 + 40, zc + runLen / 2 - 40].map((z): Vec3 => [x - g * 4, d.y0 + 30, z])),
  }));
  const runR = pedRun("p1b", R.xb - 7, 1), runL = pedRun("p1a", R.xa + 7, -1);
  kit.step({ title: "Screw the runners into the right side", detail: "The ones marked CR, wheel at the front, two screws each.", tools: ["screwdriver"], kind: "runners" }, () => {
    for (const r of runR) kit.fit(runnerDef(runLen), r.run, 0.2);
    b.then(0.1);
    kit.fit(PED_RUNNER_SCREW, runR.flatMap((r) => r.screws), 0.08);
  });
  kit.step({ title: "Screw the runners into the left side", detail: "The ones marked CL, the same way.", tools: ["screwdriver"], kind: "runners" }, () => {
    for (const r of runL) kit.fit(runnerDef(runLen), r.run, 0.2);
    b.then(0.1);
    kit.fit(PED_RUNNER_SCREW, runL.flatMap((r) => r.screws), 0.08);
  });

  /* --- drawers, built on their fronts --- */
  const drFits = (d: Dr) => {
    const sh = d.fh - 34, ys = d.y0 + 14;
    const per = (fn: (g: number, sd: string) => FitOpts[]) => [...fn(-1, `${d.id}l`), ...fn(1, `${d.id}r`)];
    const ky = d.y0 + d.fh / 2;
    return {
      dowels: per((g, sd) => kit.pts(sd, [0, 0, -1], [[R.cx + g * xs, ys + sh / 2, zIn]], `${d.id}f`)),
      dowels2: per((g, sd) => kit.pts(sd, [0, 0, -1], [[R.cx + g * xs, ys + sh * 0.25, zIn]], `${d.id}f`)),
      bolts: per((g, sd) => kit.pts(`${d.id}f`, [0, 0, 1], [ys + 18, ys + sh - 18].map((y): Vec3 => [R.cx + g * xs, y, zIn]), sd, { mateHole: 3 })),
      cams: per((g, sd) => kit.pts(sd, [g, 0, 0], [ys + 18, ys + sh - 18].map((y): Vec3 => [R.cx + g * (xs - st / 2), y, zIn - 25]))),
      fast: per((g, sd) => kit.pts(sd, [-g, 0, 0], [ys + 25, ys + sh - 25].map((y): Vec3 => [R.cx + g * (xs + st / 2), y, zIn - dl + st / 2]), `${d.id}k`)),
      run: per((g, sd) => kit.pts(sd, [-g, 0, 0], [[R.cx + g * (xs + st / 2 + 6), d.y0 + 30, zc]], undefined, { hole: false })),
      runScrews: per((g, sd) => kit.pts(sd, [-g, 0, 0], [zc - runLen / 2 + 40, zc + runLen / 2 - 40].map((z): Vec3 => [R.cx + g * (xs + st / 2 + 8), d.y0 + 30, z]))),
      knob: kit.pts(`${d.id}f`, [0, 0, -1], [[R.cx, ky, zf]], undefined, { hole: false }),
      knobBolt: kit.pts(`${d.id}f`, [0, 0, 1], [[R.cx, ky, zIn - 2]]),
      holders: per((g, sd) => kit.pts(sd, [0, -1, 0], [zIn - 30, zIn - dl + 30].map((z): Vec3 => [R.cx + g * xs, ys + sh, z]), undefined, { hole: false })),
      rails: [-1, 1].flatMap((k) => kit.pts(`${d.id}l`, [1, 0, 0], [[R.cx, ys + sh + 4, k > 0 ? zIn - 30 : zIn - dl + 30]], undefined, { hole: false })),
    };
  };
  const df = drs.map(drFits);
  const drawerSteps = (d: Dr, f: ReturnType<typeof drFits>) => {
    const c: Vec3 = [R.cx, d.y0 + d.fh / 2, zc];
    const ds = (k: string, from: Vec3) => {
      const it = b.partItem(kit.k(k));
      b.stage(kit.k(k), [it.final.pos[0] - c[0], it.final.pos[1] - c[1], it.final.pos[2] - c[2]], it.final.rot, from);
    };
    const o = (x: StepOpts, body: () => void) => kit.step({ scene: d.id, pose: "-z", kind: "drawer", ...x }, body);
    const name = d.file ? "deep drawer" : "shallow drawer";
    o({ title: `Tap the dowels into the ${name} sides`, detail: "Two in the front end of each side.", tools: ["hammer"], kind: "dowels" }, () => {
      ds(`${d.id}l`, [0, 0, -300]);
      ds(`${d.id}r`, [0, 0, -300]);
      b.then(0.15);
      kit.fit(DRAWER_DOWEL, [...f.dowels, ...f.dowels2], 0.08);
    });
    o({ title: "Screw the cam bolts into the drawer front", detail: "Front face down on a rug. Four bolts.", tools: ["screwdriver"], kind: "cams", warnings: ["floor"] }, () => {
      ds(`${d.id}f`, [0, 0, -160]);
      b.then(0.15);
      kit.fit(DRAWER_BOLT, f.bolts, 0.08);
    });
    o({ title: "Stand the sides on the front", detail: "Onto the dowels and bolts, grooves facing in.", kind: "join" }, () => {
      ds(`${d.id}l`, [0, 0, -200]);
      ds(`${d.id}r`, [0, 0, -200]);
    });
    o({ title: "Lock the cam locks", detail: "Four of them.", tools: ["screwdriver"], kind: "cams" }, () => kit.fit(CAM, f.cams, 0.1));
    o({ title: "Slide in the drawer bottom", detail: "Down the grooves until it reaches the front.", kind: "drawer" }, () => ds(`${d.id}b`, [0, 0, -380]));
    o({ title: "Lay the drawer back on", detail: "It sits on the bottom between the sides.", kind: "join" }, () => ds(`${d.id}k`, [0, 0, -240]));
    o({ title: "Tap in the fasteners", detail: "Two through each side into the back.", tools: ["hammer"], kind: "nails" }, () => kit.fit(FASTENER, f.fast, 0.1));
    const runs = () => {
      kit.fit(runnerDef(runLen), f.run, 0.2);
      b.then(0.1);
      kit.fit(SCREW_DR, f.runScrews, 0.08);
    };
    const knob = () => {
      kit.fit(KNOB, f.knob, 0.2);
      b.then(0.05);
      kit.fit(KNOB_BOLT, f.knobBolt, 0.15);
    };
    if (d.file) {
      o({ title: "Screw the runners to the drawer", detail: "Turn it upright. DL on the left, DR on the right, two screws each.", tools: ["screwdriver"], kind: "runners", pose: "+y" }, runs);
      o({ title: "Clip in the file rail holders", detail: "Four, on top of the sides at the holes for the paper size you use: letter, A4 or legal.", kind: "general", pose: "+y" }, () => kit.fit(FILE_HOLDER, f.holders, 0.1));
      o({ title: "Hook in the file rails", detail: "Two wire rails, from holder to holder.", kind: "general", pose: "+y" }, () => kit.fit(FILE_RAIL, f.rails, 0.2));
      o({ title: "Screw on the knob", detail: "The bolt goes in from inside the drawer.", tools: ["screwdriver"], kind: "screws", pose: "+y" }, knob);
    } else {
      o({ title: "Screw on the knob", detail: "The bolt goes in from inside the drawer.", tools: ["screwdriver"], kind: "screws", pose: "+y" }, knob);
      o({ title: "Screw the runners to the drawer", detail: "Turn it upright. DL on the left, DR on the right, two screws each.", tools: ["screwdriver"], kind: "runners", pose: "+y" }, runs);
    }
  };
  drawerSteps(drs[1], df[1]);
  drawerSteps(drs[0], df[0]);
  // the tray
  const tc: Vec3 = [L.cx, tyB + 30, tz];
  const ts = (k: string, from: Vec3) => {
    const it = b.partItem(kit.k(k));
    b.stage(kit.k(k), [it.final.pos[0] - tc[0], it.final.pos[1] - tc[1], it.final.pos[2] - tc[2]], it.final.rot, from);
  };
  const tFast = (part: string, z: number, sgn: number) => [-1, 1].flatMap((g) => kit.pts(part, [0, 0, sgn], [tyB + 15, tyB + 45].map((y): Vec3 => [L.cx + g * (tw / 2 - 7), y, z]), g < 0 ? "tl" : "tr")).slice(0, 4);
  kit.step({ title: "Nail the tray sides to its front", detail: "Four fasteners through the front into the sides.", tools: ["hammer"], scene: "tray", kind: "nails" }, () => {
    ts("tf", [0, 160, 0]);
    ts("tl", [-160, 0, 0]);
    ts("tr", [160, 0, 0]);
    b.then(0.15);
    kit.fit(FASTENER, tFast("tf", tz + td / 2, -1), 0.1);
  });
  kit.step({ title: "Slide in the tray bottom and nail on the back", detail: "The bottom runs in the grooves, then four fasteners through the back.", tools: ["hammer"], scene: "tray", kind: "nails" }, () => {
    ts("tb", [0, 0, -300]);
    b.then(0.15);
    ts("tk", [0, 0, -200]);
    b.then(0.1);
    kit.fit(FASTENER, tFast("tk", tz - td / 2, 1), 0.1);
  });
  const trayRails = [-1, 1].flatMap((g) => kit.pts(g < 0 ? "tl" : "tr", [-g, 0, 0], [[L.cx + g * (tw / 2 + 4), tyB + 20, tz]], undefined, { hole: false }));
  kit.step({ title: "Screw the rails to the tray", detail: "One along each side, two screws each.", tools: ["screwdriver"], scene: "tray", kind: "runners" }, () => {
    kit.fit(TRAY_RAIL, trayRails, 0.2);
    b.then(0.1);
    kit.fit(TRAY_SCREW, [-1, 1].flatMap((g) => kit.pts(g < 0 ? "tl" : "tr", [-g, 0, 0], [tz - td / 3, tz + td / 3].map((z): Vec3 => [L.cx + g * (tw / 2 + 6), tyB + 20, z]))), 0.08);
  });
  kit.step({ title: "Stick on the felt strips", detail: "Cut the felt strip in two and stick one along each rail, so the tray runs quietly.", tools: ["knife"], scene: "tray", kind: "general" }, () =>
    kit.fit(FELT_STRIP, [-1, 1].flatMap((g) => kit.pts(g < 0 ? "tl" : "tr", [0, 1, 0], [[L.cx + g * (tw / 2 + 4), tyB + 12, tz]], undefined, { hole: false })), 0.15),
  );
  // the door side
  const hy = [yRb + 70, yRt - 70];
  const plates = kit.pts("p0b", [1, 0, 0], hy.map((y): Vec3 => [L.ib, y, zf - P + 10]), undefined, { hole: false });
  kit.step({ title: "Screw the hinge plates into the left pedestal", detail: "Lay the desk on its back. Two plates on the inner side, next to the door opening.", tools: ["screwdriver"], pose: "+z", kind: "hinges", people: 2 }, () => kit.fit(HINGE_PLATE, plates, 0.2));
  kit.step({ title: "Fit the door catch", detail: "Stand the desk up. Screw the catch to the top rail of the left pedestal and stick the bumper on the door side.", tools: ["screwdriver"], kind: "general", people: 2 }, () => {
    kit.fit(CATCH, kit.pts("p0ft", [0, 0, -1], [[L.cx - ow / 2 + 40, legH - 60, zf - 20]], undefined, { hole: false }));
    kit.fit(SCREW_DR, kit.pts("p0ft", [0, 1, 0], [-10, 10].map((dx): Vec3 => [L.cx - ow / 2 + 40 + dx, legH - 60, zf - 10])), 0.1);
    kit.fit(BUMPER, kit.pts("p0a", [-1, 0, 0], [[L.ia, yRt - 30, zf - 20]], undefined, { hole: false }));
  });
  const pinPts = [-1, 1].flatMap((g) => [tyB - 2, 312].flatMap((y) => [zf - 80, zb + 80].map((z): Vec3 => [g < 0 ? L.ia : L.ib, y, z])));
  kit.step({ title: "Push in the shelf pins", detail: "Eight: four near the top for the tray and four where you want the shelf.", kind: "shelves" }, () =>
    kit.fit(SHELF_PIN, pinPts.map((p) => kit.pts(p[0] === L.ia ? "p0a" : "p0b", [p[0] === L.ia ? -1 : 1, 0, 0], [p])[0]), 0.06),
  );
  kit.step({ title: "Slide in the tray and the shelf", detail: "The tray runs on its rails over the top pins; the shelf rests on the lower ones.", kind: "shelves" }, () => {
    b.stagger(0);
    kit.add(tray, [0, 0, 420]);
    b.then(0.2);
    kit.add(["shelf"], [0, 0, 420]);
  });
  kit.step({ title: "Push in the door stop", detail: "One, into the hole in the bottom rail.", kind: "general" }, () => kit.fit(DOOR_STOP, kit.pts("p0fb", [0, -1, 0], [[L.cx + ow / 2 - 30, yRb, zf - 20]])));
  const hinges = kit.pts("door", [0, 0, 1], hy.map((y): Vec3 => [L.ib - 40, y, zf - 20]), undefined, { hole: false });
  kit.step({ title: "Screw the hinges onto the door", detail: "Lay the door face down on a rug. Each hinge sits in its round hole; open it out.", tools: ["screwdriver"], scene: "door", pose: "-z", kind: "hinges", warnings: ["floor"] }, () => {
    const it = b.partItem(kit.k("door"));
    b.stage(kit.k("door"), it.final.pos, it.final.rot, [0, 0, -160]);
    b.then(0.15);
    kit.fit(HINGE, hinges, 0.2);
  });
  kit.step({ title: "Click the door onto the plates", detail: "Hook each hinge onto its plate at the front, then press at the back until it clicks.", kind: "doors" }, () => kit.add(["door"], [0, 0, 260]));
  kit.step({ title: "Screw on the door knob", detail: "The bolt goes in from the inside.", tools: ["screwdriver"], kind: "screws" }, () => {
    kit.fit(KNOB, kit.pts("door", [0, 0, -1], [[L.ia + 40, (yRt + yRb) / 2, zf]], undefined, { hole: false }), 0.2);
    kit.fit(KNOB_BOLT, kit.pts("door", [0, 0, 1], [[L.ia + 40, (yRt + yRb) / 2, zf - 22]]), 0.15);
  });

  /* --- the top --- */
  const topBolt = (on: string, x: number, z: number) => kit.pts("top", [0, 1, 0], [[x, legH, z]], on, { mateHole: 4 });
  const sideTops = peds.flatMap((p, i) => [[`p${i}a`, p.xa], [`p${i}b`, p.xb]] as [string, number][]);
  const bolts12 = [
    ...sideTops.flatMap(([id, x]) => [zf - 120, zb + 120].flatMap((z) => topBolt(id, x, z))),
    ...xb2.flatMap((x) => topBolt("fr", x, zf - 10)),
    ...xb2.flatMap((x) => topBolt("st", x, zb + 20)),
  ];
  const cams12 = [
    ...sideTops.flatMap(([id, x], k) => {
      const g = k % 2 ? -1 : 1;
      return [zf - 120, zb + 120].flatMap((z) => kit.pts(id, [g, 0, 0], [[x + g * (P / 2), legH - 25, z]]));
    }),
    ...xb2.flatMap((x) => kit.pts("fr", [0, 0, 1], [[x, legH - 25, zf - 20]])),
    ...xb2.flatMap((x) => kit.pts("st", [0, 0, -1], [[x, legH - 12, zb + 40]])),
  ];
  kit.step({ title: "Screw the cam bolts into the top", detail: "Top face down on a rug. Twelve bolts.", tools: ["screwdriver"], scene: "top", kind: "cams", warnings: ["floor", "face"] }, () => {
    b.stage(kit.k("top"), [0, topT / 2, 0], [Math.PI, 0, 0], [0, 160, 0]);
    b.then(0.15);
    kit.fit(TOP_BOLT, bolts12, 0.05);
  });
  const legTops = peds.flatMap((p, i) => [[`p${i}a`, p.xa], [`p${i}b`, p.xb]] as [string, number][]).flatMap(([id, x]) => kit.pts(id, [0, -1, 0], [zpf, zpb].map((z): Vec3 => [x, legH, z]), "top"));
  kit.step({ title: "Tap dowels into the frame", detail: "One in the top of each leg and one in the middle of the top strip.", tools: ["hammer"], kind: "dowels" }, () =>
    kit.fit(DOWEL_PED, [...legTops, ...kit.pts("st", [0, -1, 0], [[0, legH, zb + 20]], "top")], 0.06),
  );
  kit.step({ title: "Press the cam locks into the frame", detail: "Twelve, open side up towards the top.", kind: "cams" }, () => kit.fit(CAM, cams12, 0.05));
  kit.step({ title: "Lower the top on", detail: "Two people. Onto the dowels, with the bolts into the cam locks.", kind: "join", people: 2 }, () => kit.add(["top"], [0, 300, 0]));
  kit.step({ title: "Lock the cam locks", detail: "All twelve, arrow towards the bolt.", tools: ["screwdriver"], kind: "cams" });
  kit.step({ title: "Screw the top to the top strip", detail: "Three long screws up through the strip.", tools: ["screwdriver"], kind: "screws" }, () =>
    kit.fit(UP_SCREW, kit.pts("st", [0, 1, 0], [-xm * 0.5, 0, xm * 0.5].map((x): Vec3 => [x, legH - 20, zb + 30]), "top"), 0.12),
  );
  kit.step({ title: "Slide in the drawers", detail: "Rest each drawer's runners on the ones in the pedestal and push it in: the deep one at the bottom.", kind: "drawer" }, () => {
    for (const [k, d] of drs.entries()) {
      b.stagger(0);
      kit.add(drParts(d), [0, 0, 480]);
      void k;
      b.wait(0.2);
    }
  });
  kit.step({ title: "Press in the cable grommet", detail: "Into the hole at the back of the top, over the cable shelf.", kind: "general" }, () =>
    kit.fit(GROMMET, kit.pts("top", [0, -1, 0], [[-xm * 0.4, H, zb + 110]], undefined, { hole: false })),
  );
  return true;
}

/** HEMNES guides drawn in this file; returns false for any product it doesn't build. Wired in from hemnes.ts. */
export function hemnesTables(b: PlanBuilder, s: ProductSpec): boolean {
  switch (s.slug) {
    case "hemnes-desk-155-x-65":
      return desk155(b, s);
    case "hemnes-desk-2-drawers-120-x-47":
      return desk2(b, s);
    case "hemnes-dressing-table-mirror-100-x-50":
      return dressing100(b, s);
    case "hemnes-dressing-table-mirror-110-x-45":
      return dressing110(b, s);
    default:
      return false;
  }
}

import type { Family } from "./family";
import type { PartMaterial, PartPiece, Pose, ProductSpec, RowUnit, StepKind, ToolId, Vec3, WarnId } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";
import { buildUnits, unitOf as rowUnitOf } from "../units";

/**
 * BILLY, read from its manuals. The frame is built lying on one side: dowels go into the ends of the plinth, the bottom,
 * the fixed shelf and the top, cam bolts into both sides, the pieces stand up in the side on the floor and are locked
 * with cam locks, then the other side goes on and is locked too. Lying on its front, the back slides into the grooves
 * and is nailed along the top, the fixed shelf and the bottom (only along the bottom on the 106). It stands up, two
 * brackets fix the top to the wall, then the shelf pins and shelves go in.
 * Doors (OXBERG, HÖGADAL, HÖGBO, BILLY's own glass doors), the 35 cm height extension and the drawer on castors follow
 * their own manuals, after the bookcase.
 */

const T = 15; // panels
const G = 7; // the back sits this far in from the back edges
const PL = 60; // plinth height
const DT = 18; // door thickness

type Style = "solid" | "glass" | "panelglass" | "bamboo" | "hogbo";
type KitKind = "oxberg" | "hogadal" | "hogbo" | "billy";

interface Door {
  x: number; // centre
  w: number;
  y0: number;
  h: number;
  hingeLeft: boolean;
  style: Style;
}

interface Unit {
  W: number;
  H: number; // bookcase, mm (2020 or 1060), 0 for an extension unit on its own
  D: number; // carcass depth
  zb: number; // back plane
  deep: boolean;
  ext: boolean;
  doors: Door[];
  extDoors: Door[];
  kit: KitKind | null;
  drawer: boolean;
}

function unitOf(s: ProductSpec): Unit | null {
  const W = Math.round(s.size.w * 10);
  if (W !== 400 && W !== 800) return null;
  const h = s.size.h, d = s.size.d;
  const H = h >= 190 ? 2020 : h >= 95 ? 1060 : h >= 30 && h <= 40 ? 0 : -1;
  if (H < 0) return null;
  const deep = d >= 37;
  const D = deep ? 390 : 280;
  const front = d === 30 || d === 41;
  const Dp = D + (front ? 20 : 0);
  const zb = -Dp / 2;
  const ext = h >= 230;
  const name = s.name.toUpperCase(), v = s.variant.toLowerCase();
  const drawer = /drawer/.test(v);

  let style: Style | null = null;
  let kit: KitKind | null = null;
  if (/HÖGBO|HOGBO/.test(name)) [style, kit] = ["hogbo", "hogbo"];
  else if (/HÖGADAL|HOGADAL/.test(name)) [style, kit] = ["bamboo", "hogadal"];
  else if (/OXBERG/.test(name)) {
    kit = "oxberg";
    style = /panel\/glass|pnl\/glss/.test(v) ? "panelglass" : /glass/.test(v) ? "glass" : /door|drs/.test(v) ? "solid" : "glass";
  } else if (/glass door/.test(v)) [style, kit] = ["glass", "billy"];
  const nd = !style || H === 0 ? 0 : s.archetype === "cabinet" ? Math.max(0, Math.min(2, s.cabinet?.doors ?? W / 400)) : W / 400;

  const doors: Door[] = [];
  const extDoors: Door[] = [];
  const row = (y0: number, hh: number, st: Style, into: Door[]) => {
    for (let i = 0; i < nd; i++) {
      const w = W / nd - 3;
      into.push({ x: nd === 1 ? 0 : (i === 0 ? -1 : 1) * (W / 4), w, y0, h: hh, hingeLeft: nd === 1 || i === 0, style: st });
    }
  };
  if (style && nd) {
    const lower = H === 2020 && W === 800 && (style === "bamboo" || style === "hogbo");
    const split = ext && style === "solid";
    if (H === 1060 || lower || split) row(75, 970, style, doors);
    else row(75, 1920, style, doors);
    if (split) row(H + 345 - 970, 970, style, doors);
    else if (ext) row(H + 5, 340, "glass", extDoors);
  }
  return { W, H, D, zb, deep, ext: ext || H === 0, doors, extDoors, kit: doors.length ? kit : null, drawer };
}

/* ---------- small helpers over the builder ---------- */

const named = (b: PlanBuilder, def: HwDef, name: string) => {
  const t = b.hw.get(b.hwType(def));
  if (t) t.name = name;
  return def;
};

class Kit {
  private types = new Map<string, string>();
  constructor(public b: PlanBuilder) {}
  part(name: string, size: Vec3, pos: Vec3, o: { material?: PartMaterial; pieces?: PartPiece[] } = {}) {
    const k = `${name}|${size.map(Math.round).join("x")}|${o.pieces ? JSON.stringify(o.pieces) : ""}`;
    let ref = this.types.get(k);
    if (!ref) {
      ref = this.b.part(name, size, { material: o.material ?? "board" });
      if (o.pieces) this.b.parts[this.b.parts.length - 1].pieces = o.pieces;
      this.types.set(k, ref);
    }
    return this.b.place(ref, pos);
  }
  step(
    o: { title: string; detail: string; kind: StepKind; tools?: ToolId[]; pose?: Pose; people?: 1 | 2; scene?: string; warnings?: WarnId[]; wall?: boolean; check?: "square" },
    body: () => void,
  ) {
    const warnings = o.warnings ?? (o.people === 2 ? ["two"] : []);
    this.b.step({ ...o, warnings }, body);
  }
  fits(def: HwDef, list: FitOpts[]) {
    this.b.fits(def, list, Math.min(0.08, 2.4 / Math.max(1, list.length)));
    this.b.then(0.1);
  }
}

const many = (n: number, one: string, more: string) => (n === 1 ? one : more);

/* ---------- the bookcase ---------- */

interface Frame {
  sideL: string;
  sideR: string;
  top: string;
  bottom: string;
  shelves: string[];
  yFixed: number;
}

function frame(k: Kit, u: Unit): Frame {
  const { b } = k;
  const { W, H, D, zb, deep } = u;
  const tall = H === 2020;
  const Wi = W - 2 * T;
  const dd = D - G; // depth of the pieces between the sides
  const zc = zb + D / 2;
  const zp = zc + G / 2; // pieces' centre
  const yTop = H - T / 2, yBot = PL + T / 2, yFixed = tall ? 970 : 0;
  const zPl = zb + D - 20 - T / 2;

  const sideL = k.part("Side", [T, H, D], [-W / 2 + T / 2, H / 2, zc]);
  const sideR = k.part("Side", [T, H, D], [W / 2 - T / 2, H / 2, zc]);
  const top = k.part("Top", [Wi, T, dd], [0, yTop, zp]);
  const fixed = tall ? k.part("Fixed shelf", [Wi, T, dd], [0, yFixed, zp]) : "";
  const bottom = k.part("Bottom", [Wi, T, dd], [0, yBot, zp]);
  const plinth = k.part("Plinth", [Wi, PL, T], [0, PL / 2, zPl]);
  const back = k.part("Back panel", [Wi + 10, H - 4, 3], [0, H / 2, zb + G - 1.5], { material: "fiber" });

  // shelves: two above and two below the fixed shelf on the tall one, two in the low one
  const free: [number, number][] = tall ? [[PL + T, yFixed - T / 2], [yFixed + T / 2, H - T]] : [[PL + T, H - T]];
  const shelfYs = free.flatMap(([a, c]) => [1, 2].map((i) => Math.round(a + ((c - a) * i) / 3)));
  const sd = dd - 12;
  const shelves = shelfYs.map((y) => k.part("Shelf", [Wi - 2, T, sd], [0, y, zb + D - sd / 2 - 4]));

  // dowels: two in each end of the pieces (three in the deep ones), two in each end of the plinth
  const dz = dd / 2 - 30;
  const dZs = deep ? [zp - dz, zp, zp + dz] : [zp - dz, zp + dz];
  const ends = (key: string, y: number, zs: number[]): FitOpts[] =>
    [-1, 1].flatMap((sx) => zs.map((z) => ({ on: key, at: [(sx * Wi) / 2, y, z] as Vec3, dir: [-sx, 0, 0] as Vec3 })));
  const pieces = [top, ...(tall ? [fixed] : []), bottom];
  const pieceY = (key: string) => (key === top ? yTop : key === fixed ? yFixed : yBot);
  const dowels: FitOpts[] = [...pieces.flatMap((p) => ends(p, pieceY(p), dZs)), ...[-1, 1].flatMap((sx) => [PL / 2 - 14, PL / 2 + 14].map((y) => ({ on: plinth, at: [(sx * Wi) / 2, y, zPl] as Vec3, dir: [-sx, 0, 0] as Vec3 })))];

  // cam bolts in the sides and the cam locks they meet: one for the plinth and the bottom, two for the fixed shelf and the top
  const bz = dd / 2 - 70;
  const joints: { piece: string; y: number; z: number; face: Vec3; at: (sx: number) => Vec3 }[] = [];
  const two = (piece: string, y: number, face: "under" | "over") =>
    [zp - bz, zp + bz].forEach((z) =>
      joints.push({ piece, y, z, face: face === "under" ? [0, 1, 0] : [0, -1, 0], at: (sx) => [sx * (Wi / 2 - 25), face === "under" ? y - T / 2 : y + T / 2, z] }),
    );
  joints.push({ piece: plinth, y: PL / 2, z: zPl, face: [0, 0, 1], at: (sx) => [sx * (Wi / 2 - 25), PL / 2, zPl - T / 2] });
  joints.push({ piece: bottom, y: yBot, z: zp - bz, face: [0, -1, 0], at: (sx) => [sx * (Wi / 2 - 25), yBot + T / 2, zp - bz] });
  if (tall) two(fixed, yFixed, "under");
  two(top, yTop, "under");
  const bolts = (sx: number): FitOpts[] => joints.map((j) => ({ on: sx < 0 ? sideL : sideR, at: [(sx * Wi) / 2, j.y, j.z] as Vec3, dir: [sx, 0, 0] as Vec3, mate: j.piece }));
  const cams = (sx: number, which: (p: string) => boolean): FitOpts[] => joints.filter((j) => which(j.piece)).map((j) => ({ on: j.piece, at: j.at(sx), dir: j.face }));

  k.step(
    {
      title: "Tap the dowels into the plinth, bottom, top" + (tall ? " and fixed shelf" : ""),
      detail: `${deep ? "Three" : "Two"} into each end of the wide pieces and two into each end of the plinth. Tap them in gently with a hammer.`,
      kind: "dowels",
      tools: ["hammer"],
      scene: "pieces",
      warnings: ["floor"],
    },
    () => {
      b.stagger(0.12);
      const list = [plinth, bottom, ...(tall ? [fixed] : []), top];
      list.forEach((key, i) => {
        const z = (i - (list.length - 1) / 2) * (D + 80);
        b.stage(key, [0, key === plinth ? T / 2 : T / 2, z], key === plinth ? [Math.PI / 2, 0, 0] : [0, 0, 0]);
      });
      b.then(0.15);
      k.fits(HW.dowel, dowels);
    },
  );
  k.step(
    { title: "Screw the cam bolts into both sides", detail: `${joints.length} into each side, in the holes near the ends and at the fixed shelf. Turn them in until they stop.`, kind: "cams", tools: ["screwdriver"], scene: "sides" },
    () => {
      b.stagger(0.15);
      [sideL, sideR].forEach((key, i) => b.stage(key, [0, T / 2, (i - 0.5) * (D + 120)], [0, 0, Math.PI / 2]));
      b.then(0.15);
      k.fits(HW.camScrew, [...bolts(-1), ...bolts(1)]);
    },
  );
  const up: Vec3 = [420, 0, 0];
  k.step(
    {
      title: tall ? "Lay one side down and push in the plinth, bottom and fixed shelf" : "Lay one side down and push in the plinth, bottom and top",
      detail: "Cam bolts facing up. The holes for the cam locks face the inside, and the plinth goes at the front.",
      kind: "join",
      pose: "+x",
      warnings: ["floor"],
    },
    () => {
      b.add(sideL, [0, 0, 0]);
      b.then(0.15);
      b.stagger(0.25);
      for (const key of [plinth, bottom, tall ? fixed : top]) b.add(key, up);
    },
  );
  k.step(
    { title: "Turn the cam locks", detail: "Arrow towards the bolt, then turn each one clockwise until it pulls the piece tight to the side.", kind: "cams", tools: ["screwdriver"], pose: "+x" },
    () => k.fits(HW.cam, cams(-1, (p) => p !== top || !tall)),
  );
  if (tall)
    k.step({ title: "Push in the top and lock it", detail: "The cam lock holes go underneath. Turn its two cam locks.", kind: "cams", tools: ["screwdriver"], pose: "+x" }, () => {
      b.add(top, up);
      b.then(0.2);
      k.fits(HW.cam, cams(-1, (p) => p === top));
    });
  k.step(
    { title: "Lower the other side on", detail: "Guide every dowel and cam bolt into its hole, then press it down evenly.", kind: "join", pose: "+x", people: tall ? 2 : 1 },
    () => b.add(sideR, [460, 0, 0]),
  );
  k.step({ title: "Turn the other cam locks", detail: "The same way as on the first side, all of them.", kind: "cams", tools: ["screwdriver"], pose: "+x" }, () => k.fits(HW.cam, cams(1, () => true)));
  if (tall)
    k.step(
      { title: "Lay it on its front and mark the fixed shelf", detail: "Make a pencil mark on the back edge of each side, in the middle of the fixed shelf.", kind: "general", tools: ["pencil"], pose: "-z", people: 2 },
      () => {},
    );
  k.step(
    {
      title: "Unfold the back and slide it in",
      detail: tall ? "Into the grooves in the sides, from the bottom, until it reaches the top." : "Unfold it and push it into the grooves in the sides, all the way in.",
      kind: "join",
      pose: "-z",
    },
    () => b.add(back, [0, -Math.min(900, H * 0.6), 0]),
  );
  if (tall)
    k.step({ title: "Draw a line across the back", detail: "Between the two marks, with a ruler. It shows where the fixed shelf is for the nails.", kind: "general", tools: ["pencil", "tape"], pose: "-z" }, () => {});
  const nailRow = (piece: string, y: number, n: number): FitOpts[] =>
    Array.from({ length: n }, (_, i) => ({ on: back, at: [-Wi / 2 + 30 + ((Wi - 60) * i) / Math.max(1, n - 1), y, zb + G - 3] as Vec3, dir: [0, 0, 1] as Vec3, mate: piece, hole: false as const }));
  k.step(
    {
      title: "Nail the back on",
      detail: tall ? "Six nails into the bottom, six along the line into the fixed shelf and six into the top. Keep the back pressed tight at the bottom." : "Four nails along the bottom edge, into the bottom. Then turn it over.",
      kind: "nails",
      tools: ["hammer"],
      pose: "-z",
      check: "square",
    },
    () => k.fits(HW.nail, tall ? [...nailRow(bottom, yBot, 6), ...nailRow(fixed, yFixed, 6), ...nailRow(top, yTop, 6)] : nailRow(bottom, yBot, 4)),
  );
  return { sideL, sideR, top, bottom, shelves, yFixed };
}

/** Brackets screwed onto a top and into the wall, with a washer on each screw. Wall screws and plugs aren't in the box. */
function wallFits(k: Kit, top: string, y: number, zb: number, xs: number[], order: "top-first" | "wall" | "wall-only" | "top") {
  const bracket = xs.map((x) => ({ on: top, at: [x, y, zb + 22] as Vec3, dir: [0, -1, 0] as Vec3, travel: 60 }));
  const onTop = () => {
    k.fits(HW.washer, xs.map((x) => ({ on: top, at: [x, y + 2, zb + 46] as Vec3, dir: [0, -1, 0] as Vec3, hole: false as const })));
    k.fits(HW.screwS, xs.map((x) => ({ on: top, at: [x, y + 3, zb + 46] as Vec3, dir: [0, -1, 0] as Vec3 })));
  };
  const onWall = () => {
    k.fits(HW.plug, xs.map((x) => ({ on: top, at: [x, y + 34, zb] as Vec3, dir: [0, 0, -1] as Vec3, hole: false as const })));
    k.fits(HW.washer, xs.map((x) => ({ on: top, at: [x, y + 34, zb + 4] as Vec3, dir: [0, 0, -1] as Vec3, hole: false as const })));
    k.fits(HW.wallScrew, xs.map((x) => ({ on: top, at: [x, y + 34, zb + 6] as Vec3, dir: [0, 0, -1] as Vec3, hole: false as const })));
  };
  if (order === "top-first" || order === "wall") k.fits(HW.bracket, bracket);
  if (order === "top-first") (onTop(), onWall());
  else if (order !== "top") onWall();
  else onTop();
}

const WALL_DETAIL = "Wall screws and plugs aren't included: pick ones made for your wall.";

function bookcaseWall(k: Kit, u: Unit, f: Frame) {
  const xs = [-1, 1].map((sx) => sx * ((u.W - 2 * T) / 2 - 60));
  if (u.H === 2020) {
    k.step(
      { title: "Stand it up and fix it to the wall", detail: `Two brackets on the top at the back, each with a screw and a washer, then into the wall with a washer. ${WALL_DETAIL}`, kind: "anchor", tools: ["screwdriver", "drill", "pencil"], people: 2, wall: true, warnings: ["two", "wall", "tip"] },
      () => wallFits(k, f.top, u.H, u.zb, xs, "top-first"),
    );
    return;
  }
  k.step({ title: "Stand it against the wall and mark through the notches", detail: "Two notches at the back of the top show where the brackets go.", kind: "general", tools: ["pencil", "drill"] }, () => {});
  k.step({ title: "Screw the brackets to the wall", detail: `A washer under each screw. ${WALL_DETAIL}`, kind: "anchor", tools: ["screwdriver", "drill"], wall: true, warnings: ["wall", "tip"] }, () => wallFits(k, f.top, u.H, u.zb, xs, "wall"));
  k.step({ title: "Screw the brackets to the top", detail: "Push the bookcase back so the brackets slide into the notches, then a screw and a washer in each.", kind: "screws", tools: ["screwdriver"] }, () => wallFits(k, f.top, u.H, u.zb, xs, "top"));
}

function shelfSteps(k: Kit, u: Unit, f: Frame) {
  const { b } = k;
  const Wi = u.W - 2 * T;
  const pins: FitOpts[] = f.shelves.flatMap((key) => {
    const it = b.partItem(key).final.pos;
    const sz = b.parts.find((p) => p.id === b.partItem(key).ref)!.size[2];
    return [-1, 1].flatMap((sx) => [it[2] - sz / 2 + 40, it[2] + sz / 2 - 40].map((z) => ({ on: sx < 0 ? f.sideL : f.sideR, at: [(sx * Wi) / 2, it[1] - T / 2, z] as Vec3, dir: [sx, 0, 0] as Vec3, hole: false as const })));
  });
  k.step({ title: "Push in the shelf pins", detail: "Four for each shelf, at the same height on both sides. Pick any heights you like.", kind: "shelves" }, () => k.fits(HW.pin, pins));
  k.step({ title: many(f.shelves.length, "Lay the shelf on the pins", "Lay the shelves on the pins"), detail: "Each one rests flat on all four of its pins.", kind: "shelves" }, () => {
    b.stagger(0.25);
    for (const key of f.shelves) b.add(key, [0, 0, 420]);
  });
}

/* ---------- the 35 cm height extension ---------- */

function extension(k: Kit, u: Unit, f: Frame | null) {
  const { b } = k;
  const { W, D, zb } = u;
  const y0 = u.H; // stands on the bookcase
  const EH = 350;
  const Wi = W - 2 * T;
  const BT = 12; // its back is a thin panel
  const zc = zb + D / 2;
  const td = D - BT;
  const zt = zb + BT + td / 2;
  const scene = f ? "ext" : "main";
  const sideL = k.part("Extension side", [T, EH, D], [-W / 2 + T / 2, y0 + EH / 2, zc]);
  const sideR = k.part("Extension side", [T, EH, D], [W / 2 - T / 2, y0 + EH / 2, zc]);
  const top = k.part("Extension top", [Wi, T, td], [0, y0 + EH - T / 2, zt]);
  const back = k.part("Extension back", [Wi, EH, BT], [0, y0 + EH / 2, zb + BT / 2]);
  const sh = f ? -y0 : 0; // built standing on the floor of its own scene
  const stageAt = (key: string, pos: Vec3, rot: Vec3) => b.stage(key, pos, rot);
  const yT = y0 + EH - T / 2;
  const dz = td / 2 - 40;

  k.step({ title: "Tap the long dowels into the extension top", detail: "Two into each end. The short ones are for the back panel.", kind: "dowels", tools: ["hammer"], scene: "ext-a", warnings: ["floor"] }, () => {
    stageAt(top, [0, T / 2, 0], [0, 0, 0]);
    b.then(0.15);
    k.fits(named(b, { kind: "dowel", len: 30, dia: 8 }, "Wooden dowel"), [-1, 1].flatMap((sx) => [zt - dz, zt + dz].map((z) => ({ on: top, at: [(sx * Wi) / 2, yT, z] as Vec3, dir: [-sx, 0, 0] as Vec3 }))));
  });
  k.step({ title: "Tap the short dowels into the back panel", detail: "Two into each end.", kind: "dowels", tools: ["hammer"], scene: "ext-b", warnings: ["floor"] }, () => {
    stageAt(back, [0, BT / 2, 0], [Math.PI / 2, 0, 0]);
    b.then(0.15);
    k.fits({ kind: "dowel", len: 25, dia: 6 }, [-1, 1].flatMap((sx) => [y0 + 80, y0 + EH - 110].map((y) => ({ on: back, at: [(sx * Wi) / 2, y, zb + BT / 2] as Vec3, dir: [-sx, 0, 0] as Vec3 }))));
  });
  const boltAt = (sx: number): FitOpts[] => [
    ...[zt - dz + 30, zt + dz - 30].map((z) => ({ on: sx < 0 ? sideL : sideR, at: [(sx * Wi) / 2, yT, z] as Vec3, dir: [sx, 0, 0] as Vec3, mate: top })),
    { on: sx < 0 ? sideL : sideR, at: [(sx * Wi) / 2, y0 + EH / 2, zb + BT / 2] as Vec3, dir: [sx, 0, 0] as Vec3, mate: back },
  ];
  k.step({ title: "Screw the cam bolts into the extension sides", detail: "Three into each side: two for the top and one for the back panel.", kind: "cams", tools: ["screwdriver"], scene: "ext-c" }, () => {
    [sideL, sideR].forEach((key, i) => stageAt(key, [0, T / 2, (i - 0.5) * (D + 100)], [0, 0, Math.PI / 2]));
    b.then(0.15);
    k.fits(HW.camScrew, [...boltAt(-1), ...boltAt(1)]);
  });
  const lift: Vec3 = [340, 0, 0];
  const place = (key: string, from: Vec3) => {
    const p = b.partItem(key).final;
    if (scene === "ext") b.stage(key, [p.pos[0], p.pos[1] + sh, p.pos[2]], p.rot, from);
    else b.add(key, from);
  };
  k.step({ title: "Lay one side down and push on the top and back panel", detail: "Cam bolts facing up, the back panel along the back edge.", kind: "join", scene, pose: "+x", warnings: ["floor"] }, () => {
    place(sideL, [0, 0, 0]);
    b.then(0.15);
    place(top, lift);
    place(back, lift);
  });
  k.step({ title: "Lower the other side on", detail: "Every dowel and bolt into its hole.", kind: "join", scene, pose: "+x" }, () => place(sideR, [400, 0, 0]));
  k.step({ title: "Turn the back panel's cam locks", detail: "The two small ones, one at each end. Turn them by hand with a screwdriver, not a drill.", kind: "cams", tools: ["screwdriver"], scene, pose: "+x" }, () =>
    k.fits(named(b, { kind: "cam", len: 10, dia: 12 }, "Cam lock for the back"), [-1, 1].map((sx) => ({ on: back, at: [sx * (Wi / 2 - 22), y0 + EH / 2, zb + BT] as Vec3, dir: [0, 0, -1] as Vec3 }))),
  );
  k.step({ title: "Turn the top's cam locks", detail: "Four, two at each end, until they pull the sides tight.", kind: "cams", tools: ["screwdriver"], scene, pose: "+x" }, () =>
    k.fits(HW.cam, [-1, 1].flatMap((sx) => [zt - dz + 30, zt + dz - 30].map((z) => ({ on: top, at: [sx * (Wi / 2 - 25), yT - T / 2, z] as Vec3, dir: [0, 1, 0] as Vec3 })))),
  );
  k.step({ title: "Screw the back panel to the top", detail: "One long screw through the back panel, in the middle, into the edge of the top.", kind: "screws", tools: ["screwdriver"], scene, pose: "+x" }, () =>
    k.fits({ kind: "screw", len: 40, dia: 4 }, [{ on: back, at: [0, yT, zb], dir: [0, 0, 1], mate: top }]),
  );
  const xs = [-1, 1].map((sx) => sx * (Wi / 2 - 60));
  const yTop = y0 + EH;
  k.step({ title: "Stand it up and screw the wall brackets onto it", detail: "Two brackets at the back of the top, a washer under each screw.", kind: "screws", tools: ["screwdriver"], scene }, () => {
    if (scene === "ext") for (const key of [sideL, sideR, top, back]) place(key, [0, 0, 0]);
    b.then(0.1);
    k.fits(HW.bracket, xs.map((x) => ({ on: top, at: [x, yTop, zb + 22] as Vec3, dir: [0, -1, 0] as Vec3, travel: 60 })));
    k.fits(HW.washer, xs.map((x) => ({ on: top, at: [x, yTop + 2, zb + 46] as Vec3, dir: [0, -1, 0] as Vec3, hole: false as const })));
    k.fits(HW.screwS, xs.map((x) => ({ on: top, at: [x, yTop + 3, zb + 46] as Vec3, dir: [0, -1, 0] as Vec3 })));
  });
  // two small cam bolts into the tops of the bookcase sides, then the extension goes on and two cam locks hold it
  const zf = zb + D - 50;
  k.step(
    { title: f ? "Screw the short cam bolts into the bookcase" : "Screw the short cam bolts into your bookcase", detail: "Into the holes at the front of the top of each side. These are the short bolts, not the long ones.", kind: "cams", tools: ["screwdriver"] },
    () => k.fits(named(b, { kind: "camScrew", len: 24, dia: 6 }, "Short cam bolt"), [-1, 1].map((sx) => ({ on: f ? (sx < 0 ? f.sideL : f.sideR) : sx < 0 ? sideL : sideR, at: [sx * (W / 2 - T / 2), y0, zf] as Vec3, dir: [0, -1, 0] as Vec3 }))),
  );
  k.step({ title: "Lift the extension on and lock it", detail: "Set it straight down onto the bolts, then turn the two cam locks inside the sides.", kind: "cams", tools: ["screwdriver"], people: f && u.H === 2020 ? 2 : 1 }, () => {
    if (f) {
      b.stagger(0);
      for (const key of [sideL, sideR, top, back]) b.add(key, [0, 320, 0]);
      b.then(0.2);
    }
    k.fits(HW.cam, [-1, 1].map((sx) => ({ on: sx < 0 ? sideL : sideR, at: [sx * (Wi / 2), y0 + 25, zf] as Vec3, dir: [sx, 0, 0] as Vec3 })));
  });
  k.step({ title: "Screw the brackets to the wall", detail: `A washer under each screw. ${WALL_DETAIL}`, kind: "anchor", tools: ["screwdriver", "drill", "pencil"], wall: true, people: f ? 2 : 1, warnings: ["wall", "tip"] }, () =>
    wallFits(k, top, yTop, zb, xs, "wall-only"),
  );
  return { top, sideL, sideR, yTop };
}

/* ---------- doors ---------- */

function doorPieces(d: Door, mid: number | null): PartPiece[] {
  const fw = d.style === "hogbo" ? 28 : 55;
  const { w, h } = d;
  const P = (size: Vec3, pos: Vec3, material?: PartMaterial): PartPiece => ({ shape: "box", size, pos, ...(material ? { material } : {}) });
  const out: PartPiece[] = [
    P([fw, h, DT], [-w / 2 + fw / 2, 0, 0]),
    P([fw, h, DT], [w / 2 - fw / 2, 0, 0]),
    P([w - 2 * fw, fw, DT], [0, h / 2 - fw / 2, 0]),
    P([w - 2 * fw, fw, DT], [0, -h / 2 + fw / 2, 0]),
  ];
  if (mid !== null) out.push(P([w - 2 * fw, fw, DT], [0, mid, 0]));
  const inner = (y0: number, y1: number, material?: PartMaterial) => out.push(P([w - 2 * fw + 4, y1 - y0, 8], [0, (y0 + y1) / 2, -3], material));
  const lo = -h / 2 + fw, hi = h / 2 - fw;
  if (d.style === "solid") inner(lo, hi);
  if (d.style === "bamboo") inner(lo, hi, "wood");
  if (d.style === "panelglass") inner(lo, mid ?? 0);
  return out;
}

function doorKit(k: Kit, u: Unit, f: Frame, sides: { L: string; R: string; yTop: number; top: string; xL?: string; xR?: string }, doors: Door[], kit: KitKind, yFixed: number, kitIndex: { i: number; n: number }) {
  if (!doors.length) return;
  const { b } = k;
  const { W, D, zb } = u;
  const Wi = W - 2 * T;
  const zd = zb + D + DT / 2;
  const n = doors.length;
  const tall = doors[0].h > 1500;
  const nh = tall ? 3 : 2;
  const keys = doors.map((d) => {
    const mid = tall ? yFixed - (d.y0 + d.h / 2) : null;
    return k.part(d.style === "hogbo" ? "Glass door" : d.style === "glass" ? (d.h < 500 ? "Small glass door" : "Glass door") : "Door", [d.w, d.h, DT], [d.x, d.y0 + d.h / 2, zd], { pieces: doorPieces(d, mid) });
  });
  const hingeYs = (d: Door) => (nh === 3 ? [d.y0 + 110, d.y0 + d.h / 2 + (yFixed - (d.y0 + d.h / 2)) - 60, d.y0 + d.h - 110] : [d.y0 + 100, d.y0 + d.h - 100]);
  const hx = (d: Door) => (d.hingeLeft ? d.x - d.w / 2 + 24 : d.x + d.w / 2 - 24);
  const fx = (d: Door) => (d.hingeLeft ? d.x + d.w / 2 - 30 : d.x - d.w / 2 + 30);
  const what = many(n, "the door", "the doors");

  const PLATE = () => named(b, { kind: "plate", len: 10, dia: 45 }, "Mounting plate");
  const COVER = () => named(b, { kind: "cap", len: 3, dia: 36 }, "Hole cover");
  const BUMPER = () => named(b, { kind: "glide", len: 3, dia: 10 }, "Bumper");
  const KNOB: HwDef = { kind: "knob", len: 22, dia: 22 };
  const KNOBSCREW: HwDef = { kind: "screw", len: 30, dia: 4 };

  if (kit !== "billy") {
    // every door kit brings one more bracket for the top
    const xs = doors.map((_, i) => {
      const j = kitIndex.i + i;
      return Math.round((((j + 1) / (kitIndex.n + 1)) - 0.5) * (Wi - 200));
    });
    kitIndex.i += n;
    k.step(
      { title: many(n, "Fit the door's wall bracket", "Fit the doors' wall brackets"), detail: `The door kit has its own bracket: screw it to the top with a washer, then to the wall. ${WALL_DETAIL}`, kind: "anchor", tools: ["screwdriver", "drill", "pencil"], wall: true, warnings: ["wall", "tip"] },
      () => wallFits(k, sides.top, sides.yTop, zb, xs, "top-first"),
    );
  }
  const zPlate = zb + D - 37;
  const plates: FitOpts[] = doors.flatMap((d) => hingeYs(d).map((y) => ({ on: y > u.H && sides.xL ? (d.hingeLeft ? sides.xL : sides.xR!) : d.hingeLeft ? sides.L : sides.R, at: [d.hingeLeft ? -Wi / 2 : Wi / 2, y, zPlate] as Vec3, dir: [d.hingeLeft ? -1 : 1, 0, 0] as Vec3 })));
  k.step(
    { title: "Screw the mounting plates to the " + many(n, "side", "sides"), detail: kit === "hogbo" ? "Into the front holes, the screws come fitted." : "Two screws in each, into the front row of holes at the hinge heights.", kind: "hinges", tools: ["screwdriver"] },
    () => {
      k.fits(PLATE(), plates);
      if (kit !== "hogbo") k.fits({ kind: "screw", len: 13, dia: 4 }, plates.flatMap((p) => [-16, 16].map((dy) => ({ ...p, at: [p.at[0], p.at[1] + dy, p.at[2]] as Vec3, hole: false as const }))));
    },
  );
  const zBack = zd - DT / 2;
  const stage = () => {
    b.stagger(0.15);
    keys.forEach((key, i) => b.stage(key, [(i - (n - 1) / 2) * (doors[i].w + 90), DT / 2, 0], [Math.PI / 2, 0, 0]));
    b.then(0.15);
  };
  const hinges: FitOpts[] = doors.flatMap((d, i) => hingeYs(d).map((y) => ({ on: keys[i], at: [hx(d), y, zBack] as Vec3, dir: [0, 0, 1] as Vec3, twist: d.hingeLeft ? 0 : Math.PI })));
  if (kit === "hogbo") {
    k.step({ title: "Press the hinges into " + what, detail: "Lay it face down on a rug. Each hinge clicks into its hole.", kind: "hinges", scene: "doors", warnings: ["floor"] }, () => {
      stage();
      k.fits(HW.hinge, hinges);
    });
    k.step({ title: "Fit the glass into " + what, detail: "Lay the glass in the frame and turn the eight clips over its edge.", kind: "general", scene: "doors" }, () =>
      k.fits(
        named(b, { kind: "clip", len: 12, dia: 10 }, "Glass clip"),
        doors.flatMap((d, i) => [-1, 1].flatMap((sx) => [0.2, 0.4, 0.6, 0.8].map((t) => ({ on: keys[i], at: [d.x + sx * (d.w / 2 - 34), d.y0 + d.h * t, zBack] as Vec3, dir: [0, 0, 1] as Vec3, hole: false as const })))),
      ),
    );
  } else
    k.step(
      {
        title: "Screw the hinges onto " + what,
        detail: kit === "oxberg" && tall ? "Lay it face down on a rug. Press the covers into the hinge holes on the other edge, then two screws in each hinge." : "Lay it face down on a rug. Two screws in each hinge.",
        kind: "hinges",
        tools: ["screwdriver"],
        scene: "doors",
        warnings: ["floor"],
      },
      () => {
        stage();
        if (kit === "oxberg" && tall) k.fits(COVER(), doors.flatMap((d, i) => hingeYs(d).map((y) => ({ on: keys[i], at: [fx(d) + (d.hingeLeft ? 6 : -6), y, zBack] as Vec3, dir: [0, 0, 1] as Vec3, hole: false as const }))));
        k.fits(HW.hinge, hinges);
        k.fits({ kind: "screw", len: 12, dia: 3.5 }, hinges.flatMap((h) => [-14, 14].map((dy) => ({ ...h, at: [h.at[0] + (doors[0].hingeLeft ? 10 : -10), h.at[1] + dy, h.at[2]] as Vec3, hole: false as const }))));
      },
    );
  k.step({ title: many(n, "Clip the door onto the plates", "Clip the doors onto the plates"), detail: "Hook each hinge over its plate and press until it clicks, then tighten the screw on the plate.", kind: "doors", tools: ["screwdriver"] }, () => {
    b.stagger(0.3);
    for (const key of keys) b.add(key, [0, 0, 360]);
  });
  const kn = (d: Door) => (tall ? yFixed : d.y0 + d.h / 2);
  if (kit === "hogbo") {
    k.step({ title: "Fit the door stop and the bumpers", detail: "The stop clips onto the edge of the shelf behind the doors. Stick the bumpers on inside.", kind: "general" }, () => {
      k.fits(named(b, { kind: "clip", len: 20, dia: 24 }, "Door stop"), [{ on: f.sideR, at: [0, doors[0].y0 + doors[0].h - 30, zb + D - 6], dir: [0, 0, -1], hole: false }]);
      k.fits(BUMPER(), doors.map((d, i) => ({ on: keys[i], at: [fx(d), d.y0 + 40, zBack] as Vec3, dir: [0, 0, 1] as Vec3, hole: false as const })));
    });
  } else {
    k.step({ title: many(n, "Screw on the knob", "Screw on the knobs"), detail: "The screw goes in from the back of the door.", kind: "screws", tools: ["screwdriver"] }, () => {
      k.fits(KNOB, doors.map((d, i) => ({ on: keys[i], at: [fx(d), kn(d), zd + DT / 2] as Vec3, dir: [0, 0, -1] as Vec3, hole: false as const })));
      k.fits(KNOBSCREW, doors.map((d, i) => ({ on: keys[i], at: [fx(d), kn(d), zBack] as Vec3, dir: [0, 0, 1] as Vec3 })));
    });
    k.step({ title: "Stick on the bumpers", detail: "On the back of each door near the free edge, so it closes softly. Then adjust the hinges until the gaps are even.", kind: "general" }, () =>
      k.fits(BUMPER(), doors.flatMap((d, i) => (tall ? [d.y0 + 40, kn(d) + 60, d.y0 + d.h - 40] : [d.y0 + 40, d.y0 + d.h - 40]).map((y) => ({ on: keys[i], at: [fx(d), y, zBack] as Vec3, dir: [0, 0, 1] as Vec3, hole: false as const })))),
    );
  }
}

/* ---------- the drawer on castors ---------- */

function drawerKit(k: Kit, u: Unit, f: Frame) {
  const { b } = k;
  const { W, D, zb } = u;
  const Wi = W - 2 * T;
  const bw = Wi - 30, bd = D - 40, bh = 160, dt = 15;
  const by = PL + T + 6;
  const zf = zb + D + DT / 2;
  const fy0 = 40, fh = by + bh + 20 - fy0;
  const front = k.part("Drawer front", [W - 4, fh, DT], [0, fy0 + fh / 2, zf]);
  const zbox = zb + D - bd / 2 - 2;
  const sL = k.part("Drawer side", [dt, bh, bd], [-bw / 2 + dt / 2, by + bh / 2, zbox]);
  const sR = k.part("Drawer side", [dt, bh, bd], [bw / 2 - dt / 2, by + bh / 2, zbox]);
  const back = k.part("Drawer back", [bw - 2 * dt, bh - 20, 8], [0, by + (bh - 20) / 2 + 12, zbox - bd / 2 + 20], { material: "fiber" });
  const bottom = k.part("Drawer bottom", [bw, 12, bd], [0, by + 6, zbox]);
  void bottom;

  const xs = [-1, 1].map((sx) => sx * (Wi / 2 - 60));
  k.step({ title: "Fix the bookcase to the wall", detail: `With the two brackets from the drawer kit, a washer under each screw. ${WALL_DETAIL}`, kind: "anchor", tools: ["screwdriver", "drill", "pencil"], wall: true, people: u.H === 2020 ? 2 : 1, warnings: ["wall", "tip"] }, () =>
    wallFits(k, f.top, u.H, zb, xs, "top-first"),
  );
  const ry = by + bh / 2;
  k.step({ title: "Screw the rails to the sides", detail: "Just above the bottom, two screws in each. Use the holes marked in the drawing, the same height on both sides.", kind: "runners", tools: ["screwdriver"] }, () => {
    k.fits(named(b, { kind: "runner", len: bd - 20, dia: 30 }, "Drawer rail"), [-1, 1].map((sx) => ({ on: sx < 0 ? f.sideL : f.sideR, at: [(sx * Wi) / 2, ry, zbox] as Vec3, dir: [sx, 0, 0] as Vec3, hole: false as const })));
    k.fits({ kind: "screw", len: 12, dia: 4 }, [-1, 1].flatMap((sx) => [zbox - bd / 3, zbox + bd / 3].map((z) => ({ on: sx < 0 ? f.sideL : f.sideR, at: [(sx * Wi) / 2, ry, z] as Vec3, dir: [sx, 0, 0] as Vec3 }))));
  });
  // the drawer is built standing on its front on a rug
  const scene = "drawer";
  const pose: Pose = "-z";
  const sh = (key: string, from?: Vec3) => {
    const p = b.partItem(key).final;
    b.stage(key, p.pos, p.rot, from);
  };
  k.step({ title: "Screw the cam bolts into the drawer front", detail: "Lay it face down on a rug, four bolts into the holes inside.", kind: "cams", tools: ["screwdriver"], scene, pose, warnings: ["floor"] }, () => {
    sh(front, [0, 0, 300]);
    b.then(0.15);
    k.fits(HW.camScrew, [-1, 1].flatMap((sx) => [by + 30, by + bh - 30].map((y) => ({ on: front, at: [sx * (bw / 2 - dt / 2), y, zf - DT / 2] as Vec3, dir: [0, 0, 1] as Vec3, mate: sx < 0 ? sL : sR }))));
  });
  k.step({ title: "Tap in the dowels and push on the drawer sides", detail: "Two dowels in each, then the sides onto the front with the grooves facing in.", kind: "dowels", tools: ["hammer"], scene, pose }, () => {
    k.fits(HW.dowel, [-1, 1].flatMap((sx) => [by + bh / 2 - 20, by + bh / 2 + 20].map((y) => ({ on: front, at: [sx * (bw / 2 - dt / 2), y, zf - DT / 2] as Vec3, dir: [0, 0, 1] as Vec3, mate: sx < 0 ? sL : sR }))));
    sh(sL, [0, 0, -300]);
    sh(sR, [0, 0, -300]);
  });
  k.step({ title: "Turn the cam locks in the drawer sides", detail: "Four, two in each side, until they pull tight.", kind: "cams", tools: ["screwdriver"], scene, pose }, () =>
    k.fits(HW.cam, [sL, sR].flatMap((key, i) => [by + 30, by + bh - 30].map((y) => ({ on: key, at: [(i ? 1 : -1) * (bw / 2 - dt), y, zf - DT / 2 - 25] as Vec3, dir: [i ? 1 : -1, 0, 0] as Vec3 })))),
  );
  k.step({ title: "Slide in the drawer back", detail: "Down into the grooves in the sides.", kind: "join", scene, pose }, () => sh(back, [0, 0, -300]));
  k.step({ title: "Tap the dowels into the drawer bottom and lay it on", detail: "Two dowels in each end, then lower it onto the sides.", kind: "dowels", tools: ["hammer"], scene, pose }, () => {
    k.fits(HW.dowel, [-1, 1].flatMap((sx) => [zbox - bd / 4, zbox + bd / 4].map((z) => ({ on: bottom, at: [sx * (bw / 2 - dt / 2), by, z] as Vec3, dir: [0, 1, 0] as Vec3, mate: sx < 0 ? sL : sR }))));
    sh(bottom, [0, -260, 0]);
  });
  k.step({ title: "Push in the bolts and turn the cam locks", detail: "Four bolts into the sides, then four cam locks in the bottom.", kind: "cams", tools: ["screwdriver"], scene, pose }, () => {
    k.fits(named(b, { kind: "camScrew", len: 30, dia: 6 }, "Push-in bolt"), [-1, 1].flatMap((sx) => [zbox - bd / 3, zbox + bd / 3].map((z) => ({ on: sx < 0 ? sL : sR, at: [sx * (bw / 2 - dt / 2), by + 12, z] as Vec3, dir: [0, 1, 0] as Vec3, mate: bottom }))));
    k.fits(HW.cam, [-1, 1].flatMap((sx) => [zbox - bd / 3, zbox + bd / 3].map((z) => ({ on: bottom, at: [sx * (bw / 2 - dt - 22), by, z] as Vec3, dir: [0, 1, 0] as Vec3 }))));
  });
  k.step({ title: "Turn it over and screw on the castors", detail: "One at each bottom corner of the front, two screws in each.", kind: "legs", tools: ["screwdriver"], scene, pose: "-y" }, () => {
    const at = [-1, 1].map((sx) => [sx * (W / 2 - 60), 0, zf] as Vec3);
    k.fits(HW.castor, at.map((p) => ({ on: front, at: [p[0], fy0, p[2]] as Vec3, dir: [0, 1, 0] as Vec3, hole: false as const })));
    k.fits({ kind: "screw", len: 16, dia: 4 }, at.flatMap((p) => [-12, 12].map((dx) => ({ on: front, at: [p[0] + dx, fy0, p[2]] as Vec3, dir: [0, 1, 0] as Vec3 }))));
  });
  k.step({ title: "Pull the rails out and set the drawer on them", detail: "Rest the drawer's sides on both rails, then push it in.", kind: "drawer" }, () => {
    b.stagger(0);
    for (const key of [front, sL, sR, back, bottom]) b.add(key, [0, 0, 380]);
  });
  k.step({ title: "Screw the rails to the drawer", detail: "One screw through each rail into the drawer side.", kind: "screws", tools: ["screwdriver"] }, () =>
    k.fits({ kind: "screw", len: 12, dia: 4.5 }, [-1, 1].map((sx) => ({ on: sx < 0 ? sL : sR, at: [sx * (bw / 2), ry, zbox + bd / 2 - 40] as Vec3, dir: [-sx, 0, 0] as Vec3 }))),
  );
}

/* ---------- the bookcase with a foldable table ---------- */

/**
 * Its own manual, in two bags. The bookcase: a shelf box (top, fixed shelf and a board back between them) is
 * built first, then it and a low back rail stand on one side lying on the floor and the other side goes on; it is
 * fixed to the wall with two brackets under the fixed shelf. The rolling unit is a small open bookcase built the
 * same way on its side, with a hardboard back held by push pins, castors at the front and back and a castor arm
 * underneath. The table is two boards hinged together: rollers on the back board run in curved tracks in the
 * bookcase sides, the front board is the unit's top. Drawn unfolded, as in the photo.
 */
function foldTable(k: Kit): boolean {
  const { b } = k;
  const W = 800, H = 1060, D = 325;
  const Wi = W - 2 * T, xi = Wi / 2;
  const zbk = -D / 2;
  const sx2 = [-1, 1];

  // the bookcase
  const sideL = k.part("Side", [T, H, D], [-W / 2 + T / 2, H / 2, 0]);
  const sideR = k.part("Side", [T, H, D], [W / 2 - T / 2, H / 2, 0]);
  const yTop = H - T / 2, ySh = 790;
  const top = k.part("Top", [Wi, T, D], [0, yTop, 0]);
  const shelf = k.part("Fixed shelf", [Wi, T, D], [0, ySh, 0]);
  const bY0 = ySh + T / 2, bY1 = H - T, zB = zbk + T / 2;
  const back = k.part("Shelf back", [Wi, bY1 - bY0, T], [0, (bY0 + bY1) / 2, zB]);
  const rail = k.part("Bottom rail", [Wi, PL, T], [0, PL / 2, zB]);

  // the rolling unit, in front of the bookcase with the table unfolded
  const UW = 760, UWi = UW - 2 * T, ux = UW / 2 - T / 2;
  const uB = 659, uF = 939; // back (hardboard) and front
  const uD = uF - (uB + 3), uz = (uB + 3 + uF) / 2;
  const uTop = 728, uBot = 20;
  const uSideL = k.part("Unit side", [T, uTop - uBot, uD], [-ux, (uTop + uBot) / 2, uz]);
  const uSideR = k.part("Unit side", [T, uTop - uBot, uD], [ux, (uTop + uBot) / 2, uz]);
  const rY0 = 58, zR = uF - 20 - T / 2, yR = rY0 + PL / 2;
  const uRail = k.part("Castor rail", [UWi, PL, T], [0, yR, zR]);
  const uBY = rY0 + PL + T / 2, uSY = 430;
  const uBottom = k.part("Unit bottom", [UWi, T, uD], [0, uBY, uz]);
  const uShelf = k.part("Unit shelf", [UWi, T, uD], [0, uSY, uz]);
  const uBackP = k.part("Unit back", [UW, uTop - (uBY - T / 2), 3], [0, (uTop + uBY - T / 2) / 2, uB + 1.5], { material: "fiber" });

  // the table: the back board's rollers sit just inside the bookcase sides, the front board is the unit's top
  const yT = uTop + T / 2, lz0 = 140;
  const leaf = k.part("Table back board", [UW, T, uB - lz0], [0, yT, (lz0 + uB) / 2]);
  const front = k.part("Table front board", [UW, T, uF - uB], [0, yT, (uB + uF) / 2]);

  const SCREW: HwDef = { kind: "screw", len: 12, dia: 5 };
  const SMALL_DOWEL: HwDef = { kind: "dowel", len: 25, dia: 6 };
  const BOLT: HwDef = { kind: "bolt", len: 12, dia: 6 };
  const BRAKE: HwDef = { kind: "castor", len: 58, dia: 50, name: "Castor with brake" };
  const WHEEL: HwDef = { kind: "castor", len: 58, dia: 44, name: "Back wheel" };
  const ARM: HwDef = { kind: "castor", len: uBY - T / 2, dia: 60, name: "Castor arm" };
  const ROLLER: HwDef = { kind: "plate", len: 4, dia: 50, name: "Roller plate" };
  const WALLPLATE: HwDef = { kind: "plate", len: 3, dia: 40, name: "Wall plate" };
  const COVER: HwDef = { kind: "cap", len: 30, dia: 50, name: "Bracket cover" };
  const PLUG: HwDef = { kind: "plug", len: 20, dia: 6, name: "Expanding plug" };
  const PUSH: HwDef = { kind: "pin", len: 22, dia: 4, name: "Locking pin" };

  // a sub-assembly built in its own scene sits where it ends up, moved to the middle of that scene
  const put = (key: string, shift: Vec3, from?: Vec3) => {
    const p = b.partItem(key).final;
    b.stage(key, [p.pos[0] + shift[0], p.pos[1] + shift[1], p.pos[2] + shift[2]], p.rot, from);
  };
  const flatRow = (list: [string, Vec3][]) => {
    b.stagger(0.12);
    list.forEach(([key, rot], i) => b.stage(key, [0, T / 2, (i - (list.length - 1) / 2) * 420], rot));
    b.then(0.15);
  };
  const FLAT: Vec3 = [0, 0, 0], UPRIGHT: Vec3 = [Math.PI / 2, 0, 0], SIDEWAYS: Vec3 = [0, 0, Math.PI / 2];
  const ends = (key: string, half: number, y: number, zs: number[], def: HwDef = HW.dowel): void =>
    k.fits(def, sx2.flatMap((sx) => zs.map((z) => ({ on: key, at: [sx * half, y, z] as Vec3, dir: [-sx, 0, 0] as Vec3 }))));

  /* bag 1: the bookcase */
  const dz = D / 2 - 35, bz = D / 2 - 75;
  const yBk = [bY0 + 32, bY1 - 32], yBkBolt = [bY0 + 82, bY1 - 82];
  const xEdge = [-150, 150], xEdgeBolt = [-250, 250];
  k.step({ title: "Tap the dowels into the top, the fixed shelf and the shelf back", detail: "Two into each end of all three, and two into each long edge of the shelf back.", kind: "dowels", tools: ["hammer"], scene: "pieces", warnings: ["floor"] }, () => {
    flatRow([[top, FLAT], [shelf, FLAT], [back, UPRIGHT]]);
    ends(top, xi, yTop, [-dz, dz]);
    ends(shelf, xi, ySh, [-dz, dz]);
    k.fits(HW.dowel, [
      ...sx2.flatMap((sx) => yBk.map((y) => ({ on: back, at: [sx * xi, y, zB] as Vec3, dir: [-sx, 0, 0] as Vec3 }))),
      ...xEdge.map((x) => ({ on: back, at: [x, bY1, zB] as Vec3, dir: [0, -1, 0] as Vec3 })),
      ...xEdge.map((x) => ({ on: back, at: [x, bY0, zB] as Vec3, dir: [0, 1, 0] as Vec3 })),
    ]);
  });
  k.step({ title: "Screw the cam bolts into the top and the fixed shelf", detail: "Two into each, in the holes near the back edge. Turn them in until they stop.", kind: "cams", tools: ["screwdriver"], scene: "pieces" }, () =>
    k.fits(HW.camScrew, [
      ...xEdgeBolt.map((x) => ({ on: top, at: [x, bY1, zB] as Vec3, dir: [0, 1, 0] as Vec3, mate: back })),
      ...xEdgeBolt.map((x) => ({ on: shelf, at: [x, bY0, zB] as Vec3, dir: [0, -1, 0] as Vec3, mate: back })),
    ]),
  );
  const box: Vec3 = [0, -(bY0 - T), 0];
  k.step({ title: "Stand the shelf back on the fixed shelf", detail: "Along its back edge, onto the two dowels and the two cam bolts.", kind: "join", scene: "box" }, () => {
    put(shelf, box);
    b.then(0.15);
    put(back, box, [0, 300, 0]);
  });
  k.step({ title: "Lower the top onto the shelf back", detail: "One of you at each end, every dowel and bolt into its hole.", kind: "join", scene: "box", people: 2 }, () => put(top, box, [0, 300, 0]));
  k.step({ title: "Turn the cam locks in the shelf back", detail: "Four, two at the top and two at the bottom. Then turn the box over.", kind: "cams", tools: ["screwdriver"], scene: "box" }, () =>
    k.fits(HW.cam, [bY1 - 25, bY0 + 25].flatMap((y) => xEdgeBolt.map((x) => ({ on: back, at: [x, y, zB + T / 2] as Vec3, dir: [0, 0, -1] as Vec3 })))),
  );

  // each side takes seven cam bolts: two each for the top and the fixed shelf, two for the shelf back, one for the rail
  const yRailBolt = 38, yRailDowel = 16;
  const joints: { piece: string; y: number; z: number; lock: (sx: number) => FitOpts }[] = [];
  for (const [piece, y] of [[top, yTop], [shelf, ySh]] as const)
    for (const z of [-bz, bz]) joints.push({ piece, y, z, lock: (sx) => ({ on: piece, at: [sx * (xi - 25), y - T / 2, z], dir: [0, 1, 0] }) });
  for (const y of yBkBolt) joints.push({ piece: back, y, z: zB, lock: (sx) => ({ on: back, at: [sx * (xi - 25), y, zB + T / 2], dir: [0, 0, -1] }) });
  joints.push({ piece: rail, y: yRailBolt, z: zB, lock: (sx) => ({ on: rail, at: [sx * (xi - 25), yRailBolt, zB + T / 2], dir: [0, 0, -1] }) });
  const bolts = (sx: number): FitOpts[] => joints.map((j) => ({ on: sx < 0 ? sideL : sideR, at: [sx * xi, j.y, j.z] as Vec3, dir: [sx, 0, 0] as Vec3, mate: j.piece }));
  const locks = (sx: number) => k.fits(HW.cam, joints.map((j) => j.lock(sx)));

  k.step({ title: "Screw the cam bolts into both sides", detail: "Seven into each side. Turn them in until they stop.", kind: "cams", tools: ["screwdriver"], scene: "sides" }, () => {
    flatRow([[sideL, SIDEWAYS], [sideR, SIDEWAYS]]);
    k.fits(HW.camScrew, [...bolts(-1), ...bolts(1)]);
  });
  const up: Vec3 = [420, 0, 0];
  k.step({ title: "Lay one side down and stand the shelf box on it", detail: "At the top end of the side, the shelf back along the back edge.", kind: "join", pose: "+x", warnings: ["floor"] }, () => {
    b.add(sideL, [0, 0, 0]);
    b.then(0.15);
    b.stagger(0);
    for (const key of [shelf, back, top]) b.add(key, up);
  });
  k.step({ title: "Tap the dowels into the bottom rail", detail: "One into each end.", kind: "dowels", tools: ["hammer"], scene: "rail", warnings: ["floor"] }, () => {
    flatRow([[rail, UPRIGHT]]);
    ends(rail, xi, yRailDowel, [zB]);
  });
  k.step({ title: "Stand the bottom rail on the side", detail: "At the bottom end, along the back edge.", kind: "join", pose: "+x" }, () => b.add(rail, up));
  k.step({ title: "Turn the cam locks", detail: "Seven, arrow towards the bolt, then clockwise until each piece pulls tight to the side.", kind: "cams", tools: ["screwdriver"], pose: "+x" }, () => locks(-1));
  k.step({ title: "Lower the other side on", detail: "Guide every dowel and cam bolt into its hole, then press it down evenly.", kind: "join", pose: "+x" }, () => b.add(sideR, [460, 0, 0]));
  k.step({ title: "Turn the other cam locks", detail: "All seven, the same way as on the first side.", kind: "cams", tools: ["screwdriver"], pose: "+x" }, () => locks(1));

  const yBr = 750, zBr = zbk + 28;
  k.step(
    { title: "Stand it against the wall and screw on the brackets", detail: "One inside each side, just under the fixed shelf at the back, with two screws.", kind: "screws", tools: ["screwdriver"], wall: true },
    () => {
      k.fits(named(b, HW.bracket, "Wall bracket"), sx2.map((sx) => ({ on: sx < 0 ? sideL : sideR, at: [sx * xi, yBr, zBr] as Vec3, dir: [sx, 0, 0] as Vec3, hole: false as const })));
      k.fits(SCREW, sx2.flatMap((sx) => [zBr - 12, zBr + 12].map((z) => ({ on: sx < 0 ? sideL : sideR, at: [sx * xi, yBr, z] as Vec3, dir: [sx, 0, 0] as Vec3 }))));
    },
  );
  k.step(
    { title: "Fix the brackets to the wall", detail: `A wall plate on each bracket, then a screw through it into the wall. Use pan head screws. ${WALL_DETAIL}`, kind: "anchor", tools: ["drill", "screwdriver", "pencil"], wall: true, warnings: ["wall", "tip"] },
    () => {
      const at = (sx: number, dzz: number): FitOpts => ({ on: sx < 0 ? sideL : sideR, at: [sx * (xi - 20), yBr, zbk + dzz], dir: [0, 0, -1], hole: false });
      k.fits(WALLPLATE, sx2.map((sx) => at(sx, 4)));
      k.fits(HW.plug, sx2.map((sx) => at(sx, 0)));
      k.fits(HW.wallScrew, sx2.map((sx) => at(sx, 6)));
    },
  );
  k.step({ title: "Clip the covers over the brackets", detail: "One on each, pressed on until it sits flat.", kind: "general", wall: true }, () =>
    k.fits(COVER, sx2.map((sx) => ({ on: sx < 0 ? sideL : sideR, at: [sx * (xi - 20), yBr, zBr], dir: [sx, 0, 0] as Vec3, hole: false as const }))),
  );

  /* bag 2: the rolling unit */
  const uh = UWi / 2;
  const udz = [uz - 105, uz + 105], ubz = [uz - 65, uz + 65];
  const topDowelZ = [uz - 40, uz + 40], topBoltZ = [uz - 95, uz + 95];
  const ushift: Vec3 = [0, 0, -uz];
  const sideTopDowels = (side: string, sx: number) => k.fits(HW.dowel, topDowelZ.map((z) => ({ on: side, at: [sx * ux, uTop, z] as Vec3, dir: [0, -1, 0] as Vec3 })));
  const uJoints: { piece: string; y: number; z: number; lock: (sx: number) => FitOpts }[] = [];
  for (const [piece, y, face] of [[uBottom, uBY, -1], [uShelf, uSY, 1]] as const)
    for (const z of ubz) uJoints.push({ piece, y, z, lock: (sx) => ({ on: piece, at: [sx * (uh - 25), y - (face * T) / 2, z], dir: [0, face, 0] }) });
  uJoints.push({ piece: uRail, y: yR, z: zR, lock: (sx) => ({ on: uRail, at: [sx * (uh - 25), yR, zR - T / 2], dir: [0, 0, 1] }) });
  const uBolts = (sx: number) => k.fits(HW.camScrew, uJoints.map((j) => ({ on: sx < 0 ? uSideL : uSideR, at: [sx * uh, j.y, j.z] as Vec3, dir: [sx, 0, 0] as Vec3, mate: j.piece })));
  const uLocks = (sx: number) => k.fits(HW.cam, uJoints.map((j) => j.lock(sx)));

  k.step({ title: "Tap the dowels into the unit's bottom, shelf and one side", detail: "Two into each end of the bottom and the shelf, two into the top end of the side.", kind: "dowels", tools: ["hammer"], scene: "unit-a", warnings: ["floor"] }, () => {
    flatRow([[uBottom, FLAT], [uShelf, FLAT], [uSideL, SIDEWAYS]]);
    ends(uBottom, uh, uBY, udz);
    ends(uShelf, uh, uSY, udz);
    sideTopDowels(uSideL, -1);
  });
  k.step({ title: "Screw the cam bolts into that side", detail: "Five: two for the bottom, two for the shelf and one for the castor rail.", kind: "cams", tools: ["screwdriver"], scene: "unit-a" }, () => uBolts(-1));
  const uup: Vec3 = [380, 0, 0];
  k.step({ title: "Lay the side down and stand the bottom and shelf on it", detail: "Cam bolts facing up, the cam lock holes towards the open front.", kind: "join", scene: "unit", pose: "+x", warnings: ["floor"] }, () => {
    put(uSideL, ushift);
    b.then(0.15);
    put(uBottom, ushift, uup);
    put(uShelf, ushift, uup);
  });
  k.step({ title: "Tap the small dowels into the castor rail", detail: "Two into each end. These are the short, thin dowels.", kind: "dowels", tools: ["hammer"], scene: "unit-rail", warnings: ["floor"] }, () => {
    flatRow([[uRail, UPRIGHT]]);
    k.fits(SMALL_DOWEL, sx2.flatMap((sx) => [yR - 20, yR + 20].map((y) => ({ on: uRail, at: [sx * uh, y, zR] as Vec3, dir: [-sx, 0, 0] as Vec3 }))));
  });
  const cx = uh - 45;
  k.step({ title: "Bolt the castors with brakes onto the rail", detail: "One at each end, two bolts in each. Tighten them with the Allen key.", kind: "legs", tools: ["allen"], scene: "unit-rail" }, () => {
    k.fits(BRAKE, sx2.map((sx) => ({ on: uRail, at: [sx * cx, rY0, zR] as Vec3, dir: [0, 1, 0] as Vec3, hole: false as const })));
    k.fits(BOLT, sx2.flatMap((sx) => [-14, 14].map((d) => ({ on: uRail, at: [sx * cx + d, yR, zR + T / 2] as Vec3, dir: [0, 0, -1] as Vec3 }))));
  });
  k.step({ title: "Stand the castor rail on the side", detail: "At the bottom end of the front edge, castors pointing out.", kind: "join", scene: "unit", pose: "+x" }, () => put(uRail, ushift, uup));
  k.step({ title: "Turn the cam locks", detail: "Five, until the bottom, shelf and rail pull tight to the side.", kind: "cams", tools: ["screwdriver"], scene: "unit", pose: "+x" }, () => uLocks(-1));
  k.step({ title: "Tap two dowels into the other side", detail: "Into its top end.", kind: "dowels", tools: ["hammer"], scene: "unit-b", warnings: ["floor"] }, () => {
    flatRow([[uSideR, SIDEWAYS]]);
    sideTopDowels(uSideR, 1);
  });
  k.step({ title: "Screw the cam bolts into the other side", detail: "Five, the same holes as on the first side.", kind: "cams", tools: ["screwdriver"], scene: "unit-b" }, () => uBolts(1));
  k.step({ title: "Lower the other side on", detail: "Every dowel and cam bolt into its hole, then press it down evenly.", kind: "join", scene: "unit", pose: "+x" }, () => put(uSideR, ushift, [420, 0, 0]));
  k.step({ title: "Turn the other cam locks", detail: "All five, the same way.", kind: "cams", tools: ["screwdriver"], scene: "unit", pose: "+x" }, () => uLocks(1));
  k.step({ title: "Lay it on its front and slide the back in", detail: "On a rug. Push the hardboard back in from the top until it stops at the bottom.", kind: "join", scene: "unit", pose: "-z", warnings: ["floor"] }, () => put(uBackP, ushift, [0, 650, 0]));
  const wx = uh - 25, wz = uB + 3 + 40;
  k.step({ title: "Screw the back wheels on", detail: "One inside each back corner at the bottom, two screws in each.", kind: "legs", tools: ["screwdriver"], scene: "unit", pose: "-z" }, () => {
    k.fits(WHEEL, sx2.map((sx) => ({ on: sx < 0 ? uSideL : uSideR, at: [sx * wx, rY0, wz] as Vec3, dir: [0, 1, 0] as Vec3, hole: false as const })));
    k.fits(SCREW, sx2.flatMap((sx) => [wz - 12, wz + 12].map((z) => ({ on: sx < 0 ? uSideL : uSideR, at: [sx * uh, rY0 - 14, z] as Vec3, dir: [sx, 0, 0] as Vec3 }))));
  });
  const pinAt: { x: number; y: number; mate: string }[] = [
    ...sx2.flatMap((sx) => [250, 480, 690].map((y) => ({ x: sx * ux, y, mate: sx < 0 ? uSideL : uSideR }))),
    ...[-250, 0, 250].map((x) => ({ x, y: uSY, mate: uShelf })),
    ...[-250, 0, 250].map((x) => ({ x, y: uBY, mate: uBottom })),
  ];
  k.step({ title: "Fix the back with the push pins", detail: "Twelve: push a plug through each hole in the back, then press a pin into it.", kind: "general", scene: "unit", pose: "-z" }, () => {
    k.fits(PLUG, pinAt.map((p) => ({ on: uBackP, at: [p.x, p.y, uB] as Vec3, dir: [0, 0, 1] as Vec3, mate: p.mate })));
    k.fits(PUSH, pinAt.map((p) => ({ on: uBackP, at: [p.x, p.y, uB - 1] as Vec3, dir: [0, 0, 1] as Vec3, hole: false as const })));
  });
  const az = uB + 3 + 45, yUnder = uBY - T / 2;
  k.step({ title: "Screw the castor arm under the bottom", detail: "In the middle at the back, four screws.", kind: "legs", tools: ["screwdriver"], scene: "unit", pose: "-z" }, () => {
    k.fits(ARM, [{ on: uBottom, at: [0, yUnder, az], dir: [0, 1, 0], hole: false }]);
    k.fits(SCREW, [-20, 20].flatMap((x) => [az - 15, az + 15].map((z) => ({ on: uBottom, at: [x, yUnder, z] as Vec3, dir: [0, 1, 0] as Vec3 }))));
  });

  /* the table top, upside down on a rug */
  const tshift: Vec3 = [0, -(uTop), -(lz0 + uF) / 2];
  const yU = uTop; // the boards' undersides
  const rx = UW / 2 - 40, rz = lz0 + 35;
  k.step({ title: "Screw the roller plates onto the back board", detail: "Underside up, one at each corner of the back edge, rollers facing out. Four screws in each.", kind: "screws", tools: ["screwdriver"], scene: "table", pose: "-y", warnings: ["floor"] }, () => {
    put(leaf, tshift);
    b.then(0.15);
    k.fits(ROLLER, sx2.map((sx) => ({ on: leaf, at: [sx * rx, yU, rz] as Vec3, dir: [0, 1, 0] as Vec3, hole: false as const })));
    k.fits(SCREW, sx2.flatMap((sx) => [-14, 14].flatMap((d) => [-14, 14].map((e) => ({ on: leaf, at: [sx * rx + d, yU, rz + e] as Vec3, dir: [0, 1, 0] as Vec3 })))));
  });
  k.step({ title: "Lay the front board against it", detail: "Underside up too, the long edges pushed together.", kind: "join", scene: "table", pose: "-y" }, () => put(front, tshift, [0, 0, 250]));
  const hx = UW / 2 - 130;
  k.step({ title: "Screw the hinges across the joint", detail: "Two hinges, eight screws in each: four into each board.", kind: "hinges", tools: ["screwdriver"], scene: "table", pose: "-y" }, () => {
    k.fits(HW.hinge, sx2.map((sx) => ({ on: leaf, at: [sx * hx, yU, uB] as Vec3, dir: [0, 1, 0] as Vec3, hole: false as const })));
    k.fits(SCREW, sx2.flatMap((sx) => [-16, 16].flatMap((d) => [-1, 1].flatMap((side) => [14, 34].map((e) => ({ on: side < 0 ? leaf : front, at: [sx * hx + d, yU, uB + side * e] as Vec3, dir: [0, 1, 0] as Vec3 }))))));
  });
  k.step({ title: "Screw the cam bolts into the front board", detail: "Four, two near each end. Keep your fingers clear of the hinges when you fold it.", kind: "cams", tools: ["screwdriver"], scene: "table", pose: "-y", warnings: ["hand"] }, () =>
    k.fits(HW.camScrew, sx2.flatMap((sx) => topBoltZ.map((z) => ({ on: front, at: [sx * ux, yU, z] as Vec3, dir: [0, 1, 0] as Vec3, mate: sx < 0 ? uSideL : uSideR })))),
  );

  /* together */
  const lift: Vec3 = [0, 90, 0];
  k.step({ title: "Hook the table top into the tracks", detail: "Back board first: drop each roller into the top of the curved track inside the sides, then hold the front board up.", kind: "join" }, () => {
    b.stagger(0);
    put(leaf, lift, [0, 0, 400]);
    put(front, lift, [0, 0, 400]);
  });
  k.step({ title: "Roll the unit in and lower the table onto it", detail: "Push the unit under the front board, then let the board down onto its dowels and cam bolts.", kind: "join" }, () => {
    b.stagger(0);
    for (const key of [uSideL, uSideR, uBottom, uShelf, uRail, uBackP]) b.add(key, [0, 0, 600]);
    b.then(0.2);
    b.add(leaf, lift);
    b.add(front, lift);
  });
  k.step({ title: "Turn the cam locks under the table top", detail: "Four, two inside each side of the unit, until the front board pulls tight.", kind: "cams", tools: ["screwdriver"] }, () =>
    k.fits(HW.cam, sx2.flatMap((sx) => topBoltZ.map((z) => ({ on: sx < 0 ? uSideL : uSideR, at: [sx * (ux - T / 2), uTop - 25, z] as Vec3, dir: [sx, 0, 0] as Vec3 })))),
  );
  return true;
}

/* ---------- putting one unit together, in the manuals' order ---------- */

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (/foldable table/i.test(s.variant)) return foldTable(new Kit(b));
  const u = unitOf(s);
  if (!u) return combo(b, s);
  const k = new Kit(b);
  if (u.H === 0) {
    // the height extension on its own
    extension(k, u, null);
    return true;
  }
  const f = frame(k, u);
  const kits = { i: 0, n: u.doors.length + u.extDoors.length };
  if (u.kit === "billy") {
    shelfSteps(k, u, f);
    bookcaseWall(k, u, f);
  } else {
    if (!u.ext && !u.drawer) bookcaseWall(k, u, f);
    shelfSteps(k, u, f);
  }
  let sides: { L: string; R: string; yTop: number; top: string; xL?: string; xR?: string } = { L: f.sideL, R: f.sideR, yTop: u.H, top: f.top };
  let ext: ReturnType<typeof extension> | null = null;
  if (u.ext) {
    ext = extension(k, u, f);
    sides = { L: f.sideL, R: f.sideR, yTop: ext.yTop, top: ext.top, xL: ext.sideL, xR: ext.sideR };
  }
  if (u.drawer) drawerKit(k, u, f);
  if (u.kit) {
    // plates above the bookcase go on the extension's sides
    doorKit(k, u, f, sides, u.doors, u.kit, f.yFixed, kits);
    if (ext) doorKit(k, u, f, sides, u.extDoors, "oxberg", f.yFixed, kits);
  }
  return true;
}

/* ---------- sets of bookcases side by side ---------- */

/**
 * The wide BILLY sets are 40 and 80 cm bookcases standing side by side, read from IKEA's photos: 120 is three
 * narrow ones, 160 two wide ones, 200 a narrow one between two wide ones, 240 three wide ones. Each is built from
 * its own manual and none are joined to each other; each one is fixed to the wall on its own.
 */
interface Col {
  w: 40 | 80;
  name: string;
  variant: string;
}

const GLASS = "Bookcase with glass doors";
const PANEL = "Bookcase with panel/glass doors";
/** Sets whose page title doesn't say which doors each bookcase has; the photo does. */
const OWN_DOORS: Record<string, string[]> = {
  "billy-oxberg-bookcase-120-x-30-x-237": [PANEL],
  "billy-oxberg-bookcase-doors-200-x-30-x-106": [GLASS],
  "billy-oxberg-bookcase-panel-glass-doors-160-x-30": [PANEL, GLASS],
};

function columns(s: ProductSpec): Col[] | null {
  const W = Math.round(s.size.w * 10);
  const widths: (40 | 80)[] | null = W === 1200 ? [40, 40, 40] : W === 1600 ? [80, 80] : W === 2000 ? [80, 40, 80] : W === 2400 ? [80, 80, 80] : null;
  if (!widths) return null;
  const name = s.name.toUpperCase();
  const doors = /OXBERG|HÖGADAL|HOGADAL|HÖGBO|HOGBO/.test(name);
  const own = OWN_DOORS[s.slug ?? ""];
  let j = 0;
  return widths.map((w, i) => {
    // the narrow one in the middle of the 200 cm sets with doors stands open
    if (!doors || (W === 2000 && i === 1)) return { w, name: "BILLY", variant: "Bookcase" };
    const variant = own ? own[Math.min(own.length - 1, j++)] : s.variant;
    return { w, name: s.name, variant };
  });
}

const doorsOf = (c: Col) => (c.name === "BILLY" ? "" : /panel\/glass|pnl\/glss/i.test(c.variant) ? "panel" : /glass/i.test(c.variant) ? "glass" : "solid");
const COUNTS = ["", "", "two", "three"];

function combo(b: PlanBuilder, s: ProductSpec): boolean {
  const cols = columns(s);
  if (!cols) return false;
  const keyOf = (c: Col) => `${c.w}|${c.name}|${c.variant}`;
  const groupIds = [...new Set(cols.map(keyOf))];
  const byUnit = new Map<RowUnit, Col>();
  // a unit's shelf parameters carry its group, so frames with different doors aren't taken as copies of each other
  const units: RowUnit[] = cols.map((c) => {
    const u: RowUnit = { w: c.w, shelf: { rows: groupIds.indexOf(keyOf(c)) } };
    byUnit.set(u, c);
    return u;
  });
  const { cabinet: _c, ...rest } = s;
  void _c;
  const set: ProductSpec = { ...rest, archetype: "shelf", row: { n: cols.length, of: "bookcase", join: false, units } };
  const n0 = b.steps.length;
  buildUnits(b, set, (bb, spec) => {
    const c = byUnit.get(rowUnitOf(spec)!)!;
    build(bb, { ...spec, name: c.name, variant: c.variant });
  });

  // the row code's titles for the other bookcases, in its order: the commonest (widest) first, then the others
  const groups = groupIds.map((k) => cols.map((c, i) => (keyOf(c) === k ? i : -1)).filter((i) => i >= 0));
  const first = [...groups].sort((a, c) => c.length - a.length || cols[c[0]].w - cols[a[0]].w)[0];
  const order = [first, ...groups.filter((g) => g !== first)];
  const mixed = new Set(cols.map((c) => c.w)).size > 1;
  const f = cols[first[0]];
  const builds = b.steps.slice(n0).filter((st) => /^Build .* the same way$/.test(st.title));
  order
    .map((g) => ({ g, k: g === first ? g.length - 1 : g.length }))
    .filter((x) => x.k > 0)
    .forEach(({ g, k }, i) => {
      const st = builds[i];
      if (!st) return;
      const c = cols[g[0]];
      const size = mixed ? (c.w === 40 ? "narrow " : "wide ") : "";
      const dc = doorsOf(c), df = doorsOf(f);
      const what = k > 1 ? `${COUNTS[k]} ${g === first ? "more " : ""}${size}bookcases` : `${g === first ? "another" : "the"} ${size}bookcase`;
      const with_ = dc === df ? "" : dc === "" ? " without doors" : dc === "glass" ? " with glass doors" : dc === "panel" ? " with panel and glass doors" : " with doors";
      st.title = `Build ${what}${with_} the same way`;
      const diff = [c.w < f.w ? "just narrower" : c.w > f.w ? "just wider" : "", dc === df ? "" : dc === "" ? "leave its doors off" : "with its own doors"].filter(Boolean);
      st.detail = `Every step as for the first one${diff.length ? ", " + diff.join(", ") : ""}. Stand ${k > 1 ? "each one" : "it"} in its place in the row.`;
    });
  return true;
}

const family: Family = {
  names: ["BILLY"],
  build,
  row(b, s) {
    if (unitOf(s)) return false;
    return combo(b, s);
  },
};
export default family;

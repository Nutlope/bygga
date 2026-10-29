import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, Vec3 } from "../../types";
import { rotate } from "../math";

/**
 * POÄNG, read from its manuals. Layer-glued bentwood. The armchair and the rocking chair share their first steps:
 * four crossbars are pushed into one S-shaped back rail and the other rail pressed on, then bolted, four bolts a
 * side (turned over between). The seat sling is bolted to the bottom of the back, two curved cross rails slot in
 * under its front and take four more bolts. The chair goes on its side for each bent side frame: a dowel and a
 * bolt (with a rubber washer on the armchair) where the arm meets the back, long bolts into barrel nuts in the
 * rails lower down. The armchair's frames are cantilevered: arm, front leg and a runner on the floor; the rocking
 * chair's run into rockers whose tail curls up under the seat. The footstool is two bent frames joined by two rails
 * on four long bolts and barrel nuts, and its cushion drops in.
 */

const r1 = (n: number) => Math.round(n * 10) / 10;
type P2 = [number, number]; // z, y in the side view

/** A part drawn as pieces placed in product coordinates: works out its box and moves the pieces relative to it. */
function built(id: string, name: string, pieces: PartPiece[], material: CustomPart["material"]): CustomPart {
  const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of pieces)
    for (const a of [-1, 1])
      for (const b of [-1, 1])
        for (const c of [-1, 1]) {
          const v = rotate([(a * p.size[0]) / 2, (b * p.size[1]) / 2, (c * p.size[2]) / 2], p.rot ?? [0, 0, 0]);
          for (let i = 0; i < 3; i++) {
            lo[i] = Math.min(lo[i], p.pos[i] + v[i]);
            hi[i] = Math.max(hi[i], p.pos[i] + v[i]);
          }
        }
  const mid = lo.map((v, i) => r1((v + hi[i]) / 2)) as Vec3;
  return { id, name, size: lo.map((v, i) => r1(hi[i] - v)) as Vec3, pos: mid, material, pieces: pieces.map((p) => ({ ...p, pos: p.pos.map((v, i) => r1(v - mid[i])) as Vec3 })) };
}

/** A bent strip along a side-view path at x: one box per segment, `t` thick across the path, `w` wide in x. */
function path(pts: P2[], x: number, w: number, t: number): PartPiece[] {
  const out: PartPiece[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [z1, y1] = pts[i], [z2, y2] = pts[i + 1];
    const dz = z2 - z1, dy = y2 - y1;
    const len = Math.hypot(dz, dy) + t * 0.6; // overlap a little so the bends close
    out.push({ shape: "box", size: [w, t, len], pos: [x, (y1 + y2) / 2, (z1 + z2) / 2], rot: [Math.atan2(-dy, dz), 0, 0] });
  }
  return out;
}

const shift = (pts: P2[], dz: number, dy = 0): P2[] => pts.map(([z, y]) => [z + dz, y + dy]);

interface Chair {
  rocker: boolean;
  W: number;
  H: number;
  z0: number; // shifts the chair front to back (the footstool stands in front of it)
}

const FX = 325; // side frames' middle, from the centre
const BX = 290; // the back rails and the seat bars
const BOLT = { len: 30, dia: 6 };
const LONG = { len: 120, dia: 6 };
const MID = { len: 80, dia: 6 };

function chair(o: Chair) {
  const { rocker, H, z0 } = o;
  const s = (pts: P2[]) => shift(pts, z0);
  // the seat bars and the back rails follow one S: seat front, the dip, the lumbar curve, up to the headrest
  const seatPts = s([[300, 420], [120, 380], [-60, 335], [-140, 345]]);
  const backPts = s([[-140, 345], [-210, 430], [-280, 620], [-330, 820], [-350, H - 60], [-335, H - 10]]);
  const parts: CustomPart[] = [];
  for (const [i, sx] of [-1, 1].entries()) parts.push(built(`BR${i}`, "Back rail", path(backPts, sx * BX, 30, 40), "wood"));
  // four crossbars between the back rails, up the back
  const crossAt = [0.18, 0.42, 0.66, 0.92].map((t) => {
    const k = t * (backPts.length - 1), i = Math.min(backPts.length - 2, Math.floor(k)), f = k - i;
    return [backPts[i][0] + (backPts[i + 1][0] - backPts[i][0]) * f, backPts[i][1] + (backPts[i + 1][1] - backPts[i][1]) * f] as P2;
  });
  crossAt.forEach(([z, y], i) => parts.push({ id: `X${i}`, name: "Crossbar", size: [2 * BX - 30, 50, 16], pos: [0, y, z + 4], material: "wood" }));
  // the seat: a fabric sling between two bent bars
  const sling: PartPiece[] = [...path(seatPts, -BX, 30, 36), ...path(seatPts, BX, 30, 36), ...path(shift(seatPts, 0, -6), 0, 2 * BX - 30, 4)];
  parts.push(built("S", "Seat", sling, "wood"));
  // two bowed cross rails under the seat front
  const railZ = [z0 + 240, z0 + 40];
  const railY = [385, 330];
  railZ.forEach((z, i) => parts.push({ id: `R${i}`, name: "Cross rail", size: [2 * FX - 30, 40, 30], pos: [0, railY[i] - 30, z], material: "wood" }));

  // side frames
  // the arm runs back to the back rail, where it is bolted on from the outside
  const arm: P2[] = s([[-290, 615], [-240, 615], [120, 620], [270, 605], [320, 560]]);
  const sideFrame = (sx: number): PartPiece[] => {
    const x = sx * FX;
    if (rocker) {
      const leg: P2[] = s([[320, 560], [300, 420], [270, 250], [250, 30]]);
      const rock: P2[] = s([[450, 55], [300, 12], [100, 0], [-150, 5], [-350, 35], [-470, 100], [-470, 190], [-390, 270], [-230, 330], [-150, 345]]);
      return [...path(arm, x, 30, 60), ...path(leg, x, 30, 56), ...path(rock, x, 30, 50)];
    }
    const leg: P2[] = s([[320, 560], [335, 420], [335, 90], [310, 25], [250, 15]]);
    const run: P2[] = s([[250, 15], [-200, 15], [-420, 22]]);
    return [...path(arm, x, 30, 60), ...path(leg, x, 30, 56), ...path(run, x, 30, 30)];
  };
  parts.push(built("FR", "Side frame", sideFrame(1), "wood"), built("FL", "Side frame", sideFrame(-1), "wood"));
  // the cushion follows the seat and back, with a pad for the head
  const cs = shift(seatPts, -10, 50), cb = shift(backPts.slice(0, -1), 50, 10);
  parts.push(built("C", "Cushion", [...path(cs, 0, 2 * BX - 20, 80), ...path(cb, 0, 2 * BX - 20, 80), ...path(shift(backPts.slice(-3), 70, 0), 0, 2 * BX - 40, 110)], "soft"));

  // fittings
  const crossBolts = (sx: number): CustomFix => ({
    kind: "bolt",
    count: 4,
    ...BOLT,
    at: crossAt.map(([z, y]) => [sx * (BX + 15), y, z + 4] as Vec3),
    dir: [-sx, 0, 0],
    on: `BR${sx < 0 ? 0 : 1}`,
  });
  const [zj, yj] = seatPts[seatPts.length - 1];
  const seatBolts: CustomFix = { kind: "bolt", count: 2, ...BOLT, at: [-1, 1].map((sx) => [sx * (BX + 15), yj + 8, zj + 25] as Vec3), dir: [0, 0, -1], on: "S" };
  const railBolts: CustomFix = {
    kind: "bolt",
    count: 4,
    ...BOLT,
    at: [-1, 1].flatMap((sx) => railZ.map((z, i) => [sx * BX, railY[i] - 10, z] as Vec3)),
    dir: [0, -1, 0],
    on: "S",
  };
  const [za, ya] = arm[0];
  const armJoin = (sx: number): CustomFix[] => {
    const id = sx < 0 ? "FL" : "FR";
    // through the arm's back end into the side of the back rail, the dowel just below it
    const at: Vec3 = [sx * (FX + 15), ya, za + 12];
    return [
      { kind: "dowel", count: 1, len: 40, dia: 8, at: [[sx * (FX - 15), ya - 40, za + 22]], dir: [sx, 0, 0], on: id },
      ...(rocker ? [] : [{ kind: "washer" as const, name: "Rubber washer", count: 1, len: 4, dia: 20, at: [[sx * (FX - 15), ya, za + 12] as Vec3], dir: [-sx, 0, 0] as Vec3, on: id }]),
      { kind: "bolt", count: 1, ...MID, at: [at], dir: [-sx, 0, 0], on: id, mate: `BR${sx < 0 ? 0 : 1}` },
    ];
  };
  // low bolts through the frame into barrel nuts in the cross rails (one on the rocking chair, which takes a second bolt at the back)
  const lowJoin = (sx: number): CustomFix[] => {
    const id = sx < 0 ? "FL" : "FR";
    const pts: Vec3[] = (rocker ? [railZ[0]] : railZ).map((z, i) => [sx * (FX + 15), railY[i] - 30, z] as Vec3);
    const nuts: CustomFix[] = pts.map((p, i) => ({ kind: "nut", name: "Barrel nut", count: 1, len: 14, dia: 10, at: [[sx * (FX - 150), p[1], p[2]]], dir: [0, 0, -1], on: `R${i}` }));
    const out: CustomFix[] = [...nuts, { kind: "bolt", count: pts.length, ...LONG, at: pts, dir: [-sx, 0, 0], on: id }];
    // the rocker's back end meets the seat bar where the seat joins the back
    if (rocker) out.push({ kind: "bolt", count: 1, ...MID, at: [[sx * (FX + 15), 345, z0 - 150]], dir: [-sx, 0, 0], on: id, mate: "S" });
    return out;
  };

  const side = (sx: number, first: boolean): CustomStep[] => {
    const id = sx < 0 ? "FL" : "FR";
    return [
      {
        title: first ? "Lay the chair on its side and fit a side frame" : "Turn it over and fit the other side frame",
        detail: "Push the dowel into the arm, rest the frame on the back, then turn the bolt in where the arm meets the back rail.",
        add: [id],
        fix: armJoin(sx),
        pose: sx < 0 ? "-x" : "+x",
        tools: ["allen"],
        warnings: ["floor"],
      },
      {
        title: rocker ? "Bolt the frame to the seat and rail" : "Bolt the frame to the cross rails",
        detail: "Turn the barrel nut in the rail so its slot lines up with the hole, then turn the long bolt into it.",
        fix: lowJoin(sx),
        tools: ["allen", "screwdriver"],
      },
    ];
  };

  const steps: CustomStep[] = [
    {
      title: "Push the crossbars into a back rail",
      detail: "Lay the rail flat on a rug. The four crossbars go in with their curve facing the same way.",
      add: ["BR0", "X0", "X1", "X2", "X3"],
      pose: "+z",
      warnings: ["floor"],
    },
    { title: "Press the other back rail on", detail: "Line it up over all four crossbars and press it down evenly.", add: ["BR1"] },
    { title: "Bolt the crossbars to one rail", detail: "Four short bolts, one into each crossbar.", fix: [crossBolts(1)], tools: ["allen"] },
    { title: "Turn it over and bolt the other rail", detail: "Four more short bolts.", fix: [crossBolts(-1)], tools: ["allen"] },
    { title: "Bolt the seat to the back", detail: "Stand the back up. The seat's bars meet the bottom of the back rails: one bolt each side.", add: ["S"], fix: [seatBolts], tools: ["allen"], pose: "+y" },
    { title: "Slot in the cross rails", detail: "Under the front of the seat, curve facing down. Their ends slot into the seat's bars.", add: ["R0", "R1"] },
    { title: "Bolt the cross rails", detail: "Four bolts, two in each rail, through the seat bars.", fix: [railBolts], tools: ["allen"] },
    ...side(1, true),
    ...side(-1, false),
    {
      title: "Stand it up and tighten every bolt",
      detail: rocker ? "Then check the chair rocks evenly on both rockers." : "Then check both runners sit flat on the floor.",
      pose: "+y",
      tools: ["allen"],
    },
    { title: "Put the cushion on", detail: "Hook its flap over the top of the back and smooth it down over the seat.", add: ["C"] },
  ];
  return { parts, steps };
}

/** The footstool: two bent frames, arch up, joined by two rails, and a cushion laid in. */
function footstool(zc: number) {
  const W = 680, H = 390, D = 540;
  const parts: CustomPart[] = [];
  const fr = (sx: number): PartPiece[] =>
    path(
      [
        [zc + D / 2 - 30, 15],
        [zc + D / 2 - 20, 250],
        [zc + D / 2 - 60, H - 40],
        [zc - D / 2 + 60, H - 40],
        [zc - D / 2 + 20, 250],
        [zc - D / 2 + 30, 15],
      ],
      sx * FX,
      30,
      50,
    );
  parts.push(built("TL", "Footstool frame", fr(-1), "wood"), built("TR", "Footstool frame", fr(1), "wood"));
  const rz = [zc + D / 2 - 90, zc - D / 2 + 90];
  rz.forEach((z, i) => parts.push({ id: `TC${i}`, name: "Footstool rail", size: [2 * FX - 30, 40, 30], pos: [0, H - 90, z], material: "wood" }));
  parts.push({ id: "TP", name: "Footstool cushion", size: [2 * FX - 60, 90, D - 160], pos: [0, H - 25, zc], material: "soft" });
  const join = (sx: number): CustomFix[] => {
    const id = sx < 0 ? "TL" : "TR";
    const at = rz.map((z) => [sx * (FX + 15), H - 90, z] as Vec3);
    return [
      { kind: "nut", name: "Barrel nut", count: 2, len: 14, dia: 10, at: rz.map((z) => [sx * (FX - 150), H - 90, z] as Vec3), dir: [0, 0, -1] },
      { kind: "bolt", count: 2, ...LONG, at, dir: [-sx, 0, 0], on: id },
    ];
  };
  const steps: CustomStep[] = [
    {
      title: "Bolt the rails to a footstool frame",
      detail: "Stand the frame on a rug. Barrel nuts in the rails, slots lined up, then a long bolt through the frame into each.",
      add: ["TL", "TC0", "TC1"],
      fix: join(-1),
      tools: ["allen", "screwdriver"],
      warnings: ["floor"],
    },
    { title: "Bolt on the other footstool frame", detail: "Two more barrel nuts and long bolts, then tighten all four.", add: ["TR"], fix: join(1), tools: ["allen", "screwdriver"] },
    { title: "Lay the footstool cushion in", detail: "It rests on the rails between the frames.", add: ["TP"] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["POÄNG", "POANG"],
  recipe(s): CustomParams | null {
    const slug = s.slug ?? "";
    const text = `${s.variant} ${slug}`.toLowerCase();
    // the armchair is the cantilevered one; the rocking chair is a guide of its own
    const rocker = /rocking/.test(text);
    const stool = /footstool/.test(text);
    if (/footstool/.test(slug) && !/armchair/.test(slug)) return footstool(0);
    const c = chair({ rocker, W: 680, H: rocker ? 950 : 1000, z0: stool ? -250 : 0 });
    if (!stool) return c;
    const f = footstool(-250 + 330 + 160 + 270);
    return { parts: [...c.parts, ...f.parts], steps: [...c.steps, ...f.steps] };
  },
};
export default family;

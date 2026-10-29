import type { Family } from "./family";
import type { CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";
import { HW, type FitOpts, type PlanBuilder } from "../builder";
import { rotate } from "../math";

/**
 * TOSSBERG, read from its manuals. The seat is one upholstered shell, the same on every chair.
 * The dining chair: the shell lies upside down on a rug, the steel sled frame is bolted under it with six bolts,
 * and four glides click onto the runners before it is turned over.
 * The swivel chairs follow the seat shell's own manual, which has a branch for each base. On MALSKÄR the five legs
 * slide into the hub upside down, two bolts each, castors in, turned over, the hub cover and gas lift go on, a seat
 * plate is bolted under the shell with four bolts and the seat is lowered on. On LÅNGFJÄLL the seat comes first: the
 * tilt mechanism and its cover plate are bolted under the shell (two bolts each, loose, then all four tightened),
 * then castors into the one-piece base, the gas lift, and the seat onto it.
 */

const r1 = (n: number) => Math.round(n * 10) / 10;
const BOLT = { kind: "bolt" as const, len: 16, dia: 6 };

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

/** A round rod from a to b. */
function rod(a: Vec3, b: Vec3, dia: number): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const u = d.map((v) => v / len);
  return { shape: "cyl", size: [dia, len, dia], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [Math.atan2(u[2], u[1]), 0, Math.asin(-u[0])] };
}

/* ---------- the seat shell ---------- */

const SW = 610; // outer width across the arms
const SD = 530;
const BACK = 330; // back top above the seat

/** The tub: a padded seat, arms that sweep down from the back to the front, and the back, all one shell. */
function shellPieces(seatTop: number, z0: number): PartPiece[] {
  const bot = seatTop - 100;
  const top = seatTop + BACK;
  const zf = z0 + SD / 2, zb = z0 - SD / 2;
  const p: PartPiece[] = [];
  p.push({ shape: "box", size: [SW - 190, 60, SD - 90], pos: [0, bot + 30, z0 + 5] });
  p.push({ shape: "box", size: [SW - 170, 40, SD - 110], pos: [0, seatTop - 20, z0 + 30] });
  for (const sx of [-1, 1]) {
    const x = sx * (SW / 2 - 42);
    const lean: Vec3 = [0, 0, -sx * 0.08];
    p.push({ shape: "box", size: [84, seatTop + 40 - bot, SD - 40], pos: [x, (seatTop + 40 + bot) / 2, z0 + 10], rot: lean });
    // the top of the arm sweeps up from the front to the back
    const a: Vec3 = [x, seatTop + 85, zf - 55], b: Vec3 = [x, top - 75, zb + 75];
    const len = Math.hypot(a[1] - b[1], a[2] - b[2]) + 90;
    p.push({ shape: "box", size: [84, 130, len], pos: [x + sx * 8, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [Math.atan2(b[1] - a[1], a[2] - b[2]), 0, -sx * 0.08] });
  }
  p.push({ shape: "box", size: [SW - 40, top - bot - 20, 80], pos: [0, (top + bot) / 2, zb + 60], rot: [-0.1, 0, 0] });
  return p;
}

/* ---------- dining chair on a sled frame ---------- */

function dining(s: ProductSpec): CustomParams {
  const seatTop = 490;
  const bot = seatTop - 100;
  const z0 = 0;
  const T = 12; // steel rod
  const xs = 200, zf = 195, zb = -185;
  const yTop = bot - T / 2;
  const pieces: PartPiece[] = [];
  for (const sx of [-1, 1]) {
    const x = sx * xs;
    pieces.push(rod([x, T / 2, zb], [x, T / 2, zf], T));
    pieces.push(rod([x, T / 2, zf], [x, yTop, zf - 25], T));
    pieces.push(rod([x, T / 2, zb], [x, yTop, zb + 20], T));
    pieces.push(rod([x, yTop, zb + 20], [x, yTop, zf - 25], T));
  }
  pieces.push(rod([-xs, yTop, 0], [xs, yTop, 0], T));
  // the tabs the bolts go through
  const tabs: Vec3[] = [[-xs + 20, bot, -120], [-xs + 20, bot, 130], [xs - 20, bot, -120], [xs - 20, bot, 130], [-70, bot, 0], [70, bot, 0]];
  for (const t of tabs) pieces.push({ shape: "box", size: [44, 4, 30], pos: [t[0], bot - 2, t[2]] });
  const parts: CustomPart[] = [built("X", "Seat shell", shellPieces(seatTop, z0), "soft"), built("F", "Sled frame", pieces, "metal")];
  void s;
  const bolts = tabs.map((t) => [t[0], bot - 4, t[2]] as Vec3);
  const glides: Vec3[] = [-1, 1].flatMap((sx) => [zb + 20, zf - 20].map((z) => [sx * xs, 0, z] as Vec3));
  const steps: CustomStep[] = [
    {
      title: "Lay the seat shell upside down on a rug",
      detail: "A rug or the flattened box keeps the fabric clean and the shell from rocking.",
      add: ["X"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Bolt the frame under the seat",
      detail: "The tabs sit flat over the holes. Six bolts: start them all by hand, then tighten each one with the Allen key.",
      add: ["F"],
      fix: [{ ...BOLT, count: 6, at: bolts, dir: [0, 1, 0], on: "F", mate: "X" }],
      tools: ["allen"],
    },
    {
      title: "Click a glide onto each runner",
      detail: "Two on each runner, near the ends. Press until they click.",
      fix: [{ kind: "glide", name: "Glide", count: 4, len: 8, dia: 22, at: glides, dir: [0, 1, 0], on: "F" }],
    },
    { title: "Turn the chair over", detail: "Stand it on its runners. All four glides should touch the floor.", pose: "+y" },
  ];
  return { parts, steps };
}

/* ---------- swivel chairs ---------- */

function swivel(b: PlanBuilder, s: ProductSpec, malskar: boolean) {
  const seatTop = 500;
  const shellBot = seatTop - 100;
  const zs = 20;
  const R = Math.min(345, Math.max(280, (Math.max(s.size.w, s.size.d) * 10) / 2 - 10));
  const tilt = 0.09;
  const armT = 32, armW = 44;
  const r0 = 30, rt = R - 24;
  const rm = (r0 + R) / 2;
  const tipY = HW.castor.len;
  const ym = tipY + (rt - rm) * Math.tan(tilt) + armT / 2 / Math.cos(tilt);
  const hubD = 76;
  const hubBot = ym + (rm - hubD / 2) * Math.tan(tilt) - armT / 2 - 4;
  const hubH = malskar ? 70 : 115;
  const hubTop = malskar ? hubBot + hubH + 45 : hubBot + hubH; // MALSKÄR: the cover sits on top of the hub
  const angles = [0, 1, 2, 3, 4].map((i) => -Math.PI / 2 + (i * 2 * Math.PI) / 5);

  /* ---------- base ---------- */
  let base: string;
  const legs: string[] = [];
  let cover: string | null = null;
  if (malskar) {
    const hub = b.compound("Hub", [{ shape: "cyl", size: [hubD + 20, hubH, hubD + 20], pos: [0, hubBot + hubH / 2, 0] }], { material: "metal" });
    base = b.place(hub.type, hub.mid);
    const legT = b.part("Leg", [(R - r0) / Math.cos(tilt), armT, armW], { material: "metal" });
    for (const a of angles) legs.push(b.place(legT, [rm * Math.cos(a), ym, -rm * Math.sin(a)], [0, a, -tilt]));
    const cv = b.compound("Hub cover", [{ shape: "cyl", size: [hubD + 30, 45, hubD + 30], pos: [0, hubBot + hubH + 22.5, 0] }], { material: "metal" });
    cover = b.place(cv.type, cv.mid);
  } else {
    const pieces: PartPiece[] = [{ shape: "cyl", size: [hubD, hubH, hubD], pos: [0, hubBot + hubH / 2, 0] }];
    for (const a of angles) pieces.push({ shape: "box", size: [(R - r0) / Math.cos(tilt), armT, armW], pos: [rm * Math.cos(a), ym, -rm * Math.sin(a)], rot: [0, a, -tilt] });
    const sb = b.compound("Star base", pieces, { material: "metal" });
    base = b.place(sb.type, sb.mid);
  }

  /* ---------- seat ---------- */
  const sh = b.compound("Seat shell", shellPieces(seatTop, zs), { material: "soft" });
  const shell = b.place(sh.type, sh.mid);
  const under: string[] = [];
  let mechBot: number;
  if (malskar) {
    const plateT = 8;
    const pc = b.compound(
      "Seat plate",
      [
        { shape: "box", size: [260, plateT, 40], pos: [0, shellBot - plateT / 2, zs], rot: [0, 0.6, 0] },
        { shape: "box", size: [260, plateT, 40], pos: [0, shellBot - plateT / 2, zs], rot: [0, -0.6, 0] },
        { shape: "cyl", size: [70, 40, 70], pos: [0, shellBot - plateT - 20, zs] },
        { shape: "box", size: [16, 10, 200], pos: [150, shellBot - 30, zs + 60] },
      ],
      { material: "metal" },
    );
    under.push(b.place(pc.type, pc.mid));
    mechBot = shellBot - plateT - 40;
  } else {
    const mechH = 45;
    const mc = b.compound(
      "Mechanism",
      [
        { shape: "box", size: [120, mechH, 150], pos: [0, shellBot - mechH / 2, zs] },
        { shape: "box", size: [250, 6, 40], pos: [0, shellBot - 3, zs - 60] },
        { shape: "box", size: [250, 6, 40], pos: [0, shellBot - 3, zs + 60] },
        { shape: "box", size: [150, 10, 16], pos: [135, shellBot - 30, zs + 40] },
        { shape: "box", size: [20, 14, 60], pos: [205, shellBot - 30, zs + 60] },
      ],
      { material: "metal" },
    );
    const cp = b.compound("Cover plate", [{ shape: "cyl", size: [210, 12, 240], pos: [0, shellBot - mechH - 6, zs] }], { material: "metal" });
    under.push(b.place(mc.type, mc.mid), b.place(cp.type, cp.mid));
    mechBot = shellBot - mechH - 12;
  }
  const seatParts = [shell, ...under];
  const castorPts: FitOpts[] = angles.map((a) => ({ on: malskar ? undefined : base, at: [rt * Math.cos(a), tipY, -rt * Math.sin(a)] as Vec3, dir: [0, 1, 0] as Vec3, travel: 70, hole: false }));
  if (malskar) castorPts.forEach((p, i) => (p.on = legs[i]));
  const lift = { ...HW.gasLift, len: Math.round(mechBot - hubTop) };

  const seatUpside = (title: string, detail: string, fn: () => void, scene = "seat") =>
    b.step({ title, detail, tools: ["allen"], scene, pose: "-y", kind: "bolts", warnings: ["floor"] }, () => {
      b.stagger(0);
      fn();
    });
  const stageAll = (keys: string[]) => keys.forEach((k) => b.stage(k, b.partItem(k).final.pos, b.partItem(k).final.rot));

  const baseSteps = () => {
    b.step({ title: "Push a castor into each leg", detail: "The base lies upside down. Press each castor straight in until it clicks; don't push it in at an angle.", pose: "-y", kind: "general", warnings: ["floor"] }, () => {
      if (!malskar) {
        b.add(base, [0, 200, 0]);
        b.then(0.1);
      }
      b.fits(HW.castor, castorPts, 0.16);
    });
  };

  if (malskar) {
    b.step({ title: "Slide the five legs into the hub", detail: "Lay the hub upside down on a rug. Each leg pushes into its socket, holes facing up.", pose: "-y", kind: "join", warnings: ["floor"] }, () => {
      b.add(base, [0, 200, 0]);
      b.then(0.1);
      b.stagger(0.2);
      angles.forEach((a, i) => b.add(legs[i], [Math.cos(a) * 220, 0, -Math.sin(a) * 220]));
    });
    b.step({ title: "Bolt each leg to the hub", detail: "Two bolts in each leg, ten in all. Tighten them firmly with the Allen key.", pose: "-y", kind: "bolts", tools: ["allen"] }, () => {
      const pts: FitOpts[] = [];
      angles.forEach((a, i) => {
        for (const r of [r0 + 45, r0 + 85]) pts.push({ on: legs[i], at: [r * Math.cos(a), ym - armT / 2 + (rm - r) * Math.tan(tilt), -r * Math.sin(a)] as Vec3, dir: [0, 1, 0] });
      });
      b.fits(BOLT, pts, 0.08);
    });
    baseSteps();
    b.step({ title: "Turn the base over and fit the hub cover", detail: "Stand it on its castors. The cover slides down over the hub.", kind: "general" }, () => {
      b.add(cover!, [0, 220, 0]);
    });
    b.step({ title: "Drop the gas lift into the hub", detail: "Pull the protective cap off its top first. The narrow end points up.", kind: "general" }, () => {
      b.fit(lift, { on: base, at: [0, hubTop, 0], dir: [0, -1, 0], travel: 160, hole: false });
    });
    seatUpside("Bolt the seat plate under the seat", "Lay the shell upside down on a rug. The lever points to the right-hand side. Four bolts, tightened firmly.", () => {
      b.stage(shell, b.partItem(shell).final.pos, [0, 0, 0], [0, 200, 0]);
      b.then(0.1);
      b.stage(under[0], b.partItem(under[0]).final.pos, [0, 0, 0], [0, -220, 0]);
      b.then(0.1);
      const pts: FitOpts[] = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ on: under[0], at: [sx * 95, shellBot - 8, zs + sz * 65] as Vec3, dir: [0, 1, 0] as Vec3, mate: shell })));
      b.fits(BOLT, pts, 0.1);
    });
  } else {
    seatUpside("Bolt the mechanism under the seat", "Lay the shell upside down on a rug, the lever to the right. Two bolts, only turned in loosely for now.", () => {
      b.stage(shell, b.partItem(shell).final.pos, [0, 0, 0], [0, 200, 0]);
      b.then(0.1);
      b.stage(under[0], b.partItem(under[0]).final.pos, [0, 0, 0], [0, -220, 0]);
      b.then(0.1);
      b.fits(BOLT, [-1, 1].map((sx) => ({ on: under[0], at: [sx * 110, shellBot - 6, zs - sx * 60] as Vec3, dir: [0, 1, 0] as Vec3, mate: shell })), 0.1);
    });
    seatUpside("Lay the cover plate on and bolt it", "Its round hole goes over the mechanism's socket. Two more bolts, loose again.", () => {
      stageAll([shell, under[0]]);
      b.then(0.1);
      b.stage(under[1], b.partItem(under[1]).final.pos, [0, 0, 0], [0, -200, 0]);
      b.then(0.1);
      b.fits(BOLT, [-1, 1].map((sx) => ({ on: under[1], at: [sx * 50, shellBot - 57, zs + sx * 60] as Vec3, dir: [0, 1, 0] as Vec3, mate: under[0] })), 0.1);
    }, "plate");
    b.step({ title: "Tighten all four bolts", detail: "Now that everything sits square, tighten them firmly until the heads are flat.", tools: ["allen"], scene: "plate", pose: "-y", kind: "bolts" }, () => {
      b.stagger(0);
      stageAll([shell, ...under]);
    });
    baseSteps();
    b.step({ title: "Stand the base up and drop in the gas lift", detail: "Pull the protective cap off its top first. The narrow end points up.", kind: "general" }, () => {
      b.fit(lift, { on: base, at: [0, hubTop, 0], dir: [0, -1, 0], travel: 160, hole: false });
    });
  }

  b.step({ title: "Lower the seat onto the gas lift", detail: "Then sit down on it once, firmly. Your weight locks it in place.", kind: "join" }, () => {
    b.stagger(0);
    seatParts.forEach((k) => b.add(k, [0, 320, 0]));
  });
  return true;
}

const family: Family = {
  names: ["TOSSBERG"],
  build(b, s) {
    const slug = s.slug ?? "";
    if (/malskar/.test(slug)) return swivel(b, s, true);
    if (/langfjall/.test(slug)) return swivel(b, s, false);
    return false;
  },
  recipe(s) {
    if (s.slug === "tossberg-chair" || (/chair/i.test(s.variant) && !/swivel|conference/i.test(s.variant + s.slug))) return dining(s);
    return null;
  },
};
export default family;

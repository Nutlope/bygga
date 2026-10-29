import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * MINNEN extendable bed (steel tube), read from its manual (one manual for the 80x200 and the US twin).
 * Every side rail is two halves, each welded to a sunburst guard. Each half is bolted to its end with two
 * threaded pins in long sleeves at rail height, then its guard with two pins in short sleeves above. The head
 * halves slide into the foot halves, the length is picked (long, middle, short) and locked with two screws a side,
 * four slat stops are screwed on, and all sixteen pins are tightened corner by corner. The slatted base
 * (two halves that slide apart) is laid in and locked at the same length. We draw it pulled out to full length.
 * IKEA's sizes: 80x200 is 86 wide, 137 to 207 long; the US twin 103 wide, 127 to 197; head 92, foot 72, 22 under.
 */

const D = 25; // post tubes
const BAR = 12;
const RY0 = 220, RH = 40; // rails: bottom and height

type P2 = [number, number];

/** A round bar from a to b in an end's plane (x across, y up), at depth z. */
function segXY(a: P2, b: P2, dia = BAR, z = 0): PartPiece {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  return { shape: "cyl", size: [dia, Math.hypot(dx, dy) + dia * 0.4, dia], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z], rot: [0, 0, Math.atan2(-dx, dy)] };
}

/** A round bar from a to b in a side's plane (z along the bed, y up), at x. */
function segZY(a: P2, b: P2, x: number, dia = BAR): PartPiece {
  const dz = b[0] - a[0], dy = b[1] - a[1];
  return { shape: "cyl", size: [dia, Math.hypot(dz, dy) + dia * 0.4, dia], pos: [x, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2], rot: [Math.atan2(dz, dy), 0, 0] };
}

function bounds(pieces: PartPiece[]) {
  const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of pieces) {
    const half = p.size[1] / 2, r = p.size[0] / 2;
    const [rx, , rz] = p.rot ?? [0, 0, 0];
    const ext: Vec3 =
      p.shape === "cyl" && (rx || rz)
        ? [Math.abs(Math.sin(rz)) * half + r, Math.abs(Math.cos(rz) * Math.cos(rx)) * half + r, Math.abs(Math.sin(rx)) * half + r]
        : p.shape === "cyl"
          ? [r, half, r]
          : [p.size[0] / 2, half, p.size[2] / 2];
    for (const k of [0, 1, 2]) {
      lo[k] = Math.min(lo[k], p.pos[k] - ext[k]);
      hi[k] = Math.max(hi[k], p.pos[k] + ext[k]);
    }
  }
  return { lo, hi };
}

/** One part made of pieces given where they sit in the bed. */
function welded(id: string, name: string, pieces: PartPiece[]): CustomPart {
  const { lo, hi } = bounds(pieces);
  const c: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  return {
    id,
    name,
    size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
    pos: c,
    material: "metal",
    pieces: pieces.map((p) => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]] as Vec3 })),
  };
}

function slatRoll(w: number, len: number): PartPiece[] {
  const n = Math.max(6, Math.round(len / 110));
  const pitch = (len - 60) / (n - 1);
  return [
    ...Array.from({ length: n }, (_, i): PartPiece => ({ shape: "box", size: [w, 9, 55], pos: [0, 2, -len / 2 + 30 + i * pitch] })),
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [24, 4, len], pos: [sx * (w / 2 - 90), -4, 0], material: "fiber" })),
  ];
}

const PIN = { kind: "bolt" as const, name: "Threaded pin", len: 60, dia: 6 };
const SCREW = { kind: "screw" as const, len: 12, dia: 6 };

function recipe(s: ProductSpec) {
  const slug = s.slug ?? "";
  if (!/^minnen-ext-bed-frame/.test(slug)) return null;
  const us = /97-x-190/.test(slug);
  const W = us ? 1030 : 860, L = us ? 1970 : 2070;
  const HH = 920, FH = 720;
  const nBars = us ? 11 : 9;
  const xp = W / 2 - D / 2, zh = -L / 2 + D / 2, zf = L / 2 - D / 2;
  const z0 = zh + D / 2, z1 = zf - D / 2;
  const yb = RY0 + RH + 30; // the ends' bottom bar
  const parts: CustomPart[] = [];

  /** An end: two posts with round corners into the top bar, a bottom bar, straight bars with a ring on top. */
  const end = (id: string, name: string, z: number, H: number) => {
    const R = 55;
    const ps: PartPiece[] = [...[-1, 1].map((sx) => segXY([sx * xp, 0], [sx * xp, H - R], D, z)), segXY([-xp + R, H - D / 2], [xp - R, H - D / 2], D, z), segXY([-xp, yb], [xp, yb], 16, z)];
    for (const sx of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const t0 = (Math.PI / 2) * (i / 3), t1 = (Math.PI / 2) * ((i + 1) / 3);
        const at = (t: number): P2 => [sx * (xp - R + R * Math.cos(t)), H - R - D / 2 + R * Math.sin(t)];
        ps.push(segXY(at(t0), at(t1), D, z));
      }
    const step = (2 * xp) / (nBars + 1);
    for (let i = 1; i <= nBars; i++) {
      const x = -xp + i * step;
      ps.push(segXY([x, yb], [x, H - D - 20], BAR, z));
      ps.push({ shape: "cyl", size: [34, 8, 34], pos: [x, H - D - 4, z], rot: [Math.PI / 2, 0, 0] });
    }
    parts.push(welded(id, name, ps));
  };
  end("HB", "Headboard", zh, HH);
  end("FB", "Footboard", zf, FH);

  // the side rails, two halves each with its sunburst guard; the head half slides inside the foot half
  const zm = (z0 + z1) / 2, lap = 160;
  const fan = (x: number, zPost: number, toward: number, top: number, span: number) => {
    // a curved bar from the post down to the rail, spokes from the corner by the post
    const n = 8;
    const pt = (t: number): P2 => [zPost + toward * span * Math.sin(t), RY0 + RH + (top - RY0 - RH) * Math.cos(t)];
    const curve: P2[] = Array.from({ length: n + 1 }, (_, i) => pt((Math.PI / 2) * (i / n)));
    const hub: P2 = [zPost + toward * 30, RY0 + RH + 20];
    return [
      ...curve.slice(1).map((p, i) => segZY(curve[i], p, x, 16)),
      ...[1, 2, 3, 4, 5, 6, 7].map((i) => segZY(hub, curve[i], x, 11)),
      segZY(hub, [zPost + toward * span * 0.98, RY0 + RH + 8], x, 11),
    ];
  };
  const halves = [-1, 1].flatMap((sx) => {
    const lipX = sx * (xp - 20);
    const head = welded(`RH${sx}`, "Rail, head half", [
      { shape: "box", size: [3, RH - 6, zm + lap / 2 - z0], pos: [sx * (xp - 5), RY0 + 3 + (RH - 6) / 2, (z0 + zm + lap / 2) / 2] },
      { shape: "box", size: [26, 3, zm + lap / 2 - z0], pos: [lipX + sx * 3, RY0 + 4.5, (z0 + zm + lap / 2) / 2] },
      ...fan(sx * (xp - 5), z0, 1, HH * 0.62, us ? 560 : 640),
    ]);
    const foot = welded(`RF${sx}`, "Rail, foot half", [
      { shape: "box", size: [3, RH, z1 - (zm - lap / 2)], pos: [sx * (xp - 1.5), RY0 + RH / 2, (z1 + zm - lap / 2) / 2] },
      { shape: "box", size: [30, 3, z1 - (zm - lap / 2)], pos: [lipX + sx * 3, RY0 + 1.5, (z1 + zm - lap / 2) / 2] },
      ...fan(sx * (xp - 1.5), z1, -1, FH * 0.66, us ? 440 : 480),
    ]);
    return [head, foot];
  });
  parts.push(...halves);

  // the slatted base, two halves pulled apart to the bed's length
  const yS = RY0 + 6;
  const bw = 2 * (xp - 8) - 6;
  const bl = (z1 - z0 - 20) / 2;
  for (const [id, z] of [["SB1", z0 + 10 + bl / 2], ["SB2", z1 - 10 - bl / 2]] as const)
    parts.push({ id, name: "Slatted base half", size: [bw, 14, bl - 4], pos: [0, yS + 7, z], material: "wood", pieces: slatRoll(bw, bl - 4) });

  const sides = [-1, 1];
  const postFix = (sz: number, ys: number[], long: boolean): CustomFix[] => {
    const z = sz < 0 ? zh - D / 2 : zf + D / 2;
    const at = sides.flatMap((sx) => ys.map((y): Vec3 => [sx * xp, y, z]));
    const dir: Vec3 = [0, 0, sz < 0 ? 1 : -1];
    return [
      { ...PIN, count: at.length, at, dir, on: sz < 0 ? "HB" : "FB" },
      { kind: "nut", name: long ? "Long sleeve nut" : "Short sleeve nut", count: at.length, len: long ? 30 : 18, dia: 10, at, dir },
    ];
  };
  const fanTop = (sz: number) => (sz < 0 ? HH * 0.62 : FH * 0.66) - 20;

  const steps: CustomStep[] = [
    {
      title: "Bolt the rail halves to the ends",
      detail: "Screw each threaded pin into a long sleeve, then through the post into the rail. Two at each post, not tight yet.",
      add: ["HB", "RH-1", "RH1", "FB", "RF-1", "RF1"],
      fix: [...postFix(-1, [RY0 + RH / 2 - 12, RY0 + RH / 2 + 12], true), ...postFix(1, [RY0 + RH / 2 - 12, RY0 + RH / 2 + 12], true)],
      tools: ["allen"],
      from: { "RH-1": [0, 0, 400], RH1: [0, 0, 400], "RF-1": [0, 0, -400], RF1: [0, 0, -400] },
    },
    {
      title: "Bolt the guards to the posts",
      detail: "Short sleeves this time: one pin at the top of each guard and one at its foot.",
      fix: [...postFix(-1, [yb + 20, fanTop(-1)], false), ...postFix(1, [yb + 20, fanTop(1)], false)],
      tools: ["allen"],
    },
    {
      title: "Slide the head and foot halves together",
      detail: "The head halves slide inside the foot halves. Stand both ends up and push them towards each other.",
      people: 2,
    },
    {
      title: "Lock the rails at the length you want",
      detail: "Long, middle or short: line up the holes and screw two screws up through each rail from underneath.",
      fix: sides.map((sx): CustomFix => ({ ...SCREW, count: 2, at: [-1, 1].map((d): Vec3 => [sx * (xp - 22), RY0, zm + d * (lap / 2 - 25)]), dir: [0, 1, 0], on: `RF${sx}`, mate: `RH${sx}` })),
      tools: ["allen"],
    },
    {
      title: "Screw on the slat stops",
      detail: "One on each rail by each end, the screw going up from underneath.",
      fix: [
        { kind: "cap", name: "Slat stop", count: 4, len: 18, dia: 26, at: sides.flatMap((sx) => [z0 + 25, z1 - 25].map((z): Vec3 => [sx * (xp - 20), yS + 4, z])), dir: [0, -1, 0] },
        { ...SCREW, count: 4, at: sides.flatMap((sx) => [z0 + 25, z1 - 25].map((z): Vec3 => [sx * (xp - 20), RY0, z])), dir: [0, 1, 0] },
      ],
      tools: ["allen"],
    },
    {
      title: "Tighten all the pins",
      detail: "Corner by corner, all sixteen, so the frame pulls square.",
      tools: ["allen"],
      check: "square",
    },
    {
      title: "Lay in the slatted base",
      detail: "Pull its two halves apart to the bed's length, lay it on the rails and push the two locks on each side into place.",
      add: ["SB1", "SB2"],
      from: { SB1: [0, 300, 0], SB2: [0, 300, 0] },
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["MINNEN"],
  recipe,
};
export default family;

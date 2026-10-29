import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * SANDSBERG, read from the table underframe's and the chair's manuals.
 * The table: the top lies face down on a rug, the welded steel frame goes on it, four corner brackets click into
 * its corners and ten screws hold it to the top. Each leg stands in a corner and is pulled tight by one bolt with a
 * washer through the bracket, tightened with the spanner.
 * The chair: one side frame (front leg, seat rail and the kinked back leg in one tube) lies on a rug, the two cross
 * tubes are bolted into it, the other side goes on top and is bolted the same way, nuts on all four bolts. Stood up,
 * the backrest is pushed onto the uprights and screwed, the nuts are tightened, two clips go on the front tube and
 * the seat hooks into them and clicks down.
 */

const TUBE = 20;

function fx(kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on?: string, o: Partial<CustomFix> = {}): CustomFix {
  return { kind, count: at.length, at, dir, on, ...o };
}

/** A round tube from one point to another in a side frame's plane (x fixed). */
function tube(a: Vec3, b: Vec3, d = TUBE): PartPiece {
  const dy = b[1] - a[1], dz = b[2] - a[2];
  return { shape: "cyl", size: [d, Math.hypot(dy, dz) + d * 0.6, d], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [Math.atan2(dz, dy), 0, 0] };
}

/** Pieces given in product coordinates, made relative to their joint box, as one part. */
function assembled(id: string, name: string, abs: PartPiece[], pad: number, material: CustomPart["material"]): CustomPart {
  const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of abs) {
    const r = p.rot?.some((v) => v) ? p.size[1] / 2 : 0;
    const half: Vec3 = r ? [p.size[0] / 2, Math.abs(Math.cos(p.rot![0])) * r + pad, Math.abs(Math.sin(p.rot![0])) * r + pad] : [p.size[0] / 2, p.size[1] / 2, p.size[2] / 2];
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], p.pos[k] - half[k]);
      hi[k] = Math.max(hi[k], p.pos[k] + half[k]);
    }
  }
  const c: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  return { id, name, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: c, pieces: abs.map((p) => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]] as Vec3 })), material };
}

// ---------- the table ----------

function table(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const topT = 18, legD = 32;
  const yU = H - topT;
  const fh = 60, ft = 15; // frame bar height and thickness
  const xl = W / 2 - 40, zl = D / 2 - 40; // leg centres
  const xo = xl - legD / 2, zo = zl - legD / 2; // outside of the frame, against the legs
  const frame: PartPiece[] = [
    ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [2 * xo, fh, ft], pos: [0, 0, sz * (zo - ft / 2)] })),
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [ft, fh, 2 * zo - 2 * ft], pos: [sx * (xo - ft / 2), 0, 0] })),
  ];
  const parts: CustomPart[] = [
    { id: "TOP", name: "Table top", size: [W, topT, D], pos: [0, H - topT / 2, 0], material: "board" },
    { id: "FRAME", name: "Frame", size: [2 * xo, fh, 2 * zo], pos: [0, yU - fh / 2, 0], pieces: frame, material: "metal" },
  ];
  const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx, sz] as const));
  const legs = corners.map((_, i) => `LEG${i}`);
  corners.forEach(([sx, sz], i) => parts.push({ id: legs[i], name: "Leg", size: [legD, yU, legD], pos: [sx * xl, yU / 2, sz * zl], shape: "cyl", material: "metal" }));
  const inCorner = (sx: number, sz: number, d: number): Vec3 => [sx * (xo - ft - d), yU - fh / 2, sz * (zo - ft - d)];
  const screws: Vec3[] = [
    ...[-1, 1].flatMap((sz) => [-0.6, 0, 0.6].map((t): Vec3 => [t * xo, yU - fh, sz * (zo - ft / 2)])),
    ...[-1, 1].flatMap((sx) => [-0.4, 0.4].map((t): Vec3 => [sx * (xo - ft / 2), yU - fh, t * zo])),
  ];
  const diag = (sx: number, sz: number): Vec3 => [sx * Math.SQRT1_2, 0, sz * Math.SQRT1_2];
  const steps: CustomStep[] = [
    {
      title: "Lay the frame on the top",
      detail: "Put the top face down on a rug and centre the frame on it, so the holes line up.",
      add: ["TOP", "FRAME"],
      from: { TOP: [0, -200, 0] },
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Click a bracket into each corner",
      detail: "Hook it in at one side, then press the other side in until it sits flat against both bars.",
      fix: corners.map(([sx, sz]) => fx("angle", [inCorner(sx, sz, 8)], diag(sx, sz), "FRAME", { name: "Corner bracket", len: 50, dia: 40 })),
    },
    { title: "Screw the frame to the top", detail: "Ten screws through the frame into the top. Tighten them evenly.", fix: [fx("screw", screws, [0, 1, 0], "FRAME", { len: 70, dia: 6, mate: "TOP" })], tools: ["allen"] },
    {
      title: "Bolt on the legs",
      detail: "Stand each leg in a corner. A washer on the bolt, then turn it through the bracket into the leg by hand.",
      add: legs,
      fix: corners.map(([sx, sz], i) => fx("bolt", [inCorner(sx, sz, 20)], diag(sx, sz), "FRAME", { name: "Hex bolt", len: 40, dia: 8, mate: legs[i] })).concat(corners.map(([sx, sz]) => fx("washer", [inCorner(sx, sz, 20)], diag(sx, sz), "FRAME", { dia: 16 }))),
    },
    { title: "Tighten the leg bolts with the spanner", detail: "Firmly, so the legs can't turn. Keep the spanner to tighten them again later.", tools: ["wrench"], check: "square" },
    { title: "Turn the table over", detail: "Lift it onto its legs.", pose: "+y" },
  ];
  return { parts, steps };
}

// ---------- the chair ----------

function chair(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const xs = W / 2 - TUBE / 2 - 5; // side frames
  const yR = 430; // seat rails
  const zF0 = D / 2 - 30, zF1 = zF0 - 20; // front leg at the floor and at the seat
  const zB0 = -D / 2 + 20, zK = zB0 + 70, zT = zK - 35, yT = H - 70; // back leg foot, kink at the seat, top of the upright
  const sides = ["SIDE_L", "SIDE_R"];
  const parts: CustomPart[] = [];
  [-1, 1].forEach((sx, i) => {
    const x = sx * xs;
    parts.push(
      assembled(
        sides[i],
        "Side frame",
        [tube([x, 0, zF0], [x, yR, zF1]), tube([x, yR, zF1], [x, yR, zK]), tube([x, 0, zB0], [x, yR, zK]), tube([x, yR, zK], [x, yT, zT])],
        TUBE / 2,
        "metal",
      ),
    );
  });
  // cross tubes between the sides, at the front and the back of the seat
  const zc = [zF1 - 30, zK + 30];
  const cross = ["CROSS_F", "CROSS_B"];
  cross.forEach((id, i) => parts.push({ id, name: "Cross tube", size: [2 * xs + TUBE, TUBE, TUBE], pos: [0, yR - TUBE, zc[i]], shape: "cyl", material: "metal" }));
  // the backrest sits on the tops of the uprights, the seat on the rails
  parts.push({ id: "BACK", name: "Backrest", size: [W - 10, 150, 22], pos: [0, H - 75, zT - 4], rot: [-0.12, 0, 0], material: "board" });
  const seatZ0 = zK + 15, seatZ1 = D / 2 - 40;
  parts.push({ id: "SEAT", name: "Seat", size: [W - 10, 30, seatZ1 - seatZ0], pos: [0, yR + TUBE / 2 + 15, (seatZ0 + seatZ1) / 2], material: "board" });

  // the tube ends lie under the seat rails: each bolt goes down through the rail's bracket and the tube, the nut under it
  const bolts = (sx: number, i: number) => zc.map((z) => fx("bolt", [[sx * xs, yR + TUBE / 2, z]], [0, -1, 0], sides[i], { name: "Hex bolt", len: 35, dia: 6 }));
  const nuts = [-1, 1].map((sx, i) => fx("nut", zc.map((z): Vec3 => [sx * xs, yR - 1.5 * TUBE, z]), [0, 1, 0], sides[i], { dia: 10 }));
  const steps: CustomStep[] = [
    {
      title: "Lay a side frame on the rug and stand a cross tube in it",
      detail: "Holes facing up. The cross tube's flat end goes into the bracket at the front of the seat rail.",
      add: ["SIDE_L", "CROSS_F"],
      pose: "+x",
      warnings: ["floor"],
    },
    { title: "Stand the second cross tube in it", detail: "Into the bracket at the back of the seat rail.", add: ["CROSS_B"] },
    { title: "Bolt the tubes to the side", detail: "One bolt down through the side frame into each tube end, by hand for now.", fix: bolts(-1, 0), tools: ["wrench"] },
    { title: "Turn the other side over and lower it on", detail: "Its brackets go over the free ends of the cross tubes.", add: ["SIDE_R"], from: { SIDE_R: [300, 0, 0] } },
    { title: "Bolt the tubes to it", detail: "Two more bolts, the same way.", fix: bolts(1, 1) },
    { title: "Screw a nut onto each bolt", detail: "All four, turned on by hand.", fix: nuts },
    { title: "Stand it up and push the backrest on", detail: "Press it down over the tops of the uprights as far as it goes.", add: ["BACK"], pose: "+y", from: { BACK: [0, 220, 0] } },
    { title: "Screw the backrest on", detail: "One screw through the back of each upright.", fix: [fx("screw", [-1, 1].map((sx): Vec3 => [sx * xs, H - 90, zT - TUBE / 2]), [0, 0, 1], undefined, { len: 16, dia: 4, mate: "BACK" })], tools: ["screwdriver"] },
    { title: "Tighten the four nuts", detail: "With the spanner, one after another round the chair, so it stands square.", tools: ["wrench"], check: "square" },
    { title: "Clip two holders onto the front tube", detail: "From underneath, one near each end, pushed up until they snap on.", fix: [fx("clip", [-1, 1].map((sx): Vec3 => [sx * (xs - 70), yR - TUBE * 1.5, zc[0]]), [0, 1, 0], "CROSS_F", { name: "Seat holder", len: 30, dia: 24 })] },
    { title: "Hook the seat into the holders", detail: "Tip the back of the seat up and push its front hooks into the two holders.", add: ["SEAT"], from: { SEAT: [0, 160, 120] } },
    { title: "Press the seat down until it clicks", detail: "Push down at the back until all six clips snap onto the frame." },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["SANDSBERG"],
  recipe(s) {
    const t = `${s.variant} ${s.slug ?? ""}`;
    if (/chair/i.test(t)) return chair(s);
    if (/table/i.test(t) && s.archetype === "table") return table(s);
    return null;
  },
};
export default family;

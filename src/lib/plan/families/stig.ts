import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * STIG, read from the bar stool with backrest's manual. The steel frame goes together standing up: a seat rail is
 * bolted to each top corner of the bent front legs, the back legs go onto the rails' other ends, the curved back rail
 * and a cross tube join the back legs, the backrest shell slides down the uprights and is screwed, the footrest ring
 * is bolted on, everything is tightened, and the plastic seat slides on and clicks. The plain bar stool (74 cm) has no
 * manual here and keeps its old guide.
 */

function fx(kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on?: string, o: Partial<CustomFix> = {}): CustomFix {
  return { kind, count: at.length, at, dir, on, ...o };
}

const T = 22; // tube

/** A straight tube from a to b, as a cylinder turned to lie along it. */
function tube(a: Vec3, b: Vec3, o: Vec3 = [0, 0, 0]): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  // a cylinder stands along y: tip it over about z for x, then about x for z
  const rz = -Math.atan2(d[0], Math.hypot(d[1], d[2]));
  const rx = Math.atan2(d[2], d[1]);
  return { shape: "cyl", size: [T, len, T], pos: [(a[0] + b[0]) / 2 - o[0], (a[1] + b[1]) / 2 - o[1], (a[2] + b[2]) / 2 - o[2]], rot: [rx, 0, rz], material: "metal" };
}

/** One part made of tubes, its box worked out from their ends. */
function welded(id: string, name: string, ends: [Vec3, Vec3][]): CustomPart {
  const all = ends.flat();
  const lo = [0, 1, 2].map((k) => Math.min(...all.map((p) => p[k])) - T / 2);
  const hi = [0, 1, 2].map((k) => Math.max(...all.map((p) => p[k])) + T / 2);
  const mid = lo.map((v, k) => (v + hi[k]) / 2) as Vec3;
  return { id, name, size: lo.map((v, k) => hi[k] - v) as Vec3, pos: mid, pieces: ends.map(([a, b]) => tube(a, b, mid)), material: "metal" };
}

function backrest(s: ProductSpec): CustomParams {
  const H = 900, SH = s.seat?.seatH ? s.seat.seatH * 10 : 630;
  const yR = SH - 35; // seat rails, under the seat
  const xf = 185, zf = 185, xt = 162, zt = 140; // front legs: foot, top
  const xb = 185, zb = -205, zbt = -150; // back legs
  const yF = 210; // footrest ring
  const yX = 380; // back cross tube
  const parts: CustomPart[] = [
    welded("FF", "Front legs", [
      [[-xf, 0, zf], [-xt, yR, zt]],
      [[xf, 0, zf], [xt, yR, zt]],
      [[-xt, yR - 30, zt + 4], [xt, yR - 30, zt + 4]],
    ]),
  ];
  for (const [i, sx] of [-1, 1].entries()) parts.push({ id: `R${i}`, name: "Seat rail", size: [6, 30, zt - zbt], pos: [sx * (xt - T / 2 - 3), yR, (zt + zbt) / 2], material: "metal" });
  for (const [i, sx] of [-1, 1].entries())
    parts.push(
      welded(`B${i}`, "Back leg", [
        [[sx * xb, 0, zb], [sx * xt, yR, zbt]],
        [[sx * xt, yR, zbt], [sx * 152, H - 10, zbt - 45]],
      ]),
    );
  // its ends sit against the back legs' tubes
  parts.push({ id: "BR", name: "Back rail", size: [2 * xt, 30, 6], pos: [0, yR, zbt - T / 2 - 3], material: "metal" });
  const xx = xb - ((xb - xt) * yX) / yR, zx = zb + ((zbt - zb) * yX) / yR;
  parts.push({ id: "X", name: "Cross tube", size: [2 * xx - T, T, T], pos: [0, yX, zx], shape: "cyl", material: "metal" });
  parts.push({ id: "BS", name: "Backrest", size: [330, 210, 14], pos: [0, H - 120, zbt - 45 + 4], rot: [-0.1, 0, 0], material: "board" });
  const xr = xf - ((xf - xt) * yF) / yR, zrf = zf - ((zf - zt) * yF) / yR, zrb = zb + ((zbt - zb) * yF) / yR;
  parts.push(
    welded("FR", "Footrest ring", [
      [[-xr, yF, zrf + T], [xr, yF, zrf + T]],
      [[-xr - T, yF, zrf + T], [-xr - T, yF, zrb]],
      [[xr + T, yF, zrf + T], [xr + T, yF, zrb]],
    ]),
  );
  parts.push({ id: "ST", name: "Seat", size: [360, 30, 340], pos: [0, SH - 15, (zt + zbt) / 2 + 10], material: "board" });

  const A = { len: 40, dia: 6 };
  const railBolt = (i: number, z: number, on: string) => {
    const sx = i ? 1 : -1;
    return fx("bolt", [[sx * (xt + T / 2), yR - 8, z]], [-sx, 0, 0], on, A);
  };
  const steps: CustomStep[] = [
    {
      title: "Bolt a seat rail to the front legs",
      detail: "Use the straight rail, holes towards the back. One bolt through the leg's top corner, turned in by hand for now.",
      add: ["FF", "R0"],
      fix: [railBolt(0, zt - 4, "FF")],
      tools: ["allen"],
    },
    { title: "Bolt on the other seat rail", detail: "The same on the right, one bolt, loose for now.", add: ["R1"], fix: [railBolt(1, zt - 4, "FF")], tools: ["allen"] },
    {
      title: "Fit a back leg to the left rail",
      detail: "One of the longer bolts through the leg into the rail's end.",
      add: ["B0"],
      fix: [fx("bolt", [[-(xt + T / 2), yR - 8, zbt + 4]], [1, 0, 0], "B0", { len: 55, dia: 6, name: "Long bolt" })],
      tools: ["allen"],
    },
    {
      title: "Bolt on the curved back rail",
      detail: "Curve towards the back. One bolt through the left back leg.",
      add: ["BR"],
      fix: [fx("bolt", [[-xt, yR, zbt - T / 2 - 6]], [0, 0, 1], "B0", A)],
      tools: ["allen"],
    },
    {
      title: "Push the other back leg on",
      detail: "Slide it onto the free ends of the back rail and the right seat rail, then a bolt through the back rail.",
      add: ["B1"],
      fix: [fx("bolt", [[xt, yR, zbt - T / 2 - 6]], [0, 0, 1], "B1", A)],
      tools: ["allen"],
    },
    { title: "Bolt it to the seat rail", detail: "One of the longer bolts.", fix: [fx("bolt", [[xt + T / 2, yR - 8, zbt + 4]], [-1, 0, 0], "B1", { len: 55, dia: 6, name: "Long bolt" })], tools: ["allen"] },
    {
      title: "Bolt the cross tube between the back legs",
      detail: "One bolt through each back leg into the tube's ends.",
      add: ["X"],
      fix: [-1, 1].map((sx) => fx("bolt", [[sx * (xx + T / 2), yX, zx]], [-sx, 0, 0], sx < 0 ? "B0" : "B1", A)),
      tools: ["allen"],
    },
    { title: "Slide the backrest down the uprights", detail: "Its sleeves go over the tops of the back legs. Push it all the way down.", add: ["BS"], from: { BS: [0, 300, 0] } },
    {
      title: "Screw the backrest on",
      detail: "One small screw from behind into each upright.",
      fix: [fx("screw", [-1, 1].map((sx): Vec3 => [sx * 150, H - 120, zbt - 45 - 8]), [0, 0, 1], "BS", { len: 16, dia: 4 })],
      tools: ["screwdriver"],
    },
    {
      title: "Bolt the footrest ring to the front legs",
      detail: "The short bolts, one through each front leg.",
      add: ["FR"],
      fix: [-1, 1].map((sx) => fx("bolt", [[sx * (xr + T / 2), yF, zrf]], [-sx, 0, 0], "FR", { len: 20, dia: 6, name: "Short bolt" })),
      tools: ["allen"],
    },
    {
      title: "Bolt its ends to the back legs",
      detail: "One bolt through each back leg.",
      fix: [-1, 1].map((sx) => fx("bolt", [[sx * (xr + T * 1.5), yF, zrb + 10]], [-sx, 0, 0], "FR", { len: 30, dia: 6, name: "Bolt" })),
      tools: ["allen"],
    },
    {
      title: "Put the nuts on the long bolts",
      detail: "Hold each nut with the spanner inside the rail while you turn the bolt with the Allen key.",
      fix: [fx("nut", [-1, 1].map((sx): Vec3 => [sx * (xt - T / 2 - 6), yR - 8, zbt + 4]), [0, 0, 1], undefined, { dia: 6 })],
      tools: ["allen", "wrench"],
    },
    { title: "Tighten all six frame bolts", detail: "Stand the frame on a flat floor so all four feet touch, then tighten each bolt firmly.", tools: ["allen"], check: "square" },
    { title: "Tighten the footrest bolts", detail: "All four, firmly.", tools: ["allen"] },
    {
      title: "Click the seat on",
      detail: "Slide it onto the rails from the back, then press down at the front until it clicks on both sides.",
      add: ["ST"],
      from: { ST: [0, 80, -250] },
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["STIG"],
  recipe(s) {
    if (!/backrest/i.test(`${s.slug ?? ""} ${s.variant}`)) return null;
    return backrest(s);
  },
};
export default family;

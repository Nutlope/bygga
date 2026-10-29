import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, Vec3 } from "../../types";

/**
 * BOCKÖN hammock stand, read from its manual: a foot clicked and screwed onto each end of the two cross tubes, the
 * centre tube pushed into their sockets and bolted, then the two curved arms slid onto the outer sockets and bolted
 * by two people, and a U-hook through the tip of each arm held with two cap nuts. Steel tubes throughout.
 */

const fx = (kind: CustomFix["kind"], on: string, dir: Vec3, at: Vec3[], o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, on, dir, at, ...o });
const ALONG_X: Vec3 = [0, 0, Math.PI / 2];
const ALONG_Z: Vec3 = [Math.PI / 2, 0, 0];

/** One part drawn as pieces placed where they sit in the product; its box and centre are worked out from them. */
function compound(id: string, name: string, abs: (PartPiece & { reach: Vec3 })[]): CustomPart {
  const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of abs)
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], p.pos[k] - p.reach[k]);
      hi[k] = Math.max(hi[k], p.pos[k] + p.reach[k]);
    }
  const pos = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2) as Vec3;
  const size = [0, 1, 2].map((k) => hi[k] - lo[k]) as Vec3;
  const pieces = abs.map(({ reach: _r, ...p }) => ({ ...p, pos: [p.pos[0] - pos[0], p.pos[1] - pos[1], p.pos[2] - pos[2]] as Vec3 }));
  return { id, name, size, pos, pieces, material: "metal" };
}

/** A tube from a to b in the x-y plane, as a piece with how far it reaches from its centre along each axis. */
function tube(a: [number, number], b: [number, number], dia: number): PartPiece & { reach: Vec3 } {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = Math.hypot(dx, dy);
  const ang = -Math.atan2(dx, dy);
  const reach: Vec3 = [Math.abs(dx) / 2 + dia / 2, Math.abs(dy) / 2 + dia / 2, dia / 2];
  return { shape: "cyl", size: [dia, L, dia], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0], rot: [0, 0, ang], reach };
}

function hammockStand(): CustomParams {
  // the page: 308 long, 100 wide, 123 high
  const L = 3080, Wd = 1000, H = 1230;
  const d = 50, sd = 60, y = 45; // tube and socket diameters, tube centre height (on its feet)
  const xc = 450; // the cross tubes
  const sock = 80;
  const xIn = xc - d / 2 - sock / 2, xOut = xc + d / 2 + sock / 2; // socket centres
  const tipX = L / 2 - d / 2, tipY = H - d / 2, bendX = 760;
  const cross = (sx: number) =>
    compound(sx < 0 ? "C1" : "C2", "Cross tube", [
      { shape: "cyl", size: [d, Wd, d], pos: [sx * xc, y, 0], rot: ALONG_Z, reach: [d / 2, d / 2, Wd / 2] },
      { shape: "cyl", size: [sd, sock, sd], pos: [sx * xIn, y, 0], rot: ALONG_X, reach: [sock / 2, sd / 2, sd / 2] },
      { shape: "cyl", size: [sd, sock, sd], pos: [sx * xOut, y, 0], rot: ALONG_X, reach: [sock / 2, sd / 2, sd / 2] },
    ]);
  const arm = (sx: number) =>
    compound(sx < 0 ? "A1" : "A2", "Arm", [
      tube([sx * (xc + d / 2 + 5), y], [sx * bendX, y], d),
      tube([sx * (bendX - 20), y - 5], [sx * tipX, tipY], d),
    ]);
  const parts: CustomPart[] = [
    cross(-1),
    cross(1),
    { id: "CT", name: "Centre tube", size: [2 * (xc - d / 2), d, d], pos: [0, y, 0], shape: "cyl", material: "metal" },
    arm(-1),
    arm(1),
  ];
  const zf = Wd / 2 - 45;
  const feet = (sx: number): Vec3[] => [-1, 1].map((sz) => [sx * xc, 0, sz * zf]);
  // bolts go in from the front and back of a socket, two each side, into the tube inside it
  const sockBolts = (x: number): { at: Vec3; dir: Vec3 }[] => [-1, 1].flatMap((sz) => [-15, 15].map((dx) => ({ at: [x + dx, y, sz * (sd / 2)] as Vec3, dir: [0, 0, -sz] as Vec3 })));
  const joint = (on: string, mate: string, x: number): CustomFix[] => {
    const pts = sockBolts(x);
    return [-1, 1].flatMap((sz) => {
      const at = pts.filter((p) => Math.sign(p.at[2]) === sz).map((p) => p.at);
      const dir: Vec3 = [0, 0, -sz];
      return [
        fx("washer", on, dir, at, { dia: 18 }),
        fx("washer", on, dir, at, { dia: 12, name: "Spring washer" }),
        fx("bolt", on, dir, at, { mate, len: 18, dia: 8 }),
      ];
    });
  };
  const hookAt = (sx: number): Vec3 => [sx * (tipX - 40), tipY + d / 2, 0];
  const nuts = (sx: number): Vec3[] => [-12, 12].map((dx) => [sx * (tipX - 40) + dx, tipY - d / 2, 0]);
  const steps: CustomStep[] = [
    {
      title: "Click the feet onto the cross tubes",
      detail: "One on each end, pushed on until it clicks, with the screw hole facing down.",
      add: ["C1", "C2"],
      fix: [-1, 1].map((sx) => fx("foot", sx < 0 ? "C1" : "C2", [0, 1, 0], feet(sx), { len: 40, dia: 58, name: "Foot" })),
      warnings: ["floor"],
    },
    {
      title: "Screw the feet on",
      detail: "One screw up through each foot into the tube.",
      fix: [-1, 1].map((sx) => fx("screw", sx < 0 ? "C1" : "C2", [0, 1, 0], feet(sx).map(([x, , z]) => [x, 0, z + Math.sign(z) * 30] as Vec3), { len: 30, dia: 4 })),
      tools: ["screwdriver"],
    },
    {
      title: "Push the cross tubes onto the centre tube",
      detail: "Turn them so their smaller sockets face each other, feet down, and push one onto each end of the centre tube.",
      add: ["CT"],
      from: { CT: [0, 260, 0] },
    },
    {
      title: "Bolt the centre tube in",
      detail: "Four bolts at each end, each with a washer and a spring washer. Tighten them with the Allen key.",
      fix: [...joint("C1", "CT", -xIn), ...joint("C2", "CT", xIn)],
      tools: ["allen"],
    },
    {
      title: "Slide an arm onto one end together",
      detail: "One of you holds the arm up while the other pushes it into the outer socket, then four bolts with their washers.",
      add: ["A1"],
      from: { A1: [-500, 0, 0] },
      fix: joint("C1", "A1", -xOut),
      tools: ["allen"],
      people: 2,
    },
    {
      title: "Fit the other arm the same way",
      detail: "Four more bolts with their washers.",
      add: ["A2"],
      from: { A2: [500, 0, 0] },
      fix: joint("C2", "A2", xOut),
      tools: ["allen"],
      people: 2,
    },
    {
      title: "Fit a hook at the top of each arm",
      detail: "Push the U-hook down through the two holes near the tip and turn a cap nut onto each leg with the Allen key.",
      fix: [-1, 1].flatMap((sx) => {
        const on = sx < 0 ? "A1" : "A2";
        return [fx("hook", on, [0, -1, 0], [hookAt(sx)], { len: 70, dia: 30, name: "U-hook" }), fx("nut", on, [0, 1, 0], nuts(sx), { len: 14, dia: 12, name: "Cap nut" })];
      }),
      tools: ["allen"],
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["BOCKÖN", "BOCKON"],
  recipe(s) {
    if (/hammock stand/i.test(s.variant)) return hammockStand();
    return null;
  },
};
export default family;

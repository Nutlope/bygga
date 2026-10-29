import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * NACKANÄS, read from the dining table's manual. Each end is one solid T-leg (foot, post and top arm). Felt pads are
 * tapped into the feet and a dowel into each post, then the low stretcher goes between the posts on two barrel nuts and
 * four bolts, and the two aprons between the top arms on four barrel nuts and eight bolts. The top comes in two long
 * halves, joined on a rug with four dowels and spacer rings; the base goes on upside down, eight bolts with washers
 * through the aprons and eight through the arms. All bolts are the same long one (28 in all).
 * IKEA: 140 x 76, 75 high.
 */

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });
const BOLT = { len: 100, dia: 6 };

function recipe(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 1400, D = 760, H = 750;
  const TT = 30, yU = H - TT;
  const xL = W / 2 - 250; // the legs sit well in from the ends
  const lw = 60, armH = 90, armL = 600, footH = 80, footL = 640, postD = 90;
  const yArm = yU - armH;
  const cy = yU / 2;
  const leg = (sx: number): CustomPart => {
    const pieces: PartPiece[] = [
      { shape: "box", size: [lw, footH, footL], pos: [0, footH / 2 - cy, 0] },
      { shape: "box", size: [lw, yArm - footH, postD], pos: [0, (footH + yArm) / 2 - cy, 0] },
      { shape: "box", size: [lw, armH, armL], pos: [0, yArm + armH / 2 - cy, 0] },
    ];
    return { id: sx < 0 ? "L1" : "L2", name: "Leg", size: [lw, yU, footL], pos: [sx * xL, cy, 0], material: "wood", pieces };
  };
  const inner = xL - lw / 2;
  const yS = 280, hS = 160, tS = 40; // stretcher
  const zA = 240, hA = armH, tA = 25; // aprons
  const yA = yU - hA / 2;
  const halfD = D / 2;
  const parts: CustomPart[] = [
    leg(-1),
    leg(1),
    { id: "ST", name: "Stretcher", size: [2 * inner, hS, tS], pos: [0, yS, 0], material: "wood" },
    { id: "A1", name: "Apron", size: [2 * inner, hA, tA], pos: [0, yA, -zA], material: "wood" },
    { id: "A2", name: "Apron", size: [2 * inner, hA, tA], pos: [0, yA, zA], material: "wood" },
    { id: "TB", name: "Table top half", size: [W, TT, halfD], pos: [0, H - TT / 2, -halfD / 2], material: "wood" },
    { id: "TA", name: "Table top half", size: [W, TT, halfD], pos: [0, H - TT / 2, halfD / 2], material: "wood" },
  ];
  const legId = (sx: number) => (sx < 0 ? "L1" : "L2");
  const sides = [-1, 1];
  const xs4 = [-300, -100, 100, 300];
  const steps: CustomStep[] = [
    {
      title: "Tap the felt pads into the feet",
      detail: "Lay both legs flat on a rug. One pad under each end of each foot, tapped in with a hammer.",
      add: ["L1", "L2"],
      fix: sides.map((sx) => fx("glide", [[sx * xL, 0, -footL / 2 + 40], [sx * xL, 0, footL / 2 - 40]], [0, 1, 0], legId(sx), { len: 6, dia: 24 })),
      tools: ["hammer"],
      warnings: ["floor"],
    },
    {
      title: "Tap a dowel into each post",
      detail: "Into the middle hole on the inner face, where the stretcher goes.",
      fix: sides.map((sx) => fx("dowel", [[-sx * inner, yS, 0]], [sx, 0, 0], legId(sx), { mate: "ST" })),
      tools: ["hammer"],
    },
    {
      title: "Bolt the stretcher between the legs",
      detail: "Drop a barrel nut into each end, slots turned towards the bolts. Two bolts through each post.",
      add: ["ST"],
      fix: [
        fx("nut", sides.map((sx): Vec3 => [sx * (inner - 30), yS + hS / 2, 0]), [0, -1, 0], "ST", { name: "Barrel nut", len: 60, dia: 10 }),
        ...sides.map((sx) => fx("bolt", [yS - 40, yS + 40].map((y): Vec3 => [sx * (xL + lw / 2), y, 0]), [-sx, 0, 0], legId(sx), { mate: "ST", ...BOLT })),
      ],
    },
    {
      title: "Bolt the two aprons between the top arms",
      detail: "A barrel nut up into each end from below, then two bolts through the arm at each corner. Not fully tight yet.",
      add: ["A1", "A2"],
      fix: [
        ...[-zA, zA].map((z) => fx("nut", sides.map((sx): Vec3 => [sx * (inner - 30), yA - hA / 2, z]), [0, 1, 0], z < 0 ? "A1" : "A2", { name: "Barrel nut", len: 50, dia: 10 })),
        ...sides.flatMap((sx) => [-zA, zA].map((z) => fx("bolt", [yA - 20, yA + 20].map((y): Vec3 => [sx * (xL + lw / 2), y, z]), [-sx, 0, 0], legId(sx), { mate: z < 0 ? "A1" : "A2", ...BOLT }))),
      ],
      tools: ["allen"],
    },
    {
      title: "Join the two halves of the top",
      detail: "Face down on a rug. A spacer ring onto each dowel, the dowels into one long edge, then push the halves together.",
      wait: ["TA", "TB"],
      fix: [
        fx("washer", xs4.map((x): Vec3 => [x * 1.5, H - TT / 2, 0]), [0, 0, -1], "TB", { name: "Spacer ring", len: 6, dia: 14 }),
        fx("dowel", xs4.map((x): Vec3 => [x * 1.5, H - TT / 2, 0]), [0, 0, -1], "TB", { mate: "TA" }),
      ],
      tools: ["hammer"],
      warnings: ["floor"],
    },
    {
      title: "Bolt the aprons to the top",
      detail: "Turn the base upside down onto the top. Four bolts with washers through each apron.",
      add: ["TA", "TB"],
      // joined, the two halves move as one
      from: { TA: [0, 520, 0], TB: [0, 520, 0] },
      fix: [-zA, zA].flatMap((z) => {
        const pts = xs4.map((x): Vec3 => [x, yA - hA / 2, z]);
        const on = z < 0 ? "A1" : "A2", mate = z < 0 ? "TB" : "TA";
        return [fx("washer", pts, [0, 1, 0], on, { len: 2, dia: 18 }), fx("bolt", pts, [0, 1, 0], on, { mate, ...BOLT })];
      }),
      pose: "-y",
    },
    {
      title: "Bolt the leg arms to the top",
      detail: "Four bolts with washers through each arm, two into each half. Now tighten every bolt.",
      fix: sides.flatMap((sx) => {
        const pts = [-250, -110, 110, 250].map((z): Vec3 => [sx * xL, yArm, z]);
        return [fx("washer", pts, [0, 1, 0], legId(sx), { len: 2, dia: 18 }), ...[pts.slice(0, 2), pts.slice(2)].map((p, i) => fx("bolt", p, [0, 1, 0], legId(sx), { mate: i ? "TA" : "TB", ...BOLT }))];
      }),
      tools: ["allen"],
    },
    { title: "Turn the table over together", detail: "It's heavy solid wood: lift it with two people, don't roll it onto its legs.", pose: "+y", people: 2, warnings: ["two"] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["NACKANÄS", "NACKANAS"],
  recipe(s) {
    if (!/table/i.test(`${s.slug ?? ""} ${s.variant}`)) return null;
    return recipe(s);
  },
};
export default family;

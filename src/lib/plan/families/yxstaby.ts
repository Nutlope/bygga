import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, ProductSpec, Vec3 } from "../../types";

/**
 * YXSTABY gaming monitor stand, read from its manual: a particleboard top on two steel end legs, with a steel cable
 * tray hanging under its back edge. It is built upside down on a rug: the right leg is screwed to the top through its
 * flange, the cable tray is laid on and tipped up, the left leg slides on, then the leg flanges, the tray flange and
 * two small corner brackets are screwed down. Four anti-slip pads go under the legs and the stand is turned over;
 * the hooks clip onto the back. Fourteen screws of one kind in all.
 */

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });
const SCREW = { len: 10, dia: 4 };
const UP: Vec3 = [0, 1, 0];

function recipe(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10), H = Math.round(s.size.h * 10), D = Math.round(s.size.d * 10);
  const TT = 16, yT = H - TT; // underside of the top
  const ST = 3; // steel sheet
  const FW = 30; // leg flange, inwards under the top
  const xo = W / 2; // outer face of a leg
  const leg = (id: string, g: 1 | -1): CustomPart => ({
    id,
    name: "Leg",
    size: [FW + ST, yT, D],
    pos: [g * (xo - (FW + ST) / 2), yT / 2, 0],
    material: "metal",
    pieces: [
      { shape: "box", size: [ST, yT, D], pos: [g * (FW / 2), 0, 0] },
      { shape: "box", size: [FW, ST, D - 30], pos: [-g * (ST / 2), yT / 2 - ST / 2, 0] },
    ],
  });
  const xf = xo - ST - FW / 2; // flange screw line
  const tl = 2 * (xo - ST - FW) - 10; // tray length, between the leg flanges
  const zb = -D / 2; // back edge
  const tz = zb + 40; // tray's hanging plate
  const parts: CustomPart[] = [
    {
      id: "T",
      name: "Top",
      size: [W, TT, D],
      pos: [0, H - TT / 2, 0],
      material: "board",
      // the front corners are rounded
      pieces: [{ shape: "slab", size: [W, TT, D], pos: [0, 0, 0], outline: [[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [-W / 2, D / 2]], round: 14 }],
    },
    leg("R", 1),
    leg("L", -1),
    {
      id: "C",
      name: "Cable tray",
      size: [tl, 90, 42],
      pos: [0, yT - 45, zb + 21],
      material: "metal",
      pieces: [
        { shape: "box", size: [tl, 2, 42], pos: [0, 45 - 1, 0] },
        { shape: "box", size: [tl, 88, 2], pos: [0, -1, 19] },
      ],
    },
    ...([1, -1] as const).map((g): CustomPart => ({ id: g > 0 ? "KR" : "KL", name: "Corner bracket", size: [xo - ST - tl / 2, 30, 20], pos: [g * ((xo - ST + tl / 2) / 2), yT - 60, tz + 12], material: "metal" })),
  ];
  // the flange screws go up through the flange into the top
  const flange = (id: string, g: number, zs: number[]) => fx("screw", zs.map((z): Vec3 => [g * xf, yT - ST - 1, z]), UP, id, { ...SCREW, mate: "T" });
  const steps: CustomStep[] = [
    {
      title: "Screw the right leg onto the top",
      detail: "Lay the top face down on a rug. Stand the leg on its end, flange on the top, and turn in three screws by hand.",
      add: ["T", "R"],
      fix: [flange("R", 1, [-D / 2 + 40, 0, D / 2 - 40])],
      tools: ["screwdriver"],
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Lay the cable tray on the top", detail: "Flat along the back edge, its end against the right leg.", add: ["C"] },
    { title: "Tip the tray up into place", detail: "Turn it up onto its edge so its flange lies on the top and its end tucks into the leg." },
    {
      title: "Slide on the left leg",
      detail: "Push it on from the end so it covers the end of the tray, then one screw through its flange.",
      add: ["L"],
      from: { L: [-200, 0, 0] },
      fix: [flange("L", -1, [0])],
      tools: ["screwdriver"],
    },
    { title: "Turn it round", detail: "Swing it end for end on the rug so the open back faces you. It stays upside down." },
    {
      title: "Slide in the corner brackets",
      detail: "One at each end of the tray, between the tray and the leg.",
      add: ["KR", "KL"],
      from: { KR: [0, 0, 120], KL: [0, 0, 120] },
    },
    { title: "Screw the left leg's flange down", detail: "Two more screws, one near each end of the flange.", fix: [flange("L", -1, [-D / 2 + 40, D / 2 - 40])], tools: ["screwdriver"] },
    {
      title: "Screw the tray's flange to the top",
      detail: "Six screws, spread along the back.",
      fix: [fx("screw", [-0.42, -0.25, -0.08, 0.08, 0.25, 0.42].map((f): Vec3 => [f * tl, yT - 3, zb + 15]), UP, "C", { ...SCREW, mate: "T" })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the brackets to the legs",
      detail: "One screw through each bracket into the leg.",
      fix: ([1, -1] as const).map((g) => fx("screw", [[g * (xo - ST - 2), yT - 60, tz + 12]], [g, 0, 0], g > 0 ? "KR" : "KL", { ...SCREW, mate: g > 0 ? "R" : "L" })),
      tools: ["screwdriver"],
    },
    {
      title: "Stick on the pads and turn it over",
      detail: "Two anti-slip pads under each leg, then stand the stand on its legs.",
      fix: ([1, -1] as const).map((g) => fx("glide", [-D / 2 + 40, D / 2 - 40].map((z): Vec3 => [g * (xo - ST / 2), 0, z]), UP, g > 0 ? "R" : "L", { name: "Anti-slip pad", len: 2, dia: 20 })),
      pose: "+y",
    },
    {
      title: "Clip on the holders",
      detail: "The headphone hook, the controller holder and the cable holder hook over the back edge wherever you like them.",
      fix: [fx("hook", [-W / 3, 40, W / 3].map((x): Vec3 => [x, H - TT / 2, zb]), [0, 0, 1], "T", { name: "Holder", len: 60, dia: 30 })],
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["YXSTABY"],
  recipe(s) {
    if (!/monitor stand/i.test(s.variant)) return null;
    return recipe(s);
  },
};
export default family;

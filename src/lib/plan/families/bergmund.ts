import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartItem, PartPiece, ProductSpec, Vec3 } from "../../types";
import { buildCustom } from "../custom";

/**
 * BERGMUND, read from the dining chair's manual. The cover flap at the foot of the backrest is folded up first. With
 * the padded seat upside down, the front legs drop into its corner brackets and each takes a bolt with a spring
 * washer and a washer, by hand. The backrest's two pins go into the back of the seat, the chair is laid on its back,
 * the back legs slide onto the pins in the rear corners and take their bolts. Stood on a table, all four bolts are
 * tightened with the Allen key, and the cover flap is pulled down over the joint.
 */

const LEG = 45;
const BOLT = { name: "Allen bolt", len: 60, dia: 6 };

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string | undefined, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });

function chair(s: ProductSpec): CustomParams {
  // IKEA: 52 wide, 59 deep, 95 high, seat 51 high and 41 deep
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const seatTop = 510, seatBot = 430;
  const zBackFace = D / 2 - 410; // front face of the backrest, 41 cm behind the front of the seat
  const BT = 70, lean = 110;
  const xl = W / 2 - LEG / 2 - 6;
  const zf = D / 2 - LEG / 2 - 8, zb = zBackFace + LEG / 2 - 8;
  const backH = H - seatBot, ang = Math.atan2(lean, backH);
  const parts: CustomPart[] = [
    { id: "SEAT", name: "Seat", size: [W, seatTop - seatBot, D / 2 - zBackFace], pos: [0, (seatTop + seatBot) / 2, (D / 2 + zBackFace) / 2], material: "soft" },
    { id: "LEG_FL", name: "Front leg", size: [LEG, seatBot, LEG], pos: [-xl, seatBot / 2, zf], material: "wood" },
    { id: "LEG_FR", name: "Front leg", size: [LEG, seatBot, LEG], pos: [xl, seatBot / 2, zf], material: "wood" },
    {
      id: "BACK",
      name: "Backrest",
      size: [W - 20, Math.hypot(backH, lean), BT],
      pos: [0, (seatBot + H) / 2, zBackFace - BT / 2 - lean / 2],
      rot: [-ang, 0, 0],
      material: "soft",
    },
    { id: "LEG_BL", name: "Back leg", size: [LEG, seatBot, LEG], pos: [-xl, seatBot / 2, zb], material: "wood" },
    { id: "LEG_BR", name: "Back leg", size: [LEG, seatBot, LEG], pos: [xl, seatBot / 2, zb], material: "wood" },
  ];
  // each bolt goes diagonally through the corner bracket inside the seat's frame into the top of its leg
  const corner = (sx: number, z: number, sz: number): { at: Vec3; dir: Vec3 } => ({ at: [sx * (xl - 45), seatBot - 18, z - sz * 45], dir: [sx * Math.SQRT1_2, 0, sz * Math.SQRT1_2] });
  const bolts = (legs: [string, number, number, number][]): CustomFix[] =>
    legs.flatMap(([id, sx, z, sz]) => {
      const c = corner(sx, z, sz);
      return [
        fx("washer", [c.at], c.dir, "SEAT", { name: "Spring washer", len: 2, dia: 12, mate: id }),
        fx("washer", [c.at], c.dir, "SEAT", { len: 1.5, dia: 16, mate: id }),
        fx("bolt", [c.at], c.dir, "SEAT", { ...BOLT, mate: id }),
      ];
    });
  const front: [string, number, number, number][] = [["LEG_FL", -1, zf, 1], ["LEG_FR", 1, zf, 1]];
  const back: [string, number, number, number][] = [["LEG_BL", -1, zb, -1], ["LEG_BR", 1, zb, -1]];

  return {
    parts,
    steps: [
      {
        title: "Fold the cover up off the backrest's foot",
        detail: "Turn the flap at the bottom of the backrest inside out, up over the back, so its two pins stand free.",
      },
      {
        title: "Push the front legs into the seat's corners",
        detail: "Lay the seat upside down on a rug. Each leg's notch slides down over the bracket in a front corner.",
        add: ["SEAT", "LEG_FL", "LEG_FR"],
        pose: "-y",
        warnings: ["floor"],
      },
      {
        title: "Bolt the front legs in by hand",
        detail: "A spring washer and a washer on each bolt, then turn it in through the bracket with your fingers only.",
        fix: bolts(front),
        warnings: ["loose"],
      },
      {
        title: "Push the backrest's pins into the seat",
        detail: "Both pins into the holes at the back of the seat frame, then lay the chair on its back.",
        add: ["BACK"],
        from: { BACK: [0, -300, -200] },
      },
      {
        title: "Slide the back legs onto the pins",
        detail: "The groove in the top of each leg goes over a pin, into the rear corner. Keep the legs straight, not splayed.",
        add: ["LEG_BL", "LEG_BR"],
        pose: "+z",
        from: { LEG_BL: [0, -300, 0], LEG_BR: [0, -300, 0] },
      },
      { title: "Bolt the back legs in by hand", detail: "The same way, washers first, fingers only.", fix: bolts(back), warnings: ["loose"] },
      {
        title: "Stand it on a table and tighten the bolts",
        detail: "With all four legs on a flat table top, tighten each bolt firmly with the Allen key. Not with a drill.",
        pose: "+y",
        tools: ["allen"],
        check: "square",
      },
      { title: "Pull the cover flap down", detail: "Fold it back down over the foot of the backrest and fasten it under the seat at both sides." },
    ],
  };
}


/**
 * The bar stool with backrest, from its frame and cover manuals. Upside down on a rug, the left leg frame drops into
 * the seat's corner brackets and takes one bolt, the right one (with the footrest) hooks on and takes another. On its
 * side, the backrest slides in at the back, two bolts hold the back corners and two screws hold its tabs to the back
 * legs. Stood up, all four bolts are tightened, then the cover goes on over the backrest and seat.
 */
function barStool(s: ProductSpec): CustomParams {
  // IKEA: 45 wide, 48 deep, 97 high, seat 62 high and 37 deep (the catalogue size is off, so these are drawn)
  const W = 450, D = 480, H = 970;
  void s;
  const L = 40, seatTop = 620, seatBot = 490, apron = 70, BT = 70;
  const zb0 = -D / 2 + BT; // the backrest's front face, where the seat starts
  const SD = D / 2 - zb0;
  const sz0 = (D / 2 + zb0) / 2;
  const legTop = seatBot + apron;
  const xl = W / 2 - 20 - L / 2, zf = D / 2 - 20 - L / 2, zb = zb0 + 20 + L / 2;
  const railY = 330, footY = 200;
  const seat: PartPiece[] = [
    { shape: "box", size: [W, seatTop - legTop, SD], pos: [0, (seatTop + legTop) / 2 - (seatTop + seatBot) / 2, 0] },
    ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [20, apron, SD], pos: [g * (W / 2 - 10), seatBot + apron / 2 - (seatTop + seatBot) / 2, 0] })),
    ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [W - 40, apron, 20], pos: [0, seatBot + apron / 2 - (seatTop + seatBot) / 2, g * (SD / 2 - 10)] })),
  ];
  const fm = legTop / 2;
  const frame = (sx: number, foot: boolean): PartPiece[] => [
    ...[zf, zb].map((z): PartPiece => ({ shape: "box", size: [L, legTop, L], pos: [0, 0, z - (zf + zb) / 2] })),
    { shape: "box", size: [25, 40, zf - zb - L], pos: [0, railY - fm, 0] },
    ...(foot ? [{ shape: "box", size: [2 * xl - L, 40, 25], pos: [-sx * xl, footY - fm, zf - (zf + zb) / 2] } as PartPiece] : []),
  ];
  const parts: CustomPart[] = [
    { id: "SEAT", name: "Seat", size: [W, seatTop - seatBot, SD], pos: [0, (seatTop + seatBot) / 2, sz0], material: "soft", pieces: seat },
    { id: "LF", name: "Left leg frame", size: [L, legTop, zf - zb + L], pos: [-xl, fm, (zf + zb) / 2], material: "wood", pieces: frame(-1, false) },
    { id: "RF", name: "Right leg frame with footrest", size: [2 * xl + L, legTop, zf - zb + L], pos: [xl, fm, (zf + zb) / 2], material: "wood", pieces: frame(1, true) },
    { id: "BACK", name: "Backrest", size: [W, H - seatBot + 30, BT], pos: [0, (H + seatBot - 30) / 2, zb0 - BT / 2], material: "soft" },
  ];
  // each bolt goes diagonally through the corner bracket inside the seat's frame into the inner corner of its leg
  const bolt = (sx: number, z: number, sz: number, leg: string): CustomFix[] => {
    const at: Vec3 = [sx * (xl - 42), legTop - 30, z - sz * 42], dir: Vec3 = [sx * Math.SQRT1_2, 0, sz * Math.SQRT1_2];
    return [
      fx("washer", [at], dir, "SEAT", { name: "Spring washer", len: 2, dia: 12, mate: leg }),
      fx("washer", [at], dir, "SEAT", { len: 1.5, dia: 16, mate: leg }),
      fx("bolt", [at], dir, "SEAT", { ...BOLT, mate: leg }),
    ];
  };
  return {
    parts,
    steps: [
      {
        title: "Push the left leg frame into the seat",
        detail: "Lay the seat upside down on a rug. Each leg's notched end drops down over the bracket in a corner.",
        add: ["SEAT", "LF"],
        pose: "-y",
        warnings: ["floor"],
      },
      { title: "Bolt the front corner by hand", detail: "A spring washer and a washer on the bolt, then turn it in through the bracket with your fingers.", fix: bolt(-1, zf, 1, "LF"), warnings: ["loose"] },
      { title: "Push the right leg frame in", detail: "Its legs drop into the other two corners and the footrest hooks onto the left front leg. Press it down until it clicks.", add: ["RF"] },
      { title: "Bolt its front corner by hand", detail: "Washers first, fingers only for now.", fix: bolt(1, zf, 1, "RF"), warnings: ["loose"] },
      {
        title: "Slide the backrest in",
        detail: "Lay the stool on its side. Push the backrest's two prongs into the back of the seat frame.",
        add: ["BACK"],
        pose: "+x",
        from: { BACK: [0, 0, -300] },
      },
      { title: "Bolt the back corners by hand", detail: "Two more bolts, each with a spring washer and a washer.", fix: [...bolt(-1, zb, -1, "LF"), ...bolt(1, zb, -1, "RF")], warnings: ["loose"] },
      {
        title: "Screw the backrest to the back legs",
        detail: "Check both tabs at its foot sit in the slots in the legs, then drive a screw through each with the bit.",
        fix: [{ kind: "screw", count: 2, len: 50, dia: 5, on: "BACK", at: [-1, 1].map((g): Vec3 => [g * xl, seatBot - 10, -D / 2]), dir: [0, 0, 1] }],
        tools: ["screwdriver"],
      },
      { title: "Stand it up and tighten the bolts", detail: "On a flat floor, tighten all four bolts firmly with the Allen key.", pose: "+y", tools: ["allen"], check: "square" },
      { title: "Pull the cover over the backrest", detail: "Seams to the sides, then ease it down the back and over the seat." },
      { title: "Tuck in and fasten the cover", detail: "Push the flaps into the gap between seat and backrest, then turn the stool over on a table and fasten the cover under the seat." },
    ],
  };
}

const family: Family = {
  names: ["BERGMUND"],
  build(b, s) {
    if (/bar-stool-backrest/.test(s.slug ?? "")) {
      buildCustom(b, { ...s, custom: barStool(s) });
      return true;
    }
    if (!/chair/i.test(`${s.variant} ${s.slug ?? ""}`) || /arm/i.test(s.variant)) return false;
    const r = chair(s);
    buildCustom(b, { ...s, custom: r });
    // the backrest is handled on its own in the first step, before the seat comes out of the box
    const p = r.parts.find((q) => q.id === "BACK")!;
    const it = b.items.find((x): x is PartItem => x.kind === "part" && x.final.pos.every((v, k) => Math.abs(v - p.pos[k]) < 0.5));
    if (it && b.steps[0]) {
      b.steps[0].scene = "backrest";
      it.states.unshift({ step: 0, scene: "backrest", pos: it.final.pos, rot: it.final.rot, from: [0, 200, 0], delay: 0.15 });
    }
    return true;
  },
};
export default family;

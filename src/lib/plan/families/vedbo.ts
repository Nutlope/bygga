import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * VEDBO, read from the armchair's and the high-back armchair's manuals (the same seven steps, the same fittings).
 * The padded shell comes in one piece and lies upside down on a rug the whole time. A cross rail is bolted across
 * its underside on two spacers with two long bolts, then gets two dowels in each end. Each side frame (a front and
 * a back leg joined by a rail) pushes onto those dowels and is bolted into a barrel nut in the rail's end; two more
 * bolts go through the top of its legs into the shell. Stood up, the two long bolts and then the six frame bolts are
 * tightened with the Allen key.
 */

const LONG_BOLT = { len: 120, dia: 6 };
const BOLT = { len: 70, dia: 6 };
const LEG = 40; // leg diameter
const RAIL_T = 30; // side rail, across
const RAIL_H = 60;

function fx(kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on?: string, o: Partial<CustomFix> = {}): CustomFix {
  return { kind, count: at.length, at, dir, on, ...o };
}

/** A part drawn from pieces given in the finished product's own coordinates, its box worked out from them. */
function assembled(id: string, name: string, abs: (PartPiece & { pos: Vec3 })[], material: CustomPart["material"]): CustomPart {
  const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of abs) {
    // a turned piece's reach, roughly: its longest side either way
    const r = p.rot?.some((v) => v) ? Math.max(...p.size) / 2 : 0;
    for (let k = 0; k < 3; k++) {
      const e = r ? Math.max(p.size[k] / 2, k === 1 ? r : Math.min(r, p.size[k] / 2 + r * 0.35)) : p.size[k] / 2;
      lo[k] = Math.min(lo[k], p.pos[k] - e);
      hi[k] = Math.max(hi[k], p.pos[k] + e);
    }
  }
  const c: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  const pieces = abs.map((p) => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]] as Vec3 }));
  return { id, name, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: c, pieces, material };
}

/** A round leg from its foot to its top, as a turned cylinder. */
function leg(foot: Vec3, top: Vec3): PartPiece & { pos: Vec3 } {
  const dy = top[1] - foot[1], dz = top[2] - foot[2];
  return { shape: "cyl", size: [LEG, Math.hypot(dy, dz), LEG], pos: [(foot[0] + top[0]) / 2, (foot[1] + top[1]) / 2, (foot[2] + top[2]) / 2], rot: [Math.atan2(dz, dy), 0, 0] };
}

function recipe(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const xl = W / 2 - 30; // leg centres
  const xs = xl - LEG / 2; // outside of the shell, where the legs touch it
  const under = 240; // free height under the shell
  const seatTop = 440;
  const armTop = 620;
  const zF = D / 2 - 40; // front of the seat
  const zB = zF - 520; // back of the seat
  const zTop = -D / 2 + 50; // back of the shell's top edge

  // the shell: seat, its fixed pad, the back leaning back and two arms, all one padded part
  const backY0 = 330;
  const lean = Math.atan2(zB - 10 - zTop, H - backY0);
  const backLen = (H - backY0) / Math.cos(lean);
  const shell = assembled(
    "SHELL",
    "Padded shell",
    [
      { shape: "box", size: [2 * xs, 140, zF - zB], pos: [0, under + 70, (zF + zB) / 2] },
      { shape: "box", size: [2 * xs - 170, seatTop - under - 140, zF - zB - 90], pos: [0, (under + 140 + seatTop) / 2, (zF + zB) / 2 + 40] },
      { shape: "box", size: [2 * xs - 30, backLen, 90], pos: [0, (backY0 + H) / 2, (zB - 10 + zTop) / 2 - 45], rot: [-lean, 0, 0] },
      ...[-1, 1].flatMap((sx): (PartPiece & { pos: Vec3 })[] => [
        { shape: "box", size: [70, armTop - under - 175, zF - zB - 40], pos: [sx * (xs - 35), (under + 140 + armTop - 35) / 2, (zF + zB) / 2 - 20] },
        { shape: "cyl", size: [70, zF - zB - 40, 70], pos: [sx * (xs - 35), armTop - 35, (zF + zB) / 2 - 20], rot: [Math.PI / 2, 0, 0] },
      ]),
    ],
    "soft",
  );

  // the frame: two side frames (legs and a rail in one) and a cross rail between them, under the seat
  const fFoot = zF + 15, fTop = zF - 45, fTopY = armTop - 40;
  const bFoot = Math.max(-D / 2 + 25, zB - 210), bTop = zB + 50, bTopY = under + 130;
  const zAt = (foot: number, top: number, topY: number, y: number) => foot + ((top - foot) * y) / topY;
  const railY = 190;
  const zr0 = zAt(bFoot, bTop, bTopY, railY), zr1 = zAt(fFoot, fTop, fTopY, railY);
  const zMid = (zr0 + zr1) / 2;
  const xr = xs - RAIL_T; // inside face of a side rail
  const crossY0 = railY - 20, crossY1 = under - 30; // the spacers fill the gap up to the shell
  const sideIds = ["SIDE_L", "SIDE_R"];
  const sides = [-1, 1].map((sx, i) =>
    assembled(
      sideIds[i],
      "Side frame",
      [
        leg([sx * xl, 0, fFoot], [sx * xl, fTopY, fTop]),
        leg([sx * xl, 0, bFoot], [sx * xl, bTopY, bTop]),
        { shape: "box", size: [RAIL_T, RAIL_H, zr1 - zr0], pos: [sx * (xs - RAIL_T / 2), railY, zMid] },
      ],
      "wood",
    ),
  );
  const cross: CustomPart = { id: "RAIL", name: "Cross rail", size: [2 * xr, crossY1 - crossY0, 45], pos: [0, (crossY0 + crossY1) / 2, zMid], material: "wood" };
  const parts = [shell, cross, ...sides];

  const seatBolts = [-1, 1].map((sx): Vec3 => [sx * 130, crossY0, zMid]);
  const spacers = seatBolts.map((p): Vec3 => [p[0], crossY1, p[2]]);
  const dowels = (sx: number) => [-12, 12].map((dz): Vec3 => [sx * xr, (crossY0 + crossY1) / 2, zMid + dz]);
  const sideBolt = (sx: number, id: string) => fx("bolt", [[sx * xs, (crossY0 + crossY1) / 2, zMid + 0.1]], [-sx, 0, 0], id, { ...BOLT, mate: "RAIL" });
  const barrel = (sx: number) => fx("nut", [[sx * (xr - 35), crossY0, zMid]], [0, 1, 0], "RAIL", { name: "Barrel nut", len: 20, dia: 10 });
  const legBolts = (sx: number, id: string) =>
    fx("bolt", [[sx * (xl + LEG / 2), fTopY - 50, zAt(fFoot, fTop, fTopY, fTopY - 50)], [sx * (xl + LEG / 2), bTopY - 40, zAt(bFoot, bTop, bTopY, bTopY - 40)]], [-sx, 0, 0], id, { ...BOLT, mate: "SHELL" });

  const steps: CustomStep[] = [
    {
      title: "Bolt the cross rail under the seat",
      detail: `Lay the shell upside down on a rug. A spacer goes under each end of the rail, then turn the two long bolts in by hand, not tight yet.`,
      add: ["SHELL", "RAIL"],
      fix: [fx("spacer", spacers, [0, 1, 0], "RAIL", { name: "Spacer", len: 30, dia: 16, mate: "SHELL" }), fx("bolt", seatBolts, [0, 1, 0], "RAIL", { ...LONG_BOLT, mate: "SHELL" })],
      tools: ["allen"],
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Tap two dowels into each end of the rail", detail: "Push them in by hand, as far as they go.", fix: [fx("dowel", dowels(-1), [1, 0, 0], "RAIL", { mate: sideIds[0] }), fx("dowel", dowels(1), [-1, 0, 0], "RAIL", { mate: sideIds[1] })] },
    {
      title: "Push on a side frame and bolt it to the rail",
      detail: `The longer legs go at the front, under the arms. Drop a barrel nut into the rail's end, slot facing the bolt, and turn the bolt in by hand.`,
      add: [sideIds[0]],
      from: { [sideIds[0]]: [-300, 0, 0] }, // along the rail's dowels
      fix: [barrel(-1), sideBolt(-1, sideIds[0])],
      tools: ["allen", "screwdriver"],
    },
    { title: "Fit the other side frame the same way", detail: "Onto the dowels, a barrel nut in the rail, then the bolt. Leave it loose for now.", add: [sideIds[1]], from: { [sideIds[1]]: [300, 0, 0] }, fix: [barrel(1), sideBolt(1, sideIds[1])], tools: ["allen", "screwdriver"] },
    {
      title: "Bolt the legs to the shell",
      detail: "One bolt through the top of each leg into the side of the shell. Turn them in by hand until the heads touch.",
      fix: [legBolts(-1, sideIds[0]), legBolts(1, sideIds[1])],
      tools: ["allen"],
    },
    { title: "Stand it up and tighten the seat bolts", detail: "Turn it over onto its legs. Reach under the seat and tighten the two long bolts on the spacers.", pose: "+y", tools: ["allen"] },
    { title: "Tighten all six frame bolts", detail: "The two in the rails and the four in the legs, firmly, so the frame doesn't wobble.", tools: ["allen"], check: "square" },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["VEDBO"],
  recipe(s) {
    if (!/armchair/i.test(`${s.variant} ${s.slug ?? ""}`)) return null;
    return recipe(s);
  },
};
export default family;

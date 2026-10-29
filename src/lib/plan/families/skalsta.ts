import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartMaterial, PartPiece, ProductSpec, Vec3 } from "../../types";
import { rotate } from "../math";

/**
 * SKÅLSTA, read from its manuals.
 * - Chair: two manuals. The seat shell gets its washable cover first (pulled over, zipped at the back, hooked under
 *   the seat). The tube underframe is two bent side frames and two crossbars pushed together upside down, laid on the
 *   shell face down, bolted through the four joints (by hand, then the Allen key) and finished with four covers.
 * - Table: each X-shaped leg is two flat bars slotted into each other and locked with one bolt; the top lies upside
 *   down on a rug and each leg is screwed on with eight screws through its end plates.
 */

const UP: Vec3 = [0, 1, 0];
const fx = (kind: CustomFix["kind"], at: Vec3[], o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, ...o });

/** One part drawn as several pieces placed where they sit in the product; its box and centre are worked out. */
function compound(id: string, name: string, abs: PartPiece[], material: PartMaterial): CustomPart {
  const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of abs)
    for (const a of [-1, 1])
      for (const b of [-1, 1])
        for (const c of [-1, 1]) {
          const v = rotate([(a * p.size[0]) / 2, (b * p.size[1]) / 2, (c * p.size[2]) / 2], p.rot ?? [0, 0, 0]);
          for (let k = 0; k < 3; k++) {
            lo[k] = Math.min(lo[k], p.pos[k] + v[k]);
            hi[k] = Math.max(hi[k], p.pos[k] + v[k]);
          }
        }
  const pos = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2) as Vec3;
  const size = [0, 1, 2].map((k) => hi[k] - lo[k]) as Vec3;
  const pieces = abs.map((p) => ({ ...p, pos: [p.pos[0] - pos[0], p.pos[1] - pos[1], p.pos[2] - pos[2]] as Vec3 }));
  return { id, name, size, pos, pieces, material };
}

/** A straight piece from a to b: a round tube, or a flat bar of w x t when t is given. */
function bar(a: Vec3, b: Vec3, w: number, t?: number): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L = Math.hypot(...d);
  const rot: Vec3 = [Math.atan2(d[2], d[1]), 0, -Math.asin(d[0] / L)];
  const pos: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  return t ? { shape: "box", size: [t, L, w], pos, rot } : { shape: "cyl", size: [w, L, w], pos, rot };
}

function chair(s: ProductSpec): CustomParams {
  // IKEA: 52 wide, 50 deep, 80 high, seat 46 x 40 at 49 high
  const W = Math.round(s.size.w * 10) || 520, D = Math.round(s.size.d * 10) || 500, H = Math.round(s.size.h * 10) || 800;
  const T = 20; // tube
  const yr = 440; // centre of the tubes under the seat
  const xr = 195, zf = 150, zb = -140; // side rails and where the crossbars join them
  const xf = W / 2 - T / 2, zF = D / 2 - T / 2 - 20, zB = -D / 2 + T / 2;
  const side = (sx: number) =>
    compound(sx < 0 ? "L" : "R", "Side frame", [
      bar([sx * xf, 0, zF], [sx * xr, yr, zf + 30], T),
      bar([sx * xr, yr, zf + 30], [sx * xr, yr, zb - 30], T),
      bar([sx * xr, yr, zb - 30], [sx * xf, 0, zB], T),
    ], "metal");
  const cross = (id: string, z: number): CustomPart => ({ id, name: "Crossbar", shape: "cyl", size: [2 * xr - T, T, T], pos: [0, yr, z], material: "metal" });

  // the shell: a seat pan on the tubes and a back that leans back a little, with round top corners
  const y0 = yr + T / 2, st = 34, sw = 460, sd = 420, r = 90;
  const back0: Vec3 = [0, y0 + st, -sd / 2 + 30], back1: Vec3 = [0, H, -D / 2 + 20];
  const len = Math.hypot(back1[1] - back0[1], back1[2] - back0[2]);
  const at = (u: number, x = 0): Vec3 => [x, back0[1] + ((back1[1] - back0[1]) * u) / len, back0[2] + ((back1[2] - back0[2]) * u) / len];
  const tilt = Math.atan2(back1[2] - back0[2], back1[1] - back0[1]);
  const shellPieces = (g: number): PartPiece[] => {
    const bw = sw - 30 + 2 * g, t = st + 2 * g, top = len + g;
    return [
      { shape: "box", size: [sw + 2 * g, t, sd + 2 * g], pos: [0, y0 + st / 2, 20] },
      { shape: "box", size: [bw, top - r, t], pos: at((top - r) / 2), rot: [tilt, 0, 0] },
      { shape: "box", size: [bw - 2 * r, r, t], pos: at(top - r / 2), rot: [tilt, 0, 0] },
      ...[-1, 1].map((sx): PartPiece => ({ shape: "cyl", size: [2 * r, t, 2 * r], pos: at(top - r, sx * (bw / 2 - r)), rot: [tilt + Math.PI / 2, 0, 0] })),
    ];
  };
  const shell = compound("S", "Seat shell", shellPieces(-3), "board");
  const cover = compound("C", "Cover", shellPieces(0), "soft");

  const parts: CustomPart[] = [shell, cover, side(-1), cross("F", zf), cross("B", zb), side(1)];
  const joints: Vec3[] = [-1, 1].flatMap((sx) => [zf, zb].map((z): Vec3 => [sx * xr, yr - T / 2, z]));
  const steps: CustomStep[] = [
    {
      title: "Pull the cover over the seat shell",
      detail: "Stand the shell on a table and work the cover down over the back and the seat. The cover comes off for washing.",
      add: ["S", "C"],
      from: { C: [0, 300, 0] },
    },
    { title: "Smooth the cover out", detail: "Press it down over the seat with flat hands, working out to the edges." },
    { title: "Close the zip at the back", detail: "Pull it all the way down until it stops." },
    {
      title: "Turn the shell over and hook the front corners under",
      detail: "Lay it face down on something soft. Pull the cover round each front corner and hook it onto the shell.",
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Hook the front edge and the sides under", detail: "One flap at the front, then one on each side. Pull each one tight before you hook it." },
    { title: "Tuck in the back edge", detail: "Push the last edge in under the rim so no fabric hangs loose." },
    {
      title: "Push a crossbar into one side frame",
      detail: "Upside down, legs in the air. The hole in the crossbar end must line up with the hole in the side frame.",
      add: ["L", "F"],
      from: { L: [-200, 300, 0], F: [0, 300, 0] },
    },
    {
      title: "Add the other crossbar and side frame",
      detail: "Three more joints. Check each pair of holes lines up, they take the bolts next.",
      add: ["B", "R"],
      from: { B: [0, 300, 0], R: [200, 300, 0] },
    },
    {
      title: "Bolt the frame onto the shell",
      detail: "Sit the frame on the shell, face down, and turn a bolt through each joint by hand first.",
      fix: [fx("bolt", joints, { len: 30, dia: 6, dir: UP, mate: "S" })],
    },
    { title: "Tighten the bolts", detail: "Go round all four with the Allen key until they are firm.", tools: ["allen"] },
    { title: "Press a cover onto each bolt", detail: "They click over the joints and hide the bolt heads.", fix: [fx("cap", joints, { name: "Joint cover", len: 20, dia: 26, dir: UP })] },
    { title: "Stand the chair up", detail: "Check it stands on all four feet without rocking.", pose: "+y" },
  ];
  return { parts, steps };
}

function table(s: ProductSpec): CustomParams {
  // IKEA: 140 x 80, 75 high
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const tt = 25, yt = H - tt;
  const bw = 60, bt = 30, plate = 4; // flat leg bars, end plates
  const xl = W / 2 - 70; // the X legs sit in from each end
  const zt = D / 2 - 70, zfoot = D / 2 - 50;
  const parts: CustomPart[] = [{ id: "T", name: "Table top", size: [W, tt, D], pos: [0, yt + tt / 2, 0], material: "board" }];
  const legBar = (id: string, name: string, x: number, sz: number) =>
    compound(id, name, [
      bar([x, plate, -sz * zfoot], [x, yt - plate, sz * zt], bw, bt),
      { shape: "box", size: [bt + 20, plate, 90], pos: [x, yt - plate / 2, sz * (zt - 10)] },
      { shape: "box", size: [bt + 20, plate, 90], pos: [x, plate / 2, -sz * (zfoot - 10)] },
    ], "metal");
  const ends = [-1, 1];
  ends.forEach((ex, i) => {
    parts.push(legBar(`A${i}`, "Leg bar, notched on top", ex * xl, 1));
    parts.push(legBar(`B${i}`, "Leg bar, notched underneath", ex * xl, -1));
  });
  const crossY = (yt / 2) | 0;
  // four through each end plate, two plates a leg
  const screws: Vec3[] = ends.flatMap((ex) => [-1, 1].flatMap((sz) => [-1, 1].flatMap((i) => [-1, 1].map((k): Vec3 => [ex * xl + i * 20, yt - plate, sz * (zt - 10) + k * 30]))));
  return {
    parts,
    steps: [
      {
        title: "Slot the leg bars together into two Xs",
        detail: "Lay them flat. Push the notches into each other, then turn one bolt into each crossing with the Allen key.",
        add: ["A0", "B0", "A1", "B1"],
        fix: ends.map((ex, i) => fx("bolt", [[ex * (xl - bt / 2), crossY, 0]], { len: 40, dia: 6, dir: [ex, 0, 0], on: `A${i}`, mate: `B${i}` })),
        tools: ["allen"],
        pose: "+x",
      },
      {
        title: "Lay the top upside down on a rug",
        detail: "Stand the two Xs on it, one across each end, with the end plates on the marks.",
        add: ["T"],
        pose: "-y",
        warnings: ["floor"],
      },
      {
        title: "Screw the legs to the top",
        detail: "Four screws through each end plate, eight for each leg.",
        fix: [fx("screw", screws, { len: 16, dia: 4, dir: UP, mate: "T" })],
        tools: ["screwdriver"],
      },
      { title: "Turn the table over", detail: "Lift it with two people, by the top, not the legs.", pose: "+y", people: 2, warnings: ["two"] },
    ],
  };
}

const family: Family = {
  names: ["SKÅLSTA", "SKALSTA"],
  recipe(s) {
    const t = `${s.slug ?? ""} ${s.variant}`.toLowerCase();
    if (/chair/.test(t)) return chair(s);
    if (/table/.test(t)) return table(s);
    return null;
  },
};
export default family;

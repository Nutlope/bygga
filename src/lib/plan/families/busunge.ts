import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartMaterial, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * BUSUNGE extendable bed, read from IKEA's manual. The headboard is laid on a rug, inside up, with two cam bolts in
 * it, and the two long side rails are stood in it on dowels and locked with big cam locks. The footboard gets its two
 * short rails the same way, and two people slide the foot rails into the head rails. The tall wings at the head and
 * the small ones at the foot click onto the rails with cam bolts, dowels and small cam locks. The slatted base gets
 * its two middle legs (a plate, a long screw into a barrel nut and a screw each), goes into the frame upside down and
 * is bolted to both ends, then two stop screws, six glides under the feet, the joining plate on the slats and two
 * bolts that hold the rails at the length you want.
 * IKEA's sizes: 90 x 209 cm for an 80 x 200 mattress (138 cm pushed in), 107 x 199 for the US 97 x 190; headboard 100.
 */

interface Bit {
  piece: PartPiece;
  lo: Vec3;
  hi: Vec3;
}
const bx = (lo: Vec3, hi: Vec3): Bit => ({
  piece: { shape: "box", size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2] },
  lo,
  hi,
});
function assemble(id: string, name: string, bits: Bit[], material: PartMaterial, extra?: boolean): CustomPart {
  const lo = [0, 1, 2].map((k) => Math.min(...bits.map((b) => b.lo[k]))) as Vec3;
  const hi = [0, 1, 2].map((k) => Math.max(...bits.map((b) => b.hi[k]))) as Vec3;
  const pos = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2) as Vec3;
  return {
    id,
    name,
    size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
    pos,
    material,
    ...(extra ? { extra } : {}),
    pieces: bits.map((b) => ({ ...b.piece, pos: [b.piece.pos[0] - pos[0], b.piece.pos[1] - pos[1], b.piece.pos[2] - pos[2]] as Vec3 })),
  };
}
const box = (id: string, name: string, lo: Vec3, hi: Vec3, material: PartMaterial = "board"): CustomPart => ({
  id,
  name,
  size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
  pos: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2],
  material,
});
const fix = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });

function bed(s: ProductSpec): CustomParams {
  const m = s.variant.match(/(\d+)\s*[x×]\s*(\d+)/);
  const mw = m ? +m[1] * 10 : 800, ml = m ? +m[2] * 10 : 2000;
  const W = mw + 100, L = ml + 90, Lmin = ml - 620; // 200 cm mattress: 209 long pulled out, 138 pushed in
  const T = 22, R = 22; // end panels and rails
  const HB = 1000, FB = 620, LEG = 200, RT = 370; // headboard, footboard, rails from 20 to 37 cm up
  const zH = -L / 2 + T, zF = L / 2 - T; // inner faces of the ends
  const railLen = Lmin - 2 * T;
  const xo = W / 2 - R / 2, xi = W / 2 - R - R / 2; // head rails outside, foot rails slide inside them
  const end = (id: string, name: string, h: number, z0: number, z1: number) =>
    assemble(id, name, [bx([-W / 2, LEG, z0], [W / 2, h, z1]), bx([-W / 2, 0, z0], [-W / 2 + 90, LEG, z1]), bx([W / 2 - 90, 0, z0], [W / 2, LEG, z1])], "board");
  const parts: CustomPart[] = [
    end("E0", "Headboard", HB, -L / 2, zH),
    ...[-1, 1].map((g, i) => box(`R${i}`, "Long side rail", [g * xo - R / 2, LEG, zH], [g * xo + R / 2, RT, zH + railLen])),
    end("E1", "Footboard", FB, zF, L / 2),
    ...[-1, 1].map((g, i) => box(`F${i}`, "Short side rail", [g * xi - R / 2, LEG, zF - railLen], [g * xi + R / 2, RT, zF])),
    // the tall wings stand on the long rails beside the headboard, the small ones on the short rails at the foot
    ...[-1, 1].map((g, i) =>
      assemble(`W${i}`, "Head wing", [bx([g * xo - R / 2, RT, zH], [g * xo + R / 2, HB, zH + 260]), bx([g * xo - R / 2, RT, zH + 260], [g * xo + R / 2, 560, zH + 620])], "board"),
    ),
    ...[-1, 1].map((g, i) => box(`V${i}`, "Foot wing", [g * xi - R / 2, RT, zF - 170], [g * xi + R / 2, FB - 20, zF])),
  ];

  // the slatted base: two halves whose slats slide between each other, a centre beam with two legs under it
  const sx = W / 2 - 2 * R - 6, sy = 300, st = 18;
  const half = (id: string, z0: number, z1: number, off: number) => {
    const dir = Math.sign(z1 - z0);
    const bits: Bit[] = [bx([-sx, sy - 40, Math.min(z0, z0 + dir * 40)], [sx, sy, Math.max(z0, z0 + dir * 40)])];
    for (let z = z0 + dir * (20 + off); dir > 0 ? z < z1 - 30 : z > z1 + 30; z += dir * 130) bits.push(bx([-sx, sy, z - 28], [sx, sy + st, z + 28]));
    return assemble(id, "Slatted base", bits, "wood");
  };
  parts.push(half("S0", zH, zH + railLen, 0), half("S1", zF, zF - railLen, 65));
  // the plate joins the two slats, one from each half, that lie side by side nearest the middle
  const slatsOf = (z0: number, z1: number, off: number) => {
    const dir = Math.sign(z1 - z0), out: number[] = [];
    for (let z = z0 + dir * (20 + off); dir > 0 ? z < z1 - 30 : z > z1 + 30; z += dir * 130) out.push(z);
    return out;
  };
  const near = (zs: number[]) => zs.reduce((a, z) => (Math.abs(z) < Math.abs(a) ? z : a));
  const z1J = near(slatsOf(zF, zF - railLen, 65));
  const zJ = [near(slatsOf(zH, zH + railLen, 0).filter((z) => Math.abs(z - z1J) > 40)), z1J];
  parts.push(box("B", "Centre beam", [-sx, sy - 50, -30], [sx, sy, 30], "wood"));
  const lx = sx - 30;
  parts.push(...[-1, 1].map((g, i) => box(`G${i}`, "Middle leg", [g * lx - 25, 0, -25], [g * lx + 25, sy - 50, 25], "wood")));
  parts.push(box("M", "Mattress", [-mw / 2, sy + st, -ml / 2], [mw / 2, sy + st + 120, ml / 2], "soft"));
  parts[parts.length - 1].extra = true;

  const yy = [LEG + 50, RT - 50];
  const both = (f: (g: number, i: number) => Vec3[]) => [-1, 1].flatMap((g, i) => f(g, i));
  // one fix per side, going outward into each rail from inside (or inward from outside with way -1)
  const sides = (kind: CustomFix["kind"], f: (g: number) => Vec3[], o: Partial<CustomFix> = {}, way = 1) => [-1, 1].map((g) => fix(kind, f(g), [way * g, 0, 0], o));
  const steps: CustomStep[] = [
    {
      title: "Screw the cam bolts into the headboard",
      detail: "Lay it on a rug with the inside facing up. Screw both bolts in by hand until they stop.",
      add: ["E0"],
      fix: [fix("camScrew", both((g) => [[g * xo, (LEG + RT) / 2, zH]]), [0, 0, 1], { len: 48, dia: 6, on: "E0" })],
      tools: ["screwdriver"],
      pose: "+z",
      warnings: ["floor"],
    },
    {
      title: "Stand the long rails in the headboard",
      detail: "Tap two dowels into the end of each rail, push in the stop pin and the cam lock, then lower the rail onto the bolt and turn the cam lock clockwise.",
      add: ["R0", "R1"],
      fix: [
        fix("dowel", both((g) => yy.map((y): Vec3 => [g * xo, y, zH])), [0, 0, -1]),
        ...sides("pin", (g) => [[g * (xo - R / 2), (LEG + RT) / 2, zH + railLen - 60]], { name: "Stop pin", len: 14, dia: 8 }),
        ...sides("cam", (g) => [[g * (xo - R / 2), (LEG + RT) / 2, zH + 40]], { name: "Cam lock", len: 16, dia: 25 }),
      ],
      tools: ["hammer", "flathead"],
    },
    { title: "Stand the head end up", detail: "Lift it by the headboard and the rails together.", pose: "+y" },
    {
      title: "Slide the foot end onto the head end",
      detail: "Build the footboard and its two short rails on the rug the same way first. Then slide the short rails inside the long ones, one person at each end.",
      add: ["E1", "F0", "F1"],
      fix: [
        fix("camScrew", both((g) => [[g * xi, (LEG + RT) / 2, zF]]), [0, 0, -1], { len: 48, dia: 6, on: "E1" }),
        fix("dowel", both((g) => yy.map((y): Vec3 => [g * xi, y, zF])), [0, 0, 1]),
        ...sides("cam", (g) => [[g * (xi - R / 2), (LEG + RT) / 2, zF - 40]], { name: "Cam lock", len: 16, dia: 25 }),
      ],
      from: { E1: [0, 0, 700], F0: [0, 0, 700], F1: [0, 0, 700] },
      people: 2,
      tools: ["flathead"],
    },
    {
      title: "Click the head wings onto the long rails",
      detail: "Screw two cam bolts into the bottom of each wing and tap in two dowels. Lower it until it clicks onto the headboard, then turn the cam locks in the rail.",
      add: ["W0", "W1"],
      fix: [
        fix("camScrew", both((g) => [[g * xo, RT, zH + 120], [g * xo, RT, zH + 480]]), [0, -1, 0], { len: 34, dia: 6 }),
        fix("dowel", both((g) => [[g * xo, RT, zH + 60], [g * xo, RT, zH + 560]]), [0, -1, 0]),
        ...sides("cam", (g) => [[g * (xo - R / 2), RT - 30, zH + 120], [g * (xo - R / 2), RT - 30, zH + 480]], { dia: 15 }),
      ],
      tools: ["screwdriver", "flathead"],
    },
    {
      title: "Click the foot wings onto the short rails",
      detail: "One cam bolt and one dowel in each, then turn the cam lock in the rail.",
      add: ["V0", "V1"],
      fix: [
        fix("camScrew", both((g) => [[g * xi, RT, zF - 110]]), [0, -1, 0], { len: 34, dia: 6 }),
        fix("dowel", both((g) => [[g * xi, RT, zF - 40]]), [0, -1, 0]),
        ...sides("cam", (g) => [[g * (xi - R / 2), RT - 30, zF - 110]], { dia: 15 }),
      ],
      tools: ["screwdriver", "flathead"],
    },
    { title: "Turn the frame upside down", detail: "Lay it on its headboard top and wings on the rug, one person at each end.", pose: "-y", people: 2, warnings: ["two", "floor"] },
    {
      title: "Fit the middle legs and lay the slatted base in",
      detail: "Each leg goes under the centre beam with a plate between them: a long screw through the beam into a barrel nut in the leg, then a screw through the plate. Lower the base in with the legs up.",
      add: ["S0", "S1", "B", "G0", "G1"],
      fix: [
        fix("plate", both((g) => [[g * lx, sy - 50, 0]]), [0, 1, 0], { name: "Leg plate", len: 3, dia: 60, on: "B" }),
        fix("screw", both((g) => [[g * lx, sy, 0]]), [0, -1, 0], { name: "Long screw", len: 110, dia: 6, on: "B" }),
        fix("nut", both((g) => [[g * lx, 140, 25]]), [0, 0, -1], { name: "Barrel nut", len: 18, dia: 10 }),
        fix("screw", both((g) => [[g * lx, sy - 50, 26]]), [0, 0, -1], { len: 40, dia: 4 }),
      ],
      people: 2,
      tools: ["allen", "flathead", "screwdriver"],
    },
    {
      title: "Bolt the slatted base to both ends",
      detail: "Three bolts through the headboard and four through the footboard, into the end bar of each half.",
      fix: [
        fix("bolt", [-0.6, 0, 0.6].map((t): Vec3 => [t * sx, sy - 20, -L / 2]), [0, 0, 1], { len: 70, dia: 8, on: "E0" }),
        fix("bolt", [-0.7, -0.25, 0.25, 0.7].map((t): Vec3 => [t * sx, sy - 20, L / 2]), [0, 0, -1], { len: 70, dia: 8, on: "E1" }),
      ],
      tools: ["allen"],
    },
    {
      title: "Screw in the two stop screws",
      detail: "One in each short rail. They stop the bed being pulled out too far.",
      fix: sides("screw", (g) => [[g * (xi - R / 2), (LEG + RT) / 2, zF - railLen + 40]], { len: 12, dia: 6 }),
      tools: ["screwdriver"],
    },
    {
      title: "Tap the glides under the feet",
      detail: "Four under the headboard and footboard legs, one under each middle leg.",
      fix: [
        fix("glide", [...both((g): Vec3[] => [[g * (W / 2 - 45), 0, -L / 2 + T / 2], [g * (W / 2 - 45), 0, L / 2 - T / 2], [g * lx, 0, 0]])], [0, 1, 0]),
      ],
      tools: ["hammer"],
    },
    {
      title: "Stand it up and screw on the joining plate",
      detail: "Pull the bed out to the length you want. The plate goes across the two halves of the slatted base.",
      pose: "+y",
      people: 2,
      fix: [
        fix("plate", [[0, sy + st, (zJ[0] + zJ[1]) / 2]], [0, -1, 0], { name: "Joining plate", len: 3, dia: 60, on: "S0" }),
        ...zJ.map((z, i) => fix("screw", [[0, sy + st, z]], [0, -1, 0], { len: 16, dia: 4, on: `S${i}` })),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Bolt the rails at that length",
      detail: "One bolt through each long rail into the short rail behind it. Take them out to make the bed longer as your child grows.",
      fix: sides("bolt", (g) => [[g * W / 2, RT - 40, zH + railLen - 40]], { len: 20, dia: 8 }, -1),
      tools: ["allen"],
    },
    { title: "Lay the mattress on", detail: "It should fill the frame, with no gap wider than two fingers.", add: ["M"] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["BUSUNGE"],
  recipe(s) {
    if (!/extendable bed/i.test(s.variant + " " + (s.slug ?? "").replace(/-/g, " "))) return null;
    return bed(s);
  },
};
export default family;

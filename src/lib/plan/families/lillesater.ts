import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * LILLESÄTER, read from its manuals. The 3-seat sofa is two seat bases, each with a rounded arm end, and a curved back
 * in two halves. The bases get their feet upside down, are bolted together side by side with two studs and nuts and
 * turned over; the back halves are joined with one stud, four studs go into the bottom of the back, two people lower it
 * onto the seat and it is nutted from underneath with the box spanner.
 * The 4, 5 and 6-seat sofas are the 3-seat sofa with one, two or three 1-seat sections in the middle, and the 1-seat
 * section's manual builds them differently: every section gets its own back nutted on first, then the sections lie
 * upside down in a row and are joined with two studs and one guide pin at each join.
 * The swivel easy chair comes ready assembled (IKEA has only a care sheet for it), so its guide unpacks it.
 */

type Kind = CustomFix["kind"];
const fx = (kind: Kind, at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const r1 = (n: number) => Math.round(n * 10) / 10;
const G = [-1, 1] as const;

const box = (size: Vec3, pos: Vec3): PartPiece => ({ shape: "box", size, pos });
const post = (dia: number, h: number, pos: Vec3): PartPiece => ({ shape: "cyl", size: [dia, h, dia], pos });

/** A part drawn as pieces placed in product coordinates: works out its box and moves the pieces relative to it. */
function built(id: string, name: string, pieces: PartPiece[]): CustomPart {
  const ext = (p: PartPiece): [Vec3, Vec3] => [p.pos.map((v, i) => v - p.size[i] / 2) as Vec3, p.pos.map((v, i) => v + p.size[i] / 2) as Vec3];
  const boxes = pieces.map(ext);
  const lo = [0, 1, 2].map((i) => Math.min(...boxes.map((b) => b[0][i]))) as Vec3;
  const hi = [0, 1, 2].map((i) => Math.max(...boxes.map((b) => b[1][i]))) as Vec3;
  const mid = lo.map((v, i) => r1((v + hi[i]) / 2)) as Vec3;
  return { id, name, size: lo.map((v, i) => r1(hi[i] - v)) as Vec3, pos: mid, material: "soft", pieces: pieces.map((p) => ({ ...p, pos: p.pos.map((v, i) => r1(v - mid[i])) as Vec3 })) };
}

// IKEA's measures: 90 deep, back 69 high, seat 44 high, arms 51 high and 16 wide, 2 cm under; the 3-seat is 201 wide
// and each 1-seat section adds 68
const D = 900, H = 690, SEAT = 440, ARM = 510, AW = 160, FOOT = 20;
const END = 1005, MID = 680;
const BT = 250; // the back's thickness front to back
const R = 200; // the rounded corners of the seat at each end

const STUD = { len: 70, dia: 8, name: "Threaded stud" };
const PIN = { kind: "stud" as Kind, len: 150, dia: 10, name: "Guide pin" };
const NUT = { len: 7, dia: 8 };
const WASHER = { len: 2, dia: 20 };
const BIG = { len: 3, dia: 40, name: "Large washer" };
const FOOTD = { len: FOOT, dia: 60, name: "Foot" };
const PAD = { len: 4, dia: 50, name: "Felt pad" };

interface Sec {
  base: string;
  back: string;
  x0: number;
  x1: number;
  end: -1 | 0 | 1; // which arm end it carries
}

function endBase(sx: number, x0: number, x1: number): PartPiece[] {
  const outer = sx < 0 ? x0 : x1, inner = sx < 0 ? x1 : x0;
  const h = SEAT - FOOT, yc = (SEAT + FOOT) / 2;
  const xr = outer - sx * R; // centre of the rounded corners
  return [
    box([Math.abs(inner - xr), h, D], [(inner + xr) / 2, yc, 0]),
    box([R, h, D - 2 * R], [(outer + xr) / 2, yc, 0]),
    post(2 * R, h, [xr, yc, -(D / 2 - R)]),
    post(2 * R, h, [xr, yc, D / 2 - R]),
  ];
}

function endBack(sx: number, x0: number, x1: number): PartPiece[] {
  const outer = sx < 0 ? x0 : x1, inner = sx < 0 ? x1 : x0;
  const zb = -D / 2 + BT / 2;
  const hb = H - SEAT, ha = ARM - SEAT;
  const xa = outer - sx * (AW / 2);
  const zf = D / 2 - 150; // the arm's rounded front end, kept inside the base's rounded corner
  return [
    box([Math.abs(inner - outer) - BT / 2, hb, BT], [(inner + outer - sx * (BT / 2)) / 2, SEAT + hb / 2, zb]),
    post(BT, hb, [outer - sx * (BT / 2), SEAT + hb / 2, zb]),
    box([AW, ha, zf - zb], [xa, SEAT + ha / 2, (zf + zb) / 2]),
    post(AW, ha, [xa, SEAT + ha / 2, zf]),
  ];
}

function sofa(s: ProductSpec): CustomParams | null {
  const m = /(\d)-seat/.exec(s.slug ?? "");
  const seats = m ? Number(m[1]) : 3;
  if (seats < 3 || seats > 6) return null;
  const n = seats - 3; // 1-seat sections in the middle
  const Wt = 2 * END + n * MID;
  const secs: Sec[] = [];
  let x = -Wt / 2;
  secs.push({ base: "BL", back: "AL", x0: x, x1: x + END, end: -1 });
  x += END;
  for (let i = 1; i <= n; i++) {
    secs.push({ base: `M${i}`, back: `N${i}`, x0: x, x1: x + MID, end: 0 });
    x += MID;
  }
  secs.push({ base: "BR", back: "AR", x0: x, x1: x + END, end: 1 });

  const parts: CustomPart[] = [];
  for (const c of secs) {
    if (c.end) {
      parts.push(built(c.base, "Seat base with arm end", endBase(c.end, c.x0, c.x1)));
      parts.push(built(c.back, "Back with armrest", endBack(c.end, c.x0, c.x1)));
    } else {
      const w = c.x1 - c.x0, xc = (c.x0 + c.x1) / 2;
      parts.push({ id: c.base, name: "Seat base", size: [w, SEAT - FOOT, D], pos: [xc, (SEAT + FOOT) / 2, 0], material: "soft" });
      parts.push({ id: c.back, name: "Back", size: [w, H - SEAT, BT], pos: [xc, (SEAT + H) / 2, -D / 2 + BT / 2], material: "soft" });
    }
  }

  // feet: three under an end base (one at the arm end, two near the join), two under a middle section
  const feetOf = (c: Sec): Vec3[] => {
    if (!c.end) return G.map((sz) => [(c.x0 + c.x1) / 2, 0, sz * (D / 2 - 120)]);
    const outer = c.end < 0 ? c.x0 : c.x1, inner = c.end < 0 ? c.x1 : c.x0;
    return [[outer - c.end * 160, 0, 0], ...G.map((sz) => [inner + c.end * 120, 0, sz * (D / 2 - 120)] as Vec3)];
  };
  const feet = (list: Sec[]) => list.flatMap(feetOf);
  const zs = -D / 2 + BT / 2; // the back's studs, in line under the back
  const backStudsOf = (c: Sec): Vec3[] => {
    if (!c.end) return G.map((sx) => [(c.x0 + c.x1) / 2 + sx * 200, SEAT, zs]);
    const inner = c.end < 0 ? c.x1 : c.x0;
    return [inner + c.end * 250, inner + c.end * 750].map((x) => [x, SEAT, zs] as Vec3);
  };
  const joins = secs.slice(1).map((c, i) => ({ x: c.x0, left: secs[i], right: c }));
  const yJ = 220, zJ = D / 2 - 200;
  const joinStuds = joins.flatMap((j) => G.map((sz) => ({ j, at: [j.x, yJ, sz * zJ] as Vec3 })));
  const joinNuts = (list: typeof joinStuds) => list.map(({ j, at }) => ({ j, at: [at[0] + 80, at[1], at[2]] as Vec3 }));
  const yP = SEAT + (H - SEAT) / 2;

  const washNut = (at: Vec3[], dir: Vec3, on: string, mate: string): CustomFix[] => [fx("washer", at, dir, { ...WASHER, on }), fx("nut", at, dir, { ...NUT, on, mate })];
  const under = (c: Sec) => backStudsOf(c).map((p) => [p[0], FOOT, p[2]] as Vec3);

  if (n === 0) {
    const [L, Rt] = secs;
    const steps: CustomStep[] = [
      {
        title: "Lay the two seat bases upside down and screw on six feet",
        detail: "On a rug or the flattened box. Three feet in each base, turned in by hand until they stop.",
        add: ["BL", "BR"],
        pose: "-y",
        warnings: ["floor"],
        fix: [fx("foot", feet(secs), [0, 1, 0], FOOTD)],
      },
      { title: "Stick a felt pad under each foot", detail: "Press them on firmly.", fix: [fx("glide", feet(secs), [0, 1, 0], PAD)] },
      {
        title: "Screw two studs into the side of one base",
        detail: "Into the two holes at its open end, by hand until they stop.",
        fix: [fx("stud", joinStuds.map((q) => q.at), [-1, 0, 0], { ...STUD, on: "BL", mate: "BR" })],
      },
      { title: "Push the two bases together", detail: "The studs go through the holes in the other base's frame." },
      {
        title: "Bolt the bases together",
        detail: "A washer and a nut on each stud from inside the frame, tightened with the box spanner.",
        fix: washNut(joinNuts(joinStuds).map((q) => q.at), [-1, 0, 0], "BR", "BL"),
        tools: ["wrench"],
      },
      { title: "Turn the seat over", detail: "One of you at each end. Lift it, don't roll it on its feet.", pose: "+y", people: 2 },
      {
        title: "Screw a stud into the side of one back half",
        detail: "The back halves are easiest to join lying on the floor. One stud, by hand, in the hole at the open end.",
        add: ["AL"],
        from: { AL: [0, 450, 0] },
        fix: [fx("stud", [[0, yP, zs]], [-1, 0, 0], { ...STUD, on: "AL", mate: "AR" })],
      },
      { title: "Push the two back halves together", detail: "The stud goes through the hole in the other half.", add: ["AR"], from: { AR: [0, 450, 0] } },
      {
        title: "Nut the back halves together",
        detail: "A washer and a nut from inside, with the box spanner.",
        fix: washNut([[80, yP, zs]], [-1, 0, 0], "AR", "AL"),
        tools: ["wrench"],
      },
      {
        title: "Screw four studs into the bottom of the back",
        detail: "Two in each half, by hand until they stop.",
        fix: [L, Rt].map((c) => fx("stud", backStudsOf(c), [0, 1, 0], { ...STUD, on: c.back, mate: c.base })),
      },
      {
        title: "Lower the back onto the seat",
        detail: "One of you at each end. The four studs go down through the holes at the back of the seat.",
        people: 2,
      },
      { title: "Turn the sofa upside down", detail: "Two of you, onto the rug, so you can reach under the seat.", pose: "-y", people: 2, warnings: ["floor"] },
      {
        title: "Nut the back on from underneath",
        detail: "A washer and a nut on each of the four studs, tightened with the box spanner.",
        fix: [L, Rt].flatMap((c) => washNut(under(c), [0, 1, 0], c.base, c.back)),
        tools: ["wrench"],
      },
      {
        title: "Stand the sofa up",
        detail: "Two of you, lifting. Keep the spare guide pin and large washer: they join a 1-seat section if you add one later.",
        pose: "+y",
        people: 2,
      },
    ];
    return { parts, steps };
  }

  const backStuds = secs.flatMap((c) => backStudsOf(c));
  const steps: CustomStep[] = [
    {
      title: `Lay the ${secs.length} seat bases upside down and screw on the feet`,
      detail: `On a rug or the flattened boxes, in a row: arm ends at the ends. ${feet(secs).length} feet, turned in by hand.`,
      add: secs.map((c) => c.base),
      pose: "-y",
      warnings: ["floor"],
      fix: [fx("foot", feet(secs), [0, 1, 0], FOOTD)],
    },
    { title: "Stick a felt pad under each foot, then turn the bases over", detail: "Press the pads on firmly first.", fix: [fx("glide", feet(secs), [0, 1, 0], PAD)] },
    {
      title: `Screw ${backStuds.length} studs into the bottoms of the backs`,
      detail: "Two in each back, by hand until they stop.",
      pose: "+y",
      wait: secs.map((c) => c.back),
      fix: secs.map((c) => fx("stud", backStudsOf(c), [0, 1, 0], { ...STUD, on: c.back, mate: c.base })),
    },
    {
      title: "Lower each back onto its seat base",
      detail: "The studs go down through the holes at the back of the base.",
      add: secs.map((c) => c.back),
      from: Object.fromEntries(secs.map((c) => [c.back, [0, 450, 0] as Vec3])),
    },
    { title: "Turn each section upside down", detail: "Each section on its own for now, onto the rug.", pose: "-y", warnings: ["floor"] },
    {
      title: "Nut each back on from underneath",
      detail: `A washer and a nut on all ${backStuds.length} studs, tightened with the box spanner.`,
      fix: secs.flatMap((c) => washNut(under(c), [0, 1, 0], c.base, c.back)),
      tools: ["wrench"],
    },
    {
      title: `Screw ${joinStuds.length} studs into the sides of the bases`,
      detail: "Two at each place two sections meet, by hand until they stop.",
      fix: joins.map((j) => fx("stud", joinStuds.filter((q) => q.j === j).map((q) => q.at), [-1, 0, 0], { ...STUD, on: j.left.base, mate: j.right.base })),
    },
    {
      title: `Screw ${joins.length} guide pins into the sides of the backs`,
      detail: "A large washer on each, then into the hole at the side of the back, one at each join.",
      fix: joins.flatMap((j) => [fx("washer", [[j.x, yP, zs]], [-1, 0, 0], { ...BIG, on: j.left.back }), fx("stud", [[j.x, yP, zs]], [-1, 0, 0], { ...PIN, on: j.left.back, mate: j.right.back })]),
    },
    { title: "Push the sections together", detail: "Studs and pins into the holes of the next section, until they meet all along." },
    {
      title: "Bolt the sections together",
      detail: `A washer and a nut on each of the ${joinStuds.length} studs from inside the frame, with the box spanner.`,
      fix: joins.flatMap((j) => washNut(joinNuts(joinStuds.filter((q) => q.j === j)).map((q) => q.at), [-1, 0, 0], j.right.base, j.left.base)),
      tools: ["wrench"],
    },
    {
      title: "Turn the sofa over",
      detail: "Three of you, lifting all along so the joins don't bend. Keep the manual: you can add more sections later.",
      pose: "+y",
      people: 2,
    },
  ];
  return { parts, steps };
}

/** An oval ring's back part, as [x, z] corners: the outer edge one way, the inner edge back. */
function crescent(rx: number, rz: number, t: number, a0: number, a1: number, n = 16): [number, number][] {
  const pt = (a: number, d: number): [number, number] => [Math.round((rx - d) * Math.cos(a)), Math.round((rz - d) * Math.sin(a))];
  const as = Array.from({ length: n + 1 }, (_, i) => a0 + ((a1 - a0) * i) / n);
  return [...as.map((a) => pt(a, 0)), ...as.reverse().map((a) => pt(a, t))];
}

function swivel(s: ProductSpec): CustomParams {
  // IKEA: 70 wide, 71 high, 79 deep; a round padded body on a low black swivel disc
  const W = s.size.w * 10, H = s.size.h * 10, Dp = s.size.d * 10;
  const disc = 30, seat = 420;
  const c: Vec3 = [0, H / 2, 0];
  const at = (p: PartPiece): PartPiece => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]] });
  const raw: PartPiece[] = [
    { shape: "cyl", size: [W - 140, disc, W - 140], pos: [0, disc / 2, 20], material: "metal" },
    { shape: "slab", size: [W, seat - disc, Dp], pos: [0, disc + (seat - disc) / 2, 0], outline: [[-W / 2, -Dp / 2], [W / 2, -Dp / 2], [W / 2, Dp / 2], [-W / 2, Dp / 2]], round: W * 0.42 },
    { shape: "slab", size: [W, H - seat, Dp / 2], pos: [0, seat + (H - seat) / 2, 0], outline: crescent(W / 2 - 10, Dp / 2 - 10, 200, Math.PI + 0.25, 2 * Math.PI - 0.25), round: 20 },
  ];
  const pieces = raw.map(at);
  return {
    parts: [{ id: "CH", name: "Swivel easy chair", size: [W, H, Dp], pos: c, pieces, material: "soft" }],
    steps: [
      { title: "Unpack the chair", detail: "It comes ready assembled, so there is nothing to put together. Cut the wrapping open carefully so the knife can't catch the fabric.", add: ["CH"] },
      { title: "Set it on a flat floor", detail: "Turn the seat once all the way round to check it swivels freely." },
    ],
  };
}

const family: Family = {
  names: ["LILLESÄTER", "LILLESATER"],
  recipe(s) {
    if (/seat-sofa/.test(s.slug ?? "")) return sofa(s);
    if (/swivel/.test(s.slug ?? "")) return swivel(s);
    return null;
  },
};
export default family;

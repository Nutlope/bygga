import type { Family } from "./family";
import type { CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * TÄRNÖ, read from its manuals. The stool and the table come folded, with the steel leg frames already joined to
 * each other at the pivots and one frame hinged to the slatted top. You lay the top upside down, open the frames
 * into an X and push the pegs at the top of the legs out into the keyhole slots of the top's two steel bars, then
 * slide them along to lock. The table has a V brace that swings up and is held under the top with one knob bolt.
 * The stool sold with a cushion gets its cushion last. The folding chair and the folding bench are sold ready to use
 * and have no manual: their guides only unfold them and check they stand firm.
 */

const TUBE = 16;

/** A round steel tube from a to b, in the y-z plane (a leg) or the x-y plane (a bar or a brace). */
function tube(a: Vec3, b: Vec3, dia = TUBE): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const rot: Vec3 = Math.abs(d[0]) < 1e-6 ? [Math.atan2(d[2], d[1]), 0, 0] : [0, 0, Math.atan2(-d[0], d[1])];
  return { shape: "cyl", size: [dia, len, dia], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot, material: "metal" };
}

/** A part from pieces given where they sit in the finished product: centred on their bounds. */
function compound(id: string, name: string, pieces: PartPiece[], material: CustomPart["material"]): CustomPart {
  const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of pieces) {
    const r = p.shape === "cyl" ? p.size[0] / 2 : 0;
    // a tube's ends, or a box's corners
    const ext: Vec3[] =
      p.shape === "cyl"
        ? [1, -1].map((s) => {
            const [rx, , rz] = p.rot ?? [0, 0, 0];
            const h = (s * p.size[1]) / 2;
            return [p.pos[0] - Math.sin(rz) * h, p.pos[1] + Math.cos(rx) * Math.cos(rz) * h, p.pos[2] + Math.sin(rx) * h] as Vec3;
          })
        : [1, -1].map((s) => [p.pos[0] + (s * p.size[0]) / 2, p.pos[1] + (s * p.size[1]) / 2, p.pos[2] + (s * p.size[2]) / 2] as Vec3);
    for (const e of ext)
      for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lo[i], e[i] - r);
        hi[i] = Math.max(hi[i], e[i] + r);
      }
  }
  const pos: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  const size: Vec3 = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
  return { id, name, size, pos, material, pieces: pieces.map((p) => ({ ...p, pos: [p.pos[0] - pos[0], p.pos[1] - pos[1], p.pos[2] - pos[2]] })) };
}

interface Geo {
  W: number;
  D: number;
  H: number; // to the top of the slats
  slats: number;
}

function topPart(g: Geo, plate: boolean): { part: CustomPart; pivotY: number; barX: number } {
  const { W, D, H, slats } = g;
  const st = 18, bh = 25, bw = 22;
  const gap = 6;
  const sw = (D - gap * (slats - 1)) / slats;
  const barX = W / 2 - 30;
  const pieces: PartPiece[] = [];
  for (let i = 0; i < slats; i++) pieces.push({ shape: "box", size: [W, st, sw], pos: [0, H - st / 2, -D / 2 + sw / 2 + i * (sw + gap)], material: "wood" });
  // the steel bars under the slats that hold the pivots and the keyhole slots
  for (const sx of [-1, 1]) pieces.push({ shape: "box", size: [bw, bh, D - 20], pos: [sx * barX, H - st - bh / 2, 0], material: "metal" });
  if (plate) pieces.push({ shape: "box", size: [2 * barX - bw, 4, 60], pos: [0, H - st - 2, 0], material: "metal" });
  return { part: compound("T", plate ? "Table top" : "Seat", pieces, "wood"), pivotY: H - st - bh / 2, barX: barX - bw / 2 - TUBE / 2 };
}

/** One leg frame: two legs from a top end to the floor, joined by bars. `top` is where its top end sits (-1 back, 1 front). */
function frame(id: string, g: Geo, xLeg: number, top: number, pivotY: number, zt: number, zf: number, bars: number[]): CustomPart {
  const foot = 14;
  const zTop = top * zt, zBot = -top * zf;
  const zAt = (y: number) => zBot + ((zTop - zBot) * (y - foot)) / (pivotY - foot);
  const pieces: PartPiece[] = [];
  for (const sx of [-1, 1]) {
    pieces.push(tube([sx * xLeg, foot, zBot], [sx * xLeg, pivotY, zTop]));
    pieces.push({ shape: "box", size: [22, foot, 34], pos: [sx * xLeg, foot / 2, zBot], material: "metal" });
  }
  // the top bar carries the pivots or the pegs; the others brace the legs
  for (const y of [pivotY, ...bars]) pieces.push(tube([-xLeg, y, zAt(y)], [xLeg, y, zAt(y)], 12));
  return compound(id, "Leg frame", pieces, "metal");
}

function stool(s: ProductSpec): CustomParams {
  const g: Geo = { W: 300, D: 290, H: 420, slats: 5 };
  const { part: seat, pivotY, barX } = topPart(g, false);
  const zt = g.D / 2 - 30, zf = g.D / 2 - 8;
  // the outer frame is hinged to the seat at the back; the inner one has the pegs, at the front
  const A = frame("A", g, barX, -1, pivotY, zt, zf, [70, pivotY - 70]);
  const B = frame("B", g, barX - TUBE - 2, 1, pivotY, zt, zf, [70, pivotY - 110]);
  const parts: CustomPart[] = [seat, A, B];
  const steps: CustomStep[] = [
    {
      title: "Lay the seat upside down and open the legs",
      detail: "On a rug, slats down. Swing the leg frames up and apart until they cross in an X.",
      add: ["T"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Click the first pair of pegs into the slots",
      detail: "Squeeze the two legs together, let the pegs at their ends into the round end of each keyhole, then let go so they slide along and lock.",
      add: ["A"],
      warnings: ["hand"],
    },
    {
      title: "Click in the other pair of pegs",
      detail: "The same way on the other frame. Pull each leg to check both pegs sit at the narrow end of their slots.",
      add: ["B"],
      warnings: ["hand"],
    },
    { title: "Turn the stool the right way up", detail: "It folds again the same way: push the pegs back to the round end of the slots.", pose: "+y" },
  ];
  if (/cushion|kuddarna|outdoor/i.test(`${s.variant} ${s.slug ?? ""}`)) {
    parts.push({ id: "C", name: "Seat cushion", size: [320, 50, 310], pos: [0, g.H + 25, 0], material: "soft" });
    steps.push({ title: "Lay the cushion on the seat", detail: "Tie its strings round the steel bars under the seat so it stays put.", add: ["C"] });
  }
  return { parts, steps };
}

function table(): CustomParams {
  const g: Geo = { W: 550, D: 540, H: 700, slats: 7 };
  const { part: top, pivotY, barX } = topPart(g, true);
  const z = g.D / 2 - 40;
  const A = frame("A", g, barX, -1, pivotY, z, z, [60]);
  const xb = barX - TUBE - 2;
  const B = frame("B", g, xb, 1, pivotY, z, z, [60]);
  // the frames cross half way up: the V brace runs from both crossings to the middle of the top
  const foot = 14;
  const yc = foot + (pivotY - foot) / 2;
  const plateY = pivotY + 25 / 2 - 4;
  const V = compound("V", "Brace", [tube([-xb + TUBE, yc, 0], [0, plateY - 10, 0], 12), tube([xb - TUBE, yc, 0], [0, plateY - 10, 0], 12)], "metal");
  const parts: CustomPart[] = [top, A, B, V];
  const steps: CustomStep[] = [
    {
      title: "Lay the top upside down and lift the legs",
      detail: "On a rug, slats down. The frame at the back is already hinged to the top; lift the legs up into an X.",
      add: ["T", "A"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Click the pegs into the slots",
      detail: "Pull the two legs of the other frame apart, put each peg into the round end of its keyhole, then push them along until they lock.",
      add: ["B"],
      warnings: ["hand"],
    },
    {
      title: "Swing up the brace and screw in the knob bolt",
      detail: "Into the plate in the middle of the top, by hand until it is tight.",
      add: ["V"],
      fix: [{ kind: "stud", name: "Knob bolt", count: 1, len: 20, dia: 6, at: [[0, plateY - 10, 0]], dir: [0, 1, 0], on: "V", mate: "T" }],
      warnings: ["hand"],
    },
    { title: "Turn the table the right way up", detail: "To fold it again, undo the knob bolt first, then slide the pegs back out of their slots.", pose: "+y" },
  ];
  return { parts, steps };
}

/** The folding chair or bench: one steel frame (back legs, back slats, the crossed front legs) and the slatted seat hinged in it. */
function chair(s: ProductSpec, bench = false): CustomParams {
  const what = bench ? "bench" : "chair";
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const xl = W / 2 - TUBE, yS = 450, foot = 12;
  const zBf = -D / 2 + 15, zBt = -D / 2 + 40; // back legs: foot and top
  const zBack = (y: number) => zBf + ((zBt - zBf) * y) / H;
  const pieces: PartPiece[] = [];
  for (const sx of [-1, 1]) {
    const x = sx * xl;
    pieces.push(tube([x, foot, zBf], [x, H, zBt]));
    // the front leg runs from the front foot up to the back leg under the seat; the strut from the seat front to the back
    pieces.push(tube([x - sx * TUBE, foot, D / 2 - 15], [x - sx * TUBE, yS - 30, zBack(yS - 30) + TUBE]));
    pieces.push(tube([x - sx * 2 * TUBE, yS - 20, D / 2 - 70], [x - sx * 2 * TUBE, foot + 60, zBack(foot + 60) + 2 * TUBE]));
    for (const z of [zBf, D / 2 - 15]) pieces.push({ shape: "box", size: [22, foot, 30], pos: [x, foot / 2, z], material: "metal" });
  }
  for (const y of bench ? [H - 50, H - 145, H - 240] : [H - 60, H - 170]) pieces.push({ shape: "box", size: [2 * xl + TUBE, 15, 55], pos: [0, y, zBack(y) + TUBE / 2 + 8], rot: [Math.atan2(zBt - zBf, H), 0, 0], material: "wood" });
  pieces.push(tube([-xl, 120, D / 2 - 50], [xl, 120, D / 2 - 50], 10));
  const frame = compound("F", bench ? "Bench frame" : "Chair frame", pieces, "metal");
  const SD = bench ? 340 : 280, slats = 5, gap = 8, sw = (SD - gap * (slats - 1)) / slats;
  const z0 = zBack(yS) + TUBE + 10;
  const seatPieces: PartPiece[] = [];
  for (let i = 0; i < slats; i++) seatPieces.push({ shape: "box", size: [2 * xl - 2 * TUBE, 15, sw], pos: [0, yS - 7.5, z0 + sw / 2 + i * (sw + gap)], material: "wood" });
  for (const sx of [-1, 1]) seatPieces.push({ shape: "box", size: [8, 20, SD], pos: [sx * (xl - TUBE - 8), yS - 25, z0 + SD / 2], material: "metal" });
  const seat = compound("S", "Seat", seatPieces, "wood");
  return {
    parts: [frame, seat],
    steps: [
      {
        title: `Stand the ${what} up and open the legs`,
        detail: "It comes ready to use, with nothing to screw. Stand it on its feet and pull the front legs forward, away from the back.",
        add: ["F"],
      },
      {
        title: "Fold the seat down",
        detail: "Push the front of the seat down and the front legs swing out with it, until the seat rests level on the frame.",
        add: ["S"],
        from: { S: [0, 220, -170] },
        warnings: ["hand"],
      },
      {
        title: "Check it stands firm",
        detail: `All four feet flat on the floor and the seat level. To fold the ${what}, lift the front edge of the seat up to the back.`,
      },
    ],
  };
}

const family: Family = {
  names: ["TÄRNÖ", "TARNO"],
  recipe(s) {
    const v = s.variant.toLowerCase();
    if (/^stool/.test(v)) return stool(s);
    if (/^table/.test(v)) return table();
    if (/chair/.test(v)) return chair(s);
    if (/^bench/.test(v)) return chair(s, true);
    return null;
  },
};
export default family;

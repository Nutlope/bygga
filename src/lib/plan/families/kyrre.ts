import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * KYRRE, read from the stool's manual. The seat is one rounded triangle of birch plywood; each of the three bent legs
 * runs up from the floor and turns in under the seat as a short flat arm. With the seat upside down on a rug, each
 * arm takes two Allen screws, sunk flush, then a glide is pressed into each foot.
 */

const SEAT_T = 18;
const LEG_T = 20, LEG_W = 42;
const SCREW = { name: "Allen screw", len: 30, dia: 6 };

/** A box from a to b (its length along local y), turned so local x faces `u` when it runs straight up. */
function bar(a: Vec3, b: Vec3, sx: number, sz: number, u: [number, number]): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const h = Math.hypot(d[0], d[2]);
  const [ux, uz] = h > 1e-6 ? [d[0] / h, d[2] / h] : u;
  return { shape: "box", size: [sx, len, sz], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [0, Math.atan2(-uz, ux), -Math.acos(d[1] / len)] };
}

/** One part from pieces placed in the finished product: its box is roughly their extent, the pieces are moved into it. */
function part(id: string, name: string, abs: PartPiece[], lo: Vec3, hi: Vec3, material: CustomPart["material"]): CustomPart {
  const c: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  const pieces = abs.map((p) => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]] as Vec3 }));
  return { id, name, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: c, pieces, material };
}

function stool(s: ProductSpec): CustomParams {
  // IKEA: 42 wide, 48 deep, 45 high; the seat itself 34 x 35
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const R = 60; // corner radius of the seat
  const SW = 340, SD = 350;
  const top = H, bot = H - SEAT_T;
  const xb = SW / 2 - R, zf = 125, zb = zf - (SD - 2 * R);
  const corners: [number, number][] = [[0, zf], [-xb, zb], [xb, zb]];

  // the seat: one rounded triangle of plywood
  const seatAbs: PartPiece[] = [{ shape: "slab", size: [SW, SEAT_T, SD], pos: [0, bot + SEAT_T / 2, 0], outline: [[0, zf + R], [-SW / 2, zb - R], [SW / 2, zb - R]], round: 95 }];
  const zIn = zb + 85;
  const parts: CustomPart[] = [part("SEAT", "Seat", seatAbs, [-SW / 2, bot, zb - R], [SW / 2, top, zf + R], "wood")];

  // legs: where each meets the seat and where it stands, splayed out to IKEA's footprint
  const feet: [number, number][] = [[0, D / 2 - 10], [-(W / 2 - 10), -(D / 2 - 10)], [W / 2 - 10, -(D / 2 - 10)]];
  const tops: [number, number][] = [[0, zf + 25], [-(xb + 20), zb - 15], [xb + 20, zb - 15]];
  const screws: Vec3[] = [];
  const glides: Vec3[] = [];
  tops.forEach(([tx, tz], i) => {
    const [fx, fz] = feet[i];
    const ri = Math.hypot(tx, tz - zIn);
    const u: [number, number] = [tx / ri, (tz - zIn) / ri]; // out from the middle of the seat
    const armY = bot - LEG_T / 2;
    const inner: Vec3 = [tx - u[0] * 120, armY, tz - u[1] * 120];
    const abs = [bar([fx, 0, fz], [tx, bot - 6, tz], LEG_T, LEG_W, u), bar([tx + u[0] * 8, armY, tz + u[1] * 8], inner, LEG_T, LEG_W, u)];
    const xs = [fx, tx, inner[0]], zs = [fz, tz, inner[2]];
    const lo: Vec3 = [Math.min(...xs) - LEG_W / 2, 0, Math.min(...zs) - LEG_W / 2];
    const hi: Vec3 = [Math.max(...xs) + LEG_W / 2, bot, Math.max(...zs) + LEG_W / 2];
    parts.push(part(`LEG${i}`, "Leg", abs, lo, hi, "wood"));
    [40, 95].forEach((r) => screws.push([tx - u[0] * r, bot - LEG_T, tz - u[1] * r]));
    glides.push([fx, 0, fz]);
  });
  const legIds = parts.slice(1).map((p) => p.id);
  const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string | undefined, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });

  return {
    parts,
    steps: [
      {
        title: "Screw the three legs under the seat",
        detail: "Lay the seat upside down on a rug. Two screws through each leg's flat arm, until the heads sit flush with the wood, not standing proud.",
        add: ["SEAT", ...legIds],
        fix: legIds.map((id, i) => fx("screw", screws.slice(2 * i, 2 * i + 2), [0, 1, 0], id, { ...SCREW, mate: "SEAT" })),
        tools: ["allen"],
        pose: "-y",
        warnings: ["floor"],
      },
      {
        title: "Press a glide into each foot",
        detail: "Push them in by hand until they sit tight against the wood, then turn the stool onto its feet.",
        fix: legIds.map((id, i) => fx("glide", [glides[i]], [0, 1, 0], id, { name: "Glide", len: 10, dia: 22 })),
      },
    ],
  };
}

const family: Family = {
  names: ["KYRRE"],
  recipe: (s) => (/stool/i.test(`${s.variant} ${s.slug ?? ""}`) ? stool(s) : null),
};
export default family;

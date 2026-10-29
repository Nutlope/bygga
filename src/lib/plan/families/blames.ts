import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartMaterial, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * BLÅMES highchair, read from its manual. The chair is built lying on its side on a rug. Each side comes as one
 * frame (front leg, back leg and the side rail). Dowels go into the two seat rails, which stand up from the lower
 * side frame; the seat slides into their grooves, the backrest slides into the top rail and stands in place, and
 * the two rungs push into their holes. The other side frame goes on top, and each side takes one short and three
 * long screws into barrel nuts (turned over in between). The belt is threaded through its three slots, the chair is
 * stood up and buckled, and the tray clips onto two holders screwed to the front legs.
 */

const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });

interface Bit {
  piece: PartPiece;
  lo: Vec3;
  hi: Vec3;
}
/** A square leg from a to b (cross-section t x t). */
function beam(a: Vec3, b: Vec3, t: number): Bit {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  return {
    piece: { shape: "box", size: [t, len, t], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [Math.atan2(d[2], d[1]), 0, Math.asin(-d[0] / len)] },
    lo: [0, 1, 2].map((k) => Math.min(a[k], b[k]) - t / 2) as Vec3,
    hi: [0, 1, 2].map((k) => Math.max(a[k], b[k]) + t / 2) as Vec3,
  };
}
const bx = (lo: Vec3, hi: Vec3): Bit => ({
  piece: { shape: "box", size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2] },
  lo,
  hi,
});
function assemble(id: string, name: string, bits: Bit[], material: PartMaterial): CustomPart {
  const lo = [0, 1, 2].map((k) => Math.min(...bits.map((b) => b.lo[k]))) as Vec3;
  const hi = [0, 1, 2].map((k) => Math.max(...bits.map((b) => b.hi[k]))) as Vec3;
  const pos = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2) as Vec3;
  return {
    id,
    name,
    size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
    pos,
    material,
    pieces: bits.map((b) => ({ ...b.piece, pos: [b.piece.pos[0] - pos[0], b.piece.pos[1] - pos[1], b.piece.pos[2] - pos[2]] as Vec3 })),
  };
}

function recipe(s: ProductSpec): CustomParams | null {
  if (!/highchair/i.test(`${s.slug ?? ""} ${s.variant}`)) return null;
  const tray = /tray/i.test(`${s.slug ?? ""} ${s.variant}`);
  // IKEA's measures: 52 wide, 53 deep, 93 high, the seat 56 up and 30 x 24 inside
  const H = 930, FT = 650, SEAT = 560, L = 36;
  // the legs splay out to the floor both ways
  const frontFoot = (sx: number): Vec3 => [sx * 242, 0, 247];
  const frontTop = (sx: number): Vec3 => [sx * 178, FT, 120];
  const backFoot = (sx: number): Vec3 => [sx * 242, 0, -247];
  const backTop = (sx: number): Vec3 => [sx * 160, H, -95];
  const on = (a: Vec3, b: Vec3, y: number): Vec3 => {
    const t = (y - a[1]) / (b[1] - a[1]);
    return [a[0] + t * (b[0] - a[0]), y, a[2] + t * (b[2] - a[2])];
  };
  const railY = SEAT - 40;
  const parts: CustomPart[] = [];
  const side = (id: string, sx: number) => {
    const f = on(frontFoot(sx), frontTop(sx), railY), b = on(backFoot(sx), backTop(sx), railY);
    const x = (f[0] + b[0]) / 2;
    return assemble(id, "Side frame", [
      beam(frontFoot(sx), frontTop(sx), L),
      beam(backFoot(sx), backTop(sx), L),
      bx([x - 10, railY - 40, b[2] + L / 2], [x + 10, railY + 40, f[2] - L / 2]),
    ], "wood");
  };
  parts.push(side("SL", -1), side("SR", 1));
  const xin = on(frontFoot(1), frontTop(1), railY)[0] - 10; // inner face of the side rails
  const zF = 128, zB = -148;
  parts.push({ id: "RF", name: "Seat rail", size: [2 * xin, 80, 22], pos: [0, railY, zF], material: "wood" });
  parts.push({ id: "RB", name: "Seat rail", size: [2 * xin, 80, 22], pos: [0, railY, zB], material: "wood" });
  parts.push({ id: "SEAT", name: "Seat", size: [2 * xin, 14, zF - zB - 10], pos: [0, railY + 25, (zF + zB) / 2], material: "board" });
  const trX = backTop(1)[0] - L / 2;
  parts.push({ id: "TR", name: "Top rail", size: [2 * trX, 50, 30], pos: [0, H - 40, -100], material: "wood" });
  const br0 = railY + 40, br1 = H - 65;
  parts.push({ id: "BR", name: "Backrest", size: [200, br1 - br0, 14], pos: [0, (br0 + br1) / 2, -125], rot: [0.08, 0, 0], material: "board" });
  const fr = on(frontFoot(1), frontTop(1), 290);
  parts.push({ id: "FR", name: "Footrest rung", size: [2 * fr[0], 26, 26], pos: [0, 290, fr[2]], shape: "cyl", material: "wood" });
  const bk = on(backFoot(1), backTop(1), 300);
  parts.push({ id: "BG", name: "Back rung", size: [2 * bk[0], 26, 26], pos: [0, 300, bk[2]], shape: "cyl", material: "wood" });
  const belt: Bit[] = [
    bx([-130, SEAT + 40, -60], [130, SEAT + 62, -52]),
    bx([-28, SEAT + 36, -64], [28, SEAT + 66, -48]),
    bx([-12, railY + 32, 30], [12, SEAT + 50, 38]),
  ];
  parts.push(assemble("BELT", "Safety belt", belt, "soft"));
  if (tray) {
    const ty = FT;
    parts.push(
      assemble("TRAY", "Tray", [
        bx([-240, ty, 150], [240, ty + 22, 270]),
        bx([-240, ty, -40], [-180, ty + 22, 150]),
        bx([180, ty, -40], [240, ty + 22, 150]),
        bx([-240, ty + 22, 250], [240, ty + 36, 270]),
      ], "board"),
    );
  }

  const BARREL = { name: "Barrel nut", len: 15, dia: 10 };
  const dowelEnds = (sx: number): Vec3[] => [zF, zB].flatMap((z) => [railY - 22, railY + 22].map((y) => [sx * xin, y, z] as Vec3));
  // each side: a short screw into the footrest rung, long ones into the two seat rails and the top rail
  const screwSide = (sx: number, long: boolean) => {
    const sid = sx < 0 ? "SL" : "SR";
    // each starts on the outside of the leg and runs through it into the rail
    const pts: Vec3[] = long ? [[sx * (xin + 22), railY, zF], [sx * (xin + 22), railY, zB], [sx * (trX + 40), H - 40, -100]] : [[sx * fr[0], 290, fr[2]]];
    const dir: Vec3 = [-sx, 0, 0];
    return [
      at("nut", pts.map((p) => [p[0] - sx * ((long ? 70 : 45) - 10), p[1], p[2]] as Vec3), [0, -1, 0], undefined, undefined, BARREL),
      at("bolt", pts, dir, sid, undefined, long ? { len: 70, dia: 6 } : { len: 45, dia: 6 }),
    ];
  };
  const steps: CustomStep[] = [
    {
      title: "Tap dowels into the seat rails and stand them on a side frame",
      detail: "Lay the side frame on a rug, inside up. Two dowels in each end of both rails, then push them into the frame's holes.",
      add: ["SL", "RF", "RB"],
      fix: [at("dowel", dowelEnds(-1), [1, 0, 0], "RF", "SL"), at("dowel", dowelEnds(1), [-1, 0, 0], "RF", "SR")],
      tools: ["hammer"],
      pose: "+x",
      warnings: ["floor"],
    },
    { title: "Slide the seat into the rails", detail: "Push it down the grooves of both rails, slots for the belt towards the front.", add: ["SEAT"] },
    {
      title: "Slide the backrest into the top rail and stand it in place",
      detail: "Its narrow end goes into the slot of the top rail. Stand the rail on the back leg's hole and tip the backrest's other end into the seat.",
      add: ["BR", "TR"],
    },
    { title: "Push the footrest rung into the front leg", detail: "Straight into its hole, until it stops.", add: ["FR"] },
    { title: "Push the back rung into the back leg", detail: "Turn it so its oval end fits the oval hole.", add: ["BG"] },
    { title: "Lay the other side frame on top", detail: "Line up every hole with its rail, rung and dowel, then press it down evenly.", add: ["SR"] },
    { title: "Screw in the short screw", detail: "Drop a barrel nut into the rung, slot facing the screw, then screw through the leg into it.", fix: screwSide(1, false).slice(0, 2), tools: ["allen", "flathead"] },
    { title: "Screw in the three long screws", detail: "A barrel nut in each rail first, turned with a flat screwdriver until it catches the screw.", fix: screwSide(1, true), tools: ["allen", "flathead"] },
    { title: "Turn it over and screw in the short screw", detail: "The same as on the first side: barrel nut, then the short screw into the rung.", fix: screwSide(-1, false), tools: ["allen", "flathead"], pose: "-x" },
    { title: "Screw in the three long screws", detail: "Tighten all eight screws firmly.", fix: screwSide(-1, true), tools: ["allen", "flathead"] },
    {
      title: "Thread the safety belt through the seat",
      detail: "Push each of the three straps through its slot, then loop it back through its buckle so it can't slip out.",
      add: ["BELT"],
      from: { BELT: [0, 250, 0] },
    },
    { title: "Stand it up and buckle the belt", detail: "Click the waist strap ends together round the middle strap and pull it snug.", pose: "+y" },
  ];
  if (tray) {
    const holders: Vec3[] = [-1, 1].map((sx) => [sx * (frontTop(1)[0] + L / 2), FT - 30, 120] as Vec3);
    steps.push(
      {
        title: "Screw the two tray holders onto the front legs",
        detail: "One on the outside of each front leg, at the top.",
        fix: [-1, 1].flatMap((sx, i) => [
          at("clip", [[holders[i][0] + sx * 30, holders[i][1], holders[i][2]]], [-sx, 0, 0], sx < 0 ? "SL" : "SR", undefined, { name: "Tray holder", len: 30, dia: 30 }),
          at("screw", [holders[i]], [-sx, 0, 0], sx < 0 ? "SL" : "SR", undefined, { len: 20, dia: 4 }),
        ]),
        tools: ["screwdriver"],
      },
      {
        title: "Click the tray onto the holders",
        detail: "Hook its back edge on first, then press the front down until both sides click. Pull the catch underneath to take it off.",
        add: ["TRAY"],
        from: { TRAY: [0, 260, 120] },
      },
    );
  }
  return { parts, steps };
}

const family: Family = { names: ["BLÅMES", "BLAMES"], recipe };
export default family;

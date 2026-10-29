import type { Family } from "./family";
import type { CustomParams, CustomPart, CustomStep, ProductSpec, Vec3 } from "../../types";

/**
 * EKERÖ armchair, read from its manual: three upholstered pieces (two armrests and the seat with its back) joined
 * on threaded rods. Two rods go into each armrest, the chair is built lying on its side with its underside towards
 * you (one armrest on the floor, the seat frame lowered onto its rods, a guide pin, the other armrest on top), then
 * two bolts and four nuts hold it, the front legs are screwed on by their plates and the back legs turned in by
 * hand. Stood up, the back cushion goes in last.
 */
function armchair(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 700, H = Math.round(s.size.h * 10) || 730, D = Math.round(s.size.d * 10) || 730;
  const leg = 170, armT = 105, armY = 600, seatY = 430;
  const hx = W / 2, ix = hx - armT; // the armrests' inner faces
  const zb = -D / 2 + 125; // the front of the back
  const arm = (id: string, sx: -1 | 1): CustomPart => ({
    id,
    name: "Armrest",
    size: [armT, armY - leg, D],
    pos: [sx * (hx - armT / 2), (leg + armY) / 2, 0],
    material: "soft",
  });
  // the seat frame is open underneath: two side boards, a front rail and the seat deck, with the back behind
  const fh = H - 90;
  const frame: CustomPart = {
    id: "F",
    name: "Seat and back",
    size: [2 * ix, fh - leg, D],
    pos: [0, (leg + fh) / 2, 0],
    material: "soft",
    pieces: [
      ...[-1, 1].map((sx) => ({ shape: "box" as const, size: [20, seatY - leg, D - 125] as Vec3, pos: [sx * (ix - 10), (seatY + leg) / 2 - (leg + fh) / 2, 62.5] as Vec3 })),
      { shape: "box", size: [2 * ix - 40, seatY - leg, 25], pos: [0, (seatY + leg) / 2 - (leg + fh) / 2, D / 2 - 12.5] },
      { shape: "box", size: [2 * ix - 40, 50, D - 150], pos: [0, seatY - 25 - (leg + fh) / 2, 50] },
      { shape: "box", size: [2 * ix, fh - leg, 125], pos: [0, 0, -D / 2 + 62.5] },
    ],
  };
  const lx = hx - armT / 2, lz = D / 2 - 45;
  const frontLeg = (id: string, sx: -1 | 1): CustomPart => ({
    id,
    name: "Front leg",
    size: [70, leg, 70],
    pos: [sx * lx, leg / 2, lz - 10],
    material: "metal",
    pieces: [
      { shape: "cyl", size: [28, leg - 6, 28], pos: [0, -3, 0] },
      { shape: "box", size: [70, 6, 70], pos: [0, leg / 2 - 3, 0] },
    ],
  });
  const backLeg = (id: string, sx: -1 | 1): CustomPart => ({ id, name: "Back leg", size: [28, leg, 28], pos: [sx * lx, leg / 2, -lz], shape: "cyl", material: "metal" });
  const cushion: CustomPart = { id: "K", name: "Back cushion", size: [2 * ix - 20, H - seatY - 10, 150], pos: [0, (H + seatY + 10) / 2, zb + 75], material: "soft" };
  const parts = [arm("AL", -1), arm("AR", 1), frame, frontLeg("L1", -1), frontLeg("L2", 1), backLeg("L3", -1), backLeg("L4", 1), cushion];

  const rodZ = [-60, D / 2 - 140], rodY = 230;
  const rods = (sx: -1 | 1) => ({ kind: "stud" as const, count: 2, at: rodZ.map((z) => [sx * ix, rodY, z] as Vec3), dir: [-sx, 0, 0] as Vec3, on: sx < 0 ? "AL" : "AR", mate: "F", len: 90, dia: 8, name: "Threaded rod" });
  const nutDirs = (kind: "washer" | "nut") =>
    ([-1, 1] as const).map((sx) => ({ kind, count: 2, at: rodZ.map((z) => [sx * (ix - 20), rodY, z] as Vec3), dir: [sx, 0, 0] as Vec3, on: "F", ...(kind === "nut" ? { len: 6, dia: 10 } : { len: 1.5, dia: 16 }) }));
  const boltAt = ([-1, 1] as const).map((sx) => [sx * (ix - 20), 330, D / 2 - 80] as Vec3);
  const plate = (sx: -1 | 1) => [-20, 20].map((dz) => [sx * lx + dz, leg - 6, lz - 10 + dz] as Vec3);
  const steps: CustomStep[] = [
    {
      title: "Turn two threaded rods into each armrest",
      detail: "Lay the armrests on a soft surface, inside face up. Screw the rods in by hand until they stop.",
      add: ["AL"],
      wait: ["AR"],
      fix: [rods(-1), rods(1)],
      pose: "+x",
      warnings: ["floor"],
    },
    { title: "Lower the seat onto the rods", detail: "One armrest lies on the floor. Lower the seat and back onto its rods, the open underside towards you.", add: ["F"], from: { F: [420, 0, 0] } },
    { title: "Push the guide pin into the seat", detail: "Into the hole at the front, so the second armrest lines up.", fix: [{ kind: "stud", count: 1, at: [[ix, seatY - 60, D / 2 - 40]], dir: [-1, 0, 0], on: "F", mate: "AR", len: 40, dia: 8, name: "Guide pin" }] },
    { title: "Lower the other armrest on", detail: "Onto the rods and the pin, until it lies flat against the seat.", add: ["AR"], from: { AR: [420, 0, 0] } },
    {
      title: "Bolt the front of the seat to the armrests",
      detail: "One bolt with a washer on each side, from inside the frame. Tighten them with the spanner.",
      fix: [
        ...([-1, 1] as const).map((sx, i) => ({ kind: "washer" as const, count: 1, at: [boltAt[i]], dir: [sx, 0, 0] as Vec3, on: "F", len: 1.5, dia: 16 })),
        ...([-1, 1] as const).map((sx, i) => ({ kind: "bolt" as const, count: 1, at: [boltAt[i]], dir: [sx, 0, 0] as Vec3, on: "F", mate: sx < 0 ? "AL" : "AR", len: 50, dia: 8, name: "Hex bolt" })),
      ],
      tools: ["wrench"],
    },
    { title: "Put a washer and a nut on each rod", detail: "Four, inside the frame. Tighten them with the spanner.", fix: [...nutDirs("washer"), ...nutDirs("nut")], tools: ["wrench"] },
    {
      title: "Screw the front legs on",
      detail: "Each leg's plate goes under the front of an armrest, with two bolts through it.",
      add: ["L1", "L2"],
      fix: ([-1, 1] as const).map((sx) => ({ kind: "bolt" as const, count: 2, at: plate(sx), dir: [0, 1, 0] as Vec3, on: sx < 0 ? "L1" : "L2", mate: sx < 0 ? "AL" : "AR", len: 30, dia: 6 })),
      from: { L1: [0, -250, 0], L2: [0, -250, 0] },
      tools: ["allen"],
    },
    { title: "Turn the back legs in", detail: "Screw them into the back corners by hand until they sit tight.", add: ["L3", "L4"], from: { L3: [0, -250, 0], L4: [0, -250, 0] } },
    { title: "Stand it up and put the back cushion in", detail: "Lift the chair onto its legs, then press the cushion down behind the seat.", add: ["K"], pose: "+y", from: { K: [0, 300, 0] } },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["EKERÖ", "EKERO"],
  recipe(s) {
    if (/^ekero-armchair/.test(s.slug ?? "")) return armchair(s);
    return null;
  },
};
export default family;

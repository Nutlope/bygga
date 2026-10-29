import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * ESSEBODA, read from its manuals. The loveseat and the 3-seat sofa share one manual: a hook plate is screwed to the
 * inside of each armrest, then the sofa is built lying on its back on the floor. The armrests are hooked onto the ends
 * of the backrest by two people, four studs go into the front of the backrest, the seat is lowered onto them and held
 * with four wing nuts, and four bolts with washers go through the seat's side rails into the armrests. The four turned
 * legs screw into the corners of the seat, felt pads go under them, and the sofa is tipped up to take its two seat
 * cushions. The footstool is a padded block laid upside down for its four legs and pads.
 */

type Kind = CustomFix["kind"];
const fx = (kind: Kind, at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const G = [-1, 1] as const;
const r = (n: number) => Math.round(n);

const LEG_H = 120, LEG_D = 55;
const STUD = { len: 90, dia: 8 };
const WING = { len: 14, dia: 30, name: "Wing nut" };
const BOLT = { len: 60, dia: 8 };
const WASHER = { len: 2, dia: 20 };
const HOOK = { len: 60, dia: 30, name: "Hook plate" };
const HOOK_SCREW = { len: 16, dia: 6 };
const PAD = { len: 4, dia: 28, name: "Felt pad" };

const legPieces: PartPiece[] = [
  { shape: "cyl", size: [LEG_D, 40, LEG_D], pos: [0, 40, 0] },
  { shape: "cyl", size: [LEG_D - 18, 80, LEG_D - 18], pos: [0, -20, 0] },
];
const leg = (id: string, x: number, z: number): CustomPart => ({ id, name: "Leg", size: [LEG_D, LEG_H, LEG_D], pos: [r(x), LEG_H / 2, r(z)], material: "wood", pieces: legPieces });

function sofa(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const AW = 210, armH = 600, seatH = 440;
  const z0 = -D / 2, zF = D / 2;
  const xi = W / 2 - AW; // inner face of an armrest
  const zB = z0 + 180; // front of the backrest frame, where the seat meets it
  const yS = LEG_H + 180; // top of the seat frame
  const cushD = 640, cushH = seatH - yS;

  const arm = (id: "L" | "R", sx: number): CustomPart => ({
    id,
    name: "Armrest",
    size: [AW, armH - LEG_H, D],
    pos: [sx * (W / 2 - AW / 2), (armH + LEG_H) / 2, 0],
    material: "soft",
    pieces: [
      { shape: "box", size: [AW, armH - LEG_H - 70, D], pos: [0, -35, 0] },
      { shape: "cyl", size: [AW - 20, D, AW - 20], pos: [sx * 10, (armH - LEG_H) / 2 - (AW - 20) / 2, 0], rot: [Math.PI / 2, 0, 0] },
    ],
  });
  // the backrest: its frame behind the seat, padding standing up in front of it, the buttoned top rolled over
  const backH = H - LEG_H;
  const back: CustomPart = {
    id: "B",
    name: "Backrest",
    size: [2 * xi, backH, zB + 140 - z0],
    pos: [0, (H + LEG_H) / 2, r((z0 + zB + 140) / 2)],
    material: "soft",
    pieces: [
      { shape: "box", size: [2 * xi, backH - 60, 180], pos: [0, -30, -70] },
      { shape: "box", size: [2 * xi - 20, H - 60 - yS, 140], pos: [0, (yS + H - 60) / 2 - (H + LEG_H) / 2, 90] },
      { shape: "cyl", size: [150, 2 * xi, 150], pos: [0, backH / 2 - 75, -55], rot: [0, 0, Math.PI / 2] },
    ],
  };
  const seat: CustomPart = { id: "S", name: "Seat", size: [2 * xi, yS - LEG_H, zF - zB], pos: [0, (yS + LEG_H) / 2, r((zB + zF) / 2)], material: "soft" };
  const cw = (2 * xi) / 2;
  const cushions: CustomPart[] = G.map((sx, i) => ({
    id: `C${i + 1}`,
    name: "Seat cushion",
    size: [r(cw), cushH, cushD],
    pos: [r((sx * cw) / 2), yS + cushH / 2, zF - cushD / 2],
    material: "soft",
  }));
  const lx = xi - 45;
  const legs = [leg("G1", -lx, zB + 50), leg("G2", lx, zB + 50), leg("G3", -lx, zF - 50), leg("G4", lx, zF - 50)];

  const yJ = LEG_H + 90; // the joints all sit in the seat frame's height
  const studX = [-0.7, -0.25, 0.25, 0.7].map((t) => r(t * xi));
  const studs: Vec3[] = studX.map((x) => [x, yJ, zB]);
  const nuts: Vec3[] = studX.map((x) => [x, yJ, zB + 60]);
  const boltZ = [zB + 120, zF - 120];
  const bolts = (sx: number): Vec3[] => boltZ.map((z) => [sx * xi, yJ, r(z)]);
  const hooks = (sx: number): Vec3[] => [[sx * xi, 420, r(z0 + 90)]];

  const parts: CustomPart[] = [arm("L", -1), arm("R", 1), back, seat, ...legs, ...cushions];
  const steps: CustomStep[] = [
    {
      title: "Screw a hook plate onto each armrest",
      detail: "Lay the armrests on a rug, inside face up. One screw holds each plate, tightened with the Allen key.",
      add: ["L", "R"],
      fix: G.map((sx) => fx("hook", hooks(sx), [-sx, 0, 0], { ...HOOK, on: sx < 0 ? "L" : "R", mate: "B" })).concat(
        // the screw goes through the plate into the armrest
        G.map((sx) => fx("screw", hooks(sx), [sx, 0, 0], { ...HOOK_SCREW, on: sx < 0 ? "L" : "R" })),
      ),
      tools: ["allen"],
      warnings: ["floor"],
    },
    {
      title: "Hook the armrests onto the backrest",
      detail: "Lay the backrest on its back on the rug. One of you at each end slides an armrest on until its plate drops into the slot.",
      add: ["B"],
      people: 2,
      pose: "+z",
      warnings: ["two", "floor"],
    },
    {
      title: "Screw four studs into the backrest",
      detail: "Into the holes along the face the seat goes against, by hand until they stop.",
      fix: [fx("stud", studs, [0, 0, -1], { ...STUD, on: "B", mate: "S" })],
    },
    {
      title: "Lower the seat onto the studs",
      detail: "Its frame goes down between the armrests, the studs through the holes in its back rail.",
      add: ["S"],
      from: { S: [0, 0, 400] },
    },
    {
      title: "Turn a wing nut onto each stud",
      detail: "From inside the seat frame. Tighten them by hand until the seat sits hard against the backrest.",
      fix: [fx("nut", nuts, [0, 0, -1], { ...WING, on: "S", mate: "B" })],
    },
    {
      title: "Bolt the seat to the armrests",
      detail: "Two bolts with washers through each side rail of the seat into the armrest. Tighten them with the Allen key.",
      fix: G.flatMap((sx) => [
        fx("bolt", bolts(sx), [sx, 0, 0], { ...BOLT, on: "S", mate: sx < 0 ? "L" : "R" }),
        fx("washer", bolts(sx), [sx, 0, 0], { ...WASHER, on: "S" }),
      ]),
      tools: ["allen"],
    },
    {
      title: "Screw on the legs",
      detail: "Into the four corners of the seat frame, by hand until each one is tight.",
      add: legs.map((l) => l.id),
    },
    {
      title: "Stick a felt pad under each leg",
      detail: "Press them onto the ends of the legs.",
      fix: [fx("glide", legs.map((l) => [l.pos[0], 0, l.pos[2]] as Vec3), [0, 1, 0], { ...PAD })],
    },
    {
      title: "Stand the sofa up",
      detail: "Tip it forwards onto its legs together, lifting by the frame.",
      people: 2,
      pose: "+y",
      warnings: ["two"],
    },
    {
      title: "Put in the seat cushions",
      detail: "Back edge first, tucked in against the backrest, then press the front down.",
      add: cushions.map((c) => c.id),
    },
  ];
  return { parts, steps };
}

function footstool(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const lx = W / 2 - 70, lz = D / 2 - 70;
  const legs = [leg("G1", -lx, -lz), leg("G2", lx, -lz), leg("G3", -lx, lz), leg("G4", lx, lz)];
  const parts: CustomPart[] = [{ id: "A", name: "Footstool", size: [W, H - LEG_H, D], pos: [0, (H + LEG_H) / 2, 0], material: "soft" }, ...legs];
  const steps: CustomStep[] = [
    { title: "Lay the footstool upside down", detail: "On a rug or the flattened box, so the fabric stays clean.", add: ["A"], pose: "-y", warnings: ["floor"] },
    { title: "Screw on the legs", detail: "One in each corner, by hand until it is tight.", add: legs.map((l) => l.id) },
    { title: "Stick a felt pad under each leg", detail: "Press them onto the ends of the legs.", fix: [fx("glide", legs.map((l) => [l.pos[0], 0, l.pos[2]] as Vec3), [0, 1, 0], { ...PAD })] },
    { title: "Turn it over", detail: "Stand it on its legs and check it sits steady.", pose: "+y" },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["ESSEBODA"],
  recipe(s) {
    const v = `${s.variant} ${s.slug ?? ""}`.toLowerCase();
    if (/ottoman|footstool|pouffe/.test(v)) return footstool(s);
    if (/loveseat|2-seat|3-seat|sofa/.test(v) && s.size.w > 150) return sofa(s);
    return null;
  },
};
export default family;

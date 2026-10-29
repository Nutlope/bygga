import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * ROCKSJÖN, read from IKEA's manuals.
 *
 * Armchair: the frame comes in one piece. Upside down on a rug, four legs are screwed on with three Allen screws
 * each and get felt pads; stood up, the loose cover goes over the backrest, then down over the armrests and the
 * front, and the seat cushion is zipped into its cover and laid in.
 * Footstool: its frame takes the same legs. The cushion is zipped into the cover upside down, the frame is set into
 * the cover's skirt and held with four hook-and-loop straps, and it is turned over.
 * 2-seat sofa: the backrest, two armrests and the seat frame come separate. Two threaded rods in each armrest go
 * through the backrest's end posts with a washer and a wing nut; two more rods join the armrests to the seat frame,
 * four rods in the seat frame go up through the backrest. Then legs, felt pads, cover and the seat cushion.
 */

const box = (size: Vec3, pos: Vec3, material?: PartPiece["material"]): PartPiece => ({ shape: "box", size, pos, ...(material ? { material } : {}) });
const pts = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const corners = (x: number, z: number): Vec3[] => [-1, 1].flatMap((gx) => [-1, 1].map((gz): Vec3 => [gx * x, 0, gz * z]));

const LEG = 200, LS = 45, T = 10; // leg height and section, cover thickness
const SCREW = { len: 30, dia: 6 };

/** Four legs with their plates, three Allen screws each, and the felt pads under them. */
function legs(p: string, ox: number, oz: number, x: number, z: number) {
  const at = corners(x, z).map(([a, , c]): Vec3 => [ox + a, 0, oz + c]);
  const ids = at.map((_, i) => `${p}L${i}`);
  const parts: CustomPart[] = at.map((q, i) => ({ id: ids[i], name: "Leg", size: [LS, LEG, LS], pos: [q[0], LEG / 2, q[2]], material: "wood", pieces: [box([LS, LEG - 6, LS], [0, -3, 0]), box([70, 6, 70], [0, LEG / 2 - 3, 0], "metal")] }));
  const screws = at.flatMap(([a, , c]): Vec3[] => [[a + 22, LEG, c], [a - 14, LEG, c + 18], [a - 14, LEG, c - 18]]);
  const fixScrews = pts("screw", screws, [0, 1, 0], SCREW);
  const pads = pts("glide", at, [0, 1, 0], { name: "Felt pad", len: 3, dia: 30 });
  return { ids, parts, fixScrews, pads };
}

/** The loose cover: a thin shell over the outside of the frame, its skirt stopping at the top of the legs. */
function cover(id: string, W: number, D: number, H: number, AW: number, AH: number, BD: number, SY: number, ox = 0, oz = 0): CustomPart {
  const yc = (LEG + H) / 2;
  const at = (x: number, y: number, z: number): Vec3 => [x, y - yc, z];
  const pieces: PartPiece[] = [
    box([W, SY - LEG, T], at(0, (LEG + SY) / 2, D / 2 - T / 2)), // front skirt
    ...[-1, 1].flatMap((g) => [
      box([T, AH - LEG, D], at(g * (W / 2 - T / 2), (LEG + AH) / 2, 0)), // outside of the arm
      box([AW, T, D], at(g * (W / 2 - AW / 2), AH - T / 2, 0)), // arm top
      box([AW, AH - SY, T], at(g * (W / 2 - AW / 2), (SY + AH) / 2, D / 2 - T / 2)), // arm front
    ]),
    box([W, H - LEG, T], at(0, (LEG + H) / 2, -D / 2 + T / 2)), // outside back
    box([W - 2 * AW, T, BD], at(0, H - T / 2, -D / 2 + BD / 2)), // top of the back
    box([W - 2 * AW, H - SY, T], at(0, (SY + H) / 2, -D / 2 + BD - T / 2)), // inside of the back
  ];
  return { id, name: "Cover", size: [W, H - LEG, D], pos: [ox, yc, oz], material: "soft", pieces };
}

/* ---------- armchair ---------- */

const AW = 150, BD = 190, SY = 365; // arm width, back depth, top of the frame's seat deck

function armchair(p = "", ox = 0, oz = 0): { parts: CustomPart[]; steps: CustomStep[] } {
  const W = 760, D = 780, H = 800;
  const fw = W - 2 * T, fd = D - 2 * T;
  const yc = (LEG + H - T) / 2;
  const at = (x: number, y: number, z: number): Vec3 => [x, y - yc, z];
  const frame: CustomPart = {
    id: `${p}F`,
    name: "Armchair frame",
    size: [fw, H - T - LEG, fd],
    pos: [ox, yc, oz],
    material: "board",
    pieces: [
      box([fw, SY - LEG, fd], at(0, (LEG + SY) / 2, 0)),
      ...[-1, 1].map((g) => box([AW - T, 640 - T - SY, fd], at(g * (fw / 2 - (AW - T) / 2), (SY + 640 - T) / 2, 0))),
      box([fw - 2 * (AW - T), H - T - SY, BD - T], at(0, (SY + H - T) / 2, -fd / 2 + (BD - T) / 2)),
    ],
  };
  const lg = legs(p, ox, oz, W / 2 - 60, D / 2 - 60);
  const cushion: CustomPart = { id: `${p}S`, name: "Seat cushion", size: [W - 2 * AW, 115, D - BD + 15], pos: [ox, SY + 57, oz + (BD + 15) / 2], material: "soft" };
  const parts = [frame, ...lg.parts, cover(`${p}C`, W, D, H, AW, 640, BD, SY, ox, oz), cushion];
  const steps: CustomStep[] = [
    { title: "Lay the frame upside down", detail: "On a rug or the empty box, so the fabric doesn't get marked.", add: [frame.id], pose: "-y", warnings: ["floor"] },
    { title: "Screw on the legs", detail: "Three Allen screws through each leg's plate into the corners of the frame. Tighten them evenly.", add: lg.ids, fix: [lg.fixScrews], tools: ["allen"] },
    { title: "Stick a felt pad under each leg", detail: "Peel them off the sheet and press them on firmly.", fix: [lg.pads] },
    {
      title: "Pull the cover over the backrest",
      detail: "Stand the chair on its legs. Iron the cover first if it's creased, then put it over the top of the backrest.",
      add: [`${p}C`],
      pose: "+y",
      from: { [`${p}C`]: [0, 320, 0] },
    },
    { title: "Pull it down over the armrests and the front", detail: "Work it down evenly on both sides, then push the spare fabric well down into the gaps around the seat." },
    { title: "Zip the cover onto the seat cushion", detail: "Fold the cushion to ease it in, smooth out the corners, then close the zip." },
    { title: "Lay the seat cushion in", detail: "Zip to the back.", add: [cushion.id], from: { [cushion.id]: [0, 260, 0] } },
  ];
  return { parts, steps };
}

/* ---------- footstool ---------- */

function footstool(p = "", ox = 0, oz = 0): { parts: CustomPart[]; steps: CustomStep[] } {
  const W = 600, D = 500, H = 450, FH = 90, FT = 22;
  const fw = W - 2 * T, fd = D - 2 * T, fy = LEG + FH / 2;
  const frame: CustomPart = {
    id: `${p}F`,
    name: "Footstool frame",
    size: [fw, FH, fd],
    pos: [ox, fy, oz],
    material: "wood",
    pieces: [box([fw, FH, FT], [0, 0, -fd / 2 + FT / 2]), box([fw, FH, FT], [0, 0, fd / 2 - FT / 2]), box([FT, FH, fd - 2 * FT], [-fw / 2 + FT / 2, 0, 0]), box([FT, FH, fd - 2 * FT], [fw / 2 - FT / 2, 0, 0]), box([fw - 2 * FT, 6, fd - 2 * FT], [0, FH / 2 - 3, 0], "fiber"),
      // a block in each corner takes the leg's screws
      ...[-1, 1].flatMap((g) => [-1, 1].map((gz) => box([60, FH, 60], [g * (W / 2 - 50), 0, gz * (D / 2 - 50)]))),
    ],
  };
  const lg = legs(p, ox, oz, W / 2 - 50, D / 2 - 50);
  const top = LEG + FH, cy = (LEG + H) / 2;
  const cushion: CustomPart = {
    id: `${p}C`,
    name: "Cushion in its cover",
    size: [W, H - LEG, D],
    pos: [ox, cy, oz],
    material: "soft",
    pieces: [
      box([W, H - top, D], [0, (top + H) / 2 - cy, 0]),
      box([W, FH, T], [0, fy - cy, D / 2 - T / 2]),
      box([W, FH, T], [0, fy - cy, -D / 2 + T / 2]),
      box([T, FH, D - 2 * T], [W / 2 - T / 2, fy - cy, 0]),
      box([T, FH, D - 2 * T], [-W / 2 + T / 2, fy - cy, 0]),
    ],
  };
  const straps: Vec3[] = [-1, 1].flatMap((g) => [-1, 1].map((gz): Vec3 => [ox + g * (fw / 2 - FT / 2), LEG, oz + gz * (fd / 4)]));
  const steps: CustomStep[] = [
    { title: "Lay the footstool frame upside down", detail: "On a rug, open side up.", add: [frame.id], pose: "-y", warnings: ["floor"] },
    { title: "Screw on the legs", detail: "Three Allen screws through each leg's plate into a corner of the frame.", add: lg.ids, fix: [lg.fixScrews], tools: ["allen"] },
    { title: "Stick a felt pad under each leg", detail: "Press them on firmly.", fix: [lg.pads] },
    { title: "Zip the cushion into its cover", detail: "Lay the cover inside out on the floor, set the cushion in upside down, pull the cover round it and close the zip.", add: [cushion.id], from: { [cushion.id]: [0, -300, 0] } },
    {
      title: "Set the frame into the cover and strap it",
      detail: "Lower the frame, legs up, into the cover's skirt, then fasten the four hook-and-loop straps under the frame.",
      fix: [pts("clip", straps, [0, 1, 0], { name: "Hook-and-loop strap", len: 40, dia: 25, on: cushion.id })],
    },
    { title: "Turn the footstool over", detail: "Stand it on its legs and smooth the skirt down.", pose: "+y" },
  ];
  return { parts: [frame, ...lg.parts, cushion], steps };
}

/* ---------- 2-seat sofa ---------- */

function sofa(): CustomParams {
  const W = 1420, D = 770, H = 800, AH = 640;
  const fw = W - 2 * T, fd = D - 2 * T;
  const xi = fw / 2 - (AW - T); // inside face of each armrest
  const armY = (LEG + AH - T) / 2;
  const parts: CustomPart[] = [
    ...[-1, 1].map((g, i): CustomPart => ({ id: `A${i}`, name: "Armrest", size: [AW - T, AH - T - LEG, fd], pos: [g * (fw / 2 - (AW - T) / 2), armY, 0], material: "board" })),
    { id: "B", name: "Backrest", size: [2 * xi, H - T - SY, BD - T], pos: [0, (SY + H - T) / 2, -fd / 2 + (BD - T) / 2], material: "board" },
    { id: "SF", name: "Seat frame", size: [2 * xi, SY - LEG, fd], pos: [0, (LEG + SY) / 2, 0], material: "board" },
  ];
  const lg = legs("", 0, 0, W / 2 - 60, D / 2 - 60);
  parts.push(...lg.parts, cover("C", W, D, H, AW, AH, BD, SY), { id: "S", name: "Seat cushion", size: [W - 2 * AW, 115, D - BD + 15], pos: [0, SY + 57, (BD + 15) / 2], material: "soft" });
  const bz = -fd / 2 + (BD - T) / 2;
  const armRods = [-1, 1].flatMap((g) => [480, 700].map((y): Vec3 => [g * xi, y, bz]));
  const armNuts = (d: number) => [-1, 1].flatMap((g) => [480, 700].map((y): Vec3 => [g * (xi - d), y, bz]));
  const lowRods = [-1, 1].map((g): Vec3 => [g * xi, (LEG + SY) / 2, 120]);
  const lowNuts = (d: number) => [-1, 1].map((g): Vec3 => [g * (xi - d), (LEG + SY) / 2, 120]);
  const seatX = [-0.75, -0.25, 0.25, 0.75].map((t) => t * xi);
  const ROD = { name: "Threaded rod", len: 90, dia: 8 }, WASH = { dia: 20 }, WING = { name: "Wing nut", len: 14, dia: 30 };
  const side = (f: (g: number) => CustomFix): CustomFix[] => [-1, 1].map(f);
  const split = (list: Vec3[], kind: CustomFix["kind"], dirOf: (p: Vec3) => Vec3, o: Partial<CustomFix>): CustomFix[] =>
    side((g) => pts(kind, list.filter((q) => Math.sign(q[0]) === g), dirOf([g, 0, 0]), o));
  const steps: CustomStep[] = [
    {
      title: "Screw two threaded rods into each armrest",
      detail: "Into the holes in the inside face, near the back, by hand until they stop.",
      add: ["A0", "A1"],
      fix: split(armRods, "stud", (g) => g, ROD),
      pose: "+z",
      warnings: ["floor"],
    },
    { title: "Push the armrests onto the backrest", detail: "Lay the backrest on its back on a rug and slide the rods through the holes in its end posts.", add: ["B"], from: { B: [0, 0, -300] } },
    {
      title: "Fasten the armrests with wing nuts",
      detail: "From inside the backrest: a washer and a wing nut on each rod, tightened by hand. Then turn it over.",
      fix: [...split(armNuts(40), "washer", (g) => g, WASH), ...split(armNuts(44), "nut", (g) => g, WING)],
      warnings: ["hand"],
    },
    { title: "Screw a rod into the foot of each armrest", detail: "One in each inside face, low down at the front.", fix: split(lowRods, "stud", (g) => g, ROD), pose: "+y" },
    {
      title: "Screw four rods into the seat frame",
      detail: "Into the holes along the top of its back edge, by hand.",
      add: ["SF"],
      fix: [pts("stud", seatX.map((x): Vec3 => [x, SY, bz]), [0, -1, 0], { ...ROD, on: "SF" })],
      from: { SF: [0, -300, 0] },
    },
    { title: "Lower the backrest and armrests onto the seat", detail: "Do it together. The four seat rods go up through the backrest and the armrest rods into the sides of the seat frame.", people: 2, warnings: ["two"] },
    {
      title: "Fasten the seat rods inside the backrest",
      detail: "A washer and a wing nut on each of the four, hand tight. Then turn the sofa upside down.",
      fix: [pts("washer", seatX.map((x): Vec3 => [x, SY + 40, bz]), [0, -1, 0], WASH), pts("nut", seatX.map((x): Vec3 => [x, SY + 44, bz]), [0, -1, 0], WING)],
      warnings: ["hand"],
    },
    {
      title: "Fasten the armrest rods under the seat",
      detail: "A washer and a wing nut on each, from inside the seat frame.",
      fix: [...split(lowNuts(40), "washer", (g) => g, WASH), ...split(lowNuts(44), "nut", (g) => g, WING)],
      pose: "-y",
      warnings: ["hand"],
    },
    { title: "Screw on the legs", detail: "Three Allen screws through each leg's plate, under the armrests.", add: lg.ids, fix: [lg.fixScrews], tools: ["allen"] },
    { title: "Stick a felt pad under each leg", detail: "Press them on firmly, then stand the sofa on its legs.", fix: [lg.pads] },
    { title: "Pull the cover over the backrest", detail: "Iron it first if it's creased. Start at the top of the backrest and work it over both ends.", add: ["C"], pose: "+y", from: { C: [0, 320, 0] } },
    { title: "Pull it down over the armrests and the front", detail: "Work it down evenly, then push the spare fabric well down into the gaps around the seat." },
    { title: "Zip the cover onto the seat cushion", detail: "Fold the cushion to ease it in, smooth out the corners, then close the zip." },
    { title: "Lay the seat cushion in", detail: "Zip to the back.", add: ["S"], from: { S: [0, 260, 0] } },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["ROCKSJÖN", "ROCKSJON"],
  recipe(s: ProductSpec) {
    const slug = s.slug ?? "";
    if (slug === "rocksjon-armchair") return armchair();
    if (slug === "rocksjon-armchair-footstool") {
      const a = armchair("a");
      const f = footstool("f", -230, 780);
      return { parts: [...a.parts, ...f.parts], steps: [...a.steps, ...f.steps.map((st, i) => (i === 0 ? { ...st, title: "Now the footstool: lay its frame upside down" } : st))] };
    }
    if (slug === "rocksjon-2-seat-sofa") return sofa();
    return null;
  },
};
export default family;

import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomParams, CustomStep, PartMaterial, PartPiece, ProductSpec, Vec3 } from "../../types";
import { boxOf } from "../custom";

/**
 * FRIHETEN corner sofa-bed with storage, read from the chaise longue's manual (KLAGSHAMN adds its mattress pad's
 * manual). The chaise longue is a storage box with a lifting lid and its own slim armrest; the lid's cover goes on
 * first. The two backrest pieces are joined on pins and the chaise is bolted to them from inside the box with
 * threaded rods in sleeve nuts. Two Z brackets go on the chaise's inner side, then the lot is tipped onto its back:
 * two people lower the seat frame in until its tabs click into the backrest, the armrest goes on two pins, the seat
 * is bolted to the backrest, the armrest and the brackets, and the seven legs and two catches go on. The pull-out bed
 * base gets castors and pin plates, and slides in under the seat once the sofa stands up again. The manual shows
 * the chaise on either side; the model follows the product's photo.
 * The 3-seat sofa-bed (its own 29-step manual) is a backrest frame built from two ends, rails and uprights, bolted
 * onto the seat box with the pull-out bed in it, lying on its back; six legs, then the armrests drop onto four
 * connectors on the frame's ends.
 */

type Kind = CustomFix["kind"];
interface Pc {
  size: Vec3;
  pos: Vec3;
  shape?: "box" | "cyl";
  material?: PartMaterial;
}

const ROD = { len: 100, dia: 8, name: "Threaded rod" };
const SLEEVE = { len: 20, dia: 14, name: "Sleeve nut" };
const PIN = { len: 70, dia: 10, name: "Pin with a collar" };
const SHORT_BOLT = { len: 30, dia: 6 };
const LONG_BOLT = { len: 45, dia: 6 };
const ZB = { len: 80, dia: 60, name: "Z bracket" };

/** The chaise sits at +x when sgn is 1 and at -x when it is -1; everything is written for the chaise on the right. */
function corner(s: ProductSpec, sgn: 1 | -1, pad: boolean): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10;
  const SD = (s.sofa?.depth ?? 92) * 10; // the seat section's depth, backrest included
  const ST = (s.sofa?.seatH ?? 44) * 10;
  const BH = 660, AH = 560, LEG = 90, BT = 150;
  const AW = 150, CAW = 110, CW = 880;
  const xa = -W / 2 + AW; // armrest's inner face
  const xc = W / 2 - CW; // chaise's inner face
  const xr = W / 2 - CAW; // chaise armrest's inner face
  const zb = -D / 2, zf = zb + BT, zs = zb + SD, ze = D / 2;
  const LID = 140, CAS = 45;

  const X = (x: number) => sgn * x;
  const V = (v: Vec3): Vec3 => [X(v[0]), v[1], v[2]];
  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material?: PartMaterial): Pc => ({
    size: [Math.abs(x1 - x0), y1 - y0, z1 - z0],
    pos: [X((x0 + x1) / 2), (y0 + y1) / 2, (z0 + z1) / 2],
    material,
  });
  const part = (id: string, name: string, pc: Pc, material: PartMaterial = "soft"): CustomPart => ({ id, name, size: pc.size, pos: pc.pos, shape: pc.shape, material: pc.material ?? material });
  const group = (id: string, name: string, pcs: Pc[], material: PartMaterial = "soft"): CustomPart => {
    const bs = pcs.map((p) => boxOf(p));
    const lo = [0, 1, 2].map((k) => Math.min(...bs.map((b) => b.min[k])));
    const hi = [0, 1, 2].map((k) => Math.max(...bs.map((b) => b.max[k])));
    const pos = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2) as Vec3;
    const size = [0, 1, 2].map((k) => hi[k] - lo[k]) as Vec3;
    const pieces: PartPiece[] = pcs.map((p) => ({ shape: p.shape ?? "box", size: p.size, pos: [p.pos[0] - pos[0], p.pos[1] - pos[1], p.pos[2] - pos[2]], material: p.material ?? material }));
    return { id, name, size, pos, pieces, material };
  };
  const at = (kind: Kind, pts: Vec3[], dir: Vec3, on: string, mate?: string, o: { len?: number; dia?: number; name?: string } = {}): CustomFix => ({
    kind,
    count: pts.length,
    at: pts.map(V),
    dir: V(dir),
    on,
    mate,
    ...o,
  });

  const parts: CustomPart[] = [
    group("C", "Chaise longue", [box(xc, xr, LEG, ST - LID, zf, ze), box(xr, W / 2, LEG, AH, zb, ze)]),
    part("L", "Chaise lid", box(xc, xr, ST - LID, ST, zf, ze)),
    part("BS", "Chaise backrest", box(xc, xr, LEG, BH, zb, zf)),
    part("BL", "Backrest", box(xa, xc, LEG, BH, zb, zf)),
    part("S", "Seat frame", box(xa, xc, 250, ST, zf, zs)),
    part("A", "Armrest", box(-W / 2, xa, LEG, AH, zb, zs)),
    part("BB", "Bed base", box(xa + 5, xc - 5, CAS, 245, zf + 45, zs - 5)),
  ];
  const leg = (id: string, x: number, z: number) => parts.push(part(id, "Leg", { shape: "cyl", size: [50, LEG, 50], pos: [X(x), LEG / 2, z] }, "wood"));
  const chaiseLegs: [number, number][] = [
    [W / 2 - 55, ze - 60],
    [xc + 50, ze - 60],
    [xc + 50, (zf + ze) / 2],
    [W / 2 - 55, zb + 60],
    [xc + 50, zf + 50],
  ];
  chaiseLegs.forEach(([x, z], i) => leg(`LC${i}`, x, z));
  leg("LA0", -W / 2 + AW / 2, zs - 60);
  leg("LA1", -W / 2 + AW / 2, zb + 60);

  const cushions: string[] = [];
  const cushion = (id: string, name: string, x0: number, x1: number, y1: number, t: number) => {
    parts.push(part(id, name, box(x0, x1, ST, y1, zf, zf + t)));
    cushions.push(id);
  };
  if (pad) {
    cushion("P", "Mattress pad in its cover", xc + 5, xr - 5, 720, 160);
    const cw = (xc - xa) / 3;
    for (let i = 0; i < 3; i++) cushion(`K${i}`, "Back cushion", xa + i * cw + 5, xa + (i + 1) * cw - 5, 860, 200);
  } else {
    const cw = (xr - xa) / 3;
    for (let i = 0; i < 3; i++) cushion(`K${i}`, "Back cushion", xa + i * cw + 5, xa + (i + 1) * cw - 5, 860, 200);
  }

  // fittings, chaise on the right
  const zm = (zf + ze) / 2;
  const pinsBack = at("dowel", [[xc, 300, zb + BT / 2], [xc, 520, zb + BT / 2]], [1, 0, 0], "BS", "BL", PIN);
  const rodsChaise: Vec3[] = [xc + 130, xc + 300, xc + 470, xc + 640].map((x) => [x, 200, zf]);
  const zBr = [zf + 220, zs - 180];
  const rodsSeatBack: Vec3[] = [[xa + 300, 330, zf], [xc - 300, 330, zf]];
  const rodsSeatArm: Vec3[] = [[xa, 330, zf + 200], [xa, 330, zs - 200]];
  const pinsArm = at("dowel", [[xa, 300, zb + BT / 2], [xa, 520, zb + BT / 2]], [1, 0, 0], "BL", "A", PIN);
  const bx0 = xa + 5, bx1 = xc - 5, bz0 = zf + 45, bz1 = zs - 5;
  const castors: Vec3[] = [bx0 + 60, bx1 - 60].flatMap((x) => [bz0 + 70, bz1 - 70].map((z) => [x, CAS, z] as Vec3));

  const steps: CustomStep[] = [
    {
      title: "Pull the cover onto the chaise lid",
      detail: "Stand the chaise longue up and lift its lid. Pull the cover down over the lid, the cut-out corners towards the hinges.",
      add: ["C", "L"],
    },
    { title: "Turn the cover's corners under the lid", detail: "Tuck all four corner flaps round the lid's frame and press them on." },
    { title: "Close the lid and tuck in the last flap", detail: "Lower the lid onto the box, then fold the flap at the front corner round the frame." },
    {
      title: "Push two pins into the short backrest",
      detail: "Into the holes in its end that faces the sofa, collar against the wood.",
      fix: [pinsBack],
    },
    { title: "Push the long backrest onto the pins", detail: "Straight on, until the two ends meet.", add: ["BL"] },
    { title: "Push the chaise longue against the backrest", detail: "Slide it along until its back sits right behind the short backrest piece." },
    { title: "Screw four rods into sleeve nuts", detail: "By hand, a sleeve nut on the end of each rod. Click the 5 mm Allen key into the long handle: it's your extension." },
    {
      title: "Bolt the chaise to the backrest from inside",
      detail: "Lift the lid. Push each rod through the box's back wall into the backrest and tighten it with the handle. Don't stand in the box.",
      fix: [at("stud", rodsChaise, [0, 0, -1], "C", "BS", ROD), at("nut", rodsChaise.map((p) => [p[0], p[1], p[2] + 12] as Vec3), [0, 0, -1], "C", undefined, SLEEVE)],
      tools: ["allen"],
    },
    {
      title: "Bolt the two Z brackets to the chaise",
      detail: "On the side that faces the sofa, slotted flap out. Use the shorter bolts, two in each, then close the lid.",
      fix: [
        at("angle", zBr.map((z) => [xc, ST - 50, z] as Vec3), [1, 0, 0], "C", undefined, ZB),
        at("bolt", zBr.flatMap((z) => [z - 25, z + 25].map((zz) => [xc, ST - 70, zz] as Vec3)), [1, 0, 0], "C", undefined, SHORT_BOLT),
      ],
      tools: ["allen"],
    },
    {
      title: "Tip it over onto the backrest",
      detail: "Lay it on the rug so the backrest lies flat and the chaise stands on its back end.",
      pose: "+z",
      warnings: ["floor"],
    },
    {
      title: "Lower the seat frame in together",
      detail: "Underside towards you, its back edge on the backrest. Press it down until the plastic tabs click into the holes.",
      add: ["S"],
      people: 2,
      warnings: ["two"],
    },
    { title: "Screw four more rods into sleeve nuts", detail: "The same as before, by hand." },
    { title: "Push the armrest onto two pins", detail: "Pins into the end of the backrest first, then the armrest onto them.", add: ["A"], fix: [pinsArm] },
    {
      title: "Bolt the seat to the backrest and the armrest",
      detail: "Two rods through the seat frame's back into the backrest, two through its end into the armrest. Tighten with the handle.",
      fix: [
        at("stud", rodsSeatBack, [0, 0, -1], "S", "BL", ROD),
        at("nut", rodsSeatBack.map((p) => [p[0], p[1], p[2] + 12] as Vec3), [0, 0, -1], "S", undefined, SLEEVE),
        at("stud", rodsSeatArm, [-1, 0, 0], "S", "A", ROD),
        at("nut", rodsSeatArm.map((p) => [p[0] + 12, p[1], p[2]] as Vec3), [-1, 0, 0], "S", undefined, SLEEVE),
      ],
      tools: ["allen"],
    },
    {
      title: "Bolt the seat frame to the Z brackets",
      detail: "The longer bolts this time, two through the slots of each bracket.",
      fix: [at("bolt", zBr.flatMap((z) => [z - 25, z + 25].map((zz) => [xc, ST - 30, zz] as Vec3)), [-1, 0, 0], "S", "C", LONG_BOLT)],
      tools: ["allen"],
    },
    {
      title: "Screw in the legs",
      detail: "Five under the chaise longue and two under the armrest, clockwise by hand.",
      add: [...chaiseLegs.map((_, i) => `LC${i}`), "LA0", "LA1"],
      warnings: ["hand"],
    },
    {
      title: "Screw on the two catches",
      detail: "One on the chaise's inner side, one on the armrest's, two screws each.",
      fix: [
        at("hook", [[xc, 190, zm - 200]], [1, 0, 0], "C", undefined, { name: "Catch" }),
        at("hook", [[xa, 190, zm - 200]], [-1, 0, 0], "A", undefined, { name: "Catch" }),
        at("screw", [[xc, 175, zm - 215], [xc, 205, zm - 185]], [1, 0, 0], "C", undefined, { len: 25, dia: 4 }),
        at("screw", [[xa, 175, zm - 215], [xa, 205, zm - 185]], [-1, 0, 0], "A", undefined, { len: 25, dia: 4 }),
      ],
      tools: ["screwdriver"],
    },
    { title: "Stand the sofa up together", detail: "Lift it by the frame, never by the legs.", pose: "+y", people: 2, warnings: ["two"] },
    {
      title: "Screw the castors under the bed base",
      detail: "Lay the bed base upside down on the rug. Two screws hold each castor.",
      add: ["BB"],
      from: { BB: [0, 0, 900] },
      fix: [
        at("castor", castors, [0, 1, 0], "BB", undefined, { len: CAS, dia: 40 }),
        at("screw", castors.flatMap((p) => [[p[0] - 22, CAS, p[2]], [p[0] + 22, CAS, p[2]]] as Vec3[]), [0, 1, 0], "BB", undefined, { len: 16, dia: 4 }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw a pin plate to each end",
      detail: "At the back of each end, the pin pointing out and towards the top.",
      fix: [
        at("plate", [[bx0, 170, bz0 + 60]], [1, 0, 0], "BB", undefined, { len: 60, dia: 30, name: "Pin plate" }),
        at("plate", [[bx1, 170, bz0 + 60]], [-1, 0, 0], "BB", undefined, { len: 60, dia: 30, name: "Pin plate" }),
        at("screw", [[bx0, 155, bz0 + 40], [bx0, 185, bz0 + 80]], [1, 0, 0], "BB", undefined, { len: 16, dia: 4 }),
        at("screw", [[bx1, 155, bz0 + 40], [bx1, 185, bz0 + 80]], [-1, 0, 0], "BB", undefined, { len: 16, dia: 4 }),
      ],
      tools: ["screwdriver"],
    },
    { title: "Slide the bed base in under the seat", detail: "Tilt it, guide both pins into the slots in the sides, then push it all the way in." },
  ];
  if (pad) {
    steps.push({ title: "Zip the mattress pad into its cover", detail: "Roll the pad up tight, slide it into the cover and close the zip." });
    steps.push({ title: "Stand the mattress pad against the chaise backrest", add: ["P"] });
    steps.push({ title: "Put the back cushions on the seat", detail: "Three of them, along the long backrest.", add: cushions.filter((c) => c !== "P") });
  } else {
    steps.push({ title: "Put the back cushions on", detail: "Three of them, pushed back against the backrest.", add: cushions });
  }
  return { parts, steps };
}

/** The 3-seat sofa-bed: 225 x 83 x 105 cm on IKEA's page, whatever size the guide was given. */
function threeSeat(): CustomParams {
  const W = 2250, D = 1050, H = 830, AW = 150, LEG = 90, ST = 460, BH = 660, BT = 200;
  const xa = -W / 2 + AW, xb = W / 2 - AW, iw = xb - xa;
  const zb = -D / 2, zf = D / 2, zs = zb + BT;
  const yb0 = LEG + 120; // the backrest frame starts above the seat box's back rail
  const pt = (x: number, y: number, z: number): Vec3 => [x, y, z];
  const parts: CustomPart[] = [
    { id: "E1", name: "Backrest end", size: [60, BH - yb0, BT], pos: [xa + 30, (yb0 + BH) / 2, zb + BT / 2], material: "board" },
    { id: "E2", name: "Backrest end", size: [60, BH - yb0, BT], pos: [xb - 30, (yb0 + BH) / 2, zb + BT / 2], material: "board" },
    { id: "T", name: "Top rail", size: [iw - 120, 60, BT], pos: [0, BH - 30, zb + BT / 2], material: "board" },
    { id: "R", name: "Bottom rail", size: [iw - 120, 60, BT], pos: [0, yb0 + 30, zb + BT / 2], material: "board" },
    ...[-0.25, 0, 0.25].map((t, i): CustomPart => ({ id: `U${i}`, name: "Upright", size: [50, BH - yb0 - 120, 30], pos: [t * iw, (yb0 + BH) / 2, zb + 30], material: "board" })),
    { id: "BP", name: "Back padding", size: [iw, BH - yb0, 40], pos: [0, (yb0 + BH) / 2, zb + BT - 20], material: "soft" },
    { id: "S", name: "Seat box", size: [iw, 300 - LEG, D], pos: [0, (LEG + 300) / 2, 0], material: "board" },
    { id: "M", name: "Seat and bed", size: [iw - 10, ST - 300, D - BT - 10], pos: [0, (300 + ST) / 2, (zs + zf) / 2 + 5], material: "soft" },
    { id: "AL", name: "Armrest", size: [AW, 620 - LEG, D], pos: [-W / 2 + AW / 2, (LEG + 620) / 2, 0], material: "soft" },
    { id: "AR", name: "Armrest", size: [AW, 620 - LEG, D], pos: [W / 2 - AW / 2, (LEG + 620) / 2, 0], material: "soft" },
  ];
  const lp = [xa + 80, 0, xb - 80].flatMap((x) => [zb + 80, zf - 80].map((z) => [x, z] as [number, number]));
  lp.forEach(([x, z], i) => parts.push({ id: `L${i}`, name: "Leg", size: [60, LEG, 60], pos: [x, LEG / 2, z], shape: "cyl", material: "wood" }));
  const cw = iw / 3;
  for (let i = 0; i < 3; i++) parts.push({ id: `K${i}`, name: "Back cushion", size: [cw - 10, H - ST, 200], pos: [xa + cw * (i + 0.5), (ST + H) / 2, zs + 100], material: "soft" });
  const B30 = { len: 30, dia: 6 }, B45 = { len: 45, dia: 6 }, B150 = { len: 150, dia: 8 }, SCR = { len: 30, dia: 4 };
  const fx = (kind: Kind, pts: Vec3[], dir: Vec3, on: string, mate?: string, o: { len?: number; dia?: number; name?: string } = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });
  const zm = zb + BT / 2, yT = BH - 30, yR = yb0 + 30;
  const ends = [xa + 60, xb - 60];
  const conn = [xa, xb].flatMap((x) => [yR + 60, yT - 60].map((y) => pt(x, y, zm)));
  const steps: CustomStep[] = [
    { title: "Stand the two backrest ends up", detail: "On a rug, the hanging slots facing out, as far apart as the rail is long.", add: ["E1", "E2"], warnings: ["floor"] },
    { title: "Lay the top rail on and bolt it to the ends", detail: "Holes facing up, as the drawing shows. One bolt into each end with the Allen key.", add: ["T"], fix: [fx("bolt", ends.map((x) => pt(x, BH, zm)), [0, -1, 0], "T", undefined, B30)], tools: ["allen"] },
    { title: "Screw the first upright to the top rail", detail: "In the middle, two screws from above.", add: ["U1"], fix: [fx("screw", [-12, 12].map((dz) => pt(0, BH, zb + 30 + dz)), [0, -1, 0], "T", "U1", SCR)], tools: ["allen"] },
    { title: "Screw on the other two uprights", detail: "Two screws in each, the same way.", add: ["U0", "U2"], fix: [fx("screw", [-0.25, 0.25].flatMap((t) => [-12, 12].map((dz) => pt(t * iw, BH, zb + 30 + dz))), [0, -1, 0], "T", undefined, SCR)], tools: ["allen"] },
    { title: "Turn the frame over together", detail: "Lift it by both ends and stand it on its top rail.", people: 2, warnings: ["two"], pose: "-y" },
    {
      title: "Bolt the bottom rail on with the brackets and plates",
      detail: "An angle bracket inside each end and a flat plate over each joint, one bolt through both at each end, with the Allen key.",
      add: ["R"],
      fix: [
        fx("angle", ends.map((x) => pt(x, yR, zm + 60)), [0, 0, -1], "R", undefined, { len: 60, dia: 50, name: "Angle bracket" }),
        fx("plate", ends.map((x) => pt(x, yb0, zm)), [0, 1, 0], "R", undefined, { len: 80, dia: 30, name: "Joining plate" }),
        fx("bolt", ends.map((x) => pt(x, yb0, zm + 30)), [0, 1, 0], "R", undefined, B30),
      ],
      pose: "-y",
      tools: ["allen"],
    },
    { title: "Screw the uprights to the bottom rail", detail: "Two screws, through the rail into the outer uprights.", fix: [fx("screw", [-0.25, 0.25].map((t) => pt(t * iw, yb0, zb + 30)), [0, 1, 0], "R", undefined, SCR)], pose: "-y", tools: ["allen"] },
    { title: "Bolt the four armrest connectors to the ends", detail: "Two on the outside of each end, slots pointing up. One bolt each.", fix: [fx("connector", conn, [0, 0, 1], "E1", undefined, { len: 120, dia: 30, name: "Armrest connector" }), ...[1, -1].map((sx) => fx("bolt", conn.filter((p) => Math.sign(p[0]) === -sx), [sx, 0, 0], sx > 0 ? "E1" : "E2", undefined, B45))], pose: "-y", tools: ["allen"] },
    { title: "Stand the frame up and bolt the rails tight", detail: "Two bolts through the top of each end into the rails.", pose: "+y", fix: [fx("bolt", ends.flatMap((x) => [BH, yb0 + 60].map((y) => pt(x, y, zm + 50))), [0, 0, -1], "E1", undefined, B30)], tools: ["allen"] },
    { title: "Screw four bolts into the bottom rail", detail: "Into the holes along its lower edge, part way only: the seat box hangs on these.", fix: [fx("bolt", [-0.375, -0.125, 0.125, 0.375].map((t) => pt(t * iw, yb0, zm)), [0, 1, 0], "R", undefined, B45)], tools: ["allen"] },
    { title: "Cut the ties on the seat box", detail: "Lay the box on the rug and throw the ties away." },
    { title: "Unfold the bed and fold it back", detail: "Pull the bed part out and lift it, check it moves freely, then fold it back into the box." },
    { title: "Pull the padding onto the backrest frame", detail: "Lay the frame on its back, then pull the padded cover over it and fasten it along the bottom.", add: ["BP"], people: 2, warnings: ["two"], pose: "+z" },
    {
      title: "Push three long bolts through the back of the seat box",
      detail: "From inside the box, with the long Allen key, part way out of the back rail.",
      fix: [fx("bolt", [-0.33, 0, 0.33].map((t) => pt(t * iw, yR, zs + 40)), [0, 0, -1], "S", "R", B150)],
      tools: ["allen"],
      wait: ["S"],
    },
    { title: "Screw in the four hanging studs", detail: "Into the top of the box's back rail, by hand.", fix: [fx("stud", [-0.375, -0.125, 0.125, 0.375].map((t) => pt(t * iw, 300, zb + 60)), [0, -1, 0], "S", undefined, { len: 20, dia: 8, name: "Hanging stud" })], warnings: ["hand"] },
    { title: "Lower the backrest onto the seat box together", detail: "Tip the box onto its back. The keyhole plates under the backrest go over the studs; push it down until it locks.", add: ["S"], people: 2, warnings: ["two"], pose: "+z" },
    { title: "Bolt the backrest to the box from inside", detail: "Tighten the three long bolts, then the four bolts in the bottom rail, all with the Allen key.", pose: "+z", tools: ["allen"] },
    { title: "Bolt the backrest ends to the box", detail: "Two bolts through each end into the side of the box.", fix: [fx("bolt", ends.flatMap((x) => [zb + 60, zb + 140].map((z) => pt(x, 220, z))), [0, -1, 0], "E1", "S", B45)], pose: "+z", tools: ["allen"] },
    { title: "Screw in the six legs", detail: "Clockwise by hand, three along the back and three along the front.", add: lp.map((_, i) => `L${i}`), pose: "+z", warnings: ["hand"] },
    { title: "Stand it up and pull the bed out", detail: "Together. Lift it onto its legs, then pull the bed part out by its strap.", people: 2, warnings: ["two"], pose: "+y" },
    { title: "Lay the seat and bed cushion on", detail: "Fold the bed back in first, then lay the big cushion on top, its strap at the front.", add: ["M"], kind: "cushions" },
    { title: "Lower the first armrest onto its connectors", detail: "Its brackets drop over the two connectors on the end of the backrest. Press it down until it sits on the floor.", add: ["AL"], people: 2, warnings: ["two"] },
    { title: "Bolt the armrest to the seat box", detail: "Pull the bed out to reach. Two bolts through the box into the armrest, with the Allen key.", fix: [fx("bolt", [zb + 400, zf - 200].map((z) => pt(xa, 200, z)), [-1, 0, 0], "S", "AL", B30)], tools: ["allen"] },
    { title: "Fit the other armrest the same way", detail: "Onto its two connectors, then two bolts through the box.", add: ["AR"], fix: [fx("bolt", [zb + 400, zf - 200].map((z) => pt(xb, 200, z)), [1, 0, 0], "S", "AR", B30)], tools: ["allen"] },
    { title: "Zip the covers onto the back cushions and put them in", detail: "Push the filling into the corners, close the zip and lean them against the backrest.", add: ["K0", "K1", "K2"], kind: "cushions" },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["FRIHETEN"],
  recipe(s) {
    const v = s.variant.toLowerCase();
    // this guide's page, photo and manual are the 3-seat sofa-bed, though it was named a corner sofa-bed
    if (s.slug === "friheten-corner-sofa-bed" || /3-seat sofa-bed/.test(v)) return threeSeat();
    if (!/corner/.test(v)) return null;
    const pad = /KLAGSHAMN/i.test(s.name);
    // the KLAGSHAMN set is pictured with the chaise on the left, the plain one on the right
    const side = pad ? -1 : s.sofa?.chaise === "left" ? -1 : 1;
    return corner(s, side, pad);
  },
};
export default family;

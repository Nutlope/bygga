import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, ProductSpec, Vec3 } from "../../types";

/**
 * BOLLSIDAN, read from its manuals. The electric desk's frame is built upside down: the two halves of the cross
 * rail, a leg with its motor bolted to each end and the drive shaft between them, then the feet. Stood up, the top
 * supports are screwed on; then the frame goes upside down onto the desk top on a rug and is screwed to it, the
 * control panel, power unit, cable clips and cable tray go on and the cables are plugged in. Two people turn it over.
 * The laptop stand's gas column screws into the bracket under its top, its foot frame onto the column's other end.
 */

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const box = (id: string, name: string, size: Vec3, pos: Vec3, material: CustomPart["material"] = "metal"): CustomPart => ({ id, name, size, pos, material });

function desk(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10; // H: the lowest height
  const tt = 25, yU = H - tt;
  const xl = W / 2 - 110; // leg centre
  const sh = 30, ft = 30; // top supports, feet
  const yS = yU - sh; // underside of the supports
  const rh = 50 + sh; // cross rail, its top flush with the supports so it screws to the desk top
  const yR = yU - rh / 2;
  const cw = 70, cd = 90;
  const parts: CustomPart[] = [
    box("R1", "Cross rail", [2 * xl - cw, rh, 15], [0, yR, -35]),
    box("R2", "Cross rail", [2 * xl - cw, rh, 15], [0, yR, 35]),
    box("L1", "Leg with motor", [cw, yS - ft, cd], [-xl, ft + (yS - ft) / 2, 0]),
    box("L2", "Leg", [cw, yS - ft, cd], [xl, ft + (yS - ft) / 2, 0]),
    { id: "X", name: "Drive shaft", shape: "cyl", size: [12, 2 * xl - cw - 20, 12], pos: [0, yR, 0], rot: [0, 0, Math.PI / 2], material: "metal" },
    box("F1", "Foot", [cw, ft, D - 60], [-xl, ft / 2, 0]),
    box("F2", "Foot", [cw, ft, D - 60], [xl, ft / 2, 0]),
    box("S1", "Top support", [cw, sh, D - 120], [-xl, yS + sh / 2, 0]),
    box("S2", "Top support", [cw, sh, D - 120], [xl, yS + sh / 2, 0]),
    box("T", "Desk top", [W, tt, D], [0, H - tt / 2, 0], "board"),
    box("P", "Control panel", [90, 25, 60], [xl - 40, yU - 12, D / 2 - 35], "board"),
    box("U", "Power unit", [180, 40, 70], [-150, yU - 20, -D / 2 + 140], "board"),
    box("C", "Cable tray", [W - 400, 60, 90], [0, yU - 30, -D / 2 + 60], "metal"),
  ];
  const ends = [-1, 1];
  const legBolts = (sx: number) =>
    fx("bolt", [-1, 1].flatMap((k) => [[sx * (xl - cw / 2 - 1), yS - 40, k * 35], [sx * (xl - cw / 2 - 1), yS - 20, k * 35]] as Vec3[]), [sx, 0, 0], {
      len: 12, dia: 6, on: sx < 0 ? "L1" : "L2", to: ["R1", "R2"],
    });
  const quad = (x: number, y: number, z: number, dx = 15): Vec3[] => [[x - dx, y, -z], [x + dx, y, -z], [x - dx, y, z], [x + dx, y, z]];
  const steps: CustomStep[] = [
    {
      title: "Join the two halves of the cross rail",
      detail: "Lay them on a rug the way round shown, with the cut-outs facing the same way. Two small screws hold them together.",
      add: ["R1", "R2"],
      fix: [fx("screw", [[0, yU - rh, -35], [0, yU - rh, 35]], [0, 1, 0], { len: 10, dia: 4, on: "R1", to: ["R1", "R2"] })],
      tools: ["screwdriver"],
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Bolt the leg with the motor to one end", detail: "Four bolts, with the Allen key.", add: ["L1"], fix: [legBolts(-1)], tools: ["allen"] },
    {
      title: "Fit the drive shaft and bolt on the other leg",
      detail: "Push the shaft into the motor, then slide the other leg onto its end and bolt it on with four bolts.",
      add: ["X", "L2"],
      fix: [legBolts(1)],
      tools: ["allen"],
    },
    { title: "Check the shaft sits in both legs", detail: "The hex end must go all the way into each gear housing, or the legs won't rise together." },
    {
      title: "Bolt the feet onto the legs",
      detail: "Four bolts in each foot.",
      add: ["F1", "F2"],
      fix: ends.map((sx) => fx("bolt", quad(sx * xl, ft, 25), [0, 1, 0], { len: 12, dia: 6, on: sx < 0 ? "F1" : "F2", mate: sx < 0 ? "L1" : "L2" })),
      tools: ["allen"],
    },
    {
      title: "Stand the frame up and screw on the top supports",
      detail: "Two screws in each, with the curved ends pointing out to the sides.",
      add: ["S1", "S2"],
      fix: ends.map((sx) => fx("bolt", [[sx * xl, yU, -35], [sx * xl, yU, 35]], [0, -1, 0], { len: 10, dia: 6, on: sx < 0 ? "S1" : "S2", to: ["R1", "R2"] })),
      tools: ["allen"],
      pose: "+y",
    },
    {
      title: "Lay the frame upside down on the desk top",
      detail: "Desk top face down on a rug, the frame centred on it. Screw through the supports into the top.",
      add: ["T"],
      fix: ends.map((sx) => fx("screw", quad(sx * xl, yU, D / 2 - 90), [0, 1, 0], { len: 16, dia: 4, on: sx < 0 ? "S1" : "S2", mate: "T" })),
      tools: ["screwdriver"],
      pose: "-y",
      people: 2,
      warnings: ["floor", "two"],
    },
    {
      title: "Screw the cross rail to the top",
      detail: "Four screws through the rail.",
      fix: [fx("screw", [[-xl / 2, yU - 6, -35], [xl / 2, yU - 6, -35], [-xl / 2, yU - 6, 35], [xl / 2, yU - 6, 35]], [0, 1, 0], { len: 16, dia: 4, to: ["R1", "R2"], mate: "T" })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw on the control panel",
      detail: "At the front edge, buttons facing you when you stand at the desk.",
      add: ["P"],
      fix: [fx("screw", [[xl - 70, yU - 25, D / 2 - 35], [xl - 10, yU - 25, D / 2 - 35]], [0, 1, 0], { len: 12, dia: 4, on: "P", mate: "T" })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw on the power unit",
      add: ["U"],
      fix: [fx("screw", [[-220, yU - 40, -D / 2 + 140], [-80, yU - 40, -D / 2 + 140]], [0, 1, 0], { len: 16, dia: 4, on: "U", mate: "T" })],
      tools: ["screwdriver"],
    },
    {
      title: "Press in the cable clips",
      detail: "Six along the rail and the underside of the top, two at the legs.",
      fix: [fx("clip", [-0.6, -0.3, 0, 0.3, 0.6, 0.8, -0.95, 0.95].map((f) => [f * xl, yU, -60] as Vec3), [0, 1, 0], { len: 10, dia: 14, on: "T" })],
    },
    { title: "Slide the control box into its holder", detail: "It sits on the cross rail, cable towards the motor." },
    {
      title: "Screw on the cable tray",
      detail: "Along the back edge. Six screws.",
      add: ["C"],
      fix: [fx("screw", [-0.4, 0, 0.4].flatMap((f) => [[f * (W - 400), yU - 60, -D / 2 + 25], [f * (W - 400), yU - 60, -D / 2 + 95]] as Vec3[]), [0, 1, 0], { len: 14, dia: 4, on: "C", mate: "T" })],
      tools: ["screwdriver"],
    },
    {
      title: "Plug in the cables",
      detail: "Motor and control panel into the control box, then the power unit. Clip the cables in and lay the spare length in the tray.",
    },
    {
      title: "Turn the desk the right way up",
      detail: "Together, lifting by the top. Turn the feet under it if it rocks, then plug it in and run it once to the bottom.",
      pose: "+y",
      people: 2,
      warnings: ["two"],
    },
  ];
  return { parts, steps };
}

function laptopStand(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10;
  const H = Math.max(s.size.h * 10, 650); // IKEA: 65 to 103 cm
  const tt = 18, yU = H - tt;
  const bh = 35; // bracket under the top
  const xc = W / 2 - 110; // column, at one end
  const ft = 25;
  const parts: CustomPart[] = [
    box("T", "Top", [W, tt, D], [0, H - tt / 2, 0], "board"),
    box("K", "Top bracket", [W - 160, bh, 90], [0, yU - bh / 2, 0]),
    box("C", "Gas column", [60, yU - bh - ft, 60], [xc, ft + (yU - bh - ft) / 2, 0]),
    {
      id: "F",
      name: "Foot frame",
      size: [2 * xc + 90, ft, D],
      pos: [0, ft / 2, 0],
      material: "metal",
      pieces: [
        { shape: "box", size: [90, ft, D], pos: [-xc, 0, 0] },
        { shape: "box", size: [90, ft, D], pos: [xc, 0, 0] },
        { shape: "box", size: [2 * xc - 90, ft, 50], pos: [0, 0, 0] },
      ],
    },
  ];
  const y0 = yU - bh;
  const steps: CustomStep[] = [
    {
      title: "Pull the cap off the top of the column",
      detail: "It only protects the thread in transport; throw it away.",
      add: ["C"],
      pose: "-y",
    },
    {
      title: "Screw the column to the bracket under the top",
      detail: "Lay the top upside down on a rug, the release cable towards the column. Four bolts, with the Allen key.",
      add: ["T", "K"],
      fix: [fx("bolt", [[xc - 20, y0, -20], [xc + 20, y0, -20], [xc - 20, y0, 20], [xc + 20, y0, 20]], [0, 1, 0], { len: 12, dia: 6, on: "K", mate: "C" })],
      tools: ["allen"],
      warnings: ["floor"],
    },
    {
      title: "Bolt the foot frame onto the column",
      detail: "Four bolts through the frame into the end of the column.",
      add: ["F"],
      fix: [fx("bolt", [[xc - 20, ft - 6, -20], [xc + 20, ft - 6, -20], [xc - 20, ft - 6, 20], [xc + 20, ft - 6, 20]], [0, 1, 0], { len: 16, dia: 6, on: "F", mate: "C" })],
      tools: ["allen"],
    },
    { title: "Stand it up", detail: "Lift the lever under the top and push down or let it rise to set the height. Don't sit or lean on it.", pose: "+y" },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["BOLLSIDAN"],
  recipe(s) {
    const v = `${s.variant} ${s.slug ?? ""}`.toLowerCase();
    if (/laptop/.test(v)) return laptopStand(s);
    if (/desk/.test(v)) return desk(s);
    return null;
  },
};
export default family;

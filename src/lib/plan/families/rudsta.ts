import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * RUDSTA, read from its two manuals (42x37x155 with one door, 80x37x120 with two). A steel frame built lying on its
 * side on a rug: one welded side frame, the cross rails screwed into it, the other side frame, then the shelf plates
 * slide in. Levelling feet go into the legs, it is stood up, plastic bushings go into the bottom and the top rails,
 * and two people lower each glass side into its bushings while the top rails are screwed on. The steel back is
 * screwed on, each glass door drops onto its bottom pivot and is held by a pin at the top, the top plate slides on,
 * and a two-part bracket holds it to the wall. Glass shelves rest on clip-on supports.
 */

const TUBE = 20;

function doorPart(id: string, w: number, h: number, pos: Vec3): CustomPart {
  const f = 22;
  const pieces: PartPiece[] = [
    { shape: "box", size: [f, h, 20], pos: [-w / 2 + f / 2, 0, 0], material: "metal" },
    { shape: "box", size: [f, h, 20], pos: [w / 2 - f / 2, 0, 0], material: "metal" },
    { shape: "box", size: [w - 2 * f, f, 20], pos: [0, h / 2 - f / 2, 0], material: "metal" },
    { shape: "box", size: [w - 2 * f, f, 20], pos: [0, -h / 2 + f / 2, 0], material: "metal" },
    { shape: "box", size: [w - 2 * f, h - 2 * f, 4], pos: [0, 0, 0], material: "glass" },
  ];
  return { id, name: "Glass door", size: [w, h, 20], pos, material: "glass", pieces };
}

function recipe(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const narrow = W < 600;
  const yC = narrow ? Math.round(H * 0.36) : 230; // the cabinet's bottom
  const yLow = 150; // the open shelf under the narrow one
  const yT = H - 6; // top of the frame, under the top plate
  const xs = W / 2 - TUBE / 2, zs = D / 2 - TUBE / 2;
  const parts: CustomPart[] = [];
  // a welded side frame: two legs joined by rails at the top, the cabinet bottom and (narrow) the low shelf
  const sideFrame = (id: string, sx: number): CustomPart => {
    const ys = [yC, yT - TUBE / 2, ...(narrow ? [yLow] : [])];
    const pieces: PartPiece[] = [
      ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [TUBE, yT, TUBE], pos: [0, 0, sz * zs] })),
      ...ys.map((y): PartPiece => ({ shape: "box", size: [TUBE, TUBE, D - 2 * TUBE], pos: [0, y - yT / 2, 0] })),
    ];
    return { id, name: "Side frame", size: [TUBE, yT, D], pos: [sx * xs, yT / 2, 0], material: "metal", pieces };
  };
  parts.push(sideFrame("fL", -1), sideFrame("fR", 1));
  const rail = (id: string, name: string, y: number, sz: number) => parts.push({ id, name, size: [W - 2 * TUBE, TUBE, TUBE], pos: [0, y, sz * zs], material: "metal" });
  rail("rBF", "Cross rail", yC, 1);
  rail("rBB", "Cross rail", yC, -1);
  rail("rTF", "Top rail", yT - TUBE / 2, 1);
  rail("rTB", "Top rail", yT - TUBE / 2, -1);
  const plate = (id: string, name: string, y: number) => parts.push({ id, name, size: [W - 2 * TUBE, 3, D - 2 * TUBE], pos: [0, y + TUBE / 2 + 1.5, 0], material: "metal" });
  if (narrow) plate("low", "Bottom shelf", yLow);
  plate("bot", "Cabinet bottom", yC);
  const gh = yT - TUBE - yC - TUBE;
  const gy = yC + TUBE / 2 + gh / 2 + TUBE / 2;
  for (const [id, sx] of [["gL", -1], ["gR", 1]] as const) parts.push({ id, name: "Glass side", size: [5, gh, D - 2 * TUBE - 10], pos: [sx * (W / 2 - TUBE / 2), gy, 0], material: "glass" });
  const backs = narrow ? ["bk0"] : ["bk0", "bk1"];
  const bw = (W - 2 * TUBE) / backs.length;
  // the back reaches over the bottom and top rails, which it is screwed to
  const by0 = yC - TUBE / 2, by1 = yT;
  backs.forEach((id, i) => parts.push({ id, name: "Back panel", size: [bw, by1 - by0, 2], pos: [-W / 2 + TUBE + bw / 2 + i * bw, (by0 + by1) / 2, -D / 2 + TUBE + 1], material: "metal" }));
  const nDoor = narrow ? 1 : 2;
  const dw = (W - 2 * TUBE) / nDoor - 3;
  const doors = Array.from({ length: nDoor }, (_, i) => `d${i}`);
  doors.forEach((id, i) => parts.push(doorPart(id, dw, gh, [-W / 2 + TUBE + (dw + 3) / 2 + i * (dw + 3), gy, D / 2 - 10])));
  parts.push({ id: "top", name: "Top plate", size: [W, 6, D], pos: [0, H - 3, 0], material: "metal" });
  const shelfY = [gy - gh / 6, gy + gh / 6];
  shelfY.forEach((y, i) => parts.push({ id: `sh${i}`, name: "Glass shelf", size: [W - 2 * TUBE - 12, 6, D - 2 * TUBE - 30], pos: [0, y, -10], material: "glass" }));

  const fix = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
  const screw = { len: 10, dia: 6 };
  const railEnds = (sx: number, y: number): Vec3[] => [-1, 1].map((sz) => [sx * (W / 2 - TUBE), y, sz * zs] as Vec3);
  const feet = fix("foot", [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * xs, 0, sz * zs] as Vec3)), [0, 1, 0], { name: "Levelling foot", len: 30, dia: 24 });
  const bushBot: Vec3[] = [
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (W / 2 - TUBE / 2), yC + TUBE / 2 + 3, sz * (D / 2 - 60)] as Vec3)),
    ...doors.map((_, i): Vec3 => [i ? W / 2 - TUBE - 15 : -W / 2 + TUBE + 15, yC + TUBE / 2 + 3, D / 2 - 10]),
  ];
  const bushTop: Vec3[] = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (W / 2 - TUBE - 40), yT - TUBE, sz * zs] as Vec3));
  const backScrews: Vec3[] = backs.flatMap((_, i) => {
    const x0 = -W / 2 + TUBE + i * bw;
    const n = narrow ? 4 : 6;
    return [yC, yT - TUBE / 2].flatMap((y) => Array.from({ length: n / 2 }, (_, k) => [x0 + (bw * (k + 1)) / (n / 2 + 1), y, -D / 2 + TUBE + 2] as Vec3));
  });
  const supports: Vec3[] = shelfY.flatMap((y) => [-1, 1].flatMap((sx) => (narrow ? [-1, 1] : [1]).map((sz) => [sx * (W / 2 - TUBE - 4), y - 6, sz * (D / 2 - 60)] as Vec3)));
  const steps: CustomStep[] = [
    {
      title: "Screw the cross rails into a side frame",
      detail: "Lay one side frame flat on a rug, the cut-outs facing up. Push the two rails into it and screw them with the Allen key.",
      add: ["fL", "rBF", "rBB"],
      fix: [fix("screw", railEnds(-1, yC), [1, 0, 0], { ...screw, on: "fL" })],
      tools: ["allen"],
      pose: "+x",
      warnings: ["floor"],
    },
    { title: "Screw on the other side frame", detail: "Onto the free ends of the rails, two screws.", add: ["fR"], fix: [fix("screw", railEnds(1, yC), [-1, 0, 0], { ...screw, on: "fR" })], tools: ["allen"] },
    ...(narrow
      ? [{ title: "Slide in the bottom shelf and screw it", detail: "Its folded edges go under the low rails. Four screws, two at each end.", add: ["low"], fix: [fix("screw", [-1, 1].flatMap((sx) => railEnds(sx, yLow).map((p) => [sx * (W / 2 - TUBE), yLow, p[2] * 0.6] as Vec3)), [1, 0, 0], { ...screw })].map((f) => ({ ...f, at: f.at!, dir: [0, -1, 0] as Vec3 })), tools: ["allen"] as CustomStep["tools"], from: { low: [0, 0, 300] as Vec3 } }]
      : [{ title: "Slide in the cabinet bottom and screw it", detail: "Its edges drop over the cross rails. Four screws into the rails.", add: ["bot"], fix: [fix("screw", [-1, 1].flatMap((sz) => [-1, 1].map((k) => [k * (W / 4), yC + TUBE / 2 + 3, sz * zs] as Vec3)), [0, -1, 0], { ...screw })], tools: ["allen"] as CustomStep["tools"], from: { bot: [0, 0, 300] as Vec3 } }]),
    ...(narrow ? [{ title: "Slide in the cabinet bottom", detail: "It hooks over the cross rails, the slot towards the front.", add: ["bot"], from: { bot: [0, 0, 300] as Vec3 } }] : []),
    ...((narrow ? [
      {
      title: "Fit the lock plate",
      detail: "Under the front edge of the cabinet bottom, one screw. A small padlock can go through it later.",
      fix: [fix("clip", [[0, yC + TUBE / 2, D / 2 - 20]], [0, 1, 0], { name: "Lock plate", len: 30, dia: 24, on: "bot" }), fix("screw", [[0, yC + TUBE / 2 + 3, D / 2 - 45]], [0, -1, 0], { ...screw, on: "bot" })],
      tools: ["allen"],
    }
    ] : []) as CustomStep[]),
    { title: "Screw the feet into the legs", detail: "One into the bottom of each leg, by hand.", fix: [feet] },
    { title: "Stand it up and press in the bottom bushings", detail: `Lift it upright. ${bushBot.length} bushings into the holes along the cabinet bottom: they hold the glass and the door pivots.`, fix: [fix("clip", bushBot, [0, -1, 0], { name: "Bushing", len: 10, dia: 12 })], pose: "+y" },
    { title: "Press bushings into the top rails", detail: "Two in each rail, from underneath.", fix: [fix("clip", bushTop, [0, 1, 0], { name: "Bushing", len: 10, dia: 12, on: "rTF" })], add: ["rTF", "rTB"], from: { rTF: [0, 300, 0], rTB: [0, 300, 0] } },
    { title: "Stand a glass side in together", detail: "One of you holds the glass upright in the frame while the other sets its bottom edge into the bushings.", add: ["gL"], people: 2, warnings: ["two", "hand"], from: { gL: [0, 360, 0] } },
    { title: "Screw the top rails to that side", detail: "Two countersunk screws, one into each rail end.", fix: [fix("screw", railEnds(-1, yT - TUBE / 2), [1, 0, 0], { name: "Countersunk screw", len: 10, dia: 6, on: "fL" })], tools: ["allen"] },
    { title: "Stand in the other glass side together", detail: "The same way, into the bushings at the other side.", add: ["gR"], people: 2, warnings: ["two", "hand"], from: { gR: [0, 360, 0] } },
    { title: "Screw the top rails to the other side", detail: "Two more countersunk screws.", fix: [fix("screw", railEnds(1, yT - TUBE / 2), [-1, 0, 0], { name: "Countersunk screw", len: 10, dia: 6, on: "fR" })], tools: ["allen"] },
    { title: narrow ? "Screw on the back panel" : "Screw on the back panels", detail: "Into the frame at the back, top and bottom.", add: backs, fix: [fix("screw", backScrews, [0, 0, -1], { ...screw })], tools: ["allen"], from: Object.fromEntries(backs.map((id) => [id, [0, 0, -300] as Vec3])) },
    {
      title: narrow ? "Hang the door" : "Hang the doors",
      detail: "Set the door's bottom pivot into its bushing, swing the top in and push the pin up through the rail into it.",
      add: doors,
      fix: [fix("pin", doors.map((_, i): Vec3 => [i ? W / 2 - TUBE - 15 : -W / 2 + TUBE + 15, yT - TUBE, D / 2 - 10]), [0, -1, 0], { name: "Hinge pin", len: 20, dia: 6, on: "rTF" })],
      from: Object.fromEntries(doors.map((id) => [id, [0, 0, 300] as Vec3])),
    },
    { title: "Slide the top plate on", detail: "From the back, until it clicks over the frame.", add: ["top"], from: { top: [0, 0, -400] } },
    { title: "Screw the top plate down", detail: "Two screws at the back.", fix: [fix("screw", [-1, 1].map((sx) => [sx * (W / 2 - TUBE - 40), H, -zs] as Vec3), [0, -1, 0], { ...screw, on: "top" })], tools: ["allen"] },
    { title: "Level it", detail: "Turn the feet until the door closes evenly." },
    {
      title: "Fix it to the wall",
      detail: "Clip the two-part bracket onto the top rail at the back, spacer block behind it, and screw it to the wall through a washer. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        fix("angle", [-1, 1].map((sx) => [sx * (W / 2 - 60), yT - TUBE / 2, -D / 2] as Vec3), [0, 0, 1], { name: "Wall bracket", len: 50, dia: 24 }),
        fix("spacer", [-1, 1].map((sx) => [sx * (W / 2 - 60), yT - 50, -D / 2 - 4] as Vec3), [0, 0, 1], { name: "Spacer block", len: 10, dia: 30 }),
        fix("plug", [-1, 1].map((sx) => [sx * (W / 2 - 60), yT - 50, -D / 2 - 50] as Vec3), [0, 0, -1], { len: 35, dia: 8 }),
        fix("washer", [-1, 1].map((sx) => [sx * (W / 2 - 60), yT - 50, -D / 2 - 12] as Vec3), [0, 0, -1], { len: 2, dia: 20 }),
        fix("screw", [-1, 1].map((sx) => [sx * (W / 2 - 60), yT - 50, -D / 2 - 11] as Vec3), [0, 0, -1], { len: 50, dia: 5 }),
      ],
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    { title: "Clip on the shelf supports", detail: `${supports.length} supports at the height you want, the same on both sides.`, fix: [fix("pin", supports.slice(0, supports.length / 2), [-1, 0, 0], { name: "Shelf support", len: 12, dia: 14 }), fix("pin", supports.slice(supports.length / 2), [-1, 0, 0], { name: "Shelf support", len: 12, dia: 14 })].map((f) => ({ ...f, dir: [0, -1, 0] as Vec3 })) },
    { title: "Lay the glass shelves on", detail: "Gently, onto the supports.", add: ["sh0", "sh1"], warnings: ["hand"] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["RUDSTA"],
  recipe(s) {
    // 80x170 has no manual of its own; the 80x120 one is a different height
    if (/rudsta-glass-door-cabinet-(42-x-37-x-155|80-x-37-x-120)/.test(s.slug ?? "")) return recipe(s);
    return null;
  },
};
export default family;

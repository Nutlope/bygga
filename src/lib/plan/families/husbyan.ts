import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, Vec3 } from "../../types";

/**
 * HUSBYÅN wall cabinet comes fully assembled: a steel box with its door, lock and three loose shelves. Its manual
 * hangs it on two wall screws through the back (marked with a level, screws not included), or stands it on four
 * felt pads instead, and shows the shelves lifting out to move them.
 */

const fx = (kind: CustomFix["kind"], on: string, dir: Vec3, at: Vec3[], o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, on, dir, at, ...o });

function wallCabinet(): CustomParams {
  // the page: 28 wide, 37.5 high, 11 deep
  const W = 280, H = 375, D = 110;
  const t = 6, dt = 16, bd = D - dt; // sheet, door, body depth
  const zb = -D / 2 + bd / 2;
  const body: PartPiece[] = [
    { shape: "box", size: [W, H, t], pos: [0, 0, -bd / 2 + t / 2] },
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [t, H, bd - t], pos: [(sx * (W - t)) / 2, 0, t / 2] })),
    ...[-1, 1].map((sy): PartPiece => ({ shape: "box", size: [W - 2 * t, t, bd - t], pos: [0, (sy * (H - t)) / 2, t / 2] })),
  ];
  const door: PartPiece[] = [
    { shape: "slab", outline: [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]], round: 26, size: [W, dt, H], pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0] },
  ];
  const shelfYs = [1, 2, 3].map((k) => t + ((H - 2 * t) * k) / 4);
  const parts: CustomPart[] = [
    { id: "B", name: "Cabinet", size: [W, H, bd], pos: [0, H / 2, zb], pieces: body, material: "metal" },
    { id: "DR", name: "Door", size: [W, H, dt], pos: [0, H / 2, D / 2 - dt / 2], pieces: door, material: "metal" },
    ...shelfYs.map((y, i): CustomPart => ({ id: `S${i}`, name: "Shelf", size: [W - 2 * t - 2, t, bd - t - 10], pos: [0, y, zb + t / 2 + 5], material: "metal" })),
  ];
  const back = -D / 2 + t;
  const holes: Vec3[] = [-1, 1].map((sx) => [sx * (W / 2 - 50), H - 50, back]);
  const steps: CustomStep[] = [
    {
      title: "Unpack it and open the door",
      detail: "It comes fully put together. Unlock it with the key and swing the door open.",
      add: ["B", "DR", "S0", "S1", "S2"],
      fix: [fx("knob", "DR", [0, 0, -1], [[W / 2 - 30, H / 2, D / 2]], { name: "Key", len: 30, dia: 22 })],
    },
    { title: "Move the shelves if you like", detail: "Tilt each shelf up at the front and lift it out, then rest it on the next ledge." },
    {
      title: "Mark the wall through the back",
      detail: "Hold it against the wall, level it, and mark through the two holes near the top of the back.",
      tools: ["level", "pencil"],
      wall: true,
      warnings: ["wall"],
    },
    {
      title: "Screw it to the wall",
      detail: "Drill, then two screws through the holes into the wall. Their heads must be at least 25 mm across. Wall screws aren't included: pick ones made for your wall.",
      fix: [fx("plug", "B", [0, 0, -1], holes.map(([x, y]) => [x, y, -D / 2] as Vec3)), fx("screw", "B", [0, 0, -1], holes, { len: 50, dia: 5 })],
      tools: ["drill", "screwdriver"],
      wall: true,
      warnings: ["wall"],
    },
    {
      title: "Or stand it on its pads",
      detail: "To stand it on a shelf instead of hanging it, lay it on its back and press the four felt pads under its corners.",
      fix: [fx("glide", "B", [0, 1, 0], [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (W / 2 - 30), 0, zb + sz * (bd / 2 - 20)] as Vec3)), { len: 3, dia: 16 })],
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["HUSBYÅN", "HUSBYAN"],
  recipe(s) {
    if (/wall cabinet/i.test(s.variant)) return wallCabinet();
    return null;
  },
};
export default family;

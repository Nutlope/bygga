import type { Family } from "./family";
import type { CustomParams, CustomPart, CustomStep, PartPiece, Vec3 } from "../../types";

/**
 * RULLEBÖR trolley comes fully assembled and folded flat. Its manual only unfolds it: the lower grid swings out until
 * it stops and both catches lock, the two wheels swing out to the sides, and the foot plate folds down until it clicks.
 * Folding it away is the same in reverse. Nothing is screwed and there are no fittings.
 */

const ALONG_X: Vec3 = [0, 0, Math.PI / 2];

function trolley(): CustomParams {
  // the page: 34 wide, 94 high, 45 deep
  const W = 340, H = 940;
  const xu = 120, zf = -100, t = 22; // uprights and frame tubes
  const wd = 160, ww = 40, zw = -150; // wheels
  const frame: PartPiece[] = [
    ...[-1, 1].map((sx): PartPiece => ({ shape: "cyl", size: [t, H - 70, t], pos: [sx * xu, (H + 70) / 2 - H / 2, 0] })),
    { shape: "cyl", size: [t, 2 * xu, t], pos: [0, H / 2 - t / 2, 0], rot: ALONG_X },
    ...[0.42, 0.66].map((k): PartPiece => ({ shape: "cyl", size: [14, 2 * xu, 14], pos: [0, H * k - H / 2, 0], rot: ALONG_X })),
    { shape: "box", size: [110, 26, 30], pos: [0, H / 2 - 90, 0] }, // the grip
    { shape: "cyl", size: [26, 2 * (W / 2 - ww), 26], pos: [0, wd / 2 - H / 2, -40], rot: ALONG_X }, // the axle
  ];
  const gw = 2 * xu - t, gh = 300;
  const grid: PartPiece[] = [
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [10, gh, 10], pos: [(sx * gw) / 2, 0, 0] })),
    ...[0, 1, 2, 3, 4].map((i): PartPiece => ({ shape: "box", size: [gw, 6, 6], pos: [0, -gh / 2 + 5 + ((gh - 10) * i) / 4, 0] })),
    ...[-1, 0, 1].map((k): PartPiece => ({ shape: "box", size: [6, gh, 6], pos: [(k * gw) / 3, 0, 0] })),
  ];
  const pd = 300, pw = 2 * xu;
  const plate: PartPiece[] = [
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [12, 14, pd], pos: [(sx * pw) / 2, 0, 0] })),
    { shape: "box", size: [pw, 14, 12], pos: [0, 0, pd / 2 - 6] },
    ...[1, 2, 3, 4, 5].map((i): PartPiece => ({ shape: "box", size: [pw, 5, 5], pos: [0, 2, -pd / 2 + (pd * i) / 6] })),
    ...[-1, 0, 1].map((k): PartPiece => ({ shape: "box", size: [5, 5, pd], pos: [(k * pw) / 3, 2, 0] })),
  ];
  const parts: CustomPart[] = [
    { id: "F", name: "Frame", size: [2 * xu + t, H, 40], pos: [0, H / 2, zf], pieces: frame, material: "metal" },
    { id: "G", name: "Grid", size: [gw + 10, gh, 10], pos: [0, 120 + gh / 2, zf + 30], pieces: grid, material: "metal" },
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `W${i}`, name: "Wheel", size: [ww, wd, wd], pos: [sx * (W / 2 - ww / 2), wd / 2, zw], pieces: [{ shape: "cyl", size: [wd, ww, wd], pos: [0, 0, 0], rot: ALONG_X }], material: "soft" })),
    { id: "P", name: "Foot plate", size: [pw + 12, 14, pd], pos: [0, 12, zf + 20 + pd / 2], pieces: plate, material: "metal" },
  ];
  const steps: CustomStep[] = [
    {
      title: "Unpack it",
      detail: "It comes fully put together and folded flat. Stand it up on its frame: there's nothing to screw.",
      add: ["F"],
    },
    {
      title: "Swing the grid out",
      detail: "Pull its bottom away from the frame until it stops, about 15 cm out, and both catches lock.",
      add: ["G"],
      from: { G: [0, 0, -40] },
    },
    {
      title: "Swing the wheels out",
      detail: "Turn each wheel out to the side until it clicks into place.",
      add: ["W0", "W1"],
      from: { W0: [70, 0, 60], W1: [-70, 0, 60] },
    },
    {
      title: "Fold the foot plate down",
      detail: "Lower it until both catches click. To fold it away, press the catches and do it all in reverse.",
      add: ["P"],
      from: { P: [0, 160, -150] },
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["RULLEBÖR", "RULLEBOR"],
  recipe(s) {
    if (/trolley/i.test(s.variant)) return trolley();
    return null;
  },
};
export default family;

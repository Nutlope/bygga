import type { Family } from "./family";
import type { CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * GRYTERYD recliner rocker, from its manual. It comes nearly assembled: the seat with its arms, rocker base and
 * footrest is one piece, the backrest another. The cable ties that hold the mechanism for transport are cut, the
 * cover flap at the back of the seat is opened, the backrest is lowered onto its two brackets until both click, and
 * the flap is closed again. There are no loose fittings.
 */

function recipe(_s: ProductSpec): CustomParams {
  // IKEA: 29 7/8 x 40 1/2 x 37 in (76 x 103 x 94 cm), seat 49 cm high, 54 wide and 53 deep
  const W = 760, H = 1030, D = 940;
  const base = 60, armTop = 630, seatTop = 490, SW = 540;
  const armW = (W - SW) / 2;
  const by = (base + armTop) / 2;
  const BT = 220, zBack = -D / 2 + BT / 2 + 20;
  const seatZ0 = zBack + BT / 2, seatD = D / 2 - 20 - seatZ0;
  const body: PartPiece[] = [
    ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [armW, armTop - base, D], pos: [g * (W / 2 - armW / 2), 0, 0] })),
    { shape: "box", size: [SW, seatTop - base, seatD], pos: [0, (seatTop + base) / 2 - by, seatZ0 + seatD / 2] },
    { shape: "box", size: [SW, 300, BT], pos: [0, base + 150 - by, zBack] }, // the back of the seat frame, under the backrest
    { shape: "box", size: [SW - 60, base, D - 300], pos: [0, base / 2 - by, 0], material: "metal" }, // the rocker base
  ];
  const backH = H - (base + 300);
  const parts: CustomPart[] = [
    { id: "A", name: "Seat with armrests", size: [W, armTop - base, D], pos: [0, by, 0], material: "soft", pieces: body },
    { id: "B", name: "Backrest", size: [SW, backH, BT], pos: [0, base + 300 + backH / 2, zBack - 20], rot: [-0.1, 0, 0], material: "soft" },
  ];
  const brackets: Vec3[] = [-1, 1].map((g): Vec3 => [g * (SW / 2 - 60), base + 300, zBack - 20]);
  return {
    parts,
    steps: [
      {
        title: "Cut the four cable ties",
        detail: "Tip the seat forward and cut the ties that hold the mechanism for transport. Throw them away, and keep fingers clear of the mechanism.",
        add: ["A"],
        warnings: ["hand"],
      },
      { title: "Open the flap at the back", detail: "Pull the zip or hook at the back of the seat open, so the two brackets inside stand free." },
      { title: "Lift the cover up off the brackets", detail: "Fold the loose cover at the back up and over the seat, out of the way." },
      {
        title: "Lower the backrest onto the brackets",
        detail: "Hold it upright over the back of the seat and push it straight down until both brackets click into place.",
        add: ["B"],
        from: { B: [0, 400, 0] },
        fix: [{ kind: "clip", name: "Backrest bracket", count: 2, at: brackets, dir: [0, -1, 0], on: "B", included: true }],
      },
      { title: "Close the flap", detail: "Pull the cover back down over the joint and close it underneath, then sit in it and try the recline lever." },
    ],
  };
}

const family: Family = { names: ["GRYTERYD"], recipe };
export default family;

import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, ProductSpec, Vec3 } from "../../types";

/**
 * PÅHL, read from the desk underframe's manual. Upside down on a rug: four screws go into the top, set to height with
 * the plastic gauge, and the four upper legs hook onto their heads and are fixed with three screws each. The lower legs
 * push in at one of three heights. Turned over, a side rail goes between each pair of legs and four knobs lock the
 * legs at their height.
 */

function desk(s: ProductSpec): CustomParams {
  // IKEA: 96 wide, 58 deep, 59, 66 or 72 high (drawn at the lowest)
  const W = s.size.w * 10 || 960, D = s.size.d * 10 || 580, H = s.size.h * 10 || 590;
  const tt = 18, yU = H - tt; // underside of the top
  const lw = 60, ld = 45, yJoin = 300; // upper legs come down to here
  const lx = W / 2 - lw / 2, lz = D / 2 - ld / 2;
  const SX = [-1, 1] as const;
  const corners = SX.flatMap((sx) => SX.map((sz) => [sx, sz] as const));
  const ix = (sx: number, sz: number) => `${sx < 0 ? "L" : "R"}${sz < 0 ? "B" : "F"}`;
  const yRail = 330;
  const parts: CustomPart[] = [
    { id: "TOP", name: "Desk top", size: [W, tt, D], pos: [0, H - tt / 2, 0], material: "board" },
    ...corners.map(([sx, sz]): CustomPart => ({ id: `U${ix(sx, sz)}`, name: "Upper leg", size: [lw, yU - yJoin, ld], pos: [sx * lx, (yU + yJoin) / 2, sz * lz], material: "metal" })),
    ...corners.map(([sx, sz]): CustomPart => ({ id: `D${ix(sx, sz)}`, name: "Lower leg", size: [lw - 8, yJoin + 40, ld - 8], pos: [sx * lx, (yJoin + 40) / 2, sz * lz], material: "metal" })),
    ...SX.map((sx): CustomPart => ({ id: `R${sx < 0 ? "L" : "R"}`, name: "Side rail", size: [20, 50, 2 * lz - ld], pos: [sx * (lx - 6), yRail, 0], material: "metal" })),
  ];
  const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });
  const plate = (sx: number, sz: number): Vec3[] => [
    [sx * (lx - 40), yU, sz * lz],
    [sx * lx, yU, sz * (lz - 32)],
    [sx * (lx - 28), yU, sz * (lz - 26)],
  ];
  return {
    parts,
    steps: [
      {
        title: "Turn the four screws into the top",
        detail: "Lay the top face down on a rug. Hold the plastic gauge under each screw head and screw down onto it, then slide the gauge out.",
        add: ["TOP"],
        // the heads stand off the top by the gauge's thickness, for the legs' keyholes to hook onto
        fix: [at("screw", corners.map(([sx, sz]): Vec3 => [sx * (lx - 10), yU - 14, sz * (lz - 8)]), [0, 1, 0], "TOP", undefined, { len: 30, dia: 4 })],
        pose: "-y",
        warnings: ["floor"],
      },
      {
        title: "Hook the upper legs onto the screws",
        detail: "Set each leg's plate over a screw head and slide it towards the corner until it stops.",
        add: corners.map(([sx, sz]) => `U${ix(sx, sz)}`),
      },
      {
        title: "Screw the upper legs to the top",
        detail: "Three screws through each leg's plate.",
        fix: corners.map(([sx, sz]) => at("screw", plate(sx, sz), [0, 1, 0], `U${ix(sx, sz)}`, "TOP", { len: 16, dia: 4 })),
        tools: ["screwdriver"],
      },
      {
        title: "Push in the lower legs",
        detail: "Choose one of the three heights and slide each lower leg into its upper leg until the holes for that height line up.",
        add: corners.map(([sx, sz]) => `D${ix(sx, sz)}`),
      },
      {
        title: "Fit the side rails",
        detail: "Turn the desk over. Hang a rail between the front and back legs on each side.",
        add: ["RL", "RR"],
        pose: "+y",
      },
      {
        title: "Lock the legs with the knobs",
        detail: "Turn a knob through each end of the rails into the legs, by hand, until it's tight. Loosen them later to change the height.",
        fix: SX.map((sx) => at("stud", [[sx * (lx - 16), yRail, -lz + ld / 2 + 25], [sx * (lx - 16), yRail, lz - ld / 2 - 25]], [sx, 0, 0], `R${sx < 0 ? "L" : "R"}`, undefined, { name: "Knob", len: 20, dia: 40 })),
      },
    ],
  };
}

const family: Family = {
  names: ["PÅHL", "PAHL"],
  recipe: (s) => (/desk/i.test(`${s.variant} ${s.slug ?? ""}`) ? desk(s) : null),
};
export default family;

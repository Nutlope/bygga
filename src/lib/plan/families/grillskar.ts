import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * GRILLSKÄR, read from its manuals. A unit is four steel corner legs (angle profiles) bolted around a stainless
 * worktop and a steel bottom shelf. It is built lying on its back: a foot screwed into each leg, the back legs slid
 * onto the worktop and the bottom shelf, the front legs laid on top, then stood up for the last bolts. The middle
 * shelf rests on two rails hung on corner brackets. The back panel (an arched frame on a perforated sheet) drops
 * into two brackets bolted to the back legs; the side table is a stainless top on two arms, hung on hinge plates.
 */

const BOLT = { kind: "bolt" as const, len: 10, dia: 6, name: "Allen bolt" };
const LONG = { kind: "bolt" as const, len: 20, dia: 6, name: "Long Allen bolt" };
const LT = 3; // leg wall
const LS = 40; // leg flange
const FOOT = 25;
const G2 = [-1, 1] as const;

function unit(s: ProductSpec, backPanel: boolean): CustomParams {
  const W = s.size.w * 10, D = 610, H = 920;
  const top = 905; // worktop surface, under the upstand
  const X = W / 2, Z = D / 2;
  const parts: CustomPart[] = [];
  const legH = top - FOOT;
  const legPieces = (sx: number, sz: number): PartPiece[] => [
    { shape: "box", size: [LS, legH, LT], pos: [-sx * (LS / 2 - LS / 2), 0, sz * (LS / 2 - LT / 2)] },
    { shape: "box", size: [LT, legH, LS], pos: [sx * (LS / 2 - LT / 2), 0, 0] },
    { shape: "box", size: [LS - 6, 12, LS - 6], pos: [0, -legH / 2 + 6, 0] },
  ];
  const legs = [
    ["LBL", -1, -1],
    ["LBR", 1, -1],
    ["LFL", -1, 1],
    ["LFR", 1, 1],
  ] as const;
  for (const [id, sx, sz] of legs)
    parts.push({ id, name: "Leg", size: [LS, legH, LS], pos: [sx * (X - LS / 2), FOOT + legH / 2, sz * (Z - LS / 2)], pieces: legPieces(sx, sz), material: "metal" });
  const ribs = W > 700 ? [-W / 6, W / 6] : [0];
  parts.push({
    id: "T",
    name: "Worktop",
    size: [W - 2 * LT, 75, D - 2 * LT],
    pos: [0, 882.5, 0],
    pieces: [
      { shape: "box", size: [W - 2 * LT, 40, D - 2 * LT], pos: [0, 2.5, 0] },
      { shape: "box", size: [W - 2 * LT, 15, 10], pos: [0, 30, -Z + LT + 5] },
      ...ribs.map((x): PartPiece => ({ shape: "box", size: [30, 20, D - 40], pos: [x, -27.5, 0] })),
    ],
    material: "metal",
  });
  parts.push({ id: "B", name: "Bottom shelf", size: [W - 2 * LT, 30, D - 2 * LT], pos: [0, 125, 0], material: "metal" });
  const railY = 462;
  for (const [id, sx] of [["RL", -1], ["RR", 1]] as const)
    parts.push({ id, name: "Shelf rail", size: [20, 25, D - 2 * LS], pos: [sx * (X - LT - 10), railY, 0], material: "metal" });
  parts.push({ id: "S", name: "Shelf", size: [W - 2 * LT, 20, D - 2 * LS - 6], pos: [0, railY + 12.5 + 10, 0], material: "metal" });

  // every bolt goes through a leg's flange into the worktop, the bottom shelf or a bracket
  const yT = top - 25, yB = 125;
  const side = (sx: number, sz: number, y: number): Vec3 => [sx * X, y, sz * (Z - LS / 2)];
  const face = (sx: number, sz: number, y: number): Vec3 => [sx * (X - LS / 2), y, sz * Z];
  const bolts = (pts: Vec3[], dir: (p: Vec3) => Vec3, mate: string): CustomFix[] =>
    pts.map((p) => ({ ...BOLT, count: 1, at: [p], dir: dir(p), on: legAt(p), mate }));
  const legAt = (p: Vec3) => `L${p[2] < 0 ? "B" : "F"}${p[0] < 0 ? "L" : "R"}`;
  const inX = (p: Vec3): Vec3 => [p[0] < 0 ? 1 : -1, 0, 0];
  const inZ = (p: Vec3): Vec3 => [0, 0, p[2] < 0 ? 1 : -1];
  // one fix per direction, so each bolt keeps pointing in through its own leg
  const merge = (list: CustomFix[]): CustomFix[] => {
    const by = new Map<string, CustomFix[]>();
    for (const f of list) by.set(String(f.dir), [...(by.get(String(f.dir)) ?? []), f]);
    return [...by.values()].map((g) => ({ ...g[0], count: g.length, at: g.flatMap((f) => f.at!), on: undefined, mate: undefined }));
  };

  const steps: CustomStep[] = [
    {
      title: "Screw a foot into each leg",
      detail: "Lay the legs on a rug. Turn each foot into the square end by hand, most of the way in.",
      add: ["LBL", "LBR", "LFL", "LFR"],
      fix: [{ kind: "foot", count: 4, len: 30, dia: 30, at: legs.map(([, sx, sz]) => [sx * (X - LS / 2), FOOT, sz * (Z - LS / 2)] as Vec3), dir: [0, 1, 0] }],
      pose: "+z",
      warnings: ["floor", "hand"],
    },
    {
      title: "Bolt the back legs to the worktop",
      detail: "The unit is built lying on its back. One of you holds the worktop on its back edge while the other slides the two back legs onto it.",
      add: ["T"],
      fix: [...merge(bolts([side(-1, -1, yT), side(1, -1, yT)], inX, "T"))],
      tools: ["allen"],
      people: 2,
      pose: "+z",
      warnings: ["two", "floor"],
    },
    {
      title: "Bolt the bottom shelf to the back legs",
      detail: "Lower it onto the legs next to the feet, top side towards the worktop.",
      add: ["B"],
      fix: [...merge(bolts([side(-1, -1, yB), side(1, -1, yB)], inX, "B"))],
      tools: ["allen"],
      pose: "+z",
    },
    {
      title: "Lay the front legs on and bolt them",
      detail: "Feet at the bottom shelf end. Two bolts at each corner: one through the front, one through the side.",
      fix: [
        ...merge(bolts([face(-1, 1, yT), face(1, 1, yT), face(-1, 1, yB), face(1, 1, yB)], inZ, "T")),
        ...merge(bolts([side(-1, 1, yT), side(1, 1, yT), side(-1, 1, yB), side(1, 1, yB)], inX, "T")),
      ],
      tools: ["allen"],
      pose: "+z",
    },
    {
      title: "Stand it up and bolt the back",
      detail: "Turn it onto its feet, then put the last bolts through the back of the back legs.",
      fix: [...merge(bolts([face(-1, -1, yT), face(1, -1, yT), face(-1, -1, yB), face(1, -1, yB)], inZ, "T"))],
      tools: ["allen"],
      pose: "+y",
    },
    {
      title: "Hang the shelf rails on their brackets",
      detail: "Bolt a bracket into the inside corner of each leg at the height you want, then drop the rails into the slots with the open side up.",
      add: ["RL", "RR"],
      fix: [
        {
          kind: "angle",
          name: "Rail bracket",
          count: 4,
          len: 40,
          dia: 40,
          at: legs.map(([, sx, sz]) => [sx * (X - LT - 10), railY, sz * (Z - LS)] as Vec3),
          dir: [0, -1, 0],
        },
        // from outside, through each flange of the leg into the bracket
        ...G2.map((sx): CustomFix => ({ ...BOLT, count: 2, at: [-1, 1].map((sz) => [sx * X, railY, sz * (Z - LS / 2)] as Vec3), dir: [-sx, 0, 0] })),
        ...G2.map((sz): CustomFix => ({ ...BOLT, count: 2, at: [-1, 1].map((sx) => [sx * (X - LS / 2), railY, sz * Z] as Vec3), dir: [0, 0, -sz] })),
      ],
      tools: ["allen"],
      check: "square",
    },
    { title: "Lay the shelf on the rails", detail: "Slide it in at an angle, then lower it flat. It only lies one way up: the folded edges point down.", add: ["S"] },
    { title: "Level it with the feet", detail: "Put a spirit level on the worktop and turn the feet until it sits steady.", tools: ["level"] },
  ];

  if (backPanel) {
    const zP = -Z - 15;
    const yTop = 1760;
    parts.push({ id: "PB", name: "Back panel bracket", size: [LS, 160, 5], pos: [-(X - LS / 2), 900, -Z - 2.5], material: "metal" });
    parts.push({ id: "PB2", name: "Back panel bracket", size: [LS, 160, 5], pos: [X - LS / 2, 900, -Z - 2.5], material: "metal" });
    for (const [id, sx] of [["AL", -1], ["AR", 1]] as const)
      parts.push({ id, name: "Side tube", size: [20, yTop - 860, 20], pos: [sx * (X - 10), (yTop + 860) / 2, zP], shape: "cyl", material: "metal" });
    parts.push({ id: "AT", name: "Top tube", size: [W - 40, 20, 20], pos: [0, yTop - 10, zP], shape: "cyl", material: "metal" });
    parts.push({ id: "P", name: "Perforated panel", size: [W - 40, 460, 6], pos: [0, 1190, zP], material: "metal" });
    steps.push(
      {
        title: "Bolt the arch together",
        detail: "Push the top tube into the two bent side tubes and bolt each end.",
        add: ["AT", "AL", "AR"],
        fix: [{ ...BOLT, count: 2, at: [[-(X - 20), yTop - 10, zP], [X - 20, yTop - 10, zP]], dir: [0, 0, 1] }],
        tools: ["allen"],
      },
      {
        title: "Bolt the panel into the arch",
        detail: "Lay the perforated panel on a rug and lower the arch onto it. Two bolts on each side.",
        add: ["P"],
        fix: [{ ...BOLT, count: 4, at: [-1, 1].flatMap((sx) => [1020, 1360].map((y) => [sx * (X - 20), y, zP] as Vec3)), dir: [0, 0, 1] }],
        tools: ["allen"],
        warnings: ["floor"],
      },
      {
        title: "Bolt a bracket to each back leg",
        detail: "Take out the bolt at the top of the leg first; the long bolt goes back in its place, through the bracket.",
        add: ["PB", "PB2"],
        from: { PB: [0, 0, -200], PB2: [0, 0, -200] },
        // through the bracket and the leg into the worktop's back edge
        fix: G2.map((sx): CustomFix => ({ ...LONG, count: 2, at: [-12, 12].map((dx) => [sx * (X - LS / 2) + dx, yT + 20, -Z - 5] as Vec3), dir: [0, 0, 1], on: sx < 0 ? "PB" : "PB2", mate: "T" })),
        tools: ["allen"],
        repeat: 2,
      },
      {
        title: "Drop the back panel into the brackets",
        detail: "One of you holds it level while the other lowers the tubes into both brackets, then bolt it twice on each side.",
        fix: [{ ...BOLT, count: 4, at: [-1, 1].flatMap((sx) => [940, 975].map((y) => [sx * (X - 10), y, -Z - 5] as Vec3)), dir: [0, 0, -1] }],
        tools: ["allen"],
        people: 2,
        warnings: ["two"],
      },
      { title: "Hang hooks and containers on the panel", detail: "Hook each one into a slot and push it down until it sits." },
    );
  } else {
    const yJ = 300;
    steps.push({
      title: "Bolt it to the unit next to it",
      detail: "Only when it stands beside another GRILLSKÄR unit: one bolt through both legs at the front and back, with a washer and a nut held by the spanner.",
      fix: [
        { kind: "bolt", name: "Joining bolt", count: 2, len: 25, dia: 6, at: [[X, yJ, -(Z - LS / 2)], [X, yJ, Z - LS / 2]], dir: [-1, 0, 0] },
        { kind: "washer", count: 2, at: [[X - LT, yJ, -(Z - LS / 2)], [X - LT, yJ, Z - LS / 2]], dir: [-1, 0, 0] },
        { kind: "nut", count: 2, at: [[X - LT - 2, yJ, -(Z - LS / 2)], [X - LT - 2, yJ, Z - LS / 2]], dir: [-1, 0, 0] },
      ],
      tools: ["allen", "wrench"],
    });
  }
  void H;
  return { parts, steps };
}

function sideTable(): CustomParams {
  const W = 300, D = 610;
  const parts: CustomPart[] = [
    { id: "T", name: "Table top", size: [W, 20, D], pos: [0, 110, 0], material: "metal" },
    { id: "A1", name: "Arm", size: [W - 20, 50, 15], pos: [-10, 75, -(D / 2 - 20)], material: "metal" },
    { id: "A2", name: "Arm", size: [W - 20, 50, 15], pos: [-10, 75, D / 2 - 20], material: "metal" },
    { id: "H1", name: "Hinge plate", size: [5, 100, 40], pos: [W / 2 - 17.5, 50, -(D / 2 - 20)], material: "metal" },
    { id: "H2", name: "Hinge plate", size: [5, 100, 40], pos: [W / 2 - 17.5, 50, D / 2 - 20], material: "metal" },
  ];
  const steps: CustomStep[] = [
    {
      title: "Bolt the arms under the top",
      detail: "Lay the top upside down on a rug. Two bolts in each arm, the hinge ends on the same side.",
      add: ["T", "A1", "A2"],
      fix: [{ kind: "bolt", count: 4, len: 10, dia: 6, at: [-1, 1].flatMap((sz) => [-90, 60].map((x) => [x, 100, sz * (D / 2 - 20)] as Vec3)), dir: [0, 1, 0] }],
      tools: ["allen"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Take out the unit's top side bolt",
      detail: "On the GRILLSKÄR unit you're adding it to: the bolt at the top of the leg, on the side the table goes. Keep it.",
      tools: ["allen"],
      pose: "+y",
    },
    {
      title: "Bolt a hinge plate onto the leg",
      detail: "Hold the plate over the hole and put the same bolt back through it.",
      add: ["H1"],
      tools: ["allen"],
    },
    {
      title: "Do the same on the other leg",
      detail: "Front and back leg on the same side of the unit, plates at the same height.",
      add: ["H2"],
      tools: ["allen"],
    },
    {
      title: "Hang the table on the plates",
      detail: "Push the arms over the hinge plates and bolt each one with the unit's bolt. Lift the table up to use it, fold it down to save space.",
      tools: ["allen"],
      warnings: ["hand"],
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["GRILLSKÄR", "GRILLSKAR"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/side-table/.test(slug)) return sideTable();
    if (/open-kitchen-unit|kitchen-island/.test(slug)) return unit(s, /back-panel/.test(slug));
    return null;
  },
};
export default family;

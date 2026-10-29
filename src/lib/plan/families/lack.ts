import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, ProductSpec, Vec3 } from "../../types";

/**
 * LACK, read from its manuals.
 * Side, coffee and the small TV bench: the top lies upside down on a rug, four double-ended hanger bolts go in by
 * hand, the legs screw onto them. Tables with a shelf are then stood on one end, a metal strip marks where an angle
 * bracket goes on the inside of each bottom leg, and the shelf drops in between the legs onto the four brackets,
 * one screw each. The TV bench also gets a wall bracket under the top first, and is hooked onto a screw in the wall.
 * Console table: threaded studs in the side panels, nuts inside holes in the shelf, cam bolts in the top.
 * TV benches 120 and 160: legs bolted under the bottom panel, top and sides joined on cams upside down, the base
 * bolted onto the sides, two wall brackets. Wall shelf unit: seven shelves bolted through one back panel, the top
 * one through a steel plate that hangs it on the wall.
 */

type Kind = CustomFix["kind"];
const fx = (kind: Kind, at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const LEG_BOLT = { len: 70, dia: 8 }; // double-ended hanger bolt
const BOLT = { len: 90, dia: 6 }; // the long Allen bolt of the TV benches and the wall shelf
const SHELF_Y = 210; // underside of a table shelf, set by the marking strip hooked over the leg's end
const SHELF_T = 18;

/* ---------- side table, coffee table, small TV bench ---------- */

function tableRecipe(s: ProductSpec, kind: "side" | "coffee" | "tv"): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const T = W <= 400 ? 40 : 50; // the top, and the square legs as thick
  const L = T;
  const parts: CustomPart[] = [{ id: "T", name: "Table top", size: [W, T, D], pos: [0, H - T / 2, 0] }];
  const legs = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ sx, sz, x: sx * (W / 2 - L / 2), z: sz * (D / 2 - L / 2) })));
  legs.forEach((l, i) => parts.push({ id: `L${i}`, name: "Leg", size: [L, H - T, L], pos: [l.x, (H - T) / 2, l.z] }));
  const shelf = kind !== "side";
  if (shelf) parts.push({ id: "S", name: "Shelf", size: [W - 2 * L, SHELF_T, D], pos: [0, SHELF_Y + SHELF_T / 2, 0] });
  const legIds = legs.map((_, i) => `L${i}`);

  const steps: CustomStep[] = [];
  const bracketY = H - T, bracketZ = -D / 2 + 16;
  if (kind === "tv") {
    steps.push({
      title: "Screw the wall bracket under the top",
      detail: "Lay the top upside down on a rug. The bracket goes in the middle of the back edge, its upright flush with the edge.",
      add: ["T"],
      fix: [
        fx("bracket", [[0, bracketY, bracketZ]], [0, 1, 0], { on: "T" }),
        fx("screw", [-1, 1].map((sx) => [sx * 19, bracketY, -D / 2 + 28] as Vec3), [0, 1, 0], { on: "T", len: 14, dia: 4 }),
      ],
      tools: ["screwdriver"],
      pose: "-y",
      warnings: ["floor"],
    });
  }
  steps.push({
    title: "Screw the hanger bolts into the top",
    detail: kind === "tv" ? "One in each corner hole, by hand, until the collar in the middle stops at the surface." : "Lay the top upside down on a rug. One bolt in each corner hole, by hand, until the collar in the middle meets the surface.",
    add: kind === "tv" ? [] : ["T"],
    fix: [fx("legScrew", legs.map((l) => [l.x, H - T, l.z] as Vec3), [0, 1, 0], { on: "T", ...LEG_BOLT })],
    pose: "-y",
    warnings: kind === "tv" ? ["hand"] : ["floor", "hand"],
  });
  steps.push({
    title: "Screw on the legs",
    detail: "Turn each leg clockwise onto its bolt until it sits tight against the top. Hand tight is enough.",
    add: legIds,
    warnings: ["hand"],
  });
  if (!shelf) {
    steps.push({ title: "Turn it over", detail: "Lift it by the top, not by one leg, and stand it on its feet.", pose: "+y" });
    return { parts, steps };
  }

  // brackets on the inside face of each leg, just under the shelf; one screw into the leg, one up into the shelf
  const bracketsFor = (sx: number) => {
    const ls = legs.filter((l) => l.sx === sx);
    const face = sx * (W / 2 - L);
    const dir: Vec3 = [sx, 0, 0];
    // mirrored front to back, so each bracket's tab reaches in under the shelf
    const at = ls.map((l) => [face, SHELF_Y - 12, l.z - l.sz * 11] as Vec3);
    return {
      brackets: fx("angle", at, dir, { len: 44, dia: 24 }),
      screws: fx("screw", ls.map((l) => [face, SHELF_Y - 22, l.z + l.sz * 9] as Vec3), dir, { len: 16, dia: 4 }),
      up: ls.map((l) => [face - sx * 20, SHELF_Y, l.z - l.sz * 32] as Vec3),
      legs: ls.map((l) => `L${legs.indexOf(l)}`),
    };
  };
  const right = bracketsFor(1), left = bracketsFor(-1);
  const onLegs = (b: ReturnType<typeof bracketsFor>): CustomFix[] =>
    b.legs.flatMap((id, i) => [
      { ...b.brackets, count: 1, at: [b.brackets.at![i]], on: id },
      { ...b.screws, count: 1, at: [b.screws.at![i]], on: id },
    ]);
  steps.push({
    title: "Stand it on one end and mark the two bottom legs",
    detail: "Hook the metal strip over the end of a leg, hold it flat on the inside face and press the screwdriver point through its hole. Mark both legs.",
    pose: "-x",
    tools: ["screwdriver"],
    warnings: ["floor"],
  });
  steps.push({
    title: "Screw an angle bracket onto each mark",
    detail: "The bent tab points along the leg towards its end. Use the longer screws here: the short ones are for the shelf.",
    fix: onLegs(right),
    tools: ["screwdriver"],
  });
  steps.push({
    title: "Turn it onto the other end and mark those legs",
    detail: "The same as before: hook the strip over the leg's end and mark through the hole.",
    pose: "+x",
    tools: ["screwdriver"],
  });
  steps.push({ title: "Screw on the other two brackets", detail: "Longer screws again, one in each.", fix: onLegs(left), tools: ["screwdriver"] });
  steps.push(
    kind === "tv"
      ? { title: "Lay it on its back and drop the shelf in", detail: "It fits between the legs and comes to rest on the four brackets.", add: ["S"], pose: "+z", from: { S: [0, 0, 420] } }
      : { title: "Slide the shelf in between the legs", detail: "Push it in until it lies on all four brackets.", add: ["S"], from: { S: [0, 0, Math.min(700, D + 200)] } },
  );
  steps.push({
    title: "Screw the shelf to the brackets",
    detail: "One short screw up through each bracket into the shelf.",
    fix: [...left.up, ...right.up].map((p) => fx("screw", [p], [0, 1, 0], { on: "S", len: 12, dia: 3.5 })),
    tools: ["screwdriver"],
  });
  steps.push({ title: "Stand it on its legs", detail: "Lift it by the top and set it down gently.", pose: "+y" });
  if (kind === "tv") steps.push(...wallSteps([[0, bracketY - 24, -D / 2]], "the bracket"));
  return { parts, steps };
}

/** Mark through the bracket, a screw in the wall with its head left out, then the keyhole plate and the cover. */
function wallSteps(holes: Vec3[], what: string): CustomStep[] {
  const n = holes.length;
  return [
    {
      title: "Push it against the wall and mark the hole",
      detail: `Where it will stand, mark the wall through the big hole in ${what}${n > 1 ? "s" : ""}. Then move it away to drill.`,
      tools: ["pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    {
      title: n > 1 ? "Put two screws in the wall" : "Put a screw in the wall",
      detail: "Leave the head standing a few millimetres out of the wall. Screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        fx("plug", holes.map((p) => [p[0], p[1], p[2] - 25] as Vec3), [0, 0, -1], { len: 35, dia: 8 }),
        fx("screw", holes.map((p) => [p[0], p[1], p[2] + 4] as Vec3), [0, 0, -1], { len: 50, dia: 5 }),
      ],
      tools: ["drill", "screwdriver"],
      kind: "anchor",
      wall: true,
    },
    {
      title: n > 1 ? "Hook it on with the keyhole plates" : "Hook it on with the keyhole plate",
      detail: "Hang the plate on the screw head, tighten the screw, clip the plate onto the bracket and slide the cover over it.",
      fix: [
        fx("connector", holes.map((p) => [p[0], p[1] - 23, p[2] + 2] as Vec3), [0, 0, -1], { name: "Keyhole plate", len: 28, dia: 44 }),
        fx("cap", holes.map((p) => [p[0], p[1] - 10, p[2] + 30] as Vec3), [0, 0, -1], { name: "Bracket cover", len: 30, dia: 45 }),
      ],
      tools: ["screwdriver"],
      wall: true,
      warnings: ["wall", "tip"],
    },
  ];
}

/* ---------- console table ---------- */

function consoleRecipe(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const T = 50, ST = 50;
  const ys = 380; // underside of the shelf
  const ym = ys + ST / 2;
  const parts: CustomPart[] = [
    { id: "T", name: "Table top", size: [W, T, D], pos: [0, H - T / 2, 0] },
    { id: "L", name: "Side panel", size: [T, H - T, D], pos: [-W / 2 + T / 2, (H - T) / 2, 0] },
    { id: "R", name: "Side panel", size: [T, H - T, D], pos: [W / 2 - T / 2, (H - T) / 2, 0] },
    { id: "S", name: "Shelf", size: [W - 2 * T, ST, D], pos: [0, ym, 0] },
  ];
  const zs = D / 2 - 100, zd = D / 2 - 40, zc = D / 2 - 60, zt = 50;
  const sides = [
    { id: "L", sx: -1 },
    { id: "R", sx: 1 },
  ];
  const perSide = (f: (sx: number, z: number) => Vec3, zz: number, kind: Kind, dir: (sx: number) => Vec3, o: Partial<CustomFix> = {}, on?: (id: string) => string) =>
    sides.map(({ id, sx }) => fx(kind, [-1, 1].map((sz) => f(sx, sz * zz)), dir(sx), { on: on ? on(id) : id, ...o }));
  const inner = (sx: number) => sx * (W / 2 - T);
  const pocket = (sx: number) => sx * (W / 2 - T - 45);
  const steps: CustomStep[] = [
    {
      title: "Screw the threaded studs into the side panels",
      detail: "Lay both panels on a rug. Two studs in each, wood thread first, turned in with the open end of the spanner until the collar meets the panel.",
      add: ["L", "R"],
      fix: perSide((sx, z) => [inner(sx), ym, z], zs, "stud", (sx) => [sx, 0, 0], { name: "Threaded stud", len: 60, dia: 8 }),
      tools: ["wrench"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Screw the cam bolts into the top",
      detail: "Lay the top face down on the rug. Four bolts in the holes near the ends, screwed in until they stop.",
      add: ["T"],
      fix: perSide((sx, z) => [sx * (W / 2 - T / 2), H - T, z], zc, "camScrew", () => [0, 1, 0], {}, () => "T"),
      tools: ["screwdriver"],
    },
    {
      title: "Push the side panels onto the shelf",
      detail: "Tap two dowels into each panel first. The studs go through the holes in the shelf's ends and come out in the big holes.",
      add: ["S"],
      fix: perSide((sx, z) => [inner(sx), ym, z], zd, "dowel", (sx) => [sx, 0, 0], { len: 30, dia: 8 }),
      tools: ["hammer"],
    },
    {
      title: "Tighten a nut onto each stud",
      detail: "Through the big holes: put the nut on, press the plastic cover over it, then tighten with the ring end of the spanner.",
      fix: [
        ...perSide((sx, z) => [pocket(sx), ym, z], zs, "nut", (sx) => [sx, 0, 0], { len: 6, dia: 8 }, () => "S"),
        ...perSide((sx, z) => [pocket(sx) - sx * 23, ym, z], zs, "clip", (sx) => [sx, 0, 0], { name: "Nut cover", len: 12, dia: 20 }, () => "S"),
      ],
      tools: ["wrench"],
    },
    {
      title: "Lower the sides onto the top",
      detail: "Tap two dowels into the top edge of each side panel, then set the frame down so the cam bolts and dowels find their holes.",
      fix: perSide((sx, z) => [sx * (W / 2 - T / 2), H - T, z], zt, "dowel", () => [0, -1, 0], { len: 30, dia: 8 }),
      tools: ["hammer"],
    },
    {
      title: "Turn the cam locks",
      detail: "Two in the inside of each side panel, next to the top. Arrow towards the bolt, then turn clockwise until tight.",
      fix: perSide((sx, z) => [inner(sx), H - T - 22, z], zc, "cam", (sx) => [sx, 0, 0], { dia: 15 }),
      tools: ["screwdriver"],
    },
    {
      title: "Cap the holes and stick on the felt pads",
      detail: "The caps press into the big holes in the shelf. One felt pad near each end of the side panels' free edges.",
      fix: [
        fx("cap", sides.flatMap(({ sx }) => [-1, 1].map((sz) => [pocket(sx), ys, sz * zs] as Vec3)), [0, 1, 0], { on: "S", name: "Cover cap", len: 10, dia: 35 }),
        ...perSide((sx, z) => [sx * (W / 2 - T / 2), 0, z], D / 2 - 40, "glide", () => [0, 1, 0], { len: 4, dia: 20 }),
      ],
    },
    { title: "Turn it over", detail: "Lift it by both side panels and stand it the right way up.", pose: "+y" },
  ];
  return { parts, steps };
}

/* ---------- TV benches 120 and 160 ---------- */

function benchRecipe(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const T = 50, L = 50;
  const LH = H - 255; // legs under a 50 mm bottom, 155 mm sides and a 50 mm top
  const yB = LH, yS = LH + T, yT = H - T;
  const mid = W >= 1400; // the 160 has a fifth leg and a divider in the middle
  const parts: CustomPart[] = [];
  const legs = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ x: sx * (W / 2 - L / 2), z: sz * (D / 2 - L / 2) })));
  if (mid) legs.push({ x: 0, z: 0 });
  legs.forEach((l, i) => parts.push({ id: `G${i}`, name: "Leg", size: [L, LH, L], pos: [l.x, LH / 2, l.z] }));
  parts.push({ id: "B", name: "Bottom panel", size: [W, T, D], pos: [0, yB + T / 2, 0] });
  const sh = yT - yS;
  parts.push({ id: "SL", name: "Side panel", size: [T, sh, D], pos: [-W / 2 + T / 2, yS + sh / 2, 0] });
  parts.push({ id: "SR", name: "Side panel", size: [T, sh, D], pos: [W / 2 - T / 2, yS + sh / 2, 0] });
  if (mid) parts.push({ id: "V", name: "Divider", size: [T, sh, 200], pos: [0, yS + sh / 2, 0] });
  parts.push({ id: "T", name: "Top panel", size: [W, T, D], pos: [0, H - T / 2, 0] });
  const sides = [
    { id: "SL", sx: -1 },
    { id: "SR", sx: 1 },
  ];
  const corners = (zz: number, x: (sx: number) => number, y: number) => sides.flatMap(({ sx }) => [-1, 1].map((sz) => [x(sx), y, sz * zz] as Vec3));
  const xSide = (sx: number) => sx * (W / 2 - T / 2);
  const zc = D / 2 - 60;
  const brackets = [-1, 1].map((sx) => sx * (W / 2 - T - 30));

  const steps: CustomStep[] = [
    {
      title: "Tap a dowel into each leg",
      detail: "Into the small hole in the top end. The bigger hole is for the bolt.",
      add: legs.map((_, i) => `G${i}`),
      fix: legs.map((l, i) => fx("dowel", [[l.x + 12, yB, l.z + 12]], [0, -1, 0], { on: `G${i}`, len: 30, dia: 8 })),
      tools: ["hammer"],
    },
    {
      title: "Bolt the legs under the bottom panel",
      detail: "Set the panel on the legs so the dowels find their holes, then one bolt down through the panel into each leg.",
      add: ["B"],
      fix: [fx("bolt", legs.map((l) => [l.x - 8, yS, l.z - 8] as Vec3), [0, -1, 0], { on: "B", ...BOLT })],
      tools: ["allen"],
    },
  ];
  if (mid) {
    steps.push(
      {
        title: "Tap two dowels into the divider",
        detail: "Into the holes in one long edge. That edge goes up against the top later.",
        fix: [fx("dowel", [-50, 50].map((z) => [0, yT, z] as Vec3), [0, -1, 0], { on: "V", len: 30, dia: 8 })],
        tools: ["hammer"],
      },
      {
        title: "Turn the base on its back and set the divider on it",
        detail: "In the middle of the bottom panel, plain edge down, its dowels pointing away from the panel.",
        add: ["V"],
        pose: "+z",
      },
      {
        title: "Bolt the divider on from underneath",
        detail: "One bolt through the bottom panel into the divider.",
        fix: [fx("bolt", [[0, yB, -60]], [0, 1, 0], { on: "B", mate: "V", ...BOLT })],
        tools: ["allen"],
      },
    );
  }
  steps.push(
    {
      title: "Screw the cam bolts into the top",
      detail: "Lay the top face down on a rug. Four bolts in the holes near the ends.",
      add: ["T"],
      fix: [fx("camScrew", corners(zc, xSide, yT), [0, 1, 0], { on: "T" })],
      tools: ["screwdriver"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Set the side panels on the cam bolts",
      detail: "One at each end, the cam holes facing in.",
      add: ["SL", "SR"],
    },
    {
      title: "Turn the cam locks",
      detail: "Arrow towards the bolt, then turn each one clockwise until the side pulls tight against the top.",
      fix: sides.map(({ id, sx }) => fx("cam", [-1, 1].map((sz) => [sx * (W / 2 - T), yT - 22, sz * zc] as Vec3), [sx, 0, 0], { on: id, dia: 15 })),
      tools: ["flathead"],
    },
    {
      title: "Screw the wall brackets under the top",
      detail: "One just inside each side panel at the back, the upright flush with the back edge. Two screws in each.",
      fix: [
        fx("bracket", brackets.map((x) => [x, yT, -D / 2 + 16] as Vec3), [0, 1, 0], { on: "T" }),
        fx("screw", brackets.flatMap((x) => [-1, 1].map((d) => [x + d * 19, yT, -D / 2 + 28] as Vec3)), [0, 1, 0], { on: "T", len: 14, dia: 4 }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Bolt the base onto the sides",
      detail: mid ? "Turn the base legs up and lower it on, the divider's dowels into the top. Two bolts through the bottom into each side." : "Turn the base legs up and lower it onto the side panels. Two bolts through the bottom into each side.",
      fix: [fx("bolt", corners(D / 2 - 90, xSide, yB), [0, 1, 0], { ...BOLT })],
      tools: ["allen"],
    },
    { title: "Stand it on its legs", detail: "Turn it over and set it down where it will stand.", pose: "+y" },
    ...wallSteps(brackets.map((x) => [x, yT - 24, -D / 2] as Vec3), "the bracket"),
  );
  return { parts, steps };
}

/* ---------- wall shelf unit ---------- */

/**
 * The manual's upright way (as IKEA's photo shows it): seven shelves bolted through one back panel; the six lower
 * ones with the panel on its long edge, then the top one through a steel plate laid across the back, which sticks
 * up above the top and is screwed to the wall through two holes. The other two plates and the small screws are
 * for hanging it lying down instead.
 */
function wallShelfRecipe(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const PT = 40, ST = 40, n = 7;
  const back = -D / 2;
  const ys = Array.from({ length: n }, (_, i) => ST / 2 + ((H - ST) * i) / (n - 1));
  const parts: CustomPart[] = [{ id: "P", name: "Back panel", size: [W, H, PT], pos: [0, H / 2, back + PT / 2] }];
  ys.forEach((y, i) => parts.push({ id: `S${i}`, name: "Shelf", size: [W, ST, D - PT], pos: [0, y, back + PT + (D - PT) / 2] }));
  const plateH = 60, plateY = H - 5;
  parts.push({ id: "M", name: "Hanging plate", size: [W - 60, plateH, 2], pos: [0, plateY, back - 1], material: "metal" });
  const bx = W / 2 - 70;
  const steps: CustomStep[] = [
    {
      title: "Bolt six shelves to the back panel",
      detail: "Stand the panel on its long edge on a rug and the shelves on their ends against it. Two bolts through the panel into each shelf, leaving the two holes at one end free.",
      add: ["P", ...ys.slice(0, n - 1).map((_, i) => `S${i}`)],
      fix: [fx("bolt", ys.slice(0, n - 1).flatMap((y) => [-1, 1].map((sx) => [sx * bx, y, back] as Vec3)), [0, 0, 1], { on: "P", ...BOLT })],
      tools: ["allen"],
      pose: "+x",
      warnings: ["floor"],
    },
    {
      title: "Bolt on the top shelf through a hanging plate",
      detail: "Turn it over so the panel lies on top. Stand the last shelf under the free end, lay one plate across the panel with its holes sticking out past the end, and bolt through both slots. The other plates and small screws are for hanging it lying down.",
      add: ["S6", "M"],
      fix: [fx("bolt", [-1, 1].map((sx) => [sx * (bx + 20), ys[n - 1], back - 2] as Vec3), [0, 0, 1], { on: "M", mate: "S6", ...BOLT })],
      tools: ["allen"],
      pose: "-z",
      from: { M: [0, 0, -200] },
    },
    {
      title: "Hang it on the wall together",
      detail: "Hold it against the wall, check it is straight with a level and mark through the two holes in the plate. Drill, then screw it up. Screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        fx("plug", [-1, 1].map((sx) => [sx * 60, H + 12, back - 2 - 25] as Vec3), [0, 0, -1], { len: 35, dia: 8 }),
        fx("screw", [-1, 1].map((sx) => [sx * 60, H + 12, back] as Vec3), [0, 0, -1], { len: 50, dia: 5 }),
      ],
      tools: ["pencil", "level", "drill", "screwdriver"],
      pose: "+y",
      people: 2,
      kind: "anchor",
      wall: true,
      warnings: ["wall", "two"],
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["LACK"],
  recipe(s) {
    const v = s.variant.toLowerCase();
    if (/^wall shelf unit/.test(v) && s.size.h > 2 * s.size.w) return wallShelfRecipe(s);
    if (/^console table/.test(v)) return consoleRecipe(s);
    if (/^tv bench/.test(v)) return s.size.w >= 110 ? benchRecipe(s) : tableRecipe(s, "tv");
    if (/^coffee table/.test(v)) return tableRecipe(s, "coffee");
    if (/^side table/.test(v)) return tableRecipe(s, "side");
    return null;
  },
};
export default family;

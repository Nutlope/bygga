import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, ProductSpec, Vec3 } from "../../types";

/**
 * TREASJÖN, read from its two manuals (the cabinet, then the light). Two wall hangers are screwed under the top,
 * cam bolts go into the top and bottom and dowels into the sides; the sides stand on the bottom, the top goes on and
 * eight cam locks pull it tight. The back slides into its grooves and is held by plastic rivets. The cabinet hangs on
 * two wall screws with spacers, the hangers are adjusted and covered, the mirror doors go on their hinges and the
 * glass shelves on pins. Last the light slides onto the top and is screwed down, its driver box sits behind it and
 * the cover clicks on; an electrician connects it to the mains.
 */

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 80 wide, 75 high, 17 deep
  const W = s.size.w * 10 || 800, H = s.size.h * 10 || 750, D = s.size.d * 10 || 170;
  const t = 16, body = H - 30, door = 18;
  const Dc = D - door, zc = -door / 2; // the carcass, the doors in front of it
  const zB = zc - Dc / 2, zF = zc + Dc / 2;
  const xIn = W / 2 - t, xS = W / 2 - t / 2;
  const yLo = t, yHi = body - t;
  const zBack = zB + 12;
  const panel = (id: string, name: string, size: Vec3, pos: Vec3, material: CustomPart["material"] = "board"): CustomPart => ({ id, name, size, pos, material });
  const shelfYs = [250, 480];
  const parts: CustomPart[] = [
    panel("B", "Bottom panel", [W, t, Dc], [0, t / 2, zc]),
    panel("T", "Top panel", [W, t, Dc], [0, body - t / 2, zc]),
    panel("L", "Side panel", [t, yHi - yLo, Dc], [-xS, (yLo + yHi) / 2, zc]),
    panel("R", "Side panel", [t, yHi - yLo, Dc], [xS, (yLo + yHi) / 2, zc]),
    panel("K", "Back panel", [2 * xIn, yHi - yLo, 3], [0, (yLo + yHi) / 2, zBack], "fiber"),
    ...shelfYs.map((y, i) => panel(`G${i + 1}`, "Glass shelf", [2 * xIn - 4, 6, Dc - 30], [0, y + 3, zc + 5], "glass")),
    ...[-1, 1].map((sx, i) => panel(`D${i + 1}`, "Mirror door", [W / 2 - 2, body - 2, door], [(sx * W) / 4, body / 2, zF + door / 2], "glass")),
    panel("LB", "Light", [W, 22, 70], [0, body + 11, D / 2 - 35], "metal"),
    panel("X", "Driver box", [180, 28, 60], [W / 4, body + 14, zB + 40], "metal"),
    panel("LC", "Light cover", [W, 8, 70], [0, body + 26, D / 2 - 35], "glass"),
  ];
  const corners = (y: number): Vec3[] => [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xS, y, zc + sz * (Dc / 2 - 35)]));
  const hangers: Vec3[] = [-1, 1].map((sx): Vec3 => [sx * (xIn - 30), yHi, zB + 25]);
  const camAt = (sx: number): Vec3[] => [yLo + 30, yHi - 30].flatMap((y) => [-1, 1].map((sz): Vec3 => [sx * xIn, y, zc + sz * (Dc / 2 - 35)]));
  const rivets: Vec3[] = [
    ...[-250, 250].flatMap((x) => [yLo + 8, yHi - 8].map((y): Vec3 => [x, y, zBack - 2])),
    ...[-1, 1].flatMap((sx) => shelfYs.map((y): Vec3 => [sx * (xIn - 8), y, zBack - 2])),
  ];
  const wall = zB - 2;
  return {
    parts,
    steps: [
      {
        title: "Screw the wall hangers under the top",
        detail: "Lay the top and bottom on a rug. A hanger goes in each back corner of the top, two screws each. Stick the two bumper pads on the back edge of the bottom.",
        fix: [
          { kind: "angle", name: "Wall hanger", count: 2, at: hangers, dir: [0, 1, 0], on: "T" },
          { kind: "screw", count: 4, len: 12, dia: 4, at: hangers.flatMap((p) => [-24, 24].map((dx): Vec3 => [p[0] + dx, yHi, p[2]])), dir: [0, 1, 0], on: "T" },
          { kind: "glide", name: "Bumper pad", count: 2, at: [-1, 1].map((sx): Vec3 => [sx * (W / 2 - 60), t / 2, zB]), dir: [0, 0, 1], on: "B" },
        ],
        wait: ["T", "B"],
        warnings: ["floor"],
      },
      {
        title: "Screw the cam bolts into the top and bottom",
        detail: "Four in each panel, near the ends. Screw them in until they stop.",
        fix: [
          { kind: "camScrew", count: 4, at: corners(yLo), dir: [0, -1, 0], on: "B", mate: "L" },
          { kind: "camScrew", count: 4, at: corners(yHi), dir: [0, 1, 0], on: "T", mate: "L" },
        ],
      },
      {
        title: "Tap a dowel into each end of the sides",
        detail: "One dowel in the middle of each end, four in all.",
        fix: [-1, 1].flatMap((sx): CustomFix[] => [
          { kind: "dowel", count: 1, at: [[sx * xS, yLo, zc]], dir: [0, 1, 0], on: sx < 0 ? "L" : "R", mate: "B" },
          { kind: "dowel", count: 1, at: [[sx * xS, yHi, zc]], dir: [0, -1, 0], on: sx < 0 ? "L" : "R", mate: "T" },
        ]),
        wait: ["L", "R"],
        tools: ["hammer"],
      },
      { title: "Stand the sides on the bottom", detail: "Push each side down so the cam bolts and the dowel go into its holes.", add: ["B", "L", "R"] },
      { title: "Put the top on", detail: "Press it down onto the sides, hangers at the back.", add: ["T"] },
      {
        title: "Turn the cam locks",
        detail: "Eight in all, in the sides by the corners. Arrow towards the bolt, then turn each one until it pulls tight.",
        fix: [-1, 1].map((sx): CustomFix => ({ kind: "cam", count: 4, at: camAt(sx), dir: [sx, 0, 0], on: sx < 0 ? "L" : "R" })),
      },
      {
        title: "Slide the back panel in",
        detail: "Lay the cabinet on its front and slide the back along the grooves in the sides, shiny side in.",
        add: ["K"],
        pose: "-z",
        warnings: ["floor"],
      },
      {
        title: "Push the rivets through the back",
        detail: "Push each rivet into its hole, then tap its pin in to spread it. Eight in all.",
        fix: [{ kind: "clip", name: "Plastic rivet", count: 8, at: rivets, dir: [0, 0, 1], on: "K" }],
      },
      {
        title: "Mark the wall",
        detail: "Hold the cabinet against the wall, level it, and mark through the two hangers.",
        pose: "+y",
        tools: ["level", "pencil"],
        people: 2,
      },
      {
        title: "Fit the wall screws with spacers",
        detail: "Drill, plug and turn in a screw at each mark with a spacer on it, leaving 25 mm standing out. Wall screws and plugs aren't included: pick ones made for your wall.",
        fix: [
          { kind: "plug", count: 2, at: hangers.map((p): Vec3 => [p[0], p[1] - 20, wall - 40]), dir: [0, 0, -1] },
          { kind: "screw", count: 2, len: 50, dia: 5, at: hangers.map((p): Vec3 => [p[0], p[1] - 20, wall + 30]), dir: [0, 0, -1] },
          { kind: "washer", name: "Spacer", count: 2, at: hangers.map((p): Vec3 => [p[0], p[1] - 20, wall + 5]), dir: [0, 0, -1] },
        ],
        tools: ["drill", "screwdriver"],
        wall: true,
        warnings: ["wall"],
      },
      {
        title: "Hang the cabinet and adjust it",
        detail: "Lift it onto the screws, clip a plate onto each hanger and turn the hanger screws until it hangs level and tight to the wall.",
        fix: [{ kind: "clip", name: "Hanger plate", count: 2, at: hangers.map((p): Vec3 => [p[0], p[1] - 30, p[2] + 10]), dir: [0, 0, -1], on: "T" }],
        tools: ["screwdriver"],
        people: 2,
      },
      {
        title: "Clip the covers over the hangers",
        detail: "One in each top corner.",
        fix: [{ kind: "cap", name: "Hanger cover", count: 2, at: hangers.map((p): Vec3 => [p[0], p[1] - 30, p[2] + 25]), dir: [0, 0, -1], on: "T" }],
      },
      {
        title: "Screw the hinges onto the doors",
        detail: "Two hinges on each door, on the edge that will sit at the side of the cabinet.",
        fix: [
          ...[-1, 1].map((sx, i): CustomFix => ({
            kind: "hinge",
            count: 2,
            at: [100, body - 100].map((y): Vec3 => [sx * (xIn - 30), y, zF]),
            dir: [0, 0, 1],
            on: `D${i + 1}`,
            mate: sx < 0 ? "L" : "R",
          })),
        ],
        wait: ["D1", "D2"],
      },
      {
        title: "Hang the doors",
        detail: "Hook each hinge onto its plate in the side and press until it clicks.",
        add: ["D1", "D2"],
      },
      {
        title: "Push in the shelf pins",
        detail: "Four for each shelf, at the same height on both sides.",
        fix: [{ kind: "pin", count: 8, at: [-1, 1].flatMap((sx) => shelfYs.flatMap((y) => [-1, 1].map((sz): Vec3 => [sx * xIn, y, zc + 5 + sz * (Dc / 2 - 40)]))), dir: [-1, 0, 0] }],
      },
      { title: "Lay in the glass shelves", detail: "Lower each one onto its four pins.", add: ["G1", "G2"] },
      {
        title: "Slide the light onto the top",
        detail: "Push it on from the side along the top's front edge, then fix it with two screws.",
        add: ["LB"],
        fix: [{ kind: "screw", count: 2, len: 12, dia: 4, at: [-1, 1].map((sx): Vec3 => [sx * (W / 2 - 60), body, D / 2 - 50]), dir: [0, -1, 0], on: "LB", mate: "T" }],
      },
      {
        title: "Set the driver box behind it",
        detail: "Plug the light's cable into the box and press the cable into its clips along the top.",
        add: ["X"],
      },
      { title: "Click the cover onto the light", detail: "Press it down along its length until it clicks.", add: ["LC"] },
      {
        title: "Have it connected to the mains",
        detail: "The driver box is wired to a wall connection. Leave this to a qualified electrician, then adjust the doors with the hinge screws until the gaps are even.",
        tools: ["screwdriver"],
      },
    ],
  };
}

const family: Family = { names: ["TREASJÖN", "TREASJON"], recipe };
export default family;

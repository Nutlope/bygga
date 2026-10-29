import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * SÅGMÄSTARE, read from the shelving unit's and the cabinet's manuals. It is all powder-coated steel: turned legs
 * and round posts are joined by threaded studs that pass through the holes in the corners of each shelf, so every
 * level is a shelf lowered onto the studs and the next posts screwed on top. The top shelf is held by four screws.
 * The cabinet's lower part is a box (bottom, fluted sides, two back panels, a top) built lying on its front, with two
 * pairs of folding doors on pivot pins. Both are fixed to the wall with two clip-on brackets at the back posts.
 */

const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });
const box = (size: Vec3, pos: Vec3): PartPiece => ({ shape: "box", size, pos });
const cyl = (dia: number, len: number, pos: Vec3): PartPiece => ({ shape: "cyl", size: [dia, len, dia], pos });
const SIDES = [-1, 1] as const;

// IKEA: 83.2 wide, 36.2 deep, 127.5 high, 33 cm free under the cabinet
const W = 832, D = 362, H = 1275, PT = 20, LEG_H = 330;
const XP = W / 2 - 22, ZP = D / 2 - 22; // legs and posts
const CORNERS: [number, number][] = [[-1, 1], [1, 1], [-1, -1], [1, -1]];
const cornerAt = ([sx, sz]: [number, number], y: number): Vec3 => [sx * XP, y, sz * ZP];

function leg(i: number): CustomPart {
  const [sx, sz] = CORNERS[i];
  const c = LEG_H / 2;
  return {
    id: `L${i}`,
    name: "Leg",
    size: [46, LEG_H, 46],
    pos: [sx * XP, c, sz * ZP],
    material: "metal",
    shape: "cyl",
    pieces: [cyl(24, 190, [0, 95 - c, 0]), cyl(44, 40, [0, 210 - c, 0]), cyl(32, 50, [0, 255 - c, 0]), cyl(46, 20, [0, 290 - c, 0]), cyl(30, 30, [0, 315 - c, 0])],
  };
}
const plate = (id: string, name: string, yTop: number, w = W, d = D): CustomPart => ({ id, name, size: [w, PT, d], pos: [0, yTop - PT / 2, 0], material: "metal" });
const posts = (level: string, y0: number, y1: number): CustomPart[] =>
  CORNERS.map((c, i): CustomPart => ({ id: `${level}${i}`, name: "Post", shape: "cyl", size: [22, y1 - y0, 22], pos: cornerAt(c, (y0 + y1) / 2), material: "metal" }));
const ids = (level: string) => CORNERS.map((_, i) => `${level}${i}`);

const legSteps = (): CustomStep[] => [
  {
    title: "Screw a foot and a stud into each leg",
    detail: "The foot goes into the thin end, the threaded stud into the thick end. Both by hand, until they stop.",
    add: ids("L"),
    wait: ids("L"),
    fix: [at("foot", CORNERS.map((c) => cornerAt(c, 0)), [0, 1, 0], undefined, undefined, { len: 14, dia: 26 }), at("stud", CORNERS.map((c) => cornerAt(c, LEG_H)), [0, 1, 0], undefined, undefined, { len: 30, dia: 8 })],
  },
];
/** Studs into the top ends of four posts, which then stand on the studs below. */
const postStep = (level: string, yTop: number, word: string): CustomStep => ({
  title: `Screw a stud into the top of the ${word} posts`,
  detail: "Into one end of each post, by hand until it stops. That end points up.",
  add: ids(level),
  wait: ids(level),
  fix: [at("stud", CORNERS.map((c) => cornerAt(c, yTop)), [0, 1, 0], undefined, undefined, { len: 30, dia: 8 })],
});
/** The cabinet's posts take their studs in the bottom end and screw down into the cabinet top; the top shelf is screwed to their tops. */
const postStepDown = (level: string, yBot: number, word: string): CustomStep => ({
  title: `Screw a stud into the end of the ${word} posts`,
  detail: "Into one end of each post, by hand until it stops. That end goes down.",
  add: ids(level),
  wait: ids(level),
  fix: [at("stud", CORNERS.map((c) => cornerAt(c, yBot)), [0, 1, 0], undefined, undefined, { len: 30, dia: 8 })],
});
const screwPosts = (level: string, title: string): CustomStep => ({
  title,
  detail: "Turn each post onto a stud through the shelf until it's tight against it.",
  add: ids(level),
});
const topSteps = (topId: string): CustomStep[] => [
  { title: "Lay the top shelf on", detail: "Countersunk side of the holes up, so the screw heads sit flush.", add: [topId] },
  {
    title: "Screw the top shelf to the posts",
    detail: "One screw down into each post.",
    fix: [at("screw", CORNERS.map((c) => cornerAt(c, H)), [0, -1, 0], topId, undefined, { len: 12, dia: 6 })],
    tools: ["screwdriver"],
  },
];
function wallSteps(yB: number, backs: string[]): CustomStep[] {
  const pts: Vec3[] = SIDES.map((sx): Vec3 => [sx * XP, yB, -ZP - 14]);
  const wall: Vec3[] = pts.map((p): Vec3 => [p[0] + 30 * Math.sign(p[0]), p[1], -D / 2 - 6]);
  return [
    {
      title: "Clip the wall brackets onto the back posts",
      detail: "Just under the top shelf, the flat end pointing back. Stick a felt pad inside each so it doesn't scratch the post.",
      fix: SIDES.map((sx, i) => at("bracket", [pts[i]], [0, 0, 1], backs[i], undefined, { name: "Wall bracket", len: 50, dia: 30 })),
    },
    { title: "Level it with the feet", detail: "Stand it against the wall and turn the feet until it stands level and steady.", tools: ["level"] },
    {
      title: "Screw the brackets to the wall",
      detail: "One screw through each bracket. Over a skirting board, put a spacer behind each bracket. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [at("plug", wall.map((p): Vec3 => [p[0], p[1], p[2] - 34]), [0, 0, -1], undefined, undefined, { len: 35, dia: 8 }), at("screw", wall, [0, 0, -1], undefined, undefined, { len: 50, dia: 5 })],
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
  ];
}

function shelving(): CustomParams {
  const yS = [LEG_H + PT, 665, 970, H];
  const parts: CustomPart[] = [
    ...CORNERS.map((_, i) => leg(i)),
    ...posts("P", yS[0], yS[1] - PT),
    plate("S1", "Shelf", yS[0]),
    plate("S2", "Shelf", yS[1]),
    ...posts("Q", yS[1], yS[2] - PT),
    plate("S3", "Shelf", yS[2]),
    ...posts("R", yS[2], yS[3] - PT),
    plate("T", "Top shelf", yS[3]),
  ];
  const steps: CustomStep[] = [
    ...legSteps(),
    postStep("P", yS[1] - PT, "four lowest"),
    {
      title: "Screw the legs and posts onto the bottom shelf",
      detail: "Countersunk side of the holes up. Each leg's stud goes through a corner hole and a post is turned onto it from the other side.",
      add: ["S1", ...ids("L"), ...ids("P")],
      pose: "+z",
      warnings: ["floor"],
    },
    { title: "Lower the next shelf onto the studs", detail: "Stand it up first. Countersunk side of the holes up.", add: ["S2"], pose: "+y" },
    postStep("Q", yS[2] - PT, "next four"),
    screwPosts("Q", "Screw the posts onto the studs"),
    { title: "Lower the third shelf onto the studs", detail: "Countersunk side of the holes up.", add: ["S3"] },
    screwPosts("R", "Screw the last four posts on"),
    ...topSteps("T"),
    ...wallSteps(yS[3] - 60, ["R2", "R3"]),
  ];
  return { parts, steps };
}

function cabinet(): CustomParams {
  const yB = LEG_H + PT; // top of the bottom plate
  const yC = 950; // top of the cabinet's own top
  const yIn = yC - PT; // inside height ends here
  const hS = yIn - yB;
  const xs = W / 2 - 11;
  const side = (sx: number): CustomPart => ({
    id: sx < 0 ? "SL" : "SR",
    name: "Side panel",
    size: [22, hS, D],
    pos: [sx * xs, yB + hS / 2, 0],
    material: "metal",
    pieces: [...SIDES.map((sz) => cyl(22, hS, [0, 0, sz * ZP])), box([6, hS - 40, 2 * ZP - 22], [0, 0, 0]), ...[-150, -75, 0, 75, 150].map((z) => box([10, hS - 80, 8], [0, 0, z]))],
  });
  const backW = XP;
  const back = (sx: number): CustomPart => ({ id: sx < 0 ? "K1" : "K2", name: "Back panel", size: [backW, hS, 8], pos: [(sx * backW) / 2, yB + hS / 2, -ZP], material: "metal" });
  const leafW = (2 * XP - 22 - 12) / 4;
  const xLeaf = (k: number) => -XP + 11 + 2 + leafW / 2 + k * (leafW + 4);
  const zDoor = D / 2 - 10;
  const leaf = (k: number): CustomPart => ({
    id: `D${k}`,
    name: "Door leaf",
    size: [leafW, hS - 12, 18],
    pos: [xLeaf(k), yB + hS / 2, zDoor],
    material: "metal",
    pieces: [box([leafW, hS - 12, 6], [0, 0, -6]), ...[-0.3, -0.1, 0.1, 0.3].map((f) => box([8, hS - 80, 10], [f * leafW, 0, 2])), box([leafW, 30, 18], [0, (hS - 12) / 2 - 15, 0]), box([leafW, 30, 18], [0, -(hS - 12) / 2 + 15, 0])],
  });
  const yShelf = yB + Math.round(hS / 2);
  const parts: CustomPart[] = [
    ...CORNERS.map((_, i) => leg(i)),
    plate("B", "Bottom", yB),
    { id: "RB", name: "Door rail", size: [2 * XP - 22, 8, 14], pos: [0, yB + 4, zDoor], material: "metal" },
    side(-1),
    side(1),
    back(-1),
    back(1),
    plate("C", "Cabinet top", yC),
    { id: "RT", name: "Door rail", size: [2 * XP - 22, 8, 14], pos: [0, yIn - 4, zDoor], material: "metal" },
    ...posts("P", yC, H - PT),
    plate("T", "Top shelf", H),
    plate("M", "Shelf", yShelf + PT / 2, 2 * xs - 22, 2 * ZP - 30),
    ...[0, 1, 2, 3].map(leaf),
  ];
  const leftLegs = ["L0", "L2"], rightLegs = ["L1", "L3"];
  const yHinge = [yB + 60, yIn - 60];
  const hingeScrews = (k: number) =>
    at("hinge", yHinge.map((y): Vec3 => [xLeaf(k) + leafW / 2 + 2, y, zDoor - 9]), [0, 0, 1], `D${k}`, `D${k + 1}`, { len: 40, dia: 30 });
  const steps: CustomStep[] = [
    ...legSteps(),
    {
      title: "Press the door rails into the bottom and the cabinet top",
      detail: "One rail along the front of each, pressed into the groove until it clicks in all along. Put the cabinet top aside for now.",
      add: ["B", "RB"],
    },
    {
      title: "Screw two legs through the bottom into a side panel",
      detail: "Lay the parts on a rug, the cabinet lying on its front. Each leg's stud goes through a corner hole of the bottom into the side's post.",
      add: ["SL", ...leftLegs],
      pose: "-z",
      warnings: ["floor"],
    },
    { title: "Fit the other side panel the same way", detail: "Two more legs through the bottom into its posts.", add: ["SR", ...rightLegs] },
    { title: "Lay the two back panels in", detail: "They sit in the grooves of the sides and the bottom, meeting in the middle.", add: ["K1", "K2"] },
    {
      title: "Screw the back panels on",
      detail: "Eight screws: two into each side and two into the bottom on each panel.",
      fix: [
        ...SIDES.map((sx) => at("screw", [yB + 120, yIn - 120].map((y): Vec3 => [sx * (xs - 14), y, -ZP - 4]), [0, 0, 1], sx < 0 ? "K1" : "K2", sx < 0 ? "SL" : "SR", { len: 10, dia: 4 })),
        ...SIDES.map((sx) => at("screw", [sx * 120, sx * 300].map((x): Vec3 => [x, yB + 6, -ZP - 4]), [0, 0, 1], sx < 0 ? "K1" : "K2", "B", { len: 10, dia: 4 })),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw two brackets under the cabinet top",
      detail: "Near the back edge, two small screws in each. They hold the top edge of the back panels.",
      fix: [-1, 1].map((sx) => at("angle", [[sx * 150, yIn, -ZP + 12]], [0, 1, 0], "C", undefined, { name: "Back bracket", len: 40, dia: 24 })).concat(
        [at("screw", [-170, -130, 130, 170].map((x): Vec3 => [x, yIn, -ZP + 12]), [0, 1, 0], "C", undefined, { len: 8, dia: 4 })],
      ),
      add: ["C", "RT"],
      wait: ["C", "RT"],
      tools: ["screwdriver"],
      pose: "+y",
    },
    { title: "Press the cabinet top on", detail: "Stand the cabinet up. The brackets go behind the back panels and the corner holes over the posts.", add: ["C", "RT"] },
    postStepDown("P", yC, "four"),
    screwPosts("P", "Screw the posts on through the cabinet top"),
    ...topSteps("T"),
    { title: "Lay the shelf in", detail: "Press it down onto the four supports inside the sides until it clicks.", add: ["M"], from: { M: [0, 0, 300] } },
    {
      title: "Join the door leaves with the hinges",
      detail: "Lay two leaves face down side by side. Two hinges join each pair, four small screws in every hinge.",
      add: ["D0", "D1", "D2", "D3"],
      wait: ["D0", "D1", "D2", "D3"],
      fix: [hingeScrews(0), hingeScrews(2), at("screw", [0, 2].flatMap((k) => yHinge.flatMap((y) => [-1, 1].flatMap((s) => [-12, 12].map((dy): Vec3 => [xLeaf(k) + leafW / 2 + 2 + s * 14, y + dy, zDoor - 9])))), [0, 0, 1], undefined, undefined, { len: 6, dia: 3 })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw a pivot into each outer leaf",
      detail: "One screw with a washer into the bottom corner of each outer leaf, on the hinged side.",
      // the screw first: the engine stacks a washer onto the screw already at its point
      fix: [at("screw", [[xLeaf(0) - leafW / 2 + 20, yB + 6, zDoor]], [0, 1, 0], "D0", undefined, { len: 16, dia: 4 }), at("screw", [[xLeaf(3) + leafW / 2 - 20, yB + 6, zDoor]], [0, 1, 0], "D3", undefined, { len: 16, dia: 4 }), at("washer", [[xLeaf(0) - leafW / 2 + 20, yB + 7, zDoor]], [0, 1, 0], "D0", undefined, { len: 2, dia: 14 }), at("washer", [[xLeaf(3) + leafW / 2 - 20, yB + 7, zDoor]], [0, 1, 0], "D3", undefined, { len: 2, dia: 14 })],
      tools: ["screwdriver"],
    },
    {
      title: "Press the pivot bushes into the corners",
      detail: "Into the holes at the front outer corners of the bottom and of the cabinet top.",
      fix: [at("cap", SIDES.flatMap((sx) => [[sx * (XP - 30), yB, zDoor], [sx * (XP - 30), yIn, zDoor]] as Vec3[]), [0, -1, 0], undefined, undefined, { name: "Pivot bush", len: 8, dia: 12 })],
    },
    {
      title: "Hang the left door",
      detail: "Clip a pivot pin into the top and bottom of each leaf, set the door in the rails and push the pins up until they click into the rail.",
      add: ["D0", "D1"],
      fix: [at("hinge", [0, 1].flatMap((k) => [yB + 10, yIn - 10].map((y): Vec3 => [xLeaf(k) + (k ? leafW / 2 - 15 : -leafW / 2 + 15), y, zDoor])), [0, 1, 0], undefined, undefined, { name: "Pivot pin", len: 30, dia: 12 })],
      warnings: ["hand"],
    },
    {
      title: "Screw on the knobs",
      detail: "One knob on each inner leaf, near the top, screwed on from behind.",
      fix: [at("knob", [[xLeaf(1) + leafW / 2 - 25, yIn - 50, zDoor + 9]], [0, 0, -1], "D1"), at("knob", [[xLeaf(2) - leafW / 2 + 25, yIn - 50, zDoor + 9]], [0, 0, -1], "D2"), at("screw", [[xLeaf(1) + leafW / 2 - 25, yIn - 50, zDoor - 14]], [0, 0, 1], "D1", undefined, { len: 12, dia: 4 }), at("screw", [[xLeaf(2) - leafW / 2 + 25, yIn - 50, zDoor - 14]], [0, 0, 1], "D2", undefined, { len: 12, dia: 4 })],
      tools: ["screwdriver"],
    },
    { title: "Check the door folds", detail: "Open it: the two leaves fold together and turn out of the way. Close it again before the next one." },
    {
      title: "Hang the right door",
      detail: "Four pivot pins, the same way. The leaves meet the left door in the middle.",
      add: ["D2", "D3"],
      fix: [at("hinge", [2, 3].flatMap((k) => [yB + 10, yIn - 10].map((y): Vec3 => [xLeaf(k) + (k === 3 ? leafW / 2 - 15 : -leafW / 2 + 15), y, zDoor])), [0, 1, 0], undefined, undefined, { name: "Pivot pin", len: 30, dia: 12 })],
      warnings: ["hand"],
    },
    ...wallSteps(H - PT - 60, ["P2", "P3"]),
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["SÅGMÄSTARE", "SAGMASTARE"],
  recipe(s: ProductSpec) {
    const slug = s.slug ?? "";
    if (/sagmastare-shelving-unit/.test(slug)) return shelving();
    if (/sagmastare-cabinet/.test(slug)) return cabinet();
    return null;
  },
};
export default family;

import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * MILSBO, read from its two manuals (73x175 and 101x100). A steel cabinet on four cast legs: levelling feet into the
 * legs, rails pushed into them and bolted, a base frame on top, then four corner posts bolted down through their feet
 * and a middle post at the back. The tall one gets its top before the glass: two people push each pane up into the
 * top channel and drop it into the bottom one. The low one has its panes lowered in from above and the top laid on
 * after. Plastic glass clips screwed to the posts hold the panes and carry the glass shelves. The doors drop onto
 * bushings in the base and are held by pins through the top; handles, then a wall bracket or strap.
 * The 101x186 size doesn't exist: it is redirected to 101x100.
 */

const P = 24; // posts
const FR = 20; // base frame height
const TOP = 24; // top thickness

function doorPart(id: string, w: number, h: number, pos: Vec3): CustomPart {
  const f = 26;
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
  const tall = H > 1400;
  const legH = tall ? 150 : 220;
  const railH = 40, yR = legH - railH / 2;
  const yB = legH + FR; // top of the base frame
  const postH = H - TOP - yB;
  const xs = W / 2 - P / 2, zs = D / 2 - P / 2;
  const gy = yB + postH / 2, gh = postH;
  const parts: CustomPart[] = [];
  const metal = (id: string, name: string, size: Vec3, pos: Vec3, o: Partial<CustomPart> = {}) => parts.push({ id, name, size, pos, material: "metal", ...o });
  const corners: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  corners.forEach(([sx, sz], i) => metal(`L${i}`, "Leg", [36, legH, 36], [sx * (W / 2 - 18), legH / 2, sz * (D / 2 - 18)]));
  metal("rF", "Long rail", [W - 72, railH, 16], [0, yR, D / 2 - 18]);
  metal("rB", "Long rail", [W - 72, railH, 16], [0, yR, -D / 2 + 18]);
  metal("rL", "Short rail", [16, railH, D - 72], [-W / 2 + 18, yR, 0]);
  metal("rR", "Short rail", [16, railH, D - 72], [W / 2 - 18, yR, 0]);
  const frame: PartPiece[] = [
    { shape: "box", size: [W, FR, P], pos: [0, 0, zs] },
    { shape: "box", size: [W, FR, P], pos: [0, 0, -zs] },
    { shape: "box", size: [P, FR, D - 2 * P], pos: [-xs, 0, 0] },
    { shape: "box", size: [P, FR, D - 2 * P], pos: [xs, 0, 0] },
  ];
  metal("fr", "Base frame", [W, FR, D], [0, legH + FR / 2, 0], { pieces: frame });
  metal("bot", "Bottom plate", [W - 2 * P, 4, D - 2 * P], [0, yB - 2, 0]);
  corners.forEach(([sx, sz], i) => metal(`P${i}`, "Post", [P, postH, P], [sx * xs, yB + postH / 2, sz * zs]));
  // the tall one's middle post stands just inside its one back pane; the low one's sits between its two back panes
  const mz = tall ? -zs + 11.5 : -zs;
  const md = tall ? 16 : P;
  metal("Pm", "Middle post", [P, postH, md], [0, yB + postH / 2, mz]);
  metal("top", "Top", [W, TOP, D], [0, H - TOP / 2, 0]);
  const glass = (id: string, name: string, size: Vec3, pos: Vec3) => parts.push({ id, name, size, pos, material: "glass" });
  glass("gL", "Glass side", [5, gh, D - 2 * P], [-xs, gy, 0]);
  glass("gR", "Glass side", [5, gh, D - 2 * P], [xs, gy, 0]);
  if (tall) glass("gB", "Glass back", [W - 2 * P, gh, 5], [0, gy, -zs]);
  else [-1, 1].forEach((k, i) => glass(`gB${i}`, "Glass back", [W / 2 - P - P / 2, gh, 5], [k * (P / 4 + W / 4), gy, -zs]));
  const dw = W / 2 - 2;
  parts.push(doorPart("dL", dw, gh, [-W / 4, gy, D / 2 + 10]));
  parts.push(doorPart("dR", dw, gh, [W / 4, gy, D / 2 + 10]));
  // the glass shelves rest on the glass clips
  const clipY = tall ? [1, 2, 3].map((i) => yB + (gh * i) / 4) : [yB + gh * 0.3, yB + gh * 0.58];
  const shelfAt = tall ? clipY : [clipY[1]];
  shelfAt.forEach((y, i) => glass(`sh${i}`, "Glass shelf", [W - 2 * P - 10, 6, D - 2 * P - 10], [0, y + 11, 0]));

  const fix = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
  const DOWN: Vec3 = [0, -1, 0];
  const short = { len: 12, dia: 6 };
  const screw = { len: 10, dia: 4 };
  // each rail end bolted from the outside of its leg
  const railBolts = corners.flatMap(([sx, sz]) => [
    fix("bolt", [[sx * (W / 2), yR, sz * (D / 2 - 18)]], [-sx, 0, 0], short),
    fix("bolt", [[sx * (W / 2 - 18), yR, sz * (D / 2)]], [0, 0, -sz], short),
  ]);
  const frameBolts = (cs: number[], two: boolean): Vec3[] =>
    cs.flatMap((i) => {
      const [sx, sz] = corners[i];
      const a: Vec3 = [sx * (W / 2 - 12), yB, sz * (D / 2 - 34)];
      return two ? [a, [sx * (W / 2 - 34), yB, sz * (D / 2 - 12)] as Vec3] : [a];
    });
  const postBolts = fix("bolt", corners.map(([sx, sz]) => [sx * xs, yB + 32, sz * zs] as Vec3), DOWN, { len: 50, dia: 6 });
  const midFace = mz + md / 2 + 4; // just in front of the middle post
  const midScrew = (y: number) => fix("screw", [[0, y, midFace]], [0, 0, -1], { ...screw, on: "Pm" });
  // a glass clip on a post's inner face, screwed in: the screws go first so each clip sits on its own screw
  const sideClips = (pts: Vec3[]): CustomFix[] => {
    const l = pts.filter((p) => p[0] < 0), r = pts.filter((p) => p[0] > 0);
    return [
      ...(l.length ? [fix("screw", l, [-1, 0, 0], screw)] : []),
      ...(r.length ? [fix("screw", r, [1, 0, 0], screw)] : []),
      fix("clamp", pts, [0, 1, 0], { name: "Glass clip", len: 30, dia: 16 }),
    ];
  };
  const clipAt = (y: number, sxs: number[]): Vec3[] => sxs.flatMap((sx) => [-1, 1].map((sz) => [sx * (xs - P / 2 - 4), y, sz * (zs - 4)] as Vec3));
  const narrow = (ys: number[]): CustomFix[] => [
    fix("screw", ys.map((y) => [0, y, midFace] as Vec3), [0, 0, -1], { ...screw, on: "Pm" }),
    fix("clamp", ys.map((y) => [0, y, midFace] as Vec3), [0, 1, 0], { name: "Narrow glass clip", len: 20, dia: 12, on: "Pm" }),
  ];
  const doorTop = gy + gh / 2;
  const hingeX = (sx: number) => sx * (W / 2 - 40);
  const plates = (sxs: number[]): CustomFix[] => [
    fix("screw", sxs.flatMap((sx) => [hingeX(sx) - 25, hingeX(sx) + 25].map((x) => [x, doorTop, D / 2 + 10] as Vec3)), DOWN, { len: 14, dia: 4 }),
    fix("hinge", sxs.map((sx) => [hingeX(sx), doorTop, D / 2 + 10] as Vec3), DOWN, { name: "Hinge plate", len: 40, dia: 20 }),
  ];
  const bushings = fix("clip", [-1, 1].map((sx) => [hingeX(sx), yB, D / 2 - 8] as Vec3), DOWN, { name: "Hinge bushing", len: 10, dia: 12 });
  const pins = fix("pin", [-1, 1].map((sx) => [hingeX(sx), H, D / 2 + 10] as Vec3), DOWN, { name: "Hinge pin", len: 40, dia: 8 });
  const handles: CustomFix[] = [
    fix("screw", [-1, 1].flatMap((k) => [-40, 40].map((dy) => [k * 14, gy + dy, D / 2] as Vec3)), [0, 0, 1], screw),
    fix("handle", [[-14, gy, D / 2 + 30], [14, gy, D / 2 + 30]], [0, 0, -1], { len: 120, dia: 14, twist: Math.PI / 2 }),
  ];
  const feet = fix("foot", corners.map(([sx, sz]) => [sx * (W / 2 - 18), 0, sz * (D / 2 - 18)] as Vec3), [0, 1, 0], { name: "Levelling foot", len: 25, dia: 22 });
  const two = { people: 2 as const, warnings: ["two" as const, "hand" as const] };
  const paneDetail = "Push it up into the channel under the top, then swing the bottom in and let it drop into the base. Never stand glass on a hard floor.";

  const start: CustomStep[] = [
    { title: "Screw the feet into the legs", detail: "Lay the four legs on a rug and turn a levelling foot into the bottom of each by hand.", add: ["L0", "L1", "L2", "L3"], fix: [feet], warnings: ["floor"] },
    ...(tall
      ? [
          { title: "Push the long rails into the legs", detail: "One at the front and one at the back, each end into the slot at the top of a leg.", add: ["rF", "rB"] },
          { title: "Push in the short rails", detail: "They close the two ends.", add: ["rL", "rR"] },
        ]
      : [{ title: "Push the rails into the legs", detail: "Two long and two short rails, each end into the slot at the top of a leg.", add: ["rF", "rB", "rL", "rR"] }]),
    { title: "Bolt the rails to the legs", detail: "Eight short bolts with the Allen key, two at each leg.", fix: railBolts, tools: ["allen"], check: "square" },
  ];
  const tallSteps: CustomStep[] = [
    ...start,
    { title: "Bolt the base frame on", detail: "Lay it on the legs with the corner plates over them. Two bolts at two opposite corners.", add: ["fr"], fix: [fix("bolt", frameBolts([0, 3], true), DOWN, short)], tools: ["allen"] },
    { title: "Bolt the other two corners", detail: "One bolt at each.", fix: [fix("bolt", frameBolts([1, 2], false), DOWN, short)], tools: ["allen"] },
    { title: "Bolt on the four posts", detail: "Stand each post on its corner and bolt it down through its foot with a long bolt.", add: ["P0", "P1", "P2", "P3"], fix: [postBolts], tools: ["allen"] },
    { title: "Lay the bottom plate in", detail: "Its notches fit round the posts.", add: ["bot"] },
    { title: "Fit the middle post at the back", detail: "Hook its foot onto the tab in the back of the frame and fix it with one screw.", add: ["Pm"], fix: [midScrew(yB + 30)], tools: ["screwdriver"] },
    { title: "Put the top on", detail: "Lower it onto the five posts so each one goes into its hole.", add: ["top"] },
    { title: "Bolt the top to the corner posts", detail: "Four short bolts, only loosely for now.", fix: [fix("bolt", corners.map(([sx, sz]) => [sx * xs, H, sz * zs] as Vec3), DOWN, short)], tools: ["allen"] },
    { title: "Screw the middle post to the top", detail: "One screw at the back.", fix: [midScrew(H - TOP - 30)], tools: ["screwdriver"] },
    { title: "Fit the back pane together", detail: `Turn the cabinet so its back faces you. ${paneDetail}`, add: ["gB"], ...two, from: { gB: [0, 0, 420] } },
    { title: "Clip it to the middle post", detail: "Three narrow clips, one screw each.", fix: narrow(clipY), tools: ["screwdriver"] },
    { title: "Fit a glass side", detail: paneDetail, add: ["gL"], warnings: ["hand"], from: { gL: [240, 0, 380] } },
    { title: "Clip the side in", detail: "Four glass clips, two on each post, one screw each.", fix: sideClips(clipAt(clipY[0], [-1]).concat(clipAt(clipY[1], [-1]))), tools: ["screwdriver"], people: 2 },
    { title: "Fit the other glass side", detail: paneDetail, add: ["gR"], warnings: ["hand"], from: { gR: [-240, 0, 380] } },
    { title: "Clip that side in", detail: "Four more clips at the same heights.", fix: sideClips(clipAt(clipY[0], [1]).concat(clipAt(clipY[1], [1]))), tools: ["screwdriver"], people: 2 },
    { title: "Fit the top row of clips", detail: "Four clips, one on each corner post. The shelves rest on the clips, so keep each row level.", fix: sideClips(clipAt(clipY[2], [-1, 1])), tools: ["screwdriver"] },
    { title: "Tighten the top bolts", detail: "Check every pane sits in its top channel, then tighten the four bolts.", tools: ["allen"] },
    { title: "Tighten the middle post screw", tools: ["screwdriver"] },
    { title: "Screw the hinge plates onto the doors", detail: "Lay the doors on a rug. One plate on the top corner of each door, two screws each.", fix: plates([-1, 1]), wait: ["dL", "dR"], tools: ["screwdriver"], warnings: ["floor"] },
    { title: "Push the bushings into the base", detail: "One at each front corner.", fix: [bushings] },
    { title: "Set the doors on the bushings", detail: "Lower each door onto its bushing and tip the top in under the top.", add: ["dL", "dR"], warnings: ["hand"], from: { dL: [0, 0, 380], dR: [0, 0, 380] } },
    { title: "Push the hinge pins in", detail: "Down through the top into each hinge plate.", fix: [pins] },
    { title: "Screw on the handles", detail: "Two screws from inside each door.", fix: handles, tools: ["screwdriver"] },
    { title: "Try the lock", detail: "The lock is already in the door. Both keys are in the bag." },
  ];
  const lowSteps: CustomStep[] = [
    ...start,
    { title: "Lay the base frame on", detail: "Its corner plates sit on the tops of the legs.", add: ["fr"] },
    { title: "Bolt on the four posts", detail: "Stand each post on its corner and bolt it down through its foot with a long bolt.", add: ["P0", "P1", "P2", "P3"], fix: [postBolts], tools: ["allen"] },
    { title: "Tighten the post bolts", detail: "Check each post stands straight, then tighten all four.", tools: ["allen"] },
    { title: "Lay the bottom plate in", detail: "Its notches fit round the posts.", add: ["bot"] },
    { title: "Screw two narrow clips onto the middle post", detail: "Lay it on the floor, one screw each.", fix: narrow(clipY), wait: ["Pm"], tools: ["screwdriver"], warnings: ["floor"] },
    { title: "Fit the middle post at the back", detail: "Hook its foot onto the tab in the back of the frame and fix it with one screw.", add: ["Pm"], fix: [midScrew(yB + 30)], tools: ["screwdriver"] },
    { title: "Lower a back pane in together", detail: "From above, into the channels of the corner post and the middle post. Never stand glass on a hard floor.", add: ["gB0"], ...two, from: { gB0: [0, 600, 0] } },
    { title: "Lower in the other back pane", add: ["gB1"], ...two, from: { gB1: [0, 600, 0] } },
    { title: "Lower in the two glass sides", add: ["gL", "gR"], ...two, from: { gL: [0, 600, 0], gR: [0, 600, 0] } },
    { title: "Lay the top on together", detail: "Guide the tops of the posts into its corners.", add: ["top"], people: 2, warnings: ["two"] },
    { title: "Screw in the glass clips", detail: "Eight clips, one on each corner post at two heights. The shelf rests on the top row.", fix: sideClips(clipY.flatMap((y) => clipAt(y, [-1, 1]))), tools: ["screwdriver"] },
    { title: "Bolt the top to the corner posts", detail: "Four short bolts.", fix: [fix("bolt", corners.map(([sx, sz]) => [sx * xs, H, sz * zs] as Vec3), DOWN, short)], tools: ["allen"] },
    { title: "Screw the middle post to the top", detail: "One screw at the back.", fix: [midScrew(H - TOP - 30)], tools: ["screwdriver"] },
    {
      title: "Screw the buffers onto the doors",
      detail: "Lay the doors on a rug, inside up. One buffer at the top and bottom of each door's inner edge.",
      fix: [
        fix("screw", [-1, 1].flatMap((sx) => [gy - gh / 2 + 40, gy + gh / 2 - 40].map((y) => [sx * 14, y, D / 2] as Vec3)), [0, 0, 1], { len: 12, dia: 3.5 }),
        fix("washer", [-1, 1].flatMap((sx) => [gy - gh / 2 + 40, gy + gh / 2 - 40].map((y) => [sx * 14, y, D / 2] as Vec3)), [0, 0, 1], { name: "Door buffer", len: 4, dia: 14 }),
      ],
      wait: ["dL", "dR"],
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    { title: "Screw the hinge plate onto a door", detail: "On the top corner, two screws.", fix: plates([1]), tools: ["screwdriver"] },
    { title: "Push the bushings into the base", detail: "One at each front corner.", fix: [bushings] },
    { title: "Set the doors on the bushings", detail: "Lower each door onto its bushing and tip the top in under the top.", add: ["dL", "dR"], warnings: ["hand"], from: { dL: [0, 0, 380], dR: [0, 0, 380] } },
    { title: "Push the hinge pins in", detail: "Down through the top into each door.", fix: [pins] },
    { title: "Screw on the handles", detail: "Two screws from inside each door.", fix: handles, tools: ["screwdriver"] },
    { title: "Try the lock", detail: "The lock is already in the door. Both keys are in the bag." },
  ];
  const level: CustomStep = { title: "Level it", detail: "Turn the four feet until the doors meet evenly at the top and bottom.", tools: ["wrench"] };
  const wallPt = (x: number): Vec3 => [x, H + 30, -D / 2];
  const wall: CustomStep = tall
    ? {
        title: "Fix it to the wall",
        detail: "Screw the two brackets onto the top at the back, then into the wall. Wall screws and plugs aren't included: pick ones made for your wall.",
        fix: [
          fix("screw", [-1, 1].map((sx) => [sx * (W / 2 - 80), H, -D / 2 + 34] as Vec3), DOWN, screw),
          fix("angle", [-1, 1].map((sx) => [sx * (W / 2 - 80), H, -D / 2 + 8] as Vec3), DOWN, { name: "Wall bracket", len: 80, dia: 30 }),
          fix("plug", [-1, 1].map((sx) => { const p = wallPt(sx * (W / 2 - 80)); return [p[0], p[1], p[2] - 40] as Vec3; }), [0, 0, -1], { len: 35, dia: 8 }),
          fix("screw", [-1, 1].map((sx) => wallPt(sx * (W / 2 - 80))), [0, 0, -1], { len: 50, dia: 5 }),
        ],
        tools: ["drill", "screwdriver", "pencil"],
        wall: true,
        warnings: ["wall", "tip"],
      }
    : {
        title: "Strap it to the wall",
        detail: "Mark the wall at the top of the cabinet, screw the strap to the wall and then onto the top at the back. Wall screws and plugs aren't included: pick ones made for your wall.",
        fix: [
          fix("screw", [[0, H, -D / 2 + 45]], DOWN, { len: 8, dia: 4 }),
          fix("strap", [[0, H, -D / 2 + 20]], DOWN, { len: 120, dia: 20 }),
          fix("plug", [[0, H + 40, -D / 2 - 40]], [0, 0, -1], { len: 35, dia: 8 }),
          fix("screw", [[0, H + 40, -D / 2]], [0, 0, -1], { len: 50, dia: 5 }),
        ],
        tools: ["drill", "screwdriver", "pencil"],
        wall: true,
        warnings: ["wall", "tip"],
      };
  const shelves: CustomStep = { title: shelfAt.length > 1 ? "Lay the glass shelves in" : "Lay the glass shelf in", detail: "Tilt it in through the door and lower it onto a row of clips.", add: shelfAt.map((_, i) => `sh${i}`), warnings: ["hand"] };
  return { parts, steps: [...(tall ? tallSteps : lowSteps), level, wall, shelves] };
}

const family: Family = {
  names: ["MILSBO"],
  recipe(s) {
    if (/milsbo-glass-door-cabinet-(73-x-175|101-x-100)/.test(s.slug ?? "")) return recipe(s);
    return null;
  },
};
export default family;

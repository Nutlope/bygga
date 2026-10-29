import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * FJÄLLBO, read from its manuals. Black square steel tube with perforated mesh and solid wood boards, all joined
 * with small machine screws.
 * Shelving units are built lying on their back on a rug: the mesh shelves (or the bottom mesh shelf and the rails
 * the boards sit on) hook onto one side frame's lugs and get a screw each, the other side frame slides on, the
 * curved brackets under the front of each shelf are screwed to the shelf and bolted through the front posts with a
 * screw and a sleeve nut, the feet go in, and it stands up. The 100 wide unit gets a middle post at the back and the
 * front, held with long screws and angle brackets. The wooden top is screwed into the top frame upside down on the
 * rug, pushed onto the posts and screwed on, two curved braces go under its front corners, and it is fixed to the wall.
 * TV benches have an open back and are built lying on their back too: a side frame, the back top rail, the bottom
 * mesh shelf and the front top rail, the other side frame with two people, the brackets, the middle posts with long
 * screws, the board rails, the feet, then it is stood up for the board, the top, and the mesh doors on their hinges.
 * The 100x95 unit with doors is built like the benches (see doorUnit); the sideboard has its own order (see sideboard).
 * The desk builds its storage cabinet on its side first, then the end frame and the back rails, and is turned upside
 * down onto its top (see desk).
 */

type Kind = CustomFix["kind"];
const T = 25; // square tube
const F = 12; // the feet show under the posts
const PT = 20; // wooden top and boards
const MESH = 2;
const fx = (kind: Kind, at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const r1 = (n: number) => Math.round(n * 10) / 10;

// fittings, from the manuals' parts pages
const M6 = { len: 12, dia: 6 }; // machine screw, the main one
const ARCH_SCREW = { len: 10, dia: 6 }; // flat-headed, through the bracket and the post into the sleeve nut
const SLEEVE = { name: "Sleeve nut", len: 16, dia: 8 };
const LONG = { len: 40, dia: 5 }; // long countersunk screw, through a shelf or rail into a middle post
const WOOD = { len: 16, dia: 4 }; // wood screw through a tab into a board
const FOOT = { len: 20, dia: 25 };

type Box = [Vec3, Vec3]; // lo, hi in product mm
const bx = (lo: Vec3, hi: Vec3): Box => [lo, hi];

/** One part drawn as boxes given by their corners in the product: works out its own box and the pieces in it. */
function part(id: string, name: string, boxes: Box[], material: CustomPart["material"], extra: PartPiece[] = []): CustomPart {
  const lo = [0, 1, 2].map((i) => Math.min(...boxes.map((b) => b[0][i]))) as Vec3;
  const hi = [0, 1, 2].map((i) => Math.max(...boxes.map((b) => b[1][i]))) as Vec3;
  const mid = lo.map((v, i) => r1((v + hi[i]) / 2)) as Vec3;
  const size = lo.map((v, i) => r1(hi[i] - v)) as Vec3;
  if (boxes.length === 1 && !extra.length) return { id, name, size, pos: mid, material };
  const pieces: PartPiece[] = boxes.map(([a, b]) => ({ shape: "box", size: a.map((v, i) => r1(b[i] - v)) as Vec3, pos: a.map((v, i) => r1((v + b[i]) / 2 - mid[i])) as Vec3 }));
  for (const p of extra) pieces.push({ ...p, pos: p.pos.map((v, i) => r1(v - mid[i])) as Vec3 });
  return { id, name, size, pos: mid, material, pieces };
}

interface Body {
  W: number;
  H: number;
  D: number;
  yp: number; // post tops, under the top frame
}
const bodyOf = (s: ProductSpec): Body => {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  return { W, H, D, yp: H - PT - T };
};

/** A side frame: two posts welded to rungs (and on the benches a mesh panel between them). */
function sideFrame(b: Body, id: string, sx: number, rungs: number[], mesh?: [number, number]): CustomPart {
  const x0 = sx < 0 ? -b.W / 2 : b.W / 2 - T, x1 = x0 + T;
  const zb = -b.D / 2, zf = b.D / 2;
  const boxes: Box[] = [bx([x0, F, zb], [x1, b.yp, zb + T]), bx([x0, F, zf - T], [x1, b.yp, zf])];
  for (const y of rungs) boxes.push(bx([x0, y - 20, zb + T], [x1, y, zf - T]));
  if (mesh) boxes.push(bx([x0 + T / 2 - MESH / 2, mesh[0], zb + T], [x0 + T / 2 + MESH / 2, mesh[1], zf - T]));
  return part(id, "Side frame", boxes, "metal");
}

/** A mesh shelf: a frame of flat bar round a perforated sheet. */
function meshShelf(id: string, x0: number, x1: number, z0: number, z1: number, y: number, name = "Mesh shelf"): CustomPart {
  const h = 20, w = 20;
  return part(
    id,
    name,
    [
      bx([x0, y - h, z0], [x1, y, z0 + w]),
      bx([x0, y - h, z1 - w], [x1, y, z1]),
      bx([x0, y - h, z0 + w], [x0 + w, y, z1 - w]),
      bx([x1 - w, y - h, z0 + w], [x1, y, z1 - w]),
      bx([x0 + w, y - MESH - 2, z0 + w], [x1 - w, y - 2, z1 - w]),
    ],
    "metal",
  );
}

/**
 * A curved bracket in the front face, from a post (side sx) in under the front edge of a shelf or rail whose
 * underside is at yb. Its top edge folds back under that shelf (the flange the two shelf screws go up through) as far
 * as z = back; without a flange (the braces under the top) the plate alone is screwed on from the front.
 */
function arch(b: Body, id: string, sx: number, yb: number, o: { name?: string; span?: number; back?: number } = {}): CustomPart {
  const span = o.span ?? 110;
  const xi = sx * (b.W / 2 - T); // inner face of the post
  const z0 = b.D / 2, z1 = z0 + 3;
  const along = (x: number) => (sx < 0 ? [xi, xi + x] : [xi - x, xi]) as [number, number];
  const [ax, bx2] = along(span);
  const post = sx < 0 ? [xi - T, xi] : [xi, xi + T];
  // a quarter curve from the post up and in to the shelf, drawn as three short strips
  const u = -sx, R = span * 0.9;
  const strips: PartPiece[] = [0.17, 0.5, 0.83].map((t) => {
    const a = (t * Math.PI) / 2;
    return { shape: "box", size: [R * 0.6, 6, 3], pos: [xi + u * R * (1 - Math.cos(a)), yb - R * (1 - Math.sin(a)), (z0 + z1) / 2], rot: [0, 0, u * (Math.PI / 2 - a)] };
  });
  const foot = bx([post[0], yb - span, z0], [post[1], yb - span + 60, z1]);
  if (o.back === undefined) return part(id, o.name ?? "Curved bracket", [foot, bx([sx < 0 ? bx2 - 60 : ax, yb - 20, z0], [sx < 0 ? bx2 : ax + 60, yb, z1])], "metal", strips);
  const outer = sx < 0 ? post[0] : post[1];
  const top = bx([Math.min(outer, sx < 0 ? bx2 : ax), yb - 14, z0], [Math.max(outer, sx < 0 ? bx2 : ax), yb, z1]);
  const flange = bx([ax, yb - 3, o.back], [bx2, yb, z0]);
  return part(id, o.name ?? "Curved bracket", [foot, top, flange], "metal", strips);
}

/** Two screws up through the bracket's flange into the shelf (or rail) at depth z, two screws and sleeve nuts through the post. */
function archFix(b: Body, id: string, sx: number, yb: number, z: number, post: string, span = 110) {
  const xi = sx * (b.W / 2 - T);
  const xa = xi - sx * (span - 45);
  const xp = xi - sx * (T / 2);
  const at: Vec3[] = [[xp, yb - 8, b.D / 2 + 3], [xp, yb - span + 15, b.D / 2 + 3]];
  return {
    shelf: fx("screw", [[xa - 12, yb - 3, z], [xa + 12, yb - 3, z]], [0, 1, 0], { ...M6, on: id }),
    post: [
      fx("screw", at, [0, 0, -1], { ...ARCH_SCREW, on: id, mate: post }),
      fx("nut", at.map((p) => [p[0], p[1], b.D / 2 - T] as Vec3), [0, 0, 1], { ...SLEEVE, on: post }),
    ],
  };
}

/** The top frame and the wooden top, and the steps that fit them, as every manual does it. */
function topSteps(b: Body, postXs: number[], frontOnly: number[], nTabs: number) {
  const { W, H, D, yp } = b;
  const yf = yp; // bottom of the top frame
  const frame = part(
    "TF",
    "Top frame",
    [
      bx([-W / 2, yf, -D / 2], [W / 2, yf + T, -D / 2 + T]),
      bx([-W / 2, yf, D / 2 - T], [W / 2, yf + T, D / 2]),
      bx([-W / 2, yf, -D / 2 + T], [-W / 2 + T, yf + T, D / 2 - T]),
      bx([W / 2 - T, yf, -D / 2 + T], [W / 2, yf + T, D / 2 - T]),
    ],
    "metal",
  );
  const top: CustomPart = { id: "TP", name: "Top", size: [W, PT, D], pos: [0, H - PT / 2, 0], material: "wood" };
  const half = nTabs / 2;
  const tabX = Array.from({ length: half }, (_, i) => -W / 2 + 60 + ((W - 120) * i) / Math.max(1, half - 1));
  const tabs: Vec3[] = [-1, 1].flatMap((sz) => tabX.map((x) => [x, yf + T, sz * (D / 2 - T - 10)] as Vec3));
  const posts = [...postXs.flatMap((x) => [-1, 1].map((sz) => [x, sz] as const)), ...frontOnly.map((x) => [x, 1] as const)];
  const steps: CustomStep[] = [
    {
      title: "Screw the top into the top frame",
      detail: "On a rug beside the frame: the top show side down, the top frame on it with its lugs pointing up. One screw through each tab.",
      wait: ["TP", "TF"],
      fix: [fx("screw", tabs, [0, 1, 0], { ...WOOD, on: "TF", mate: "TP" })],
      tools: ["screwdriver"],
    },
    {
      title: "Lower the top onto the posts",
      detail: "Turn it the right way up and lower it so every lug slides into a post end.",
      add: ["TP", "TF"],
      from: { TP: [0, 350, 0], TF: [0, 350, 0] },
    },
    {
      title: "Screw the top frame to the posts",
      detail: "One screw through each post into its lug.",
      fix: [-1, 1].map((sz) => fx("screw", posts.filter((p) => p[1] === sz).map(([x]) => [x, yp - 12, sz * (D / 2)] as Vec3), [0, 0, -sz], { ...M6, on: "TF" })),
      tools: ["screwdriver"],
    },
  ];
  return { parts: [frame, top], steps };
}

/** Two curved braces under the front corners of the top frame, three screws each: two into the post, one into the frame. */
const braces = (b: Body) => [-1, 1].map((sx) => arch(b, `X${sx < 0 ? "l" : "r"}`, sx, b.yp + 20, { name: "Corner brace" }));
function braceStep(b: Body): CustomStep {
  const xi = b.W / 2 - T;
  return {
    title: "Screw on the two corner braces",
    detail: "Under the front corners of the top frame, curve down. Two screws into the post, one into the frame.",
    add: ["Xl", "Xr"],
    fix: [-1, 1].map((sx) => {
      const xp = sx * (b.W / 2 - T / 2);
      return fx("screw", [[xp, b.yp - 70, b.D / 2 + 3], [xp, b.yp - 40, b.D / 2 + 3], [sx * (xi - 80), b.yp + 12, b.D / 2 + 3]], [0, 0, -1], { ...M6, on: `X${sx < 0 ? "l" : "r"}` });
    }),
    tools: ["screwdriver"],
  };
}

function wallStep(b: Body, two: boolean): CustomStep {
  const pts: Vec3[] = [-1, 1].map((sx) => [sx * (b.W / 2 - 120), b.yp + T / 2, -b.D / 2] as Vec3);
  return {
    title: "Fix it to the wall",
    detail: "Two screws through the back rail of the top frame into the wall. Screws and plugs aren't included: pick ones made for your wall.",
    fix: [fx("plug", pts.map((p) => [p[0], p[1], p[2] - 2] as Vec3), [0, 0, -1]), fx("screw", pts, [0, 0, -1], { len: 50, dia: 5, on: "TF" })],
    tools: ["drill", "screwdriver", "pencil"],
    wall: true,
    people: two ? 2 : 1,
    warnings: two ? ["two", "wall", "tip"] : ["wall", "tip"],
  };
}

const feetAt = (pts: [number, number, string][]) => pts.map(([x, z, on]) => fx("foot", [[x, F, z]], [0, 1, 0], { ...FOOT, on }));

/* ---------- shelving units, 51 and 100 wide ---------- */

function shelving(s: ProductSpec): CustomParams {
  const b = bodyOf(s);
  const { W, H, D } = b;
  const wide = W > 800;
  const levels = [160, 550, 940].map((y) => Math.round((y * H) / 1360)); // shelf tops, from the bottom
  const xs = W / 2 - T / 2, zs = D / 2 - T / 2;
  const xi = W / 2 - T;
  const parts: CustomPart[] = [];
  // the rungs sit under each shelf; on the wide unit under the board rails
  const rungY = (i: number) => (wide && i > 0 ? levels[i] - PT : levels[i]);
  parts.push(sideFrame(b, "L", -1, levels.map((_, i) => rungY(i))), sideFrame(b, "R", 1, levels.map((_, i) => rungY(i))));
  const shelfIds: string[] = [];
  const boardIds: string[] = [];
  const railB: string[] = [], railF: string[] = [];
  if (!wide) {
    levels.forEach((y, i) => {
      parts.push(meshShelf(`S${i}`, -xi, xi, -D / 2, D / 2, y));
      shelfIds.push(`S${i}`);
    });
  } else {
    parts.push(meshShelf("S0", -xi, xi, -D / 2 + T, D / 2 - T, levels[0]));
    shelfIds.push("S0");
    for (const i of [1, 2]) {
      const y = levels[i] - PT;
      parts.push(part(`RB${i}`, "Rail", [bx([-xi, y - T, -D / 2 + T], [xi, y, -D / 2 + 2 * T])], "metal"));
      parts.push(part(`RF${i}`, "Rail", [bx([-xi, y - T, D / 2 - 2 * T], [xi, y, D / 2 - T])], "metal"));
      parts.push({ id: `P${i}`, name: "Shelf board", size: [2 * xi, PT, D - 2 * T], pos: [0, levels[i] - PT / 2, 0], material: "wood" });
      railB.push(`RB${i}`);
      railF.push(`RF${i}`);
      boardIds.push(`P${i}`);
    }
    for (const sz of [-1, 1]) parts.push(part(sz < 0 ? "MB" : "MF", "Middle post", [bx([-T / 2, F, sz < 0 ? -D / 2 : D / 2 - T], [T / 2, b.yp, sz < 0 ? -D / 2 + T : D / 2])], "metal"));
  }
  // what the front brackets hold at each level: the shelf, or the front rail under a board
  const frontAt = (i: number) => (wide && i > 0 ? `RF${i}` : `S${i}`);
  // the underside of what each bracket holds, and the depth of the screws up into it
  const archY = (i: number) => (wide && i > 0 ? levels[i] - PT - T : levels[i] - 20);
  const archZ = wide ? D / 2 - T - 11 : D / 2 - 10;
  const archIds: string[] = [];
  levels.forEach((_, i) => {
    for (const sx of [-1, 1]) {
      const id = `A${i}${sx < 0 ? "l" : "r"}`;
      parts.push(arch(b, id, sx, archY(i), { back: archZ - 12 }));
      archIds.push(id);
    }
  });
  const sideScrew = (ids: string[], sx: number) =>
    fx(
      "screw",
      ids.map((id) => {
        const i = Number(id.replace(/\D/g, ""));
        const z = id.startsWith("RB") ? -D / 2 + 1.5 * T : -D / 2 + T + 40;
        return [sx * (W / 2), (id.startsWith("S") ? levels[i] : levels[i] - PT) - 10, z] as Vec3;
      }),
      [-sx, 0, 0],
      { ...M6, on: sx < 0 ? "L" : "R" },
    );

  const steps: CustomStep[] = [];
  const lie = "+z" as const;
  if (!wide) {
    steps.push({
      title: "Hook a mesh shelf onto a side frame",
      detail: "Stand the side frame on its long edge on a rug, lugs facing in. The shelf's hooks drop onto the lugs.",
      add: ["L", "S0"],
      pose: lie,
      warnings: ["floor"],
    });
    steps.push({ title: "Hook on the other two shelves", detail: "All three with the same edge to the front.", add: ["S1", "S2"] });
    steps.push({ title: "Screw the shelves to the side frame", detail: "One screw through the frame into each shelf.", fix: [sideScrew(shelfIds, -1)], tools: ["screwdriver"] });
    steps.push({ title: "Slide the other side frame on", detail: "Its lugs go under the shelf hooks, the same way as on the first side.", add: ["R"] });
    steps.push({ title: "Screw the shelves to it", detail: "Three more screws, one into each shelf.", fix: [sideScrew(shelfIds, 1)], tools: ["screwdriver"] });
  } else {
    steps.push({
      title: "Hook the bottom mesh shelf onto a side frame",
      detail: "Stand the side frame on its long edge on a rug, lugs facing in, and drop the shelf onto its lowest lugs.",
      add: ["L", "S0"],
      pose: lie,
      warnings: ["floor"],
    });
    steps.push({ title: "Screw it to the side frame", detail: "One screw through the frame into the shelf.", fix: [sideScrew(["S0"], -1)], tools: ["screwdriver"] });
    steps.push({ title: "Hook on the two back rails", detail: "The ones lying against the rug. Check the lug on each end points the way the drawing shows.", add: railB });
    steps.push({ title: "Screw the back rails on", detail: "One screw into each.", fix: [sideScrew(railB, -1)], tools: ["screwdriver"] });
    steps.push({ title: "Slide the back middle post under the rails", detail: "Holes facing up, its end level with the side frame's posts.", add: ["MB"] });
    steps.push({
      title: "Screw the bottom shelf to the middle post",
      detail: "One long screw down through the shelf into the post.",
      fix: [fx("screw", [[0, levels[0] - 10, -D / 2 + T + 20]], [0, 0, -1], { ...LONG, on: "S0", mate: "MB" })],
      tools: ["screwdriver"],
    });
    steps.push({
      title: "Fix the back rails to the middle post",
      detail: "An angle bracket on each rail, and a long screw through it into the post.",
      fix: [
        fx("angle", railB.map((id) => [-24, levels[Number(id.slice(2))] - PT - T / 2, -D / 2 + 2 * T] as Vec3), [0, 0, -1], { name: "Angle bracket", len: 30, dia: 20, on: railB[0] }),
        fx("screw", railB.map((id) => [0, levels[Number(id.slice(2))] - PT - T / 2, -D / 2 + 2 * T] as Vec3), [0, 0, -1], { ...LONG, on: "MB" }),
      ],
      tools: ["screwdriver"],
    });
    steps.push({ title: "Hook on the two front rails", detail: "Onto the lugs on the upper posts, hooks the same way as at the back.", add: railF });
    steps.push({ title: "Slide the other side frame on together", detail: "One of you lines up the lugs while the other pushes it home.", add: ["R"], people: 2, warnings: ["two"] });
    steps.push({ title: "Screw it on", detail: "Three screws: the bottom shelf and the two back rails.", fix: [sideScrew(["S0", ...railB], 1)], tools: ["screwdriver"] });
  }

  // the curved brackets: screwed to the shelf, then through the front post
  steps.push({
    title: wide ? "Screw the curved brackets to the shelf and rails" : "Screw the curved brackets to the shelves",
    detail: "One under each front corner, the curve towards the post. Two screws each.",
    add: archIds,
    fix: levels.flatMap((_, i) => [-1, 1].map((sx) => archFix(b, `A${i}${sx < 0 ? "l" : "r"}`, sx, archY(i), archZ, sx < 0 ? "L" : "R").shelf)),
    tools: ["screwdriver"],
  });
  const postFix = levels.flatMap((_, i) => [-1, 1].flatMap((sx) => archFix(b, `A${i}${sx < 0 ? "l" : "r"}`, sx, archY(i), archZ, sx < 0 ? "L" : "R").post));
  steps.push({
    title: "Bolt the brackets through the front posts",
    detail: "A screw from the front and a sleeve nut from behind, two in each bracket. Hold the nut with one screwdriver and turn the screw with the other.",
    fix: postFix.slice(0, 6),
    tools: ["screwdriver"],
  });
  if (postFix.length > 6) steps.push({ title: "Bolt the rest of the brackets on", detail: "The same way, a screw and a sleeve nut through each hole.", fix: postFix.slice(6), tools: ["screwdriver"] });

  if (wide) {
    steps.push({ title: "Lay the front middle post on the rails", detail: "Holes facing down, its end level with the other posts.", add: ["MF"] });
    steps.push({
      title: "Screw the bottom shelf to it",
      detail: "One long screw up through the shelf into the post.",
      fix: [fx("screw", [[0, levels[0] - 10, D / 2 - T - 20]], [0, 0, 1], { ...LONG, on: "S0", mate: "MF" })],
      tools: ["screwdriver"],
    });
    steps.push({
      title: "Fix the front rails to it",
      detail: "An angle bracket and a long screw at each rail, as at the back.",
      fix: [
        fx("angle", railF.map((id) => [-24, levels[Number(id.slice(2))] - PT - T / 2, D / 2 - 2 * T] as Vec3), [0, 0, 1], { name: "Angle bracket", len: 30, dia: 20, on: railF[0] }),
        fx("screw", railF.map((id) => [0, levels[Number(id.slice(2))] - PT - T / 2, D / 2 - 2 * T] as Vec3), [0, 0, 1], { ...LONG, on: "MF" }),
      ],
      tools: ["screwdriver"],
    });
    steps.push({ title: "Lay in the two shelf boards", detail: "Tilt each one in between the rails, show side towards the front of the rails.", add: boardIds });
    const boardTabs = (i: number): Vec3[] => [-1, 1].flatMap((sz) => [-0.75, -0.25, 0.25, 0.75].map((t) => [t * xi, levels[i] - PT, sz * (D / 2 - 1.5 * T)] as Vec3));
    steps.push({
      title: "Screw the boards to the rails",
      detail: "Eight screws through the tabs into each board.",
      fix: [1, 2].map((i) => fx("screw", boardTabs(i), [0, 1, 0], { ...WOOD, on: `RB${i}`, mate: `P${i}` })),
      tools: ["screwdriver"],
    });
  }
  const postsAll: [number, number, string][] = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * xs, sz * zs, sx < 0 ? "L" : "R"] as [number, number, string]));
  if (wide) postsAll.push([0, -zs, "MB"], [0, zs, "MF"]);
  steps.push({ title: `Screw the ${postsAll.length} feet into the posts`, detail: "Turn each one into the bottom end of a post by hand.", fix: feetAt(postsAll) });
  steps.push({ title: wide ? "Stand it up together" : "Stand it up", detail: "Lift it upright from the top, don't drag it up by one post.", pose: "+y", people: wide ? 2 : 1, warnings: wide ? ["two"] : [] });

  const top = topSteps(b, [-xs, xs, ...(wide ? [0] : [])], [], wide ? 8 : 4);
  parts.push(...top.parts);
  steps.push(...top.steps);
  parts.push(...braces(b));
  steps.push(braceStep(b));
  steps.push({ title: "Level it with the feet", detail: "Turn the feet in or out until it stands steady and upright." });
  steps.push(wallStep(b, wide));
  return { parts, steps };
}

/* ---------- TV benches (150 and 198 wide) and the 100x95 unit with doors ---------- */

/**
 * The benches and the 100x95 unit are built the same way, lying on their back: side frames with mesh in their lower
 * half, a bottom mesh shelf, a wooden board on two rails, middle posts at the back and the front held with long
 * screws, mesh doors on hinges. The benches have top rails between the side frames and a door in every bay; the
 * 100x95 has none, hooks its board rails onto the side frames, gets its board while still on its back, and has two
 * doors under the board and the corner braces under the top.
 */
function doorUnit(s: ProductSpec, cab: boolean): CustomParams {
  const b = bodyOf(s);
  const { W, D, yp } = b;
  const bays = cab ? 2 : W > 1700 ? 4 : 3;
  const n = bays - 1; // middle posts at the front, and as many at the back
  const xi = W / 2 - T;
  const xs = W / 2 - T / 2, zs = D / 2 - T / 2;
  const yb = cab ? 160 : Math.round(b.H * 0.31); // top of the bottom mesh shelf
  const yr = (cab ? 520 : Math.round(b.H * 0.67)) - PT; // top of the board rails
  const zBack = -D / 2; // the back is open: the back posts and rails are flush with it
  const yMid = cab ? yp : yp - T; // middle post tops: under the top rails on a bench
  const mids = Array.from({ length: n }, (_, i) => -xi + ((2 * xi) * (i + 1)) / bays);
  const meshTop = cab ? yr - 20 : yp - 20;
  const rungs = cab ? [yb, yr] : [yb, yp];
  const parts: CustomPart[] = [sideFrame(b, "L", -1, rungs, [yb, meshTop]), sideFrame(b, "R", 1, rungs, [yb, meshTop])];
  if (!cab) {
    parts.push(part("RT", "Top rail", [bx([-xi, yp - T, -D / 2], [xi, yp, -D / 2 + T])], "metal"));
    parts.push(part("RTF", "Top rail", [bx([-xi, yp - T, D / 2 - T], [xi, yp, D / 2])], "metal"));
  }
  // the bottom shelf: one long mesh shelf with a cross bar where each pair of middle posts stands
  const shelf = meshShelf("M", -xi, xi, zBack + T, D / 2 - T, yb, "Bottom shelf");
  for (const x of mids) shelf.pieces!.push({ shape: "box", size: [20, 20, D - 2 * T - 40], pos: [x - shelf.pos[0], yb - 10 - shelf.pos[1], -shelf.pos[2]] });
  parts.push(shelf);
  mids.forEach((x, i) => {
    parts.push(part(`MF${i}`, "Middle post", [bx([x - T / 2, F, D / 2 - T], [x + T / 2, yMid, D / 2])], "metal"));
    parts.push(part(`MB${i}`, "Middle post", [bx([x - T / 2, F, zBack], [x + T / 2, yMid, zBack + T])], "metal"));
  });
  parts.push(part("RBk", "Board rail", [bx([-xi, yr - T, zBack + T], [xi, yr, zBack + 2 * T])], "metal"));
  parts.push(part("RFr", "Board rail", [bx([-xi, yr - T, D / 2 - 2 * T], [xi, yr, D / 2 - T])], "metal"));
  parts.push({ id: "P", name: "Shelf board", size: [2 * xi, PT, D / 2 - T - (zBack + T)], pos: [0, yr + PT / 2, (D / 2 - T + zBack + T) / 2], material: "wood" });
  const zHold = D / 2 - T - 10; // the bottom shelf's front bar, where the bracket screws go up into it
  for (const sx of [-1, 1]) parts.push(arch(b, `A${sx < 0 ? "l" : "r"}`, sx, yb - 20, { back: zHold - 12 }));
  // doors: mesh in a frame, one in each bay
  const postX = [-xs, ...mids, xs];
  const doorIds: string[] = [];
  const dy0 = yb - 20, dy1 = cab ? yr - T - 6 : yp - 6;
  for (let i = 0; i < bays; i++) {
    const x0 = postX[i] + T / 2 + 3, x1 = postX[i + 1] - T / 2 - 3;
    const z0 = D / 2, z1 = D / 2 + 18;
    const f = 18;
    parts.push(
      part(
        `D${i}`,
        "Door",
        [
          bx([x0, dy0, z0], [x1, dy0 + f, z1]),
          bx([x0, dy1 - f, z0], [x1, dy1, z1]),
          bx([x0, dy0 + f, z0], [x0 + f, dy1 - f, z1]),
          bx([x1 - f, dy0 + f, z0], [x1, dy1 - f, z1]),
          bx([x0 + f, dy0 + f, z0 + 8], [x1 - f, dy1 - f, z0 + 10]),
        ],
        "metal",
      ),
    );
    doorIds.push(`D${i}`);
  }

  const sideScrews = (sx: number, which: string[]) =>
    which.map((id) => {
      const y = id === "M" ? yb - 10 : id.startsWith("RT") ? yp - T / 2 : yr - T / 2;
      const z = id === "M" ? -D / 2 + 1.5 * T : id === "RT" ? -D / 2 + T / 2 : id === "RTF" ? D / 2 - T / 2 : id === "RBk" ? zBack + 1.5 * T : D / 2 - 1.5 * T;
      return fx("screw", [[sx * (W / 2), y, z]], [-sx, 0, 0], { ...M6, on: sx < 0 ? "L" : "R", mate: id });
    });
  const brackets: CustomStep[] = [
    {
      title: "Screw the curved brackets to the shelf",
      detail: "One at each front corner of the bottom shelf, curve towards the leg. Two screws up through each into the shelf.",
      add: ["Al", "Ar"],
      fix: [-1, 1].map((sx) => archFix(b, `A${sx < 0 ? "l" : "r"}`, sx, yb - 20, zHold, sx < 0 ? "L" : "R").shelf),
      tools: ["screwdriver"],
    },
    {
      title: cab ? "Bolt the brackets through the posts" : "Bolt the brackets through the legs",
      detail: "A screw from the front and a sleeve nut from behind, two in each bracket. Hold the nut with one screwdriver and turn the screw with the other.",
      fix: [-1, 1].flatMap((sx) => archFix(b, `A${sx < 0 ? "l" : "r"}`, sx, yb - 20, zHold, sx < 0 ? "L" : "R").post),
      tools: ["screwdriver"],
    },
  ];
  // long screws: through the shelf's back or front bar, and through a board rail (on an angle bracket in the 100x95)
  const shelfToMid = (front: boolean) => fx("screw", mids.map((x) => [x, yb - 10, front ? D / 2 - T - 20 : zBack + T + 20] as Vec3), [0, 0, front ? 1 : -1], { ...LONG, on: "M" });
  const railToMid = (front: boolean) =>
    fx("screw", mids.map((x) => [x, yr - T / 2, front ? D / 2 - 2 * T : zBack + 2 * T] as Vec3), [0, 0, front ? 1 : -1], { ...LONG, on: front ? "RFr" : "RBk", mate: front ? "MF0" : "MB0" });
  const angleAt = (front: boolean) => fx("angle", mids.map((x) => [x - 24, yr - T / 2, front ? D / 2 - 2 * T : zBack + 2 * T] as Vec3), [0, 0, front ? 1 : -1], { name: "Angle bracket", len: 30, dia: 20, on: front ? "RFr" : "RBk" });
  const boardTabs: Vec3[] = [zBack + 1.5 * T, D / 2 - 1.5 * T].flatMap((z) => {
    const k = cab ? 4 : bays + 1;
    return Array.from({ length: k }, (_, i) => [-xi + 60 + ((2 * xi - 120) * i) / (k - 1), yr, z] as Vec3);
  });
  const boardScrews: CustomStep = {
    title: "Screw the board to the rails",
    detail: "One screw through each tab under the rails into the board.",
    fix: [fx("screw", boardTabs, [0, 1, 0], { ...WOOD, on: "RBk", mate: "P" })],
    tools: ["screwdriver"],
  };
  const cornerFeet: [number, number, string][] = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * xs, sz * zs, sx < 0 ? "L" : "R"] as [number, number, string]));
  const midFeet = mids.flatMap((x, i) => [[x, zs, `MF${i}`], [x, zBack + T / 2, `MB${i}`]] as [number, number, string][]);

  const steps: CustomStep[] = [];
  if (!cab) {
    steps.push(
      {
        title: "Slide the top rail onto a side frame",
        detail: "Lying on its back on a rug: the side frame stands on its back edge, the rail lies along the rug against its top lug.",
        add: ["L", "RT"],
        pose: "+z",
        warnings: ["floor"],
      },
      { title: "Screw the rail on", detail: "One screw through the side frame.", fix: sideScrews(-1, ["RT"]), tools: ["screwdriver"] },
      { title: "Hook on the bottom shelf", detail: "Stand it on its edge on the rug. Its hooks drop onto the side frame's lowest lugs.", add: ["M"] },
      { title: "Screw the shelf on", detail: "One screw through the side frame.", fix: sideScrews(-1, ["M"]), tools: ["screwdriver"] },
      { title: "Hook on the front top rail", detail: "Along the top, the lug under its end onto the side frame.", add: ["RTF"] },
      { title: "Screw it on", detail: "One screw through the side frame.", fix: sideScrews(-1, ["RTF"]), tools: ["screwdriver"] },
      { title: "Slide on the other side frame together", detail: "One of you steadies the long parts while the other pushes the frame onto their ends.", add: ["R"], people: 2, warnings: ["two"] },
      { title: "Screw it on", detail: "Three screws: the two top rails and the shelf.", fix: sideScrews(1, ["RT", "M", "RTF"]), tools: ["screwdriver"] },
      ...brackets,
      { title: "Screw four feet into the side frames", detail: "Into the post ends pointing up, by hand.", fix: feetAt(cornerFeet) },
      {
        title: n > 2 ? `Fit the ${n} front middle posts` : "Fit the two front middle posts",
        detail: "The posts with hinge holes. Each one sits against the front of the bottom shelf, with a long screw through the shelf into it.",
        add: mids.map((_, i) => `MF${i}`),
        fix: [shelfToMid(true)],
        tools: ["screwdriver"],
      },
      {
        title: n > 2 ? `Fit the ${n} back middle posts` : "Fit the two back middle posts",
        detail: "The plain posts, along the back. A long screw through the back of the shelf into each.",
        add: mids.map((_, i) => `MB${i}`),
        fix: [shelfToMid(false)],
        tools: ["screwdriver"],
      },
      {
        title: "Screw in the two board rails",
        detail: "Holes for the board facing the bottom shelf. A long screw through each rail into every middle post.",
        add: ["RBk", "RFr"],
        fix: [railToMid(false), railToMid(true)],
        tools: ["screwdriver"],
      },
      { title: `Screw ${2 * n} feet into the middle posts`, detail: "By hand, the same as the others.", fix: feetAt(midFeet) },
      { title: "Stand it up together", detail: "Turn it over onto its feet.", pose: "+y", people: 2, warnings: ["two"] },
      { title: "Lay the board on its rails", detail: "Show side up. It drops in between the middle posts.", add: ["P"] },
      { ...boardScrews, detail: "From underneath, one screw through each tab." },
    );
  } else {
    steps.push(
      {
        title: "Hook the bottom shelf onto a side frame",
        detail: "Lying on its back on a rug: the side frame stands on its back edge, and the shelf's hooks drop onto its lowest lugs.",
        add: ["L", "M"],
        pose: "+z",
        warnings: ["floor"],
      },
      { title: "Screw the shelf on", detail: "One screw through the side frame.", fix: sideScrews(-1, ["M"]), tools: ["screwdriver"] },
      { title: "Hook on the back board rail", detail: "The rail lying along the rug, holes for the board facing up the frame.", add: ["RBk"] },
      { title: "Screw it on", detail: "One screw through the side frame.", fix: sideScrews(-1, ["RBk"]), tools: ["screwdriver"] },
      { title: "Slide the back middle post under", detail: "Under the shelf and the rail, its end level with the side frame's posts.", add: ["MB0"] },
      { title: "Screw the shelf to the middle post", detail: "One long screw down through the shelf into the post.", fix: [shelfToMid(false)], tools: ["screwdriver"] },
      { title: "Fix the rail to the middle post", detail: "An angle bracket on the rail and a long screw through it into the post.", fix: [angleAt(false), railToMid(false)], tools: ["screwdriver"] },
      { title: "Hook on the front board rail", detail: "Onto the side frame's upper lugs, the same way round as the back one.", add: ["RFr"] },
      { title: "Slide the other side frame on together", detail: "One of you holds the shelf and rails while the other pushes the frame onto their ends.", add: ["R"], people: 2, warnings: ["two"] },
      { title: "Screw it all together", detail: "Four screws: the shelf and both rails on the new side, and the front rail on the first side.", fix: [...sideScrews(1, ["M", "RBk", "RFr"]), ...sideScrews(-1, ["RFr"])], tools: ["screwdriver"] },
      ...brackets,
      { title: "Lay the front middle post on", detail: "Across the shelf and the front rail, its end level with the other posts.", add: ["MF0"] },
      { title: "Screw the shelf to it", detail: "One long screw up through the shelf into the post.", fix: [shelfToMid(true)], tools: ["screwdriver"] },
      { title: "Fix the front rail to it", detail: "An angle bracket and a long screw, as at the back.", fix: [angleAt(true), railToMid(true)], tools: ["screwdriver"] },
      { title: "Slide the board in between the rails", detail: "Show side towards the open top. It slides in along the rails from the top end.", add: ["P"], from: { P: [0, 600, 0] } },
      boardScrews,
      {
        title: "Screw on the door stop",
        detail: "Under the front rail in the middle, where the two doors meet. One screw.",
        fix: [
          fx("screw", [[0, yr - T, D / 2 - 1.5 * T]], [0, 1, 0], { ...M6, on: "RFr" }),
          fx("plate", [[24, yr - T - 2, D / 2 - 1.5 * T]], [0, 1, 0], { name: "Door stop", len: 40, dia: 20, on: "RFr" }),
        ],
        tools: ["screwdriver"],
      },
      { title: "Screw the six feet into the posts", detail: "Turn each one into the bottom end of a post by hand.", fix: feetAt([...cornerFeet, ...midFeet]) },
      { title: "Stand it up together", detail: "Lift it upright from the top, don't drag it up by one post.", pose: "+y", people: 2, warnings: ["two"] },
    );
  }

  const top = topSteps(b, cab ? [-xs, xs, 0] : [-xs, xs], [], cab ? 8 : 2 * (bays + 1));
  parts.push(...top.parts);
  if (!cab) {
    // the top frame screws into the side frames and the back middle posts; the front ones get their own step
    const corner = (sz: number) => [-1, 1].map((sx) => [sx * xs, yp - 35, sz * (D / 2)] as Vec3);
    top.steps[2].fix = [
      fx("screw", [...corner(-1), ...mids.map((x) => [x, yp - 12, -D / 2] as Vec3)], [0, 0, 1], { ...M6, on: "TF" }),
      fx("screw", corner(1), [0, 0, -1], { ...M6, on: "TF" }),
    ];
    top.steps[2].detail = "One screw through each corner post, and one through the back rail at each middle post, into the frame.";
  }
  steps.push(...top.steps);
  if (!cab) {
    steps.push({
      title: "Screw the front middle posts to the top rail",
      detail: "One screw at the top of each, through the rail into the post.",
      fix: [fx("screw", mids.map((x) => [x, yp - T / 2, D / 2] as Vec3), [0, 0, -1], { ...M6, on: "RTF" })],
      tools: ["screwdriver"],
    });
  } else {
    parts.push(...braces(b));
    steps.push(braceStep(b));
  }
  steps.push({ title: "Level it with the feet", detail: "Turn the feet in or out until it stands steady." });
  // doors: hinges on the door, then onto its post; on a bench the last door hangs on the right, on the 100x95 the
  // two doors meet in the middle
  const hingeSide = (i: number) => (i === bays - 1 ? 1 : -1);
  const hingeYs = [dy0 + 40, dy1 - 80];
  const hingePts = (i: number): Vec3[] => {
    const x = hingeSide(i) < 0 ? postX[i] + T / 2 : postX[i + 1] - T / 2;
    return hingeYs.map((y) => [x, y, D / 2] as Vec3);
  };
  steps.push({
    title: "Screw two hinges onto each door",
    detail: "Lay the doors on the rug, mesh side down. Two screws hold each hinge to the door frame.",
    add: doorIds,
    from: Object.fromEntries(doorIds.map((id) => [id, [0, 0, 500] as Vec3])),
    fix: [
      ...doorIds.map((id, i) => fx("hinge", hingePts(i), [0, 0, -1], { on: id })),
      ...doorIds.map((id, i) => fx("screw", hingePts(i).flatMap((p) => [[p[0] - hingeSide(i) * 10, p[1] - 20, D / 2 + 18], [p[0] - hingeSide(i) * 10, p[1] + 20, D / 2 + 18]] as Vec3[]), [0, 0, -1], { ...M6, on: id })),
    ],
    tools: ["screwdriver"],
  });
  steps.push({
    title: "Hang the doors",
    detail: "Hold each door in its opening and screw its hinges to the post, two screws each. Adjust the hinges until the gaps are even.",
    fix: doorIds.map((id, i) => fx("screw", hingePts(i).flatMap((p) => [[p[0] + hingeSide(i) * 12, p[1] - 20, D / 2], [p[0] + hingeSide(i) * 12, p[1] + 20, D / 2]] as Vec3[]), [0, 0, -1], { ...M6, on: id })),
    tools: ["screwdriver"],
  });
  // a round magnet inside the top corner of each door, away from its hinges
  const magnets: Vec3[] = doorIds.map((_, i) => [hingeSide(i) < 0 ? postX[i + 1] - T / 2 - 15 : postX[i] + T / 2 + 15, dy1 - 12, D / 2]);
  steps.push({
    title: "Screw a magnet into each door",
    detail: "Inside the top corner away from the hinges, one screw through the magnet into the door frame.",
    fix: doorIds.flatMap((id, i) => [fx("washer", [magnets[i]], [0, 0, 1], { name: "Magnet", len: 6, dia: 16, on: id }), fx("screw", [magnets[i]], [0, 0, 1], { len: 10, dia: 4, on: id })]),
    tools: ["screwdriver"],
  });
  steps.push(wallStep(b, true));
  if (!cab) {
    // the cable clips from the fittings bag, stuck along the back board rail
    const k = bays === 4 ? 14 : 10;
    const clips = Array.from({ length: k }, (_, i) => [-xi + 50 + ((2 * xi - 100) * i) / (k - 1), yr - T, zBack + 1.5 * T] as Vec3);
    steps.push({
      title: "Clip the cables to the back rail",
      detail: "Press the cable clips on where your cables run, and push the cables into them.",
      fix: [fx("clip", clips, [0, 1, 0], { name: "Cable clip", len: 12, dia: 16, on: "RBk" })],
    });
  }
  return { parts, steps };
}

/* ---------- the sideboard, 111x47x95 ---------- */

/**
 * The sideboard's manual stands it on its right side frame on a rug: the four long rails and the bottom mesh shelf
 * hook onto that frame's lugs, the left side frame goes on from above, and the curved brackets go under the shelf.
 * Then it lies on its back for the middle posts, the board and its angle brackets, stands up for the drawer rail, the
 * runners and the top, gets its two back panels, the doors and the wall fixing, and last the two drawers are built
 * and slid in.
 */
function sideboard(s: ProductSpec): CustomParams {
  const b = bodyOf(s);
  const { W, D, yp } = b;
  const xi = W / 2 - T;
  const xs = W / 2 - T / 2, zs = D / 2 - T / 2;
  const zBack = -D / 2;
  const yb = 160; // top of the bottom mesh shelf
  const yr = 440; // top of the board rails
  const ydr = yp - 150; // bottom of the drawer fronts
  const yRun = ydr + 50; // the drawer runners
  const rungs = [yb, yr, yRun + 10, yp];
  const parts: CustomPart[] = [sideFrame(b, "L", -1, rungs, [yb, yp - 20]), sideFrame(b, "R", 1, rungs, [yb, yp - 20])];
  const rail = (id: string, name: string, y: number, front: boolean) =>
    part(id, name, [bx([-xi, y - T, front ? D / 2 - 2 * T : zBack + T], [xi, y, front ? D / 2 - T : zBack + 2 * T])], "metal");
  parts.push(rail("TB", "Top rail", yp, false), rail("TFr", "Top rail", yp, true), rail("RBk", "Board rail", yr, false), rail("RFr", "Board rail", yr, true));
  parts.push(meshShelf("M", -xi, xi, zBack + T, D / 2 - T, yb, "Bottom shelf"));
  parts.push(part("MB", "Middle post", [bx([-T / 2, F, zBack], [T / 2, yp, zBack + T])], "metal"));
  parts.push(part("MF", "Middle post", [bx([-T / 2, F, D / 2 - T], [T / 2, yp, D / 2])], "metal"));
  parts.push({ id: "P", name: "Shelf board", size: [2 * xi, PT, D - 2 * T], pos: [0, yr + PT / 2, 0], material: "wood" });
  // the rail in the middle the inner drawer runners screw onto, between the two middle posts
  parts.push(part("MR", "Drawer rail", [bx([-10, yRun - 30, zBack + T], [10, yRun + 30, D / 2 - T])], "metal"));
  const zHold = D / 2 - T - 10;
  for (const sx of [-1, 1]) parts.push(arch(b, `A${sx < 0 ? "l" : "r"}`, sx, yb - 20, { back: zHold - 12 }));
  // two mesh back panels, one over each half
  for (const sx of [-1, 1]) parts.push(part(sx < 0 ? "BL" : "BR", "Back panel", [bx([sx < 0 ? -W / 2 : 0, yb - 20, zBack - 4], [sx < 0 ? 0 : W / 2, yp, zBack])], "metal"));
  // doors under the drawers, hinged on the side posts, meeting at the middle post
  const postX = [-xs, 0, xs];
  const dy0 = yb - 20, dy1 = ydr - 6;
  const doorIds = ["D0", "D1"];
  doorIds.forEach((id, i) => {
    const x0 = postX[i] + T / 2 + 3, x1 = postX[i + 1] - T / 2 - 3;
    const z0 = D / 2, z1 = D / 2 + 18, f = 18;
    parts.push(
      part(id, "Door", [
        bx([x0, dy0, z0], [x1, dy0 + f, z1]),
        bx([x0, dy1 - f, z0], [x1, dy1, z1]),
        bx([x0, dy0 + f, z0], [x0 + f, dy1 - f, z1]),
        bx([x1 - f, dy0 + f, z0], [x1, dy1 - f, z1]),
        bx([x0 + f, dy0 + f, z0 + 8], [x1 - f, dy1 - f, z0 + 10]),
      ], "metal"),
    );
  });
  // the drawers: a steel box (bottom, sides, back) behind a front, each on two runners
  const drawerIds = ["DR0", "DR1"];
  const box = { y0: ydr + 12, y1: yp - T - 8, z0: zBack + T + 20, z1: D / 2 };
  drawerIds.forEach((id, i) => {
    const sx = i ? 1 : -1;
    const bx0 = sx < 0 ? -xi + 14 : 24, bx1 = sx < 0 ? -24 : xi - 14;
    const fx0 = postX[i] + T / 2 + 3, fx1 = postX[i + 1] - T / 2 - 3;
    parts.push(
      part(id, "Drawer", [
        bx([fx0, ydr, D / 2], [fx1, yp - 4, D / 2 + 18]),
        bx([bx0, box.y0, box.z0], [bx1, box.y0 + 2, box.z1]),
        bx([bx0, box.y0, box.z0], [bx0 + 2, box.y1, box.z1]),
        bx([bx1 - 2, box.y0, box.z0], [bx1, box.y1, box.z1]),
        bx([bx0, box.y0, box.z0], [bx1, box.y1, box.z0 + 2]),
      ], "metal"),
    );
  });

  const sideScrews = (sx: number, which: string[]) =>
    which.map((id) => {
      const y = id === "M" ? yb - 10 : id.startsWith("T") ? yp - T / 2 : yr - T / 2;
      const z = id === "M" ? zBack + 1.5 * T : ["TB", "RBk"].includes(id) ? zBack + 1.5 * T : D / 2 - 1.5 * T;
      return fx("screw", [[sx * (W / 2), y, z]], [-sx, 0, 0], { ...M6, on: sx < 0 ? "L" : "R", mate: id });
    });
  const bracket = (sx: number) => archFix(b, `A${sx < 0 ? "l" : "r"}`, sx, yb - 20, zHold, sx < 0 ? "L" : "R");
  const long = (pts: Vec3[], front: boolean, on: string) => fx("screw", pts, [0, 0, front ? 1 : -1], { ...LONG, on });
  const SMALL = { len: 8, dia: 4 }; // the runner screws
  const runner = (on: string, x: number, dir: number): CustomFix[] => [
    fx("runner", [[x, yRun, 0]], [dir, 0, 0], { len: D - 2 * T - 40, dia: 30, on }),
    fx("screw", [-140, 40, 150].map((z) => [x, yRun, z] as Vec3), [dir, 0, 0], { ...SMALL, on }),
  ];
  const cornerFeet: [number, number, string][] = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * xs, sz * zs, sx < 0 ? "L" : "R"] as [number, number, string]));
  const boardTab = (x: number, front: boolean): Vec3 => [x, yr, front ? D / 2 - 1.5 * T : zBack + 1.5 * T];

  const steps: CustomStep[] = [
    {
      title: "Screw the six feet into the posts",
      detail: "Lay both side frames and the two middle posts on a rug and turn a foot into the bottom end of each post.",
      add: ["R"],
      wait: ["L", "MB", "MF"],
      fix: feetAt([...cornerFeet, [0, zBack + T / 2, "MB"], [0, zs, "MF"]]),
      pose: "-x",
      warnings: ["floor"],
    },
    {
      title: "Screw a drawer runner onto each side frame",
      detail: "Along the upper rung, wheel at the front. Check the letters on the runners: each goes on its own side. Three small screws each.",
      fix: [...runner("L", -xi, -1), ...runner("R", xi, 1)],
      tools: ["screwdriver"],
    },
    { title: "Hook the two top rails onto the side frame", detail: "With the side frame on the rug, the rails stand up from its top end. Their ends drop onto the lugs.", add: ["TB", "TFr"], from: { TB: [-500, 0, 0], TFr: [-500, 0, 0] } },
    { title: "Hook on the two board rails", detail: "Onto the lugs half way up the frame, holes for the board towards the top.", add: ["RBk", "RFr"], from: { RBk: [-500, 0, 0], RFr: [-500, 0, 0] } },
    { title: "Screw the rails to the side frame", detail: "Four screws, one into each rail end.", fix: sideScrews(1, ["TB", "TFr", "RBk", "RFr"]), tools: ["screwdriver"] },
    { title: "Hook on the bottom shelf", detail: "Slide it down onto the lowest lugs, the hooks the way the drawing shows.", add: ["M"], from: { M: [-500, 0, 0] } },
    { title: "Screw a curved bracket under the shelf", detail: "At the front corner next to the side frame, curve towards the foot. Two screws up into the shelf.", add: ["Ar"], fix: [bracket(1).shelf], tools: ["screwdriver"] },
    { title: "Screw the shelf to the side frame", detail: "One screw through the frame.", fix: sideScrews(1, ["M"]), tools: ["screwdriver"] },
    { title: "Lower the other side frame on", detail: "Feet end down, its lugs into the rail ends and the shelf, in the order the drawing numbers them.", add: ["L"], from: { L: [-500, 0, 0] } },
    { title: "Screw the other curved bracket under the shelf", detail: "The same way, at this side's front corner.", add: ["Al"], fix: [bracket(-1).shelf], tools: ["screwdriver"] },
    { title: "Screw it to the side frame", detail: "Five screws: the four rails and the shelf.", fix: sideScrews(-1, ["TB", "TFr", "RBk", "RFr", "M"]), tools: ["screwdriver"] },
    {
      title: "Bolt both brackets through the front posts",
      detail: "A screw from the front and a sleeve nut from behind, two in each bracket. Hold the nut with one screwdriver and turn the screw with the other.",
      fix: [...bracket(1).post, ...bracket(-1).post],
      tools: ["screwdriver"],
    },
    { title: "Lay it on its back and slide in the back middle post", detail: "Turn it onto a rug, front up. The post slides under the rails, its foot level with the others.", add: ["MB"], pose: "+z", warnings: ["floor"] },
    {
      title: "Screw the shelf and top rail to the post",
      detail: "Two long screws, down through the bottom shelf and the back top rail into the post.",
      fix: [long([[0, yb - 10, zBack + T + 20]], false, "M"), long([[0, yp - T / 2, zBack + 2 * T]], false, "TB")],
      tools: ["screwdriver"],
    },
    {
      title: "Lay in the board and screw it to the rails",
      detail: "Show side to the top. One wood screw through each of the four tabs under the rails.",
      add: ["P"],
      from: { P: [0, 0, 500] },
      fix: [fx("screw", [-1, 1].flatMap((sx) => [boardTab(sx * (xi - 150), false), boardTab(sx * (xi - 150), true)]), [0, 1, 0], { ...WOOD, on: "RBk", mate: "P" })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the door stops onto the front middle post",
      detail: "On its back face, near the top and the bottom of the doors, one screw each.",
      fix: [
        fx("screw", [[0, dy0 + 60, D / 2 - T], [0, dy1 - 60, D / 2 - T]], [0, 0, 1], { ...M6, on: "MF" }),
        fx("plate", [[24, dy0 + 60, D / 2 - T - 2], [24, dy1 - 60, D / 2 - T - 2]], [0, 0, 1], { name: "Door stop", len: 40, dia: 20, on: "MF" }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Lay the front middle post on and screw it",
      detail: "Its foot level with the others. Two long screws up through the bottom shelf and the front top rail into it.",
      add: ["MF"],
      from: { MF: [0, 0, 400] },
      fix: [long([[0, yb - 10, D / 2 - T - 20]], true, "M"), long([[0, yp - T / 2, D / 2 - 2 * T]], true, "TFr")],
      tools: ["screwdriver"],
    },
    {
      title: "Fix the board rails to the middle posts",
      detail: "An angle bracket on each board rail at its post, and a long screw through it into the post.",
      fix: [
        fx("angle", [[-24, yr - 20, zBack + 2 * T]], [0, 0, -1], { name: "Angle bracket", len: 30, dia: 20, on: "RBk" }),
        fx("angle", [[-24, yr - 20, D / 2 - 2 * T]], [0, 0, 1], { name: "Angle bracket", len: 30, dia: 20, on: "RFr" }),
        long([[0, yr - T / 2, zBack + 2 * T]], false, "RBk"),
        long([[0, yr - T / 2, D / 2 - 2 * T]], true, "RFr"),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the angle brackets to the board",
      detail: "One wood screw up through each bracket into the board.",
      fix: [fx("screw", [[-24, yr, zBack + 2 * T + 12], [-24, yr, D / 2 - 2 * T - 12]], [0, 1, 0], { ...WOOD, on: "P" })],
      tools: ["screwdriver"],
    },
    { title: "Stand it up together", detail: "Lift it onto its feet from the top, one of you at each end.", pose: "+y", people: 2, warnings: ["two"] },
    {
      title: "Screw in the drawer rail",
      detail: "Between the two middle posts, at the height of the runners. Two screws through each post into its ends.",
      add: ["MR"],
      fix: [
        fx("screw", [yRun - 15, yRun + 15].map((y) => [0, y, D / 2] as Vec3), [0, 0, -1], { ...M6, on: "MF", mate: "MR" }),
        fx("screw", [yRun - 15, yRun + 15].map((y) => [0, y, zBack] as Vec3), [0, 0, 1], { ...M6, on: "MB", mate: "MR" }),
      ],
      tools: ["screwdriver"],
    },
    { title: "Screw two runners onto the drawer rail", detail: "One on each face, the letters matching the drawing. Three small screws each.", fix: [...runner("MR", -10, 1), ...runner("MR", 10, -1)], tools: ["screwdriver"] },
  ];
  const top = topSteps(b, [-xs, xs, 0], [], 8);
  parts.push(...top.parts);
  steps.push(...top.steps);
  // the back panels: six screws each, into the side post, the middle post and the rails; the top middle ones
  // stay clear of the drawer rail's screws so neither gets pushed off the post
  const backPts = (sx: number): Vec3[] => {
    const o = sx < 0 ? 0 : 40;
    return [...[yb + 20, yr + 60, yp - 60].map((y) => [sx * xs, y, zBack - 4] as Vec3), ...[yb + 20 + 40 - o, yr + 100 - o, yp - 140 + 2 * o].map((y) => [sx * 6, y, zBack - 4] as Vec3)];
  };
  steps.push({
    title: "Screw on the two back panels together",
    detail: "Turn it so the back faces you. One of you holds each panel in place while the other fits its six screws.",
    add: ["BL", "BR"],
    from: { BL: [0, 0, -400], BR: [0, 0, -400] },
    fix: [-1, 1].map((sx) => fx("screw", backPts(sx), [0, 0, 1], { len: 10, dia: 6, on: sx < 0 ? "BL" : "BR" })),
    tools: ["screwdriver"],
    people: 2,
    warnings: ["two"],
  });
  steps.push({ title: "Level it with the feet", detail: "Turn the six feet in or out until it stands steady and square." });
  const hingeYs = [dy0 + 50, dy1 - 80];
  const hingePts = (i: number): Vec3[] => hingeYs.map((y) => [i ? xs - T / 2 : -xs + T / 2, y, D / 2] as Vec3);
  const hs = (i: number) => (i ? 1 : -1);
  steps.push({
    title: "Screw two hinges onto each door",
    detail: "Lay the doors on the rug, mesh side down. Two screws hold each hinge to the door frame.",
    add: doorIds,
    from: Object.fromEntries(doorIds.map((id) => [id, [0, 0, 500] as Vec3])),
    fix: [
      ...doorIds.map((id, i) => fx("hinge", hingePts(i), [0, 0, -1], { on: id })),
      ...doorIds.map((id, i) => fx("screw", hingePts(i).flatMap((p) => [[p[0] - hs(i) * 10, p[1] - 20, D / 2 + 18], [p[0] - hs(i) * 10, p[1] + 20, D / 2 + 18]] as Vec3[]), [0, 0, -1], { ...M6, on: id })),
    ],
    tools: ["screwdriver"],
  });
  steps.push({
    title: "Hang the doors",
    detail: "Hold each door in its opening and screw its hinges to the side post, two screws each.",
    fix: doorIds.map((id, i) => fx("screw", hingePts(i).flatMap((p) => [[p[0] + hs(i) * 12, p[1] - 20, D / 2], [p[0] + hs(i) * 12, p[1] + 20, D / 2]] as Vec3[]), [0, 0, -1], { ...M6, on: id })),
    tools: ["screwdriver"],
  });
  const magnets = (i: number): Vec3[] => [dy0 + 12, dy1 - 12].map((y) => [i ? T / 2 + 18 : -T / 2 - 18, y, D / 2] as Vec3);
  steps.push({
    title: "Screw two magnets into each door",
    detail: "Inside the top and bottom corners by the middle post, one screw through each magnet into the door frame.",
    fix: doorIds.flatMap((id, i) => [fx("washer", magnets(i), [0, 0, 1], { name: "Magnet", len: 6, dia: 16, on: id }), fx("screw", magnets(i), [0, 0, 1], { len: 10, dia: 4, on: id })]),
    tools: ["screwdriver"],
  });
  steps.push({ title: "Line up the doors", detail: "Loosen the hinge screws, slide each door until the gaps are even and the doors are level, then tighten them again.", tools: ["screwdriver"] });
  steps.push({
    title: "Screw on the wall spacers",
    detail: "Into the back of the two side frames at the top. Use the pair that clears your skirting board.",
    fix: [fx("cap", [-1, 1].map((sx) => [sx * xs, yp - 30, zBack - 4] as Vec3), [0, 0, 1], { name: "Wall spacer", len: 20, dia: 30, on: "BL" })],
  });
  const wall = wallStep(b, true);
  const wallPts: Vec3[] = [-1, 1].map((sx) => [sx * (W / 2 - 120), yp + T / 2, -D / 2]);
  steps.push({ ...wall, detail: "Two screws with a cup washer each, through the back rail of the top frame into the wall. Screws and plugs aren't included: pick ones made for your wall.", fix: [...wall.fix!, fx("washer", wallPts, [0, 0, -1], { name: "Cup washer", len: 3, dia: 24, on: "TF" })] });
  // the drawers, built on the rug and then slid in
  const DSCREW = { len: 10, dia: 5 };
  const NUT = { len: 5, dia: 8 };
  const onBoth = (pts: (i: number) => Vec3[], kind: CustomFix["kind"], o: Partial<CustomFix>) => drawerIds.map((id, i) => fx(kind, pts(i), [0, 1, 0], { ...o, on: id }));
  const dx = (i: number) => (i ? 1 : -1);
  const frontPts = (i: number): Vec3[] => [-90, 90].map((k) => [dx(i) * (W / 4 + 10) + k, box.y0, D / 2 + 9] as Vec3);
  const sidePts = (i: number): Vec3[] => {
    const x0 = i ? 24 : -xi + 14, x1 = i ? xi - 14 : -24;
    return [[x0 + 1, box.y1 - 15, D / 2 - 6], [x1 - 1, box.y1 - 15, D / 2 - 6]];
  };
  const backPtsD = (i: number): Vec3[] => {
    const x0 = i ? 24 : -xi + 14, x1 = i ? xi - 14 : -24;
    return [box.y0 + 25, box.y1 - 25].flatMap((y) => [[x0 + 1, y, box.z0 + 10], [x1 - 1, y, box.z0 + 10]] as Vec3[]);
  };
  steps.push(
    {
      title: "Clip each drawer front onto its bottom",
      detail: "Build both drawers on the rug. The front's tabs drop into the slots along the bottom's front edge.",
      wait: drawerIds,
    },
    {
      title: "Bolt the fronts to the bottoms",
      detail: "Two screws down through each bottom into the front, a nut on each held with the spanner.",
      fix: [...onBoth(frontPts, "screw", DSCREW), ...onBoth(frontPts, "nut", NUT)],
      tools: ["screwdriver", "wrench"],
    },
    {
      title: "Hook on the sides and bolt them",
      detail: "Each side hooks into the bottom and the front. One screw and nut where it meets the front.",
      fix: drawerIds.flatMap((id, i) => [fx("screw", sidePts(i), [0, 0, 1], { ...DSCREW, on: id }), fx("nut", sidePts(i), [0, 0, 1], { ...NUT, on: id })]),
      tools: ["screwdriver", "wrench"],
    },
    {
      title: "Hook in the backs and screw them",
      detail: "The back slides down between the sides. Four screws in each drawer.",
      fix: drawerIds.map((id, i) => fx("screw", backPtsD(i), [0, 0, 1], { ...DSCREW, on: id })),
      tools: ["screwdriver"],
    },
    {
      title: "Slide the drawers in",
      detail: "Rest each drawer on its runners and push it in until it drops into place.",
      add: drawerIds,
      from: Object.fromEntries(drawerIds.map((id) => [id, [0, 0, 450] as Vec3])),
    },
  );
  return { parts, steps };
}

/* ---------- the desk, 140x70 ---------- */

/** A frame of two posts (front and back) welded to rungs, standing at x0..x0+T. */
function postFrame(b: Body, id: string, name: string, x0: number, rungs: number[], o: { mesh?: [number, number]; corners?: [number, number] } = {}): CustomPart {
  const x1 = x0 + T, zb = -b.D / 2, zf = b.D / 2;
  const boxes: Box[] = [bx([x0, F, zb], [x1, b.yp, zb + T]), bx([x0, F, zf - T], [x1, b.yp, zf])];
  for (const y of rungs) boxes.push(bx([x0, y - 20, zb + T], [x1, y, zf - T]));
  if (o.mesh) boxes.push(bx([x0 + T / 2 - MESH / 2, o.mesh[0], zb + T], [x0 + T / 2 + MESH / 2, o.mesh[1], zf - T]));
  // the curved corners welded inside an open end frame, drawn as short diagonal strips
  const extra: PartPiece[] = [];
  if (o.corners) {
    for (const [y, sy] of [[o.corners[0], 1], [o.corners[1], -1]] as const)
      for (const sz of [-1, 1]) extra.push({ shape: "box", size: [6, 6, 90], pos: [x0 + T / 2, y + sy * 30, sz * (b.D / 2 - T - 30)], rot: [sy * sz * (Math.PI / 4), 0, 0] });
  }
  return part(id, name, boxes, "metal", extra);
}

/**
 * The desk's manual builds the storage cabinet first, lying on its outer side on a rug: feet into that side frame,
 * the rails onto its lugs, the bottom mesh shelf with long screws, the inner side frame on from above. It stands up
 * for the middle board, is turned upside down for the two back rails and the open end frame, and the wooden top is
 * screwed into its top frame on the rug. The base goes onto the top upside down, gets long screws and the curved
 * corner braces, and stands up for the mesh door.
 */
function desk(s: ProductSpec): CustomParams {
  const b = bodyOf(s);
  const { W, H, D, yp } = b;
  const CW = Math.round(W * 0.32); // the cabinet, outside
  const cx0 = W / 2 - CW; // its inner side frame's outer face
  const ci0 = cx0 + T, ci1 = W / 2 - T; // between the cabinet's side frames
  const yb = 150; // top of the bottom mesh shelf
  const ym = 400; // top of the board rails
  const ylo = 150; // the end frame's bottom rung, and the back bottom rail
  const zB = -D / 2, zF = D / 2;
  const parts: CustomPart[] = [
    postFrame(b, "RS", "Side frame", W / 2 - T, [yb, ym, yp], { mesh: [yb, yp - 20] }),
    postFrame(b, "LS", "Side frame", cx0, [yb, ym, yp], { mesh: [yb, yp - 20] }),
  ];
  const rail = (id: string, name: string, x0: number, x1: number, y: number, front: boolean) =>
    part(id, name, [bx([x0, y - T, front ? zF - T : zB], [x1, y, front ? zF : zB + T])], "metal");
  parts.push(rail("RMb", "Board rail", ci0, ci1, ym, false), rail("RTb", "Top rail", ci0, ci1, yp, false), rail("RMf", "Board rail", ci0, ci1, ym, true), rail("RTf", "Top rail", ci0, ci1, yp, true));
  parts.push(meshShelf("M", ci0, ci1, zB + T, zF - T, yb, "Bottom shelf"));
  parts.push({ id: "P", name: "Shelf board", size: [ci1 - ci0, PT, D - 10], pos: [(ci0 + ci1) / 2, ym + PT / 2, 0], material: "wood" });
  parts.push(postFrame(b, "E", "End frame", -W / 2, [ylo, yp], { corners: [ylo, yp - 20] }));
  parts.push(rail("TR", "Long rail", -W / 2 + T, cx0, yp, false), rail("BR", "Long rail", -W / 2 + T, cx0, ylo, false));
  // a curved bracket under the top rail at each end, on its front face
  const railBracket = (id: string, xPost: number, sx: number): CustomPart => {
    const xa = sx < 0 ? xPost - 90 : xPost, xb = sx < 0 ? xPost + T : xPost + T + 90;
    return part(id, "Curved bracket", [bx([xa, yp - T - 90, zB + T], [xb, yp - T, zB + T + 3])], "metal", [
      { shape: "box", size: [110, 6, 3], pos: [(xa + xb) / 2, yp - T - 60, zB + T + 1.5], rot: [0, 0, sx * (Math.PI / 4)] },
    ]);
  };
  parts.push(railBracket("Bc", cx0, -1), railBracket("Be", -W / 2, 1));
  // the top frame: a ring with cross bars, one over the cabinet's inner side frame
  const TF = part(
    "TF",
    "Top frame",
    [
      bx([-W / 2, yp, zB], [W / 2, yp + T, zB + T]),
      bx([-W / 2, yp, zF - T], [W / 2, yp + T, zF]),
      bx([-W / 2, yp, zB + T], [-W / 2 + T, yp + T, zF - T]),
      bx([W / 2 - T, yp, zB + T], [W / 2, yp + T, zF - T]),
      bx([cx0, yp, zB + T], [cx0 + T, yp + T, zF - T]),
      ...[-0.35, 0.05].map((t) => bx([t * W, yp, zB + T], [t * W + 20, yp + 20, zF - T])),
    ],
    "metal",
  );
  const TP: CustomPart = { id: "TP", name: "Desk top", size: [W, PT, D], pos: [0, H - PT / 2, 0], material: "wood" };
  parts.push(TF, TP);
  // curved corner braces under the top frame, on the outside of the posts: end frame front and back, the cabinet's
  // inner side front and back, and the cabinet's outer back corner
  const braceAt: [string, number, number, number][] = [
    ["Xef", -W / 2 + T, 1, 1],
    ["Xeb", -W / 2 + T, 1, -1],
    ["Xcf", cx0, -1, 1],
    ["Xcb", cx0, -1, -1],
    ["Xrb", W / 2 - T, -1, -1],
  ];
  const zFace = (sz: number) => (sz > 0 ? [zF, zF + 3] : [zB - 3, zB]);
  for (const [id, xe, sx, sz] of braceAt) {
    const [z0, z1] = zFace(sz);
    const xa = sx > 0 ? xe - T : xe - 90, xb = sx > 0 ? xe + 90 : xe + T;
    parts.push(
      part(id, "Corner brace", [bx([sx > 0 ? xa : xb - T, yp - 90, z0], [sx > 0 ? xa + T : xb, yp, z1]), bx([xa, yp, z0], [xb, yp + 20, z1])], "metal", [
        { shape: "box", size: [100, 6, 3], pos: [xe + sx * 35, yp - 30, (z0 + z1) / 2], rot: [0, 0, sx * (Math.PI / 4)] },
      ]),
    );
  }
  // the mesh door over the cabinet's front, hinged on the outer front post
  const dx0 = cx0 + 12, dx1 = W / 2 - 12, dy0 = yb - 40, dy1 = yp - 8, f = 18;
  parts.push(
    part("DR", "Door", [
      bx([dx0, dy0, zF + 2], [dx1, dy0 + f, zF + 20]),
      bx([dx0, dy1 - f, zF + 2], [dx1, dy1, zF + 20]),
      bx([dx0, dy0 + f, zF + 2], [dx0 + f, dy1 - f, zF + 20]),
      bx([dx1 - f, dy0 + f, zF + 2], [dx1, dy1 - f, zF + 20]),
      bx([dx0 + f, dy0 + f, zF + 10], [dx1 - f, dy1 - f, zF + 12]),
    ], "metal"),
  );

  // fittings
  const lugs = (side: "RS" | "LS", ids: string[]) => {
    const x = side === "RS" ? W / 2 : cx0;
    const dir: Vec3 = [side === "RS" ? -1 : 1, 0, 0];
    return ids.map((id) => {
      const y = (id.startsWith("RM") ? ym : yp) - T / 2;
      const z = id.endsWith("f") ? zF - T / 2 : zB + T / 2;
      return fx("screw", [[x, y, z - 6], [x, y, z + 6]], dir, { ...M6, on: side, mate: id });
    });
  };
  const shelfLong = (side: "RS" | "LS", zs: number[]) =>
    fx("screw", zs.map((z) => [side === "RS" ? W / 2 : cx0, yb - 10, z] as Vec3), [side === "RS" ? -1 : 1, 0, 0], { ...LONG, on: side, mate: "M" });
  const bracketFix = (id: string, xPost: number, xRail: number): CustomFix =>
    fx("screw", [[xPost + T / 2, yp - T - 70, zB + T + 3], [xPost + T / 2, yp - T - 30, zB + T + 3], [xRail, yp - T / 2, zB + T + 3]], [0, 0, -1], { ...M6, on: id });
  const boardTabs: Vec3[] = [zB + T / 2, zF - T / 2].flatMap((z) => [0.1, 0.3, 0.5, 0.7, 0.9].map((t) => [ci0 + (ci1 - ci0) * t, ym, z] as Vec3));
  const topTabs: Vec3[] = [
    ...[-0.45, -0.25, -0.05, 0.15, 0.35].flatMap((t) => [zB + T / 2, zF - T / 2].map((z) => [t * W, yp + T, z] as Vec3)),
    ...[-0.2, 0, 0.2].map((t) => [-W / 2 + T / 2, yp + T, t * D] as Vec3),
    ...[-0.2, 0, 0.2].map((t) => [W / 2 - T / 2, yp + T, t * D] as Vec3),
    ...[-0.2, 0, 0.2].map((t) => [cx0 + T / 2, yp + T, t * D] as Vec3),
  ];
  const postTops: [number, number][] = [-W / 2 + T / 2, cx0 + T / 2, W / 2 - T / 2].flatMap((x) => [-1, 1].map((sz) => [x, sz] as [number, number]));
  const hingeYs = [dy0 + 60, dy1 - 80];
  const hx = W / 2 - T / 2;

  const steps: CustomStep[] = [
    {
      title: "Screw two feet into a side frame",
      detail: "Lay the cabinet's outer side frame on a rug, lugs facing up. Turn a foot into each post end by hand.",
      add: ["RS"],
      pose: "-x",
      fix: feetAt([[W / 2 - T / 2, zB + T / 2, "RS"], [W / 2 - T / 2, zF - T / 2, "RS"]]),
      warnings: ["floor"],
    },
    { title: "Fit the back board rail", detail: "It stands up from the middle rung at the back, holes towards the inside. Two screws through the side frame.", add: ["RMb"], fix: lugs("RS", ["RMb"]), tools: ["screwdriver"] },
    { title: "Fit the back top rail", detail: "At the top end of the back post, the same way.", add: ["RTb"], fix: lugs("RS", ["RTb"]), tools: ["screwdriver"] },
    {
      title: "Lower the bottom shelf in and screw it",
      detail: "Its edge sits on the bottom rung. Five long screws up through the rung into the shelf.",
      add: ["M"],
      fix: [shelfLong("RS", [-0.3, -0.15, 0, 0.15, 0.3].map((t) => t * D))],
      tools: ["screwdriver"],
    },
    { title: "Fit the front board rail", detail: "Check the holes in the rail face the way the drawing shows. Two screws.", add: ["RMf"], fix: lugs("RS", ["RMf"]), tools: ["screwdriver"] },
    { title: "Screw the shelf corners", detail: "Two more long screws through the rung, near the front and back posts.", fix: [shelfLong("RS", [zB + T + 20, zF - T - 20])], tools: ["screwdriver"] },
    { title: "Fit the front top rail", detail: "Onto the lug at the top of the front post. Two screws.", add: ["RTf"], fix: lugs("RS", ["RTf"]), tools: ["screwdriver"] },
    {
      title: "Lower the other side frame on",
      detail: "Its lugs go into the four rail ends. Two screws at each rail.",
      add: ["LS"],
      fix: lugs("LS", ["RMb", "RTb", "RMf", "RTf"]),
      tools: ["screwdriver"],
    },
    { title: "Screw it to the bottom shelf", detail: "Three long screws through its bottom rung into the shelf.", fix: [shelfLong("LS", [-0.25, 0, 0.25].map((t) => t * D))], tools: ["screwdriver"] },
    { title: "Screw two feet into it", detail: "Into its post ends, by hand.", fix: feetAt([[cx0 + T / 2, zB + T / 2, "LS"], [cx0 + T / 2, zF - T / 2, "LS"]]) },
    { title: "Stand it up and slide in the board", detail: "Turn the cabinet onto its feet. The board slides in from the front onto the middle rails.", pose: "+y", add: ["P"], from: { P: [0, 0, 600] } },
    { title: "Screw the board to the rails", detail: "One wood screw up through each of the ten tabs.", fix: [fx("screw", boardTabs, [0, 1, 0], { ...WOOD, on: "RMb", mate: "P" })], tools: ["screwdriver"] },
    {
      title: "Turn it upside down and slide in a long rail",
      detail: "On the rug, feet up. The long rail slides into the socket at the top of the back post, the hole the way the drawing shows.",
      pose: "-y",
      add: ["TR"],
      from: { TR: [-500, 0, 0] },
      warnings: ["floor"],
    },
    { title: "Screw a curved bracket onto it", detail: "Where the rail meets the post, curve away from the post. Two screws into the post, one into the rail.", add: ["Bc"], fix: [bracketFix("Bc", cx0, cx0 - 60)], tools: ["screwdriver"] },
    { title: "Slide the end frame onto the rail", detail: "Feet end up, like the cabinet. Its socket goes over the other end of the rail.", add: ["E"], from: { E: [-400, 0, 0] } },
    { title: "Screw a curved bracket at this end", detail: "The same way, two screws into the post and one into the rail.", add: ["Be"], fix: [bracketFix("Be", -W / 2, -W / 2 + T + 60)], tools: ["screwdriver"] },
    { title: "Screw two feet into the end frame", detail: "By hand, into the post ends pointing up.", fix: feetAt([[-W / 2 + T / 2, zB + T / 2, "E"], [-W / 2 + T / 2, zF - T / 2, "E"]]) },
    {
      title: "Screw in the other long rail together",
      detail: "One of you holds the end frame up while the other lines up the rail between the back posts. Two screws at each end.",
      add: ["BR"],
      fix: [
        fx("screw", [[-W / 2, ylo - T / 2, zB + T / 2 - 6], [-W / 2, ylo - T / 2, zB + T / 2 + 6]], [1, 0, 0], { ...M6, on: "E", mate: "BR" }),
        fx("screw", [[cx0 + T, ylo - T / 2, zB + T / 2 - 6], [cx0 + T, ylo - T / 2, zB + T / 2 + 6]], [-1, 0, 0], { ...M6, on: "LS", mate: "BR" }),
      ],
      tools: ["screwdriver"],
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Screw the top into the top frame",
      detail: "On the rug beside the base: the top show side down, the top frame on it with its lugs up. One wood screw through each of the 19 tabs.",
      wait: ["TP", "TF"],
      fix: [fx("screw", topTabs, [0, 1, 0], { ...WOOD, on: "TF", mate: "TP" })],
      tools: ["screwdriver"],
    },
    {
      title: "Lower the base onto the top together",
      detail: "Lift the upside down base and lower it so every post end slides over a lug of the top frame.",
      add: ["TP", "TF"],
      from: { TP: [0, 300, 0], TF: [0, 300, 0] },
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Screw the cabinet to the top frame",
      detail: "Nine long screws: three through each top rail and three through the inner side frame's top rung.",
      fix: [
        fx("screw", [0.2, 0.5, 0.8].map((t) => [ci0 + (ci1 - ci0) * t, yp - T, zB + T / 2] as Vec3), [0, 1, 0], { ...LONG, on: "RTb", mate: "TF" }),
        fx("screw", [0.2, 0.5, 0.8].map((t) => [ci0 + (ci1 - ci0) * t, yp - T, zF - T / 2] as Vec3), [0, 1, 0], { ...LONG, on: "RTf", mate: "TF" }),
        fx("screw", [-0.25, 0, 0.25].map((t) => [cx0 + T / 2, yp - 20, t * D] as Vec3), [0, 1, 0], { ...LONG, on: "LS", mate: "TF" }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the top frame to the posts",
      detail: "Two screws through the side of each of the six posts into its lug.",
      // through the posts' sides, clear of the brace screws in their front and back faces
      fix: postTops.map(([x, sz]) => {
        // the end frame from its outer face; the cabinet's posts from inside the cabinet
        const [xs, dx] = x < cx0 ? [-W / 2, 1] : x > cx0 + T ? [W / 2, -1] : [cx0 + T, -1];
        return fx("screw", [yp - 12, yp - 50].map((y) => [xs, y, sz * (D / 2 - T / 2)] as Vec3), [dx, 0, 0], { ...M6, on: "TF" });
      }),
      tools: ["screwdriver"],
    },
    {
      title: "Screw on the five corner braces",
      detail: "Where the posts meet the top frame, curve towards the post. Two screws into the post and one into the frame. Check each brace sits flat against the post.",
      add: braceAt.map(([id]) => id),
      fix: braceAt.map(([id, xe, sx, sz]) => {
        const z = sz > 0 ? zF + 3 : zB - 3;
        const xp = xe - sx * (T / 2);
        return fx("screw", [[xp, yp - 70, z], [xp, yp - 30, z], [xe + sx * 60, yp + 12, z]], [0, 0, -sz], { ...M6, on: id });
      }),
      tools: ["screwdriver"],
    },
    { title: "Turn it onto its feet together", detail: "Lift it from the top, one of you at each end, and stand it on its six feet.", pose: "+y", people: 2, warnings: ["two"] },
    {
      title: "Screw the magnet into the door",
      detail: "Lay the door on the rug, mesh side down. The magnet goes inside the corner away from the hinges, one screw.",
      wait: ["DR"],
      fix: [fx("washer", [[dx0 + 12, (dy0 + dy1) / 2, zF + 2]], [0, 0, 1], { name: "Magnet", len: 6, dia: 16, on: "DR" }), fx("screw", [[dx0 + 12, (dy0 + dy1) / 2, zF + 2]], [0, 0, 1], { len: 10, dia: 4, on: "DR" })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw two hinges onto the door",
      detail: "On the edge that goes against the outer front post. Two screws hold each hinge to the door frame.",
      fix: [
        fx("hinge", hingeYs.map((y) => [hx, y, zF] as Vec3), [0, 0, -1], { on: "DR" }),
        fx("screw", hingeYs.flatMap((y) => [[hx - 10, y - 20, zF + 20], [hx - 10, y + 20, zF + 20]] as Vec3[]), [0, 0, -1], { ...M6, on: "DR" }),
      ],
      tools: ["screwdriver"],
    },
    { title: "Level the desk", detail: "Turn the six feet in or out until it stands steady and the top is level." },
    {
      title: "Hang the door",
      detail: "Hold it over the cabinet's front and screw its hinges to the outer front post, two screws each. Adjust it up or down until it closes evenly.",
      add: ["DR"],
      from: { DR: [0, 0, 400] },
      fix: [
        fx("screw", hingeYs.flatMap((y) => [[hx + 6, y - 20, zF], [hx + 6, y + 20, zF]] as Vec3[]), [0, 0, -1], { ...M6, on: "RS" }),
        fx("cap", [[cx0 + T / 2, dy0 + 60, zF], [cx0 + T / 2, dy1 - 60, zF]], [0, 0, -1], { name: "Door buffer", len: 6, dia: 12, on: "LS" }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Clip your cables to the rail",
      detail: "Press the five cable clips onto the back bottom rail where your cables run.",
      fix: [fx("clip", [0.15, 0.3, 0.45, 0.6, 0.75].map((t) => [-W / 2 + T + (cx0 - (-W / 2 + T)) * t, ylo, zB + T / 2] as Vec3), [0, -1, 0], { name: "Cable clip", len: 12, dia: 16, on: "BR" })],
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["FJÄLLBO", "FJALLBO"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/shelving-unit-(51-x-136|100-x-136)/.test(slug)) return shelving(s);
    if (/tv-(bench|unit)/.test(slug)) return doorUnit(s, false);
    if (/shelving-unit-100-x-95/.test(slug)) return doorUnit(s, true);
    if (/sideboard/.test(slug)) return sideboard(s);
    if (/desk-140-x-70/.test(slug)) return desk(s);
    return null;
  },
};
export default family;

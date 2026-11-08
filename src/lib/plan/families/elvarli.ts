import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * ELVARLI wardrobe combinations, read from the post, bracket, clothes rail, shelf and drawer manuals.
 * 991.579.02 is two posts, 92 cm wide: four 80 x 51 cm shelves and one 80 cm rail, posts 860 mm apart.
 * 091.581.52 is three posts, 135 cm wide: five 40 cm shelves in the left bay (460 mm), and in the right bay
 * (860 mm) two drawers, one 80 cm rail and two 80 cm shelves.
 * Ceiling screws and plugs are not in the box. Shelves are centred on the posts, so about 254 mm of each
 * 51 cm shelf sticks out behind the post.
 */

const SPAN = 860;
const SHELF_W = 800;
const SHELF_D = 508;
const SHELF_T = 26;
const POST_W = 50;
const POST_D = 40;
// hanging gap in the middle, two shelves below it and two above, which is how this combination is stocked: the keyholes they hang on
const SHELF_HOLES = [0, 2, 8, 9];
const RAIL_HOLE = 6;
const BRACKET_X = POST_W / 2 + 35; // a bracket starts at the post face and reaches 70 mm into the bay

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });

const SLOT = 16; // channel across each broad face, full height
const SLOT_DEEP = 14; // ribs stand this far out from the channel floor
const KEYS = 10;
const KEY_PITCH = 210; // centre to centre. The row is centred on the post, so the spare length stays as margin at the floor and at the ceiling.
const HOLE = 9; // round opening, in the channel
const NECK = 3.6; // slot, narrower than the hole
const NECK_L = 4.5; // how far the slot runs past the hole, up the post
const POCKET = 6; // how deep each keyhole is cut into the post

/**
 * A channel on both broad faces, the same on every post.
 * Each channel has the same ten keyholes: a round hole, stepped so the rim follows a circle, with a short slot up from it.
 */
/**
 * Height of keyhole i, counted from the bottom, on a post whose middle is at postY. Every nut goes into one of these,
 * so every bracket, holder and fixing sits on one.
 */
const keyhole = (postY: number, i: number) => postY + (i - (KEYS - 1) / 2) * KEY_PITCH;

/** The post is the same for every post of a height, so it is drawn once. */
const postCache = new Map<number, PartPiece[]>();
function postPieces(h: number): PartPiece[] {
  let pieces = postCache.get(h);
  if (!pieces) postCache.set(h, (pieces = drawPost(h)));
  return pieces;
}

function drawPost(h: number): PartPiece[] {
  const face = POST_W / 2;
  const lip = (POST_D - SLOT) / 2;
  const floorX = face - SLOT_DEEP;
  const coreW = POST_W - 2 * (SLOT_DEEP + POCKET);
  const pieces: PartPiece[] = [{ shape: "box", size: [coreW, h, POST_D], pos: [0, 0, 0] }];

  const r = HOLE / 2;
  const neck = NECK / 2;
  // Half the opening at a height relative to the hole centre. The slot leaves the top of the circle and runs on up.
  const openHalf = (dy: number) => {
    const circ = Math.abs(dy) <= r ? Math.sqrt(Math.max(0, r * r - dy * dy)) : 0;
    const slot = dy > 0 && dy <= r + NECK_L ? neck : 0;
    return Math.max(circ, slot);
  };

  // dir is +1 on one broad face and -1 on the other. The slot runs up the post on both.
  const addFace = (dir: number) => {
    const x = (n: number) => dir * n;
    const skinX = floorX - POCKET / 2;
    pieces.push(
      { shape: "box", size: [POCKET, h, lip], pos: [x(floorX - POCKET / 2), 0, -(SLOT / 2 + lip / 2)] },
      { shape: "box", size: [POCKET, h, lip], pos: [x(floorX - POCKET / 2), 0, SLOT / 2 + lip / 2] },
      { shape: "box", size: [SLOT_DEEP, h, lip], pos: [x(face - SLOT_DEEP / 2), 0, -(SLOT / 2 + lip / 2)] },
      { shape: "box", size: [SLOT_DEEP, h, lip], pos: [x(face - SLOT_DEEP / 2), 0, SLOT / 2 + lip / 2] },
    );
    const slab = (yA: number, yB: number, z0: number, z1: number) => {
      const yh = yB - yA;
      const zw = z1 - z0;
      if (yh <= 0.15 || zw <= 0.15) return;
      pieces.push({ shape: "box", size: [POCKET, yh, zw], pos: [x(skinX), (yA + yB) / 2, (z0 + z1) / 2] });
    };
    const span = (KEYS - 1) * KEY_PITCH;
    const y0 = -span / 2;
    const bands = 8;
    const keyhole = (cy: number) => {
      const yA = cy - r;
      const yTop = cy + r;
      const yB = yTop + NECK_L;
      slab(yA, yB, -SLOT / 2, -r);
      slab(yA, yB, r, SLOT / 2);
      for (let i = 0; i < bands; i++) {
        const y1 = yA + ((yTop - yA) * i) / bands;
        const y2 = yA + ((yTop - yA) * (i + 1)) / bands;
        const half = Math.max(openHalf(y1 - cy), openHalf(y2 - cy), openHalf((y1 + y2) / 2 - cy));
        const metal = r - half;
        if (metal <= 0.15) continue;
        slab(y1, y2, -r, -half);
        slab(y1, y2, half, r);
      }
      slab(yTop, yB, -r, -neck);
      slab(yTop, yB, neck, r);
      // round back of the hole, so the opening reads as a circle rather than the steps alone
      pieces.push({ shape: "cyl", size: [HOLE - 0.4, 1.2, HOLE - 0.4], pos: [x(floorX - POCKET + 0.6), cy, 0], rot: [0, 0, Math.PI / 2] });
    };
    slab(-h / 2, y0 - r, -SLOT / 2, SLOT / 2);
    for (let i = 0; i < KEYS; i++) {
      const cy = y0 + i * KEY_PITCH;
      keyhole(cy);
      slab(cy + r + NECK_L, i < KEYS - 1 ? y0 + (i + 1) * KEY_PITCH - r : h / 2, -SLOT / 2, SLOT / 2);
    }
  };

  addFace(1);
  addFace(-1);
  return pieces;
}

/**
 * A bracket or rail holder on a post, from the bracket and rail manuals: a nut pushed into the keyhole and slid down,
 * then a screw through the bracket into it, with a plate between for a bracket. `face` is the side of the post the bay is on.
 */
function postMount(post: string, host: string, x: number, face: number, y: number, z: number, what: "Bracket" | "Holder"): CustomFix[] {
  const surf = x + face * (POST_W / 2);
  const into: Vec3 = [-face, 0, 0];
  return [
    fx("nut", [[surf, y, z]], into, post, { name: "Keyhole nut" }),
    ...(what === "Bracket" ? [fx("plate", [[surf + face * 4, y, z]], into, post, { len: 40, dia: 24, name: "Bracket plate" })] : []),
    fx("screw", [[surf + face * 12, y, z]], into, host, { len: 16, dia: 6, name: `${what} screw`, mate: post }),
  ];
}

/** From the shelf manual: under each corner a threaded insert pushed up into the shelf, then a pin screwed into it. */
function shelfPins(shelf: string, xs: number[], y: number, z: number): CustomFix[] {
  const at = xs.flatMap((x) => [-1, 1].map((sz) => [x, y - SHELF_T / 2, z + sz * (SHELF_D / 2 - 40)] as Vec3));
  return [
    fx("dowel", at, [0, 1, 0], shelf, { len: 12, dia: 8, name: "Threaded insert" }),
    fx("pin", at.map(([a, b, c]) => [a, b - 2, c] as Vec3), [0, 1, 0], shelf, { name: "Shelf pin" }),
  ];
}

/**
 * From the post manual: a cover pushed into each keyhole the post isn't using, then slid down. Ten keyholes on each
 * broad face; `used` lists, for each face, the heights of the nuts in it.
 */
function holeCovers(post: string, x: number, postY: number, z: number, used: Record<number, number[]>): CustomFix[] {
  const holes = Array.from({ length: KEYS }, (_, i) => postY + (i - (KEYS - 1) / 2) * KEY_PITCH);
  const nearest = (y: number) => holes.reduce((b, h) => (Math.abs(h - y) < Math.abs(b - y) ? h : b));
  return [-1, 1].flatMap((face) => {
    const taken = new Set((used[face] ?? []).map(nearest));
    const at = holes.filter((h) => !taken.has(h)).map((h) => [x + face * (POST_W / 2), h, z] as Vec3);
    return at.length ? [fx("cap", at, [-face, 0, 0], post, { name: "Hole cover" })] : [];
  });
}

const BRACKET_DETAIL = "Push a nut into the keyhole on each post at this height and slide it down. Hook a bracket over it with a plate between, open side up, and tighten the screw with the allen key.";
const SHELF_DETAIL = "Lower the shelf onto the brackets, then from underneath push a threaded insert into each of the four holes and screw a pin into it.";

/** A post in a run, from left to right. `faces` are the sides it has a bay on; `gap` is how far it stands from the post before it. */
interface RunPost {
  tag: string;
  x: number;
  name: string;
  faces: number[];
  gap?: { mm: number; why: string };
}

/**
 * The post manual (AA-1807976-13): the first post goes up and is tightened in place. Each post after it goes up beside
 * the one before, the first shelf of the bay between them goes in, and then that post is levelled against the shelf and locked.
 * `firstShelf(i)` gives the bracket and shelf steps for the bay to the left of post i.
 */
function postRun(o: { H: number; postY: number; postH: number; pz: number; posts: RunPost[]; firstShelf: (i: number) => CustomStep[] }): CustomStep[] {
  const { H, postY, postH, pz } = o;
  const prep = (p: RunPost): CustomFix[] => [
    fx("screw", [[p.x, 16, pz]], [0, 1, 0], `P${p.tag}`, { len: 80, dia: 8, name: "Adjusting screw" }),
    fx("nut", [[p.x, 28, pz]], [0, 1, 0], `P${p.tag}`, { name: "Adjusting nut" }),
    fx("nut", p.faces.map((f) => [p.x + f * (POST_W / 2 - 7), postY + postH / 2 - 30, pz] as Vec3), [0, -1, 0], `P${p.tag}`, { name: "Square nut" }),
    fx("screw", [[p.x, H - 14, pz]], [0, -1, 0], `C${p.tag}`, { len: 16, dia: 4, name: "Plate screw" }),
  ];
  const ceilingFix = (p: RunPost): CustomFix[] => {
    const at: Vec3[] = [-22, 22].map((dx) => [p.x + dx, H - 2, pz]);
    return [
      fx("plug", at.map(([a, b, c]) => [a, b + 8, c] as Vec3), [0, 1, 0], `C${p.tag}`, { name: "Ceiling plug" }),
      fx("screw", at, [0, 1, 0], `C${p.tag}`, { len: 50, dia: 5, name: "Ceiling screw", notIncluded: true }),
    ];
  };
  const nuts = (p: RunPost) =>
    p.faces.length > 1 ? "two square nuts at the top, one in each channel, since this post has shelves on both sides" : "a square nut at the top, in the channel facing the shelves";
  const ceiling = (p: RunPost, first: boolean): CustomStep => ({
    title: first ? "Screw the post to the ceiling" : `Screw the ${p.name} to the ceiling`,
    detail: "Two screws through the plate, the post upright. Ceiling screws and plugs are not in the box: use ones made for your ceiling. Until this is done the post can fall.",
    fix: ceilingFix(p),
    tools: ["drill", "level", "screwdriver"],
  });
  const lockTop: CustomStep = {
    title: "Lock it with the plate flat on the ceiling",
    detail: "The plate has to meet the ceiling all the way round. Then tighten both locking screws with the allen key.",
    tools: ["allen"],
  };

  const [first, ...rest] = o.posts;
  const steps: CustomStep[] = [
    {
      title: "Fit the adjusting screw in the first post",
      detail: "Screw the nut onto the long screw, then screw it into the bottom of the post until 5 mm of thread shows between the nut and the post.",
      add: [`P${first.tag}`],
      fix: prep(first).slice(0, 2),
    },
    {
      title: first.faces.length > 1 ? "Drop two square nuts into the top of the post" : "Drop a square nut into the top of the post",
      detail: `Put ${nuts(first)}.`,
      fix: prep(first).slice(2, 3),
    },
    {
      title: "Stand the post on its floor plate",
      detail: "Clip the plate onto the round pad, then lower the post so the ball on the screw sits in the pad.",
      add: [`F${first.tag}`],
      from: { [`F${first.tag}`]: [0, -120, 0] },
    },
    {
      title: "Screw on the ceiling plate",
      detail: "One screw down through the plate into the top of the post, then press the cover on until it sits flat, with no gap under it.",
      add: [`C${first.tag}`],
      fix: prep(first).slice(3),
      tools: ["screwdriver"],
      from: { [`C${first.tag}`]: [0, 160, 0] },
    },
    {
      title: "Extend the post to the ceiling",
      detail: "Undo the two locking screws with the allen key and slide the inner tube up until the plate meets the ceiling. Turn the keyholes toward where the shelves will go.",
      tools: ["allen"],
    },
    lockTop,
    {
      title: "Stand it out from the wall",
      detail: "The shelves are 51 cm deep and centred on the post. Leave at least 235 mm between the post and the wall.",
      tools: ["tape"],
    },
    ceiling(first, true),
    {
      title: "Level the floor plate",
      detail: "Move the pad until it sits flat on the floor.",
    },
    {
      title: "Tighten the post between floor and ceiling",
      detail: "Two turns at a time with the spanner, until the post is firm. No more than 40 mm of thread should show under the post. Stop if the ceiling starts to crack.",
      tools: ["wrench"],
    },
    {
      title: "Lock the nut by hand",
      detail: "Turn the nut on the adjusting screw up against the bottom of the post.",
    },
  ];

  rest.forEach((p, k) => {
    const prev = o.posts[k];
    steps.push(
      {
        title: `Put up the ${p.name} the same way`,
        detail: `Adjusting screw with 5 mm showing, ${nuts(p)}, floor plate on, ceiling plate screwed on and its cover pressed flat. Then undo the locking screws and slide the inner tube up to the ceiling.`,
        add: [`P${p.tag}`, `F${p.tag}`, `C${p.tag}`],
        fix: prep(p),
        tools: ["screwdriver", "allen"],
        from: { [`P${p.tag}`]: [240, 0, 0], [`F${p.tag}`]: [240, 0, 0], [`C${p.tag}`]: [240, 80, 0] },
      },
      lockTop,
      {
        title: `Set it ${p.gap?.mm ?? SPAN} mm from the ${prev.name}`,
        detail: `Centre to centre, the same distance from the wall, and the keyholes facing the ${prev.name}. ${p.gap?.why ?? ""}`.trim(),
        tools: ["tape"],
      },
      ceiling(p, false),
      { title: "Level its floor plate", detail: "Move the pad until it sits flat on the floor." },
      ...o.firstShelf(k + 1),
      {
        title: `Unlock the ${p.name}`,
        detail: "Undo the locking screw on its inner tube with the allen key.",
        tools: ["allen"],
      },
      {
        title: "Level the shelf",
        detail: `Turn the nut under the ${p.name} with the spanner to raise or lower it, until the shelf is level and the post upright.`,
        tools: ["wrench", "level"],
      },
      {
        title: `Lock the ${p.name} to the ceiling`,
        detail: "Slide the inner tube up until the plate is flat on the ceiling, then tighten the locking screw.",
        tools: ["allen"],
      },
      {
        title: `Tighten the ${p.name}`,
        detail: "Two turns at a time with the spanner until the post is firm, with no more than 40 mm of thread showing. Then turn the nut by hand up against the post.",
        tools: ["wrench"],
      },
    );
  });
  return steps;
}

function section(s: ProductSpec): CustomParams {
  const H = Math.round(s.size.h * 10) || 2220;
  const px = SPAN / 2;
  const pz = -200;
  const postH = H - 40;
  const postY = 24 + postH / 2;
  const SHELVES = SHELF_HOLES.map((i) => keyhole(postY, i) + 20);
  const RAIL_Y = keyhole(postY, RAIL_HOLE);
  const parts: CustomPart[] = [];
  const add = (id: string, name: string, size: Vec3, pos: Vec3, shape?: "cyl", material?: CustomPart["material"]) => {
    parts.push({ id, name, size, pos, shape, material });
  };
  for (const [sx, tag] of [[-1, "L"], [1, "R"]] as const) {
    const x = sx * px;
    add(`F${tag}`, "Floor plate", [110, 16, 110], [x, 8, pz], "cyl", "metal");
    parts.push({ id: `P${tag}`, name: "Post", size: [POST_W, postH, POST_D], pos: [x, postY, pz], material: "metal", pieces: postPieces(postH) });
    add(`C${tag}`, "Ceiling plate", [120, 14, 120], [x, H - 7, pz], "cyl", "metal");
  }
  SHELVES.forEach((y, i) => {
    for (const [sx, tag] of [[-1, "L"], [1, "R"]] as const) {
      add(`B${i}${tag}`, "Bracket", [70, 16, 460], [sx * (px - BRACKET_X), y - 20, pz], undefined, "metal");
    }
    add(`S${i}`, "Shelf", [SHELF_W, SHELF_T, SHELF_D], [0, y, pz], undefined, "board");
  });
  add("HL", "Rail holder", [36, 28, 40], [-px + POST_W / 2 + 18, RAIL_Y, pz], undefined, "metal");
  add("HR", "Rail holder", [36, 28, 40], [px - POST_W / 2 - 18, RAIL_Y, pz], undefined, "metal");
  parts.push({ id: "RL", name: "Clothes rail", size: [22, SPAN - 80, 22], pos: [0, RAIL_Y, pz], shape: "cyl", rot: [0, 0, Math.PI / 2], material: "metal" });

  const where = ["lowest", "next", "upper", "top"];
  const bracketPair = (i: number): CustomStep => ({
    title: `Fit the ${where[i]} pair of brackets`,
    detail: `${BRACKET_DETAIL} On the thin upper tube, clip a shoe from the post's bag into the slot first.`,
    add: [`B${i}L`, `B${i}R`],
    fix: [-1, 1].flatMap((sx) => postMount(sx < 0 ? "PL" : "PR", `B${i}${sx < 0 ? "L" : "R"}`, sx * px, -sx, SHELVES[i] - 20, pz, "Bracket")),
    tools: ["allen"],
    from: { [`B${i}L`]: [-80, 0, 80], [`B${i}R`]: [80, 0, 80] },
  });
  const shelf = (i: number): CustomStep => ({
    title: `Put on the ${where[i]} shelf`,
    detail: i === 0 ? SHELF_DETAIL : `${SHELF_DETAIL} Shelves go on from the bottom up.`,
    add: [`S${i}`],
    fix: shelfPins(`S${i}`, [-(SHELF_W / 2 - 20), SHELF_W / 2 - 20], SHELVES[i], pz),
    kind: "shelves",
    from: { [`S${i}`]: [0, 160, 40] },
  });
  const rest = SHELVES.map((_, i) => i).slice(1);

  const steps: CustomStep[] = [
    ...postRun({
      H,
      postY,
      postH,
      pz,
      posts: [
        { tag: "L", x: -px, name: "first post", faces: [1] },
        { tag: "R", x: px, name: "second post", faces: [-1], gap: { mm: SPAN, why: "That is the spacing for these 80 cm shelves." } },
      ],
      firstShelf: () => [bracketPair(0), shelf(0)],
    }),
    ...rest.map(bracketPair),
    {
      title: "Drop a nut in for the clothes rail",
      detail: "One in each post, at the height you want the rail. This combination leaves a gap here so shirts can hang.",
      fix: [-1, 1].map((sx) => postMount(sx < 0 ? "PL" : "PR", sx < 0 ? "HL" : "HR", sx * px, -sx, RAIL_Y, pz, "Holder")[0]),
    },
    {
      title: "Screw a holder to each post",
      detail: "The holder hooks into the nut. Tighten it with the allen key.",
      add: ["HL", "HR"],
      fix: [-1, 1].map((sx) => postMount(sx < 0 ? "PL" : "PR", sx < 0 ? "HL" : "HR", sx * px, -sx, RAIL_Y, pz, "Holder")[1]),
      tools: ["allen"],
    },
    {
      title: "Lay the rail in the holders",
      detail: "Rest the tube in both holders and tighten the screw under each one.",
      add: ["RL"],
      fix: [-1, 1].map((sx) => fx("screw", [[sx * ((SPAN - 80) / 2 - 12), RAIL_Y - 14, pz]], [0, 1, 0], "RL", { len: 20, dia: 4, name: "Rail screw" })),
      tools: ["screwdriver"],
      from: { RL: [0, -200, 0] },
    },
    ...rest.map(shelf),
  ];

  steps.push({
    title: "Cover the spare holes",
    detail: "Push a cover into every keyhole you are not using and slide it down. Each post comes with 20.",
    fix: [-1, 1].flatMap((sx) => holeCovers(sx < 0 ? "PL" : "PR", sx * px, postY, pz, { [-sx]: [...SHELVES.map((y) => y - 20), RAIL_Y] })),
    kind: "general",
  });

  return { parts, steps };
}

/**
 * The drawer, read from its own manual (AA-2133991-5): an open box built on two brackets between two posts, then the
 * drawer built face down on the floor and slid onto runners in the box. The same in a wardrobe combination and bought alone.
 */
const DW = 780; // the box, outside
const DD = 470;
const DH = 240;
const DT = 16;
const RUN_X = DW / 2 - DT - 6; // runner, against the inside of each box side
const RUN_DY = DT + 20;
const DSX = DW / 2 - DT - 12 - DT / 2; // drawer side, just inside the runner
const DSH = DH - 70;
const DSL = DD - 40 - DT;
const DRAWER_DY = DT + 26; // the drawer rides this far above the box bottom
// the box bottom sits 8 mm above its bracket's keyhole, so the side's fixing hole lines up with the keyhole above
const FIX_DY = KEY_PITCH - 8;

/** The two posts a drawer hangs between: their x, the depth they stand at, and their part ids. */
interface Bay {
  xl: number;
  xr: number;
  pz: number;
  pl: string;
  pr: string;
}

/** Box and drawer parts for drawer `i`, its box bottom at height `yb`. The brackets belong to whoever puts them up. */
function drawerParts(i: number, yb: number, bay: Bay): CustomPart[] {
  const t = DT;
  const wx = (bay.xl + bay.xr) / 2;
  const { pz } = bay;
  const frontZ = pz + DD / 2;
  const y = yb + DH / 2;
  const dy = yb + DRAWER_DY + DSH / 2;
  const part = (id: string, name: string, size: Vec3, pos: Vec3, material: CustomPart["material"]): CustomPart => ({ id: `D${i}${id}`, name, size, pos, material });
  return [
    // the open box the drawer runs in, built on the brackets
    part("B", "Box bottom", [DW - 2 * t, t, DD - 2 * t], [wx, yb + t / 2, pz], "board"),
    part("L", "Box side", [t, DH, DD], [wx - DW / 2 + t / 2, y, pz], "board"),
    part("R", "Box side", [t, DH, DD], [wx + DW / 2 - t / 2, y, pz], "board"),
    part("K", "Box back", [DW - 2 * t, DH - 24, t], [wx, y, pz - DD / 2 + t / 2], "board"),
    part("U", "Drawer runner", [12, 30, DD - 40], [wx - RUN_X, yb + RUN_DY, pz], "metal"),
    part("V", "Drawer runner", [12, 30, DD - 40], [wx + RUN_X, yb + RUN_DY, pz], "metal"),
    // the drawer itself, built on the floor
    part("F", "Drawer front", [DW - 6, DH - 10, t], [wx, y, frontZ + t / 2], "board"),
    part("X", "Drawer side", [t, DSH, DSL], [wx - DSX, dy, frontZ - DSL / 2], "board"),
    part("Y", "Drawer side", [t, DSH, DSL], [wx + DSX, dy, frontZ - DSL / 2], "board"),
    part("O", "Drawer bottom", [2 * DSX - t + 12, 6, DSL], [wx, yb + DRAWER_DY + 12, frontZ - DSL / 2], "board"),
    part("H", "Drawer back", [2 * DSX + t, DSH, t], [wx, dy, frontZ - DSL - t / 2], "board"),
  ];
}

/** The drawer manual's steps, once its brackets are up. `which` names the drawer when there is more than one. */
function drawerSteps(i: number, yb: number, bay: Bay, which?: string): CustomStep[] {
  const t = DT;
  const wx = (bay.xl + bay.xr) / 2;
  const { pz } = bay;
  const FRONT_Z = pz + DD / 2; // where the drawer front meets the front edge of the box sides
  const the = which ? `the ${which} drawer` : "the drawer";
  const id = (s: string) => `D${i}${s}`;
  const halfX = (DW - 2 * t) / 2;
  const halfZ = (DD - 2 * t) / 2;
  const side = (sx: number) => (sx < 0 ? id("L") : id("R"));
  const dside = (sx: number) => (sx < 0 ? id("X") : id("Y"));
  const both = (fn: (sx: number) => CustomFix): CustomFix[] => [-1, 1].map(fn);
  // the box: corner screws on top of the bottom, the pins under it, cams near the bottom of each side
  const screws = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [wx + sx * (halfX - 22), yb + t, pz + sz * (halfZ - 22)] as Vec3));
  const under = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [wx + sx * (halfX - 4), yb, pz + sz * (halfZ - 60)] as Vec3));
  const inner = (sx: number, spots: [number, number][]): Vec3[] => spots.map(([dy, z]) => [wx + sx * (DW / 2 - t), yb + dy, z]);
  const camSpots: [number, number][] = [[36, pz - (DD / 2 - 28)], [36, pz + (DD / 2 - 28)]];
  const postAt = (sx: number) => (sx < 0 ? bay.xl : bay.xr);
  const post = (sx: number) => (sx < 0 ? bay.pl : bay.pr);
  // the drawer: built face down on the floor, then slid in
  const yd = yb + DRAWER_DY;
  const backZ = FRONT_Z - DSL - t;
  const dowelYs = [yd + 20, yd + DSH - 20];
  const boltYs = [yd + 45, yd + DSH - 45];
  const onDSide = (sx: number, ys: number[], z: number, face: number): Vec3[] => ys.map((y) => [wx + sx * (DSX + face * (t / 2 - 2)), y, z]);
  const floor = { id: `drawer${i}`, at: [wx, yd + DSH / 2, FRONT_Z - DSL / 2] as Vec3 };
  return [
    {
      title: `Fit four screws in the ${which ? `${which} drawer ` : ""}box bottom`,
      detail: "One near each corner, on the top face. Drive each one in straight, and stop while some thread still shows. A crooked screw, or one driven all the way in, will not seat.",
      add: [id("B")],
      fix: [fx("screw", screws, [0, -1, 0], id("B"), { len: 30, dia: 6, name: "Corner screw" })],
      tools: ["screwdriver"],
      scene: { id: `box${i}`, at: [wx, yb, pz] },
      from: { [id("B")]: [0, 0, 300] },
    },
    {
      title: `Lower the box bottom onto the brackets`,
      detail: "Screws facing up. Let it rest on both brackets, flush at the front.",
      bring: [id("B")],
      from: { [id("B")]: [0, 300, 0] },
      kind: "join",
    },
    {
      title: `Pin the box bottom to the brackets`,
      detail: "From underneath, press a threaded insert into each of the four holes, then screw a pin into each one. The pins keep the box from sliding off the brackets.",
      fix: [
        fx("dowel", under, [0, 1, 0], id("B"), { len: 12, dia: 8, name: "Threaded insert" }),
        fx("pin", under.map(([a, b, c]) => [a, b - 2, c] as Vec3), [0, 1, 0], id("B"), { name: "Pin" }),
      ],
      kind: "shelves",
    },
    {
      title: `Hook on the box sides and lock them`,
      detail: "Hook a side onto the screws at each end and fold it up. Lock each corner with a cam, arrow toward the edge.",
      add: [id("L"), id("R")],
      fix: both((sx) => fx("cam", inner(sx, camSpots), [sx, 0, 0], side(sx), { name: "Cam lock" })),
      tools: ["screwdriver"],
      from: { [id("L")]: [-80, 40, 0], [id("R")]: [80, 40, 0] },
    },
    {
      title: `Fix the box sides to the posts`,
      detail: "Push a nut into the keyhole on each post, level with the hole near the top of the side, and slide it down to lock. Set a plate over each nut, then screw through the side into the plate with the allen key.",
      fix: [
        ...both((sx) => fx("nut", [[postAt(sx) - sx * (POST_W / 2), yb + FIX_DY, pz]], [sx, 0, 0], post(sx), { name: "Keyhole nut" })),
        ...both((sx) => fx("plate", [[postAt(sx) - sx * (POST_W / 2 + 4), yb + FIX_DY, pz]], [sx, 0, 0], post(sx), { len: 40, dia: 24, name: "Fixing plate" })),
        ...both((sx) => fx("screw", inner(sx, [[FIX_DY, pz]]), [sx, 0, 0], side(sx), { len: 36, dia: 6, name: "Fixing screw", mate: post(sx) })),
      ],
      tools: ["allen"],
      kind: "screws",
    },
    {
      title: `Fit the box back`,
      detail: "Hook a wire holder into the hole near the top back corner of each side, then lower the back panel in behind them.",
      add: [id("K")],
      fix: both((sx) => fx("clip", inner(sx, [[DH - 20, pz - DD / 2 + 30]]), [sx, 0, 0], side(sx), { len: 110, dia: 3, name: "Wire holder" })),
      from: { [id("K")]: [0, 260, 0] },
    },
    {
      title: `Build ${the}: sides onto the front`,
      detail: "On a rug, front face down. Tap two dowels into the front end of each side and screw four cam bolts into the front, then push the sides onto them.",
      add: [id("F"), id("X"), id("Y")],
      fix: [
        ...both((sx) => fx("dowel", onDSide(sx, dowelYs, FRONT_Z, 0), [0, 0, 1], dside(sx), { name: "Dowel", mate: id("F") })),
        ...both((sx) => fx("camScrew", onDSide(sx, boltYs, FRONT_Z + 2, 0), [0, 0, -1], id("F"), { name: "Cam bolt", mate: dside(sx) })),
      ],
      tools: ["screwdriver", "hammer"],
      scene: floor,
      pose: "-z",
      from: { [id("F")]: [0, 0, 240], [id("X")]: [0, 0, -260], [id("Y")]: [0, 0, -260] },
    },
    {
      title: `Lock the drawer cams`,
      detail: "Four, two in each side, arrow toward the front.",
      fix: both((sx) => fx("cam", onDSide(sx, boltYs, FRONT_Z - 30, -1), [sx, 0, 0], dside(sx), { name: "Cam lock" })),
      tools: ["screwdriver"],
      scene: floor,
    },
    {
      title: `Slide in the drawer bottom and lay on the back`,
      detail: "Slide the bottom down the grooves in the sides until it reaches the front. Then set the back on the ends of the sides, its lip over the edge of the bottom.",
      add: [id("O"), id("H")],
      scene: floor,
      from: { [id("O")]: [0, 0, -380], [id("H")]: [0, 0, -240] },
    },
    {
      title: `Nail the drawer back on`,
      detail: "Two nails at each end, into the sides.",
      fix: both((sx) => fx("nail", onDSide(sx, [yd + 25, yd + DSH - 25], backZ, 0), [0, 0, 1], id("H"), { name: "Nail", mate: dside(sx) })),
      tools: ["hammer"],
      scene: floor,
    },
    {
      title: `Fit the ring pull`,
      detail: "Push the backing ring into the hole in the front from inside, then press the pull in from the outside until it clicks.",
      fix: [
        fx("plug", [[wx, yb + DH / 2, FRONT_Z]], [0, 0, 1], id("F"), { len: 10, dia: 30, name: "Pull backing", included: true }),
        fx("plug", [[wx, yb + DH / 2, FRONT_Z + t + 2]], [0, 0, -1], id("F"), { len: 6, dia: 34, name: "Ring pull", included: true }),
      ],
      scene: floor,
      kind: "general",
    },
    {
      title: `Cap the spare holes`,
      detail: "A cap in each of the four holes near the back of the sides.",
      fix: both((sx) => fx("cap", onDSide(sx, [yd + DSH / 2 - 25, yd + DSH / 2 + 25], backZ + 40, -1), [sx, 0, 0], dside(sx), { name: "Hole cap" })),
      scene: floor,
      kind: "general",
    },
    {
      title: `Screw the runners into the box`,
      detail: "One along the bottom of each side, inside, the clip end at the front. Two screws each.",
      add: [id("U"), id("V")],
      fix: both((sx) => fx("screw", inner(sx, [[RUN_DY, pz - 140], [RUN_DY, pz + 140]]), [sx, 0, 0], side(sx), { len: 12, dia: 4, name: "Runner screw" })),
      tools: ["screwdriver"],
      pose: "+y",
      from: { [id("U")]: [0, 0, 300], [id("V")]: [0, 0, 300] },
    },
    {
      title: `Slide in ${the}`,
      detail: "Pull the runners out, set the drawer on them and hook the back on. Under the front, press a locking plate onto each runner and turn its lever until it catches. Turn the wheel on the lock to level the front.",
      bring: ["F", "X", "Y", "O", "H"].map(id),
      fix: both((sx) => fx("plate", [[wx + sx * (DSX - 30), yd, FRONT_Z - 40]], [0, 1, 0], id("O"), { len: 60, dia: 14, name: "Locking plate" })).concat(
        both((sx) => fx("clip", [[wx + sx * (DSX - 30), yd - 4, FRONT_Z - 40]], [0, 1, 0], id("O"), { name: "Locking lever" })),
      ),
      from: { [id("F")]: [0, 0, 460] },
      kind: "drawer",
    },
  ];
}

/** 091.581.52: three posts. The 40 cm shelves fill the left bay. Drawers, the rail and the 80 cm shelves fill the right. */
function wide(s: ProductSpec): CustomParams {
  const H = Math.round(s.size.h * 10) || 2220;
  const xL = -660;
  const xM = -200;
  const xR = 660;
  const nx = (xL + xM) / 2;
  const wx = (xM + xR) / 2;
  const pz = -200;
  const postH = H - 40;
  const postY = 24 + postH / 2;
  // the keyholes each thing hangs on: the drawer boxes take two each, their bracket's and their fixing's
  const NARROW = [0, 2, 4, 6, 8].map((i) => keyhole(postY, i) + 20);
  const WIDE_SHELVES = [8, 9].map((i) => keyhole(postY, i) + 20);
  const DRAWERS = [0, 2].map((i) => keyhole(postY, i) + 8);
  const RAIL_Y = keyhole(postY, 6);
  const NARROW_W = 400;
  const bay: Bay = { xl: xM, xr: xR, pz, pl: "PM", pr: "PR" };

  const parts: CustomPart[] = [];
  const add = (id: string, name: string, size: Vec3, pos: Vec3, shape?: "cyl", material?: CustomPart["material"]) => {
    parts.push({ id, name, size, pos, shape, material });
  };
  for (const p of [
    { tag: "L", x: xL },
    { tag: "M", x: xM },
    { tag: "R", x: xR },
  ]) {
    add(`F${p.tag}`, "Floor plate", [110, 16, 110], [p.x, 8, pz], "cyl", "metal");
    parts.push({ id: `P${p.tag}`, name: "Post", size: [POST_W, postH, POST_D], pos: [p.x, postY, pz], material: "metal", pieces: postPieces(postH) });
    add(`C${p.tag}`, "Ceiling plate", [120, 14, 120], [p.x, H - 7, pz], "cyl", "metal");
  }
  NARROW.forEach((y, i) => {
    add(`B${i}L`, "Bracket", [70, 16, 460], [xL + BRACKET_X, y - 20, pz], undefined, "metal");
    add(`B${i}M`, "Bracket", [70, 16, 460], [xM - BRACKET_X, y - 20, pz], undefined, "metal");
    add(`N${i}`, "40 cm shelf", [NARROW_W, SHELF_T, SHELF_D], [nx, y, pz], undefined, "board");
  });
  DRAWERS.forEach((yb, i) => {
    add(`G${i}M`, "Bracket", [70, 16, 460], [xM + BRACKET_X, yb - 8, pz], undefined, "metal");
    add(`G${i}R`, "Bracket", [70, 16, 460], [xR - BRACKET_X, yb - 8, pz], undefined, "metal");
    parts.push(...drawerParts(i, yb, bay));
  });
  WIDE_SHELVES.forEach((y, i) => {
    add(`E${i}M`, "Bracket", [70, 16, 460], [xM + BRACKET_X, y - 20, pz], undefined, "metal");
    add(`E${i}R`, "Bracket", [70, 16, 460], [xR - BRACKET_X, y - 20, pz], undefined, "metal");
    add(`W${i}`, "80 cm shelf", [SHELF_W, SHELF_T, SHELF_D], [wx, y, pz], undefined, "board");
  });
  add("HM", "Rail holder", [36, 28, 40], [xM + POST_W / 2 + 18, RAIL_Y, pz], undefined, "metal");
  add("HR", "Rail holder", [36, 28, 40], [xR - POST_W / 2 - 18, RAIL_Y, pz], undefined, "metal");
  parts.push({ id: "RL", name: "Clothes rail", size: [22, 780, 22], pos: [wx, RAIL_Y, pz], shape: "cyl", rot: [0, 0, Math.PI / 2], material: "metal" });

  const bracketScrews = (y: number, mounts: [number, number, string, string][]): CustomFix[] =>
    mounts.flatMap(([x, face, tag, bracket]) => postMount(`P${tag}`, bracket, x, face, y, pz, "Bracket"));

  const narrowWhere = ["lowest", "next", "middle", "upper", "top"];
  const narrowPair = (i: number): CustomStep[] => [
    {
      title: `Fit the ${narrowWhere[i]} pair of brackets in the narrow bay`,
      detail: `${BRACKET_DETAIL} On the thin upper tube, clip a shoe from the post's bag into the slot first.`,
      add: [`B${i}L`, `B${i}M`],
      fix: bracketScrews(NARROW[i] - 20, [[xL, 1, "L", `B${i}L`], [xM, -1, "M", `B${i}M`]]),
      tools: ["allen"],
      from: { [`B${i}L`]: [-80, 0, 80], [`B${i}M`]: [80, 0, 80] },
    },
    {
      title: `Put on the ${narrowWhere[i]} 40 cm shelf`,
      detail: i === 0 ? SHELF_DETAIL : `${SHELF_DETAIL} Shelves go on from the bottom up.`,
      add: [`N${i}`],
      fix: shelfPins(`N${i}`, [nx - (NARROW_W / 2 - 20), nx + (NARROW_W / 2 - 20)], NARROW[i], pz),
      kind: "shelves",
      from: { [`N${i}`]: [0, 160, 40] },
    },
  ];
  const wideWhere = ["lower", "top"];
  const widePair = (i: number): CustomStep[] => [
    {
      title: `Fit the brackets for the ${wideWhere[i]} 80 cm shelf`,
      detail: BRACKET_DETAIL,
      add: [`E${i}M`, `E${i}R`],
      fix: bracketScrews(WIDE_SHELVES[i] - 20, [[xM, 1, "M", `E${i}M`], [xR, -1, "R", `E${i}R`]]),
      tools: ["allen"],
      from: { [`E${i}M`]: [-80, 0, 80], [`E${i}R`]: [80, 0, 80] },
    },
    {
      title: `Put on the ${wideWhere[i]} 80 cm shelf`,
      detail: SHELF_DETAIL,
      add: [`W${i}`],
      fix: shelfPins(`W${i}`, [wx - (SHELF_W / 2 - 20), wx + (SHELF_W / 2 - 20)], WIDE_SHELVES[i], pz),
      kind: "shelves",
      from: { [`W${i}`]: [0, 160, 40] },
    },
  ];
  const drawer = (i: number, which: string): CustomStep[] => [
    {
      title: `Fit the brackets for the ${which} drawer`,
      detail: BRACKET_DETAIL,
      add: [`G${i}M`, `G${i}R`],
      fix: bracketScrews(DRAWERS[i] - 8, [[xM, 1, "M", `G${i}M`], [xR, -1, "R", `G${i}R`]]),
      tools: ["allen"],
      from: { [`G${i}M`]: [-80, 0, 80], [`G${i}R`]: [80, 0, 80] },
    },
    ...drawerSteps(i, DRAWERS[i], bay, which),
  ];

  const steps: CustomStep[] = [
    // the narrow bay is levelled on its lowest 40 cm shelf, the wide bay on its lower 80 cm shelf
    ...postRun({
      H,
      postY,
      postH,
      pz,
      posts: [
        { tag: "L", x: xL, name: "first post", faces: [1] },
        {
          tag: "M",
          x: xM,
          name: "middle post",
          faces: [-1, 1],
          gap: { mm: xM - xL, why: "That gap takes the five 40 cm shelves. They are on the left in this guide. Swap this gap with the next one if you want the narrow bay on the right." },
        },
        { tag: "R", x: xR, name: "third post", faces: [-1], gap: { mm: xR - xM, why: "That gap takes the two drawers, the clothes rail and the two 80 cm shelves." } },
      ],
      firstShelf: (i) => (i === 1 ? narrowPair(0) : widePair(0)),
    }),
    ...NARROW.slice(1).flatMap((_, k) => narrowPair(k + 1)),
    ...drawer(0, "first"),
    ...drawer(1, "second"),
    {
      title: "Drop a nut in for the clothes rail",
      detail: "One in the middle post and one in the right post, in the gap above the drawers, so shirts can hang.",
      fix: [postMount("PM", "HM", xM, 1, RAIL_Y, pz, "Holder")[0], postMount("PR", "HR", xR, -1, RAIL_Y, pz, "Holder")[0]],
    },
    {
      title: "Screw a holder to each post of the wide bay",
      detail: "The holder hooks into the nut. Tighten it with the allen key.",
      add: ["HM", "HR"],
      fix: [postMount("PM", "HM", xM, 1, RAIL_Y, pz, "Holder")[1], postMount("PR", "HR", xR, -1, RAIL_Y, pz, "Holder")[1]],
      tools: ["allen"],
    },
    {
      title: "Lay the rail in the holders",
      detail: "Rest the tube in both holders and tighten the screw under each one.",
      add: ["RL"],
      fix: [-1, 1].map((sx) => fx("screw", [[wx + sx * (780 / 2 - 12), RAIL_Y - 14, pz]], [0, 1, 0], "RL", { len: 20, dia: 4, name: "Rail screw" })),
      tools: ["screwdriver"],
      from: { RL: [0, -200, 0] },
    },
    ...widePair(1),
  ];

  steps.push({
    title: "Cover the spare holes",
    detail: "Push a cover into every keyhole you are not using and slide it down. Each post comes with 20.",
    fix: [
      ...holeCovers("PL", xL, postY, pz, { 1: NARROW.map((y) => y - 20) }),
      ...holeCovers("PM", xM, postY, pz, { [-1]: NARROW.map((y) => y - 20), 1: [...DRAWERS.flatMap((yb) => [yb - 8, yb + FIX_DY]), ...WIDE_SHELVES.map((y) => y - 20), RAIL_Y] }),
      ...holeCovers("PR", xR, postY, pz, { [-1]: [...DRAWERS.flatMap((yb) => [yb - 8, yb + FIX_DY]), ...WIDE_SHELVES.map((y) => y - 20), RAIL_Y] }),
    ],
    kind: "general",
  });

  return { parts, steps };
}

/** 504.339.68: the drawer bought alone, on posts and brackets that come in their own boxes. */
function drawerAlone(): CustomParams {
  const H = 2220;
  const postH = H - 40;
  const postY = 24 + postH / 2;
  const bay: Bay = { xl: -SPAN / 2, xr: SPAN / 2, pz: 0, pl: "PM", pr: "PR" };
  const yb = keyhole(postY, 1) + 8;
  const parts: CustomPart[] = [
    // the posts stand on their floor plates, as in the post manual, so they sit at the same height as in the wardrobes
    { id: "FM", name: "Floor plate", size: [110, 16, 110], pos: [bay.xl, 8, 0], shape: "cyl", material: "metal", extra: true },
    { id: "FR", name: "Floor plate", size: [110, 16, 110], pos: [bay.xr, 8, 0], shape: "cyl", material: "metal", extra: true },
    { id: "PM", name: "Post", size: [POST_W, postH, POST_D], pos: [bay.xl, postY, 0], material: "metal", pieces: postPieces(postH), extra: true },
    { id: "PR", name: "Post", size: [POST_W, postH, POST_D], pos: [bay.xr, postY, 0], material: "metal", pieces: postPieces(postH), extra: true },
    { id: "G0M", name: "Bracket", size: [70, 16, 460], pos: [bay.xl + BRACKET_X, yb - 8, 0], material: "metal", extra: true },
    { id: "G0R", name: "Bracket", size: [70, 16, 460], pos: [bay.xr - BRACKET_X, yb - 8, 0], material: "metal", extra: true },
    ...drawerParts(0, yb, bay),
  ];
  const steps: CustomStep[] = [
    {
      title: "Put up the posts and the brackets",
      detail: "They come in their own boxes, with their own instructions. Two posts 86 cm apart, centre to centre, and a bracket on each at the height you want the drawer, open side up.",
      add: ["FM", "FR", "PM", "PR", "G0M", "G0R"],
      kind: "general",
    },
    ...drawerSteps(0, yb, bay),
  ];
  return { parts, steps };
}

function recipe(s: ProductSpec): CustomParams | null {
  if (/^drawer/i.test(s.variant)) return drawerAlone();
  if (!/wardrobe/i.test(s.variant)) return null;
  return s.size.w >= 120 ? wide(s) : section(s);
}

const family: Family = {
  names: ["ELVARLI"],
  recipe,
};
export default family;

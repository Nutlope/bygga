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

/** A post's length and centre height in a room `H` tall: 24 mm of floor plate and adjusting screw under it, 16 mm of ceiling plate over it. */
function postFit(H: number) {
  const postH = H - 40;
  return { postH, postY: 24 + postH / 2 };
}

/** The floor plate, post and ceiling plate for each post, from the post manual. `ceiling: false` leaves the ceiling plates out. */
function postParts(posts: { tag: string; x: number }[], H: number, z: number, o: { ceiling?: boolean; extra?: boolean } = {}): CustomPart[] {
  const { postH, postY } = postFit(H);
  const more = o.extra ? { extra: true } : {};
  return posts.flatMap((p): CustomPart[] => [
    { id: `F${p.tag}`, name: "Floor plate", size: [110, 16, 110], pos: [p.x, 8, z], shape: "cyl", material: "metal", ...more },
    { id: `P${p.tag}`, name: "Post", size: [POST_W, postH, POST_D], pos: [p.x, postY, z], material: "metal", pieces: postPieces(postH), ...more },
    ...(o.ceiling === false ? [] : [{ id: `C${p.tag}`, name: "Ceiling plate", size: [120, 14, 120], pos: [p.x, H - 7, z], shape: "cyl", material: "metal", ...more } as CustomPart]),
  ]);
}

/** A bracket hooked on a post: `x` is the post's centre and `face` the side of the post the bay is on. */
const bracketPart = (id: string, x: number, face: number, y: number, z: number, o: { extra?: boolean } = {}): CustomPart => ({
  id,
  name: "Bracket",
  size: [70, 16, 460],
  pos: [x + face * BRACKET_X, y, z],
  material: "metal",
  ...(o.extra ? { extra: true } : {}),
});

/** One end of a pair of brackets, or of the clothes rail: the post's tag and centre, and the side of it the bay is on. */
interface Mount {
  tag: string;
  x: number;
  face: number;
}

/** Hang a pair of brackets, `ids[k]` on `ends[k]`, with their nuts in the keyholes at `y`. */
function bracketStep(title: string, detail: string, ends: [Mount, Mount], ids: [string, string], y: number, z: number): CustomStep {
  return {
    title,
    detail,
    add: [...ids],
    fix: ends.flatMap((m, k) => postMount(`P${m.tag}`, ids[k], m.x, m.face, y, z, "Bracket")),
    tools: ["allen"],
    from: { [ids[0]]: [-80, 0, 80], [ids[1]]: [80, 0, 80] },
  };
}

/** Lay shelf `id`, `w` wide and centred on `x`, on its brackets and pin it from underneath. */
function shelfStep(title: string, detail: string, id: string, x: number, w: number, y: number, z: number): CustomStep {
  return {
    title,
    detail,
    add: [id],
    fix: shelfPins(id, [x - (w / 2 - 20), x + (w / 2 - 20)], y, z),
    kind: "shelves",
    from: { [id]: [0, 160, 40] },
  };
}

/** The clothes rail manual: a holder on each post and the rail between them. Holders are `H` plus the post's tag. */
function railParts(ends: [Mount, Mount], y: number, z: number): CustomPart[] {
  const [a, b] = ends;
  return [
    ...ends.map((m): CustomPart => ({ id: `H${m.tag}`, name: "Rail holder", size: [36, 28, 40], pos: [m.x + m.face * (POST_W / 2 + 18), y, z], material: "metal" })),
    { id: "RL", name: "Clothes rail", size: [22, b.x - a.x - 80, 22], pos: [(a.x + b.x) / 2, y, z], shape: "cyl", rot: [0, 0, Math.PI / 2], material: "metal" },
  ];
}

function railSteps(ends: [Mount, Mount], y: number, z: number, words: { nuts: string; holders: string }): CustomStep[] {
  const [a, b] = ends;
  const mount = (m: Mount) => postMount(`P${m.tag}`, `H${m.tag}`, m.x, m.face, y, z, "Holder");
  const half = (b.x - a.x - 80) / 2 - 12;
  return [
    {
      title: "Drop a nut in for the clothes rail",
      detail: words.nuts,
      fix: ends.map((m) => mount(m)[0]),
    },
    {
      title: words.holders,
      detail: "The holder hooks into the nut. Tighten it with the allen key.",
      add: ends.map((m) => `H${m.tag}`),
      fix: ends.map((m) => mount(m)[1]),
      tools: ["allen"],
    },
    {
      title: "Lay the rail in the holders",
      detail: "Rest the tube in both holders and tighten the screw under each one.",
      add: ["RL"],
      fix: [-1, 1].map((sx) => fx("screw", [[(a.x + b.x) / 2 + sx * half, y - 14, z]], [0, 1, 0], "RL", { len: 20, dia: 4, name: "Rail screw" })),
      tools: ["screwdriver"],
      from: { RL: [0, -200, 0] },
    },
  ];
}

/** The last step of the post manual. `used` lists, for each post and face, the heights of the nuts in its keyholes. */
function coverStep(posts: { tag: string; x: number; used: Record<number, number[]> }[], postY: number, z: number): CustomStep {
  return {
    title: "Cover the spare holes",
    detail: "Push a cover into every keyhole you are not using and slide it down. Each post comes with 20.",
    fix: posts.flatMap((p) => holeCovers(`P${p.tag}`, p.x, postY, z, p.used)),
    kind: "general",
  };
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
  const { postH, postY } = postFit(H);
  const SHELVES = SHELF_HOLES.map((i) => keyhole(postY, i) + 20);
  const RAIL_Y = keyhole(postY, RAIL_HOLE);
  const ends: [Mount, Mount] = [
    { tag: "L", x: -px, face: 1 },
    { tag: "R", x: px, face: -1 },
  ];
  const parts: CustomPart[] = [
    ...postParts(ends, H, pz),
    ...SHELVES.flatMap((y, i): CustomPart[] => [
      ...ends.map((m) => bracketPart(`B${i}${m.tag}`, m.x, m.face, y - 20, pz)),
      { id: `S${i}`, name: "Shelf", size: [SHELF_W, SHELF_T, SHELF_D], pos: [0, y, pz], material: "board" },
    ]),
    ...railParts(ends, RAIL_Y, pz),
  ];

  const where = ["lowest", "next", "upper", "top"];
  const bracketPair = (i: number) =>
    bracketStep(`Fit the ${where[i]} pair of brackets`, `${BRACKET_DETAIL} On the thin upper tube, clip a shoe from the post's bag into the slot first.`, ends, [`B${i}L`, `B${i}R`], SHELVES[i] - 20, pz);
  const shelf = (i: number) =>
    shelfStep(`Put on the ${where[i]} shelf`, i === 0 ? SHELF_DETAIL : `${SHELF_DETAIL} Shelves go on from the bottom up.`, `S${i}`, 0, SHELF_W, SHELVES[i], pz);
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
    ...railSteps(ends, RAIL_Y, pz, {
      nuts: "One in each post, at the height you want the rail. This combination leaves a gap here so shirts can hang.",
      holders: "Screw a holder to each post",
    }),
    ...rest.map(shelf),
    coverStep(
      ends.map((m) => ({ ...m, used: { [m.face]: [...SHELVES.map((y) => y - 20), RAIL_Y] } })),
      postY,
      pz,
    ),
  ];

  return { parts, steps };
}

/**
 * The drawer, read from its own manual (AA-2133991-5): an open box built on two brackets between two posts, then the
 * drawer built face down on the floor and slid onto runners in the box. The same in a wardrobe combination and bought alone.
 */
const DW = 780; // the box, outside
const DD = 470;
const DH = 220;
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
  const { postH, postY } = postFit(H);
  // the keyholes each thing hangs on: the drawer boxes take two each, their bracket's and their fixing's
  const NARROW = [0, 2, 4, 6, 8].map((i) => keyhole(postY, i) + 20);
  const WIDE_SHELVES = [8, 9].map((i) => keyhole(postY, i) + 20);
  const DRAWERS = [0, 2].map((i) => keyhole(postY, i) + 8);
  const RAIL_Y = keyhole(postY, 6);
  const NARROW_W = 400;
  const bay: Bay = { xl: xM, xr: xR, pz, pl: "PM", pr: "PR" };

  // each bay's two ends: the narrow bay between L and M, the wide bay between M and R
  const narrowEnds: [Mount, Mount] = [
    { tag: "L", x: xL, face: 1 },
    { tag: "M", x: xM, face: -1 },
  ];
  const wideEnds: [Mount, Mount] = [
    { tag: "M", x: xM, face: 1 },
    { tag: "R", x: xR, face: -1 },
  ];
  const pairIds = (pre: string, ends: [Mount, Mount]): [string, string] => [`${pre}${ends[0].tag}`, `${pre}${ends[1].tag}`];
  const brackets = (pre: string, ends: [Mount, Mount], y: number) => ends.map((m) => bracketPart(`${pre}${m.tag}`, m.x, m.face, y, pz));

  const parts: CustomPart[] = [
    ...postParts([{ tag: "L", x: xL }, { tag: "M", x: xM }, { tag: "R", x: xR }], H, pz),
    ...NARROW.flatMap((y, i): CustomPart[] => [
      ...brackets(`B${i}`, narrowEnds, y - 20),
      { id: `N${i}`, name: "40 cm shelf", size: [NARROW_W, SHELF_T, SHELF_D], pos: [nx, y, pz], material: "board" },
    ]),
    ...DRAWERS.flatMap((yb, i) => [...brackets(`G${i}`, wideEnds, yb - 8), ...drawerParts(i, yb, bay)]),
    ...WIDE_SHELVES.flatMap((y, i): CustomPart[] => [
      ...brackets(`E${i}`, wideEnds, y - 20),
      { id: `W${i}`, name: "80 cm shelf", size: [SHELF_W, SHELF_T, SHELF_D], pos: [wx, y, pz], material: "board" },
    ]),
    ...railParts(wideEnds, RAIL_Y, pz),
  ];

  const narrowWhere = ["lowest", "next", "middle", "upper", "top"];
  const narrowPair = (i: number): CustomStep[] => [
    bracketStep(
      `Fit the ${narrowWhere[i]} pair of brackets in the narrow bay`,
      `${BRACKET_DETAIL} On the thin upper tube, clip a shoe from the post's bag into the slot first.`,
      narrowEnds,
      pairIds(`B${i}`, narrowEnds),
      NARROW[i] - 20,
      pz,
    ),
    shelfStep(`Put on the ${narrowWhere[i]} 40 cm shelf`, i === 0 ? SHELF_DETAIL : `${SHELF_DETAIL} Shelves go on from the bottom up.`, `N${i}`, nx, NARROW_W, NARROW[i], pz),
  ];
  const wideWhere = ["lower", "top"];
  const widePair = (i: number): CustomStep[] => [
    bracketStep(`Fit the brackets for the ${wideWhere[i]} 80 cm shelf`, BRACKET_DETAIL, wideEnds, pairIds(`E${i}`, wideEnds), WIDE_SHELVES[i] - 20, pz),
    shelfStep(`Put on the ${wideWhere[i]} 80 cm shelf`, SHELF_DETAIL, `W${i}`, wx, SHELF_W, WIDE_SHELVES[i], pz),
  ];
  const drawer = (i: number, which: string): CustomStep[] => [
    bracketStep(`Fit the brackets for the ${which} drawer`, BRACKET_DETAIL, wideEnds, pairIds(`G${i}`, wideEnds), DRAWERS[i] - 8, pz),
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
    ...railSteps(wideEnds, RAIL_Y, pz, {
      nuts: "One in the middle post and one in the right post, in the gap above the drawers, so shirts can hang.",
      holders: "Screw a holder to each post of the wide bay",
    }),
    ...widePair(1),
  ];

  const narrowUsed = NARROW.map((y) => y - 20);
  const wideUsed = [...DRAWERS.flatMap((yb) => [yb - 8, yb + FIX_DY]), ...WIDE_SHELVES.map((y) => y - 20), RAIL_Y];
  steps.push(
    coverStep(
      [
        { tag: "L", x: xL, used: { 1: narrowUsed } },
        { tag: "M", x: xM, used: { [-1]: narrowUsed, 1: wideUsed } },
        { tag: "R", x: xR, used: { [-1]: wideUsed } },
      ],
      postY,
      pz,
    ),
  );

  return { parts, steps };
}

/** 504.339.68: the drawer bought alone, on posts and brackets that come in their own boxes. */
function drawerAlone(): CustomParams {
  const H = 2220;
  const { postY } = postFit(H);
  const bay: Bay = { xl: -SPAN / 2, xr: SPAN / 2, pz: 0, pl: "PM", pr: "PR" };
  const yb = keyhole(postY, 1) + 8;
  const parts: CustomPart[] = [
    // the posts stand on their floor plates, as in the post manual, so they sit at the same height as in the wardrobes
    ...postParts([{ tag: "M", x: bay.xl }, { tag: "R", x: bay.xr }], H, bay.pz, { ceiling: false, extra: true }),
    bracketPart("G0M", bay.xl, 1, yb - 8, bay.pz, { extra: true }),
    bracketPart("G0R", bay.xr, -1, yb - 8, bay.pz, { extra: true }),
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

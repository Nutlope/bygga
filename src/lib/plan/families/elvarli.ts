import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * ELVARLI wardrobe combinations, read from the post, bracket, clothes rail, shelf and drawer manuals.
 * 991.579.02 is two posts, 92 cm wide: four 80 x 51 cm shelves and one 80 cm rail, posts 860 mm apart.
 * 891.581.53 is three posts, 135 cm wide: five 40 cm shelves in the left bay (460 mm), and in the right bay
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
// hanging gap in the middle, two shelves below it and two above, which is how this combination is stocked
const SHELVES = [220, 560, 1880, 2100];
const RAIL_Y = 1450;

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
function postPieces(h: number): PartPiece[] {
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

function section(s: ProductSpec): CustomParams {
  const H = Math.round(s.size.h * 10) || 2220;
  const px = SPAN / 2;
  const pz = -200;
  const postH = H - 40;
  const postY = 24 + postH / 2;
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
      add(`B${i}${tag}`, "Bracket", [70, 16, 460], [sx * (px - 28), y - 20, pz], undefined, "metal");
    }
    add(`S${i}`, "Shelf", [SHELF_W, SHELF_T, SHELF_D], [0, y, pz], undefined, "board");
  });
  add("HL", "Rail holder", [36, 28, 40], [-px + 28, RAIL_Y, pz + 30], undefined, "metal");
  add("HR", "Rail holder", [36, 28, 40], [px - 28, RAIL_Y, pz + 30], undefined, "metal");
  parts.push({ id: "RL", name: "Clothes rail", size: [22, SPAN - 80, 22], pos: [0, RAIL_Y, pz + 30], shape: "cyl", rot: [0, 0, Math.PI / 2], material: "metal" });

  const foot = (sx: number): Vec3 => [sx * px, 16, pz];
  const ceil = (sx: number): Vec3[] => [-22, 22].map((dx) => [sx * px + dx, H - 2, pz]);

  const prep = (tag: string, sx: number): CustomFix[] => [
    fx("screw", [foot(sx)], [0, -1, 0], `P${tag}`, { len: 80, dia: 8, name: "Adjusting screw" }),
    fx("nut", [[sx * px, 28, pz]], [0, -1, 0], `P${tag}`, { name: "Adjusting nut" }),
    fx("nut", [[sx * px, postY + postH / 2 - 30, pz], [sx * px, postY - 80, pz]], [0, -1, 0], `P${tag}`, { name: "Square nut" }),
    fx("screw", [[sx * px, H - 14, pz]], [0, 1, 0], `C${tag}`, { len: 16, dia: 4, name: "Plate screw" }),
  ];
  const ceilingFix = (tag: string, sx: number): CustomFix[] => [
    fx("plug", ceil(sx).map(([x, y, z]) => [x, y + 8, z] as Vec3), [0, 1, 0], `C${tag}`, { name: "Ceiling plug" }),
    fx("screw", ceil(sx), [0, 1, 0], `C${tag}`, { len: 50, dia: 5, name: "Ceiling screw", notIncluded: true }),
  ];

  const steps: CustomParams["steps"] = [
    {
      title: "Fit the adjusting screw in the first post",
      detail: "Thread the nut onto the long screw and push it into the bottom of the post until 5 mm of thread still shows.",
      add: ["PL"],
      fix: prep("L", -1).slice(0, 2),
      tools: ["wrench"],
    },
    {
      title: "Drop a square nut into each tube",
      detail: "One in the top of the outer tube and one in the top of the inner tube, sitting in the slot.",
      fix: prep("L", -1).slice(2, 3),
    },
    {
      title: "Lower the post onto its floor plate",
      detail: "The round pad goes on the floor, the plate on top of it, and the post slides down onto the screw.",
      add: ["FL"],
      from: { PL: [0, 180, 0] },
    },
    {
      title: "Screw on the ceiling plate",
      detail: "One screw up through the plate into the top of the post, then press the cover on until it sits flat. Don't leave a gap under the cover.",
      add: ["CL"],
      fix: prep("L", -1).slice(3),
      tools: ["screwdriver"],
      from: { CL: [0, 160, 0] },
    },
    {
      title: "Extend the post to the ceiling and lock it",
      detail: "Two people. Stand it up with the keyholes turned toward the other post, before it is tightened to the ceiling. Slide the inner tube up until the plate meets the ceiling, and lock it with the allen key. The floor plate has to sit flat, not tipped.",
      people: 2,
      tools: ["allen"],
    },
    {
      title: "Bring the plate up flat against the ceiling",
      detail: "Raise it a little more if you can see a gap, then lock both screws. The plate has to meet the ceiling all the way round.",
      people: 2,
      tools: ["allen"],
    },
    {
      title: "Stand it out from the wall",
      detail: "These shelves are 51 cm deep and centred on the post, so the back of the shelf is about half that depth behind the post. Leave at least 254 mm between the post and the wall, or the shelf will hit the wall.",
      tools: ["tape"],
    },
    {
      title: "Screw the post to the ceiling",
      detail: "Two screws through the plate, the post plumb. Ceiling screws and plugs are not in the box: use ones made for your ceiling, and not into a ceiling rose. Until this is done the post can fall.",
      fix: ceilingFix("L", -1),
      people: 2,
      tools: ["drill", "level", "screwdriver"],
    },
    {
      title: "Level the floor plate",
      detail: "Turn the plate until it sits flat on the floor, with no rock.",
      tools: ["level"],
    },
    {
      title: "Tighten the post between floor and ceiling",
      detail: "Hold the post and turn the nut with the spanner until it is firm. No more than 40 mm of thread should show under the post.",
      tools: ["wrench"],
    },
    {
      title: "Prepare the second post the same way",
      detail: "Adjusting screw with 5 mm showing, a square nut in each tube, floor plate on, ceiling plate screwed on and its cover pressed flat.",
      add: ["PR", "FR", "CR"],
      fix: prep("R", 1),
      tools: ["wrench", "screwdriver"],
      from: { PR: [220, 0, 0], FR: [220, 0, 0], CR: [220, 80, 0] },
    },
    {
      title: "Extend the second post and lock it",
      detail: "Two people. Slide the inner tube up and lock it with the allen key. Its floor plate has to sit flat too.",
      people: 2,
      tools: ["allen"],
    },
    {
      title: "Line it up with the first post",
      detail: "The same distance out from the wall, both ceiling plates turned the same way, and the keyholes turned toward the other post, the same as the first. Do that before it is tightened to the ceiling.",
      tools: ["tape"],
    },
    {
      title: "Set the posts 860 mm apart",
      detail: "Centre to centre. That is the spacing for these 80 cm shelves. Don't push the second post into a corner where the shelf cannot pass.",
      tools: ["tape"],
    },
    {
      title: "Screw the second post to the ceiling",
      detail: "Two screws, the post plumb, same as the first. Plugs and screws are not in the box.",
      fix: ceilingFix("R", 1),
      people: 2,
      tools: ["drill", "level", "screwdriver"],
    },
    {
      title: "Level its floor plate and tighten it",
      detail: "Flat on the floor, then the spanner on the nut until the post is firm, with no more than 40 mm of thread showing. Lock the inner tube again once it is tight.",
      tools: ["level", "wrench", "allen"],
    },
  ];

  SHELVES.forEach((y, i) => {
    const where = ["lowest", "next", "upper", "top"][i];
    steps.push({
      title: i === 0 ? "Fit the lowest pair of brackets" : `Fit the ${where} pair of brackets`,
      detail: "Drop a nut into the slot on each post at this height, hook a bracket over it and tighten the screw. The open side of the bracket faces up. On the thin upper tube, clip a shoe from the post's bag into the slot first.",
      add: [`B${i}L`, `B${i}R`],
      fix: [-1, 1].map((sx) => fx("screw", [[sx * (px - 8), y - 20, pz]], [-sx, 0, 0], sx < 0 ? "PL" : "PR", { len: 16, dia: 5, name: "Bracket screw" })),
      tools: ["allen"],
      from: { [`B${i}L`]: [-80, 0, 80], [`B${i}R`]: [80, 0, 80] },
    });
  });

  steps.push(
    {
      title: "Drop a nut in for the clothes rail",
      detail: "One in each post, at the height you want the rail. This combination leaves a gap here so shirts can hang.",
      fix: [-1, 1].map((sx) => fx("nut", [[sx * px, RAIL_Y, pz]], [0, -1, 0], sx < 0 ? "PL" : "PR", { name: "Square nut" })),
    },
    {
      title: "Screw a holder to each post",
      detail: "The holder hooks into the nut. Tighten it with the allen key.",
      add: ["HL", "HR"],
      fix: [-1, 1].map((sx) => fx("screw", [[sx * (px - 20), RAIL_Y, pz + 10]], [-sx, 0, 0], sx < 0 ? "PL" : "PR", { len: 16, dia: 5, name: "Holder screw" })),
      tools: ["allen"],
    },
    {
      title: "Lay the rail in the holders",
      detail: "Rest the tube in both holders and tighten the screw under each one.",
      add: ["RL"],
      fix: [-1, 1].map((sx) => fx("screw", [[sx * (SPAN / 2 - 70), RAIL_Y, pz + 30]], [0, 1, 0], "RL", { len: 20, dia: 4, name: "Rail screw" })),
      tools: ["screwdriver"],
      from: { RL: [0, -200, 0] },
    },
  );

  const shelfTitle = ["Pin the lowest shelf and lower it on", "Pin the second shelf and lower it on", "Pin the third shelf and lower it on", "Pin the top shelf and lower it on"];
  SHELVES.forEach((y, i) => {
    const pins = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (SHELF_W / 2 - 40), y - SHELF_T / 2, pz + sz * (SHELF_D / 2 - 40)] as Vec3));
    steps.push({
      title: shelfTitle[i],
      detail: "Press a threaded insert into each of the four holes underneath, screw in a pin, and lower the shelf onto the brackets. Shelves go on from the bottom up. Don't lean anything against the posts while you do this.",
      add: [`S${i}`],
      fix: [fx("pin", pins, [0, -1, 0], `S${i}`, { name: "Shelf pin" })],
      from: { [`S${i}`]: [0, 160, 40] },
    });
  });

  steps.push({
    title: "Cover the spare holes",
    detail: "Press a cover into every slot you are not using. Each post comes with 20.",
  });

  return { parts, steps };
}

/** 891.581.53: three posts. The 40 cm shelves fill the left bay. Drawers, the rail and the 80 cm shelves fill the right. */
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
  const NARROW = [260, 640, 1040, 1480, 1920];
  const WIDE_SHELVES = [1820, 2080];
  const DRAWERS = [200, 480];
  const RAIL_Y = 1500;
  const NARROW_W = 400;
  const DW = 780;
  const DD = 470;
  const DH = 200;
  const t = 16;

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
    add(`B${i}L`, "Bracket", [70, 16, 460], [xL + 28, y - 20, pz], undefined, "metal");
    add(`B${i}M`, "Bracket", [70, 16, 460], [xM - 28, y - 20, pz], undefined, "metal");
    add(`N${i}`, "40 cm shelf", [NARROW_W, SHELF_T, SHELF_D], [nx, y, pz], undefined, "board");
  });
  DRAWERS.forEach((yb, i) => {
    const y = yb + DH / 2;
    add(`G${i}M`, "Bracket", [70, 16, 460], [xM + 28, yb - 8, pz], undefined, "metal");
    add(`G${i}R`, "Bracket", [70, 16, 460], [xR - 28, yb - 8, pz], undefined, "metal");
    add(`D${i}B`, "Drawer bottom", [DW - 2 * t, t, DD - 2 * t], [wx, yb + t / 2, pz], undefined, "board");
    add(`D${i}L`, "Drawer side", [t, DH, DD], [wx - DW / 2 + t / 2, y, pz], undefined, "board");
    add(`D${i}R`, "Drawer side", [t, DH, DD], [wx + DW / 2 - t / 2, y, pz], undefined, "board");
    add(`D${i}K`, "Drawer back", [DW - 2 * t, DH - 24, t], [wx, y, pz - DD / 2 + t / 2], undefined, "board");
    add(`D${i}F`, "Drawer front", [DW, DH, t], [wx, y, pz + DD / 2 - t / 2], undefined, "board");
    add(`D${i}P`, "Drawer panel", [DW - 3 * t, 4, DD - 3 * t], [wx, yb + 28, pz], undefined, "board");
    add(`D${i}U`, "Drawer runner", [12, 14, DD - 40], [wx - DW / 2 + t + 12, y, pz], undefined, "metal");
    add(`D${i}V`, "Drawer runner", [12, 14, DD - 40], [wx + DW / 2 - t - 12, y, pz], undefined, "metal");
    add(`D${i}A`, "Damper", [26, 20, 36], [wx - 160, yb + DH - 28, pz - DD / 2 + 36], undefined, "metal");
    add(`D${i}C`, "Damper", [26, 20, 36], [wx + 160, yb + DH - 28, pz - DD / 2 + 36], undefined, "metal");
    add(`D${i}S`, "Side fitting", [18, 36, 14], [wx - DW / 2 + t, y, pz - DD / 2 + 28], undefined, "metal");
    add(`D${i}T`, "Side fitting", [18, 36, 14], [wx + DW / 2 - t, y, pz - DD / 2 + 28], undefined, "metal");
  });
  WIDE_SHELVES.forEach((y, i) => {
    add(`E${i}M`, "Bracket", [70, 16, 460], [xM + 28, y - 20, pz], undefined, "metal");
    add(`E${i}R`, "Bracket", [70, 16, 460], [xR - 28, y - 20, pz], undefined, "metal");
    add(`W${i}`, "80 cm shelf", [SHELF_W, SHELF_T, SHELF_D], [wx, y, pz], undefined, "board");
  });
  add("HM", "Rail holder", [36, 28, 40], [xM + 28, RAIL_Y, pz + 30], undefined, "metal");
  add("HR", "Rail holder", [36, 28, 40], [xR - 28, RAIL_Y, pz + 30], undefined, "metal");
  parts.push({ id: "RL", name: "Clothes rail", size: [22, 780, 22], pos: [wx, RAIL_Y, pz + 30], shape: "cyl", rot: [0, 0, Math.PI / 2], material: "metal" });

  const ceil = (x: number): Vec3[] => [-22, 22].map((dx) => [x + dx, H - 2, pz]);
  const prep = (tag: string, x: number): CustomFix[] => [
    fx("screw", [[x, 16, pz]], [0, -1, 0], `P${tag}`, { len: 80, dia: 8, name: "Adjusting screw" }),
    fx("nut", [[x, 28, pz]], [0, -1, 0], `P${tag}`, { name: "Adjusting nut" }),
    fx("nut", [[x, postY + postH / 2 - 30, pz], [x, postY - 80, pz]], [0, -1, 0], `P${tag}`, { name: "Square nut" }),
    fx("screw", [[x, H - 14, pz]], [0, 1, 0], `C${tag}`, { len: 16, dia: 4, name: "Plate screw" }),
  ];
  const ceilingFix = (tag: string, x: number): CustomFix[] => [
    fx("plug", ceil(x).map(([a, b, c]) => [a, b + 8, c] as Vec3), [0, 1, 0], `C${tag}`, { name: "Ceiling plug" }),
    fx("screw", ceil(x), [0, 1, 0], `C${tag}`, { len: 50, dia: 5, name: "Ceiling screw", notIncluded: true }),
  ];
  const bracketScrews = (y: number, mounts: [number, number, string][]): CustomFix[] =>
    mounts.map(([x, face, tag]) => fx("screw", [[x + face * 8, y, pz]], [face, 0, 0], `P${tag}`, { len: 16, dia: 5, name: "Bracket screw" }));

  const steps: CustomParams["steps"] = [
    {
      title: "Fit the adjusting screw in the first post",
      detail: "Thread the nut onto the long screw and push it into the bottom of the post until 5 mm of thread still shows.",
      add: ["PL"],
      fix: prep("L", xL).slice(0, 2),
      tools: ["wrench"],
    },
    {
      title: "Drop a square nut into each tube",
      detail: "One in the top of the outer tube and one in the top of the inner tube, sitting in the slot.",
      fix: prep("L", xL).slice(2, 3),
    },
    {
      title: "Lower the post onto its floor plate",
      detail: "The round pad goes on the floor, the plate on top of it, and the post slides down onto the screw.",
      add: ["FL"],
      from: { PL: [0, 180, 0] },
    },
    {
      title: "Screw on the ceiling plate",
      detail: "One screw up through the plate into the top of the post, then press the cover on until it sits flat. Don't leave a gap under the cover.",
      add: ["CL"],
      fix: prep("L", xL).slice(3),
      tools: ["screwdriver"],
      from: { CL: [0, 160, 0] },
    },
    {
      title: "Extend the post to the ceiling and lock it",
      detail: "Two people. Stand it up with the keyholes turned toward the middle of the wardrobe, before it is tightened to the ceiling. Slide the inner tube up until the plate meets the ceiling, and lock it with the allen key. The floor plate has to sit flat, not tipped.",
      people: 2,
      tools: ["allen"],
    },
    {
      title: "Bring the plate up flat against the ceiling",
      detail: "Raise it a little more if you can see a gap, then lock both screws. The plate has to meet the ceiling all the way round.",
      people: 2,
      tools: ["allen"],
    },
    {
      title: "Stand it out from the wall",
      detail: "These shelves are 51 cm deep and centred on the post, so the back of the shelf is about half that depth behind the post. Leave at least 254 mm between the post and the wall, or the shelf will hit the wall.",
      tools: ["tape"],
    },
    {
      title: "Screw the post to the ceiling",
      detail: "Two screws through the plate, the post plumb. Ceiling screws and plugs are not in the box: use ones made for your ceiling, and not into a ceiling rose. Until this is done the post can fall.",
      fix: ceilingFix("L", xL),
      people: 2,
      tools: ["drill", "level", "screwdriver"],
    },
    {
      title: "Level the floor plate",
      detail: "Turn the plate until it sits flat on the floor, with no rock.",
      tools: ["level"],
    },
    {
      title: "Tighten the post between floor and ceiling",
      detail: "Hold the post and turn the nut with the spanner until it is firm. No more than 40 mm of thread should show under the post.",
      tools: ["wrench"],
    },
    {
      title: "Prepare the middle post the same way",
      detail: "Adjusting screw with 5 mm showing, a square nut in each tube, floor plate on, ceiling plate screwed on and its cover pressed flat.",
      add: ["PM", "FM", "CM"],
      fix: prep("M", xM),
      tools: ["wrench", "screwdriver"],
      from: { PM: [240, 0, 0], FM: [240, 0, 0], CM: [240, 80, 0] },
    },
    {
      title: "Extend the middle post and lock it",
      detail: "Two people. Slide the inner tube up and lock it with the allen key. Its floor plate has to sit flat too.",
      people: 2,
      tools: ["allen"],
    },
    {
      title: "Line the middle post up",
      detail: "The same distance out from the wall, and its ceiling plate turned the same way as the first. Brackets go on both faces of this post, so a row of keyholes has to face each bay. Turn it that way before it is tightened to the ceiling.",
      tools: ["tape"],
    },
    {
      title: "Set the middle post 460 mm from the first",
      detail: "Centre to centre. That gap takes the five 40 cm shelves. They are on the left in this guide. Swap this gap with the next one if you want the narrow bay on the right.",
      tools: ["tape"],
    },
    {
      title: "Screw the middle post to the ceiling",
      detail: "Two screws, the post plumb, same as the first. Plugs and screws are not in the box.",
      fix: ceilingFix("M", xM),
      people: 2,
      tools: ["drill", "level", "screwdriver"],
    },
    {
      title: "Level its floor plate and tighten it",
      detail: "Flat on the floor, then the spanner on the nut until the post is firm, with no more than 40 mm of thread showing. Lock the inner tube again once it is tight.",
      tools: ["level", "wrench", "allen"],
    },
    {
      title: "Prepare the third post the same way",
      detail: "Adjusting screw with 5 mm showing, a square nut in each tube, floor plate on, ceiling plate screwed on and its cover pressed flat.",
      add: ["PR", "FR", "CR"],
      fix: prep("R", xR),
      tools: ["wrench", "screwdriver"],
      from: { PR: [240, 0, 0], FR: [240, 0, 0], CR: [240, 80, 0] },
    },
    {
      title: "Extend the third post and lock it",
      detail: "Two people. Slide the inner tube up and lock it with the allen key. Its floor plate has to sit flat too.",
      people: 2,
      tools: ["allen"],
    },
    {
      title: "Line the third post up",
      detail: "The same distance out from the wall, ceiling plate turned the same way, and the keyholes turned toward the middle post, before it is tightened to the ceiling.",
      tools: ["tape"],
    },
    {
      title: "Set the third post 860 mm from the middle one",
      detail: "Centre to centre. That gap takes the two drawers, the clothes rail and the two 80 cm shelves. Don't push this post into a corner where the shelf cannot pass.",
      tools: ["tape"],
    },
    {
      title: "Screw the third post to the ceiling",
      detail: "Two screws, the post plumb, same as the first. Plugs and screws are not in the box.",
      fix: ceilingFix("R", xR),
      people: 2,
      tools: ["drill", "level", "screwdriver"],
    },
    {
      title: "Level its floor plate and tighten it",
      detail: "Flat on the floor, then the spanner on the nut until the post is firm, with no more than 40 mm of thread showing. Lock the inner tube again once it is tight.",
      tools: ["level", "wrench", "allen"],
    },
  ];

  const narrowWhere = ["lowest", "next", "middle", "upper", "top"];
  NARROW.forEach((y, i) => {
    steps.push({
      title: i === 0 ? "Fit the lowest pair of brackets in the narrow bay" : `Fit the ${narrowWhere[i]} pair of brackets in the narrow bay`,
      detail: "Drop a nut into the slot on the left post and the middle post at this height, hook a bracket over each and tighten the screw. The open side of the bracket faces up. On the thin upper tube, clip a shoe from the post's bag into the slot first.",
      add: [`B${i}L`, `B${i}M`],
      fix: bracketScrews(y - 20, [[xL, 1, "L"], [xM, -1, "M"]]),
      tools: ["allen"],
      from: { [`B${i}L`]: [-80, 0, 80], [`B${i}M`]: [80, 0, 80] },
    });
    const pins = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [nx + sx * (NARROW_W / 2 - 36), y - SHELF_T / 2, pz + sz * (SHELF_D / 2 - 40)] as Vec3));
    steps.push({
      title: `Pin the ${narrowWhere[i]} 40 cm shelf and lower it on`,
      detail: "Press a threaded insert into each of the four holes underneath, screw in a pin, and lower the shelf onto the brackets. Shelves go on from the bottom up. Don't lean anything against the posts while you do this.",
      add: [`N${i}`],
      fix: [fx("pin", pins, [0, -1, 0], `N${i}`, { name: "Shelf pin" })],
      from: { [`N${i}`]: [0, 160, 40] },
    });
  });

  const drawer = (i: number, yb: number, which: string) => {
    const id = (s: string) => `D${i}${s}`;
    const halfX = (DW - 2 * t) / 2;
    const halfZ = (DD - 2 * t) / 2;
    const screws = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [wx + sx * (halfX - 22), yb + t, pz + sz * (halfZ - 22)] as Vec3));
    const pins = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [wx + sx * (halfX - 55), yb, pz + sz * (halfZ - 55)] as Vec3));
    const sideX = (sx: number) => wx + sx * (DW / 2 - t / 2);
    const onSide = (sx: number, spots: [number, number][]): Vec3[] => spots.map(([dy, z]) => [sideX(sx) + sx * (t / 2 - 2), yb + dy, z]);
    const frontZ = pz + DD / 2 - t / 2;
    const camSpots: [number, number][] = [[36, pz - (DD / 2 - 28)], [36, pz + (DD / 2 - 28)]];
    const dowelSpots: [number, number][] = [[50, pz + DD / 2 - 8], [DH - 50, pz + DD / 2 - 8]];
    const capSpots: [number, number][] = [[DH / 2, pz - 80], [DH / 2, pz + 80]];
    const runnerSpots: [number, number][] = [[DH / 2 - 24, pz - 140], [DH / 2 + 24, pz + 140]];
    const bolts = [-1, 1].flatMap((sx) => [50, DH - 50].map((dy) => [wx + sx * (DW / 2 - 8), yb + dy, frontZ] as Vec3));
    const nails = [-1, 1].flatMap((sx) => [0, 1].map((k) => [wx + sx * (DW / 2 - 24), yb + DH - 4, frontZ - k * 8] as Vec3));
    steps.push(
      {
        title: `Fit the brackets for the ${which} drawer`,
        detail: "Drop a nut into the slot on the middle post and the right post at this height, hook a bracket over each and tighten the screw. The open side faces up.",
        add: [`G${i}M`, `G${i}R`],
        fix: bracketScrews(yb - 8, [[xM, 1, "M"], [xR, -1, "R"]]),
        tools: ["allen"],
        from: { [`G${i}M`]: [-80, 0, 80], [`G${i}R`]: [80, 0, 80] },
      },
      {
        title: `Fit four screws in the ${which} drawer bottom`,
        detail: "Drive each one in straight, and stop while some thread still shows. A crooked screw, or one driven all the way in, will not seat.",
        add: [id("B")],
        fix: [fx("screw", screws, [0, 1, 0], id("B"), { len: 30, dia: 6, name: "Corner screw" })],
        tools: ["screwdriver"],
      },
      {
        title: `Lower the ${which} drawer bottom onto the brackets`,
        detail: "Press a threaded insert into each of the four holes underneath, screw in a pin, and lower the bottom onto the brackets.",
        fix: [fx("pin", pins, [0, -1, 0], id("B"), { name: "Shelf pin" })],
      },
      {
        title: `Hook on the ${which} drawer sides and lock them`,
        detail: "Hook a side onto the screws at each end and fold it down. Lock each corner with a cam.",
        add: [id("L"), id("R")],
        fix: [-1, 1].map((sx) => fx("cam", onSide(sx, camSpots), [sx, 0, 0], sx < 0 ? id("L") : id("R"), { name: "Cam lock" })),
        tools: ["screwdriver"],
        from: { [id("L")]: [-80, 40, 0], [id("R")]: [80, 40, 0] },
      },
      {
        title: `Fit the ${which} drawer back`,
        detail: "Fit the two side pieces, then lower the back panel in between them.",
        add: [id("S"), id("T"), id("K")],
        from: { [id("K")]: [0, 80, -40] },
      },
      {
        title: `Fit the ${which} drawer front`,
        detail: "Put a dowel in each hole along the front edge of the sides, and a cam bolt in each hole in the front. Set the front on and lock the cams. If the back has a groove, slide the thin panel into it. If it does not, lower the panel in. Nail the four corners.",
        add: [id("F"), id("P")],
        fix: [
          ...[-1, 1].map((sx) => fx("dowel", onSide(sx, dowelSpots), [0, 0, 1], sx < 0 ? id("L") : id("R"), { name: "Dowel" })),
          fx("camScrew", bolts, [0, 0, -1], id("F"), { name: "Cam bolt" }),
          fx("cam", bolts.map(([a, b, c]) => [a, b, c - 6] as Vec3), [0, 0, -1], id("F"), { name: "Cam lock" }),
          fx("nail", nails, [0, -1, 0], id("F"), { name: "Nail" }),
        ],
        tools: ["screwdriver", "hammer"],
        from: { [id("F")]: [0, 0, 80] },
      },
      {
        title: `Fit the ${which} drawer runners`,
        detail: "Push a damper housing into each hole in the back, and a cap into each spare hole in the sides. Screw a runner along each side.",
        add: [id("U"), id("V"), id("A"), id("C")],
        fix: [
          ...[-1, 1].map((sx) => fx("cap", onSide(sx, capSpots), [sx, 0, 0], sx < 0 ? id("L") : id("R"), { name: "Hole cap" })),
          ...[-1, 1].map((sx) => fx("screw", onSide(sx, runnerSpots), [sx, 0, 0], sx < 0 ? id("L") : id("R"), { len: 12, dia: 3, name: "Runner screw" })),
        ],
        tools: ["screwdriver"],
      },
      {
        title: `Hang the ${which} drawer`,
        detail: "Set the drawer on the brackets and screw a damper to each runner.",
        fix: [
          fx("screw", [[wx - 160, yb + DH - 28, pz - DD / 2 + 36]], [0, -1, 0], id("A"), { len: 16, dia: 4, name: "Damper screw" }),
          fx("screw", [[wx + 160, yb + DH - 28, pz - DD / 2 + 36]], [0, -1, 0], id("C"), { len: 16, dia: 4, name: "Damper screw" }),
        ],
        tools: ["screwdriver"],
      },
    );
  };
  drawer(0, DRAWERS[0], "first");
  drawer(1, DRAWERS[1], "second");

  steps.push(
    {
      title: "Drop a nut in for the clothes rail",
      detail: "One in the middle post and one in the right post, in the gap above the drawers, so shirts can hang.",
      fix: [fx("nut", [[xM, RAIL_Y, pz]], [0, -1, 0], "PM", { name: "Square nut" }), fx("nut", [[xR, RAIL_Y, pz]], [0, -1, 0], "PR", { name: "Square nut" })],
    },
    {
      title: "Screw a holder to each post of the wide bay",
      detail: "The holder hooks into the nut. Tighten it with the allen key.",
      add: ["HM", "HR"],
      fix: [
        fx("screw", [[xM + 20, RAIL_Y, pz + 10]], [1, 0, 0], "PM", { len: 16, dia: 5, name: "Holder screw" }),
        fx("screw", [[xR - 20, RAIL_Y, pz + 10]], [-1, 0, 0], "PR", { len: 16, dia: 5, name: "Holder screw" }),
      ],
      tools: ["allen"],
    },
    {
      title: "Lay the rail in the holders",
      detail: "Rest the tube in both holders and tighten the screw under each one.",
      add: ["RL"],
      fix: [-1, 1].map((sx) => fx("screw", [[wx + sx * 360, RAIL_Y, pz + 30]], [0, 1, 0], "RL", { len: 20, dia: 4, name: "Rail screw" })),
      tools: ["screwdriver"],
      from: { RL: [0, -200, 0] },
    },
  );

  const wideWhere = ["lower", "top"];
  WIDE_SHELVES.forEach((y, i) => {
    steps.push({
      title: `Fit the brackets for the ${wideWhere[i]} 80 cm shelf`,
      detail: "Drop a nut into the slot on the middle post and the right post, hook a bracket over each and tighten the screw. The open side faces up.",
      add: [`E${i}M`, `E${i}R`],
      fix: bracketScrews(y - 20, [[xM, 1, "M"], [xR, -1, "R"]]),
      tools: ["allen"],
      from: { [`E${i}M`]: [-80, 0, 80], [`E${i}R`]: [80, 0, 80] },
    });
    const pins = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [wx + sx * (SHELF_W / 2 - 40), y - SHELF_T / 2, pz + sz * (SHELF_D / 2 - 40)] as Vec3));
    steps.push({
      title: `Pin the ${wideWhere[i]} 80 cm shelf and lower it on`,
      detail: "Press a threaded insert into each of the four holes underneath, screw in a pin, and lower the shelf onto the brackets.",
      add: [`W${i}`],
      fix: [fx("pin", pins, [0, -1, 0], `W${i}`, { name: "Shelf pin" })],
      from: { [`W${i}`]: [0, 160, 40] },
    });
  });

  steps.push({
    title: "Cover the spare holes",
    detail: "Press a cover into every slot you are not using. Each post comes with 20.",
  });

  return { parts, steps };
}

function recipe(s: ProductSpec): CustomParams | null {
  if (!/wardrobe/i.test(s.variant)) return null;
  return s.size.w >= 120 ? wide(s) : section(s);
}

const family: Family = {
  names: ["ELVARLI"],
  recipe,
};
export default family;

import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";
import { HW, type HwDef, type PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * PLATSA, read from its manuals. Every frame (40, 60, 120 or 180 high) goes together the same way, lying on its
 * front on a rug: the top and bottom click onto a side on fittings already in the panels, then the other side; the
 * back slides in along the grooves and is locked with eight plastic rivets. Two wall spacers press into the top's
 * back edge, the frame is stood up (two people for the tall ones), the spacer caps screw on, and two screws through
 * washers fix it to the wall. Frames side by side are joined with plates round their front edges; a small frame
 * stacks on a bigger one on four sleeves and screws. LÄTTHET legs, SPILDRA tops, HJÄLPA shelves, rails, baskets,
 * drawers and soft-closing hinges follow their own manuals. The open units are a different system: four welded
 * steel frames bolted into a tube while it lies on its side.
 * The "wardrobe with 3/4/6 doors" sets are rows of frames of different heights, read from their parts lists and
 * photos: each column built the same way, joined with plates, small frames stacked on tall ones, a SPILDRA top on
 * each low column, and on the 300 cm set frames hung on LÄTTHET suspension rails beside the stack.
 */

const t = 16; // panel thickness
const DOOR = 20;
const LEG = 100;

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, c: number, n: number) => range(n).map((i) => (n === 1 ? (a + c) / 2 : a + ((c - a) * i) / (n - 1)));

// fittings, sized so different ones stay apart in the list
const RIVET_PLUG: HwDef = { kind: "clip", len: 12, dia: 8 };
const RIVET_PIN: HwDef = { kind: "clip", len: 16, dia: 5 }; // the pin that spreads each plug
const SPACER: HwDef = { kind: "stud", len: 22, dia: 30 }; // a wall spacer: no kind of its own
const SPACER_CAP: HwDef = { kind: "cap", len: 18, dia: 26 };
const WASHER: HwDef = { kind: "washer", len: 2, dia: 22 };
const COVER: HwDef = { kind: "cap", len: 6, dia: 20 };
const JOIN_PLATE: HwDef = { kind: "angle", len: 100, dia: 24 };
const SMALL_SCREW: HwDef = { kind: "screw", len: 10, dia: 4 };
const SLEEVE: HwDef = { kind: "nut", len: 12, dia: 10 };
const STACK_SCREW: HwDef = { kind: "screw", len: 40, dia: 6 };
const ROD: HwDef = { kind: "stud", len: 40, dia: 8 };
const LEG_SLEEVE: HwDef = { kind: "nut", len: 20, dia: 12 };
const LEG_FOOT: HwDef = { kind: "foot", len: 20, dia: 14 };
const SHELF_PIN: HwDef = { kind: "pin", len: 16, dia: 6 };
const BUMPER: HwDef = { kind: "glide", len: 3, dia: 10 };
const FRAME_BOLT: HwDef = { kind: "bolt", len: 20, dia: 6 };

const fixAt = (d: HwDef, at: Vec3[], dir: Vec3, on?: string, mate?: string): CustomFix => ({ kind: d.kind, len: d.len, dia: d.dia, count: at.length, at, dir, on, mate });

/* ---------- what each guide is made of ---------- */

type Inside =
  | { kind: "shelf"; y: number } // y from the bottom of the frame, mm
  | { kind: "rail"; y: number }
  | { kind: "basket"; y: number }
  | { kind: "shoe"; y: number };

interface Frame {
  id: string;
  x: number; // centre
  y: number; // underside
  w: number;
  h: number;
  inside: Inside[];
  door?: "L" | "R"; // hinge side
  mirror?: boolean;
  drawers?: number;
}

interface Layout {
  W: number;
  H: number;
  D: number; // whole depth, doors included
  df: number; // frame depth
  frames: Frame[]; // bottom frames first, column by column, then the frames stacked on them
  legs: boolean;
  top: boolean; // a SPILDRA top
  wallLast: boolean; // a frame in a row: its wall fixing waits until they all stand together
  leg?: number; // leg height, mm (LÄTTHET 11 cm unless said)
  feet?: boolean; // LÄTTHET adjustable feet instead of legs: 1 cm
  colTops?: string[]; // a SPILDRA top on each of these frames instead of one across the whole width
}

const FEET = 10;
const legH = (L: Layout) => (L.legs ? (L.leg ?? LEG) : L.feet ? FEET : 0);

/** The wardrobe sets of different heights, column by column from the left: frame heights from the bottom up. */
function comboOf(slug: string, W: number, H: number, D: number): Layout | null {
  type Col = { hs: number[]; o: Partial<Frame>[] };
  const sh = (...ys: number[]): Inside[] => ys.map((y) => ({ kind: "shelf", y }));
  const leg = 110;
  let cols: Col[], feet = false, tops: [number, number][] = []; // [column, frame index] with a SPILDRA top
  if (slug === "platsa-wardrobe-3-doors-180-x-57-x-133") {
    cols = [{ hs: [400], o: [{ door: "L", inside: sh(200) }] }, { hs: [600], o: [{ door: "L", inside: sh(300) }] }, { hs: [1200], o: [{ door: "L", inside: sh(600) }] }];
    tops = [[0, 0], [1, 0], [2, 0]];
  } else if (slug === "platsa-wardrobe-3-doors-180-x-57-x-181") {
    cols = [
      { hs: [1800], o: [{ door: "L", inside: [{ kind: "shelf", y: 400 }, { kind: "rail", y: 1700 }] }] },
      { hs: [1200], o: [{ door: "L", inside: sh(300, 600, 900) }] },
      { hs: [600], o: [{ door: "L", inside: [{ kind: "basket", y: 60 }, { kind: "basket", y: 300 }] }] },
    ];
    feet = true;
    tops = [[1, 0], [2, 0]];
  } else if (slug === "platsa-wardrobe-3-doors-180-x-42-x-191") {
    cols = [
      { hs: [1800], o: [{ door: "L", inside: [{ kind: "shelf", y: 300 }, { kind: "shelf", y: 600 }, { kind: "rail", y: 1700 }] }] },
      { hs: [400], o: [{ door: "L", inside: [{ kind: "shoe", y: 60 }] }] },
      { hs: [400], o: [{ door: "R", inside: [{ kind: "shoe", y: 60 }] }] },
    ];
    tops = [[1, 0], [2, 0]];
  } else if (slug === "platsa-wardrobe-3-doors-180-x-57-x-191") {
    cols = [{ hs: [1800], o: [{ door: "L", inside: [{ kind: "shelf", y: 300 }, { kind: "shelf", y: 700 }, { kind: "rail", y: 1700 }] }] }, { hs: [400], o: [{ door: "L", inside: sh(200) }] }, { hs: [400], o: [{ door: "R", inside: sh(200) }] }];
    tops = [[1, 0], [2, 0]];
  } else if (slug === "platsa-wardrobe-4-doors-240-x-57-x-191") {
    cols = [0, 1, 2].map((): Col => ({ hs: [400], o: [{ door: "L", inside: sh(200) }] }));
    cols.push({ hs: [1800], o: [{ door: "L", inside: sh(300, 600, 900, 1200, 1500) }] });
    tops = [[0, 0], [1, 0], [2, 0]];
  } else if (slug === "platsa-wardrobe-w-6-doors-240-x-57-x-221" || slug === "platsa-wardrobe-w-6-doors-240-x-57-x-231") {
    cols = [
      { hs: [600], o: [{ door: "L", inside: sh(300) }] },
      { hs: [600, 400], o: [{ door: "L", inside: [{ kind: "basket", y: 60 }, { kind: "basket", y: 300 }] }, { door: "L" }] },
      { hs: [1800], o: [{ door: "L", inside: [{ kind: "rail", y: 900 }, { kind: "rail", y: 1700 }] }] },
      { hs: [1800, 400], o: [{ door: "R", inside: [{ kind: "rail", y: 1700 }] }, { door: "R" }] },
    ];
    feet = slug.endsWith("221");
    tops = [[0, 0], [1, 1]];
  } else if (slug === "platsa-wardrobe-w-6-doors-300-x-42-x-241") {
    // the 180 frame in the middle with a 60 frame on it, two more 60 frames hung on the wall each side
    const col = (x: number, i: number): Frame => ({ id: "", x, y: FEET + 1800, w: 600, h: 600, door: i % 2 ? "R" : "L", inside: sh(300) });
    const fs: Frame[] = [
      { id: "", x: 0, y: FEET, w: 600, h: 1800, door: "L", inside: [{ kind: "shelf", y: 300 }, { kind: "shelf", y: 600 }, { kind: "rail", y: 1700 }] },
      col(0, 0),
      ...[-1200, -600, 600, 1200].map((x, i) => col(x, i + 1)),
    ];
    return { W, H, D, df: D - DOOR, frames: fs.map((f, i) => ({ ...f, id: `F${i}` })), legs: false, feet: true, top: false, wallLast: true };
  } else return null;
  const y0 = feet ? FEET : leg;
  const x0 = -W / 2 + 300;
  const frames: Frame[] = [];
  const topIds: string[] = [];
  // bottom frames first, left to right, then the stacked ones
  const all = cols.flatMap((c, ci) => {
    let y = y0;
    return c.hs.map((h, k) => {
      const f: Frame = { id: "", x: x0 + ci * 600, y, w: 600, h, inside: [], ...c.o[k] };
      y += h;
      return { f, ci, k };
    });
  });
  for (const e of [...all.filter((e) => e.k === 0), ...all.filter((e) => e.k > 0)]) {
    e.f.id = `F${frames.length}`;
    frames.push(e.f);
    if (tops.some(([c, k]) => c === e.ci && k === e.k)) topIds.push(e.f.id);
  }
  return { W, H, D, df: D - DOOR, frames, legs: !feet, feet, leg, top: false, colTops: topIds, wallLast: true };
}

function layoutOf(s: ProductSpec): Layout | null {
  const slug = s.slug ?? "";
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const combo = comboOf(slug, W, H, D);
  if (combo) return combo;
  const col = (x: number, w: number, hs: number[], o: (i: number) => Partial<Frame> = () => ({}), y0 = 0): Frame[] => {
    let y = y0;
    return hs.map((h, i) => {
      const f: Frame = { id: "", x, y, w, h, inside: [], ...o(i) };
      y += h;
      return f;
    });
  };
  const ids = (fs: Frame[]) => fs.map((f, i) => ({ ...f, id: `F${i}` }));
  const frameH = (h: number) => [400, 600, 1200, 1800].reduce((a, c) => (Math.abs(c - h) < Math.abs(a - h) ? c : a));

  if (/^platsa-frame-/.test(slug) || (s.archetype === "cabinet" && /^frame/i.test(s.variant))) {
    return { W, H, D, df: D, frames: ids(col(0, W, [frameH(H)])), legs: false, top: false, wallLast: false };
  }
  if (slug === "platsa-wardrobe-2-doors-60-x-57-x-251" || slug === "platsa-wardrobe-w-6-doors-180-x-57-x-241") {
    // a 180 frame with a 60 frame on top, a door on each; the six-door set is three of these in a row
    const legs = H - 2400 > 60;
    const y0 = legs ? LEG : 0;
    const mirror = slug.includes("251");
    const fs = col(0, 600, [1800, 600], (i) => (i === 0 ? { door: "L", mirror, inside: [{ kind: "shelf", y: 1400 }, { kind: "rail", y: 1320 }] } : { door: "L" }), y0);
    return { W: 600, H, D, df: D - DOOR, frames: ids(fs), legs, top: false, wallLast: !mirror };
  }
  if (slug === "platsa-wardrobe-2-doors-120-x-57-x-181" || slug === "platsa-wardrobe-2-doors-120-x-57-x-191") {
    const legs = slug.endsWith("191");
    const y0 = legs ? LEG : 0;
    const left: Inside[] = legs
      ? [{ kind: "shelf", y: 1400 }, { kind: "rail", y: 1320 }, { kind: "basket", y: 60 }, { kind: "basket", y: 300 }]
      : [{ kind: "shelf", y: 1400 }, { kind: "shelf", y: 1000 }, { kind: "shelf", y: 600 }, { kind: "basket", y: 60 }, { kind: "basket", y: 300 }];
    const right: Inside[] = legs
      ? [300, 560, 820, 1080, 1340].map((y) => ({ kind: "shelf", y }))
      : [{ kind: "shelf", y: 1400 }, { kind: "rail", y: 1320 }, { kind: "basket", y: 60 }, { kind: "basket", y: 300 }];
    const fs = [
      ...col(-300, 600, [1800], () => ({ door: "L", mirror: !legs, inside: left }), y0),
      ...col(300, 600, [1800], () => ({ door: "R", inside: right }), y0),
    ];
    return { W, H, D, df: D - DOOR, frames: ids(fs), legs, top: false, wallLast: false };
  }
  if (slug === "platsa-shoe-cabinet-storage-120-x-42-x-123") {
    const fs = [
      ...col(-300, 600, [1200], () => ({ door: "L", inside: [300, 580, 860].map((y) => ({ kind: "shelf", y })) })),
      ...col(300, 600, [1200], () => ({ door: "R", inside: [120, 360, 600, 840].map((y) => ({ kind: "shoe", y })) })),
    ];
    return { W, H, D, df: D - DOOR, frames: ids(fs), legs: false, top: true, wallLast: false };
  }
  if (slug === "platsa-chest-2-drawers-60-x-57-x-53") {
    return { W, H, D, df: D - DOOR, frames: ids(col(0, 600, [400], () => ({ drawers: 2 }), LEG)), legs: true, top: true, wallLast: false };
  }
  if (slug === "platsa-bedside-table-60-x-42-x-83") {
    const fs = col(0, 600, [400, 400], (i) => (i === 0 ? { drawers: 2 } : { inside: [{ kind: "shelf", y: 200 }] }));
    return { W, H, D, df: D - DOOR, frames: ids(fs), legs: false, top: true, wallLast: false };
  }
  return null;
}

/* ---------- the frames ---------- */

interface FrameGeo {
  z0: number; // back
  zf: number; // front edge of the frame
}

function framePanels(f: Frame, g: FrameGeo, df: number): CustomPart[] {
  const zm = g.z0 + 3 + (df - 3) / 2;
  const pd = df - 3;
  const side = (sx: number): CustomPart => ({ id: `${f.id}${sx < 0 ? "L" : "R"}`, name: "Side panel", size: [t, f.h, pd], pos: [f.x + sx * (f.w / 2 - t / 2), f.y + f.h / 2, zm], material: "board" });
  return [
    side(-1),
    { id: `${f.id}T`, name: "Top and bottom panel", size: [f.w - 2 * t, t, pd], pos: [f.x, f.y + f.h - t / 2, zm], material: "board" },
    { id: `${f.id}B`, name: "Top and bottom panel", size: [f.w - 2 * t, t, pd], pos: [f.x, f.y + t / 2, zm], material: "board" },
    side(1),
    { id: `${f.id}K`, name: "Back panel", size: [f.w, f.h, 3], pos: [f.x, f.y + f.h / 2, g.z0 + 1.5], material: "fiber" },
  ];
}

/** The eight rivets through the back: four into the top's edge, four into the bottom's. */
function rivets(f: Frame, g: FrameGeo): CustomFix[] {
  const xs = spread(f.x - f.w / 2 + 50, f.x + f.w / 2 - 80, 4);
  const rows: [number, string][] = [[f.y + f.h - t / 2, `${f.id}T`], [f.y + t / 2, `${f.id}B`]];
  return [
    ...rows.map(([y, mate]) => fixAt(RIVET_PLUG, xs.map((x): Vec3 => [x, y, g.z0]), [0, 0, 1], `${f.id}K`, mate)),
    fixAt(RIVET_PIN, rows.flatMap(([y]) => xs.map((x): Vec3 => [x + 30, y, g.z0])), [0, 0, 1], `${f.id}K`),
  ];
}

const spacerXs = (f: Frame) => [f.x - f.w / 2 + 120, f.x + f.w / 2 - 120];
const spacers = (f: Frame, g: FrameGeo) => fixAt(SPACER, spacerXs(f).map((x): Vec3 => [x, f.y + f.h - t / 2, g.z0]), [0, 0, 1], `${f.id}T`);
const caps = (f: Frame, g: FrameGeo) => fixAt(SPACER_CAP, spacerXs(f).map((x): Vec3 => [x, f.y + f.h - t / 2, g.z0 - 24]), [0, 0, 1], `${f.id}T`);

function legParts(f: Frame, g: FrameGeo, h = LEG): CustomPart[] {
  return [-1, 1].flatMap((sx) =>
    [g.z0 + 45, g.zf - 45].map((z, k): CustomPart => ({ id: `${f.id}G${sx < 0 ? "L" : "R"}${k}`, name: "Leg", size: [45, h, 45], pos: [f.x + sx * (f.w / 2 - 40), h / 2, z], material: "wood" })),
  );
}
const legPts = (f: Frame, g: FrameGeo, y: number): Vec3[] => [-1, 1].flatMap((sx) => [g.z0 + 45, g.zf - 45].map((z): Vec3 => [f.x + sx * (f.w / 2 - 40), y, z]));

/** Join plates round the front edges of two frames side by side, two screws in each. */
function joinFixes(a: Frame, b: Frame, g: FrameGeo): CustomFix[] {
  const xj = a.x + a.w / 2;
  const h = Math.min(a.h, b.h), y0 = Math.max(a.y, b.y); // frames of different heights: only where both sides are
  const ys = h >= 1200 ? [y0 + h - 400, y0 + h - 1100] : [y0 + h / 2];
  return [
    fixAt(JOIN_PLATE, ys.map((y): Vec3 => [xj, y, g.zf - 30]), [0, 0, -1], `${a.id}R`, `${b.id}L`),
    fixAt(SMALL_SCREW, ys.flatMap((y): Vec3[] => [[xj - t, y + 30, g.zf - 20], [xj - t, y - 30, g.zf - 20]]), [1, 0, 0], `${a.id}R`),
    fixAt(SMALL_SCREW, ys.flatMap((y): Vec3[] => [[xj + t, y + 30, g.zf - 20], [xj + t, y - 30, g.zf - 20]]), [-1, 0, 0], `${b.id}L`),
  ];
}

/** A frame stacked on another: sleeves into its bottom, screws up through the top of the one under it. */
function stackFixes(lo: Frame, up: Frame, g: FrameGeo): CustomFix[] {
  const pts = (y: number) => [-1, 1].flatMap((sx) => [g.z0 + 70, g.zf - 70].map((z): Vec3 => [up.x + sx * (up.w / 2 - t - 50), y, z]));
  return [fixAt(SLEEVE, pts(up.y + 6), [0, 1, 0], `${up.id}B`), fixAt(STACK_SCREW, pts(up.y - t - 20), [0, 1, 0], `${lo.id}T`, `${up.id}B`)];
}

function framesRecipe(L: Layout, g: FrameGeo): { recipe: CustomParams; tops: Frame[] } {
  const parts: CustomPart[] = [];
  const steps: CustomStep[] = [];
  const base = legH(L), LH = L.leg ?? LEG;
  const bottoms = L.frames.filter((f) => f.y <= base + 1);
  const below = (up: Frame) => L.frames.find((o) => Math.abs(o.x - up.x) < 1 && Math.abs(o.y + o.h - up.y) < 1);
  const stacked = L.frames.filter((f) => !bottoms.includes(f) && below(f));
  const hung = L.frames.filter((f) => !bottoms.includes(f) && !below(f));
  const isTop = (f: Frame) => !L.frames.some((o) => o !== f && Math.abs(o.x - f.x) < 1 && o.y > f.y);
  const tops = L.frames.filter(isTop);
  for (const f of L.frames) parts.push(...framePanels(f, g, L.df));
  if (L.legs) for (const f of bottoms) parts.push(...legParts(f, g, LH));

  const first = bottoms[0];
  const tall = first.h >= 1200;
  const who = tall ? 2 : 1;
  const panels = (f: Frame) => ["L", "T", "B", "R", "K"].map((k) => `${f.id}${k}`);
  steps.push({
    title: "Click the top panel onto a side panel",
    detail: tall
      ? "Together, on a rug: hold the side on its front edge and push the top down onto its fittings until it clicks."
      : "On a rug, with the side on its front edge. Push the top down onto its fittings until it clicks.",
    add: [`${first.id}L`, `${first.id}T`],
    pose: "-z",
    people: who,
    warnings: tall ? ["two", "floor"] : ["floor"],
  });
  steps.push({ title: "Click on the bottom panel", detail: "Same way, at the other end of the side.", add: [`${first.id}B`] });
  steps.push({ title: "Click on the other side panel", detail: "Line up its fittings with both panels and press it down until both ends click.", add: [`${first.id}R`] });
  steps.push({
    title: "Slide in the back panel",
    detail: "White side in. Push it along the grooves from the open end until it stops.",
    add: [`${first.id}K`],
    from: { [`${first.id}K`]: [0, Math.min(700, first.h * 0.6), 0] },
  });
  steps.push({ title: "Lock the back with the rivets", detail: "Push a plug into each hole along the top and bottom, then press a pin into each one.", fix: rivets(first, g) });
  if (isTop(first)) steps.push({ title: "Press the wall spacers into the top", detail: "Into the two holes in its back edge.", fix: [spacers(first, g)] });
  if (L.legs) {
    steps.push({
      title: "Screw the legs on",
      detail: "Screw a rod and sleeve into each leg with the spanner, then turn the legs into the bottom by hand.",
      add: legParts(first, g, LH).map((p) => p.id),
      fix: [fixAt(LEG_SLEEVE, legPts(first, g, LH), [0, 1, 0]), fixAt(ROD, legPts(first, g, LH - 25), [0, 1, 0])],
      tools: ["wrench"],
    });
    steps.push({ title: "Screw the feet into the legs", detail: "All the way in for now. They level it later.", fix: [fixAt(LEG_FOOT, legPts(first, g, 0), [0, 1, 0])] });
  }
  if (L.feet) steps.push({ title: "Screw in the adjustable feet", detail: "Four into the holes under the bottom, all the way in for now. They level it later.", fix: [fixAt(LEG_FOOT, legPts(first, g, FEET), [0, 1, 0], `${first.id}B`)] });

  // the other columns, built the same way and stood next to it
  const others = bottoms.slice(1);
  if (others.length) {
    const fix: CustomFix[] = others.flatMap((f) => rivets(f, g));
    if (others.some(isTop)) fix.push(...others.filter(isTop).map((f) => spacers(f, g)));
    const add = others.flatMap((f) => [...panels(f), ...(L.legs ? legParts(f, g, LH).map((p) => p.id) : [])]);
    if (L.legs) for (const f of others) fix.push(fixAt(LEG_SLEEVE, legPts(f, g, LH), [0, 1, 0]), fixAt(ROD, legPts(f, g, LH - 25), [0, 1, 0]), fixAt(LEG_FOOT, legPts(f, g, 0), [0, 1, 0]));
    if (L.feet) for (const f of others) fix.push(fixAt(LEG_FOOT, legPts(f, g, FEET), [0, 1, 0], `${f.id}B`));
    steps.push({
      title: others.length > 1 ? "Build the other frames the same way" : "Build the second frame the same way",
      detail: "Every step as for the first one, lying on its front.",
      add,
      fix,
      people: who,
      from: Object.fromEntries(add.map((id) => [id, [0, 0, -500] as Vec3])),
    });
  }
  steps.push({
    title: tall ? "Stand it up together" : "Stand it up",
    detail: tall ? "Lift it from the top end while the other person keeps the bottom on the floor. Don't drag it up by one corner." : "Lift it upright, don't drag it up by one corner.",
    pose: "+y",
    people: who,
    warnings: tall ? ["two"] : [],
  });
  for (let i = 1; i < bottoms.length; i++)
    steps.push({
      title: "Join the frames with the plates",
      detail: "Line up the fronts. Push each plate into the gap between the front edges, fold it round and screw it to both sides.",
      fix: joinFixes(bottoms[i - 1], bottoms[i], g),
      tools: ["screwdriver"],
    });
  for (const up of stacked) {
    const lo = below(up)!;
    steps.push({
      title: "Build the small frame the same way",
      detail: "Lying on its front, then stand it up.",
      add: panels(up),
      fix: [...rivets(up, g), spacers(up, g)],
      from: Object.fromEntries(panels(up).map((id) => [id, [0, 0, -500] as Vec3])),
    });
    steps.push({
      title: "Lift it on and screw it to the frame below",
      detail: "Turn the sleeves into its bottom first. Then four screws up through the top of the frame below.",
      fix: stackFixes(lo, up, g),
      tools: ["screwdriver"],
      people: 2,
      warnings: ["two"],
    });
  }
  if (hung.length) {
    // frames on the wall beside the stack: a suspension rail for each, then the frame hooked on and joined to its neighbour
    for (const f of hung) parts.push({ id: `${f.id}S`, name: "Suspension rail", size: [f.w - 40, 40, 6], pos: [f.x, f.y + f.h - 70, g.z0 - 3], material: "metal" });
    const railPts = hung.flatMap((f) => [-1, 1].map((sx): Vec3 => [f.x + sx * (f.w / 2 - 80), f.y + f.h - 70, g.z0 - 6]));
    steps.push({
      title: "Screw the suspension rails to the wall",
      detail: "Level with the top of the frame on the stack, one rail for each frame. Wall screws and plugs aren't included: pick ones made for your wall.",
      add: hung.map((f) => `${f.id}S`),
      fix: [
        { kind: "plug", count: railPts.length, at: railPts.map((p): Vec3 => [p[0], p[1], p[2] - 30]), dir: [0, 0, -1] },
        { kind: "screw", count: railPts.length, len: 50, dia: 5, at: railPts, dir: [0, 0, -1] },
      ],
      tools: ["drill", "level", "screwdriver"],
      wall: true,
      warnings: ["wall"],
    });
    const hp = (f: Frame, sx: number) => f.x + sx * (f.w / 2 - t);
    steps.push({
      title: hung.length > 1 ? "Build the wall frames the same way" : "Build the wall frame the same way",
      detail: "Lying on its front. Then screw a suspension fitting into each top back corner, inside, two screws each.",
      add: hung.flatMap(panels),
      fix: [
        ...hung.flatMap((f) => rivets(f, g)),
        ...hung.map((f) => spacers(f, g)),
        ...hung.map((f) => fixAt({ kind: "hook", len: 40, dia: 30 }, [-1, 1].map((sx): Vec3 => [hp(f, sx), f.y + f.h - 70, g.z0 + 25]), [0, 0, 1], `${f.id}T`)),
        ...hung.flatMap((f) => [-1, 1].map((sx) => fixAt(SMALL_SCREW, [-26, 26].map((dy): Vec3 => [hp(f, sx) - sx * 4, f.y + f.h - 70 + dy, g.z0 + 25]), [sx, 0, 0], `${f.id}${sx < 0 ? "L" : "R"}`))),
      ].slice(0, 24),
      from: Object.fromEntries(hung.flatMap(panels).map((id) => [id, [0, 0, -500] as Vec3])),
      wait: hung.flatMap(panels),
    });
    steps.push({
      title: hung.length > 1 ? "Hang the frames on the rails" : "Hang the frame on the rail",
      detail: "Together: lift each one so its fittings hook over the rail, then slide it against the frame beside it.",
      add: hung.flatMap(panels),
      from: Object.fromEntries(hung.flatMap(panels).map((id) => [id, [0, 120, 260] as Vec3])),
      people: 2,
      warnings: ["two"],
    });
    const row = L.frames.filter((f) => hung.some((h) => Math.abs(h.y - f.y) < 1)).sort((a, b) => a.x - b.x);
    const pairs = row.slice(1).map((f, i) => [row[i], f] as const).filter(([a, b]) => Math.abs(a.x + a.w / 2 - (b.x - b.w / 2)) < 1);
    if (pairs.length)
      steps.push({ title: "Join the wall frames to their neighbours", detail: "A plate round the front edges between each pair, two screws on each side.", fix: pairs.flatMap(([a, b]) => joinFixes(a, b, g)).slice(0, 24), tools: ["screwdriver"] });
  }
  steps.push({ title: "Screw the caps onto the spacers", detail: "Turn them on by hand at the back of the top.", fix: tops.map((f) => caps(f, g)) });
  steps.push({
    title: "Push it against the wall",
    detail: "Turn the caps in or out until it stands straight and clear of the skirting board.",
    warnings: ["tip"],
  });
  if (L.legs) steps.push({ title: "Level it on the feet", detail: "Turn the feet with the spanner until it stands level and steady.", tools: ["wrench", "level"] });
  if (L.feet) steps.push({ title: "Level it on the feet", detail: "Turn the adjustable feet until it stands level and steady.", tools: ["level"] });
  if (L.colTops?.length) {
    const tf = L.frames.filter((f) => L.colTops!.includes(f.id));
    const pts = (f: Frame, y: number) => [-1, 1].flatMap((sx) => [g.z0 + 80, g.zf - 80].map((z): Vec3 => [f.x + sx * (f.w / 2 - t - 60), y, z]));
    const top = (f: Frame) => `${f.id}TOP`;
    for (const f of tf) parts.push({ id: top(f), name: "Top", size: [f.w, 20, L.D], pos: [f.x, f.y + f.h + 10, 0], material: "board" });
    steps.push({ title: tf.length > 1 ? "Press the sleeves into the low frames' tops" : "Press the sleeves into the low frame's top", detail: "Four in the holes near the corners of each.", fix: tf.map((f) => fixAt(SLEEVE, pts(f, f.y + f.h), [0, -1, 0], `${f.id}T`)) });
    steps.push({ title: tf.length > 1 ? "Lay the tops on" : "Lay the top on", detail: "Lower each straight onto its sleeves, flush at the back.", add: tf.map(top), from: Object.fromEntries(tf.map((f) => [top(f), [0, 260, 0] as Vec3])) });
    steps.push({ title: "Screw them on from inside", detail: "Four screws up through each frame's top into the sleeves.", fix: tf.map((f) => fixAt(STACK_SCREW, pts(f, f.y + f.h - t - 20), [0, 1, 0], `${f.id}T`, top(f))), tools: ["screwdriver"] });
  }
  if (L.top) {
    const tf = tops;
    const pts = (f: Frame, y: number) => [-1, 1].flatMap((sx) => [g.z0 + 80, g.zf - 80].map((z): Vec3 => [f.x + sx * (f.w / 2 - t - 60), y, z]));
    const Y = Math.max(...tf.map((f) => f.y + f.h));
    parts.push({ id: "TOP", name: "Top", size: [L.W, 20, L.D], pos: [0, Y + 10, 0], material: "board" });
    steps.push({ title: "Press the sleeves into the top of the frame", detail: "Four in the holes near the corners.", fix: tf.map((f) => fixAt(SLEEVE, pts(f, Y), [0, -1, 0], `${f.id}T`)) });
    steps.push({ title: "Lay the top on", detail: "Lower it straight onto the sleeves, flush at the back.", add: ["TOP"], from: { TOP: [0, 260, 0] } });
    steps.push({ title: "Screw it on from inside", detail: "Four screws up through the frame's top into the sleeves.", fix: tf.map((f) => fixAt(STACK_SCREW, pts(f, Y - t - 20), [0, 1, 0], `${f.id}T`, "TOP")), tools: ["screwdriver"] });
  }
  return { recipe: { parts, steps }, tops };
}

/* ---------- inside, drawers and doors ---------- */

function insideRecipe(L: Layout, g: FrameGeo): CustomParams | null {
  const parts: CustomPart[] = [];
  const steps: CustomStep[] = [];
  const zm = g.z0 + 3 + (L.df - 3) / 2;
  const inner = (f: Frame) => f.w - 2 * t;
  const xi = (f: Frame, sx: number) => f.x + sx * (f.w / 2 - t);

  // shelves, shoe shelves, rails and baskets: each kind in one step, across all frames
  type It = { f: Frame; it: Inside; k: number };
  const all: It[] = L.frames.flatMap((f) => f.inside.map((it, k) => ({ f, it, k })));
  const of = (kind: Inside["kind"]) => all.filter((x) => x.it.kind === kind);
  const id = (x: It, s = "") => `${x.f.id}${x.it.kind}${x.k}${s}`;

  const shelves = of("shelf");
  if (shelves.length) {
    const sd = L.df - 25;
    for (const x of shelves) parts.push({ id: id(x), name: "Shelf", size: [inner(x.f) - 4, 18, sd], pos: [x.f.x, x.f.y + x.it.y + 9, g.z0 + 3 + sd / 2], material: "board" });
    const pins = (x: It): Vec3[] => [-1, 1].flatMap((sx) => [g.z0 + 60, g.z0 + sd - 40].map((z): Vec3 => [xi(x.f, sx), x.f.y + x.it.y - 6, z]));
    steps.push({
      title: shelves.length > 1 ? "Put in the shelves" : "Put in the shelf",
      detail: "Push four supports into the holes at the height you want, the same hole on each side, then lay the shelf on.",
      add: shelves.map((x) => id(x)),
      fix: shelves.slice(0, 10).map((x) => fixAt(SHELF_PIN, pins(x), [0, -1, 0], id(x))),
    });
  }
  const shoes = of("shoe");
  if (shoes.length) {
    const sd = L.df - 40;
    const tilt = 0.32;
    for (const x of shoes)
      parts.push({ id: id(x), name: "Shoe shelf", size: [inner(x.f) - 4, 18, sd], pos: [x.f.x, x.f.y + x.it.y + 70, g.z0 + 3 + sd / 2 + 10], rot: [tilt, 0, 0], material: "board" });
    const pins = (x: It): Vec3[] =>
      [-1, 1].flatMap((sx) => [[xi(x.f, sx), x.f.y + x.it.y + 70 + Math.sin(tilt) * (sd / 2 - 40) - 14, g.z0 + 60] as Vec3, [xi(x.f, sx), x.f.y + x.it.y + 70 - Math.sin(tilt) * (sd / 2 - 40) - 14, g.z0 + sd - 20] as Vec3]);
    steps.push({
      title: "Put in the shoe shelves",
      detail: "Two supports high at the back and two low at the front for each, so it slopes towards you. The lip goes at the front.",
      add: shoes.map((x) => id(x)),
      fix: shoes.map((x) => fixAt(SHELF_PIN, pins(x), [0, -1, 0], id(x))),
    });
  }
  const rails = of("rail");
  if (rails.length) {
    for (const x of rails) {
      parts.push({ id: id(x), name: "Clothes rail", size: [inner(x.f), 25, 25], pos: [x.f.x, x.f.y + x.it.y, zm], shape: "cyl", material: "metal" });
      for (const sx of [-1, 1]) parts.push({ id: id(x, sx < 0 ? "a" : "b"), name: "Rail holder", size: [6, 70, 30], pos: [xi(x.f, sx) - sx * 3, x.f.y + x.it.y + 10, zm], material: "metal" });
    }
    steps.push({
      title: "Screw on the rail holders",
      detail: "One on each side, two screws in each, in the holes under the shelf.",
      add: rails.flatMap((x) => [id(x, "a"), id(x, "b")]),
      fix: rails.flatMap((x) => [-1, 1].map((sx) => fixAt(SMALL_SCREW, [[xi(x.f, sx) - sx * 6, x.f.y + x.it.y + 35, zm], [xi(x.f, sx) - sx * 6, x.f.y + x.it.y - 15, zm]], [sx, 0, 0], id(x, sx < 0 ? "a" : "b")))),
      tools: ["screwdriver"],
    });
    steps.push({ title: "Lift the rail into the holders", detail: "Drop each end into its holder.", add: rails.map((x) => id(x)), from: Object.fromEntries(rails.map((x) => [id(x), [0, 0, 400] as Vec3])) });
  }
  const baskets = of("basket");
  if (baskets.length) {
    const bd = L.df - 60;
    const zb = g.z0 + 3 + 20 + bd / 2;
    for (const x of baskets) {
      const bw = inner(x.f) - 30, bh = 170;
      const pieces: PartPiece[] = [
        { shape: "box", size: [bw, 3, bd], pos: [0, -bh / 2 + 1.5, 0] },
        { shape: "box", size: [3, bh, bd], pos: [-bw / 2 + 1.5, 0, 0] },
        { shape: "box", size: [3, bh, bd], pos: [bw / 2 - 1.5, 0, 0] },
        { shape: "box", size: [bw, bh, 3], pos: [0, 0, -bd / 2 + 1.5] },
        { shape: "box", size: [bw, bh, 3], pos: [0, 0, bd / 2 - 1.5] },
      ];
      parts.push({ id: id(x), name: "Wire basket", size: [bw, bh, bd], pos: [x.f.x, x.f.y + x.it.y + bh / 2, zb], pieces, material: "metal" });
      for (const sx of [-1, 1]) parts.push({ id: id(x, sx < 0 ? "a" : "b"), name: "Pull-out rail", size: [12, 24, bd], pos: [xi(x.f, sx) - sx * 6, x.f.y + x.it.y + bh - 12, zb], material: "metal" });
    }
    const rs = baskets.flatMap((x) => [id(x, "a"), id(x, "b")]);
    steps.push({
      title: "Screw the pull-out rails to the sides",
      detail: "Three screws in each rail, in the holes for the height you want, the same on both sides.",
      add: rs,
      fix: baskets
        .flatMap((x) => [-1, 1].map((sx) => fixAt(SMALL_SCREW, [-bd / 2 + 25, -bd / 6, bd / 2 - 25].map((dz): Vec3 => [xi(x.f, sx) - sx * 12, x.f.y + x.it.y + 158, zb + dz]), [sx, 0, 0], id(x, sx < 0 ? "a" : "b"))))
        .slice(0, 10),
      tools: ["screwdriver"],
    });
    steps.push({
      title: "Click the holders on and hang the baskets",
      detail: "Two holders click onto the rim of each basket. Hang them on the rails and push them in.",
      add: baskets.map((x) => id(x)),
      from: Object.fromEntries(baskets.map((x) => [id(x), [0, 0, 420] as Vec3])),
      fix: baskets.map((x) => fixAt(HW.clip, [-1, 1].map((sx): Vec3 => [x.f.x + sx * ((inner(x.f) - 30) / 2), x.f.y + x.it.y + 170, zb + bd / 2 - 20]), [0, -1, 0], id(x))),
    });
    steps.push({
      title: "Clip the stops onto the rails",
      detail: "One at the front of each rail, so the basket can't pull right out.",
      fix: baskets.map((x) => fixAt({ kind: "clip", len: 8, dia: 14 }, [-1, 1].map((sx): Vec3 => [xi(x.f, sx) - sx * 6, x.f.y + x.it.y + 170, zb + bd / 2 - 10]), [0, 0, -1], id(x, "a"))),
    });
  }

  // drawers: runners in the frame, the box clicked together, its front screwed on
  const df = L.frames.filter((f) => f.drawers);
  for (const f of df) {
    const n = f.drawers!;
    const pitch = (f.h - 2 * t) / n;
    const dd = L.df - 40;
    const zd = g.z0 + 3 + 15 + dd / 2;
    for (const i of range(n)) {
      const yb = f.y + t + i * pitch;
      const bh = Math.min(140, pitch - 50), bw = inner(f) - 26;
      const pieces: PartPiece[] = [
        { shape: "box", size: [bw, 3, dd], pos: [0, -bh / 2 + 1.5, 0], material: "fiber" },
        { shape: "box", size: [10, bh, dd], pos: [-bw / 2 + 5, 0, 0], material: "metal" },
        { shape: "box", size: [10, bh, dd], pos: [bw / 2 - 5, 0, 0], material: "metal" },
        { shape: "box", size: [bw - 20, bh, 12], pos: [0, 0, -dd / 2 + 6] },
        { shape: "box", size: [bw - 20, bh, 12], pos: [0, 0, dd / 2 - 6] },
      ];
      parts.push({ id: `${f.id}D${i}`, name: "Drawer", size: [bw, bh, dd], pos: [f.x, yb + 20 + bh / 2, zd], pieces, material: "board" });
      for (const sx of [-1, 1]) parts.push({ id: `${f.id}D${i}${sx < 0 ? "a" : "b"}`, name: "Runner", size: [12, 20, dd - 20], pos: [xi(f, sx) - sx * 6, yb + 30, zd], material: "metal" });
      parts.push({ id: `${f.id}D${i}f`, name: "Drawer front", size: [f.w - 4, pitch - 4, DOOR], pos: [f.x, yb + pitch / 2 - (i === 0 ? t / 2 : 0), g.zf + DOOR / 2], material: "board" });
    }
    const runners = range(n).flatMap((i) => [`${f.id}D${i}a`, `${f.id}D${i}b`]);
    steps.push({
      title: "Screw the runners into the frame",
      detail: "One on each side for every drawer, three screws in each, in the holes the drawer's manual shows.",
      add: runners,
      fix: range(n).flatMap((i) =>
        [-1, 1].map((sx) => fixAt(SMALL_SCREW, [-dd / 2 + 30, -dd / 6, dd / 2 - 30].map((dz): Vec3 => [xi(f, sx) - sx * 12, f.y + t + i * pitch + 30, zd + dz]), [sx, 0, 0], `${f.id}D${i}${sx < 0 ? "a" : "b"}`)),
      ),
      tools: ["screwdriver"],
    });
    steps.push({
      title: n > 1 ? "Click the drawers together" : "Click the drawer together",
      detail: "Sides onto the front, the back on, then slide the bottom in and press the back down over it. Turn it over and click the runner ends on underneath.",
    });
    steps.push({
      title: n > 1 ? "Slide the drawers in" : "Slide the drawer in",
      detail: "Set it on the runners and push it in until it closes softly.",
      add: range(n).map((i) => `${f.id}D${i}`),
      from: Object.fromEntries(range(n).map((i) => [`${f.id}D${i}`, [0, 0, 500] as Vec3])),
    });
    steps.push({
      title: n > 1 ? "Screw on the fronts" : "Screw on the front",
      detail: "Four screws from inside each drawer. Line the gaps up before you tighten them.",
      add: range(n).map((i) => `${f.id}D${i}f`),
      fix: range(n).map((i) => fixAt({ kind: "screw", len: 16, dia: 4 }, [-1, 1].flatMap((sx) => [-1, 1].map((sy): Vec3 => [f.x + sx * 150, f.y + t + i * pitch + 20 + 70 + sy * 35, g.zf - 14])), [0, 0, 1], `${f.id}D${i}`, `${f.id}D${i}f`)),
      tools: ["screwdriver"],
    });
  }

  // doors on soft-closing hinges: hinges pressed into the door, then clipped and screwed to the side
  const doors = L.frames.filter((f) => f.door);
  if (doors.length) {
    const hinges = (f: Frame) => (f.h >= 1800 ? 4 : f.h >= 1200 ? 3 : 2);
    const hy = (f: Frame) => spread(f.y + 100, f.y + f.h - 100, hinges(f));
    const sx = (f: Frame) => (f.door === "L" ? -1 : 1);
    const did = (f: Frame) => `${f.id}door`;
    for (const f of doors)
      parts.push({ id: did(f), name: f.mirror ? "Mirror door" : "Door", size: [f.w - 4, f.h - 4, DOOR], pos: [f.x, f.y + f.h / 2, g.zf + DOOR / 2 + 1], material: f.mirror ? "metal" : "board" });
    const hx = (f: Frame) => f.x + sx(f) * (f.w / 2 - 25);
    steps.push({
      title: doors.length > 1 ? "Fit the hinges and hang the doors" : "Fit the hinges and hang the door",
      detail: "Press each hinge into its cup in the door, then hold the door up and screw the hinge plates to the side.",
      add: doors.map(did),
      from: Object.fromEntries(doors.map((f) => [did(f), [0, 0, 400] as Vec3])),
      fix: doors.map((f) => fixAt(HW.hinge, hy(f).map((y): Vec3 => [hx(f), y, g.zf]), [0, 0, 1], did(f), `${f.id}${sx(f) < 0 ? "L" : "R"}`)),
      tools: ["screwdriver"],
      people: doors.some((f) => f.h >= 1200) ? 2 : 1,
    });
    steps.push({
      title: "Push in the door bumpers",
      detail: "One small bumper by each hinge, into the hole in the back of the door.",
      fix: doors.map((f) => fixAt(BUMPER, hy(f).map((y): Vec3 => [hx(f), y + 60, g.zf]), [0, 0, 1], did(f))),
    });
    const mirrors = doors.filter((f) => f.mirror);
    if (mirrors.length) {
      for (const f of mirrors) parts.push({ id: `${f.id}grip`, name: "Handle strip", size: [14, 500, 24], pos: [f.x - sx(f) * (f.w / 2 - 9), f.y + f.h / 2, g.zf + DOOR + 12], material: "metal" });
      steps.push({
        title: "Fit the handle strip",
        detail: "Screw its bracket to the door's free edge, then hook the strip over it and turn it until it clicks.",
        add: mirrors.map((f) => `${f.id}grip`),
        fix: mirrors.map((f) => fixAt(SMALL_SCREW, [-120, 120].map((dy): Vec3 => [f.x - sx(f) * (f.w / 2 - 9), f.y + f.h / 2 + dy, g.zf + DOOR + 24]), [0, 0, -1], `${f.id}grip`, did(f))),
        tools: ["screwdriver"],
      });
    }
    steps.push({ title: doors.length > 1 ? "Adjust the doors" : "Adjust the door", detail: "Turn the hinge screws until the gaps are even and it closes flush.", tools: ["screwdriver"] });
  }
  return parts.length ? { parts, steps } : null;
}

/* ---------- the wall, drawn by hand so the washer, screw and cover share a hole ---------- */

function keyAt(b: PlanBuilder, pos: Vec3) {
  return b.items.find((x) => x.kind === "part" && x.final.pos.every((v, i) => Math.abs(v - pos[i]) < 0.5))?.key;
}

function wallStep(b: PlanBuilder, pts: { host: string; at: Vec3 }[], o: { two: boolean; title: string }) {
  b.step(
    {
      title: o.title,
      detail: "Two screws through washers, through the back near the top, then click the covers on. Wall screws and plugs aren't included: pick ones made for your wall.",
      tools: ["screwdriver", "drill", "pencil"],
      kind: "anchor",
      wall: true,
      people: o.two ? 2 : 1,
      warnings: ["wall", "tip"],
    },
    () => {
      b.stagger(0.12);
      for (const p of pts) b.fit(HW.plug, { at: [p.at[0], p.at[1], p.at[2] - 30], dir: [0, 0, -1] });
      b.then(0.1);
      for (const p of pts) b.fit(WASHER, { on: p.host, at: p.at, dir: [0, 0, -1], hole: false });
      b.then(0.05);
      for (const p of pts) b.fit(HW.wallScrew, { on: p.host, at: [p.at[0], p.at[1], p.at[2] + 2], dir: [0, 0, -1], hole: false });
      b.then(0.1);
      for (const p of pts) b.fit(COVER, { on: p.host, at: [p.at[0], p.at[1], p.at[2] + 4], dir: [0, 0, -1], hole: false });
    },
  );
}

function buildFrames(b: PlanBuilder, s: ProductSpec, L: Layout) {
  const g: FrameGeo = { z0: -L.D / 2, zf: -L.D / 2 + L.df };
  const { recipe, tops } = framesRecipe(L, g);
  buildCustom(b, { ...s, custom: recipe });
  const pts = tops.flatMap((f) => {
    const back = recipe.parts.find((p) => p.id === `${f.id}K`)!;
    const host = keyAt(b, back.pos);
    return host ? [-1, 1].map((sx) => ({ host, at: [f.x + sx * (f.w / 2 - 90), f.y + f.h - t - 40, g.z0 + 3] as Vec3 })) : [];
  });
  const wall = () => wallStep(b, pts, { two: L.H >= 1200, title: "Fix it to the wall" });
  if (!L.wallLast) wall();
  const inside = insideRecipe(L, g);
  if (inside) buildCustom(b, { ...s, custom: inside });
  if (L.wallLast) wall();
}

/* ---------- the open units: four steel frames bolted into a tube ---------- */

type Open = { W: number; H: number; D: number; screws: number; extra: "none" | "hanging" | "shoes" };

function openOf(s: ProductSpec): Open | null {
  const slug = s.slug ?? "";
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  if (/^platsa-open-shelving-unit/.test(slug)) return { W, H, D, screws: 4, extra: "none" };
  if (/^platsa-open-shoe-storage/.test(slug)) return { W, H, D, screws: 4, extra: "shoes" };
  if (/^platsa-open-clothes-hanging/.test(slug)) return { W, H, D, screws: 8, extra: "hanging" };
  return null;
}

function openRecipe(o: Open): { frame: CustomParams; inside: CustomParams | null; wall: Vec3[] } {
  const { W, H, D } = o;
  const b = 20; // tube
  const bar = (size: Vec3, pos: Vec3): PartPiece => ({ shape: "box", size, pos, material: "metal" });
  const side = (sx: number): CustomPart => ({
    id: sx < 0 ? "SL" : "SR",
    name: "Side frame",
    size: [b, H, D],
    pos: [sx * (W / 2 - b / 2), H / 2, 0],
    material: "metal",
    pieces: [bar([b, H, b], [0, 0, -D / 2 + b / 2]), bar([b, H, b], [0, 0, D / 2 - b / 2]), bar([b, b, D - 2 * b], [0, H / 2 - b / 2, 0]), bar([b, b, D - 2 * b], [0, -H / 2 + b / 2, 0])],
  });
  const end = (top: boolean): CustomPart => ({
    id: top ? "ET" : "EB",
    name: "Top and bottom frame",
    size: [W - 2 * b, b, D],
    pos: [0, top ? H - b / 2 : b / 2, 0],
    material: "metal",
    pieces: [
      bar([W - 2 * b, b, b], [0, 0, -D / 2 + b / 2]),
      bar([W - 2 * b, b, b], [0, 0, D / 2 - b / 2]),
      bar([b, b, D - 2 * b], [-W / 2 + 1.5 * b, 0, 0]),
      bar([b, b, D - 2 * b], [W / 2 - 1.5 * b, 0, 0]),
      bar([W - 4 * b, 2, D - 2 * b], [0, top ? b / 2 - 1 : b / 2 - 1, 0]),
    ],
  });
  const parts = [side(-1), end(false), end(true), side(1)];
  const corners = (sx: number): Vec3[] => [H - b / 2, b / 2].flatMap((y) => [-D / 2 + b / 2, D / 2 - b / 2].map((z): Vec3 => [sx * (W / 2), y, z]));
  // from inside the corner: up into the top frame, down into the bottom one
  const small = (sx: number, n: number, side: string): CustomFix[] =>
    ([[H - b - 2, 1, "ET"], [b + 2, -1, "EB"]] as const).map(([y, d, on]) =>
      fixAt(SMALL_SCREW, [-D / 2 + b / 2, ...(n > 2 ? [D / 2 - b / 2] : [])].map((z): Vec3 => [sx * (W / 2 - b - 10), y, z]), [0, d, 0], on, side),
    );
  const half = o.screws / 2;
  const tall = H >= 1200;
  const steps: CustomStep[] = [
    {
      title: "Bolt the top and bottom frames to a side frame",
      detail: "On a rug, the side frame lying flat. Two bolts at each end, through the side into the frame, only loosely for now.",
      add: ["SL", "EB", "ET"],
      fix: [fixAt(FRAME_BOLT, corners(-1), [1, 0, 0], "SL", "EB")],
      tools: ["allen"],
      pose: "+x",
      warnings: ["floor"],
      people: tall ? 2 : 1,
    },
    { title: "Screw the corners together", detail: "The small screws go in from inside, where the frames meet.", fix: small(-1, half, "SL"), tools: ["screwdriver"] },
    { title: "Lay the other side frame on", detail: "Line its holes up with the ends of both frames.", add: ["SR"] },
    { title: "Bolt it on", detail: "Two bolts at each end. Now tighten all eight.", fix: [fixAt(FRAME_BOLT, corners(1), [-1, 0, 0], "SR", "ET")], tools: ["allen"], check: "square" },
    {
      title: tall ? "Stand it up together and screw the last corners" : "Stand it up and screw the last corners",
      detail: "The rest of the small screws, from inside where the side meets the frames.",
      fix: small(1, half, "SR"),
      tools: ["screwdriver"],
      pose: "+y",
      people: tall ? 2 : 1,
      warnings: tall ? ["two"] : [],
    },
  ];
  let inside: CustomParams | null = null;
  const xi = W / 2 - b;
  if (o.extra === "hanging") {
    const ys = H - 330;
    const ip: CustomPart[] = [
      { id: "SH", name: "Shelf", size: [W - 2 * b - 4, 20, D - 2 * b], pos: [0, ys + 10, 0], material: "metal" },
      { id: "RL", name: "Clothes rail", size: [W - 2 * b - 10, 25, 25], pos: [0, ys - 60, 0], shape: "cyl", material: "metal" },
    ];
    inside = {
      parts: ip,
      steps: [
        {
          title: "Click in the shelf holders",
          detail: "Four, at the height you want under the top, the same on both sides.",
          fix: [fixAt(SHELF_PIN, [-1, 1].flatMap((sx) => [-D / 2 + 40, D / 2 - 40].map((z): Vec3 => [sx * xi, ys - 6, z])), [0, -1, 0], "SH"), fixAt(HW.clip, [-1, 1].flatMap((sx) => [-D / 2 + 80, D / 2 - 80].map((z): Vec3 => [sx * xi, ys - 6, z])), [0, -1, 0], "SH")],
        },
        { title: "Lay the shelf on the holders", detail: "Press it down at each corner until it sits on all four.", add: ["SH"], from: { SH: [0, 0, 400] } },
        {
          title: "Clip the rail under the shelf",
          detail: "Its brackets hook under the shelf's edge; push them up until they click.",
          add: ["RL"],
          from: { RL: [0, -200, 0] },
          fix: [fixAt({ kind: "clip", len: 8, dia: 14 }, [-1, 1].flatMap((sx) => [-60, 60].map((dz): Vec3 => [sx * (xi - 40), ys - 2, dz])), [0, 1, 0], "SH")],
        },
      ],
    };
  } else if (o.extra === "shoes") {
    const tilt = 0.3;
    const sd = D - 2 * b - 10;
    const ip: CustomPart[] = [0, 1].map((i) => ({ id: `SS${i}`, name: "Shoe shelf", size: [W - 2 * b - 4, 4, sd], pos: [0, b + ((H - 2 * b) * (i + 1)) / 3, 0], rot: [tilt, 0, 0], material: "metal" }));
    const pins = (i: number, front: boolean, back: boolean): Vec3[] => {
      const y = b + ((H - 2 * b) * (i + 1)) / 3;
      const dy = Math.sin(tilt) * (sd / 2 - 20);
      return [-1, 1].flatMap((sx) => [...(back ? [[sx * xi, y + dy - 8, -sd / 2 + 20] as Vec3] : []), ...(front ? [[sx * xi, y - dy - 8, sd / 2 - 20] as Vec3] : [])]);
    };
    const holder = (pts: Vec3[], on: string) => [fixAt(SHELF_PIN, pts, [0, -1, 0], on), fixAt(HW.clip, pts.map((p): Vec3 => [p[0], p[1] - 26, p[2]]), [0, -1, 0], on)];
    inside = {
      parts: ip,
      steps: [
        { title: "Click in the holders for the bottom shelf", detail: "Two high at the back and two low at the front, a cap clicked onto each.", fix: holder(pins(0, true, true), "SS0") },
        { title: "Lay in the bottom shoe shelf", detail: "Lip at the front. Press it down until it clicks onto the holders.", add: ["SS0"], from: { SS0: [0, 0, 400] } },
        { title: "Click in the back holders for the top shelf", detail: "Same as before, high at the back.", fix: holder(pins(1, false, true), "SS1") },
        { title: "Lay in the top shoe shelf", detail: "Lip at the front, resting on the back holders.", add: ["SS1"], from: { SS1: [0, 0, 400] } },
        { title: "Click in its front holders", detail: "Under the front edge, so it clicks down onto them.", fix: holder(pins(1, true, false), "SS1") },
      ],
    };
  }
  const wall: Vec3[] = [-1, 1].map((sx): Vec3 => [sx * (W / 2 - 60), H - b - 30, -D / 2 + b]);
  return { frame: { parts, steps }, inside, wall };
}

function buildOpen(b: PlanBuilder, s: ProductSpec, o: Open) {
  const { frame, inside, wall } = openRecipe(o);
  buildCustom(b, { ...s, custom: frame });
  const host = keyAt(b, frame.parts.find((p) => p.id === "ET")!.pos);
  if (host) wallStep(b, wall.map((at) => ({ host, at })), { two: o.H >= 1200, title: "Fix it to the wall" });
  if (inside) buildCustom(b, { ...s, custom: inside });
}

const family: Family = {
  names: ["PLATSA"],
  build(b, s) {
    const o = openOf(s);
    if (o) {
      buildOpen(b, s, o);
      return true;
    }
    const L = layoutOf(s);
    if (!L) return false;
    buildFrames(b, s, L);
    return true;
  },
  // the wardrobe sets are rows of frames of different heights: drawn whole, not as one frame repeated
  row(b, s) {
    const L = comboOf(s.slug ?? "", s.size.w * 10, s.size.h * 10, s.size.d * 10);
    if (!L) return false;
    buildFrames(b, s, L);
    return true;
  },
};
export default family;

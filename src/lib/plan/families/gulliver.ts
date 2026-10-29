import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomParams, CustomStep, PartMaterial, PartPiece, ProductSpec, Vec3 } from "../../types";
import { boxOf } from "../custom";

/**
 * GULLIVER, read from IKEA's manuals. The cot (and the US crib, the same build a little bigger) is four barred
 * panels: dowels go into one end of both sides, the first end panel is bolted on with long bolts into barrel nuts,
 * the slatted base gets four hooks and, with the cot stood on that end, drops onto the hooks at the high or low
 * level. Dowels go into the other ends, the second end panel is bolted on from above, and once it stands up a lock
 * plate is screwed over each hook. The changing table is three framed shelves (rails, side pieces and a panel slid
 * into their grooves, all on dowels) pushed onto one end ladder, screwed from outside, two back rails added, and the
 * other end ladder pushed on and screwed, with the table lying on its front.
 */

type Kind = CustomFix["kind"];
interface Pc {
  size: Vec3;
  pos: Vec3;
  shape?: "box" | "cyl";
  material?: PartMaterial;
}

const at = (kind: Kind, pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: { len?: number; dia?: number; name?: string } = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });
const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material?: PartMaterial): Pc => ({
  size: [x1 - x0, y1 - y0, z1 - z0],
  pos: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
  material,
});
const one = (id: string, name: string, p: Pc, material: PartMaterial = "wood"): CustomPart => ({ id, name, size: p.size, pos: p.pos, shape: p.shape, material: p.material ?? material });

function group(id: string, name: string, pcs: Pc[], material: PartMaterial = "wood"): CustomPart {
  const bs = pcs.map((p) => boxOf(p));
  const lo = [0, 1, 2].map((k) => Math.min(...bs.map((b) => b.min[k])));
  const hi = [0, 1, 2].map((k) => Math.max(...bs.map((b) => b.max[k])));
  const pos = [0, 1, 2].map((k) => Math.round(((lo[k] + hi[k]) / 2) * 10) / 10) as Vec3;
  const size = [0, 1, 2].map((k) => Math.round((hi[k] - lo[k]) * 10) / 10) as Vec3;
  const pieces: PartPiece[] = pcs.map((p) => ({ shape: p.shape ?? "box", size: p.size, pos: [p.pos[0] - pos[0], p.pos[1] - pos[1], p.pos[2] - pos[2]], material: p.material ?? material }));
  return { id, name, size, pos, pieces, material };
}

/** Bars spaced about `gap` apart between a and b along one axis. */
function bars(a: number, b: number, gap: number, make: (c: number) => Pc): Pc[] {
  const n = Math.max(1, Math.round((b - a) / gap) - 1);
  return Array.from({ length: n }, (_, i) => make(a + ((b - a) * (i + 1)) / (n + 1)));
}

/* ---------- cot and crib ---------- */

function cot(s: ProductSpec): CustomParams {
  // IKEA's outside sizes, from the mattress size in the name (the catalog's are a few cm off)
  const m = /(\d+)\s*[x×]\s*(\d+)/.exec(s.variant);
  const bw = m ? Number(m[1]) : 60, bl = m ? Number(m[2]) : 120;
  const crib = bl > 125;
  const L = crib ? 1370 : bl * 10 + 40, D = crib ? 750 : bw * 10 + 60, H = crib ? 840 : 800;
  const P = 45; // corner posts
  const xp = L / 2 - P / 2, zp = D / 2 - P / 2;
  const top0 = H - 60, top1 = H - 20, bot0 = 130, bot1 = 175; // the side panels' rails
  const ST = 30; // side panel thickness
  const end = (id: string, sx: number) => {
    const x = sx * xp;
    return group(id, "End panel", [
      box(x - P / 2, x + P / 2, 0, H, -D / 2, -D / 2 + P),
      box(x - P / 2, x + P / 2, 0, H, D / 2 - P, D / 2),
      box(x - 12, x + 12, H - 70, H - 10, -D / 2 + P, D / 2 - P),
      box(x - 12, x + 12, bot0, bot1, -D / 2 + P, D / 2 - P),
      ...bars(-D / 2 + P, D / 2 - P, 75, (z) => ({ shape: "cyl", size: [20, H - 70 - bot1, 20], pos: [x, (H - 70 + bot1) / 2, z] })),
    ]);
  };
  const side = (id: string, sz: number) => {
    const z = sz * zp;
    return group(id, "Side panel", [
      box(-L / 2 + P, L / 2 - P, top0, top1, z - ST / 2, z + ST / 2),
      box(-L / 2 + P, L / 2 - P, bot0, bot1, z - ST / 2, z + ST / 2),
      ...bars(-L / 2 + P, L / 2 - P, 72, (x) => ({ shape: "cyl", size: [20, top0 - bot1, 20], pos: [x, (top0 + bot1) / 2, z] })),
    ]);
  };
  // the slatted base, at the high level for a newborn
  const yb = 400, bx = L / 2 - P - 4, bz = zp - ST / 2 - 4;
  const base = group("B", "Bed base", [
    box(-bx, bx, yb - 50, yb, -bz, -bz + 22),
    box(-bx, bx, yb - 50, yb, bz - 22, bz),
    ...bars(-bx, bx, 140, (x) => box(x - 35, x + 35, yb - 12, yb, -bz + 22, bz - 22)),
  ]);
  const parts: CustomPart[] = [end("E1", -1), side("S1", -1), side("S2", 1), base, end("E2", 1)];
  const railY = [(top0 + top1) / 2, (bot0 + bot1) / 2];
  const dowels = (sx: number) => [-1, 1].flatMap((sz) => railY.map((y) => [sx * (L / 2 - P), y + 12, sz * zp] as Vec3));
  const bolts = (sx: number) => [-1, 1].flatMap((sz) => railY.map((y) => [sx * (L / 2), y - 8, sz * zp] as Vec3));
  const nuts = (sx: number) => [-1, 1].flatMap((sz) => railY.map((y) => [sx * (L / 2 - P - 40), y - 8, sz * (zp - ST / 2)] as Vec3));
  const sideDowels = (sx: number) => [-1, 1].map((sz) => at("dowel", dowels(sx).filter((p) => Math.sign(p[2]) === sz), [sx, 0, 0], sz < 0 ? "S1" : "S2", sx < 0 ? "E1" : "E2"));
  const nutFix = (sx: number) => [-1, 1].map((sz) => at("nut", nuts(sx).filter((p) => Math.sign(p[2]) === sz), [0, 0, sz], sz < 0 ? "S1" : "S2", undefined, { len: 12, dia: 10, name: "Barrel nut" }));
  const hookPts: Vec3[] = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (bx - 30), yb - 50, sz * (bz - 11)] as Vec3));
  const hooks: CustomFix[] = crib
    ? [
        at("bolt", hookPts.map((p) => [p[0], yb, p[2]] as Vec3), [0, -1, 0], "B", undefined, { len: 40, dia: 6 }),
        at("hook", hookPts, [0, 1, 0], "B", undefined, { name: "Base hook" }),
      ]
    : [
        at("nut", hookPts.map((p) => [p[0], yb, p[2]] as Vec3), [0, -1, 0], "B", undefined, { len: 12, dia: 10, name: "Connector nut" }),
        at("hook", hookPts, [0, 1, 0], "B", undefined, { name: "L-shaped hook" }),
      ];
  const plates: Vec3[] = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (L / 2 - P - 30), yb - 25, sz * (D / 2 - P / 2 + ST / 2)] as Vec3));
  const steps: CustomStep[] = [
    {
      title: "Tap dowels into one end of each side",
      detail: "Lay both side panels on a rug. Two dowels in the end of each, top rail and bottom rail.",
      add: ["S1", "S2"],
      fix: sideDowels(-1),
      tools: ["hammer"],
      warnings: ["floor"],
    },
    {
      title: "Bolt the first end panel to the sides",
      detail: "Drop a barrel nut into each side's hole, slot towards the bolt, then turn the long bolts in through the end posts.",
      add: ["E1"],
      fix: [...nutFix(-1), at("bolt", bolts(-1), [1, 0, 0], "E1", undefined, { len: 90, dia: 6 })],
      tools: ["allen", "flathead"],
    },
    {
      title: "Screw the four hooks into the bed base",
      detail: crib ? "One in each corner: the bolt goes down through the base into the hook under it." : "One in each corner: the hook goes in from below, the nut from above.",
      fix: hooks,
      wait: ["B"],
      tools: ["allen"],
    },
    {
      title: "Stand it on its end and hook the base in",
      detail: "The high level for a newborn, the low one once your baby can sit up. Each hook goes into its hole in the side panel.",
      add: ["B"],
      pose: "+x",
    },
    { title: "Tap dowels into the other ends", detail: "Two in the top end of each side panel.", fix: sideDowels(1), tools: ["hammer"] },
    {
      title: "Bolt on the second end panel",
      detail: "Barrel nuts in first, then press the end panel down onto the dowels and turn in the four long bolts.",
      add: ["E2"],
      fix: [...nutFix(1), at("bolt", bolts(1), [-1, 0, 0], "E2", undefined, { len: 90, dia: 6 })],
      tools: ["allen", "flathead"],
    },
    {
      title: "Stand it up and screw on the lock plates",
      detail: "One over each of the base's hooks, outside the sides, so the base can't lift out.",
      fix: [-1, 1].map((sz) => at("clip", plates.filter((p) => Math.sign(p[2]) === sz), [0, 0, -sz], sz < 0 ? "S1" : "S2", undefined, { len: 6, dia: 30, name: "Lock plate" })).concat(
        [-1, 1].map((sz) => at("screw", plates.filter((p) => Math.sign(p[2]) === sz).map((p) => [p[0], p[1] - 10, p[2]] as Vec3), [0, 0, -sz], sz < 0 ? "S1" : "S2", undefined, { len: 14, dia: 4 })),
      ),
      pose: "+y",
      tools: ["screwdriver"],
      check: "square",
    },
  ];
  return { parts, steps };
}

/* ---------- changing table ---------- */

function changing(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const P = 40; // the end ladders' posts
  const xi = W / 2 - P; // inside face of each ladder
  const zr = D / 2 - P / 2;
  const ladder = (id: string, sx: number) => {
    const x = sx * (W / 2 - P / 2);
    return group(id, "End ladder", [
      box(x - P / 2, x + P / 2, 0, H - 30, -D / 2, -D / 2 + P),
      box(x - P / 2, x + P / 2, 0, H - 30, D / 2 - P, D / 2),
      box(x - 14, x + 14, H - 110, H - 30, -D / 2 + P, D / 2 - P),
      box(x - 14, x + 14, 150, 200, -D / 2 + P, D / 2 - P),
      ...bars(-D / 2 + P, D / 2 - P, 75, (z) => box(x - 10, x + 10, 200, H - 110, z - 11, z + 11)),
    ]);
  };
  const parts: CustomPart[] = [];
  // a framed shelf: front and back rails, two side pieces, a panel in their grooves
  const frame = (k: string, y: number, rim: number) => {
    const t = 40, zb = -D / 2 + 25, zf = D / 2 - 25;
    parts.push(one(`${k}F`, "Front rail", box(-xi, xi, y - t, y, zf - 20, zf)));
    parts.push(one(`${k}B`, rim ? "Back rail with rim" : "Back rail", box(-xi, xi, y - t, y + rim, zb, zb + 20)));
    parts.push(one(`${k}L`, "Side piece", box(-xi, -xi + 20, y - t, y, zb + 20, zf - 20)));
    parts.push(one(`${k}R`, "Side piece", box(xi - 20, xi, y - t, y, zb + 20, zf - 20)));
    parts.push(one(`${k}P`, "Shelf panel", box(-xi + 20, xi - 20, y - 22, y - 10, zb + 20, zf - 20), "board"));
    return { y, zb, zf, t };
  };
  const ft = frame("T", H - 30, 30);
  const f1 = frame("M", 540, 0);
  const f2 = frame("L", 230, 0);
  parts.push(ladder("A", -1));
  parts.push(one("RB0", "Back rail", box(-xi, xi, 700, 740, -D / 2, -D / 2 + 20)));
  parts.push(one("RB1", "Back rail", box(-xi, xi, 380, 420, -D / 2, -D / 2 + 20)));
  parts.push(ladder("Z", 1));

  const frameDowels = (k: string, f: { y: number; zb: number; zf: number; t: number }, rail: "F" | "B") => {
    const z = rail === "F" ? f.zf - 20 : f.zb + 20;
    return [-1, 1].map((sx) =>
      at("dowel", [[sx * (xi - 10), f.y - 8, z], [sx * (xi - 10), f.y - 32, z]], [0, 0, rail === "F" ? -1 : 1], `${k}${rail}`, `${k}${sx < 0 ? "L" : "R"}`, { len: 30, dia: 6, name: "Plain dowel" }),
    );
  };
  // one in the end of the front rail, one in the end of the back rail, each on its own rail so its hole is drilled there
  const endDowel = (k: string, f: { y: number; zb: number; zf: number }, sx: number): CustomFix[] =>
    (["F", "B"] as const).map((r) => at("dowel", [[sx * xi, f.y - 20, r === "F" ? f.zf - 10 : f.zb + 10]], [sx, 0, 0], `${k}${r}`, sx < 0 ? "A" : "Z", { len: 30, dia: 8, name: "Fluted dowel" }));
  // the top's ends already carry two dowels; the ladder takes two more into its side pieces
  const topMid = (sx: number): CustomFix =>
    at("dowel", [[sx * xi, ft.y - 20, -60], [sx * xi, ft.y - 20, 60]], [sx, 0, 0], `T${sx < 0 ? "L" : "R"}`, sx < 0 ? "A" : "Z", { len: 30, dia: 8, name: "Fluted dowel" });
  const ladderScrews = (sx: number, withRails: boolean): Vec3[] => [
    ...[ft, f1, f2].flatMap((f) => [f.zf - 10, f.zb + 10].map((z) => [sx * (W / 2), f.y - 20, z] as Vec3)),
    ...(withRails ? [720, 400].map((y) => [sx * (W / 2), y, -D / 2 + 10] as Vec3) : []),
  ];
  const ids = (ks: string[], suf: string) => ks.map((k) => `${k}${suf}`);
  const steps: CustomStep[] = [
    { title: "Tap plain dowels into the top's front rail", detail: "The smooth dowels, two into each end. Keep the ribbed ones for later.", add: ["TF"], fix: frameDowels("T", ft, "F"), tools: ["hammer"] },
    { title: "Push the side pieces onto the front rail", detail: "Grooves facing in.", add: ["TL", "TR"] },
    { title: "Slide the panel into the grooves", detail: "Down into the side pieces until it sits in the front rail's groove.", add: ["TP"] },
    {
      title: "Press the back rail on",
      detail: "Plain dowels in its ends first, then onto the side pieces over the panel's edge. This is the changing top, with its raised rim.",
      add: ["TB"],
      fix: frameDowels("T", ft, "B"),
      tools: ["hammer"],
    },
    { title: "Tap ribbed dowels into the top's ends", detail: "Two at each end, into the rails.", fix: [...endDowel("T", ft, -1), ...endDowel("T", ft, 1)], tools: ["hammer"] },
    {
      title: "Build the two shelves the same way",
      detail: "Back rail, plain dowels, side pieces on the front rail, panel in, back rail on. The panel's smooth side faces up.",
      add: [...ids(["M", "L"], "F"), ...ids(["M", "L"], "L"), ...ids(["M", "L"], "R"), ...ids(["M", "L"], "P"), ...ids(["M", "L"], "B")],
      fix: [...frameDowels("M", f1, "F"), ...frameDowels("M", f1, "B"), ...frameDowels("L", f2, "F"), ...frameDowels("L", f2, "B")],
      tools: ["hammer"],
    },
    {
      title: "Push the top and shelves onto one end ladder",
      detail: "Lay the table on its front on a rug. Ribbed dowels into the ladder's holes, then push all three frames on.",
      add: ["A"],
      fix: [...endDowel("M", f1, -1), ...endDowel("L", f2, -1), topMid(-1)],
      pose: "-z",
      tools: ["hammer"],
      warnings: ["floor"],
    },
    { title: "Screw the ladder to the frames", detail: "Six long screws through the posts, two into each frame.", fix: [at("screw", ladderScrews(-1, false), [1, 0, 0], "A", undefined, { len: 70, dia: 5 })], tools: ["allen"] },
    {
      title: "Tap dowels into the two back rails",
      detail: "One ribbed dowel in each end.",
      fix: [-1, 1].flatMap((sx) => [720, 400].map((y, i) => at("dowel", [[sx * xi, y, -D / 2 + 10]], [sx, 0, 0], `RB${i}`, sx < 0 ? "A" : "Z", { len: 30, dia: 8, name: "Fluted dowel" }))),
      wait: ["RB0", "RB1"],
      tools: ["hammer"],
    },
    { title: "Slide the back rails in", detail: "Into the ladder's holes, across the back.", add: ["RB0", "RB1"] },
    { title: "Screw the back rails to the ladder", detail: "One long screw through the post into each rail.", fix: [at("screw", [720, 400].map((y) => [-W / 2, y, -D / 2 + 10] as Vec3), [1, 0, 0], "A", undefined, { len: 70, dia: 5 })], tools: ["allen"] },
    { title: "Push the other end ladder on", detail: "Six ribbed dowels into its holes first, then press it onto all the frames and rails.", add: ["Z"], fix: [topMid(1), ...endDowel("M", f1, 1), ...endDowel("L", f2, 1)], tools: ["hammer"] },
    { title: "Screw the second ladder on", detail: "Eight long screws: two into each frame and one into each back rail.", fix: [at("screw", ladderScrews(1, true), [-1, 0, 0], "Z", undefined, { len: 70, dia: 5 })], tools: ["allen"], check: "square" },
    { title: "Stand it up", detail: "Check it stands steady before you use it.", pose: "+y", people: 2, warnings: ["two"] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["GULLIVER"],
  recipe(s) {
    const v = s.variant.toLowerCase();
    if (/changing table/.test(v)) return changing(s);
    if (/^(cot|crib)/.test(v)) return cot(s);
    return null;
  },
};
export default family;

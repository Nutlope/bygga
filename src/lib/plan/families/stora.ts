import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, ProductSpec, Vec3 } from "../../types";

/**
 * STORÅ, read from the loft bed's manual (ladder on the left, the first of its two ways). Each end frame is two posts
 * and four rails, built lying on a rug: dowels in the rail ends, long bolts through the posts into barrel nuts, glides
 * tapped under the feet. Two people stand the frames up and hold the long rails between them, back first, then the
 * front, each bolted into barrel nuts, and all eighteen bolts get a last turn. Uprights are bolted onto the back and
 * front with cap nuts, the two front guard boards go in between, the ladder is built with dowels and bolts and hung
 * on the front rail, then the slat ledges, the centre beam and the slats go in, pinned down.
 */

const P = 70; // posts, square
const RT = 30; // rails, thick

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 203 long, 147 wide, 214 high, bed base 171 from the floor, mattress 135 x 189, 19 at most
  const W = Math.round(s.size.w * 10) || 2030, D = Math.round(s.size.d * 10) || 1470, H = 2140;
  const xp = W / 2 - P / 2, zp = D / 2 - P / 2;
  const xi = xp - P / 2, zi = zp - P / 2; // inside faces of the posts
  const Y = { top: [2020, 2120], mid: [1870, 1970], bed: [1620, 1760], low: [650, 750] } as const;
  type Lvl = keyof typeof Y;
  const yc = (l: Lvl) => (Y[l][0] + Y[l][1]) / 2;
  const hh = (l: Lvl) => Y[l][1] - Y[l][0];
  const parts: CustomPart[] = [];
  const add = (p: CustomPart) => (parts.push(p), p.id);
  const posts = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => add({ id: `P${sx < 0 ? "L" : "R"}${sz < 0 ? "b" : "f"}`, name: "Post", size: [P, H, P], pos: [sx * xp, H / 2, sz * zp], material: "wood" })));
  void posts;
  const lv: Lvl[] = ["top", "mid", "bed", "low"];
  for (const sx of [-1, 1]) for (const l of lv) add({ id: `E${sx < 0 ? "L" : "R"}${l}`, name: "End rail", size: [RT, hh(l), 2 * zi], pos: [sx * xp, yc(l), 0], material: "wood" });
  const longs: [string, Lvl, number][] = [["BB", "bed", -1], ["BT", "top", -1], ["BW", "low", -1], ["BM", "mid", -1], ["FW", "low", 1], ["FB", "bed", 1]];
  for (const [id, l, sz] of longs) add({ id, name: l === "bed" ? "Bed rail" : l === "low" ? "Lower rail" : "Guard rail", size: [2 * xi, hh(l), RT], pos: [0, yc(l), sz * zp], material: "wood" });
  // uprights, outside the rails
  const xU = [-330, 330], xUF = [-W / 2 + P + 620, 330];
  xU.forEach((x, i) => add({ id: `UB${i + 1}`, name: "Upright", size: [90, Y.top[1] - Y.bed[0], 25], pos: [x, (Y.top[1] + Y.bed[0]) / 2, -zp - RT / 2 - 12], material: "wood" }));
  xUF.forEach((x, i) => add({ id: `UF${i + 1}`, name: "Upright", size: [90, Y.top[1] - Y.bed[0], 25], pos: [x, (Y.top[1] + Y.bed[0]) / 2, zp + RT / 2 + 12], material: "wood" }));
  const gx0 = xUF[0] - 45;
  for (const [id, l] of [["G1", "mid"], ["G2", "top"]] as const) add({ id, name: "Guard board", size: [xi - gx0, hh(l), RT], pos: [(xi + gx0) / 2, yc(l), zp], material: "wood" });
  // the bed base: ledges inside the long bed rails, a centre beam, slats
  const yB = 1710, st = 14;
  [-1, 1].forEach((sz) => [-1, 0, 1].forEach((k, i) => add({ id: `LE${sz < 0 ? "b" : "f"}${i}`, name: "Slat ledge", size: [600, 20, 22], pos: [k * 630, yB - st - 10, sz * (zp - RT / 2 - 11)], material: "wood" })));
  add({ id: "CB", name: "Centre beam", size: [2 * xi, 70, 45], pos: [0, yB - st - 35, 0], material: "wood" });
  const nS = 16, sw = 70;
  const slatX = Array.from({ length: nS }, (_, k) => -xi + sw / 2 + 20 + (k * (2 * xi - sw - 40)) / (nS - 1));
  const slats = slatX.map((x, k) => add({ id: `S${k + 1}`, name: "Slat", size: [sw, st, 2 * (zp - RT / 2)], pos: [x, yB - st / 2, 0], material: "wood" }));
  // the ladder, leaning in front of the left opening
  const lx = (gx0 - xi) / 2, lw = 450, yL = 2040, zL0 = zp + RT / 2 + 40, run = 720;
  const lean = -Math.atan2(run, yL);
  const ll = Math.hypot(run, yL);
  const ladder = [-1, 1].map((k, i) => add({ id: `LS${i + 1}`, name: "Ladder side", size: [30, ll, 80], pos: [lx + (k * lw) / 2, yL / 2, zL0 + run / 2], rot: [lean, 0, 0], material: "wood" }));
  const rungY = Array.from({ length: 6 }, (_, k) => 260 + k * 290);
  const zAt = (y: number) => zL0 + run * (1 - y / yL);
  const rungs = rungY.map((y, k) => add({ id: `LR${k + 1}`, name: "Rung", size: [lw - 30, 28, 90], pos: [lx, y, zAt(y)], material: "wood" }));
  add({ id: "MT", name: "Your mattress", size: [2 * xi - 20, 160, 2 * (zp - RT / 2) - 20], pos: [0, yB + 80, 0], material: "soft", extra: true });

  // fittings: a long bolt through a post into a rail end, a barrel nut dropped into the rail to meet it
  const bolt = (len: number) => ({ kind: "bolt" as const, len, dia: 6 });
  const intoEnd = (rail: string, n: number, len = 110): CustomFix[] => {
    const r = parts.find((p) => p.id === rail)!;
    const alongX = r.size[0] > r.size[2];
    const ys = n === 1 ? [r.pos[1]] : [r.pos[1] - r.size[1] / 4, r.pos[1] + r.size[1] / 4];
    return [-1, 1].flatMap((e): CustomFix[] => {
      const post = alongX ? `P${e < 0 ? "L" : "R"}${r.pos[2] < 0 ? "b" : "f"}` : `P${r.pos[0] < 0 ? "L" : "R"}${e < 0 ? "b" : "f"}`;
      const pt = (y: number, off: number): Vec3 => (alongX ? [e * (W / 2 - off), y, r.pos[2]] : [r.pos[0], y, e * (D / 2 - off)]);
      const dir: Vec3 = alongX ? [-e, 0, 0] : [0, 0, -e];
      const nutAt = (y: number): Vec3 => (alongX ? [e * (xi - 45), y, r.pos[2] - Math.sign(r.pos[2]) * RT / 2] : [r.pos[0] - Math.sign(r.pos[0]) * RT / 2, y, e * (zi - 45)]);
      const nutDir: Vec3 = alongX ? [0, 0, Math.sign(r.pos[2])] : [Math.sign(r.pos[0]), 0, 0];
      return [
        { ...bolt(len), count: ys.length, at: ys.map((y) => pt(y, 0)), dir, on: post, mate: rail },
        { kind: "nut", name: "Barrel nut", dia: 10, count: ys.length, at: ys.map(nutAt), dir: nutDir, on: rail },
      ];
    });
  };
  const dowels = (rail: string, n = 1): CustomFix[] => {
    const r = parts.find((p) => p.id === rail)!;
    const alongX = r.size[0] > r.size[2];
    const ends = n === 2 ? [-1, 1] : [1];
    return ends.map((e): CustomFix => ({
      kind: "dowel",
      count: 1,
      at: [alongX ? [e * xi, r.pos[1] + r.size[1] / 2 - 25, r.pos[2]] : [r.pos[0], r.pos[1] + r.size[1] / 2 - 25, e * zi]],
      dir: alongX ? [-e, 0, 0] : [0, 0, -e],
      on: rail,
    }));
  };
  const endDowels = (side: "L" | "R") => lv.flatMap((l) => dowels(`E${side}${l}`, 2));
  const endBolts = (side: "L" | "R") => lv.flatMap((l) => intoEnd(`E${side}${l}`, l === "bed" || l === "low" ? 2 : 1));
  const glides = (side: "L" | "R"): CustomFix[] =>
    [-1, 1].map((sz) => ({ kind: "glide", name: "Glide", count: 1, len: 6, dia: 24, at: [[(side === "L" ? -1 : 1) * xp, 0, sz * zp]], dir: [0, 1, 0], on: `P${side}${sz < 0 ? "b" : "f"}` }));
  // cap nut bolts through an upright into a rail or board
  const capBolts = (up: string, into: string[], perRail: number): CustomFix[] => {
    const u = parts.find((p) => p.id === up)!;
    const sz = Math.sign(u.pos[2]);
    return into.map((id) => {
      const r = parts.find((p) => p.id === id)!;
      const ys = perRail === 1 ? [r.pos[1]] : [r.pos[1] - r.size[1] / 4, r.pos[1] + r.size[1] / 4];
      return { kind: "bolt", name: "Bolt with cap nut", len: 60, dia: 6, count: ys.length, at: ys.map((y): Vec3 => [u.pos[0], y, u.pos[2] + sz * 12]), dir: [0, 0, -sz], on: up, mate: id };
    });
  };
  const frameL = ["PLb", "PLf", "ELtop", "ELmid", "ELbed", "ELlow"];
  const frameR = ["PRb", "PRf", "ERtop", "ERmid", "ERbed", "ERlow"];
  const ladderParts = [...ladder, ...rungs];
  const aside = Object.fromEntries(ladderParts.map((id) => [id, [0, 0, 700] as Vec3]));

  const steps: CustomStep[] = [
    { title: "Lay out the posts for one end", detail: "Two posts flat on a rug, the holes facing in.", add: ["PLb", "PLf"], pose: "+x", warnings: ["floor"] },
    { title: "Tap dowels into the rails", detail: "One in each end of the four end rails.", fix: endDowels("L"), wait: ["ELtop", "ELmid", "ELbed", "ELlow"], tools: ["hammer"] },
    { title: "Push the rails into one post", detail: "The three upper rails and the lower one, dowels into their holes.", add: ["ELtop", "ELmid", "ELbed", "ELlow"] },
    {
      title: "Bolt the rails between the posts",
      detail: "Drop a barrel nut into each hole in the rails, slot facing the bolt, then turn the long bolts in through the posts. Not fully tight yet.",
      fix: endBolts("L"),
      tools: ["allen", "flathead"],
    },
    { title: "Tap the glides under the feet", detail: "One under each post, with a hammer.", fix: glides("L"), tools: ["hammer"] },
    {
      title: "Build the other end frame the same way",
      detail: "Dowels, rails, barrel nuts and bolts, then the two glides. Then stand both ends up.",
      add: frameR,
      fix: [...endDowels("R"), ...endBolts("R"), ...glides("R")],
      tools: ["allen", "hammer"],
      pose: "+y",
    },
    {
      title: "Hold the back bed rail between the ends",
      detail: "Two people stand the ends up and hold the long rail at bed height, the side with the ledge holes facing in.",
      add: ["BB"],
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Bolt it in with the long barrel nuts",
      detail: "One long barrel nut and one bolt at each end. That holds it while you go on.",
      fix: [-1, 1].flatMap((e): CustomFix[] => [
        { kind: "bolt", len: 80, dia: 6, count: 1, at: [[e * (W / 2), yc("bed") + 30, -zp]], dir: [-e, 0, 0], on: `P${e < 0 ? "L" : "R"}b`, mate: "BB" },
        { kind: "nut", name: "Long barrel nut", dia: 12, count: 1, at: [[e * (xi - 60), yc("bed") + 30, -zp + RT / 2]], dir: [0, 0, -1], on: "BB" },
      ]),
      tools: ["allen", "flathead"],
      people: 2,
    },
    { title: "Lift the back top rail into place", detail: "Tap a dowel into each end first, then push it in at the top of the posts.", add: ["BT"], fix: dowels("BT", 2), people: 2, warnings: ["two"], tools: ["hammer"] },
    { title: "Bolt the top rail and the bed rail", detail: "Barrel nuts in the rails, bolts through the posts. Stop with the bolt heads a little out.", fix: [...intoEnd("BT", 1), ...intoEnd("BB", 1)], tools: ["allen", "flathead"] },
    { title: "Fit the back lower rail", detail: "Hold it between the back posts at the low holes.", add: ["BW"] },
    { title: "Bolt the lower rail", detail: "Two bolts and barrel nuts at each end.", fix: intoEnd("BW", 2), tools: ["allen", "flathead"] },
    { title: "Fit the back middle rail", detail: "A dowel in each end, then into the posts between the top rail and the bed rail.", add: ["BM"], fix: dowels("BM", 2), tools: ["hammer"] },
    { title: "Bolt the middle rail", detail: "One bolt and barrel nut at each end.", fix: intoEnd("BM", 1), tools: ["allen", "flathead"] },
    { title: "Fit the front lower rail", detail: "A dowel in each end, then between the front posts at the low holes.", add: ["FW"], fix: dowels("FW", 2), tools: ["hammer"] },
    { title: "Bolt the front lower rail", detail: "One bolt and barrel nut at each end.", fix: intoEnd("FW", 1), tools: ["allen", "flathead"] },
    { title: "Lift the front bed rail into place", detail: "Two people. Dowels in its ends, then push it in at bed height.", add: ["FB"], fix: dowels("FB", 2), people: 2, warnings: ["two"], tools: ["hammer"] },
    { title: "Bolt the front bed rail", detail: "Two bolts and barrel nuts at each end.", fix: intoEnd("FB", 2), tools: ["allen", "flathead"] },
    { title: "Tighten all the bolts", detail: "Go round all eighteen long bolts and tighten them, so the frame stands square.", tools: ["allen"], check: "square" },
    {
      title: "Bolt the uprights to the back rails",
      detail: "Two uprights outside the back, each with a bolt into the top, middle and bed rails, nuts from the inside.",
      add: ["UB1", "UB2"],
      fix: [...capBolts("UB1", ["BT", "BM"], 1), ...capBolts("UB1", ["BB"], 2), ...capBolts("UB2", ["BT", "BM"], 1), ...capBolts("UB2", ["BB"], 2)],
      tools: ["allen"],
    },
    { title: "Bolt the uprights to the front bed rail", detail: "Two at the front, two bolts each. The left one marks the ladder opening.", add: ["UF1", "UF2"], fix: [...capBolts("UF1", ["FB"], 2), ...capBolts("UF2", ["FB"], 2)], tools: ["allen"] },
    { title: "Fit the lower guard board", detail: "A dowel in its right end, into the front post.", add: ["G1"], fix: [{ kind: "dowel", count: 1, at: [[xi, yc("mid") + 25, zp]], dir: [-1, 0, 0], on: "G1" }], tools: ["hammer"] },
    { title: "Bolt it to the left upright", detail: "One bolt with a cap nut.", fix: capBolts("UF1", ["G1"], 1), tools: ["allen"] },
    { title: "Bolt it to the post", detail: "A barrel nut in the board and a long bolt through the post.", fix: intoEnd("G1", 1).filter((f) => (f.at![0][0] > 0)), tools: ["allen", "flathead"] },
    { title: "Fit the top guard board", detail: "A dowel in its right end, into the post.", add: ["G2"], fix: [{ kind: "dowel", count: 1, at: [[xi, yc("top") + 25, zp]], dir: [-1, 0, 0], on: "G2" }], tools: ["hammer"] },
    { title: "Bolt it to the uprights", detail: "One bolt with a cap nut into the left upright, and one into the other upright for each board.", fix: [...capBolts("UF1", ["G2"], 1), ...capBolts("UF2", ["G1", "G2"], 1)], tools: ["allen"] },
    { title: "Bolt it to the post", detail: "A barrel nut and a long bolt, like the board below.", fix: intoEnd("G2", 1).filter((f) => (f.at![0][0] > 0)), tools: ["allen", "flathead"] },
    { title: "Tighten the upright bolts", detail: "All four on the front guard, firmly.", tools: ["allen"] },
    {
      title: "Tap dowels into the ladder sides",
      detail: "Two in each rung hole, 24 in all, then push the rungs onto one side on the floor.",
      fix: [-1, 1].map((e, i): CustomFix => ({
        kind: "dowel",
        count: 12,
        at: rungY.flatMap((y) => [-25, 25].map((dz): Vec3 => [lx + e * (lw / 2 - 15), y, zAt(y) + dz])),
        dir: [e, 0, 0],
        on: ladder[i],
      })),
      wait: ladderParts,
      from: aside,
      tools: ["hammer"],
    },
    {
      title: "Bolt the ladder together",
      detail: "Lay the second side on, then a barrel nut and a bolt at each end of every rung.",
      fix: rungs.flatMap((id, k): CustomFix[] =>
        [-1, 1].flatMap((e, i): CustomFix[] => [
          { kind: "bolt", len: 80, dia: 6, count: 1, at: [[lx + e * (lw / 2 + 15), rungY[k], zAt(rungY[k])]], dir: [-e, 0, 0], on: ladder[i], mate: id },
          { kind: "nut", name: "Barrel nut", dia: 10, count: 1, at: [[lx + e * (lw / 2 - 60), rungY[k] + 14, zAt(rungY[k])]], dir: [0, -1, 0], on: id },
        ]),
      ),
      tools: ["allen", "flathead"],
    },
    {
      title: "Slide the hooks onto the ladder",
      detail: "One on the top of each side, open end towards the bed.",
      fix: ladder.map((id, i): CustomFix => ({ kind: "bracket", name: "Ladder hook", count: 1, len: 60, dia: 40, at: [[lx + (i ? 1 : -1) * (lw / 2), Y.bed[1], zL0 - 10]], dir: [0, 0, -1], on: id })),
    },
    {
      title: "Hang the ladder and bolt it on",
      detail: "Hook it over the front bed rail in the opening, then one bolt and cap nut through each hook into the rail.",
      add: ladderParts,
      fix: ladder.map((id, i): CustomFix => ({ kind: "bolt", name: "Bolt with cap nut", len: 60, dia: 6, count: 1, at: [[lx + (i ? 1 : -1) * (lw / 2), yc("bed"), zL0 - 10]], dir: [0, 0, -1], on: id, mate: "FB" })), // through the hook into the rail
      tools: ["allen"],
    },
    { title: "Click in the slat ledges", detail: "Three along the inside of each bed rail, hooked into the holes.", add: parts.filter((p) => p.name === "Slat ledge").map((p) => p.id) },
    {
      title: "Bolt in the centre beam",
      detail: "Between the two end bed rails, a barrel nut and a bolt at each end.",
      add: ["CB"],
      fix: [-1, 1].flatMap((e): CustomFix[] => [
        { kind: "bolt", len: 80, dia: 6, count: 1, at: [[e * (xp + RT / 2), yB - st - 35, 0]], dir: [-e, 0, 0], on: `E${e < 0 ? "L" : "R"}bed`, mate: "CB" },
        { kind: "nut", name: "Barrel nut", dia: 10, count: 1, at: [[e * (xi - 50), yB - st, 0]], dir: [0, -1, 0], on: "CB" },
      ]),
      tools: ["allen", "flathead"],
    },
    { title: "Lay the slats across", detail: "Evenly spaced on the ledges and the beam, rounded side up.", add: slats },
    {
      title: "Pin the slats down",
      detail: "Two pins through each slat into the ledges, knocked in with a hammer.",
      fix: [-1, 1].flatMap((sz) =>
        [-1, 0, 1].map((k, i): CustomFix => {
          const xs = slatX.filter((x) => Math.abs(x - k * 630) <= 315);
          return { kind: "pin", name: "Slat pin", count: xs.length, len: 30, dia: 6, at: xs.map((x): Vec3 => [x, yB, sz * (zp - RT / 2 - 11)]), dir: [0, -1, 0], on: `LE${sz < 0 ? "b" : "f"}${i}` };
        }),
      ),
      tools: ["hammer"],
    },
    { title: "Lay your mattress on", detail: "No thicker than 19 cm, so the guard rails stay above it.", add: ["MT"] },
  ];
  return { parts, steps: steps.map((st) => (st.fix ? { ...st, fix: merge(st.fix) } : st)) };
}

/** The guide takes ten fittings lists a step at most: join the lists that only differ in where they go. */
function merge(list: CustomFix[]): CustomFix[] {
  // keep the part each one sits in as long as it fits, since a part waiting beside the build carries its own
  const by = (on: boolean, mate: boolean) => {
    const m = new Map<string, CustomFix>();
    for (const f of list) {
      const k = [f.kind, f.name, f.len, f.dia, f.dir?.join(), on ? f.on : "", mate ? f.mate : ""].join("|");
      const g = m.get(k);
      if (!g) m.set(k, { ...f, at: [...(f.at ?? [])], ...(on ? {} : { on: undefined }), ...(mate ? {} : { mate: undefined }) });
      else {
        g.at!.push(...(f.at ?? []));
        g.count = g.at!.length;
      }
    }
    return [...m.values()];
  };
  for (const [on, mate] of [[true, true], [true, false]] as const) {
    const out = by(on, mate);
    if (out.length <= 10) return out;
  }
  return by(false, false);
}

const family: Family = { names: ["STORÅ", "STORA"], recipe };
export default family;

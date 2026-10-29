import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * VITVAL, read from its bunk and loft manuals. A white steel tube frame with grey fabric panels. Each panel is built
 * flat first: a flat bar along its bottom hem, short posts down its side pockets, a rod along the top, all screwed
 * together. The long panels are then bolted onto the bed rails that carry the slats. The ends are built lying on the
 * floor, stood up, and the long panels and rails are bolted between them with long frame bolts through the posts.
 * The ladder (on the right, as the first half of each manual shows it) is bolted to the frame, the slatted bases are
 * rolled out and bolted down, and the loft is strapped to the wall.
 */

const D = 32; // frame post
const RAIL_H = 40, RAIL_T = 25; // bed rail
const BAR_H = 25, BAR_T = 16; // a panel's bottom bar
const ROD = 20; // a panel's top rod
const PP = 16; // a panel's own little posts

const FRAME_BOLT = { len: 70, dia: 6, name: "Frame bolt" };
const FLAT_BOLT = { len: 12, dia: 6, name: "Flat-head bolt" };
const PANEL_SCREW = { len: 30, dia: 5, name: "Countersunk screw" };

interface Geo {
  loft: boolean;
  L: number;
  W: number;
  H: number;
  X: number;
  Z: number;
  lenX: number;
  lenZ: number;
  beds: number[]; // bottom of each bed rail, lowest first
  mW: number;
  mL: number;
}

function geoOf(s: ProductSpec): Geo | null {
  if (s.archetype !== "bed") return null;
  const type = s.bed?.type;
  if (type !== "bunk" && type !== "loft") return null;
  const loft = type === "loft";
  const twin = /twin|97 ?x ?191/i.test(`${s.variant} ${s.slug ?? ""}`);
  // IKEA's own sizes (the guide's row is a little off, see the report)
  const L = twin ? 1970 : 2070, W = twin ? 1030 : 970;
  const H = loft ? 1950 : 1620;
  return { loft, L, W, H, X: L / 2 - D / 2, Z: W / 2 - D / 2, lenX: L - 2 * D, lenZ: W - 2 * D, beds: loft ? [1510] : [230, 1140], mW: twin ? 970 : 900, mL: twin ? 1890 : 2000 };
}

interface Panel {
  id: string;
  bar: string;
  rod: string;
  fabric: string;
  posts: string[];
  yb: number; // bottom of its bar
  yr: number; // centre of its rod
  along: "x" | "z";
  at: number; // its x (end panels) or z (long panels)
  span: [number, number]; // along its length
  postAt: number[];
}

function recipe(g: Geo) {
  const { loft, L, W, H, X, Z, lenX, lenZ } = g;
  const parts: CustomPart[] = [];
  const put = (id: string, name: string, size: Vec3, pos: Vec3, o: Partial<CustomPart> = {}) => parts.push({ id, name, size, pos, material: "metal", ...o });
  const sx = [-1, 1] as const;
  const post = (x: number, z: number) => `P${x < 0 ? "h" : "f"}${z < 0 ? "b" : "f"}`;
  for (const x of sx) for (const z of sx) put(post(x, z), "Post", [D, H, D], [x * X, H / 2, z * Z], { shape: "cyl" });

  const yTopRod = H - 20;
  const upper = g.beds[g.beds.length - 1];
  // bed rails along the long sides, the slats roll out between them
  g.beds.forEach((y, bi) => {
    for (const z of sx) put(`R${bi}${z < 0 ? "b" : "f"}`, "Bed rail", [lenX, RAIL_H, RAIL_T], [0, y + RAIL_H / 2, z * Z]);
  });

  const panel = (id: string, along: "x" | "z", at: number, span: [number, number], yb: number, yr: number, nPosts: number, kind: "End" | "Long"): Panel => {
    const len = span[1] - span[0], mid = (span[0] + span[1]) / 2;
    const P = (u: number, y: number): Vec3 => (along === "x" ? [u, y, at] : [at, y, u]);
    const S = (l: number, h: number, t: number): Vec3 => (along === "x" ? [l, h, t] : [t, h, l]);
    const fy0 = yb + BAR_H, fy1 = yr - ROD / 2;
    const fh = fy1 - fy0;
    put(`${id}B`, `${kind} panel bar`, S(len, BAR_H, BAR_T), P(mid, yb + BAR_H / 2));
    put(`${id}F`, `${kind} panel fabric`, S(len - 2 * PP - 8, fh, 10), P(mid, fy0 + fh / 2), { material: "soft" });
    const postAt = Array.from({ length: nPosts }, (_, i) => (nPosts === 2 ? [span[0] + PP / 2 + 4, span[1] - PP / 2 - 4][i] : span[0] + PP / 2 + 4 + ((len - PP - 8) * i) / (nPosts - 1)));
    const posts = postAt.map((u, i) => {
      put(`${id}P${i}`, "Panel post", [PP, fh, PP], P(u, fy0 + fh / 2), { shape: "cyl" });
      return `${id}P${i}`;
    });
    put(`${id}R`, `${kind} panel rod`, S(len, ROD, ROD), P(mid, yr), { shape: "cyl" });
    return { id, bar: `${id}B`, rod: `${id}R`, fabric: `${id}F`, posts, yb, yr, along, at, span, postAt };
  };

  // the panels: ends first (two on the loft, three on the bunk), then the long ones
  const yUb = upper + RAIL_H; // a long upper panel sits on its bed rail
  const ends: Panel[] = [];
  const eUh = panel("Euh", "z", -X, [-lenZ / 2, lenZ / 2], yUb, yTopRod, 2, "End");
  const eUf = panel("Euf", "z", X, [-lenZ / 2, lenZ / 2], yUb, yTopRod, 2, "End");
  ends.push(eUh);
  let eLh: Panel | null = null;
  if (!loft) {
    eLh = panel("Elh", "z", -X, [-lenZ / 2, lenZ / 2], g.beds[0] + RAIL_H, 700, 2, "End");
    ends.push(eLh);
  }
  ends.push(eUf);

  // ladder on the right: its rail stands this far from the foot post, rungs between them
  const RUNG = 340;
  const xLR = X - D / 2 - RUNG - D / 2;
  const zLad = Z + RAIL_T / 2 + D / 2;
  const back = panel("Ub", "x", -Z, [-lenX / 2, lenX / 2], yUb, yTopRod, 3, "Long");
  const front = panel("Uf", "x", Z, [-lenX / 2, xLR - D / 2 - 6], yUb, yTopRod, 3, "Long");
  const longs: Panel[] = [back, front];
  let lowBack: Panel | null = null;
  if (!loft) lowBack = panel("Lb", "x", -Z, [-lenX / 2, lenX / 2], g.beds[0] + RAIL_H, 700, 3, "Long");

  // short post at the ladder end of the front panel, carrying the ladder's top
  const stubH = yTopRod + ROD / 2 - yUb;
  const rod = parts.find((p) => p.id === front.rod)!;
  const rodX0 = rod.pos[0] - rod.size[0] / 2, rodX1 = xLR + D / 2;
  rod.size = [rodX1 - rodX0, rod.size[1], rod.size[2]];
  rod.pos = [(rodX0 + rodX1) / 2, rod.pos[1], rod.pos[2]];
  put("ST", "Short post", [D, stubH, D], [xLR, yUb + stubH / 2, zLad], { shape: "cyl" });

  // the frame's own cross rails: the bunk's lower front flat bar and foot bar, the loft's ladder ends and long back rail
  const yLowBar = g.beds[0] + RAIL_H + BAR_H / 2;
  const cross: string[] = [];
  const crossYs = [700, 1050];
  if (!loft) {
    put("LFB", "Long flat bar", [lenX, BAR_H, BAR_T], [0, yLowBar, Z]);
    put("CFB", "End bar", [BAR_T, BAR_H, lenZ], [X, yLowBar, 0]);
  } else {
    for (const x of sx) crossYs.forEach((y, i) => {
      const id = `C${x < 0 ? "h" : "f"}${i}`;
      put(id, "End rail", [RAIL_T, RAIL_H, lenZ], [x * X, y, 0]);
      cross.push(id);
    });
    put("K", "Long back rail", [lenX, RAIL_H, RAIL_T], [0, crossYs[0] - 60, -Z]);
  }

  // ladder
  const LW = 400;
  if (!loft) {
    const y0 = g.beds[0], y1 = upper + RAIL_H;
    put("LR", "Ladder rail", [D, y1 - y0, D], [xLR, (y0 + y1) / 2, zLad], { shape: "cyl" });
    const rungYs = [y0 + (y1 - y0) / 3, y0 + (2 * (y1 - y0)) / 3];
    rungYs.forEach((y, i) => put(`LG${i}`, "Ladder step", [RUNG, 20, 40], [xLR + D / 2 + RUNG / 2, y, zLad]));
    put("LK", "Ladder bracket", [D + 20, 60, 10], [xLR, y1 + 30, zLad + D / 2 + 5]);
  } else {
    const rise = upper + RAIL_H, reach = 480;
    const len = Math.hypot(rise, reach), a = Math.atan2(reach, rise);
    const pieces: PartPiece[] = [
      ...sx.map((x): PartPiece => ({ shape: "box", size: [30, len, 50], pos: [(x * LW) / 2, 0, 0], material: "metal" })),
      ...[0, 1, 2, 3].map((k): PartPiece => ({ shape: "box", size: [LW, 20, 40], pos: [0, -len / 2 + (len * (k + 1)) / 5, 0], material: "metal" })),
    ];
    put("LD", "Ladder", [LW + 30, len, 50], [X - D / 2 - 40 - LW / 2, rise / 2, zLad + 10 + reach / 2], { pieces, rot: [-a, 0, 0] });
    put("LK", "Ladder bracket", [LW + 60, 60, 10], [X - D / 2 - 40 - LW / 2, rise - 30, Z + RAIL_T / 2 + 5]);
  }

  // roll-out slatted bases on the bed rails
  const baseW = 2 * Z - RAIL_T - 6, baseL = lenX - 10;
  const slats = 18;
  const basePieces: PartPiece[] = [
    ...Array.from({ length: slats }, (_, i): PartPiece => ({ shape: "box", size: [60, 10, baseW - 40], pos: [-baseL / 2 + 40 + ((baseL - 80) * i) / (slats - 1), 0, 0], material: "wood" })),
    ...sx.map((z): PartPiece => ({ shape: "box", size: [baseL, 6, 30], pos: [0, -8, (z * (baseW - 30)) / 2], material: "fiber" })),
  ];
  g.beds.forEach((y, bi) => {
    const yb = y + RAIL_H - 10;
    put(`SB${bi}`, "Slatted base", [baseL, 16, baseW], [0, yb - 5, 0], { material: "wood", pieces: basePieces });
    put(`M${bi}`, "Your mattress", [g.mL, 120, g.mW], [0, yb + 3 + 60, 0], { material: "soft", extra: true });
  });

  /* ---------- fittings ---------- */
  const fix = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string, mate: string | undefined, o: Partial<CustomFix>): CustomFix => ({ kind, count: at.length, at, dir, on, mate, ...o });
  const pp = (p: Panel, u: number, y: number): Vec3 => (p.along === "x" ? [u, y, p.at] : [p.at, y, u]);
  // a panel's own screws: up through the bar and down through the rod into each little post
  const panelScrews = (p: Panel): CustomFix[] => [
    fix("screw", p.postAt.map((u) => pp(p, u, p.yb)), [0, 1, 0], p.bar, p.posts[0], PANEL_SCREW),
    fix("screw", p.postAt.map((u) => pp(p, u, p.yr + ROD / 2)), [0, -1, 0], p.rod, p.posts[0], PANEL_SCREW),
  ];
  // flat-head bolts up through a bed rail into the bar of the panel on it
  const railBolts = (rail: string, bar: string, z: number, x0: number, x1: number, y: number, n = 6): CustomFix =>
    fix("bolt", Array.from({ length: n }, (_, i) => [x0 + 60 + ((x1 - x0 - 120) * i) / (n - 1), y, z] as Vec3), [0, 1, 0], rail, bar, FLAT_BOLT);
  // long frame bolts through a post into a long part's end
  const longEnd = (x: -1 | 1, z: -1 | 1, ys: number[], mate: string): CustomFix => fix("bolt", ys.map((y) => [x * (L / 2), y, z * Z] as Vec3), [-x, 0, 0], post(x, z), mate, FRAME_BOLT);
  // and into an end part's end, through the post from the front or back
  const endEnd = (x: -1 | 1, z: -1 | 1, ys: number[], mate: string): CustomFix => fix("bolt", ys.map((y) => [x * X, y, z * (W / 2)] as Vec3), [0, 0, -z], post(x, z), mate, FRAME_BOLT);
  const railYs = (bi: number) => [g.beds[bi] + 8, g.beds[bi] + RAIL_H - 8]; // far enough apart to tell two bolts apart
  const yBar = (p: Panel) => p.yb + BAR_H / 2;

  const steps: CustomStep[] = [];
  const panelParts = (ps: Panel[], k: "bar" | "posts" | "rod" | "fabric") => ps.flatMap((p) => (k === "posts" ? p.posts : [p[k]]));
  const nEnds = ends.length;

  // 1-4: the end panels, flat on the floor
  steps.push({
    title: nEnds > 2 ? "Slide a bar onto each of the three end panels" : "Slide a bar onto both end panels",
    detail: "The flat bar goes into the bottom hem, its holes facing down. Lay them on a rug.",
    add: [...panelParts(ends, "fabric"), ...panelParts(ends, "bar")],
    pose: "+x",
    warnings: ["floor"],
  });
  steps.push({ title: "Push the little posts into the side pockets", detail: "Down into the pockets until they sit in the bar.", add: panelParts(ends, "posts") });
  steps.push({ title: "Slide the rods into the top hems", detail: "The holes in each rod face down, onto the posts.", add: panelParts(ends, "rod") });
  steps.push({ title: "Screw the bars and rods to the posts", detail: "Four screws in each panel, one at each corner.", fix: ends.flatMap(panelScrews), tools: ["screwdriver"] });

  // 5-7: the ends
  if (!loft) {
    const hp = [post(-1, -1), post(-1, 1)];
    steps.push({
      title: "Bolt two posts to the head end panels",
      detail: "Lay the posts either side of the upper and lower panel, plain post ends at the top. Seven bolts for now: the eighth goes in next.",
      add: hp,
      fix: [
        endEnd(-1, -1, [yBar(eUh)], eUh.bar),
        endEnd(-1, -1, [eUh.yr], eUh.rod),
        endEnd(-1, 1, [yBar(eUh)], eUh.bar),
        endEnd(-1, -1, [yBar(eLh!)], eLh!.bar),
        endEnd(-1, -1, [eLh!.yr], eLh!.rod),
        endEnd(-1, 1, [yBar(eLh!)], eLh!.bar),
        endEnd(-1, 1, [eLh!.yr], eLh!.rod),
      ],
      tools: ["allen"],
    });
  } else {
    const hp = [post(-1, -1), post(-1, 1)];
    const hc = cross.filter((c) => c.startsWith("Ch"));
    steps.push({
      title: "Bolt the head end together",
      detail: "Two posts, the upper end panel and two end rails, flat on the rug. Ten bolts: the last hole at the top waits for the next step.",
      add: [...hp, ...hc],
      fix: [
        endEnd(-1, -1, [yBar(eUh)], eUh.bar),
        endEnd(-1, -1, [eUh.yr], eUh.rod),
        endEnd(-1, 1, [yBar(eUh)], eUh.bar),
        endEnd(-1, -1, [crossYs[0] - 12, crossYs[0] + 12], hc[0]),
        endEnd(-1, 1, [crossYs[0] - 12, crossYs[0] + 12], hc[0]),
        endEnd(-1, -1, [crossYs[1] - 12, crossYs[1] + 12], hc[1]),
        endEnd(-1, 1, [crossYs[1]], hc[1]),
      ],
      tools: ["allen"],
    });
  }
  steps.push({
    title: "Fit the top cap and the last bolt",
    detail: "Tap the cap into the post top with a hammer over a scrap of card, then turn the short bolt in under it. The key holder clips on here.",
    fix: [
      fix("cap", [[-X, H, Z]], [0, -1, 0], post(-1, 1), undefined, { len: 14, dia: D, name: "Top cap" }),
      fix("bolt", [[-X, eUh.yr, W / 2]], [0, 0, -1], post(-1, 1), eUh.rod, { len: 16, dia: 6, name: "Short bolt" }),
    ],
    tools: ["hammer", "allen"],
  });
  if (!loft) {
    steps.push({
      title: "Bolt the foot end bar between two posts",
      detail: "The post with the extra holes goes at the front, where the ladder will be. One bolt at each end of the bar.",
      add: [post(1, -1), post(1, 1), "CFB"],
      fix: sx.map((z) => endEnd(1, z, [yLowBar], "CFB")),
      tools: ["allen"],
      pose: "-x",
    });
  } else {
    const fc = cross.filter((c) => c.startsWith("Cf"));
    steps.push({
      title: "Bolt the foot end together",
      detail: "Two posts and two end rails, the post with the extra holes at the front. Seven bolts.",
      add: [post(1, -1), post(1, 1), ...fc],
      fix: [endEnd(1, -1, [crossYs[0] - 12, crossYs[0] + 12], fc[0]), endEnd(1, 1, [crossYs[0] - 12, crossYs[0] + 12], fc[0]), endEnd(1, -1, [crossYs[1]], fc[1]), endEnd(1, 1, [crossYs[1] - 12, crossYs[1] + 12], fc[1])],
      tools: ["allen"],
      pose: "-x",
    });
    steps.push({ title: "Tie two knots in the ladder strap", detail: "Knot it near each end, 43 cm apart.", pose: "+y" });
    steps.push({
      title: "Fix one end of the strap under the front foot post",
      detail: "Lay the strap end over the post's open bottom and tap the foot plug in over it.",
      fix: [fix("cap", [[X, 0, Z]], [0, 1, 0], post(1, 1), undefined, { len: 20, dia: D, name: "Foot plug" })],
      tools: ["hammer"],
    });
  }

  // the long panels, on the floor
  const backs = loft ? [back] : [lowBack!, back];
  const backRail = (p: Panel) => (p === back ? `R${g.beds.length - 1}b` : "R0b");
  steps.push({
    title: backs.length > 1 ? "Slide a long bar onto both back panels" : "Slide a long bar onto the back panel",
    detail: "Into the bottom hem, holes facing down.",
    add: [...panelParts(backs, "fabric"), ...panelParts(backs, "bar")],
    pose: "+z",
  });
  steps.push({ title: "Push three posts into the pockets", detail: "One at each end and one in the middle.", add: panelParts(backs, "posts") });
  steps.push({ title: "Slide in the top rods", detail: "Holes facing down onto the posts.", add: panelParts(backs, "rod") });
  steps.push({ title: "Screw the bars and rods to the posts", detail: "Six screws in each panel.", fix: backs.flatMap(panelScrews), tools: ["screwdriver"] });
  steps.push({
    title: backs.length > 1 ? "Bolt a bed rail under each back panel" : "Bolt a bed rail under the back panel",
    detail: "The rail's ledge faces into the bed. Six flat-head bolts up through it into the bar.",
    add: backs.map(backRail),
    fix: backs.map((p) => railBolts(backRail(p), p.bar, -Z, -lenX / 2, lenX / 2, p.yb - RAIL_H)),
    tools: ["allen"],
  });
  steps.push({ title: "Slide a bar onto the front panel", detail: "The shorter long panel. Bar into the bottom hem, holes down.", add: [front.fabric, front.bar], pose: "-z" });
  steps.push({ title: "Push its posts into the pockets", detail: "The numbers by the holes show which goes where.", add: front.posts });
  steps.push({ title: "Slide in its top rod", add: [front.rod] });
  steps.push({ title: "Screw it together", detail: "Six screws, up through the bar and down through the rod.", fix: panelScrews(front), tools: ["screwdriver"] });
  steps.push({
    title: "Screw the short post to the open end",
    detail: "It stands at the end of the panel where the ladder goes. One screw for now.",
    add: ["ST"],
    fix: [fix("screw", [[xLR, yUb + 40, zLad - D / 2]], [0, 0, 1], "ST", front.bar, { len: 16, dia: 4 })],
    tools: ["screwdriver"],
  });
  steps.push({ title: "Bolt it to the top rod", detail: "One long bolt from the front through the short post into the rod behind it.", fix: [fix("bolt", [[xLR, yTopRod, zLad + D / 2]], [0, 0, -1], "ST", front.rod, FRAME_BOLT)], tools: ["allen"] });
  const fr = `R${g.beds.length - 1}f`;
  steps.push({
    title: "Bolt the front bed rail under it",
    detail: "The rail runs the full length, past the open end. Six flat-head bolts.",
    add: [fr],
    fix: [railBolts(fr, front.bar, Z, front.span[0], front.span[1], front.yb - RAIL_H)],
    tools: ["allen"],
  });
  if (!loft) {
    steps.push({
      title: "Bolt the lower front rail to its flat bar",
      detail: "The bar sits on top of the rail. Six flat-head bolts up through the rail.",
      add: ["LFB", "R0f"],
      fix: [railBolts("R0f", "LFB", Z, -lenX / 2, lenX / 2, g.beds[0])],
      tools: ["allen"],
    });
  }

  // standing up
  if (!loft) {
    steps.push({
      title: "Stand the ends up and bolt the lower back panel between them",
      detail: "One of you holds the ends. Three bolts at each end: two in the bed rail, one in the top rod.",
      fix: sx.map((x) => longEnd(x, -1, [...railYs(0), lowBack!.yr], "R0b")),
      tools: ["allen"],
      pose: "+y",
      people: 2,
      warnings: ["two"],
    });
    steps.push({
      title: "Bolt in the upper front panel",
      detail: "Three bolts at the head end, two in the rail at the foot end.",
      fix: [longEnd(-1, 1, [...railYs(1), front.yr], fr), longEnd(1, 1, railYs(1), fr)],
      tools: ["allen"],
      people: 2,
    });
    steps.push({ title: "Bolt in the lower front rail", detail: "Two bolts at each end.", fix: sx.map((x) => longEnd(x, 1, railYs(0), "R0f")), tools: ["allen"] });
    steps.push({ title: "Bolt in the upper back panel", detail: "Three bolts at each end.", fix: sx.map((x) => longEnd(x, -1, [...railYs(1), back.yr], "R1b")), tools: ["allen"], people: 2 });
    steps.push({
      title: "Bolt the ladder steps to the ladder rail",
      detail: "One bolt through the rail into each step.",
      add: ["LR", "LG0", "LG1"],
      fix: [fix("bolt", [0, 1].map((i) => [xLR - D / 2, parts.find((p) => p.id === `LG${i}`)!.pos[1], zLad] as Vec3), [1, 0, 0], "LR", "LG0", FRAME_BOLT)],
      tools: ["allen"],
      from: { LR: [0, 0, 500], LG0: [0, 0, 500], LG1: [0, 0, 500] },
    });
    steps.push({
      title: "Bolt the ladder to the frame",
      detail: "The steps go into the holes in the front foot post. Two bolts through the post.",
      fix: [fix("bolt", [0, 1].map((i) => [L / 2, parts.find((p) => p.id === `LG${i}`)!.pos[1], zLad] as Vec3), [-1, 0, 0], post(1, 1), "LG0", FRAME_BOLT)],
      tools: ["allen"],
    });
    steps.push({
      title: "Screw the bracket over the ladder's top",
      detail: "It joins the ladder rail, the short post and the front rail. Four flat-head bolts.",
      add: ["LK"],
      fix: [fix("bolt", [-1, 1].flatMap((dy) => [-1, 1].map((dx) => [xLR + dx * 14, upper + RAIL_H + 30 + dy * 18, zLad + D / 2 + 10] as Vec3)), [0, 0, -1], "LK", "LR", FLAT_BOLT)],
      tools: ["allen"],
    });
    steps.push({ title: "Stick the grip strips on the ladder steps", detail: "Peel off the backing and press them along the top of each step." });
  } else {
    steps.push({
      title: "Stand the ends up and bolt in the long back rail",
      detail: "One of you holds the ends upright. Two bolts at each end.",
      add: ["K"],
      fix: sx.map((x) => longEnd(x, -1, [crossYs[0] - 72, crossYs[0] - 48], "K")),
      tools: ["allen"],
      pose: "+y",
      people: 2,
      warnings: ["two"],
    });
    steps.push({
      title: "Bolt in the upper front panel",
      detail: "Three bolts at the head end, two in the rail at the foot end.",
      fix: [longEnd(-1, 1, [...railYs(0), front.yr], fr), longEnd(1, 1, railYs(0), fr)],
      tools: ["allen"],
      people: 2,
    });
    steps.push({ title: "Bolt in the upper back panel", detail: "Three bolts at each end.", fix: sx.map((x) => longEnd(x, -1, [...railYs(0), back.yr], "R0b")), tools: ["allen"], people: 2 });
    const xl = X - D / 2 - 40 - LW / 2;
    steps.push({
      title: "Screw the ladder bracket to the front rail",
      detail: "Under the short post, two flat-head bolts.",
      add: ["LK"],
      fix: [fix("bolt", [-1, 1].map((dx) => [xl + dx * 60, upper + RAIL_H - 25, Z + RAIL_T / 2 + 10] as Vec3), [0, 0, -1], "LK", fr, FLAT_BOLT)],
      tools: ["allen"],
    });
    const rise = upper + RAIL_H;
    const a = Math.atan2(480, rise);
    const zAt = (y: number) => zLad + 10 + 480 - Math.tan(a) * y;
    steps.push({
      title: "Bolt the ladder together",
      detail: "Four steps between the two rails, one bolt at each end of each step. Lay it on the floor to do it.",
      add: ["LD"],
      fix: sx.map((sd) =>
        fix("bolt", [1, 2, 3, 4].map((k) => { const y = (rise * k) / 5; return [xl + sd * (LW / 2 + 15), y, zAt(y)] as Vec3; }), [-sd, 0, 0], "LD", undefined, FRAME_BOLT),
      ),
      from: { LD: [0, 0, 600] },
      tools: ["allen"],
    });
    steps.push({
      title: "Cap the ladder feet and fix the strap",
      detail: "A domed cap on each foot. The free end of the strap goes under one of them, so the ladder can't slide away.",
      fix: [fix("cap", sx.map((s) => [xl + s * (LW / 2), 0, zLad + 10 + 480] as Vec3), [0, 1, 0], "LD", undefined, { len: 20, dia: 30, name: "Ladder foot cap" })],
      tools: ["hammer"],
    });
    steps.push({
      title: "Bolt the ladder's top to the front rail",
      detail: "Two flat-head bolts at each ladder rail.",
      fix: [fix("bolt", sx.flatMap((s) => [-1, 1].map((dy) => [xl + s * (LW / 2), rise - 40 + dy * 12, Z + RAIL_T / 2 + 12] as Vec3)), [0, 0, -1], "LD", "LK", FLAT_BOLT)],
      tools: ["allen"],
    });
    steps.push({
      title: "Bolt the bracket ends to the front rail",
      detail: "Its ends reach past the ladder's rails: two flat-head bolts on each side, through the bracket into the front rail.",
      fix: [fix("bolt", sx.flatMap((s) => [-1, 1].map((dy) => [xl + s * (LW / 2 + 24), rise - 25 + dy * 12, Z + RAIL_T / 2 + 10] as Vec3)), [0, 0, -1], "LK", fr, FLAT_BOLT)],
      tools: ["allen"],
    });
    steps.push({ title: "Stick the grip strips on the ladder steps", detail: "Four strips, one along the top of each step." });
  }

  // the bases, the last end panel and the bolts that hold them
  const base = (bi: number, two: boolean): CustomStep => ({
    title: g.beds.length > 1 ? (bi ? "Roll out the upper slatted base" : "Roll out the lower slatted base") : "Roll out the slatted base",
    detail: "Curved side of the slats up. Hook the first slat's end in at the head and unroll it along the ledges.",
    add: [`SB${bi}`],
    from: { [`SB${bi}`]: [-1500, 200, 0] },
    people: two ? 2 : 1,
    warnings: two ? ["two"] : [],
  });
  const baseBolts = (bi: number): CustomFix[] => {
    const yb = g.beds[bi] + RAIL_H - 10;
    const pts = sx.flatMap((z) => [-0.45, -0.15, 0.15, 0.45].map((t) => [t * baseL, yb + 3, z * (Z - RAIL_T / 2 - 12)] as Vec3));
    return [
      fix("bolt", pts, [0, -1, 0], `SB${bi}`, `R${bi}b`, FLAT_BOLT),
      fix("nut", pts.map((p) => [p[0], g.beds[bi], p[2]] as Vec3), [0, 1, 0], `R${bi}b`, undefined, { len: 12, dia: 10, name: "Barrel nut" }),
    ];
  };
  const ub = g.beds.length - 1;
  steps.push(base(ub, true));
  steps.push({
    title: "Slide the foot end panel in and bolt it",
    detail: "Push it in between the foot posts from outside, then two bolts at each end.",
    fix: sx.map((z) => endEnd(1, z, [yBar(eUf), eUf.yr], eUf.rod)),
    tools: ["allen"],
  });
  if (!loft) {
    steps.push({
      title: "Screw the stop into the foot post",
      detail: "The slotted stop goes in by the ladder, so nobody catches the edge.",
      fix: [fix("screw", [[X, upper + RAIL_H + 60, W / 2]], [0, 0, -1], post(1, 1), undefined, { len: 10, dia: 8, name: "Slotted stop" })],
      tools: ["flathead"],
    });
  }
  steps.push({ title: "Bolt the slatted base down", detail: "Eight flat-head bolts down through the end slats into barrel nuts under the rails.", fix: baseBolts(ub), tools: ["allen"] });
  if (!loft) {
    steps.push(base(0, false));
    steps.push({ title: "Bolt the lower base down", detail: "Eight flat-head bolts and barrel nuts, the same way.", fix: baseBolts(0), tools: ["allen"] });
  }
  steps.push({
    title: "Push in the pin by the ladder",
    detail: "Through the short post and the bracket, then screw it tight.",
    fix: [fix("pin", [[xLR, yUb + 20, zLad + D / 2]], [0, 0, -1], "ST", undefined, { len: 30, dia: 6, name: "Pin bolt" })],
    tools: ["screwdriver"],
  });
  if (loft) {
    steps.push({
      title: "Screw the stops into the post tops",
      detail: "Four slotted stops, one in the inside face of each post just above the panels.",
      fix: sx.map((x) => fix("screw", sx.map((z) => [x * (L / 2), H - 60, z * Z] as Vec3), [-x, 0, 0], post(x, -1), undefined, { len: 10, dia: 8, name: "Slotted stop" })),
      tools: ["flathead"],
    });
  }
  steps.push({ title: "Tighten every bolt", detail: "Go round the whole frame once it stands square, then again after a few weeks.", tools: ["allen"], check: "square" });
  if (loft) {
    const wall = sx.map((x) => [x * X, upper - 100, -W / 2] as Vec3);
    steps.push({
      title: "Strap it to the wall",
      detail: "One strap from each back post to the wall. Wall screws aren't included: pick ones made for your wall.",
      fix: [
        { kind: "strap", count: 2, at: wall, dir: [0, 0, -1], on: post(-1, -1) },
        { kind: "plug", count: 2, len: 35, dia: 8, at: wall.map((p) => [p[0], p[1], p[2] - 40] as Vec3), dir: [0, 0, -1] },
        { kind: "screw", count: 2, len: 50, dia: 5, name: "Wall screw", at: wall.map((p) => [p[0], p[1], p[2] - 36] as Vec3), dir: [0, 0, -1] },
      ],
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    });
  }
  steps.push({
    title: loft ? "Lay in your mattress and stick on the labels" : "Lay in your mattresses and stick on the labels",
    detail: "No thicker than 13 cm, so the panels stay high enough. The labels go inside the upper bed.",
    add: g.beds.map((_, bi) => `M${bi}`),
  });

  for (const st of steps) for (const f of st.fix ?? []) f.count = f.at?.length ?? f.count;
  return { parts, steps };
}

/**
 * The underbed, from its own manual: a white steel tube frame on castors. The long back rail is bent round at both
 * ends; the end rails slide into those ends and are clamped with long bolts and nuts, the front rail with its low
 * guard slides onto their other ends and is bolted from the sides, then 13 slats click in on their holders.
 * `dz` moves the whole bed forward (the bunk set shows it half pulled out).
 */
function underbed(dz: number) {
  const L = 1970, W = 900, T = 25, TH = 30; // tube 25 wide, 30 tall
  const X = L / 2 - T / 2, Zr = W / 2 - T / 2;
  const yR = 65; // rail centre, on 50 mm castors
  const parts: CustomPart[] = [];
  const put = (id: string, name: string, size: Vec3, pos: Vec3, o: Partial<CustomPart> = {}) => parts.push({ id, name, size, pos: [pos[0], pos[1], pos[2] + dz], material: "metal", ...o });
  const sx = [-1, 1] as const;
  const wheel = (x: number, y: number, z: number): PartPiece => ({ shape: "cyl", size: [50, 20, 50], pos: [x, y, z], rot: [0, 0, Math.PI / 2], material: "metal" });
  const RET = 200; // the bent ends of the back rail
  const FRET = 150; // the front rail's ends
  // back frame: long rail and its two bent ends, castors under the corners
  put("UBF", "Back frame", [L, 80, RET], [0, 40, -W / 2 + RET / 2], {
    pieces: [
      { shape: "box", size: [L - 2 * T, TH, T], pos: [0, yR - 40, -RET / 2 + T / 2] },
      ...sx.map((x): PartPiece => ({ shape: "box", size: [T, TH, RET], pos: [x * X, yR - 40, 0] })),
      ...sx.map((x) => wheel(x * (X - 40), -15, -RET / 2 + 60)),
    ],
  });
  // end rails: their back ends sit inside the bent ends, their front ends inside the front rail's ends
  const z0 = -W / 2 + RET / 2, z1 = W / 2 - FRET / 3;
  for (const x of sx) put(`UBE${x < 0 ? "l" : "r"}`, "End rail", [20, 20, z1 - z0], [x * X, yR, (z0 + z1) / 2]);
  // front rail with its guard: a low rail, a tube along the top, posts at the ends and in the middle
  const yG = 190;
  put("UBR", "Front rail", [L, 200, FRET], [0, 100, W / 2 - FRET / 2], {
    // the guard stands just in front of the rail, so it rises in front of the mattress
    pieces: [
      { shape: "box", size: [L - 2 * T, TH, T], pos: [0, yR - 100, FRET / 2 - T / 2] },
      ...sx.map((x): PartPiece => ({ shape: "box", size: [T, TH, FRET], pos: [x * X, yR - 100, 0] })),
      ...sx.map((x) => wheel(x * (X - 40), -75, FRET / 2 - 60)),
      { shape: "cyl", size: [20, L - 140, 20], pos: [0, yG - 100, FRET / 2 + 10], rot: [0, 0, Math.PI / 2] },
      ...[-1, 0, 1].map((k): PartPiece => ({ shape: "cyl", size: [20, yG - yR - TH / 2 + 10, 20], pos: [k * (L / 2 - 70), (yG + yR + TH / 2) / 2 - 100 - 5, FRET / 2 + 10] })),
    ],
  });
  // stop loop behind the back rail, it catches on the bed above so the underbed can't come right out
  put("UBS", "Stop loop", [260, 80, 12], [0, yR + 25, -W / 2 - 6], {
    pieces: [
      { shape: "cyl", size: [12, 260, 12], pos: [0, 34, 0], rot: [0, 0, Math.PI / 2] },
      ...sx.map((x): PartPiece => ({ shape: "cyl", size: [12, 80, 12], pos: [x * 124, 0, 0] })),
    ],
  });
  // slats across, from the back rail to the front rail
  const yS = yR + TH / 2 + 5;
  const slatL = 2 * Zr + 10;
  const n = 13;
  const xs = Array.from({ length: n }, (_, i) => -L / 2 + 90 + ((L - 180) * i) / (n - 1));
  xs.forEach((x, i) => put(`UBL${i}`, "Slat", [60, 10, slatL], [x, yS, 0], { material: "wood" }));
  put("UBM", "Your mattress", [2000, 120, 900], [0, yS + 5 + 60, 0], { material: "soft", extra: true });

  const P = (x: number, y: number, z: number): Vec3 => [x, y, z + dz];
  const steps: CustomStep[] = [
    {
      title: "Push the two bumpers into the back frame",
      detail: "Into the holes under the long rail, one either side of the middle. Lay the frame on a rug.",
      add: ["UBF"],
      fix: [{ kind: "glide", count: 2, name: "Bumper", len: 20, dia: 20, at: sx.map((x) => P(x * 450, yR - TH / 2, -Zr)), dir: [0, 1, 0], on: "UBF" }],
      pose: "+y",
      warnings: ["floor"],
    },
    {
      title: "Bolt the stop loop to the back of the rail",
      detail: "Its ends sit against the back of the long rail, the loop standing up. Two bolts.",
      add: ["UBS"],
      fix: [{ kind: "bolt", count: 2, len: 16, dia: 6, at: sx.map((x) => P(x * 124, yR, -W / 2 - 12)), dir: [0, 0, 1], on: "UBS", mate: "UBF" }],
      from: { UBS: [0, 0, -300] },
      tools: ["allen"],
    },
    {
      title: "Slide the end rails into the bent ends",
      detail: "Push each one in until its holes line up with the holes on top.",
      add: ["UBEl", "UBEr"],
      from: { UBEl: [0, 0, 400], UBEr: [0, 0, 400] },
    },
    {
      title: "Clamp each joint with two long bolts",
      detail: "Down through the holes, a nut underneath. Hold the nut with the spanner and tighten with the Allen key.",
      fix: [
        { kind: "bolt", count: 4, len: 60, dia: 6, at: sx.flatMap((x) => [-1, 1].map((k) => P(x * X, yR + TH / 2, z0 + k * 40))), dir: [0, -1, 0], on: "UBF", mate: "UBEl" },
        { kind: "nut", count: 4, len: 6, dia: 10, at: sx.flatMap((x) => [-1, 1].map((k) => P(x * X, yR - TH / 2, z0 + k * 40))), dir: [0, 1, 0], on: "UBF" },
      ],
      tools: ["allen", "wrench"],
    },
    {
      title: "Slide the front rail onto the end rails",
      detail: "The guard faces up and out. Push it on until it meets the frame.",
      add: ["UBR"],
      from: { UBR: [0, 0, 400] },
    },
    {
      title: "Bolt the front rail from the sides",
      detail: "Two bolts through each end of the front rail into the end rail inside.",
      fix: sx.map((x): CustomFix => ({ kind: "bolt", count: 2, len: 16, dia: 6, at: [-1, 1].map((k) => P(x * (L / 2), yR, W / 2 - FRET / 2 + k * 30)), dir: [-x, 0, 0], on: "UBR", mate: x < 0 ? "UBEl" : "UBEr" })),
      tools: ["allen"],
    },
    {
      title: "Click the slats into the rails",
      detail: "A holder on each end of every slat, curved side up. Press each holder into its hole until it clicks.",
      add: xs.map((_, i) => `UBL${i}`),
      fix: [
        { kind: "clip", count: 2 * n, name: "Slat holder", len: 20, dia: 12, at: xs.flatMap((x) => [-1, 1].map((k) => P(x, yS, k * (slatL / 2 - 15)))), dir: [0, -1, 0], on: "UBL0", mate: "UBF" },
      ],
    },
    { title: "Lay in your mattress", detail: "No thicker than 13 cm, so it still slides under the bed.", add: ["UBM"] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["VITVAL"],
  recipe(s) {
    if (/^underbed/i.test(s.variant) || s.slug === "vitval-underbed-90-x-200") return underbed(0);
    const g = geoOf(s);
    if (!g) return null;
    const r = recipe(g);
    if (!g.loft && /underbed/i.test(`${s.variant} ${s.slug ?? ""}`)) {
      // the set: the bunk bed's manual, then the underbed's, shown half pulled out in front
      const u = underbed(650);
      u.steps[0] = { ...u.steps[0], title: "Now the underbed: push the two bumpers into its back frame" };
      return { parts: [...r.parts, ...u.parts], steps: [...r.steps, ...u.steps] };
    }
    return r;
  },
};
export default family;

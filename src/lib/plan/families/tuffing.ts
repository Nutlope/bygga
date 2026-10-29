import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * TUFFING, read from its bunk and loft manuals. A dark grey steel tube frame dressed in mesh fabric. Every joint is a
 * threaded rod in a barrel nut, done up through the post. The ends are built lying on the floor (the bunk's low end
 * panels slide over the posts first; the loft's ends are ladders of two cross rails), then stood up and joined by
 * rails. The upper guard is one long piece of fabric: the back rail, its middle post and top rail go into its hems on
 * the floor, it's lifted over the post tops, then the top rails, the front rail and the two curved rails go in. Each
 * bed is seven slats in a fabric base, hooked on and screwed down. The loft is strapped to the wall.
 */

const D = 30; // post, dia
const R = D / 2;
const RT = 20; // flat side rail, thick
const RH = 50; // and high
const TD = 25; // top rails and curved rails, dia
const OPEN = 440; // ladder opening in the front guard

const ROD: Partial<CustomFix> = { len: 50, dia: 6, name: "Threaded rod" };
const BARREL: Partial<CustomFix> = { len: 40, dia: 10, name: "Barrel nut" };

const along = (axis: "x" | "z", len: number, dia: number, pos: Vec3): PartPiece => ({
  shape: "cyl",
  size: [dia, len, dia],
  pos,
  rot: axis === "x" ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0],
  material: "metal",
});

interface Geo {
  loft: boolean;
  L: number;
  W: number;
  H: number;
  X: number; // post centres
  Z: number;
  y0: number; // bottom of the lower rails (bunk) or of the upper rails' bed (loft) ...
  yU: number; // bottom of the upper side rails
  mW: number;
  mL: number;
}

function geoOf(s: ProductSpec): Geo | null {
  if (s.archetype !== "bed") return null;
  const type = s.bed?.type;
  if (type !== "bunk" && type !== "loft") return null;
  const loft = type === "loft";
  const twin = /twin|97 ?x ?191/i.test(`${s.variant} ${s.slug ?? ""}`);
  // IKEA's own sizes: the guide's row is a little off (see the report)
  const L = twin ? 1970 : loft ? 2080 : 2070;
  const W = twin ? 1030 : loft ? 970 : 965;
  const H = loft ? 1790 : 1305;
  const mW = twin ? 970 : 900, mL = twin ? 1890 : 2000;
  return { loft, L, W, H, X: L / 2 - R, Z: W / 2 - R, y0: 145, yU: loft ? 1450 : 985, mW, mL };
}

function recipe(s: ProductSpec, g: Geo) {
  const { loft, L, W, H, X, Z, yU } = g;
  const parts: CustomPart[] = [];
  const put = (id: string, name: string, size: Vec3, pos: Vec3, o: Partial<CustomPart> = {}) => parts.push({ id, name, size, pos, material: "metal", ...o });
  const sx = [-1, 1] as const; // head end at -x, foot end at +x
  const lenX = L - 2 * D, lenZ = W - 2 * D;

  // posts: head back, head front, foot back, foot front
  const post = (x: number, z: number) => `P${x < 0 ? "h" : "f"}${z < 0 ? "b" : "f"}`;
  for (const x of sx) for (const z of sx) put(post(x, z), "Post", [D, H, D], [x * X, H / 2, z * Z], { shape: "cyl" });

  // bunk: a low mesh panel at each end of the lower bed, on a flat bar with a rod in its top hem
  const ph = 330;
  const yp = g.y0 + ph / 2;
  if (!loft) {
    const pieces: PartPiece[] = [
      { shape: "box", size: [4, ph - 30, lenZ], pos: [0, 5, 0], material: "soft" },
      { shape: "box", size: [10, 40, lenZ], pos: [0, -ph / 2 + 20, 0], material: "metal" },
      along("z", lenZ, 12, [0, ph / 2 - 6, 0]),
    ];
    for (const x of sx) put(`E${x < 0 ? "h" : "f"}`, "End panel", [12, ph, lenZ], [x * X, yp, 0], { material: "soft", pieces });
  }

  // lower frame: the bunk's lower bed rails, or the loft's ladder ends and long back rails
  const yLow = g.y0 + RH / 2;
  const endBarYs = [500, 800];
  const backYs = [700, 1100];
  if (!loft) {
    for (const z of sx) put(`L${z < 0 ? "b" : "f"}`, "Lower side rail", [lenX, RH, RT], [0, yLow, z * Z], { label: z > 0 ? "1" : "2" });
  } else {
    for (const x of sx) endBarYs.forEach((y, i) => put(`C${x < 0 ? "h" : "f"}${i}`, "End rail", [RT, RH, lenZ], [x * X, y, 0]));
    backYs.forEach((y, i) => put(`K${i}`, "Long back rail", [lenX, RH, RT], [0, y, -Z]));
  }

  // upper bed: back and front side rails, the guard, its top rails
  const yUc = yU + RH / 2;
  put("U4", "Upper back rail", [lenX, RH, RT], [0, yUc, -Z], { label: "4" });
  put("U3", "Upper front rail", [lenX, RH, RT], [0, yUc, Z], { label: "3" });
  const gy0 = yU + RH, gy1 = H - TD;
  const gh = gy1 - gy0, gyc = (gy0 + gy1) / 2;
  const frontLen = (lenX - OPEN) / 2;
  const fx = OPEN / 2 + frontLen / 2;
  const guardPieces: PartPiece[] = [
    { shape: "box", size: [lenX, gh, 4], pos: [0, 0, -Z], material: "soft" },
    { shape: "box", size: [4, gh, lenZ], pos: [-X, 0, 0], material: "soft" },
    { shape: "box", size: [4, gh, lenZ], pos: [X, 0, 0], material: "soft" },
    { shape: "box", size: [frontLen, gh, 4], pos: [-fx, 0, Z], material: "soft" },
    { shape: "box", size: [frontLen, gh, 4], pos: [fx, 0, Z], material: "soft" },
  ];
  put("G", "Guard fabric", [L - D, gh, W - D], [0, gyc, 0], { material: "soft", pieces: guardPieces });
  put("ST", "Middle post", [TD, gh, TD], [0, gyc, -Z], { shape: "cyl" });
  const yTop = H - TD / 2;
  put("TB", "Back top rail", [lenX, TD, TD], [0, yTop, -Z], { shape: "cyl" });
  for (const x of sx) put(`T${x < 0 ? "h" : "f"}`, "End top rail", [TD, TD, lenZ], [x * X, yTop, 0], { shape: "cyl" });
  // the curved rails: along the top of a front panel, round a bend and down to the front rail
  const bend = 60;
  const run = frontLen - bend, drop = gh + TD / 2 - bend;
  const curved = (side: -1 | 1): CustomPart => {
    // in the part's own frame: x from the post (outer end) to the opening (inner end)
    const w = frontLen, h = gh + TD;
    const xo = -side * (w / 2), xi = side * (w / 2 - TD / 2);
    const ytop = h / 2 - TD / 2;
    const diag = Math.hypot(bend, bend);
    const pieces: PartPiece[] = [
      along("x", run, TD, [(xo + (xi - side * bend)) / 2, ytop, 0]),
      { shape: "cyl", size: [TD, diag, TD], pos: [xi - (side * bend) / 2, ytop - bend / 2, 0], rot: [0, 0, side * (Math.PI / 4)], material: "metal" },
      { shape: "cyl", size: [TD, drop, TD], pos: [xi, -h / 2 + drop / 2, 0], material: "metal" },
    ];
    return { id: `B${side < 0 ? "h" : "f"}`, name: "Curved rail", size: [w, h, TD], pos: [side * fx, yU + RH + h / 2, Z], material: "metal", pieces };
  };
  parts.push(curved(-1), curved(1));

  // ladder: straight up the front of the bunk, leaning against the loft
  const LW = 400;
  const zL = Z + RT / 2 + TD / 2;
  if (!loft) {
    const y1 = yU + RH + 25, lh = y1 - g.y0;
    const pieces: PartPiece[] = [
      ...sx.map((x): PartPiece => ({ shape: "cyl", size: [TD, lh, TD], pos: [(x * LW) / 2, 0, 0], material: "metal" })),
      ...[1, 2].map((k): PartPiece => along("x", LW, 22, [0, -lh / 2 + ((yU - g.y0) * k) / 3, 0])),
      ...sx.map((x): PartPiece => ({ shape: "box", size: [40, 30, RT + TD + 10], pos: [(x * LW) / 2, lh / 2 - 15, -(RT + TD) / 2 + 5], material: "metal" })),
    ];
    put("LD", "Ladder", [LW + TD, lh, TD], [0, g.y0 + lh / 2, zL], { pieces });
  } else {
    const rise = yU + RH, reach = 460;
    const len = Math.hypot(rise, reach), a = Math.atan2(reach, rise);
    const rungs = 4;
    const pieces: PartPiece[] = [
      ...sx.map((x): PartPiece => ({ shape: "cyl", size: [TD, len, TD], pos: [(x * LW) / 2, 0, 0], material: "metal" })),
      ...Array.from({ length: rungs }, (_, k): PartPiece => along("x", LW, 22, [0, -len / 2 + (len * (k + 1)) / (rungs + 1), 0])),
    ];
    put("LD", "Ladder", [LW + TD, len, TD], [0, rise / 2, zL + reach / 2], { pieces, rot: [-a, 0, 0] });
  }

  // beds: seven slats in a fabric base with a rod in each long edge
  const beds = loft ? [yU] : [g.y0, yU];
  const slatL = 2 * Z - RT, slatT = 15;
  const slatX = (i: number) => -lenX / 2 + 90 + ((lenX - 180) * i) / 6;
  beds.forEach((yr, bi) => {
    const top = yr + RH - 8;
    for (let i = 0; i < 7; i++) put(`S${bi}${i}`, "Slat", [40, slatT, slatL], [slatX(i), top - slatT / 2, 0]);
    put(`F${bi}`, "Bed base fabric", [lenX - 20, 3, slatL - 30], [0, top + 1.5, 0], { material: "soft" });
    for (const z of sx) put(`R${bi}${z < 0 ? "b" : "f"}`, "Edge rod", [lenX - 40, 10, 10], [0, top + 6, z * (slatL / 2 - 12)], { shape: "cyl" });
    put(`M${bi}`, "Your mattress", [g.mL, 110, g.mW], [0, top + 3 + 55, 0], { material: "soft", extra: true });
  });

  /* ---------- fittings ---------- */
  const pairs = (fixes: { at: Vec3; dir: Vec3; on: string; mate?: string }[]): CustomFix[] => {
    const rod: CustomFix = { kind: "bolt", count: fixes.length, at: fixes.map((f) => f.at), dir: fixes[0].dir, on: fixes[0].on, mate: fixes[0].mate, ...ROD };
    const nut: CustomFix = { kind: "nut", count: fixes.length, at: fixes.map((f) => f.at), dir: fixes[0].dir, on: fixes[0].on, ...BARREL };
    return [rod, nut];
  };
  // two rods through the post into the end of a long rail
  const railEnd = (x: -1 | 1, z: number, yc: number, rail: string): CustomFix[] =>
    pairs([-12, 12].map((dy) => ({ at: [x * (L / 2), yc + dy, z * Z] as Vec3, dir: [-x, 0, 0] as Vec3, on: post(x, z), mate: rail })));
  // the same at an end rail, through the post from the side
  const endRailEnd = (x: -1 | 1, z: -1 | 1, yc: number, rail: string, n = 2): CustomFix[] =>
    pairs((n === 2 ? [-12, 12] : [0]).map((dy) => ({ at: [x * X, yc + dy, z * (W / 2)] as Vec3, dir: [0, 0, -z] as Vec3, on: post(x, z), mate: rail })));
  const caps = (x: -1 | 1): CustomFix => ({ kind: "cap", count: 2, name: "Foot plug", len: 20, dia: D, at: sx.map((z) => [x * X, 0, z * Z] as Vec3), dir: [0, 1, 0], on: post(x, -1) });
  // the top rails: one rod along the rail and one across, through each post top
  const postTop = (x: -1 | 1, z: -1 | 1, mate: string): CustomFix[] => [
    // the two rods cross in the post, one a little above the other
    ...pairs([{ at: [x * (L / 2), yTop + 11.5, z * Z], dir: [-x, 0, 0], on: post(x, z), mate: z < 0 ? "TB" : `T${x < 0 ? "h" : "f"}` }]),
    ...pairs([{ at: [x * X, yTop - 11.5, z * (W / 2)], dir: [0, 0, -z], on: post(x, z), mate }]),
  ];
  const cs = (at: Vec3[], on: string, mate: string): CustomFix => ({ kind: "bolt", count: at.length, len: 50, dia: 6, name: "Countersunk bolt", at, dir: [0, 1, 0], on, mate });
  const xLeg = (side: -1 | 1) => side * (OPEN / 2 + TD / 2);

  const steps: CustomStep[] = [];
  const endName = (x: -1 | 1) => (x < 0 ? "head" : "foot");

  if (!loft) {
    for (const x of sx) {
      const e = `E${x < 0 ? "h" : "f"}`;
      const ids = sx.map((z) => post(x, z));
      if (x < 0) {
        steps.push({
          title: "Slide the bar and rod into an end panel",
          detail: "The flat bar goes into the bottom hem and the thin rod into the top one. Work on a rug.",
          add: [e],
          pose: "+x",
          warnings: ["floor"],
        });
        steps.push({ title: "Push two posts through its side sleeves", detail: "Match the numbers by the holes: the panel sits at the bottom ends of the posts.", add: ids });
        steps.push({
          title: "Bolt the bar to the posts",
          detail: "Screw each threaded rod halfway into a barrel nut by hand, then turn it in through the post. Not tight yet.",
          fix: sx.flatMap((z) => endRailEnd(x, z, g.y0 + 20, e, 1)),
          tools: ["allen"],
        });
        steps.push({ title: "Push the foot plugs into the posts", detail: "Into the bottom ends, the ones next to the panel.", fix: [caps(x)] });
      } else {
        steps.push({
          title: "Build the other end the same way",
          detail: "Bar and rod into the panel, two posts through it, two rods and barrel nuts, then the foot plugs.",
          add: [e, ...ids],
          fix: [...sx.flatMap((z) => endRailEnd(x, z, g.y0 + 20, e, 1)), caps(x)],
          tools: ["allen"],
          pose: "-x",
        });
      }
    }
    steps.push({
      title: "Bolt the lower side rails to the head end",
      detail: "Stand the end up, panels facing in. One holds it while the other turns in two rods at each rail. Rail 1 goes at the front.",
      add: ["Lf", "Lb"],
      fix: sx.flatMap((z) => railEnd(-1, z, yLow, `L${z < 0 ? "b" : "f"}`)),
      tools: ["allen"],
      pose: "+y",
      people: 2,
      warnings: ["two"],
    });
    steps.push({
      title: "Bolt the foot end onto the rails",
      detail: "Stand it up against the free rail ends and turn in two rods at each.",
      fix: sx.flatMap((z) => railEnd(1, z, yLow, `L${z < 0 ? "b" : "f"}`)),
      tools: ["allen"],
      people: 2,
    });
  } else {
    for (const x of sx) {
      const rails = endBarYs.map((_, i) => `C${x < 0 ? "h" : "f"}${i}`);
      const ids = sx.map((z) => post(x, z));
      const bolts = rails.flatMap((r, i) => sx.flatMap((z) => endRailEnd(x, z, endBarYs[i], r)));
      if (x < 0) {
        steps.push({
          title: "Lay out a head end on the floor",
          detail: "Two posts with two short rails between them. Check the numbered holes face the way the drawing shows.",
          add: [...ids, ...rails],
          pose: "+x",
          warnings: ["floor"],
        });
        steps.push({ title: "Bolt the rails to the posts", detail: "Two threaded rods in barrel nuts at each joint, through the post. Not tight yet.", fix: bolts, tools: ["allen"] });
        steps.push({ title: "Push the foot plugs into the posts", detail: "Into the bottom ends, nearest the lower rail.", fix: [caps(x)] });
      } else {
        steps.push({
          title: "Build the foot end the same way",
          detail: "Two posts, two short rails, two rods at each joint, then the foot plugs.",
          add: [...ids, ...rails],
          fix: [...bolts, caps(x)],
          tools: ["allen"],
          pose: "-x",
        });
      }
    }
    backYs.forEach((y, i) => {
      steps.push({
        title: i ? "Bolt on the upper long back rail" : "Stand the ends up and bolt on a long back rail",
        detail: i ? "The same way, two rods at each end." : "One of you holds both ends upright. Two rods at each end of the rail, through the back posts.",
        add: [`K${i}`],
        fix: sx.flatMap((x) => railEnd(x, -1, y, `K${i}`)),
        tools: ["allen"],
        pose: "+y",
        people: 2,
        warnings: i ? [] : ["two"],
      });
    });
  }

  // the guard, on the floor
  steps.push({
    title: "Slide the upper back rail into the guard",
    detail: "Lay the guard fabric out flat. Rail 4 goes along its bottom hem at the back, holes facing out.",
    add: ["G", "U4"],
    from: { G: [0, 700, 0], U4: [-1600, 0, 0] },
  });
  steps.push({
    title: "Push in the middle post and bolt it from below",
    detail: "It goes up the sleeve in the middle of the back. One countersunk bolt through the rail into its end.",
    add: ["ST"],
    fix: [cs([[0, yU, -Z]], "U4", "ST")],
    tools: ["allen"],
  });
  steps.push({ title: "Slide the back top rail into the top hem", detail: "The two holes in its middle face down, onto the middle post.", add: ["TB"], from: { TB: [-1600, 0, 0] } });
  steps.push({
    title: "Bolt the top rail to the middle post",
    detail: "Use the short bolt with the thick head, not a threaded rod.",
    fix: [{ kind: "bolt", count: 1, len: 30, dia: 6, name: "Sleeve bolt", at: [[0, H, -Z]], dir: [0, -1, 0], on: "TB", mate: "ST" }],
    tools: ["allen"],
  });
  steps.push({
    title: "Lift the guard over the post tops together",
    detail: "The back of the guard goes to the back posts and the label to the head end. Let the rest hang loose for now.",
    people: 2,
    warnings: ["two"],
  });
  steps.push({
    title: "Bolt the back rails to the back posts",
    detail: "Two rods at each end of the top rail and two at each end of the back rail. Hand tight.",
    fix: [...sx.flatMap((x) => railEnd(x, -1, yUc, "U4")), ...sx.flatMap((x) => pairs([-1, 1].map((d) => ({ at: [x * (L / 2), yTop + d * 11.5, -Z] as Vec3, dir: [-x, 0, 0] as Vec3, on: post(x, -1), mate: "TB" }))))],
    tools: ["allen"],
  });
  for (const x of [1, -1] as const) {
    const t = `T${x < 0 ? "h" : "f"}`;
    steps.push({
      title: `Push the ${endName(x)} top rail into the post tops`,
      detail: x > 0 ? "Pull the guard round the foot end first, then thread the rail along its top hem." : "Pull the guard round the head end and thread the rail along its top hem.",
      add: [t],
      from: { [t]: [0, 0, 600] },
    });
    steps.push({ title: "Bolt it at the front post", detail: "Two rods through the top of the post: one into this rail, one along the front.", fix: postTop(x, 1, t), tools: ["allen"] });
  }
  steps.push({
    title: "Slide the upper front rail through the front hems",
    detail: "Rail 3, from the foot end. Feed it through both front panels of the guard and push it all the way in.",
    add: ["U3"],
    from: { U3: [1700, 0, 0] },
  });
  steps.push({ title: "Bolt the front rail at the head end", detail: "Two rods through the post, hand tight.", fix: railEnd(-1, 1, yUc, "U3"), tools: ["allen"] });
  for (const side of [-1, 1] as const) {
    const b = `B${side < 0 ? "h" : "f"}`;
    steps.push({
      title: side < 0 ? "Fit a curved rail into the front guard" : "Fit the other curved rail",
      detail: "Feed it into the top hem, push its end into the socket at the post, then drop its leg into the hole in the front rail. Roll the fabric over it.",
      add: [b],
      from: { [b]: [0, 300, 200] },
    });
  }
  steps.push({ title: "Bolt the front rail at the foot end", detail: "Two rods through the post.", fix: railEnd(1, 1, yUc, "U3"), tools: ["allen"] });
  steps.push({
    title: "Bolt the curved rails from below",
    detail: "One countersunk bolt up through the front rail into each leg.",
    fix: [cs([[xLeg(-1), yU, Z]], "U3", "Bh"), cs([[xLeg(1), yU, Z]], "U3", "Bf")],
    tools: ["allen"],
  });

  const ladderDetail = loft ? "" : "Hook it over the upper front rail, then bolt its feet to the lower front rail.";
  if (!loft) {
    steps.push({
      title: "Hang the ladder in the opening",
      detail: ladderDetail,
      add: ["LD"],
      fix: [
        { kind: "bolt", count: 2, len: 20, dia: 6, name: "Button bolt", at: sx.map((x) => [(x * LW) / 2, yLow, zL + TD / 2] as Vec3), dir: [0, 0, -1], on: "LD", mate: "Lf" },
        { kind: "nut", count: 2, len: 12, dia: 10, name: "Cap nut", at: sx.map((x) => [(x * LW) / 2, yLow, Z - RT / 2] as Vec3), dir: [0, 0, 1], on: "Lf" },
      ],
      from: { LD: [0, 300, 300] },
      tools: ["allen"],
    });
  }
  steps.push({
    title: "Tighten every joint",
    detail: `Go round all ${loft ? 40 : 28} barrel nuts with the Allen key now the frame is square.`,
    tools: ["allen"],
    check: "square",
  });

  beds.forEach((_, bi) => {
    const yr = beds[bi];
    const top = yr + RH - 8;
    const slats = Array.from({ length: 7 }, (_, i) => `S${bi}${i}`);
    const where = loft ? "" : bi === 0 ? " in the lower bed" : " in the upper bed";
    if (bi === 0 || loft) {
      steps.push({
        title: "Push the slats into the bed base",
        detail: "Lay the fabric base out, arrows up, and slide a slat into each pocket.",
        add: [`F${bi}`, ...slats],
        from: Object.fromEntries([`F${bi}`, ...slats].map((id) => [id, [0, 500, 0] as Vec3])),
      });
      steps.push({ title: "Slide the rods into its long edges", detail: "One rod along each side, all the way through.", add: [`R${bi}b`, `R${bi}f`], from: { [`R${bi}b`]: [-1600, 0, 0], [`R${bi}f`]: [-1600, 0, 0] } });
    } else {
      steps.push({
        title: "Make up the second bed base",
        detail: "Slats into the pockets and a rod along each edge, as before. Then hook it onto the upper rails.",
        add: [`F${bi}`, ...slats, `R${bi}b`, `R${bi}f`],
        from: Object.fromEntries([`F${bi}`, ...slats, `R${bi}b`, `R${bi}f`].map((id) => [id, [0, 400, 0] as Vec3])),
        people: 2,
      });
    }
    steps.push({
      title: `Screw the slats to the rails${where}`,
      detail: "Hook each slat end over the rail first, then one screw through each end. 14 screws.",
      fix: [
        {
          kind: "screw",
          count: 14,
          len: 10,
          dia: 6,
          at: slats.flatMap((_, i) => sx.map((z) => [slatX(i), top, z * (Z - RT / 2 - 12)] as Vec3)),
          dir: [0, -1, 0],
          on: slats[0],
          mate: "U4",
        },
      ],
      tools: ["screwdriver"],
    });
  });

  if (loft) {
    steps.push({ title: "Cap the ladder feet and lean it on the bed", detail: "Push the domed caps onto the feet so it can't slide, then rest its hooks on the front rail.", add: ["LD"], from: { LD: [0, -200, 500] }, fix: [{ kind: "cap", count: 2, name: "Ladder foot cap", len: 25, dia: 30, at: sx.map((x) => [(x * LW) / 2, 0, Z + RT / 2 + TD / 2 + 460] as Vec3), dir: [0, 1, 0], on: "LD" }] });
    const hook = sx.map((x) => [(x * LW) / 2, yUc, Z + RT / 2] as Vec3);
    steps.push({
      title: "Hook the ladder onto the front rail",
      detail: "Its hooks go over the front rail in the opening. A bolt through each hook into a cap nut.",
      fix: [
        { kind: "bolt", count: 2, len: 16, dia: 6, name: "Button bolt", at: hook, dir: [0, 0, -1], on: "LD", mate: "U3" },
        { kind: "nut", count: 2, len: 12, dia: 10, name: "Cap nut", at: hook.map((p) => [p[0], p[1], Z - RT / 2] as Vec3), dir: [0, 0, 1], on: "U3" },
      ],
      tools: ["allen"],
    });
    steps.push({
      title: "Lock the hooks with two more bolts",
      detail: "One under each hook, so the ladder can't lift off.",
      fix: [{ kind: "bolt", count: 2, len: 16, dia: 6, name: "Button bolt", at: hook.map((p) => [p[0], p[1] - 30, p[2]] as Vec3), dir: [0, 0, -1], on: "LD", mate: "U3" }],
      tools: ["allen"],
    });
  }

  steps.push({
    title: "Stick on the labels",
    detail: loft ? "Inside the guard at the head end, and next to the ladder, where you can read them." : "Inside each guard at the head end, where you can read them.",
  });

  if (loft) {
    const wall = sx.map((x) => [x * X, yU - 150, -W / 2] as Vec3);
    steps.push({
      title: "Strap it to the wall",
      detail: "One strap round each back post, screwed to the wall. Wall screws aren't included: pick ones made for your wall.",
      fix: [
        { kind: "strap", count: 2, at: wall, dir: [0, 0, -1], on: "Phb" },
        { kind: "plug", count: 2, len: 35, dia: 8, at: wall.map((p) => [p[0], p[1], p[2] - 40] as Vec3), dir: [0, 0, -1] },
        { kind: "screw", count: 2, len: 50, dia: 5, name: "Wall screw", at: wall.map((p) => [p[0], p[1], p[2] - 36] as Vec3), dir: [0, 0, -1] },
      ],
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    });
  }

  steps.push({
    title: loft ? "Lay in your mattress" : "Lay in your mattresses",
    detail: `No thicker than ${loft ? 15 : 11} cm, so the guard stays high enough.`,
    add: beds.map((_, bi) => `M${bi}`),
  });

  for (const st of steps) for (const f of st.fix ?? []) f.count = f.at?.length ?? f.count;
  return { parts, steps };
}

const family: Family = {
  names: ["TUFFING"],
  recipe(s) {
    const g = geoOf(s);
    return g ? recipe(s, g) : null;
  },
};
export default family;

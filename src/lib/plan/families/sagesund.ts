import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * SAGESUND, from IKEA's manual (one for every size). Steel slat rails hang on screws inside the two upholstered
 * side rails and are locked with plastic inserts and pins; a bracket for the centre beam is fixed in the middle of
 * each end rail the same way. Two legs screw into the head rail; two people push each side rail onto it and bolt a
 * steel corner post and plate into the corner from below, then the foot rail goes on with its own corner posts and
 * the other two legs. The two headboards are tube frames in fabric sleeves that stand in four sockets in the head
 * rail, screwed from below. The covers are zipped closed, the centre beam drops into its brackets, the slatted base
 * (sold separately) is clipped on, two wall spacers are bolted under the head rail and the big cushions hang last.
 */

const T = 60; // upholstered rails
const Y0 = 200, Y1 = 420; // rails, bottom and top (20 cm free under the bed, 42 cm at the foot)
const LEAN = 110; // the headboards lean back past the head rail

/** IKEA's outside sizes by mattress (width x length, mm); other sizes are worked out the same way. */
const SIZES: Record<string, [number, number]> = { "1350x1900": [1500, 2130], "1930x2030": [1990, 2250] };

function mattress(s: ProductSpec): [number, number] {
  const m = /(\d{2,3})\s*[×x]\s*(\d{3})/.exec(s.variant);
  if (m) return [+m[1] * 10, +m[2] * 10];
  return [s.size.w * 10 - 150, s.size.d * 10 - 230];
}

function recipe(s: ProductSpec) {
  const [mw, ml] = mattress(s);
  const [W, L] = SIZES[`${mw}x${ml}`] ?? [mw + 150, ml + 2 * T + LEAN];
  const H = 1000;
  const zH = -L / 2 + LEAN + T / 2; // head rail centre
  const zF = L / 2 - T / 2; // foot rail centre
  const zi0 = zH + T / 2, zi1 = zF - T / 2; // inside faces of the end rails
  const Li = zi1 - zi0;
  const xs = W / 2 - T / 2; // side rail centre
  const xi = W / 2 - T; // their inside face
  const ry = (Y0 + Y1) / 2, rh = Y1 - Y0;
  const sides = [-1, 1];
  const yRail = 320; // slat rails

  const parts: CustomPart[] = [];
  for (const [i, sx] of sides.entries()) {
    parts.push({ id: `S${i}`, name: "Side rail", size: [T, rh, Li], pos: [sx * xs, ry, (zi0 + zi1) / 2], material: "soft" });
    parts.push({
      id: `R${i}`,
      name: "Slat rail",
      size: [30, 30, Li - 20],
      pos: [sx * (xi - 15), yRail, (zi0 + zi1) / 2],
      pieces: [
        { shape: "box", size: [3, 30, Li - 20], pos: [sx * 13.5, 0, 0] },
        { shape: "box", size: [30, 3, Li - 20], pos: [0, -13.5, 0] },
      ],
      material: "metal",
    });
  }
  parts.push({ id: "EH", name: "End rail", size: [W, rh, T], pos: [0, ry, zH], material: "soft" });
  parts.push({ id: "EF", name: "End rail", size: [W, rh, T], pos: [0, ry, zF], material: "soft" });
  // the centre beam's brackets, in the middle of each end rail
  for (const [i, z] of [zi0 + 20, zi1 - 20].entries())
    parts.push({ id: `U${i}`, name: "Beam bracket", size: [80, 80, 40], pos: [0, 300, z], material: "metal" });
  // corner posts inside each corner, with their plates under the rails, and the legs under the plates
  const corners: [number, number, string][] = [
    [-1, -1, "H0"],
    [1, -1, "H1"],
    [-1, 1, "F0"],
    [1, 1, "F1"],
  ];
  const legX = W / 2 - 70;
  const legZ = (sz: number) => (sz < 0 ? zH : zF);
  const plate: PartPiece[] = [{ shape: "box", size: [160, 4, 160], pos: [0, 0, 0] }];
  for (const [sx, sz, id] of corners) {
    const zc = sz < 0 ? zi0 + 20 : zi1 - 20;
    parts.push({
      id: `P${id}`,
      name: "Corner post",
      size: [40, rh, 40],
      pos: [sx * (xi - 20), ry, zc],
      pieces: [
        { shape: "box", size: [40, rh - 4, 40], pos: [0, -2, 0] },
        { shape: "box", size: [100, 4, 100], pos: [sx * 20, rh / 2 - 2, sz * 20] },
      ],
      material: "metal",
    });
    parts.push({ id: `C${id}`, name: "Corner plate", size: [160, 4, 160], pos: [sx * (W / 2 - 80), Y0 - 2, legZ(sz) - sz * 40], pieces: plate, material: "metal" });
    parts.push({ id: `L${id}`, name: "Leg", size: [45, Y0 - 4, 45], pos: [sx * legX, (Y0 - 4) / 2, legZ(sz)], shape: "cyl", material: "wood" });
  }
  parts.push({ id: "B", name: "Centre beam", size: [60, 70, Li - 40], pos: [0, 305, (zi0 + zi1) / 2], material: "wood" });
  // the headboards: a bent tube in a fabric sleeve, standing on two straight tubes in the head rail
  const hw = (W - 3 * 40) / 2;
  const lean = -Math.atan2(LEAN, H - Y1);
  const hy = (H + Y1) / 2 + 40;
  const hz = zH - LEAN / 2;
  for (const [i, sx] of sides.entries()) {
    const x = sx * (hw / 2 + 20);
    parts.push({
      id: `HB${i}`,
      name: "Headboard",
      size: [hw, 480, 25],
      pos: [x, H - 240, hz - LEAN * 0.25],
      rot: [lean, 0, 0],
      pieces: [
        { shape: "box", size: [hw - 30, 470, 6], pos: [0, -5, 0], material: "soft" },
        { shape: "cyl", size: [25, hw, 25], pos: [0, 228, 0], rot: [0, 0, Math.PI / 2] },
        { shape: "cyl", size: [25, 480, 25], pos: [-hw / 2 + 12, 0, 0] },
        { shape: "cyl", size: [25, 480, 25], pos: [hw / 2 - 12, 0, 0] },
      ],
      material: "metal",
    });
    for (const [j, ex] of [-1, 1].entries())
      parts.push({ id: `HT${i}${j}`, name: "Headboard tube", size: [25, 420, 25], pos: [x + ex * (hw / 2 - 12), H - 480 - 200 + 60, hz + LEAN * 0.12], rot: [lean, 0, 0], shape: "cyl", material: "metal" });
  }
  for (const [i, sx] of sides.entries())
    parts.push({ id: `K${i}`, name: "Headboard cushion", size: [hw, 560, 170], pos: [sx * (hw / 2 + 20), hy + 20, zH + 90], rot: [lean * 0.6, 0, 0], material: "soft" });
  // the wall spacers, under the back of the head rail
  for (const [i, sx] of sides.entries())
    parts.push({ id: `WS${i}`, name: "Wall spacer", size: [60, 70, 110], pos: [sx * (W / 4), Y0 + 35, zH - T / 2 - 55 + 30], material: "metal" });
  parts.push({ id: "SB", name: "Slatted bed base (not included)", size: [2 * xi - 60, 20, Li - 20], pos: [0, yRail + 25, (zi0 + zi1) / 2], material: "wood", extra: true, pieces: slats(2 * xi - 60, Li - 20) });
  parts.push({ id: "M", name: "Your mattress", size: [Math.min(mw, 2 * xi), 200, Math.min(ml, Li)], pos: [0, yRail + 35 + 100, (zi0 + zi1) / 2], material: "soft", extra: true });

  const named = (kind: CustomFix["kind"], name: string, at: Vec3[], dir: Vec3, extra: Partial<CustomFix> = {}): CustomFix => ({ kind, name, count: at.length, at, dir, ...extra });
  const railPts = (n: number, y: number, inset = 0): Vec3[] => sides.flatMap((sx) => Array.from({ length: n }, (_, k) => [sx * (xi - inset), y, zi0 + (Li * (k + 0.5)) / n] as Vec3));
  const head = corners.filter((c) => c[1] < 0), foot = corners.filter((c) => c[1] > 0);
  const postBolt = (c: [number, number, string]) => {
    const p = parts.find((q) => q.id === `P${c[2]}`)!.pos;
    return [p[0], Y0 - 4, p[2]] as Vec3;
  };
  const legTop = (c: [number, number, string]): Vec3 => [c[0] * legX, Y0 - 4, legZ(c[1])];
  // the side rails wait beyond the foot end and the foot rail (with its bracket and legs) further out, so each
  // slides in along its dowels when it is joined; a waiting part stands 1.6 times its offset away
  const SIDE_OFF: Vec3 = [0, 0, 700], FOOT_OFF: Vec3 = [0, 0, 900];
  const SIDE_IN: Vec3 = [0, 0, 1120], FOOT_IN: Vec3 = [0, 0, 1440];
  const socketPts: Vec3[] = parts.filter((p) => p.id.startsWith("HT")).map((p) => [p.pos[0], Y1, zH]);

  const steps: CustomStep[] = [
    {
      title: "Hang the slat rails on the side rails",
      detail: "Their keyhole slots go over the screws inside each rail. For a mattress thicker than 24 cm, move the screws to the lower holes first.",
      wait: ["S0", "S1", "R0", "R1"],
      from: { S0: SIDE_OFF, S1: SIDE_OFF, R0: SIDE_OFF, R1: SIDE_OFF },
      warnings: ["floor"],
    },
    {
      title: "Lock the slat rails with inserts and pins",
      detail: "Push an insert into each hole, then press its pin in until it's flush.",
      fix: sides.flatMap((sx, i) => {
        const pts = (y: number) => railPts(3, y, 15).filter((p) => Math.sign(p[0]) === sx);
        return [named("cap", "Insert", pts(yRail - 14), [0, 1, 0], { on: `R${i}` }), named("pin", "Locking pin", pts(yRail - 12), [0, 1, 0], { on: `R${i}` })];
      }),
      warnings: ["hand"],
    },
    {
      title: "Tighten the screws along the slat rails",
      detail: "Eight in each rail. Snug them up so the rail sits tight against the fabric.",
      // through the slat rail's upright web into the side rail behind it
      fix: [named("screw", "Rail screw", railPts(8, yRail + 8, 3), [sides[0], 0, 0], { len: 16, dia: 5, included: true })].flatMap((f) =>
        sides.map((sx, i) => ({ ...f, count: 8, at: f.at!.filter((p) => Math.sign(p[0]) === sx), dir: [sx, 0, 0] as Vec3, on: `R${i}`, mate: `S${i}` })),
      ),
      tools: ["screwdriver"],
    },
    {
      title: "Tap a dowel into each end of the side rails",
      fix: sides.flatMap((sx, i) => [zi0, zi1].map((z) => ({ kind: "dowel" as const, count: 1, len: 30, dia: 8, on: `S${i}`, at: [[sx * xs, ry, z]] as Vec3[], dir: [0, 0, z < 0 ? 1 : -1] as Vec3 }))),
      tools: ["hammer"],
    },
    {
      title: "Set a beam bracket in the middle of each end rail",
      detail: "Its pegs drop into the holes on the inside of the rail.",
      add: ["EH", "U0"],
      wait: ["EF", "U1"],
      from: { EH: [0, 0, -400], U0: [0, 0, -400], EF: FOOT_OFF, U1: FOOT_OFF },
    },
    {
      title: "Fix the brackets with inserts and pins",
      detail: "Two in each bracket: insert, pin, then a quarter turn with the screwdriver.",
      fix: [
        ...[zi0 + 20, zi1 - 20].flatMap((z, i) => [
          named("cap", "Insert", [-1, 1].map((ex) => [ex * 25, 260, z] as Vec3), [0, 1, 0], { on: `U${i}` }),
          named("pin", "Locking pin", [-1, 1].map((ex) => [ex * 25, 262, z] as Vec3), [0, 1, 0], { on: `U${i}` }),
        ]),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Press a glide onto the end of each leg",
      detail: "Push it on firmly, all four legs.",
      add: head.map((c) => `L${c[2]}`),
      wait: foot.map((c) => `L${c[2]}`),
      from: Object.fromEntries(foot.map((c) => [`L${c[2]}`, FOOT_OFF])),
      fix: corners.map((c) => named("glide", "Glide", [[c[0] * legX, 0, legZ(c[1])]], [0, 1, 0], { on: `L${c[2]}` })),
      warnings: ["hand"],
    },
    {
      title: "Screw two legs into the head rail",
      detail: "A big washer on each leg's thread, then turn it in by hand until it's firm.",
      fix: [named("washer", "Big washer", head.map(legTop), [0, 1, 0], { dia: 40, len: 6 })],
      warnings: ["hand"],
    },
    {
      title: "Push a side rail onto the head rail and bolt the corner",
      detail: "One of you holds the rails while the other sets the corner post in and bolts it up through the plate, with the small washer.",
      add: ["S0", "R0", "PH0", "CH0"],
      from: { S0: SIDE_IN, R0: SIDE_IN },
      fix: [named("bolt", "Bolt", [postBolt(head[0])], [0, 1, 0], { len: 20, dia: 8 }), named("washer", "Washer", [postBolt(head[0])], [0, 1, 0], { dia: 16, len: 2 })],
      people: 2,
      tools: ["allen"],
    },
    {
      title: "Do the same with the other side rail",
      add: ["S1", "R1", "PH1", "CH1"],
      from: { S1: SIDE_IN, R1: SIDE_IN },
      fix: [named("bolt", "Bolt", [postBolt(head[1])], [0, 1, 0], { len: 20, dia: 8 }), named("washer", "Washer", [postBolt(head[1])], [0, 1, 0], { dia: 16, len: 2 })],
      people: 2,
      tools: ["allen"],
    },
    {
      title: "Fit the foot rail and screw in the last two legs",
      detail: "Corner posts in, plates under, then each leg goes up through its plate with a big washer.",
      add: ["EF", "U1", ...foot.map((c) => `L${c[2]}`), "PF0", "PF1", "CF0", "CF1"],
      from: Object.fromEntries(["EF", "U1", ...foot.map((c) => `L${c[2]}`)].map((id) => [id, FOOT_IN])),
      fix: [named("washer", "Big washer", foot.map(legTop), [0, 1, 0], { dia: 40, len: 6 })],
      people: 2,
      check: "square",
    },
    {
      title: "Slide a sleeve onto each headboard frame",
      detail: "Over the bent tube, seams to the back.",
      add: ["HB0", "HB1"],
    },
    {
      title: "Push the straight tubes into the frames",
      add: ["HT00", "HT01", "HT10", "HT11"],
    },
    {
      title: "Screw the tubes to the frames",
      detail: "One small screw at each joint.",
      fix: [named("screw", "Screw", parts.filter((p) => p.id.startsWith("HT")).map((p) => [p.pos[0], p.pos[1] + 200, p.pos[2] + 10] as Vec3), [0, 0, -1], { len: 10, dia: 4 })],
      tools: ["screwdriver"],
    },
    {
      title: "Push the four sockets into the head rail",
      detail: "Through the holes in the fabric, until their rims sit on top.",
      fix: [named("cap", "Socket", socketPts, [0, -1, 0])],
      warnings: ["hand"],
    },
    {
      title: "Screw the headboards in from below",
      detail: "Stand each one in its two sockets, then a long screw up into each tube. The clip holds the screw on the key.",
      fix: [named("screw", "Screw", socketPts.map((p) => [p[0], Y0, p[2]] as Vec3), [0, 1, 0], { len: 50, dia: 5 })],
      people: 2,
      tools: ["allen"],
    },
    {
      title: "Close the covers all round",
      detail: "Pull the fabric over the rails' top edges and zip it closed, corner to corner, then tuck in the flaps.",
    },
    {
      title: "Drop the centre beam into its brackets",
      detail: "Its end fittings go down into the brackets in the end rails.",
      add: ["B"],
      fix: [named("connector", "Beam fitting", [zi0 + 40, zi1 - 40].map((z) => [0, 340, z] as Vec3), [0, -1, 0])],
    },
    {
      title: "Lay the slatted base in and clip it down",
      detail: "The slatted base is sold separately. One clip over the rail at each corner.",
      add: ["SB"],
      fix: [named("clip", "Clip", sides.flatMap((sx) => [zi0 + 60, zi1 - 60].map((z) => [sx * (xi - 15), yRail + 18, z] as Vec3)), [0, -1, 0])],
    },
    {
      title: "Bolt the wall spacers under the head rail",
      detail: "One each side, with a soft pad on the end that faces the wall.",
      add: ["WS0", "WS1"],
      fix: [
        named("bolt", "Bolt", sides.map((sx) => [sx * (W / 4), Y0, zH] as Vec3), [0, 1, 0], { len: 20, dia: 8 }),
        named("glide", "Pad", sides.map((sx) => [sx * (W / 4), Y0 + 35, zH - T / 2 - 55 + 30 - 55] as Vec3), [0, 0, 1]),
      ],
      tools: ["allen"],
    },
    {
      title: "Fill the headboard cushions and hang them on",
      detail: "Fluff the fillings into the covers and zip them closed, then hook each cushion over its headboard.",
      add: ["K0", "K1"],
    },
    { title: "Lay your mattress on", add: ["M"] },
  ];
  return { parts, steps };
}

function slats(w: number, len: number): PartPiece[] {
  const n = Math.max(12, Math.round(len / 120));
  const pitch = (len - 60) / (n - 1);
  return Array.from({ length: n }, (_, i): PartPiece => ({ shape: "box", size: [w, 12, 60], pos: [0, 0, -len / 2 + 30 + i * pitch] }));
}

const family: Family = {
  names: ["SAGESUND"],
  recipe(s) {
    if (!/bed-frame|bed frame/i.test(`${s.slug} ${s.variant}`)) return null;
    return recipe(s);
  },
};
export default family;

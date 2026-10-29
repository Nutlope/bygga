import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * HUVUDSPELARE, read from the gaming desk's and the gaming chair's manuals.
 *
 * Desk: two tube loops are the legs. Upside down on a rug, two long rails are bolted between them (one long bolt
 * into each end) and the red braces go from each loop to the back rail on four short bolts. Twelve plastic spacers
 * click into the rails and loops, the frame is lowered onto the face-down top and bolted on with twelve bolts, then
 * the braces and the rail bolts are tightened. The cable net is pinned under the top with six plugs and pins, four
 * hexagon pads go under the loops, and once it is turned over the headphone hook (felt pads inside) clips on.
 *
 * Chair: castors into the base, gas lift in, the seat with its mechanism goes on; the back is bolted to the
 * mechanism's back bar, the armrests bolt under the seat, and the back cover and side covers clip over the bolts.
 */

const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });

function desk(s: ProductSpec): CustomParams {
  // IKEA's measures: 140 x 80 (the page gives no height; ours is 74)
  const W = s.size.w * 10 || 1400, D = s.size.d * 10 || 800, H = s.size.h * 10 || 740;
  const topT = 25, tube = 30;
  const topY0 = H - topT;
  const xl = W / 2 - 90; // loop centre line
  const zl = D / 2 - 60; // loop's front and back tubes
  const barY = topY0 - tube / 2;
  const loopH = barY - tube / 2 + tube; // floor bar to top bar, centre to centre plus a tube
  const loop: PartPiece[] = [
    { shape: "cyl", size: [tube, 2 * zl, tube], pos: [0, loopH / 2 - tube / 2, 0], rot: [Math.PI / 2, 0, 0] },
    { shape: "cyl", size: [tube, 2 * zl, tube], pos: [0, -loopH / 2 + tube / 2, 0], rot: [Math.PI / 2, 0, 0] },
    ...[-1, 1].map((sz): PartPiece => ({ shape: "cyl", size: [tube, loopH - tube, tube], pos: [0, 0, sz * zl] })),
  ];
  const railH = 40, railT = 20, zr = zl - 40;
  const railY = topY0 - railH / 2;
  const railLen = 2 * xl - tube;
  const parts: CustomPart[] = [
    { id: "L1", name: "Leg loop", size: [tube, loopH, 2 * zl + tube], pos: [-xl, loopH / 2, 0], pieces: loop, material: "metal" },
    { id: "L2", name: "Leg loop", size: [tube, loopH, 2 * zl + tube], pos: [xl, loopH / 2, 0], pieces: loop, material: "metal" },
    { id: "RF", name: "Rail", size: [railLen, railH, railT], pos: [0, railY, zr], material: "metal" },
    { id: "RB", name: "Rail", size: [railLen, railH, railT], pos: [0, railY, -zr], material: "metal" },
  ];
  // the braces run from each loop's back tube up to the back rail
  const zb = -zr + railT / 2 + 8;
  const lo: Vec3 = [xl - tube / 2, 430, zb], hi: Vec3 = [xl - 260, topY0 - railH, zb];
  const bLen = Math.hypot(lo[0] - hi[0], hi[1] - lo[1]);
  const ang = Math.atan2(lo[0] - hi[0], hi[1] - lo[1]);
  for (const sx of [-1, 1])
    parts.push({
      id: sx < 0 ? "B1" : "B2",
      name: "Brace",
      size: [16, bLen, 16],
      pos: [sx * (lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, zb],
      rot: [0, 0, sx * ang],
      shape: "cyl",
      material: "metal",
    });
  parts.push({ id: "TOP", name: "Desk top", size: [W, topT, D], pos: [0, H - topT / 2, 0], material: "board" });
  const netW = Math.min(900, W - 500), netD = 160, netZ = -zr + railT / 2 + netD / 2 + 30;
  parts.push({ id: "NET", name: "Cable net", size: [netW, 40, netD], pos: [0, topY0 - 20, netZ], material: "soft" });
  const hx = xl - 220;
  parts.push({
    id: "HOOK",
    name: "Headphone hook",
    size: [30, 70, 60],
    pos: [hx, topY0 - 35, zr + 10],
    pieces: [
      { shape: "box", size: [30, 4, 50], pos: [0, 33, -5] },
      { shape: "box", size: [30, 70, 4], pos: [0, 0, 20] },
      { shape: "box", size: [30, 4, 30], pos: [0, -33, 5] },
    ],
    material: "metal",
  });

  const ends = [-1, 1];
  const longBolts = ends.flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * (xl + tube / 2), railY, sz * zr]));
  const braceBolts: Vec3[] = ends.flatMap((sx): Vec3[] => [
    [sx * lo[0], lo[1], zb - 8],
    [sx * hi[0], hi[1], zb - 8],
  ]);
  const railPts = [-1, 1].flatMap((sz) => [-0.75, -0.25, 0.25, 0.75].map((f): Vec3 => [f * railLen / 2, topY0 - railH, sz * zr]));
  const loopPts = ends.flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xl, topY0 - tube, sz * 150]));
  const topBolts = [...railPts, ...loopPts];
  const netPts = [-1, 0, 1].flatMap((f) => [-1, 1].map((sz): Vec3 => [f * (netW / 2 - 20), topY0 - 6, netZ + sz * (netD / 2 - 10)]));
  const feet = ends.flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xl, 0, sz * (zl - 80)]));

  const steps: CustomStep[] = [
    {
      title: "Bolt a rail to one leg loop",
      detail: "Lay the loop on a rug. Turn the rail so its holes face the right way, then one long bolt through the loop into its end.",
      add: ["L1", "RF"],
      fix: [at("bolt", [longBolts[1]], [1, 0, 0], "L1", "RF", { len: 90, dia: 6 })],
      tools: ["allen"],
      pose: "-y",
      warnings: ["floor", "loose"],
    },
    {
      title: "Bolt the second rail to the same loop",
      detail: "The same way at the other corner. Keep the bolts loose for now.",
      add: ["RB"],
      fix: [at("bolt", [longBolts[0]], [1, 0, 0], "L1", "RB", { len: 90, dia: 6 })],
      tools: ["allen"],
    },
    {
      title: "Bolt on the other leg loop",
      detail: "Two long bolts, one into each rail. The bolt heads sit flat in the loop, not proud of it.",
      add: ["L2"],
      fix: [at("bolt", longBolts.slice(2), [-1, 0, 0], "L2", undefined, { len: 90, dia: 6 })],
      tools: ["allen"],
      warnings: ["loose"],
    },
    {
      title: "Bolt the braces between the loops and the back rail",
      detail: "Both braces the same way round, flat ends against the tube. One short bolt at each end, still loose.",
      add: ["B1", "B2"],
      fix: [at("bolt", braceBolts, [0, 0, 1], undefined, undefined, { len: 12, dia: 6 })],
      tools: ["allen"],
      warnings: ["loose"],
    },
    {
      title: "Click the spacers into the frame",
      detail: "One in each of the twelve holes along the rails and the tops of the loops, until it clicks.",
      // the spacers sit in the holes' top ends, between the frame and the top
      fix: [at("cap", topBolts.map(([x, , z]): Vec3 => [x, topY0 - 4, z]), [0, 1, 0], undefined, undefined, { len: 8, dia: 20, name: "Plastic spacer" })],
    },
    {
      title: "Lower the frame onto the top and bolt it on",
      detail: "Lay the top face down on the rug. Set the frame on it with the holes lined up, then twelve bolts with their washers.",
      add: ["TOP"],
      // up through the hollow rails and tubes, their tips in the top
      fix: [at("bolt", [...railPts.map(([x, , z]): Vec3 => [x, topY0 - 26, z]), ...loopPts.map(([x, , z]): Vec3 => [x, topY0 - tube, z])], [0, 1, 0], undefined, "TOP", { len: 35, dia: 6 })],
      tools: ["allen"],
      from: { TOP: [0, -420, 0] },
    },
    { title: "Tighten the brace bolts", detail: "All four, now that the top holds the frame square.", tools: ["allen"], kind: "bolts" },
    { title: "Tighten the long bolts in the loops", detail: "All four, until the heads sit flat against the tube.", tools: ["allen"], kind: "bolts" },
    {
      title: "Pin the cable net under the top",
      detail: "Push a plug through each loop of the net into its hole, then tap a pin into the plug with a hammer.",
      add: ["NET"],
      fix: [
        at("cap", netPts, [0, 1, 0], "NET", "TOP", { len: 10, dia: 12, name: "Expanding plug" }),
        at("nail", netPts, [0, 1, 0], "NET", "TOP", { len: 16, dia: 4, name: "Pin" }),
      ],
      tools: ["hammer"],
    },
    {
      title: "Stick the pads under the loops and turn the desk over",
      detail: "Two hexagon pads under each loop's foot. Then lift it over together, by the top.",
      fix: [at("glide", feet, [0, 1, 0], undefined, undefined, { len: 4, dia: 40, name: "Hexagon pad" })],
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Stick the felt pads inside the headphone hook",
      detail: "Peel them off the sheet and press them where the hook will touch the rail.",
      pose: "+y",
    },
    {
      title: "Clip the hook onto the rail",
      detail: "Under the front edge, near either end. Push it on until it holds.",
      add: ["HOOK"],
      fix: [at("glide", [-8, 8].flatMap((dx) => [zr - 5, zr + 25].map((z): Vec3 => [hx + dx, topY0 - 2, z])), [0, 1, 0], "HOOK", undefined, { len: 2, dia: 14, name: "Felt pad" })],
    },
  ];
  return { parts, steps };
}

function chair(s: ProductSpec): CustomParams {
  // IKEA's measures: 60 wide, 54 deep, 113 to 123 high; seat 46 x 42, 43 to 53 high; armrests 62 to 72 high
  const H = 1130, R = 290;
  const seatW = 460, seatD = 420, seatTop = 440, seatT = 60;
  const mechY = seatTop - seatT - 25;
  const legY = 75, hubY = 80;
  const parts: CustomPart[] = [];
  const angles = [0, 1, 2, 3, 4].map((i) => Math.PI / 2 + (i * 2 * Math.PI) / 5);
  const legs = angles.map((_, i) => `LG${i}`);
  parts.push({ id: "HUB", name: "Hub", size: [80, 70, 80], pos: [0, hubY, 0], shape: "cyl", material: "metal" });
  angles.forEach((a, i) => {
    const r = (40 + R) / 2;
    parts.push({ id: legs[i], name: "Leg", size: [R - 40, 35, 45], pos: [Math.cos(a) * r, legY, -Math.sin(a) * r], rot: [0, a, 0], material: "metal" });
  });
  parts.push({ id: "GAS", name: "Gas lift", size: [50, mechY - 25 - (hubY - 20), 50], pos: [0, (mechY - 25 + hubY - 20) / 2, 0], shape: "cyl", material: "metal" });
  parts.push({ id: "MECH", name: "Mechanism", size: [200, 50, 240], pos: [0, mechY, 0], material: "metal" });
  parts.push({ id: "SEAT", name: "Seat", size: [seatW, seatT, seatD], pos: [0, seatTop - seatT / 2, 20], material: "soft" });

  // the mesh back, with the bar that runs under the seat to the mechanism
  const backW = 480, backZ = -seatD / 2 - 10, back0 = seatTop + 30;
  const backH = H - back0;
  const bcy = (mechY + H) / 2;
  const rel = (y: number) => y - bcy;
  parts.push({
    id: "BACK",
    name: "Backrest",
    size: [backW, H - mechY + 25, seatD / 2 + 60],
    pos: [0, bcy, backZ + 40],
    pieces: [
      { shape: "box", size: [backW, backH, 40], pos: [0, rel(back0 + backH / 2), -40], rot: [-0.08, 0, 0], material: "soft" },
      ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [24, 300, 40], pos: [sx * (backW / 2 - 12), rel(seatTop + 120), -20], material: "metal" })),
      { shape: "box", size: [70, 24, 200], pos: [0, rel(mechY), 50], material: "metal" },
      { shape: "box", size: [70, back0 - mechY + 40, 24], pos: [0, rel((mechY + back0) / 2 + 10), -40], material: "metal" },
    ],
    material: "soft",
  });
  const armY = 620, armX = backW / 2 + 15, armZf = 90, armZb = backZ + 20;
  const armLen = armZf - armZb + 30;
  for (const sx of [-1, 1]) {
    const id = sx < 0 ? "AL" : "AR";
    const cy = (seatTop - 40 + armY) / 2;
    parts.push({
      id,
      name: "Arm",
      size: [30, armY - seatTop + 60, armLen],
      pos: [sx * armX, cy, (armZf + armZb) / 2],
      pieces: [
        { shape: "cyl", size: [26, armY - seatTop + 40, 26], pos: [0, 0, armZf - (armZf + armZb) / 2] },
        { shape: "cyl", size: [26, armLen - 20, 26], pos: [0, armY - cy, 0], rot: [Math.PI / 2, 0, 0] },
        { shape: "box", size: [60, 14, 40], pos: [-sx * 30, seatTop - 40 - cy + 7, armZf - (armZf + armZb) / 2] },
        // the plate at the back end that bolts against the backrest's side bracket
        { shape: "box", size: [14, armY - seatTop - 20, 40], pos: [-sx * 7, (seatTop + 20 + armY) / 2 - cy, armZb - (armZf + armZb) / 2] },
      ],
      material: "metal",
    });
    parts.push({ id: sx < 0 ? "PL" : "PR", name: "Armrest pad", size: [60, 25, 250], pos: [sx * armX, armY + 25, (armZf + armZb) / 2 + 20], material: "soft" });
  }

  const legScrews = angles.flatMap((a) => [70, 105].map((r): Vec3 => [Math.cos(a) * r, legY + 18, -Math.sin(a) * r]));
  const tips = angles.map((a): Vec3 => [Math.cos(a) * (R - 25), legY - 18, -Math.sin(a) * (R - 25)]);
  const mechBolts: Vec3[] = [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * 75, mechY + 25, sz * 90]));
  const backBolts: Vec3[] = [-1, 1].flatMap((sx) => [20, 100].map((z): Vec3 => [sx * 20, mechY - 12, -z]));
  const padScrews = (sx: number): Vec3[] => [-60, 60].map((dz): Vec3 => [sx * armX, armY + 13, (armZf + armZb) / 2 + 20 + dz]);
  const armBolts = (sx: number): CustomFix[] => [
    at("bolt", [[sx * (armX - 30), seatTop - 40, armZf]], [0, 1, 0], sx < 0 ? "AL" : "AR", "SEAT", { len: 60, dia: 6 }),
    at("bolt", [seatTop + 60, seatTop + 140].map((y): Vec3 => [sx * armX, y, armZb]), [-sx, 0, 0], sx < 0 ? "AL" : "AR", "BACK", { len: 16, dia: 6 }),
  ];

  // the seat, its back and arms are put together beside the base, then lowered onto the gas lift
  const arms = ["AL", "PL", "AR", "PR"], top = ["SEAT", "MECH", "BACK", ...arms];
  const aside = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, [800, 0, 0] as Vec3]));
  const steps: CustomStep[] = [
    { title: "Push the five legs into the hub", detail: "On a rug, each leg straight into its socket until it stops.", add: ["HUB", ...legs], warnings: ["floor"] },
    {
      title: "Screw the legs to the hub",
      detail: "Two screws in each leg, each with a washer. Tighten them with the Allen key.",
      fix: [at("screw", legScrews, [0, -1, 0], "HUB", undefined, { len: 12, dia: 6 }), at("washer", legScrews, [0, -1, 0], "HUB", undefined, { len: 2, dia: 12, name: "Spring washer" })],
      tools: ["allen"],
    },
    { title: "Push a castor into each leg", detail: "Press each pin in hard until the castor clicks home.", fix: [at("castor", tips, [0, 1, 0], undefined, undefined, { len: 58, dia: 50 })] },
    { title: "Pull the cap off the gas lift", detail: "The cap only protects it in the box; throw it away." },
    { title: "Push the gas lift into the hub", detail: "Thick end down, straight in. Never take it apart: it is under pressure.", add: ["GAS"], from: { GAS: [0, 380, 0] } },
    {
      title: "Bolt the mechanism under the seat",
      detail: "Do this with the seat upside down on the rug, the lever on the right. Four bolts, tight.",
      wait: ["SEAT", "MECH"],
      fix: [at("bolt", mechBolts, [0, 1, 0], "MECH", "SEAT", { len: 20, dia: 6 })],
      tools: ["allen"],
      from: aside(["SEAT", "MECH"]),
    },
    {
      title: "Bolt the backrest's bar to the mechanism",
      detail: "Rest the back on a table edge and lay its bar over the back of the mechanism. Four bolts, tight.",
      wait: ["BACK"],
      from: aside(["BACK"]),
      fix: [at("bolt", backBolts, [0, 1, 0], "BACK", "MECH", { len: 20, dia: 6 })],
      tools: ["allen"],
    },
    {
      title: "Screw a pad onto each arm",
      detail: "Two small screws up through each arm into its pad.",
      wait: arms,
      fix: [-1, 1].map((sx) => at("screw", padScrews(sx), [0, 1, 0], sx < 0 ? "AL" : "AR", sx < 0 ? "PL" : "PR", { len: 16, dia: 4 })),
      tools: ["screwdriver"],
      from: aside(arms),
    },
    {
      title: "Bolt the left arm on",
      detail: "With the seat lying on its right side: one long bolt up through the arm's foot into the seat, two short ones into the side of the back.",
      fix: armBolts(-1),
      tools: ["allen"],
    },
    {
      title: "Turn the seat over and bolt on the right arm",
      detail: "The same way: one long bolt into the seat, two short ones into the back.",
      fix: armBolts(1),
      tools: ["allen"],
    },
    { title: "Tighten the four bolts on the back bracket", detail: "Turn each one with the Allen key until it is tight.", tools: ["allen"], kind: "bolts" },
    { title: "Lower the seat onto the gas lift", detail: "Stand it up and press it straight down over the lift. Sit on it once to lock the taper.", add: top, from: Object.fromEntries(top.map((id) => [id, [0, 350, 0] as Vec3])) },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["HUVUDSPELARE"],
  recipe(s) {
    const t = `${s.slug ?? ""} ${s.variant}`.replace(/-/g, " ");
    if (/gaming desk/i.test(t)) return desk(s);
    if (/gaming chair/i.test(t)) return chair(s);
    return null;
  },
};
export default family;

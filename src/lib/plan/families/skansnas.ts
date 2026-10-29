import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * SKANSNÄS, read from IKEA's manuals.
 *
 * Extendable table (round 115/170 and 150/205): both halves of the top lie face down on a rug with their locks
 * closed. Corner brackets go on the side aprons, the end aprons are screwed to them, and each half's three aprons
 * are fixed to the top with eighteen long screws. Each leg takes a cross dowel and two threaded rods and is bolted
 * into its corner bracket with spring washers and nuts. Then the halves are pulled apart, the two slides go in
 * between and are screwed on, the leaf frame is doweled together with four corner plates and screwed to the slides,
 * the alignment and leaf pins go under the seam, the folded leaf goes into its frame, and the table is turned over.
 * Chair: built lying on its front. Studs in the four legs, a connector nut in each end of the two side rails, the
 * side rails and stretchers stand on the front frame, the back frame goes on top. Stood up, the backrest clicks
 * onto its pins, and upside down on a table the woven seat is screwed on with three brackets.
 */

const box = (size: Vec3, pos: Vec3, rot?: Vec3, material?: PartPiece["material"]): PartPiece => ({ shape: "box", size, pos, ...(rot ? { rot } : {}), ...(material ? { material } : {}) });
const pairs = <T,>(f: (a: number, b: number) => T): T[] => [-1, 1].flatMap((a) => [-1, 1].map((b) => f(a, b)));
const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, ...o });

/* ---------- extendable table ---------- */

function table(s: ProductSpec): CustomParams {
  const round = !!s.table?.round || /115-170/.test(s.slug ?? "");
  const L = round ? 1150 : 1500, W = round ? 1150 : 900, H = 750, TT = 24;
  const U = H - TT; // underside of the top
  const AH = 80, AT = 20, LG = 50;
  const lx = round ? 370 : L / 2 - 70, lz = round ? 370 : W / 2 - 60; // leg centres
  const sideLen = lx - LG / 2 - 30;
  const sz = lz - 12; // slides, just inside the side aprons
  const fz = sz - 25, fx = 300; // leaf frame
  const parts: CustomPart[] = [];
  const half = (g: number): CustomPart =>
    round
      ? { id: `T${g < 0 ? 0 : 1}`, name: "Table top half", size: [L / 2, TT, W], pos: [(g * L) / 4, H - TT / 2, 0], material: "wood", pieces: [{ shape: "halfcyl", size: [W, TT, W / 2], pos: [0, 0, 0], rot: [0, g * (Math.PI / 2), 0] }] }
      : { id: `T${g < 0 ? 0 : 1}`, name: "Table top half", size: [L / 2, TT, W], pos: [(g * L) / 4, H - TT / 2, 0], material: "wood" };
  parts.push(half(-1), half(1));
  const hi = (g: number) => (g < 0 ? 0 : 1);
  for (const [g, gz] of pairs((a, b) => [a, b] as const))
    parts.push({ id: `S${hi(g)}${hi(gz)}`, name: "Side apron", size: [sideLen, AH, AT], pos: [g * (30 + sideLen / 2), U - AH / 2, gz * (lz + 15)], material: "wood" });
  for (const g of [-1, 1]) parts.push({ id: `E${hi(g)}`, name: "End apron", size: [AT, AH, 2 * (lz - LG / 2)], pos: [g * (lx + 15), U - AH / 2, 0], material: "wood" });
  const legs: string[] = [];
  for (const [g, gz] of pairs((a, b) => [a, b] as const)) {
    const id = `L${hi(g)}${hi(gz)}`;
    legs.push(id);
    parts.push({ id, name: "Leg", size: [LG, U, LG], pos: [g * lx, U / 2, gz * lz], shape: "cyl", material: "wood" });
  }
  for (const gz of [-1, 1]) parts.push({ id: `R${hi(gz)}`, name: "Slide", size: [2 * (lx - LG / 2) - 20, 40, 26], pos: [0, U - 20, gz * sz], material: "metal" });
  const FH = 70, fy = U - 5 - FH / 2;
  for (const gz of [-1, 1]) parts.push({ id: `F${hi(gz)}`, name: "Leaf frame side", size: [2 * fx, FH, 18], pos: [0, fy, gz * fz], material: "wood" });
  for (const g of [-1, 1]) parts.push({ id: `F${g < 0 ? 2 : 3}`, name: "Leaf frame end", size: [18, FH, 2 * fz - 18], pos: [g * (fx - 9), fy, 0], material: "wood" });
  const lw = 2 * fx - 50, ll = 2 * fz - 40;
  parts.push({ id: "X", name: "Extension leaf", size: [lw, 2 * 20, ll], pos: [0, fy - FH / 2 + 3 + 20, 0], material: "wood", pieces: [box([lw, 20, ll], [0, -10, 0]), box([lw, 20, ll], [0, 10, 0])] });

  // where the fittings go, in the finished table
  const apronScrews = (perApron: 1 | 2): Vec3[] =>
    [-1, 1].flatMap((g) => [
      ...[-1, 1].flatMap((gz) => (perApron === 1 ? [0.5] : [0.15, 0.85]).map((t): Vec3 => [g * (30 + t * sideLen), U - AH, gz * (lz + 15)])),
      ...(perApron === 1 ? [0] : [-0.6, 0.6]).map((t): Vec3 => [g * (lx + 15), U - AH, t * (lz - LG / 2)]),
    ]);
  const by = U - 40; // corner brackets
  const bracketAt = pairs((g, gz): Vec3 => [g * (lx - 40), by, gz * (lz - 40)]);
  const sideBracketScrews = pairs((g, gz) => [-15, 15].map((dy): Vec3 => [g * (lx - LG / 2 - 22), by + dy, gz * (lz + 5)])).flat();
  const endBracketScrews = pairs((g, gz) => [-15, 15].map((dy): Vec3 => [g * (lx + 5), by + dy, gz * (lz - LG / 2 - 22)])).flat();
  // one fix per way in, so a step stays under the custom builder's ten fixes
  const legFix = (kind: CustomFix["kind"], f: (g: number, gz: number) => [Vec3, Vec3][], o: Partial<CustomFix>): CustomFix[] => {
    const byDir = new Map<string, { dir: Vec3; pts: Vec3[] }>();
    for (const [p, d] of pairs((g, gz) => f(g, gz)).flat()) {
      const k = d.join(",");
      if (!byDir.has(k)) byDir.set(k, { dir: d, pts: [] });
      byDir.get(k)!.pts.push(p);
    }
    return [...byDir.values()].map(({ dir, pts }) => at(kind, pts, dir, o));
  };
  const rods = (g: number, gz: number, d: number): [Vec3, Vec3][] => [
    [[g * (lx - LG / 2 - d), U - 30, gz * lz], [g, 0, 0]],
    [[g * lx, U - 55, gz * (lz - LG / 2 - d)], [0, 0, gz]],
  ];
  const slideScrews = [-1, 1].flatMap((gz) => [-1, 1].flatMap((g) => [0.2, 0.5, 0.8].map((t): Vec3 => [g * t * (lx - LG / 2 - 20), U - 4, gz * sz])));
  const plateAt = pairs((g, gz): Vec3 => [g * (fx - 40), U - 5 - FH, gz * (fz - 40)]);
  // the plate spans the inside corner: one screw up into the side, one into the end, one where they meet
  const plateScrews = plateAt.flatMap(([x, y, z]): Vec3[] => {
    const g = Math.sign(x), gz = Math.sign(z);
    return [[g * (fx - 50), y, gz * fz], [g * (fx - 9), y, gz * (fz - 50)], [g * (fx - 9), y, gz * (fz - 9)]];
  });
  const frameScrews = [-1, 1].flatMap((gz) => [-200, -120, 120, 200].map((x): Vec3 => [x, fy, gz * (fz + 9)]));
  const pinAt: Vec3[] = [-1, 1].flatMap((g) => [-1, 1].map((gz): Vec3 => [g * 50, U, gz * W * 0.22]));
  const pinScrews = pinAt.flatMap(([x, y, z]): Vec3[] => [[x + Math.sign(x) * 25, y, z], [x + Math.sign(x) * 45, y, z]]);
  const feltAt: Vec3[] = pairs((g, gz): Vec3 => [g * 30, U, gz * (W / 2 - (round ? 150 : 80))]);

  const steps: CustomStep[] = [
    {
      title: "Lay both halves of the top face down",
      detail: "On a rug, seam to seam. Close the two locks under the seam so the halves can't slide apart.",
      add: ["T0", "T1"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Screw a corner bracket to each side apron",
      detail: "At the end of the apron that meets a leg. Use the round-headed screws, not the short flat ones.",
      add: ["S00", "S01", "S10", "S11"],
      fix: [at("angle", bracketAt, [0, 1, 0], { name: "Corner bracket", len: 60, dia: 40 }), ...[-1, 1].map((gz) => at("screw", sideBracketScrews.filter((p) => Math.sign(p[2]) === gz), [0, 0, gz], { len: 16, dia: 5 }))],
      tools: ["screwdriver"],
    },
    { title: "Screw the end aprons to the brackets", detail: "One at the round end of each half, two screws into each bracket.", add: ["E0", "E1"], fix: [-1, 1].map((g) => at("screw", endBracketScrews.filter((p) => Math.sign(p[0]) === g), [g, 0, 0], { len: 16, dia: 5 })), tools: ["screwdriver"] },
    { title: "Fix the aprons to the top", detail: "One long screw through each apron into the top, three on each half. Stop when the head sits flush.", fix: [at("screw", apronScrews(1), [0, 1, 0], { len: 95, dia: 5 })], tools: ["screwdriver"] },
    { title: "Drive in the other long screws", detail: "Two more in every apron, twelve in all. Then tighten all eighteen, without sinking the heads.", fix: [at("screw", apronScrews(2), [0, 1, 0], { len: 95, dia: 5 })], tools: ["screwdriver"] },
    {
      title: "Fit the cross dowels and rods to the legs",
      detail: "Push a cross dowel into the top of each leg, slot towards the rods, then turn two threaded rods into each leg by hand. Stand each leg in its corner.",
      add: legs,
      from: Object.fromEntries(legs.map((k) => [k, [0, -320, 0] as Vec3])),
      fix: [...legFix("nut", (g, gz) => [[[g * lx, U - 45, gz * lz], [0, -1, 0]]], { name: "Cross dowel", len: 30, dia: 10 }), ...legFix("legScrew", (g, gz) => rods(g, gz, 0), { name: "Threaded rod", len: 70, dia: 8 })],
    },
    {
      title: "Bolt the legs into the corner brackets",
      detail: "Rods through the bracket, a spring washer and a nut on each. Tighten them with the box spanner until the leg sits firm.",
      fix: [...legFix("washer", (g, gz) => rods(g, gz, 22), { name: "Spring washer", dia: 12 }), ...legFix("nut", (g, gz) => rods(g, gz, 24), { len: 7, dia: 8 })],
      tools: ["wrench"],
    },
    { title: "Tap a glide into each leg", detail: "Into the hole in the foot of the leg, until it sits flat.", fix: [at("glide", pairs((g, gz): Vec3 => [g * lx, 0, gz * lz]), [0, 1, 0], { name: "Glide", len: 6, dia: 26 })], tools: ["hammer"] },
    { title: "Open the locks and pull the halves apart", detail: "Flip the two locks under the seam open, then slide the halves away from each other, legs and all." },
    {
      title: "Lay the slides in and close the locks",
      detail: "The slides go across the gap, one along each side. Push the halves back together and click all four locks shut.",
      add: ["R0", "R1"],
    },
    { title: "Screw the slides to the top", detail: "Twelve round-headed screws, three into each half along each slide.", fix: [at("screw", slideScrews, [0, 1, 0], { len: 16, dia: 5 })], tools: ["screwdriver"] },
    { title: "Dowel the leaf frame together", detail: "Two dowels at each corner. Press the four boards together on the rug.", add: ["F0", "F1", "F2", "F3"], fix: [{ kind: "dowel", count: 8, len: 30, dia: 8 }], tools: ["hammer"] },
    { title: "Screw a corner plate on each corner", detail: "Three wood screws in each plate keep the frame square, and the leaf will rest on them.", fix: [at("plate", plateAt, [0, 1, 0], { name: "Corner plate", len: 3, dia: 70 }), at("screw", plateScrews, [0, 1, 0], { len: 30, dia: 4 })], tools: ["screwdriver"], check: "square" },
    {
      title: "Screw the leaf frame to the slides",
      detail: "Set it down between the slides so it hangs on their brackets, then four small screws through the brackets on each side.",
      fix: [at("screw", frameScrews, [0, 0, -1], { len: 14, dia: 4 })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the pins under the seam",
      detail: "The two straight alignment pins go into one half and the two bent leaf pins into the other, two screws each.",
      fix: [
        at("pin", pinAt.slice(0, 2), [0, 1, 0], { name: "Alignment pin", len: 50, dia: 12 }),
        at("pin", pinAt.slice(2), [0, 1, 0], { name: "Leaf pin", len: 50, dia: 12 }),
        at("screw", pinScrews, [0, 1, 0], { len: 16, dia: 5 }),
      ],
      tools: ["screwdriver"],
    },
    { title: "Fold the leaf into its frame", detail: "Fold the two halves of the leaf together and lay it in, so it rests on the corner plates.", add: ["X"] },
    { title: "Turn the table over together", detail: "Lift it by the top, not by the legs, and stand it on all four legs.", pose: "+y", people: 2, warnings: ["two"] },
    { title: "Stick on the felt pads", detail: "Under the edges of the top by the seam, where the leaf rests when the table is pulled out.", fix: [at("glide", feltAt, [0, 1, 0], { name: "Felt pad", len: 3, dia: 20 })] },
  ];
  return { parts, steps };
}

/* ---------- chair ---------- */

function chair(): CustomParams {
  const W = 480, D = 510, H = 780, LS = 34, RT = 20;
  const x = W / 2 - LS / 2; // leg centres across
  const zf = D / 2 - LS / 2, zb = -(D / 2 - 40); // front legs, back legs at seat height
  const R0 = 390, R1 = 445; // seat rails, bottom and top
  const ry = (R0 + R1) / 2;
  const tilt = -0.06; // the back legs lean back
  const zbAt = (y: number) => zb - (y - ry) * Math.tan(-tilt); // centre of a back leg at height y
  const inner = x - LS / 2; // inside faces of the legs
  const parts: CustomPart[] = [
    {
      id: "FF",
      name: "Front frame",
      size: [W, R1, LS],
      pos: [0, R1 / 2, zf],
      material: "wood",
      pieces: [box([LS, R1, LS], [-x, 0, 0]), box([LS, R1, LS], [x, 0, 0]), box([2 * inner, R1 - R0, RT], [0, ry - R1 / 2, 0])],
    },
    {
      id: "BF",
      name: "Back frame",
      size: [W, H, LS],
      pos: [0, H / 2, zbAt(H / 2)],
      material: "wood",
      pieces: [box([LS, H, LS], [-x, 0, 0], [tilt, 0, 0]), box([LS, H, LS], [x, 0, 0], [tilt, 0, 0]), box([2 * inner, R1 - R0, RT], [0, ry - H / 2, zbAt(ry) - zbAt(H / 2)])],
    },
  ];
  const railZ0 = zbAt(ry) + LS / 2, railZ1 = zf - LS / 2;
  for (const g of [-1, 1]) parts.push({ id: `R${g < 0 ? 0 : 1}`, name: "Side rail", size: [RT, R1 - R0, railZ1 - railZ0], pos: [g * x, ry, (railZ0 + railZ1) / 2], material: "wood" });
  const cy = 165, cz0 = zbAt(cy) + LS / 2;
  for (const g of [-1, 1]) parts.push({ id: `C${g < 0 ? 0 : 1}`, name: "Stretcher", size: [18, 26, railZ1 - cz0], pos: [g * x, cy, (cz0 + railZ1) / 2], material: "wood" });
  const by = 675, bz = zbAt(by) + LS / 2 + 8;
  parts.push({
    id: "BR",
    name: "Backrest",
    size: [W - 10, 210, 16],
    pos: [0, by, bz],
    material: "wood",
    pieces: [box([150, 210, 14], [0, 0, 0], [tilt, 0, 0]), box([165, 210, 14], [-150, 0, 10], [tilt, 0.25, 0]), box([165, 210, 14], [150, 0, 10], [tilt, -0.25, 0])],
  });
  const sz0 = zbAt(R1 + 12) + LS / 2 + 4, sz1 = zf + LS / 2 + 4;
  const sw = W - 20, sd = sz1 - sz0;
  parts.push({
    id: "ST",
    name: "Seat",
    size: [sw, 26, sd],
    pos: [0, R1 + 13, (sz0 + sz1) / 2],
    material: "wood",
    pieces: [
      box([sw, 22, 30], [0, -2, -sd / 2 + 15]),
      box([sw, 22, 30], [0, -2, sd / 2 - 15]),
      box([30, 22, sd - 60], [-sw / 2 + 15, -2, 0]),
      box([30, 22, sd - 60], [sw / 2 - 15, -2, 0]),
      box([sw - 40, 26, sd - 40], [0, 0, 0], undefined, "soft"),
    ],
  });

  const nutAt = (g: number, z: number): Vec3 => [g * (inner + RT / 2 - RT), 418, z];
  const studs: CustomFix[] = [
    at("stud", [-1, 1].map((g): Vec3 => [g * x, ry, railZ1]), [0, 0, 1], { name: "Threaded stud", len: 60, dia: 8, on: "FF" }),
    at("stud", [-1, 1].map((g): Vec3 => [g * x, ry, railZ0]), [0, 0, -1], { name: "Threaded stud", len: 60, dia: 8, on: "BF" }),
  ];
  const nut = (g: number, z: number, on: string) => at("nut", [nutAt(g, z)], [-g, 0, 0], { name: "Connector nut", len: 20, dia: 20, on });
  const pads: Vec3[] = [-1, 1].flatMap((g) => [610, 720].map((y): Vec3 => [g * x, y, zbAt(y) + LS / 2]));
  // each bracket stands against the inside of a rail: the front one on the front frame's rail, the others on the side rails
  const bracketAt: Vec3[] = [[0, R1, zf - RT / 2 - 3], [-(x - RT / 2 - 3), R1, 20], [x - RT / 2 - 3, R1, 20]];
  const steps: CustomStep[] = [
    { title: "Stick the felt pads on the back legs", detail: "Two on the front of each back leg, between the pins, where the backrest will rest.", add: ["BF"], fix: [at("glide", pads, [0, 0, -1], { name: "Felt pad", len: 2, dia: 16 })], warnings: ["floor"] },
    {
      title: "Screw the threaded studs into the legs",
      detail: "Lay the front frame on its face on a rug and the back frame beside it. One stud into each leg by hand, all the way in.",
      add: ["FF"],
      fix: studs,
      pose: "-z",
    },
    { title: "Push a connector nut into a side rail", detail: "Into the hole near one end, with the slot facing the end. Then stand the rail on the stud in a front leg.", add: ["R0"], fix: [nut(-1, railZ1 - 30, "R0")] },
    { title: "Tighten the side rail onto its stud", detail: "Turn the nut with the Allen key until the rail sits tight against the leg. Stop there, don't force it.", tools: ["allen"] },
    { title: "Fit the other side rail the same way", detail: "Connector nut in first, then onto the stud in the other front leg.", add: ["R1"], fix: [nut(1, railZ1 - 30, "R1")] },
    { title: "Tighten it with the Allen key", detail: "Just until it sits tight against the leg.", tools: ["allen"] },
    { title: "Slot in the stretchers", detail: "Their ends drop into the holes in the front legs. They are held once the back frame goes on.", add: ["C0", "C1"] },
    { title: "Push connector nuts into the free ends", detail: "One in the top end of each side rail, slots facing up.", fix: [nut(-1, railZ0 + 30, "R0"), nut(1, railZ0 + 30, "R1")] },
    { title: "Lay the back frame on top", detail: "Lower it so both studs and both stretchers find their holes.", from: { BF: [0, 0, -300] } },
    { title: "Tighten both and stand the chair up", detail: "Turn the two nuts with the Allen key, then turn the chair onto its legs.", tools: ["allen"], pose: "+y" },
    { title: "Hang the backrest on its pins", detail: "Hold it against the back legs and lower it so the four keyholes slip over the pins.", add: ["BR"], from: { BR: [0, 0, 250] } },
    { title: "Push the backrest down until it clicks", detail: "Press on both top corners at once. It locks onto the pins with a click." },
    { title: "Tighten all four connector nuts", detail: "Go round once more with the Allen key now that the backrest holds the legs in line.", tools: ["allen"] },
    {
      title: "Drive the two long screws in at the back",
      detail: "Turn the chair upside down on a covered table. One screw through each end of the back rail into the leg.",
      // in at an angle from the inside of the back rail, through its end into the leg
      fix: [-1, 1].map((g) => at("screw", [[g * (inner - 30), ry, zbAt(ry)]], [g, 0, 0], { len: 50, dia: 5 })),
      tools: ["screwdriver"],
      pose: "-y",
    },
    {
      title: "Screw the three brackets onto the seat",
      detail: "Lay the seat face down beside the chair. One bracket at the front and one on each side, one screw each.",
      add: ["ST"],
      fix: [at("angle", bracketAt, [0, 1, 0], { name: "Seat bracket", len: 40, dia: 20 }), at("screw", bracketAt.map(([a, , c]): Vec3 => (a === 0 ? [24, R1, c] : [a, R1, c + 24])), [0, 1, 0], { len: 12, dia: 4 })],
      tools: ["screwdriver"],
      from: { ST: [0, -260, 0] },
    },
    { title: "Lower the chair onto the seat", detail: "Line it up so each bracket sits against the inside of a rail." },
    { title: "Screw the side brackets to the rails", detail: "One screw through each side bracket into the rail.", fix: [-1, 1].map((g) => at("screw", [[g * (x - RT / 2 - 3), R1 - 26, 20]], [g, 0, 0], { len: 14, dia: 4 })), tools: ["screwdriver"] },
    { title: "Screw the front bracket to the front rail", detail: "The last screw. Then turn the chair over and stand it up.", fix: [at("screw", [[0, R1 - 26, zf - RT / 2 - 3]], [0, 0, 1], { len: 14, dia: 4 })], tools: ["screwdriver"] },
    { title: "Stand the chair up", detail: "Check it stands steady on all four legs.", pose: "+y" },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["SKANSNÄS", "SKANSNAS"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/skansnas-extendable-table/.test(slug)) return table(s);
    if (/skansnas-chair/.test(slug)) return chair();
    return null;
  },
};
export default family;

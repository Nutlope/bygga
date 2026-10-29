import type { PlanBuilder } from "../builder";
import { buildCustom } from "../custom";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartMaterial, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * HEMNES beds and benches, read from IKEA's manuals.
 *
 * Bed frame (90 and 160 wide, one manual each, the same steps): the headboard is put together on a rug, front up.
 * Cam bolts in the left post, the spindle section on dowels and a cam lock, the lower panel slid in on dowels and
 * cam locks, the right post on the same way, the crown on dowels with four long bolts up through the spindle section.
 * Two threaded rods go into the posts for the side rails. The footboard comes in one piece and gets its two rods.
 * The side rails go on with three dowels each end and a slotted plate and nut over each rod, tightened with the
 * spanner, then the slat supports are screwed inside the rails. The 90 has one cross bar; the 160 a centre beam on
 * two brackets and two cross bars. Slat stops hold a slatted base (sold separately).
 *
 * Daybed with 3 drawers: the pull-out bed is built first on the rug lying on its back (castors and runners on four
 * beams, the low long board with its slat strip, the beams and ends on dowels and cam bolts, the front panel on
 * top), stood up and given thirteen slats. The daybed: the back panel with its slat strip, the two ends on dowels,
 * barrel nuts and long bolts, glides with it upside down, the front rail on two clips, then it is turned over and
 * gets fourteen slats, two of them on L plates. Two people push the pull-out bed in, the caps go on on push-in
 * dowels, and the three drawers (cam bolts and cam locks, bottom slid in, runners, knob) slide into the pull-out bed.
 *
 * Bench with shoe storage: the seat lies upside down for its two rails, the left side frame goes on with barrel nuts
 * and long bolts, two shoe rods are bolted to it, then it stands on that side while the other eight rods drop in,
 * a cardboard guide keeps them in line and the right side frame goes on top.
 */

const box = (id: string, name: string, lo: Vec3, hi: Vec3, material: PartMaterial = "board", o: Partial<CustomPart> = {}): CustomPart => ({
  id,
  name,
  size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
  pos: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2],
  material,
  ...o,
});
/** A piece of a part, from its corners in product mm, relative to the part's centre. */
const piece = (c: Vec3, lo: Vec3, hi: Vec3, shape: PartPiece["shape"] = "box"): PartPiece => ({
  shape,
  size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
  pos: [(lo[0] + hi[0]) / 2 - c[0], (lo[1] + hi[1]) / 2 - c[1], (lo[2] + hi[2]) / 2 - c[2]],
});
const fix = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const spread = (a: number, b: number, n: number) => Array.from({ length: n }, (_, i) => (n === 1 ? (a + b) / 2 : a + ((b - a) * i) / (n - 1)));
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const LR = [-1, 1] as const;

/* ---------- bench with shoe storage ---------- */

function shoeBench(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const P = 45, capT = 30, xs = W / 2 - 30; // side frames: posts 45 square under a 60 wide cap
  const xi = xs - P / 2; // inner face of the side frames
  const zp = D / 2 - 22 - P / 2; // posts' centres front and back
  const seatT = 30, seatY = 470, apronH = 60;
  const ys = { seat: seatY - seatT - apronH, up: 290, low: 120 }; // rail under the seat, the two rod rungs
  const parts: CustomPart[] = [];
  for (const g of LR) {
    const c: Vec3 = [g * xs, H / 2, 0];
    const lo = (x0: number, y0: number, z0: number): Vec3 => [g * xs + x0, y0, z0];
    parts.push({
      ...box(g < 0 ? "SL" : "SR", "Side frame", [g * xs - 30, 0, -D / 2], [g * xs + 30, H, D / 2], "wood"),
      pieces: [
        piece(c, lo(-P / 2, 0, zp - P / 2), lo(P / 2, H - capT, zp + P / 2)),
        piece(c, lo(-P / 2, 0, -zp - P / 2), lo(P / 2, H - capT, -zp + P / 2)),
        piece(c, lo(-30, H - capT, -D / 2), lo(30, H, D / 2)),
        piece(c, lo(-12, ys.seat, -zp + P / 2), lo(12, ys.seat + apronH, zp - P / 2)),
        piece(c, lo(-12, ys.up - 20, -zp + P / 2), lo(12, ys.up + 20, zp - P / 2)),
        piece(c, lo(-12, ys.low - 20, -zp + P / 2), lo(12, ys.low + 20, zp - P / 2)),
      ],
    });
  }
  parts.push(box("T", "Seat", [-xi, seatY - seatT, -D / 2 + 10], [xi, seatY, D / 2 - 10], "wood"));
  for (const g of LR) parts.push(box(g < 0 ? "AB" : "AF", "Seat rail", [-xi, seatY - seatT - apronH, g * zp - 10], [xi, seatY - seatT, g * zp + 10], "wood"));
  const rodZ = spread(-zp + 40, zp - 40, 5);
  const rods: string[] = [];
  for (const [li, y] of [ys.up, ys.low].entries())
    rodZ.forEach((z, i) => {
      const id = `R${li}${i}`;
      rods.push(id);
      parts.push({ ...box(id, "Shoe rod", [-xs + 12, y - 8, z - 8], [xs - 12, y + 8, z + 8], "metal"), shape: "cyl" });
    });
  const bolted = ["R00", "R10"]; // the back rod of each level holds the frame square
  const loose = rods.filter((r) => !bolted.includes(r));
  const apronY = seatY - seatT - apronH / 2;
  const sideBolts = (g: number) => [
    fix("nut", LR.map((h): Vec3 => [g * (xi - 25), seatY - seatT - apronH, h * zp]), [0, 1, 0], { name: "Barrel nut", len: 14, dia: 10 }),
    ...LR.map((h) => fix("bolt", [[g * (xs + P / 2), apronY, h * zp]], [-g, 0, 0], { len: 80, dia: 6, mate: h < 0 ? "AB" : "AF" })),
  ];
  const rodBolts = (g: number) => fix("bolt", [ys.up, ys.low].map((y): Vec3 => [g * (xs + 12), y, rodZ[0]]), [-g, 0, 0], { len: 40, dia: 6 });
  const steps: CustomStep[] = [
    {
      title: "Screw the seat rails under the seat",
      detail: "Lay the seat upside down on a rug, set a rail along each long edge and drive two screws through each into the seat.",
      add: ["T", "AB", "AF"],
      fix: LR.map((h) => fix("screw", [-xi / 2, xi / 2].map((x): Vec3 => [x, seatY - seatT - apronH, h * zp]), [0, 1, 0], { len: 70, dia: 5, on: h < 0 ? "AB" : "AF", mate: "T" })),
      tools: ["allen"],
      pose: "-y",
      warnings: ["floor"],
      from: { AB: [0, 200, 0], AF: [0, 200, 0] },
    },
    {
      title: "Bolt on the left side frame",
      detail: "Push a barrel nut into each rail end, slot turned to the bolt, then two long bolts through the posts. Hand tight for now.",
      add: ["SL"],
      fix: sideBolts(-1),
      tools: ["allen", "flathead"],
      from: { SL: [-300, 0, 0] },
    },
    {
      title: "Bolt two shoe rods to the side frame",
      detail: "One rod into each rung, at the back. The bolt goes through the frame into the end of the rod; check the rod end has its thread insert.",
      add: bolted,
      fix: [rodBolts(-1)],
      tools: ["allen"],
      from: Object.fromEntries(bolted.map((r) => [r, [500, 0, 0] as Vec3])),
    },
    {
      title: "Stand it on the left side and drop in the rods",
      detail: "Tip it onto the left side frame. The other eight rods go straight down into the holes in the rungs.",
      add: loose,
      pose: "+x",
      from: Object.fromEntries(loose.map((r) => [r, [700, 0, 0] as Vec3])),
    },
    {
      title: "Slide the cardboard guide over the rods",
      detail: "The sheet from the box with the holes keeps the rod tops in line while you fit the other side.",
    },
    {
      title: "Lower the right side frame on",
      detail: "Guide every rod into its hole as it goes down.",
      add: ["SR"],
      from: { SR: [400, 0, 0] },
    },
    {
      title: "Bolt the right side frame to the seat rails",
      detail: "Barrel nuts in, then two long bolts. Tighten all four now.",
      fix: sideBolts(1),
      tools: ["allen", "flathead"],
    },
    { title: "Bolt the two rods to the right side frame", detail: "Through the frame into the same two rods as on the other side.", fix: [rodBolts(1)], tools: ["allen"] },
    { title: "Pull out the guide and stand it up", detail: "Lift the cardboard off the rods and throw it away, then turn the bench onto its feet.", pose: "+y" },
  ];
  return { parts, steps };
}

/* ---------- bed frame ---------- */

function bedFrame(s: ProductSpec): CustomParams {
  const wide = /160|140|180/.test(s.slug ?? s.variant);
  const M = Number(/(\d{2,3})\s*(?:-x-|\s*[x×]\s*)200/.exec(`${s.slug} ${s.variant}`)?.[1] ?? 90) * 10; // mattress width
  const W = Math.max(s.size.w * 10, M + 120), D = s.size.d * 10, H = s.size.h * 10;
  const P = (W - M) / 2; // posts
  const X = M / 2; // inner faces of the posts, the side rails' inner faces
  const crownT = 30, footH = 660;
  const zh = -D / 2 + P / 2, zf = D / 2 - P / 2; // headboard and footboard centre planes
  const zhi = -D / 2 + P, zfi = D / 2 - P; // their inner faces at the posts
  const railY0 = 150, railY1 = 330, railT = 22;
  const supY = 260; // top of the slat supports
  const ladY0 = 720, ladY1 = H - crownT;
  const spindles = wide ? 12 : 4;
  const parts: CustomPart[] = [];
  // headboard: two posts, the spindle section, the lower panel and the crown
  for (const g of LR) parts.push(box(g < 0 ? "HL" : "HR", "Headboard post", [g < 0 ? -X - P : X, 0, -D / 2], [g < 0 ? -X : X + P, H - crownT, -D / 2 + P], "wood"));
  const ladC: Vec3 = [0, (ladY0 + ladY1) / 2, zh];
  parts.push({
    ...box("HS", "Spindle section", [-X, ladY0, zh - 15], [X, ladY1, zh + 15], "wood"),
    pieces: [
      piece(ladC, [-X, ladY1 - 80, zh - 15], [X, ladY1, zh + 15]),
      piece(ladC, [-X, ladY0, zh - 15], [X, ladY0 + 70, zh + 15]),
      ...spread(-X + M / (spindles + 1), X - M / (spindles + 1), spindles).map((x) => piece(ladC, [x - 22, ladY0 + 70, zh - 10], [x + 22, ladY1 - 80, zh + 10])),
    ],
  });
  parts.push(box("HP", "Headboard panel", [-X, railY0, zh - 9], [X, ladY0, zh + 9]));
  parts.push(box("HC", "Crown", [-W / 2 - 10, H - crownT, -D / 2 - 10], [W / 2 + 10, H, -D / 2 + P + 10], "wood"));
  // footboard: comes in one piece
  const fc: Vec3 = [0, footH / 2, zf];
  parts.push({
    ...box("F", "Footboard", [-W / 2 - 10, 0, D / 2 - P - 10], [W / 2 + 10, footH, D / 2 + 10], "wood"),
    pieces: [
      piece(fc, [-X - P, 0, D / 2 - P], [-X, footH - crownT, D / 2]),
      piece(fc, [X, 0, D / 2 - P], [X + P, footH - crownT, D / 2]),
      piece(fc, [-W / 2 - 10, footH - crownT, D / 2 - P - 10], [W / 2 + 10, footH, D / 2 + 10]),
      piece(fc, [-X, footH - crownT - 90, zf - 15], [X, footH - crownT, zf + 15]),
      piece(fc, [-X, railY0, zf - 9], [X, footH - crownT - 90, zf + 9]),
      ...(wide ? [piece(fc, [-30, railY0, zf - 15], [30, footH - crownT - 90, zf + 15])] : []),
    ],
  });
  // side rails and slat supports
  for (const g of LR) {
    const xr0 = g < 0 ? -X - railT : X, xr1 = g < 0 ? -X : X + railT;
    parts.push(box(g < 0 ? "RL" : "RR", "Side rail", [xr0, railY0, zhi], [xr1, railY1, zfi]));
    const xs0 = g < 0 ? -X : X - 25, xs1 = g < 0 ? -X + 25 : X;
    parts.push(box(g < 0 ? "SL" : "SR", "Slat support", [xs0, supY - 30, zhi + 10], [xs1, supY, zfi - 10], wide ? "metal" : "wood"));
  }
  // what holds the slats up in the middle
  const barY0 = supY - 30, barZ = wide ? [-(D / 2 - P) / 2, (D / 2 - P) / 2] : [0];
  if (wide) parts.push(box("CB", "Centre beam", [-30, barY0 - 70, zh + 9], [30, barY0, zf - 9], "wood"));
  barZ.forEach((z, i) => parts.push(box(`X${i}`, "Cross bar", [-X + 25, barY0, z - 15], [X - 25, supY, z + 15], "metal")));
  parts.push({ ...box("SB", "Your slatted base", [-X + 5, supY, zhi + 15], [X - 5, supY + 20, zfi - 15], "wood"), extra: true });

  const rodY = (railY0 + railY1) / 2;
  const camYs = [ladY0 + 40, railY0 + 80, (railY0 + ladY0) / 2, ladY0 - 80];
  const postCams = (g: number) => fix("camScrew", camYs.map((y): Vec3 => [g * X, y, zh]), [g, 0, 0], { len: 34, dia: 6, on: g < 0 ? "HL" : "HR" });
  const ladDowels = (g: number) => fix("dowel", [ladY0 + 20, ladY1 - 30].map((y): Vec3 => [g * X, y, zh]), [g, 0, 0], { len: 40, dia: 8, on: "HS", mate: g < 0 ? "HL" : "HR" });
  const panelDowels = (g: number) => fix("dowel", spread(railY0 + 40, ladY0 - 40, 4).map((y): Vec3 => [g * X, y, zh]), [g, 0, 0], { len: 40, dia: 8, on: "HP", mate: g < 0 ? "HL" : "HR" });
  const ladLock = (g: number) => fix("cam", [[g * (X - 30), ladY0 + 40, zh + 15]], [0, 0, -1], { dia: 15, on: "HS" });
  const panelLocks = (g: number) => fix("cam", camYs.slice(1).map((y): Vec3 => [g * (X - 30), y, zh + 9]), [0, 0, -1], { dia: 15, on: "HP" });
  const railEnd = (g: number, head: boolean) => {
    const z = head ? zhi : zfi;
    const zd = head ? -1 : 1;
    const x = g * (X + railT / 2);
    return [
      fix("dowel", [railY0 + 30, rodY + 50, railY1 - 30].map((y): Vec3 => [x, y, z]), [0, 0, zd], { len: 40, dia: 10, on: g < 0 ? "RL" : "RR", mate: head ? (g < 0 ? "HL" : "HR") : "F" }),
      fix("plate", [[x, rodY, z - zd * 3]], [0, 0, zd], { name: "Slotted plate", len: 3, dia: 40 }),
      fix("nut", [[x, rodY, z - zd * 25]], [0, 0, zd], { len: 10, dia: 13 }),
    ];
  };
  const steps: CustomStep[] = [
    {
      title: "Screw cam bolts into the left post",
      detail: "Lay the headboard parts on a rug, front up. Four cam bolts into the inside of the left post.",
      add: ["HL"],
      fix: [postCams(-1)],
      tools: ["screwdriver"],
      pose: "+z",
      warnings: ["floor"],
    },
    { title: "Tap two dowels into the spindle section", detail: "Into its left end.", fix: [ladDowels(-1)], tools: ["hammer"], wait: ["HS"] },
    {
      title: "Join the spindle section to the post",
      detail: "Push it onto the dowels and cam bolt, then turn its cam lock clockwise.",
      add: ["HS"],
      fix: [ladLock(-1)],
      tools: ["screwdriver"],
      from: { HS: [300, 0, 0] },
    },
    { title: "Tap four dowels into the lower panel", detail: "Into its left end.", fix: [panelDowels(-1)], tools: ["hammer"], wait: ["HP"] },
    {
      title: "Slide the lower panel in",
      detail: "Its top edge runs in the groove under the spindle section. Push it all the way to the post.",
      add: ["HP"],
      from: { HP: [600, 0, 0] },
    },
    { title: "Lock the panel with three cam locks", detail: "Arrows towards the post, then turn them clockwise.", fix: [panelLocks(-1)], tools: ["screwdriver"] },
    { title: "Screw cam bolts into the right post", detail: "Four, like the left one.", fix: [postCams(1)], tools: ["screwdriver"], wait: ["HR"] },
    { title: "Tap six dowels into the free ends", detail: "Two in the spindle section and four in the lower panel.", fix: [ladDowels(1), panelDowels(1)], tools: ["hammer"] },
    {
      title: "Push the right post on",
      detail: "Onto the dowels and cam bolts, then lock the spindle section with its cam lock.",
      add: ["HR"],
      fix: [ladLock(1)],
      tools: ["screwdriver"],
      from: { HR: [300, 0, 0] },
    },
    { title: "Lock the panel at the right post", detail: "Three cam locks, clockwise until tight.", fix: [panelLocks(1)], tools: ["screwdriver"] },
    {
      title: "Put the crown on",
      detail: "Six dowels into the top ends of the posts and the spindle section, then press the crown on.",
      add: ["HC"],
      fix: [fix("dowel", [...LR.map((g) => g * (X + P / 2)), ...spread(-X + 150, X - 150, 4)].map((x): Vec3 => [x, H - crownT, zh]), [0, 1, 0], { len: 40, dia: 8, mate: "HC" })],
      tools: ["hammer"],
      from: { HC: [0, 300, 0] },
    },
    {
      title: "Bolt the crown down",
      detail: "Four long bolts up through the spindle section into the crown, from between the spindles.",
      fix: [fix("bolt", spread(-X + M / (spindles + 1) / 2, X - M / (spindles + 1) / 2, 4).map((x): Vec3 => [x, ladY1 - 80, zh]), [0, 1, 0], { len: 100, dia: 6, on: "HS", mate: "HC" })],
      tools: ["allen"],
    },
    {
      title: "Screw a threaded rod into each post",
      detail: "Into the inside of the posts, by hand, until half of it is showing. The side rails hang on these.",
      fix: [fix("stud", LR.map((g): Vec3 => [g * (X + railT / 2), rodY, zhi]), [0, 0, -1], { name: "Threaded rod", len: 70, dia: 10 })],
    },
    ...(wide
      ? []
      : [{ title: "Tap in two glides", detail: "Hammer one into the bottom of each headboard post.", fix: [fix("glide", LR.map((g): Vec3 => [g * (X + P / 2), 0, zh]), [0, 1, 0], { len: 8, dia: 30 })], tools: ["hammer" as const] }]),
    {
      title: "Screw the rods into the footboard",
      detail: "Lay the footboard on the rug, inside up, and screw a threaded rod into each post the same way.",
      add: ["F"],
      fix: [fix("stud", LR.map((g): Vec3 => [g * (X + railT / 2), rodY, zfi]), [0, 0, 1], { name: "Threaded rod", len: 70, dia: 10, on: "F" })],
      pose: "-z",
      from: { F: [0, 0, 400] },
    },
    ...(wide
      ? []
      : [{ title: "Tap two glides into the footboard", detail: "One into the bottom of each post.", fix: [fix("glide", LR.map((g): Vec3 => [g * (X + P / 2), 0, zf]), [0, 1, 0], { len: 8, dia: 30 })], tools: ["hammer" as const] }]),
    {
      title: "Hang the first side rail on the footboard",
      detail: "Stand the footboard up. Three dowels into the rail end, the slotted plate over the rod, push the rail on and tighten the nut with the spanner.",
      add: ["RL"],
      fix: railEnd(-1, false),
      people: 2,
      pose: "+y",
      tools: ["wrench", "hammer"],
      from: { RL: [0, 0, 600] },
    },
    { title: "Hang the other rail on the footboard", detail: "The same way, on the other post.", add: ["RR"], fix: railEnd(1, false), people: 2, tools: ["wrench", "hammer"], from: { RR: [0, 0, 600] } },
    {
      title: "Join the headboard to the rails",
      detail: "Three dowels into each free rail end, then one person holds the headboard while the other guides the rails onto the rods. Tighten both nuts.",
      fix: [...railEnd(-1, true), ...railEnd(1, true)],
      people: 2,
      tools: ["wrench", "hammer"],
      warnings: ["two"],
    },
    {
      title: "Screw the slat supports inside the rails",
      detail: "At the height that suits your slatted base. Eight screws in each.",
      add: ["SL", "SR"],
      fix: LR.map((g) => fix("screw", spread(zhi + 120, zfi - 120, 8).map((z): Vec3 => [g * (X - 25), supY - 15, z]), [g, 0, 0], { len: 30, dia: 4, on: g < 0 ? "SL" : "SR" })),
      tools: ["screwdriver"],
    },
  ];
  if (wide) {
    steps.push(
      {
        title: "Screw the beam brackets on",
        detail: "One in the middle of the headboard and one of the footboard, low down inside. Three screws each.",
        fix: [
          fix("plate", [[0, barY0 - 35, zh + 9]], [0, 0, -1], { name: "Beam bracket", len: 4, dia: 80, on: "HP" }),
          fix("plate", [[0, barY0 - 35, zf - 9]], [0, 0, 1], { name: "Beam bracket", len: 4, dia: 80, on: "F" }),
          fix("screw", [-25, 0, 25].map((x): Vec3 => [x, barY0 - 75, zh + 13]), [0, 0, -1], { len: 16, dia: 4, on: "HP" }),
          fix("screw", [-25, 0, 25].map((x): Vec3 => [x, barY0 - 75, zf - 13]), [0, 0, 1], { len: 16, dia: 4, on: "F" }),
        ],
        tools: ["screwdriver"],
      },
      {
        title: "Lay the centre beam in",
        detail: "Slide the metal sleeve onto its end first, then drop it into the head bracket and push it into the foot bracket.",
        add: ["CB"],
        fix: [fix("connector", [[0, barY0 - 35, zf - 300]], [0, 0, 1], { name: "Beam sleeve", len: 80, dia: 70, on: "CB" })],
        from: { CB: [0, 300, 0] },
      },
      {
        title: "Lay the two cross bars across",
        detail: "Pull each one out until it reaches both slat supports, set it over the beam, and screw it to the beam.",
        add: ["X0", "X1"],
        fix: [fix("screw", barZ.map((z): Vec3 => [0, supY, z]), [0, -1, 0], { len: 12, dia: 5, mate: "CB" })],
        tools: ["screwdriver"],
        from: { X0: [0, 300, 0], X1: [0, 300, 0] },
      },
      {
        title: "Screw the cross bars to the supports",
        detail: "One screw at the end of each bar, down into the slat support. Check the beam and bars run straight, not crooked.",
        fix: [fix("screw", barZ.map((z): Vec3 => [X - 40, supY, z]), [0, -1, 0], { len: 12, dia: 5, mate: "SR" })],
        tools: ["screwdriver"],
        check: "square",
      },
    );
  } else {
    steps.push(
      {
        title: "Lay the cross bar across the middle",
        detail: "Pull it out until it reaches both slat supports and screw one end down with two screws.",
        add: ["X0"],
        fix: [fix("screw", [[-X + 40, supY, -8], [-X + 40, supY, 8]], [0, -1, 0], { len: 12, dia: 5 })],
        tools: ["screwdriver"],
        from: { X0: [0, 300, 0] },
      },
      { title: "Screw the other end down", detail: "One screw into the other slat support.", fix: [fix("screw", [[X - 40, supY, 0]], [0, -1, 0], { len: 12, dia: 5 })], tools: ["screwdriver"] },
    );
  }
  const stops = wide ? 8 : 4;
  steps.push({
    title: "Bolt on the slat stops",
    detail: "Only for a slatted base that lies loose: they keep it from sliding. One bolt each, on top of the supports.",
    fix: LR.flatMap((g) => {
      const on = g < 0 ? "SL" : "SR";
      const zs = spread(zhi + 60, zfi - 60, stops / 2);
      return [
        fix("clip", zs.map((z): Vec3 => [g * (X - 12), supY, z]), [0, -1, 0], { name: "Slat stop", len: 15, dia: 25, on }),
        fix("bolt", zs.map((z): Vec3 => [g * (X - 12), supY + 23, z]), [0, -1, 0], { len: 30, dia: 6, mate: on }),
      ];
    }),
    tools: ["allen"],
  });
  steps.push({ title: "Lay in your slatted base", detail: "It is sold separately. Lay it on the supports and the cross bars.", add: ["SB"] });
  return { parts, steps };
}

/* ---------- daybed with 3 drawers ---------- */

function daybed(s: ProductSpec): CustomParams {
  const mattresses = /mattress/i.test(`${s.variant} ${s.slug ?? ""}`);
  const L = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10; // 2090 x 830 x 890
  const Z = D / 2, et = 45, X = L / 2, xi = X - et; // end panels 45 thick
  const capT = 25, EH = H - capT;
  const SY = 400, ST = 18; // the daybed's slats sit on its strip and front rail at 40 cm
  const zb = -Z + 20; // inside face of the back panel
  const parts: CustomPart[] = [
    box("BP", "Back panel", [-xi, 150, -Z], [xi, EH, zb]),
    box("EL", "End panel", [-X, 0, -Z], [-xi, EH, Z]),
    box("ER", "End panel", [xi, 0, -Z], [X, EH, Z]),
    box("BS", "Slat strip", [-xi, SY - 20, zb], [xi, SY, zb + 20], "metal"),
    box("FR", "Front rail", [-xi, SY - 20, Z - 60], [xi, SY, Z - 30], "metal"),
    box("BC", "Back cap", [-xi, EH, -Z], [xi, H, -Z + 60], "wood"),
    box("CL", "End cap", [-X, EH, -Z], [-xi + 15, H, Z], "wood"),
    box("CR", "End cap", [xi - 15, EH, -Z], [X, H, Z], "wood"),
  ];
  const slatX = spread(-xi + 50, xi - 50, 14);
  slatX.forEach((x, i) => parts.push(box(`S${i}`, i === 0 || i === 13 ? "End slat" : "Slat", [x - 35, SY, zb + 5], [x + 35, SY + ST, Z - 35], "wood")));
  const ends = [0, 13];
  const mids = range(12).map((k) => k + 1);

  // the pull-out bed, pushed in under the daybed
  const PX = xi - 20, pt = 18, px = PX - pt;
  const PY0 = 50, PY1 = 300; // its boards; slats on top at 30 cm
  const PZ0 = -355, PZF = Z - 20; // back board's outer face, front panel's inner face
  const pzb = PZ0 + pt; // back board inner face
  const FT = 20; // front panel thickness
  const fc: Vec3 = [0, 225, PZF + FT / 2];
  const beamX = [-px + 25, -312, 312, px - 25];
  const bays = [(-px + 50 - 337) / 2, 0, (px - 50 + 337) / 2];
  const bayHalf = (px - 50 - 337) / 2;
  const openY0 = 60, openY1 = 290;
  parts.push(
    box("PB", "Long board", [-PX, PY0, PZ0], [PX, PY1, pzb]),
    box("PSB", "Slat strip", [-px, PY1 - 20, pzb], [px, PY1, pzb + 20], "metal"),
    {
      ...box("PF", "Front panel", [-PX, 20, PZF], [PX, 430, PZF + FT]),
      pieces: [
        piece(fc, [-PX, 20, PZF], [PX, openY0, PZF + FT]),
        piece(fc, [-PX, openY1, PZF], [PX, 360, PZF + FT]),
        piece(fc, [-PX, openY0, PZF], [-px + 50, openY1, PZF + FT]),
        piece(fc, [px - 50, openY0, PZF], [PX, openY1, PZF + FT]),
        piece(fc, [-337, openY0, PZF], [-287, openY1, PZF + FT]),
        piece(fc, [287, openY0, PZF], [337, openY1, PZF + FT]),
        piece(fc, [-PX, 360, PZF], [-PX + 260, 430, PZF + FT]),
        piece(fc, [PX - 260, 360, PZF], [PX, 430, PZF + FT]),
      ],
    },
    box("PSF", "Slat strip", [-px, PY1 - 20, PZF - 20], [px, PY1, PZF], "metal"),
    box("PEL", "Pull-out end", [-PX, PY0, pzb], [-px, PY1, PZF]),
    box("PER", "Pull-out end", [px, PY0, pzb], [PX, PY1, PZF]),
  );
  const beams = beamX.map((_, i) => `PD${i}`);
  beamX.forEach((x, i) => parts.push(box(beams[i], "Castor beam", [x - 25, 60, pzb], [x + 25, 140, PZF], "wood")));
  const pSlatX = spread(-px + 50, px - 50, 13);
  pSlatX.forEach((x, i) => parts.push(box(`P${i}`, "Slat", [x - 35, PY1, pzb + 8], [x + 35, PY1 + 16, PZF - 8], "wood")));
  const screwed = [1, 6, 11];
  const pinned = range(13).filter((i) => !screwed.includes(i));

  // three drawers: the front is the box front, the sides stand on it, the back goes on last
  const dy0 = 80, dy1 = 280, dz0 = -300, dw = bayHalf - 13, sT = 15;
  bays.forEach((cx, i) => {
    parts.push(
      box(`DF${i}`, "Drawer front", [cx - bayHalf + 4, openY0 + 4, PZF], [cx + bayHalf - 4, openY1 - 4, PZF + FT]),
      box(`DS${i}a`, "Drawer side", [cx - dw, dy0, dz0 + sT], [cx - dw + sT, dy1, PZF]),
      box(`DS${i}b`, "Drawer side", [cx + dw - sT, dy0, dz0 + sT], [cx + dw, dy1, PZF]),
      box(`DB${i}`, "Drawer bottom", [cx - dw + 8, dy0 + 10, dz0 + sT], [cx + dw - 8, dy0 + 14, PZF], "fiber"),
      box(`DK${i}`, "Drawer back", [cx - dw, dy0, dz0], [cx + dw, dy1, dz0 + sT]),
    );
  });
  if (mattresses)
    for (const k of [0, 1]) parts.push({ ...box(`M${k}`, "Mattress", [-1000, SY + ST + k * 120, zb + 5], [1000, SY + ST + (k + 1) * 120, zb + 805], "soft"), extra: true });

  const camScrew = { len: 34, dia: 6 };
  const bigCam = { dia: 15 };
  const smallCam = { name: "Cam lock", dia: 12, len: 12 };
  const stripScrews = (id: string, z: number, y: number, xs: number[]) => fix("screw", xs.map((x): Vec3 => [x, y, z]), [0, 1, 0], { len: 12, dia: 4, on: id });
  // cam bolts in a long board, pointing into the beams and the ends
  const boardBolts = (id: string, z: number, dz: number) =>
    fix("camScrew", [...beamX.map((x): Vec3 => [x, 100, z]), ...LR.flatMap((g) => [100, 250].map((y): Vec3 => [g * (PX - pt / 2), y, z]))], [0, 0, dz], { ...camScrew, on: id });
  const beamLocks = (z: number) => beams.map((id, i) => fix("cam", [[beamX[i], 140, z]], [0, -1, 0], { ...bigCam, on: id }));
  const endLocks = (z: number) => LR.map((g) => fix("cam", [100, 250].map((y): Vec3 => [g * px, y, z]), [g, 0, 0], { ...bigCam, on: g < 0 ? "PEL" : "PER" }));
  const runnerZ = (pzb + PZF) / 2;
  const sideCams = (z: number) => bays.flatMap((cx, i) => LR.map((g) => fix("cam", [dy0 + 40, dy1 - 40].map((y): Vec3 => [cx + g * (dw - sT), y, z]), [g, 0, 0], { ...smallCam, on: `DS${i}${g < 0 ? "a" : "b"}` })));
  const steps: CustomStep[] = [
    // the pull-out bed
    {
      title: "Screw the castors under the four beams",
      detail: "The pull-out bed comes first. Two castors under each beam near the ends, two screws each.",
      fix: beams.flatMap((id, i) => [
        fix("castor", [[beamX[i], 60, pzb + 70], [beamX[i], 60, PZF - 70]], [0, 1, 0], { len: 60, dia: 50, on: id }),
        fix("screw", [pzb + 45, pzb + 95, PZF - 95, PZF - 45].map((z): Vec3 => [beamX[i], 60, z]), [0, 1, 0], { len: 16, dia: 4, on: id }),
      ]),
      tools: ["screwdriver"],
      wait: beams,
      from: Object.fromEntries(beams.map((id) => [id, [0, 0, 500] as Vec3])),
    },
    {
      title: "Screw the right-hand runners onto the beams",
      detail: "The runners marked CR go on the right face of the first three beams, three screws each.",
      fix: beams.slice(0, 3).flatMap((id, i) => [
        fix("runner", [[beamX[i] + 25, 100, runnerZ]], [-1, 0, 0], { len: 650, dia: 30, on: id }),
        fix("screw", [-250, 0, 250].map((dz): Vec3 => [beamX[i] + 27, 100, runnerZ + dz]), [-1, 0, 0], { len: 10, dia: 3.5, on: id }),
      ]),
      tools: ["screwdriver"],
    },
    {
      title: "Screw the left-hand runners on",
      detail: "The CL runners on the left face of the other three beams.",
      fix: beams.slice(1).flatMap((id, k) => [
        fix("runner", [[beamX[k + 1] - 25, 100, runnerZ]], [1, 0, 0], { len: 650, dia: 30, on: id }),
        fix("screw", [-250, 0, 250].map((dz): Vec3 => [beamX[k + 1] - 27, 100, runnerZ + dz]), [1, 0, 0], { len: 10, dia: 3.5, on: id }),
      ]),
      tools: ["screwdriver"],
    },
    {
      title: "Tap dowels into the beam ends",
      detail: "Two into each end of every beam.",
      fix: beams.flatMap((id, i) => [
        fix("dowel", [75, 125].map((y): Vec3 => [beamX[i], y, pzb]), [0, 0, -1], { len: 30, dia: 8, on: id, mate: "PB" }),
        fix("dowel", [75, 125].map((y): Vec3 => [beamX[i], y, PZF]), [0, 0, 1], { len: 30, dia: 8, on: id, mate: "PF" }),
      ]),
      tools: ["hammer"],
    },
    {
      title: "Screw the slat strip onto the long board",
      detail: "Lay the long board on a rug: the pull-out bed is built lying on its back. Two screws at the ends of the strip.",
      add: ["PB", "PSB"],
      fix: [stripScrews("PSB", pzb + 10, PY1 - 20, LR.map((g) => g * (px - 30)))],
      tools: ["screwdriver"],
      pose: "+z",
      warnings: ["floor"],
      from: { PB: [0, 0, -300], PSB: [0, 0, 300] },
    },
    { title: "Screw the strip down along its length", detail: "Six more screws through the round holes.", fix: [stripScrews("PSB", pzb + 10, PY1 - 20, spread(-px + 250, px - 250, 6))], tools: ["screwdriver"] },
    { title: "Screw eight cam bolts into the long board", detail: "Into the holes in its inside face.", fix: [boardBolts("PB", pzb, 1)], tools: ["screwdriver"] },
    {
      title: "Stand the beams on the long board",
      detail: "Castors towards the bottom edge, pushed onto the dowels and cam bolts.",
      add: beams,
      from: Object.fromEntries(beams.map((id) => [id, [0, 0, 400] as Vec3])),
    },
    { title: "Lock the beams", detail: "One cam lock in each beam, turned clockwise until tight.", fix: beamLocks(pzb + 30), tools: ["screwdriver"] },
    {
      title: "Tap dowels into the two ends",
      detail: "Three into each long edge of both pull-out ends.",
      fix: LR.flatMap((g) => {
        const on = g < 0 ? "PEL" : "PER";
        return [
          fix("dowel", [120, 175, 230].map((y): Vec3 => [g * (PX - pt / 2), y, pzb]), [0, 0, -1], { len: 30, dia: 8, on, mate: "PB" }),
          fix("dowel", [120, 175, 230].map((y): Vec3 => [g * (PX - pt / 2), y, PZF]), [0, 0, 1], { len: 30, dia: 8, on, mate: "PF" }),
        ];
      }),
      tools: ["hammer"],
      wait: ["PEL", "PER"],
    },
    { title: "Stand the ends on", detail: "Onto the dowels and cam bolts at both ends of the long board.", add: ["PEL", "PER"], from: { PEL: [0, 0, 400], PER: [0, 0, 400] } },
    { title: "Lock the ends", detail: "Two cam locks in each end.", fix: endLocks(pzb + 30), tools: ["screwdriver"] },
    {
      title: "Screw the slat strip onto the front panel",
      detail: "Lay the front panel on the rug, inside up. Two screws at the ends of the strip, then six along it.",
      fix: [stripScrews("PSF", PZF - 10, PY1 - 20, [...LR.map((g) => g * (px - 30)), ...spread(-px + 250, px - 250, 6)])],
      wait: ["PF", "PSF"],
      tools: ["screwdriver"],
    },
    { title: "Screw eight cam bolts into the front panel", detail: "Into the holes beside the openings.", fix: [boardBolts("PF", PZF, -1)], tools: ["screwdriver"] },
    {
      title: "Lower the front panel on",
      detail: "Turn it over and lower it onto the beams and ends. A strap round it holds it while you lock it.",
      add: ["PF", "PSF"],
      from: { PF: [0, 0, 500], PSF: [0, 0, 500] },
      people: 2,
    },
    { title: "Lock the front panel to the ends", detail: "Four cam locks in the ends.", fix: endLocks(PZF - 30), tools: ["screwdriver"] },
    { title: "Lock it to the beams", detail: "Four cam locks in the beams, then take the strap off.", fix: beamLocks(PZF - 30), tools: ["screwdriver"] },
    {
      title: "Screw three slats across",
      detail: "Use the thirteen shorter slats here. Three go in now, near each end and in the middle, with a screw up through the strip at each end.",
      add: screwed.map((i) => `P${i}`),
      fix: [fix("screw", screwed.flatMap((i) => [pzb + 10, PZF - 10].map((z): Vec3 => [pSlatX[i], PY1 - 20, z])), [0, 1, 0], { len: 12, dia: 4 })],
      tools: ["screwdriver"],
      from: Object.fromEntries(screwed.map((i) => [`P${i}`, [0, 0, 500] as Vec3])),
    },
    {
      title: "Push pins into the other ten slats",
      detail: "One into each end.",
      fix: pinned.map((i) => fix("pin", [pzb + 10, PZF - 10].map((z): Vec3 => [pSlatX[i], PY1, z]), [0, 1, 0], { name: "Slat pin", len: 12, dia: 8, on: `P${i}` })),
      wait: pinned.map((i) => `P${i}`),
    },
    {
      title: "Stand it up and lay the slats in",
      detail: "Turn the pull-out bed onto its castors and set the pins into the holes in both strips.",
      add: pinned.map((i) => `P${i}`),
      pose: "+y",
    },
    // the daybed
    {
      title: "Screw the slat strip onto the back panel",
      detail: "Now the daybed. Lay the back panel on the rug, inside up. Two screws at the ends of the strip.",
      add: ["BP", "BS"],
      fix: [stripScrews("BS", zb + 10, SY - 20, LR.map((g) => g * (xi - 30)))],
      pose: "+z",
      tools: ["screwdriver"],
      from: { BP: [0, 0, -400], BS: [0, 0, 300] },
    },
    { title: "Screw the strip down along its length", detail: "Six more screws through the round holes.", fix: [stripScrews("BS", zb + 10, SY - 20, spread(-xi + 250, xi - 250, 6))], tools: ["screwdriver"] },
    {
      title: "Tap dowels into the end panels",
      detail: "Three into the inside of each end panel, along the back edge.",
      fix: LR.map((g) => fix("dowel", [300, 520, 740].map((y): Vec3 => [g * xi, y, -Z + 10]), [g, 0, 0], { len: 30, dia: 8, on: g < 0 ? "EL" : "ER", mate: "BP" })),
      tools: ["hammer"],
      wait: ["EL", "ER"],
    },
    {
      title: "Bolt the end panels to the back panel",
      detail: "Raise each end panel onto its dowels. A barrel nut into the back panel, then two long bolts through each end panel. Hand tight first.",
      add: ["EL", "ER"],
      fix: [
        fix("nut", LR.flatMap((g) => [250, 650].map((y): Vec3 => [g * (xi - 40), y, zb])), [0, 0, -1], { name: "Barrel nut", len: 14, dia: 10, on: "BP" }),
        ...LR.map((g) => fix("bolt", [250, 650].map((y): Vec3 => [g * X, y, -Z + 10]), [-g, 0, 0], { len: 110, dia: 6, on: g < 0 ? "EL" : "ER", mate: "BP" })),
      ],
      tools: ["allen", "flathead"],
      people: 2,
      warnings: ["two"],
      from: { EL: [0, 0, 400], ER: [0, 0, 400] },
    },
    {
      title: "Tip it upside down and fit the glides",
      detail: "Press a glide into the bottom of each end panel corner.",
      fix: [fix("glide", LR.flatMap((g) => [-Z + 30, Z - 30].map((z): Vec3 => [g * (X - et / 2), 0, z])), [0, 1, 0], { len: 8, dia: 25 })],
      pose: "-y",
      people: 2,
    },
    {
      title: "Clip the front rail in",
      detail: "Screw a clip to the inside of each end panel at the front, two screws each, then snap the metal rail into the clips.",
      add: ["FR"],
      fix: [
        ...LR.map((g) => fix("clip", [[g * xi, SY - 10, Z - 45]], [g, 0, 0], { name: "Rail clip", len: 30, dia: 25, on: g < 0 ? "EL" : "ER" })),
        ...LR.map((g) => fix("screw", [SY - 30, SY + 10].map((y): Vec3 => [g * (xi - 2), y, Z - 45]), [g, 0, 0], { len: 20, dia: 4.2, on: g < 0 ? "EL" : "ER" })),
      ],
      tools: ["screwdriver"],
    },
    { title: "Turn it the right way up", detail: "Two people, lifting by the end panels.", pose: "+y", people: 2 },
    {
      title: "Screw the L plates onto the two end slats",
      detail: "The two slats with holes. A plate under the front end of each, two screws.",
      fix: ends.flatMap((i) => [
        fix("plate", [[slatX[i], SY, Z - 45]], [0, 1, 0], { name: "L plate", len: 3, dia: 50, on: `S${i}` }),
        fix("screw", [-15, 15].map((dx): Vec3 => [slatX[i] + dx, SY, Z - 80]), [0, 1, 0], { len: 12, dia: 4, on: `S${i}` }),
      ]),
      tools: ["screwdriver"],
      wait: ends.map((i) => `S${i}`),
    },
    {
      title: "Screw the end slats in",
      detail: "One beside each end panel: a screw into the strip at the back, and one through the L plate into the front rail.",
      add: ends.map((i) => `S${i}`),
      fix: [
        fix("screw", ends.map((i): Vec3 => [slatX[i], SY + ST, zb + 10]), [0, -1, 0], { len: 12, dia: 4, mate: "BS" }),
        fix("screw", ends.map((i): Vec3 => [slatX[i] + 25, SY - 20, Z - 45]), [0, 1, 0], { len: 12, dia: 4, on: "FR" }),
      ],
      tools: ["screwdriver"],
      from: { S0: [0, 400, 0], S13: [0, 400, 0] },
    },
    {
      title: "Push a pin into twelve slats",
      detail: "One pin into the back end of each of the other slats.",
      fix: mids.map((i) => fix("pin", [[slatX[i], SY, zb + 10]], [0, 1, 0], { name: "Slat pin", len: 12, dia: 8, on: `S${i}` })),
      wait: mids.map((i) => `S${i}`),
    },
    {
      title: "Lay in the twelve slats",
      detail: "Pin into the strip at the back, a screw up through the front rail at the front. Don't sit on it until every slat is in.",
      add: mids.map((i) => `S${i}`),
      fix: [fix("screw", mids.map((i): Vec3 => [slatX[i], SY - 20, Z - 45]), [0, 1, 0], { len: 12, dia: 4, on: "FR" })],
      tools: ["screwdriver"],
    },
    {
      title: "Push the pull-out bed in",
      detail: "One person lifts the front of the daybed a little while the other rolls the pull-out bed in under it until it hooks on.",
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Tap in the push-in dowels",
      detail: "Seventeen along the top edges of the back panel and both end panels.",
      fix: [
        fix("dowel", spread(-xi + 100, xi - 100, 9).map((x): Vec3 => [x, EH, -Z + 10]), [0, 1, 0], { name: "Push-in dowel", len: 24, dia: 10, on: "BP", mate: "BC" }),
        ...LR.map((g) => fix("dowel", spread(-Z + 80, Z - 80, 4).map((z): Vec3 => [g * (X - et / 2), EH, z]), [0, 1, 0], { name: "Push-in dowel", len: 24, dia: 10, on: g < 0 ? "EL" : "ER", mate: g < 0 ? "CL" : "CR" })),
      ],
      tools: ["hammer"],
      warnings: ["hand"],
    },
    { title: "Press the back cap on", detail: "Line it up over the dowels and press it down along its length.", add: ["BC"], from: { BC: [0, 300, 0] } },
    {
      title: "Press the end caps on",
      detail: "One person each end. Hook the front of the cap over the end panel, then press it down onto the dowels.",
      add: ["CL", "CR"],
      people: 2,
      from: { CL: [0, 300, 0], CR: [0, 300, 0] },
    },
    // the drawers
    {
      title: "Screw cam bolts into the drawer fronts and backs",
      detail: "The drawers are built standing on their fronts on the rug. Four cam bolts in each front and each back.",
      add: bays.map((_, i) => `DF${i}`),
      fix: bays.flatMap((cx, i) => [
        fix("camScrew", LR.flatMap((g) => [dy0 + 40, dy1 - 40].map((y): Vec3 => [cx + g * (dw - sT / 2), y, PZF])), [0, 0, -1], { ...camScrew, on: `DF${i}` }),
        fix("camScrew", LR.flatMap((g) => [dy0 + 40, dy1 - 40].map((y): Vec3 => [cx + g * (dw - sT / 2), y, dz0 + sT])), [0, 0, 1], { ...camScrew, on: `DK${i}` }),
      ]),
      tools: ["screwdriver"],
      wait: bays.map((_, i) => `DK${i}`),
      from: Object.fromEntries(bays.map((_, i) => [`DF${i}`, [0, 0, 500] as Vec3])),
    },
    {
      title: "Stand the sides on and lock them",
      detail: "Both sides onto the cam bolts in the front, then turn two cam locks in each side.",
      add: bays.flatMap((_, i) => [`DS${i}a`, `DS${i}b`]),
      fix: sideCams(PZF - 30),
      tools: ["screwdriver"],
      from: Object.fromEntries(bays.flatMap((_, i) => [[`DS${i}a`, [0, 0, -500] as Vec3], [`DS${i}b`, [0, 0, -500] as Vec3]])),
    },
    {
      title: "Slide the drawer bottoms in",
      detail: "Down the grooves in the sides, smooth face up.",
      add: bays.map((_, i) => `DB${i}`),
      from: Object.fromEntries(bays.map((_, i) => [`DB${i}`, [0, 0, -700] as Vec3])),
    },
    {
      title: "Put the backs on",
      detail: "Lower each back onto the sides and turn its four cam locks.",
      add: bays.map((_, i) => `DK${i}`),
      fix: sideCams(dz0 + sT + 30),
      tools: ["screwdriver"],
      from: Object.fromEntries(bays.map((_, i) => [`DK${i}`, [0, 0, -500] as Vec3])),
    },
    {
      title: "Screw the runners onto the drawers",
      detail: "DL on the left side and DR on the right, three screws each.",
      fix: [
        ...LR.map((g) => fix("runner", bays.map((cx): Vec3 => [cx + g * dw, 100, (dz0 + PZF) / 2]), [g, 0, 0], { len: 650, dia: 30 })),
        ...LR.map((g) => fix("screw", bays.flatMap((cx) => [-250, 0, 250].map((dz): Vec3 => [cx + g * (dw + 2), 100, (dz0 + PZF) / 2 + dz])), [-g, 0, 0], { len: 10, dia: 3.5 })),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw a knob onto each drawer",
      detail: "The bolt goes through the front from the inside.",
      fix: [
        ...bays.map((cx, i) => fix("knob", [[cx, (openY0 + openY1) / 2, PZF + FT + 4]], [0, 0, -1], { len: 30, dia: 40, on: `DF${i}` })),
        // the bolt starts inside the drawer, far enough from the knob's point to keep its own place
        ...bays.map((cx, i) => fix("bolt", [[cx, (openY0 + openY1) / 2, PZF - 3]], [0, 0, 1], { name: "Knob bolt", len: 35, dia: 4, on: `DF${i}` })),
      ],
      tools: ["screwdriver"],
    },
    { title: "Slide the drawers into the pull-out bed", detail: "Set the drawer runners onto the ones on the beams and push until they close.", kind: "drawer" },
  ];
  if (mattresses) steps.push({ title: "Lay the mattresses on", detail: "Both on the daybed; pull the bed out and lay one on each to sleep two.", add: ["M0", "M1"] });
  return { parts, steps };
}

/** HEMNES guides drawn in this file; returns false for any product it doesn't build. Wired in from hemnes.ts. */
export function hemnesBeds(b: PlanBuilder, s: ProductSpec): boolean {
  let recipe: CustomParams | null = null;
  switch (s.slug) {
    case "hemnes-bench-shoe-storage-85-x-32-x-65":
      recipe = shoeBench(s);
      break;
    case "hemnes-bed-frame-90-x-200":
    case "hemnes-bed-frame-160-x-200":
      recipe = bedFrame(s);
      break;
    case "hemnes-day-bed-frame-3-drawers-80-x-200":
    case "hemnes-day-bed-w-3-drawers-2-mattresses-80-x-200":
      recipe = daybed(s);
      break;
  }
  if (!recipe) return false;
  buildCustom(b, { ...s, custom: recipe });
  return true;
}

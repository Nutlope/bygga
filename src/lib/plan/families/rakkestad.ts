import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, ProductSpec, Vec3 } from "../../types";
import type { PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * RAKKESTAD, read from its three manuals. Every carcass is built lying on its front on a rug: hinge plates (or door
 * tracks) and door stops go on the loose panels first, the top and bottom are joined to one side with long connector
 * screws, the shelves and rails go in on dowels, then the other side. The hardboard back is nailed on in halves,
 * feet are pressed in, two people stand it up and it is fixed to the wall with the brackets in the box. The 2-door
 * has a low fixed shelf; the 3-door has a divider with three shelves on the right for its third door. The sliding
 * door model has a full-width low shelf with a divider above and below it (on cam locks), tracks in the top and
 * bottom, and two doors on rollers.
 */

const T = 18; // panels
const TB = 3; // hardboard back
const TD = 18; // doors
const PL = 60; // plinth

type Kind = "hinged" | "sliding";
const kindOf = (s: ProductSpec): Kind | null => {
  const t = `${s.slug ?? ""} ${s.variant}`.toLowerCase();
  if (!/wardrobe/.test(t)) return null;
  return /sliding/.test(t) ? "sliding" : "hinged";
};

function fx(kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on?: string, o: Partial<CustomFix> = {}): CustomFix {
  return { kind, count: at.length, at, dir, on, ...o };
}

/** n points spread along a set of segments, by length (nails round the edge of a back panel). */
function along(segs: [Vec3, Vec3][], n: number): Vec3[] {
  const lens = segs.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  const total = lens.reduce((x, y) => x + y, 0);
  const out: Vec3[] = [];
  segs.forEach(([a, b], i) => {
    const k = i === segs.length - 1 ? n - out.length : Math.max(1, Math.round((n * lens[i]) / total));
    for (let j = 0; j < k && out.length < n; j++) {
      const t = (j + 0.5) / k;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  });
  return out;
}

interface Box {
  W: number;
  H: number;
  D: number;
  z0: number; // back of the carcass (front of the hardboard)
  z1: number; // front of the carcass
  cz: number;
  cd: number;
}
function boxOf(s: ProductSpec, doorsInside: boolean): Box {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const z0 = -D / 2 + TB, z1 = doorsInside ? D / 2 : D / 2 - TD - 2;
  return { W, H, D, z0, z1, cz: (z0 + z1) / 2, cd: z1 - z0 };
}

/** The shell every model shares: two sides, top, bottom, a plinth and a back rail along the floor. */
function shell(b: Box, parts: CustomPart[]) {
  const { W, H, cz, cd, z0, z1 } = b;
  const iw = W - 2 * T;
  parts.push({ id: "SL", name: "Side panel", size: [T, H, cd], pos: [-W / 2 + T / 2, H / 2, cz] });
  parts.push({ id: "SR", name: "Side panel", size: [T, H, cd], pos: [W / 2 - T / 2, H / 2, cz] });
  parts.push({ id: "TOP", name: "Top panel", size: [iw, T, cd], pos: [0, H - T / 2, cz] });
  parts.push({ id: "BOT", name: "Bottom panel", size: [iw, T, cd], pos: [0, PL + T / 2, cz] });
  parts.push({ id: "PF", name: "Plinth", size: [iw, PL, T], pos: [0, PL / 2, z1 - 20 - T / 2] });
  parts.push({ id: "PB", name: "Plinth", size: [iw, PL, T], pos: [0, PL / 2, z0 + T / 2] });
}

// fittings shared by both builds
const CONN = { len: 50, dia: 7, name: "Connector screw" };
/** Connector screws through a side (sx -1 left, 1 right) into the end of a panel, near its front and back. */
function sideScrews(b: Box, sx: number, ys: number[], perJoint = 2, zs?: number[]): CustomFix {
  const z = zs ?? (perJoint === 1 ? [b.cz] : [b.z0 + 50, b.z1 - 50]);
  return fx("bolt", ys.flatMap((y) => z.map((zz): Vec3 => [sx * (b.W / 2), y, zz])), [-sx, 0, 0], sx < 0 ? "SL" : "SR", CONN);
}
/** Dowels in both ends of a panel that sits between the sides. */
function endDowels(b: Box, id: string, y: number, zs: number[]): CustomFix[] {
  const xi = b.W / 2 - T;
  return [-1, 1].map((sx) => fx("dowel", zs.map((z): Vec3 => [sx * xi, y, z]), [-sx, 0, 0], id));
}
/** Feet pressed into the bottom edges: one at each corner of the sides, and along each plinth. */
function feet(b: Box, perRail: number): { sides: Vec3[]; rails: Vec3[] } {
  const xs = b.W / 2 - T / 2;
  const sides = [-1, 1].flatMap((sx) => [b.z0 + 40, b.z1 - 40].map((z): Vec3 => [sx * xs, 0, z]));
  const rails = ["PF", "PB"].flatMap((id) => {
    const z = id === "PF" ? b.z1 - 20 - T / 2 : b.z0 + T / 2;
    return Array.from({ length: perRail }, (_, i): Vec3 => [perRail === 1 ? 0 : ((i ? 1 : -1) * b.W) / 4, 0, z]);
  });
  return { sides, rails };
}
/** Wall fixing: a bracket at each end of the top, screwed to the wall and down into the top. Everything is in the box. */
function wallSteps(b: Box): CustomStep[] {
  const { W, H, D } = b;
  const xs = [-1, 1].map((sx) => sx * (W / 2 - 160));
  const wallZ = -D / 2;
  return [
    {
      title: "Mark the top on the wall",
      detail: "Stand it where it's going and draw a pencil line along the top edge on the wall.",
      tools: ["pencil"],
      warnings: ["wall"],
    },
    {
      title: "Screw the wall brackets to the wall",
      detail: "Pull the wardrobe out again. Hold each bracket on the line, mark, drill, plug, then screw it on through a washer. Plugs and screws in the box suit solid walls; get others for yours if it isn't.",
      fix: [
        fx("plug", xs.map((x): Vec3 => [x, H - 30, wallZ - 10]), [0, 0, -1], undefined, { included: true }),
        fx("bracket", xs.map((x): Vec3 => [x, H - 30, wallZ - 2]), [0, 0, -1]),
        fx("washer", xs.map((x): Vec3 => [x, H - 30, wallZ + 1]), [0, 0, -1]),
        fx("screw", xs.map((x): Vec3 => [x, H - 30, wallZ + 3]), [0, 0, -1], undefined, { len: 50, dia: 5, included: true }),
      ],
      tools: ["drill", "screwdriver", "pencil"],
      kind: "anchor",
      wall: true,
    },
    {
      title: "Push it back and screw the brackets to the top",
      detail: "Slide it against the wall under the brackets. One screw and a washer through each bracket into the top.",
      fix: [
        fx("washer", xs.map((x): Vec3 => [x, H + 4, b.z0 + 40]), [0, -1, 0], "TOP"),
        fx("screw", xs.map((x): Vec3 => [x, H + 5, b.z0 + 40]), [0, -1, 0], "TOP", { len: 16, dia: 4 }),
      ],
      tools: ["screwdriver"],
      wall: true,
      warnings: ["tip"],
    },
  ];
}

// ---------- hinged doors (2 or 3) ----------

function hinged(s: ProductSpec): { recipe: CustomParams; stages: Stages } {
  const b = boxOf(s, false);
  const { W, H, z0, z1, cz, cd } = b;
  const three = W > 1000;
  const n = three ? 3 : 2;
  const parts: CustomPart[] = [];
  shell(b, parts);
  const iw = W - 2 * T;
  const xd = Math.round(W / 6); // the 3-door's divider, behind the joint between its second and third doors
  const dw = (W - (n + 1) * 3) / n;
  const doorX = (i: number) => -W / 2 + 3 + dw / 2 + i * (dw + 3);
  const dy0 = PL + 3, dy1 = H - 3, dh = dy1 - dy0;
  const shelfIds: string[] = [];
  if (three) {
    parts.push({ id: "DIV", name: "Divider", size: [T, H - PL - 2 * T, cd], pos: [xd, (PL + T + H - T) / 2, cz] });
    const sw = W / 2 - T - (xd + T / 2);
    [0.27, 0.49, 0.71].forEach((f, k) => {
      parts.push({ id: `SH${k}`, name: "Shelf", size: [sw, T, cd - 10], pos: [xd + T / 2 + sw / 2, Math.round(H * f), cz - 5] });
      shelfIds.push(`SH${k}`);
    });
  } else {
    parts.push({ id: "SH0", name: "Fixed shelf", size: [iw, T, cd - 10], pos: [0, Math.round(H * 0.22), cz - 5] });
    shelfIds.push("SH0");
  }
  const railX0 = -W / 2 + T, railX1 = three ? xd - T / 2 : W / 2 - T;
  const railY = H - T - 70;
  parts.push({ id: "RAIL", name: "Clothes rail", size: [railX1 - railX0, 25, 25], pos: [(railX0 + railX1) / 2, railY, cz], shape: "cyl", material: "metal" });
  // the back: the wide part folds in two; the 3-door has a third piece behind its shelves
  const backs: { id: string; x0: number; x1: number }[] = three
    ? [
        { id: "BK0", x0: -W / 2, x1: (-W / 2 + xd) / 2 },
        { id: "BK1", x0: (-W / 2 + xd) / 2, x1: xd },
        { id: "BK2", x0: xd, x1: W / 2 },
      ]
    : [
        { id: "BK0", x0: -W / 2, x1: 0 },
        { id: "BK1", x0: 0, x1: W / 2 },
      ];
  for (const k of backs) parts.push({ id: k.id, name: "Back panel", size: [k.x1 - k.x0 - 1, H - 2, TB], pos: [(k.x0 + k.x1) / 2, H / 2 + 1, z0 - TB / 2], material: "fiber" });
  const doorIds = Array.from({ length: n }, (_, i) => `DR${i}`);
  doorIds.forEach((id, i) => parts.push({ id, name: "Door", size: [dw, dh, TD], pos: [doorX(i), (dy0 + dy1) / 2, z1 + 2 + TD / 2] }));

  // which way each door opens: hinged on the left side, on the divider (3-door), or on the right side
  const hingeX = (i: number) => (i === 0 ? -W / 2 + T : three && i === 1 ? xd - T / 2 : W / 2 - T);
  const hingeHost = (i: number) => (i === 0 ? "SL" : three && i === 1 ? "DIV" : "SR");
  const hingeSide = (i: number) => (i === 0 ? -1 : 1); // the door's hinged edge, -1 left
  const hys = [dy0 + 110, (dy0 + dy1) / 2, dy1 - 110];
  const plate = (i: number) => hys.map((y): Vec3 => [hingeX(i), y, z1 - 37]);
  const plates = doorIds.map((_, i) => fx("angle", plate(i), [hingeSide(i) < 0 ? -1 : 1, 0, 0], hingeHost(i), { name: "Mounting plate" }));
  const plateScrews = doorIds.map((_, i) => fx("screw", plate(i).flatMap((p): Vec3[] => [[p[0], p[1] - 24, p[2]], [p[0], p[1] + 24, p[2]]]), [hingeSide(i), 0, 0], hingeHost(i), { len: 14, dia: 4 }));
  // the doors meet in the middle of the pair: a door stop there in the top and the bottom
  const xm = three ? doorX(0) + dw / 2 + 1.5 : 0;
  const stops = [fx("clip", [-15, 15].map((dx): Vec3 => [xm + dx, H - T, z1 - 15]), [0, 1, 0], "TOP", { name: "Door stop" }), fx("clip", [-15, 15].map((dx): Vec3 => [xm + dx, PL + T, z1 - 15]), [0, -1, 0], "BOT", { name: "Door stop" })];
  // the angle bracket ties the bottom to the plinth, in the middle
  const angleAt: Vec3 = [0, PL - 12, z1 - 20 - T - 2];
  const nailsFor = (k: { x0: number; x1: number }, count: number) => {
    const z = z0 - TB;
    const ys = [PL + T / 2, H - T / 2, ...shelfIds.filter((id) => {
      const p = parts.find((q) => q.id === id)!;
      return p.pos[0] - p.size[0] / 2 < k.x1 && p.pos[0] + p.size[0] / 2 > k.x0;
    }).map((id) => parts.find((q) => q.id === id)!.pos[1])];
    const segs: [Vec3, Vec3][] = ys.map((y): [Vec3, Vec3] => [[k.x0 + 20, y, z], [k.x1 - 20, y, z]]);
    for (const x of [-W / 2 + T / 2, W / 2 - T / 2, ...(three ? [xd] : [])]) if (x > k.x0 - 1 && x < k.x1 + 1) segs.push([[x, PL + 40, z], [x, H - 40, z]]);
    return fx("nail", along(segs, count), [0, 0, 1], undefined, { len: 20, dia: 1.6 });
  };
  const ft = feet(b, three ? 2 : 1);
  const kn = doorIds.map((_, i): Vec3 => [doorX(i) - hingeSide(i) * (dw / 2 - 35), Math.round(H * 0.52), z1 + 2 + TD]);
  const cups = (i: number) => hys.map((y): Vec3 => [doorX(i) + hingeSide(i) * (dw / 2 - 22), y, z1 + 2]);

  const steps: CustomStep[] = [
    {
      title: three ? "Screw the hinge plates to the sides and the divider" : "Screw the hinge plates to both sides",
      detail: "Lay the panels flat on a rug, inside up. Three plates on each, two screws in each plate, at the front edge.",
      fix: [...plates, ...plateScrews],
      tools: ["screwdriver"],
      pose: "-z",
      warnings: ["floor"],
    },
    { title: "Knock the door stops into the top and the bottom", detail: "Two in each, in the small holes near the front edge, where the doors will meet.", fix: stops, tools: ["hammer"] },
  ];
  const divDowels: CustomFix[] = [fx("dowel", [z0 + 110, z1 - 110].map((z): Vec3 => [xd, PL + T, z]), [0, 1, 0], "DIV"), fx("dowel", [z0 + 110, z1 - 110].map((z): Vec3 => [xd, H - T, z]), [0, -1, 0], "DIV")];
  if (three) {
    steps.push({ title: "Tap dowels into the three shelves", detail: "Three in each end of every shelf.", fix: shelfIds.flatMap((id) => endsOfShelf(parts, id, [z0 + 100, cz, z1 - 100])), wait: shelfIds, from: Object.fromEntries(shelfIds.map((id) => [id, [300, 0, 0] as Vec3])), tools: ["hammer"] });
    steps.push({
      title: "Screw the middle shelf to the divider",
      detail: "Stand the divider on its front edge. Two connector screws through it into the shelf: leave them a turn loose for now.",
      add: ["DIV", "SH1"],
      from: { DIV: [-300, 0, 0] },
      fix: [fx("bolt", [z0 + 60, z1 - 60].map((z): Vec3 => [xd - T / 2, parts.find((p) => p.id === "SH1")!.pos[1], z]), [1, 0, 0], "DIV", CONN)],
      tools: ["allen"],
    });
  }
  steps.push({ title: "Tap dowels into the top and the bottom", detail: "Two in each end of both panels.", fix: [...endDowels(b, "TOP", H - T / 2, [z0 + 100, z1 - 100]), ...endDowels(b, "BOT", PL + T / 2, [z0 + 100, z1 - 100])], tools: ["hammer"] });
  steps.push({ title: "Screw the angle bracket under the bottom", detail: "In the middle of the front edge, on the underside, with one short screw.", fix: [fx("angle", [angleAt], [0, 1, 0], "BOT"), fx("screw", [[angleAt[0] - 8, PL, angleAt[2] - 8]], [0, 1, 0], "BOT", { len: 14, dia: 4 })], tools: ["screwdriver"] });
  if (three) {
    steps.push({ title: "Screw the bottom to the divider", detail: "Two dowels into the end of the divider, then push the bottom on and drive two connector screws up through it into the divider.", add: ["BOT"], fix: [divDowels[0], fx("bolt", [z0 + 60, z1 - 60].map((z): Vec3 => [xd, PL, z]), [0, 1, 0], "BOT", CONN)], tools: ["allen"] });
    steps.push({ title: "Screw the top to the divider", detail: "The same at the other end: two dowels, then two connector screws.", add: ["TOP"], fix: [divDowels[1], fx("bolt", [z0 + 60, z1 - 60].map((z): Vec3 => [xd, H, z]), [0, -1, 0], "TOP", CONN)], tools: ["allen"] });
    steps.push({ title: "Slide in the other two shelves", detail: "Push them onto the divider's holes, dowels first.", add: ["SH0", "SH2"] });
    steps.push({ title: "Fit the right side", detail: "Line it up with all the dowels and press it on. Two connector screws into the top and bottom near the front.", add: ["SR"], fix: [sideScrews(b, 1, [H - T / 2, PL + T / 2], 1, [z1 - 50])], tools: ["allen"] });
    steps.push({ title: "Screw the right side on", detail: "Four more: the back of the top and the bottom, and both ends of the middle shelf.", fix: [sideScrews(b, 1, [H - T / 2, PL + T / 2], 1, [z0 + 50]), sideScrews(b, 1, [parts.find((p) => p.id === "SH1")!.pos[1]])], tools: ["allen"] });
    steps.push({ title: "Tighten the divider screws", detail: "Now turn the two screws in the divider until their heads sit flush.", tools: ["allen"] });
  } else {
    steps.push({ title: "Screw the top to a side", detail: "Stand the side on its front edge. Push the top onto the dowels, then two connector screws through the side.", add: ["SL", "TOP"], fix: [sideScrews(b, -1, [H - T / 2])], tools: ["allen"] });
    steps.push({ title: "Screw on the bottom", detail: "At the other end, the same way.", add: ["BOT"], fix: [sideScrews(b, -1, [PL + T / 2])], tools: ["allen"] });
    const y = parts.find((p) => p.id === "SH0")!.pos[1];
    steps.push({ title: "Tap dowels into the fixed shelf", detail: "Three in each end.", fix: endsOfShelf(parts, "SH0", [z0 + 100, cz, z1 - 100]), tools: ["hammer"] });
    steps.push({ title: "Screw in the fixed shelf", detail: "Low down, in the holes near the bottom. Two connector screws through the side.", add: ["SH0"], fix: [sideScrews(b, -1, [y])], tools: ["allen"] });
  }
  const pf = parts.find((p) => p.id === "PF")!, pb = parts.find((p) => p.id === "PB")!;
  steps.push({ title: "Press feet onto the plinths", detail: three ? "Two under each plinth." : "One in the middle of each plinth's bottom edge.", fix: [fx("glide", ft.rails, [0, 1, 0], undefined, { name: "Foot" })] });
  steps.push({ title: "Tap dowels into the plinths", detail: "One in each end.", fix: [...endDowels(b, "PF", PL / 2 - 15, [pf.pos[2]]), ...endDowels(b, "PB", PL / 2 - 15, [pb.pos[2]])], tools: ["hammer"] });
  if (three) {
    steps.push({ title: "Push the plinths in", detail: "Under the bottom, onto the right side's dowels. The front one goes back from the edge.", add: ["PF", "PB"] });
    steps.push({ title: "Fit the left side", detail: "One of you holds the carcass steady while the other lines the side up with every dowel. Four connector screws: the top and the bottom.", add: ["SL"], fix: [sideScrews(b, -1, [H - T / 2, PL + T / 2])], tools: ["allen"], people: 2 });
    steps.push({ title: "Screw the plinth to the angle bracket", detail: "One short screw through the bracket into the front plinth.", fix: [fx("screw", [[angleAt[0] + 8, angleAt[1] - 8, z1 - 20 - T]], [0, 0, 1], "PF", { len: 14, dia: 4 })], tools: ["screwdriver"] });
  } else {
    steps.push({ title: "Push in the front plinth", detail: "Under the bottom, set back from the front edge.", add: ["PF"] });
    steps.push({ title: "Fit the back plinth and the other side", detail: "One of you holds the carcass while the other slides the back plinth in and lines the side up with every dowel.", add: ["PB", "SR"], people: 2 });
    steps.push({ title: "Screw the second side on", detail: "Two connector screws into the top first, then four into the bottom and the fixed shelf.", fix: [sideScrews(b, 1, [H - T / 2]), sideScrews(b, 1, [PL + T / 2, parts.find((p) => p.id === "SH0")!.pos[1]])], tools: ["allen"] });
    steps.push({ title: "Tighten the first screws", detail: "Turn the two screws in the top on the first side again until the heads sit flush.", tools: ["allen"] });
    steps.push({ title: "Screw the plinth to the angle bracket", detail: "One short screw through the bracket into the front plinth.", fix: [fx("screw", [[angleAt[0] + 8, angleAt[1] - 8, z1 - 20 - T]], [0, 0, 1], "PF", { len: 14, dia: 4 })], tools: ["screwdriver"] });
  }
  steps.push({
    title: three ? "Lay the back panels on" : "Unfold the back panel and lay it on",
    detail: "Its edges go into the rebates in the sides, top and bottom. Push it square so the gap is even all round.",
    add: backs.map((k) => k.id),
    check: "square",
  });
  if (three) {
    const right = backs[2], left = { x0: backs[0].x0, x1: backs[1].x1 };
    steps.push({ title: "Nail the corners and the joins", detail: "Use the nail holder so your fingers stay clear. One nail in each corner first, then twelve along the joins.", fix: [nailsFor(right, 14)], tools: ["hammer"] });
    steps.push({ title: "Nail the rest of the back", detail: "Every 15 cm or so, along all the edges and into the divider and shelves.", fix: [nailsFor(left, 44)], tools: ["hammer"] });
  } else {
    steps.push({ title: "Nail on one half", detail: "Fifteen nails along its edges and into the shelf. The nail holder keeps your fingers clear.", fix: [nailsFor(backs[0], 15)], tools: ["hammer"] });
    steps.push({ title: "Nail on the other half", detail: "Another fifteen, the same way.", fix: [nailsFor(backs[1], 15)], tools: ["hammer"] });
  }
  steps.push({ title: "Press feet into the sides", detail: "One at each corner of the bottom edges.", fix: [fx("glide", ft.sides, [0, 1, 0], undefined, { name: "Foot" })] });
  steps.push({ title: "Stand it up together", detail: "Two of you: walk it up from the top while the feet stay on the floor.", pose: "+y", people: 2, warnings: ["two"] });
  steps.push(...wallSteps(b));
  steps.push({
    title: "Screw in the clothes rail holders and drop the rail in",
    detail: three ? "In the wide part, one screw each, then the rail clicks down into them." : "One screw each, then the rail clicks down into them.",
    add: ["RAIL"],
    fix: [-1, 1].map((sx) => fx("hook", [[sx < 0 ? railX0 : railX1, railY + 10, cz]], [sx, 0, 0], sx < 0 ? "SL" : three ? "DIV" : "SR", { name: "Rail holder" })).concat([-1, 1].map((sx) => fx("screw", [[sx < 0 ? railX0 + 3 : railX1 - 3, railY + 34, cz]], [sx, 0, 0], sx < 0 ? "SL" : three ? "DIV" : "SR", { len: 14, dia: 4 }))),
    tools: ["screwdriver"],
  });
  steps.push({
    title: `Screw the hinges into the ${n} doors`,
    detail: "Lay the doors face down on a rug. Three hinges each, cup in the round hole, two screws.",
    fix: [...doorIds.map((id, i) => fx("hinge", cups(i), [0, 0, 1], id)), ...doorIds.map((id, i) => fx("screw", cups(i).flatMap((p): Vec3[] => [-16, 16].map((dy): Vec3 => [p[0] + hingeSide(i) * 18, p[1] + dy, p[2]])), [0, 0, 1], id, { len: 14, dia: 4 }))],
    tools: ["screwdriver"],
  });
  steps.push({ title: "Hang the doors", detail: "Hook each hinge onto its plate and press until it clicks, then tighten the screw on each hinge arm.", add: doorIds, tools: ["screwdriver"] });
  steps.push({ title: `Screw on the ${n} knobs`, detail: "One long screw from inside each door.", fix: [fx("knob", kn, [0, 0, -1]), fx("screw", kn.map((p): Vec3 => [p[0], p[1], z1 - 3]), [0, 0, 1], undefined, { len: 30, dia: 4 })], tools: ["screwdriver"] });
  if (three) {
    const d = doorX(2) - dw / 2 + 25;
    steps.push({ title: "Stick on the door bumpers", detail: "Inside the right-hand door, near its free edge, one high and one low.", fix: [fx("glide", [[d, dy1 - 150, z1 + 2], [d, dy0 + 150, z1 + 2]], [0, 0, 1], "DR2", { name: "Door bumper" })] });
  }
  steps.push({ title: "Line up the doors", detail: "The hinge screws move each door up and down, in and out, and sideways, until the gaps are even.", tools: ["screwdriver"] });
  const flat = (ids: string[]) => lay(b, parts, ids, "-z");
  return { recipe: { parts, steps }, stages: { 0: flat(["SL", "SR", "TOP", "BOT"]), [steps.findIndex((x) => /feet onto the plinths/.test(x.title))]: flat(["PF", "PB"]), [steps.findIndex((x) => /hinges into/.test(x.title))]: lay(b, parts, doorIds, "+y") } };
}

/** Dowels in both ends of a shelf: into the sides, or the 3-door's divider and right side. */
function endsOfShelf(parts: CustomPart[], id: string, zs: number[]): CustomFix[] {
  const p = parts.find((q) => q.id === id)!;
  const x0 = p.pos[0] - p.size[0] / 2, x1 = p.pos[0] + p.size[0] / 2;
  return [
    fx("dowel", zs.map((z): Vec3 => [x0, p.pos[1], z]), [1, 0, 0], id),
    fx("dowel", zs.map((z): Vec3 => [x1, p.pos[1], z]), [-1, 0, 0], id),
  ];
}

// ---------- sliding doors ----------

function sliding(s: ProductSpec): { recipe: CustomParams; stages: Stages } {
  const b = boxOf(s, true);
  const { W, H, z0, z1, cd } = b;
  const parts: CustomPart[] = [];
  shell(b, parts);
  const iw = W - 2 * T;
  // the doors run inside the front, so the shelves stop short of them
  const sd = cd - 70, sz = z0 + sd / 2;
  const ys = Math.round(H * 0.24);
  parts.push({ id: "SH", name: "Shelf", size: [iw, T, sd], pos: [0, ys, sz] });
  parts.push({ id: "DL", name: "Divider", size: [T, ys - T / 2 - (PL + T), sd], pos: [0, (PL + T + ys - T / 2) / 2, sz] });
  parts.push({ id: "DU", name: "Divider", size: [T, H - T - (ys + T / 2), sd], pos: [0, (ys + T / 2 + H - T) / 2, sz] });
  parts.push({ id: "RB", name: "Back rail", size: [iw, 80, T], pos: [0, H - T - 40, z0 + T / 2] });
  parts.push({ id: "RM", name: "Back rail", size: [iw, 80, T], pos: [0, ys + T / 2 + 40, z0 + T / 2] });
  // door tracks: two in the top, two in the bottom
  const tz = [z1 - 16, z1 - 44];
  tz.forEach((z, k) => {
    parts.push({ id: `TT${k}`, name: "Door track", size: [iw, 4, 10], pos: [0, H - T - 2, z], material: "metal" });
    parts.push({ id: `TB${k}`, name: "Door track", size: [iw, 4, 10], pos: [0, PL + T + 2, z], material: "metal" });
  });
  const railY = H - T - 70;
  const rails = [-1, 1].map((sx) => ({ id: `RAIL${sx < 0 ? 0 : 1}`, x0: sx < 0 ? -W / 2 + T : T / 2, x1: sx < 0 ? -T / 2 : W / 2 - T }));
  for (const r of rails) parts.push({ id: r.id, name: "Clothes rail", size: [r.x1 - r.x0, 25, 25], pos: [(r.x0 + r.x1) / 2, railY, sz], shape: "cyl", material: "metal" });
  const backs = [
    { id: "BK0", x0: -W / 2, x1: 0 },
    { id: "BK1", x0: 0, x1: W / 2 },
  ];
  for (const k of backs) parts.push({ id: k.id, name: "Back panel", size: [k.x1 - k.x0 - 1, H - 2, TB], pos: [(k.x0 + k.x1) / 2, H / 2 + 1, z0 - TB / 2], material: "fiber" });
  const dw = iw / 2 + 20, dy0 = PL + T + 6, dy1 = H - T - 6;
  const doors = [
    { id: "DR0", x: -W / 2 + T + dw / 2, z: tz[1] },
    { id: "DR1", x: W / 2 - T - dw / 2, z: tz[0] },
  ];
  for (const d of doors) parts.push({ id: d.id, name: "Sliding door", size: [dw, dy1 - dy0, TD], pos: [d.x, (dy0 + dy1) / 2, d.z] });

  const ft = feet(b, 2);
  const shelfEnds = endDowels(b, "SH", ys, [z0 + 100, sz, sz + sd / 2 - 100]);
  const divDowels = [fx("dowel", [z0 + 60, sz + sd / 2 - 60].map((z): Vec3 => [0, ys - T / 2, z]), [0, 1, 0], "DL"), fx("dowel", [z0 + 60, sz + sd / 2 - 60].map((z): Vec3 => [0, ys + T / 2, z]), [0, -1, 0], "DU")];
  const camZ = [z0 + 100, sz + sd / 2 - 100];
  const pf = parts.find((p) => p.id === "PF")!, pb = parts.find((p) => p.id === "PB")!;
  const rb = parts.find((p) => p.id === "RB")!, rm = parts.find((p) => p.id === "RM")!;
  const roll = (d: (typeof doors)[number], y: number) => [-1, 1].map((sx): Vec3 => [d.x + sx * (dw / 2 - 60), y, d.z]);
  const kn = doors.map((d, i): Vec3 => [d.x + (i ? 1 : -1) * (dw / 2 - 40), Math.round(H * 0.52), d.z + TD / 2]);
  const steps: CustomStep[] = [
    {
      title: "Tap dowels into the ends of the shelf",
      detail: "Lay it on a rug. Three in each end.",
      fix: shelfEnds,
      tools: ["hammer"],
      pose: "-z",
      warnings: ["floor"],
    },
    {
      title: "Fit the short divider under the shelf",
      detail: "Two dowels and two cam bolts in its end first (the bolts by hand, until they stop), then push it onto the middle of the shelf.",
      add: ["DL"],
      fix: [divDowels[0], fx("camScrew", camZ.map((z): Vec3 => [0, ys - T / 2, z]), [0, 1, 0], "DL")],
      tools: ["hammer"],
    },
    { title: "Lock it with two cam locks", detail: "Arrow towards the bolt, then turn clockwise until it pulls tight.", fix: [fx("cam", camZ.map((z): Vec3 => [-30, ys, z]), [1, 0, 0], "SH")], tools: ["screwdriver"] },
    {
      title: "Fit the tall divider on top of the shelf",
      detail: "The same way, on the other face of the shelf, over the short one.",
      add: ["DU"],
      fix: [divDowels[1], fx("camScrew", camZ.map((z): Vec3 => [0, ys + T / 2, z]), [0, -1, 0], "DU")],
      tools: ["hammer"],
    },
    { title: "Lock it with two cam locks", detail: "The same way.", fix: [fx("cam", camZ.map((z): Vec3 => [30, ys, z]), [-1, 0, 0], "SH")], tools: ["screwdriver"] },
    { title: "Tap dowels into the top and the bottom", detail: "Two in each end of both panels.", fix: [...endDowels(b, "TOP", H - T / 2, [z0 + 100, z1 - 100]), ...endDowels(b, "BOT", PL + T / 2, [z0 + 100, z1 - 100])], tools: ["hammer"] },
    { title: "Press the door tracks into the top and the bottom", detail: "Two in each panel, in the grooves along the front edge. Push them right in along their length.", add: ["TOP", "BOT", "TT0", "TT1", "TB0", "TB1"] },
    { title: "Screw the top and bottom to a side", detail: "Stand the left side on its front edge. Two connector screws into each.", add: ["SL"], fix: [sideScrews(b, -1, [H - T / 2, PL + T / 2])], tools: ["allen"] },
    { title: "Screw the shelf and dividers in", detail: "Slide the shelf unit in so the dividers meet the middle of the top and bottom. Two connector screws through the side into the shelf, two down through the top and one up through the bottom into the dividers.", fix: [sideScrews(b, -1, [ys], 2, [z0 + 50, sz + sd / 2 - 50]), fx("bolt", [z0 + 60, sz + sd / 2 - 60].map((z): Vec3 => [0, H, z]), [0, -1, 0], "TOP", CONN), fx("bolt", [[0, PL, sz]], [0, 1, 0], "BOT", CONN)], tools: ["allen"] },
    { title: "Tap dowels into the plinths", detail: "One in each end.", fix: [...endDowels(b, "PF", PL / 2 - 15, [pf.pos[2]]), ...endDowels(b, "PB", PL / 2 - 15, [pb.pos[2]])], tools: ["hammer"] },
    { title: "Push the plinths in and screw them to the side", detail: "Under the bottom. One connector screw into each plinth, and one more into the bottom of the short divider.", add: ["PF", "PB"], fix: [sideScrews(b, -1, [PL / 2 + 15], 1, [pf.pos[2]]), sideScrews(b, -1, [PL / 2 + 15], 1, [pb.pos[2]]), fx("bolt", [[0, PL, z0 + 60]], [0, 1, 0], "BOT", CONN)], tools: ["allen"] },
    { title: "Tap dowels into the back rails", detail: "One in each end.", fix: [...endDowels(b, "RB", rb.pos[1], [rb.pos[2]]), ...endDowels(b, "RM", rm.pos[1], [rm.pos[2]])], wait: ["RB", "RM"], from: { RB: [300, 0, 0], RM: [300, 0, 0] }, tools: ["hammer"] },
    { title: "Push the back rails onto the side", detail: "One under the top and one just above the shelf, at the back, onto the dowels.", add: ["RB", "RM"] },
    { title: "Fit the other side", detail: "Line it up with every dowel and press it on evenly.", add: ["SR"] },
    { title: "Screw the other side to the top and the shelf", detail: "Three connector screws.", fix: [sideScrews(b, 1, [H - T / 2]), sideScrews(b, 1, [ys], 1, [sz + 40])], tools: ["allen"] },
    { title: "Screw the other side to the bottom", detail: "Three connector screws: two into the bottom, one into the shelf's back end.", fix: [sideScrews(b, 1, [PL + T / 2]), sideScrews(b, 1, [ys], 1, [z0 + 50])], tools: ["allen"] },
    { title: "Screw the plinths to the other side", detail: "One connector screw into each.", fix: [sideScrews(b, 1, [PL / 2 + 15], 1, [pf.pos[2]]), sideScrews(b, 1, [PL / 2 + 15], 1, [pb.pos[2]])], tools: ["allen"] },
    {
      title: "Lay the back panel on",
      detail: "Unfold it over the back, edges in the rebates, and push it square.",
      add: ["BK0", "BK1"],
      check: "square",
    },
    {
      title: "Nail the corners and the fold",
      detail: "Use the nail holder so your fingers stay clear. One in each corner and along the fold first.",
      fix: [fx("nail", along([[[-W / 2 + 10, PL + 30, z0 - TB], [W / 2 - 10, PL + 30, z0 - TB]], [[0, PL + 60, z0 - TB], [0, H - 60, z0 - TB]]], 14), [0, 0, 1], undefined, { len: 20, dia: 1.6 })],
      tools: ["hammer"],
    },
    {
      title: "Nail all the way round",
      detail: "Every 15 cm or so along the edges, the shelf and both back rails.",
      fix: [fx("nail", along([[[-W / 2 + 9, PL + 60, z0 - TB], [-W / 2 + 9, H - 40, z0 - TB]], [[W / 2 - 9, PL + 60, z0 - TB], [W / 2 - 9, H - 40, z0 - TB]], [[-W / 2 + 40, H - 9, z0 - TB], [W / 2 - 40, H - 9, z0 - TB]], [[-W / 2 + 40, ys, z0 - TB], [W / 2 - 40, ys, z0 - TB]], [[-W / 2 + 40, H - T - 40, z0 - TB], [W / 2 - 40, H - T - 40, z0 - TB]]], 44), [0, 0, 1], undefined, { len: 20, dia: 1.6 })],
      tools: ["hammer"],
    },
    { title: "Press the feet in", detail: "One at each corner of the sides, two under each plinth.", fix: [fx("glide", [...ft.sides, ...ft.rails], [0, 1, 0], undefined, { name: "Foot" })] },
    { title: "Stand it up together", detail: "Two of you: walk it up from the top while the feet stay on the floor.", pose: "+y", people: 2, warnings: ["two"] },
    ...wallSteps(b),
    {
      title: "Hang the two clothes rails",
      detail: "Four rail holders, one screw each, then the rails drop in.",
      add: rails.map((r) => r.id),
      fix: [fx("hook", rails.flatMap((r): Vec3[] => [[r.x0, railY + 10, sz], [r.x1, railY + 10, sz]]), [0, 0, 0], undefined, { name: "Rail holder" }), fx("screw", rails.flatMap((r): Vec3[] => [[r.x0, railY + 30, sz], [r.x1, railY + 30, sz]]), [0, 0, 0], undefined, { len: 14, dia: 4 })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the rollers and guides onto the doors",
      detail: "Lay the doors on a rug. Two rollers along the bottom edge and two guides along the top of each, two screws each.",
      fix: [
        ...doors.map((d) => fx("roller", roll(d, dy0), [0, 1, 0], d.id)),
        ...doors.map((d) => fx("clip", roll(d, dy1), [0, -1, 0], d.id, { name: "Top guide" })),
        ...doors.map((d) => fx("screw", [...roll(d, dy0), ...roll(d, dy1)].flatMap((p): Vec3[] => [[p[0] - 25, p[1], p[2]], [p[0] + 25, p[1], p[2]]]), [0, 0, 0], d.id, { len: 14, dia: 4 })),
      ],
      tools: ["screwdriver"],
    },
    { title: "Hang the back door", detail: "Top first into the inner track, then lift it and set the rollers down into the bottom track.", add: ["DR0"], people: 1 },
    { title: "Hang the front door", detail: "The same in the outer tracks. Slide both doors to check they run freely.", add: ["DR1"] },
    { title: "Level the doors", detail: "Turn the screw on each bottom roller until the doors hang straight and meet the sides evenly.", tools: ["screwdriver"] },
    { title: "Screw on the knobs", detail: "One on each door, near its outer edge, a long screw from inside.", fix: [fx("knob", kn, [0, 0, -1]), fx("screw", kn.map((p): Vec3 => [p[0], p[1], p[2] - TD - 5]), [0, 0, 1], undefined, { len: 30, dia: 4 })], tools: ["screwdriver"] },
  ];
  // the rail holders and the screws through the door fittings go sideways or into the door
  const rh = steps.find((x) => /clothes rails/.test(x.title))!;
  rh.fix = rails.flatMap((r, i) => [
    fx("hook", [[r.x0, railY + 10, sz]], [-1, 0, 0], i ? "DU" : "SL", { name: "Rail holder" }),
    fx("hook", [[r.x1, railY + 10, sz]], [1, 0, 0], i ? "SR" : "DU", { name: "Rail holder" }),
    fx("screw", [[r.x0, railY + 30, sz]], [-1, 0, 0], i ? "DU" : "SL", { len: 14, dia: 4 }),
    fx("screw", [[r.x1, railY + 30, sz]], [1, 0, 0], i ? "SR" : "DU", { len: 14, dia: 4 }),
  ]);
  const df = steps.find((x) => /rollers and guides/.test(x.title))!;
  df.fix = df.fix!.map((f) => (f.kind === "screw" ? { ...f, dir: [0, f.at![0][1] < H / 2 ? 1 : -1, 0] as Vec3 } : f));
  // the screws above sit on the edges, so split top and bottom
  df.fix = df.fix.flatMap((f) => (f.kind === "screw" ? [-1, 1].map((sy) => ({ ...f, at: f.at!.filter((p) => Math.sign(p[1] - H / 2) === sy), dir: [0, -sy, 0] as Vec3 })).map((g) => ({ ...g, count: g.at.length })) : [f]));
  const idx = (re: RegExp) => steps.findIndex((x) => re.test(x.title));
  const flat = (ids: string[]) => lay(b, parts, ids, "-z");
  // the shelf-and-divider unit slides in on its own: its step adds nothing new, so it shows in place there
  return {
    recipe: { parts, steps },
    stages: { [idx(/^Tap dowels into the plinths/)]: flat(["PF", "PB"]), [idx(/rollers and guides/)]: lay(b, parts, ["DR0", "DR1"], "+y") },
  };
}

// ---------- laying loose panels on the floor ----------

type Stages = Record<number, { id: string; pos: Vec3; rot: Vec3 }[]>;

/** Spots on the floor beside the carcass for panels that get their fittings before they're joined. */
function lay(b: Box, parts: CustomPart[], ids: string[], pose: "-z" | "+y"): { id: string; pos: Vec3; rot: Vec3 }[] {
  let x = b.W / 2 + 200;
  const zFront = b.D / 2 + 200;
  return ids.map((id) => {
    const p = parts.find((q) => q.id === id)!;
    const thin = p.size.indexOf(Math.min(...p.size));
    if (pose === "-z") {
      // the floor is the product's front: turn the thin side onto it
      const rot: Vec3 = thin === 0 ? [0, Math.PI / 2, 0] : thin === 1 ? [Math.PI / 2, 0, 0] : [0, 0, 0];
      const wide = thin === 0 ? p.size[2] : p.size[0];
      const tall = thin === 1 ? p.size[2] : p.size[1];
      const pos: Vec3 = [x + wide / 2, tall / 2 + 20, b.D / 2 - p.size[thin] / 2];
      x += wide + 60;
      return { id, pos, rot };
    }
    // standing up: doors lie face down in front of it
    const pos: Vec3 = [p.pos[0], p.size[2] / 2, zFront + p.size[1] / 2];
    return { id, pos, rot: [Math.PI / 2, 0, 0] };
  });
}

/** Builds a recipe, showing some parts laid elsewhere from a given step until their own step adds them. */
function buildStaged(b: PlanBuilder, s: ProductSpec, recipe: CustomParams, stages: Stages) {
  const keyOf = (id: string) => {
    const p = recipe.parts.find((q) => q.id === id)!.pos;
    return b.items.find((it) => it.kind === "part" && it.final.pos.every((v, i) => Math.abs(v - p[i]) < 0.5))?.key;
  };
  const step = b.step.bind(b);
  b.step = (def, body) =>
    step(def, () => {
      const list = stages[b.steps.length - 1] ?? [];
      if (list.length) {
        b.stagger(0.1);
        for (const g of list) {
          const k = keyOf(g.id);
          if (k) b.stage(k, g.pos, g.rot, [0, 200, 0]);
        }
        b.then(0.15);
      }
      body();
    });
  try {
    buildCustom(b, { ...s, custom: recipe });
  } finally {
    b.step = step;
  }
}

const family: Family = {
  names: ["RAKKESTAD"],
  build(b, s) {
    const k = kindOf(s);
    if (!k) return false;
    const r = k === "sliding" ? sliding(s) : hinged(s);
    buildStaged(b, s, r.recipe, r.stages);
    return true;
  },
};
export default family;

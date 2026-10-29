import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * BLÅLIDEN glass-door cabinet, read from its manual. A steel and glass case: with one glass side frame lying on a
 * rug, the bottom is bolted to it, then the other side frame, and the open top frame goes between their other ends
 * with countersunk screws. Four feet screw into the bottom corners. Stood up, the back glass slides down its grooves
 * from the top and two clips hold it (two people). The feet are levelled, the top panel hooks on and takes two
 * screws, and a wall strap ties it to the wall. Twelve shelf supports get felt pads and screw into the side frames,
 * the door goes onto its three hinge pins (two people), and the three glass shelves are laid in last.
 */

const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });

/** A glass pane in a steel frame, in the plane facing `axis` ("x" for a side, "z" for the door). */
function framed(id: string, name: string, axis: "x" | "z", w: number, h: number, t: number, bar: number, pos: Vec3): CustomPart {
  const pieces: PartPiece[] = [];
  const S = (along: number, up: number, thick: number): Vec3 => (axis === "x" ? [thick, up, along] : [along, up, thick]);
  const P = (along: number, up: number): Vec3 => (axis === "x" ? [0, up, along] : [along, up, 0]);
  pieces.push(
    { shape: "box", size: S(bar, h, t), pos: P(-w / 2 + bar / 2, 0) },
    { shape: "box", size: S(bar, h, t), pos: P(w / 2 - bar / 2, 0) },
    { shape: "box", size: S(w - 2 * bar, bar, t), pos: P(0, h / 2 - bar / 2) },
    { shape: "box", size: S(w - 2 * bar, bar, t), pos: P(0, -h / 2 + bar / 2) },
    { shape: "box", size: S(w - 2 * bar, h - 2 * bar, 5), pos: P(0, 0), material: "glass" },
  );
  return { id, name, size: S(w, h, t), pos, pieces, material: "metal" };
}

function recipe(s: ProductSpec): CustomParams | null {
  if (!/cabinet/i.test(`${s.slug ?? ""} ${s.variant}`)) return null;
  // IKEA's measures: 35 wide, 32 deep, 151 high
  const W = 350, D = 320, H = 1510;
  const F = 10, TOPT = 20, ST = 20, DT = 20; // feet, top panel, side frame and door thickness
  const fh = H - F - TOPT; // side frames
  const zb = -D / 2, zf = D / 2 - DT; // the case's back and front, the door in front of it
  const sd = zf - zb, zc = (zf + zb) / 2;
  const xi = W / 2 - ST; // inner faces of the sides
  const parts: CustomPart[] = [];
  parts.push(framed("SL", "Side frame", "x", sd, fh, ST, 20, [-W / 2 + ST / 2, F + fh / 2, zc]));
  parts.push(framed("SR", "Side frame", "x", sd, fh, ST, 20, [W / 2 - ST / 2, F + fh / 2, zc]));
  parts.push({ id: "BOT", name: "Bottom", size: [2 * xi, 30, sd], pos: [0, F + 15, zc], material: "board" });
  const topY = F + fh - 15;
  parts.push({
    id: "TF",
    name: "Top frame",
    size: [2 * xi, 30, sd],
    pos: [0, topY, zc],
    pieces: [
      { shape: "box", size: [2 * xi, 30, 20], pos: [0, 0, sd / 2 - 10] },
      { shape: "box", size: [2 * xi, 30, 20], pos: [0, 0, -sd / 2 + 10] },
      { shape: "box", size: [20, 30, sd - 40], pos: [-xi + 10, 0, 0] },
      { shape: "box", size: [20, 30, sd - 40], pos: [xi - 10, 0, 0] },
    ],
    material: "metal",
  });
  const backH = topY - 15 - (F + 30);
  parts.push({ id: "BK", name: "Back glass", size: [2 * xi, backH, 5], pos: [0, F + 30 + backH / 2, zb + 8], material: "glass" });
  parts.push({ id: "TOP", name: "Top panel", size: [W, TOPT, D], pos: [0, H - TOPT / 2, 0], material: "board" });
  parts.push(framed("DOOR", "Glass door", "z", W, fh, DT, 25, [0, F + fh / 2, zf + DT / 2]));
  // three glass shelves, at the heights in IKEA's picture
  const shelfYs = [470, 810, 1160];
  const shelfIds = shelfYs.map((y, i) => {
    parts.push({ id: `G${i + 1}`, name: "Glass shelf", size: [2 * xi - 6, 6, sd - 20], pos: [0, y + 3, zc + 5], material: "glass" });
    return `G${i + 1}`;
  });

  const BOLT = { len: 10, dia: 10 }, SCREW = { len: 10, dia: 4 };
  const sideBolts = (sx: number) => at("bolt", [[sx * xi, F + 15, zc - 80], [sx * xi, F + 15, zc + 80]], [-sx, 0, 0], sx < 0 ? "SL" : "SR", "BOT", BOLT);
  const topScrews = [-1, 1].map((sx) => at("screw", [[sx * xi, topY, zc - 80], [sx * xi, topY, zc + 80]], [-sx, 0, 0], sx < 0 ? "SL" : "SR", "TF", { len: 12, dia: 6 }));
  const feet: Vec3[] = [-1, 1].flatMap((sx) => [zb + 10, zf - 10].map((z) => [sx * (W / 2 - 10), F, z] as Vec3));
  const clips: Vec3[] = [-1, 1].map((sx) => [sx * 90, topY - 15, zb + 14] as Vec3);
  const clipScrews: Vec3[] = clips.map((c) => [c[0], topY + 5, zb - 2] as Vec3);
  const strapAt: Vec3 = [0, topY, zb];
  // a support's cup sits in each corner post, its screw through the flange below it (kept apart so neither is nudged)
  const corners = (sx: number, dx: number, dy: number) => shelfYs.flatMap((y) => [zb + 10, zf - 10].map((z) => [sx * (xi - dx), y + dy, z] as Vec3));
  const supportFix = (sx: number): CustomFix[] => [
    at("pin", corners(sx, 0, -10), [sx, 0, 0], sx < 0 ? "SL" : "SR", undefined, { name: "Shelf support", len: 20, dia: 15 }),
    at("cap", corners(sx, 15, 0), [0, -1, 0], sx < 0 ? "SL" : "SR", undefined, { name: "Felt pad", len: 2, dia: 12 }),
    at("screw", corners(sx, 3, -34), [sx, 0, 0], sx < 0 ? "SL" : "SR", undefined, SCREW),
  ];
  const hinges: Vec3[] = [220, 760, 1300].map((y) => [-W / 2 + 10, y, zf] as Vec3);

  const steps: CustomStep[] = [
    {
      title: "Bolt the bottom to a side frame",
      detail: "Lay the side frame flat on a rug, glass down. Two bolts through the frame into the end of the bottom, with the big Allen key.",
      add: ["SL", "BOT"],
      fix: [sideBolts(-1)],
      tools: ["allen"],
      pose: "+x",
      warnings: ["floor"],
    },
    { title: "Bolt on the other side frame", detail: "Lower it onto the bottom so the holes line up, then two more bolts.", add: ["SR"], fix: [sideBolts(1)], tools: ["allen"] },
    { title: "Screw the top frame between the sides", detail: "Push it in at the open end and screw it on with four countersunk screws, two in each side.", add: ["TF"], fix: topScrews, tools: ["allen"] },
    { title: "Screw the four feet into the bottom", detail: "Turn each one into its corner by hand until it stops.", fix: [at("foot", feet, [0, 1, 0], undefined, undefined, { len: 15, dia: 25 })] },
    {
      title: "Stand it up and slide in the back glass",
      detail: "Lower the glass down through the top along the grooves at the back until it rests on the bottom. Hold it by its edges.",
      add: ["BK"],
      from: { BK: [0, backH + 200, 0] },
      pose: "+y",
      warnings: ["hand"],
    },
    {
      title: "Clip the back glass in at the top",
      detail: "One of you holds the case still. Hook the two clips over the top frame at the back and screw them on, not tight yet.",
      fix: [at("clip", clips, [0, -1, 0], "TF", "BK", { name: "Back clip", len: 20, dia: 15 }), at("screw", clipScrews, [0, 0, 1], "TF", undefined, SCREW)],
      tools: ["screwdriver"],
      people: 2,
    },
    { title: "Level it with the feet", detail: "Check it with a spirit level and turn the feet until it stands straight and steady.", tools: ["level"] },
    { title: "Tighten the two clip screws", detail: "Check each clip sits flat on the glass, then tighten its screw.", tools: ["screwdriver"] },
    { title: "Hook the top panel on", detail: "Lay it on with its back edge hooked over the top frame, then lower the front.", add: ["TOP"], from: { TOP: [0, 300, 0] } },
    {
      title: "Screw the top panel on",
      detail: "Two screws up through the top frame at the front.",
      fix: [at("screw", [-1, 1].map((sx) => [sx * 100, topY + 15, zf - 10] as Vec3), [0, 1, 0], "TF", "TOP", SCREW)],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the wall strap to the wall",
      detail: "Mark the wall just under the top. Drill, plug and screw the strap on. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        { kind: "strap", count: 1, at: [[0, topY - 40, zb - 4]], dir: [0, 0, 1] },
        { kind: "plug", count: 1, at: [[0, topY - 40, zb - 40]], dir: [0, 0, -1] },
        { kind: "screw", count: 1, len: 50, dia: 5, at: [[0, topY - 40, zb - 6]], dir: [0, 0, -1] },
      ],
      tools: ["drill", "pencil", "screwdriver"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    {
      title: "Screw the strap to the top frame",
      detail: "Thread its end into the slot in the frame at the back and fix it with one screw.",
      fix: [at("screw", [strapAt], [0, 0, 1], "TF", undefined, SCREW)],
      tools: ["screwdriver"],
    },
    {
      title: "Screw in the shelf supports with their felt pads",
      detail: "Press a felt pad into the cup of each of the twelve supports, then screw them to the corner posts, four at each shelf height.",
      fix: [...supportFix(-1), ...supportFix(1)],
      tools: ["screwdriver"],
    },
    { title: "Drop a ring onto each hinge pin", detail: "The three pins stick up on the front left post.", fix: [at("washer", hinges, [0, -1, 0], "SL", undefined, { len: 3, dia: 10 })] },
    {
      title: "Hang the door on the hinge pins",
      detail: "One of you lifts the door and lowers it onto all three pins at once, the other guides them in from below.",
      add: ["DOOR"],
      from: { DOOR: [0, 120, 200] },
      people: 2,
    },
    {
      title: "Push in the two stop pins",
      detail: "One into the top hinge and one into the bottom, so the door can't lift off.",
      fix: [at("pin", [hinges[0], hinges[2]], [0, -1, 0], "DOOR", undefined, { name: "Hinge pin", len: 10, dia: 6 })],
    },
    {
      title: "Screw on the knob",
      detail: "On the right edge of the door, with the screw from the inside.",
      fix: [{ kind: "knob", count: 1, at: [[W / 2 - 12, 740, zf + DT]], dir: [0, 0, -1], on: "DOOR" }, at("screw", [[W / 2 - 12, 740, zf - 4]], [0, 0, 1], "DOOR", undefined, { len: 25, dia: 4 })],
      tools: ["screwdriver"],
    },
    { title: "Lay in the glass shelves", detail: "Open the door and set each shelf on its four supports.", add: shelfIds, from: Object.fromEntries(shelfIds.map((id) => [id, [0, 0, 380] as Vec3])) },
  ];
  return { parts, steps };
}

const family: Family = { names: ["BLÅLIDEN", "BLALIDEN"], recipe };
export default family;

import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * MÅLOMRÅDE, read from the sit/stand gaming desk's manual. The electric frame is built upside down on a rug: two rails
 * bolted between the lifting legs, a plate across the middle, end brackets, then (two people) the feet and their four
 * adjustable glides. Stood up, the legs' tops are screwed down, the top supports, cable hooks, control box hangers and
 * a clip go on, the control box is hung and wired, and the legs are run once. The top gets its two grommets and is
 * screwed onto the frame, the control panel and cable clips go underneath, and the feet are levelled. Then the monitor
 * frame: two posts clamped to the back edge, a crossbar with three arm mounts, a pegboard above it, a cable tray under
 * the back, and the three monitor arms with their cable covers and straps.
 */

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });
const SCREW = { name: "Screw", len: 12, dia: 6 };
const SOCKET = { name: "Allen bolt", len: 16, dia: 8 };
const RIVET = { name: "Push rivet", len: 12, dia: 8 };

function part(id: string, name: string, abs: PartPiece[], lo: Vec3, hi: Vec3, material: CustomPart["material"]): CustomPart {
  const c: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  const pieces = abs.map((p) => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]] as Vec3 }));
  return { id, name, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: c, pieces, material };
}

const box = (id: string, name: string, lo: Vec3, hi: Vec3, material: CustomPart["material"] = "metal"): CustomPart => ({
  id,
  name,
  size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
  pos: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2],
  material,
});

function desk(s: ProductSpec): CustomParams {
  // IKEA: 180 x 80, the top 68 to 125 cm high; 140 cm to the top of the pegboard with the desk at its lowest
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const yT = 680, tT = 25, yU = yT - tT; // top surface, underside
  const xL = W / 2 - 250; // the lifting legs
  const yBox0 = yU - 75, yBox1 = yU - 25; // the motor box on each leg's top
  const yF0 = 15, yF1 = 55; // feet, above their glides
  const zR = 60; // rails, either side of the middle
  const parts: CustomPart[] = [];
  for (const sx of [-1, 1]) {
    const x = sx * xL, id = sx < 0 ? "L" : "R";
    parts.push(
      part(`LEG_${id}`, "Lifting leg", [
        { shape: "cyl", size: [80, yBox0 - yF1, 80], pos: [x, (yF1 + yBox0) / 2, 0] },
        { shape: "box", size: [110, yBox1 - yBox0, 170], pos: [x, (yBox0 + yBox1) / 2, 0] },
      ], [x - 55, yF1, -85], [x + 55, yBox1, 85], "metal"),
    );
  }
  for (const sz of [-1, 1]) parts.push(box(sz < 0 ? "RAIL_B" : "RAIL_F", "Rail", [-xL + 55, yBox0 + 10, sz * zR - 20], [xL - 55, yBox1, sz * zR + 20]));
  parts.push(box("PLATE", "Middle plate", [-150, yBox0 + 4, -zR - 20], [150, yBox0 + 10, zR + 20]));
  for (const sx of [-1, 1]) parts.push(box(sx < 0 ? "END_L" : "END_R", "End bracket", [sx * (xL + 55) - (sx < 0 ? 60 : 0), yBox0 + 10, -60], [sx * (xL + 55) + (sx > 0 ? 60 : 0), yBox1, 60]));
  for (const sx of [-1, 1]) parts.push(box(sx < 0 ? "FOOT_L" : "FOOT_R", "Foot", [sx * xL - 40, yF0, -D / 2 + 50], [sx * xL + 40, yF1, D / 2 - 50]));
  for (const sx of [-1, 1]) parts.push(box(sx < 0 ? "SUP_L" : "SUP_R", "Top support", [sx * xL - 30, yBox1, -D / 2 + 60], [sx * xL + 30, yU, D / 2 - 60]));
  parts.push(box("CTRL", "Control box", [120, yBox0 - 35, -zR - 20 - 90], [360, yBox0 + 5, -zR - 20]));
  parts.push(box("TOP", "Desk top", [-W / 2, yU, -D / 2], [W / 2, yT, D / 2], "board"));
  parts.push(box("PANEL", "Control panel", [W / 2 - 420, yU - 25, D / 2 - 80], [W / 2 - 260, yU, D / 2 - 10], "board"));
  // the monitor frame, behind the top's back edge
  const xP = W / 2 - 70, zP = -D / 2 - 22, yPost1 = H - 10;
  for (const sx of [-1, 1]) {
    const x = sx * xP;
    parts.push(
      part(`POST_${sx < 0 ? "L" : "R"}`, "Post", [
        { shape: "cyl", size: [36, yPost1 - yU + 40, 36], pos: [x, (yU - 40 + yPost1) / 2, zP] },
        { shape: "box", size: [70, 70, 60], pos: [x, yU - 10, zP + 30] },
      ], [x - 35, yU - 45, zP - 18], [x + 35, yPost1, zP + 60], "metal"),
    );
  }
  const yBar = 930;
  parts.push({ id: "BAR", name: "Crossbar", shape: "cyl", size: [2 * xP - 36, 40, 40], pos: [0, yBar, zP], material: "metal" });
  const yPg0 = 1080, yPg1 = H - 20;
  parts.push(box("PEG", "Pegboard", [-xP + 18, yPg0, zP - 6], [xP - 18, yPg1, zP + 6]));
  parts.push(box("TRAY", "Cable tray", [-600, yU - 140, -D / 2 + 20], [600, yU - 20, -D / 2 + 170]));
  const mounts = [-500, 0, 500];
  mounts.forEach((x, i) =>
    parts.push(
      part(`MON_${i + 1}`, "Monitor arm", [
        { shape: "cyl", size: [44, 90, 44], pos: [x, yBar + 65, zP] },
        { shape: "box", size: [50, 40, 300], pos: [x, yBar + 130, zP + 150] },
        { shape: "box", size: [100, 100, 12], pos: [x, yBar + 130, zP + 306] },
      ], [x - 50, yBar + 20, zP - 22], [x + 50, yBar + 180, zP + 312], "metal"),
    ),
  );

  // where the fittings go
  // two bolts through each rail end into the motor box, far enough apart that neither gets nudged
  const legTop = (sx: number, dy: number): Vec3[] => [-1, 1].flatMap((sz) => [[sx * (xL - 65), yBox0 + 14, sz * zR], [sx * (xL - 65), yBox0 + 14 + dy, sz * zR]] as Vec3[]);
  const railBolts = [-1, 1].map((sx) => fx("bolt", legTop(sx, 23), [sx, 0, 0], `LEG_${sx < 0 ? "L" : "R"}`, { name: "Allen bolt", len: 40, dia: 8, mate: sx < 0 ? "RAIL_B" : "RAIL_F" }));
  const plateScrews = fx("bolt", [-1, 0, 1].flatMap((i) => [-1, 1].map((sz): Vec3 => [i * 110, yBox0 + 4, sz * zR])), [0, 1, 0], "PLATE", { name: "Flat Allen screw", len: 10, dia: 6 });
  const endScrews = (z: number) => [-1, 1].map((sx) => fx("screw", [-1, 1].map((sz): Vec3 => [sx * (xL + 55 + 30), yBox0 + 10, sz * z]), [0, 1, 0], `END_${sx < 0 ? "L" : "R"}`, SCREW));
  const footBolts = [-1, 1].map((sx) => fx("bolt", [-1, 1].flatMap((ax) => [-1, 1].map((az): Vec3 => [sx * xL + ax * 22, yF0, az * 45])), [0, 1, 0], `FOOT_${sx < 0 ? "L" : "R"}`, { ...SOCKET, mate: `LEG_${sx < 0 ? "L" : "R"}` }));
  const glides = fx("foot", [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xL, yF0, sz * (D / 2 - 90)])), [0, 1, 0], "FOOT_L", { name: "Adjustable glide", len: 15, dia: 50 });
  glides.on = undefined;
  const topScrews = [-1, 1].map((sx) => fx("screw", [-70, -35, 0, 35, 70].map((z, i): Vec3 => [sx * xL + (i % 2 ? 40 : -40), yBox1, z]), [0, -1, 0], `LEG_${sx < 0 ? "L" : "R"}`, SCREW));
  const supScrews = [-1, 1].map((sx) => fx("screw", [-1, 1].map((sz): Vec3 => [sx * xL, yU, sz * 120]), [0, -1, 0], `SUP_${sx < 0 ? "L" : "R"}`, { ...SCREW, mate: `LEG_${sx < 0 ? "L" : "R"}` }));
  const hooks = fx("hook", [[-350, yBox0 + 10, -zR - 20], [-650 + 200, yBox0 + 10, zR + 20]], [0, 1, 0], "RAIL_B", { name: "Cable hook", len: 50, dia: 30 });
  hooks.on = undefined;
  const hangers = fx("clip", [[160, yBox0 + 10, -zR - 20], [320, yBox0 + 10, -zR - 20]], [0, 1, 0], "RAIL_B", { name: "Hanger", len: 40, dia: 30 });
  const deskTop = [-1, 1].map((sx) => fx("screw", [-300, -200, -100, 0, 100, 200, 300].map((z): Vec3 => [sx * xL, yU - 25, z]), [0, 1, 0], `SUP_${sx < 0 ? "L" : "R"}`, { ...SCREW, mate: "TOP" }));
  const grommets = fx("cap", [-1, 1].map((sx): Vec3 => [sx * (W / 2 - 220), yT, -D / 2 + 90]), [0, -1, 0], "TOP", { name: "Cable grommet", len: 25, dia: 60 });
  const postBottom = [-1, 1].map((sx) => [
    fx("screw", [-1, 1].map((sz): Vec3 => [sx * xP + sz * 20, yU - 45, zP + 40]), [0, 1, 0], `POST_${sx < 0 ? "L" : "R"}`, { ...SCREW, mate: "TOP" }),
    fx("bolt", [[sx * xP, yU - 45, zP]], [0, 1, 0], `POST_${sx < 0 ? "L" : "R"}`, SOCKET),
  ]).flat();
  const clampsAt = (y: number) => fx("clip", [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xP, y, zP + sz * 20])), [0, 0, 1], "POST_L", { name: "Clamp half", len: 40, dia: 40 });
  const clampsLow = { ...clampsAt(yBar), on: undefined };
  const clampsHigh = { ...clampsAt(yPg0 + 40), on: undefined };
  const clampScrews = fx("screw", [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xP, yBar + sz * 30, zP - 20])), [0, 0, 1], "POST_L", SCREW);
  clampScrews.on = undefined;
  const barBolts = [-1, 1].map((sx) => fx("bolt", [-12, 12].map((dy): Vec3 => [sx * (xP - 18), yBar + dy, zP - 20]), [0, 0, 1], "BAR", { ...SOCKET, mate: `POST_${sx < 0 ? "L" : "R"}` }));
  const loops = fx("clip", [-250, 250, 700].map((x): Vec3 => [x, yBar - 20, zP]), [0, 1, 0], "BAR", { name: "Cable loop", len: 40, dia: 30 });
  const ends = fx("cap", [-1, 1].map((sx): Vec3 => [sx * (xP - 18), yBar, zP]), [-1, 0, 0], "BAR", { name: "End piece", len: 30, dia: 44 });
  const endPieceScrews = fx("screw", [-1, 1].flatMap((sx) => [-1, 1].map((dy): Vec3 => [sx * (xP - 30), yBar + dy * 14, zP + 20])), [0, 0, -1], "BAR", SCREW);
  const covers = fx("cap", [-1, 1].map((sx): Vec3 => [sx * xP, yBar, zP + 20]), [0, 0, -1], "POST_L", { name: "Cover", len: 10, dia: 50 });
  covers.on = undefined;
  const postCaps = fx("cap", [-1, 1].map((sx): Vec3 => [sx * xP, yPost1, zP]), [0, -1, 0], "POST_L", { name: "Post cap", len: 15, dia: 38 });
  postCaps.on = undefined;
  const postCapScrews = [-1, 1].map((sx) => fx("screw", [[sx * (xP + 18), yPost1 - 30, zP]], [-sx, 0, 0], `POST_${sx < 0 ? "L" : "R"}`, SCREW));
  const pegBrackets = fx("screw", [-1, 1].flatMap((sx) => [-1, 1].map((dy): Vec3 => [sx * (xP - 60), (yPg0 + yPg1) / 2 + dy * 60, zP - 6])), [0, 0, 1], "PEG", SCREW);
  const pegRivets = fx("clip", [-1, 1].map((sx): Vec3 => [sx * (xP - 30), yPg0 + 40, zP + 6]), [0, 0, -1], "PEG", RIVET);
  const pegScrews = fx("screw", [-1, 1].map((sx): Vec3 => [sx * (xP - 30), yPg1 - 40, zP + 6]), [0, 0, -1], "PEG", SCREW);
  const trayRivets = (xs: number[]) => fx("clip", xs.map((x): Vec3 => [x, yU - 100, -D / 2 + 20]), [0, 0, 1], "TRAY", RIVET);
  const armCovers = fx("clip", mounts.map((x): Vec3 => [x, yBar + 110, zP + 150]), [0, -1, 0], "MON_1", { name: "Cable cover", len: 200, dia: 30 });
  armCovers.on = undefined;
  const straps = fx("clip", [-1, 1].flatMap((sx) => [yBar + 60, yPg0 + 100].map((y): Vec3 => [sx * xP, y, zP + 20])), [0, 0, -1], "POST_L", { name: "Cable strap", len: 30, dia: 20 });
  straps.on = undefined;

  const steps: CustomStep[] = [
    {
      title: "Bolt the rails between the legs",
      detail: "Lay both legs upside down on a rug, cables out. Two rails go between the motor boxes, two bolts at each end.",
      add: ["LEG_L", "LEG_R", "RAIL_B", "RAIL_F"],
      fix: railBolts,
      tools: ["allen"],
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Screw the plate across the middle", detail: "Six flat Allen screws through the plate into both rails.", add: ["PLATE"], fix: [plateScrews], tools: ["allen"] },
    { title: "Screw on the end brackets", detail: "One on the outside of each motor box, two screws each.", add: ["END_L", "END_R"], fix: endScrews(40), tools: ["screwdriver"] },
    { title: "Add the second screws to the brackets", detail: "Two more in each bracket, between the first two.", fix: endScrews(12), tools: ["screwdriver"] },
    {
      title: "Bolt on the feet",
      detail: "One of you holds the frame steady while the other bolts each foot across the end of a leg, four bolts each.",
      add: ["FOOT_L", "FOOT_R"],
      fix: footBolts,
      tools: ["allen"],
      people: 2,
    },
    { title: "Screw the glides into the feet", detail: "One near each end of both feet, turned in by hand.", fix: [glides] },
    { title: "Stand the frame up and screw down the leg tops", detail: "Turn it over together. Five screws into the top of each motor box.", fix: topScrews, tools: ["screwdriver"], pose: "+y", people: 2 },
    { title: "Screw on the top supports", detail: "One across each leg, front to back, two screws each.", add: ["SUP_L", "SUP_R"], fix: supScrews, tools: ["screwdriver"] },
    { title: "Clip the two cable hooks under the rails", detail: "Push each one into its slot and turn it until it locks.", fix: [hooks] },
    { title: "Fit the control box hangers and the cable clip", detail: "Both hangers hook into the back rail, the clip clicks onto it.", fix: [hangers, { kind: "clip", count: 1, at: [[0, yBox0 + 10, zR + 20]], dir: [0, 1, 0], name: "Cable clip", len: 20, dia: 20 }] },
    { title: "Hang the control box and plug in the legs", detail: "Slide it onto the hangers, then plug each leg's cable into its socket on the box and clip the cables up.", add: ["CTRL"] },
    {
      title: "Run the legs once",
      detail: "Plug the box into the wall, hold the up button until the legs move up and stop, then unplug it again. This sets the legs level with each other.",
      warnings: ["hand"],
    },
    { title: "Push the grommets into the top", detail: "One in each hole at the back of the top, flush with the surface.", fix: [grommets], wait: ["TOP"] },
    {
      title: "Lay the top on the frame and screw it on",
      detail: "Lift it on together, front edge over the front of the feet. Seven screws up through each top support.",
      add: ["TOP"],
      fix: deskTop,
      tools: ["screwdriver"],
      people: 2,
    },
    {
      title: "Screw the control panel and cable clips under the top",
      detail: "The panel goes under the front right edge, four screws. Plug its cable into the box and clip the cables along the underside.",
      add: ["PANEL"],
      fix: [fx("screw", [-1, 1].flatMap((a) => [-1, 1].map((b): Vec3 => [W / 2 - 340 + a * 60, yU - 25, D / 2 - 45 + b * 20])), [0, 1, 0], "PANEL", { ...SCREW, len: 16, dia: 4, mate: "TOP" }), fx("screw", [[-200, yU, -60], [200, yU, -60]], [0, 1, 0], "TOP", { ...SCREW, len: 16, dia: 4 })],
      tools: ["screwdriver"],
    },
    { title: "Level the feet", detail: "Turn the glides until the desk stands steady without rocking. A spirit level on the top helps.", tools: ["level"] },
    { title: "Plug it in and test it", detail: "Run the desk all the way up and down once, then take it back to its lowest height and unplug it for the next steps.", warnings: ["hand"] },
    { title: "Fix the posts to the back of the top", detail: "Each clamps under the back edge: two screws into the top and one bolt into the post.", add: ["POST_L", "POST_R"], fix: postBottom, tools: ["screwdriver", "allen"] },
    { title: "Fit two clamps to each post", detail: "The halves close round the post at the holes for the crossbar. Two screws in each pair.", fix: [clampsLow, clampScrews], tools: ["screwdriver"] },
    { title: "Fit the crossbar's end pieces and cable loops", detail: "Three loops slide on underneath, then an end piece on each end, arrows up.", fix: [loops, ends], wait: ["BAR"] },
    { title: "Bolt the crossbar to the posts", detail: "Lift it onto the clamps and fit two bolts at each end.", add: ["BAR"], fix: barBolts, tools: ["allen"] },
    { title: "Screw the end pieces tight and click on the covers", detail: "Two screws in each end piece, then the covers click over them.", fix: [endPieceScrews, covers], tools: ["screwdriver"] },
    { title: "Fit the upper clamps and the post caps", detail: "Two more clamp halves on each post for the pegboard, and a cap screwed onto the top of each post.", fix: [clampsHigh, postCaps, ...postCapScrews], tools: ["screwdriver"] },
    { title: "Screw the brackets onto the pegboard", detail: "One at each end on the back, two screws each.", fix: [pegBrackets], wait: ["PEG"], tools: ["screwdriver"] },
    { title: "Fix the pegboard to the posts", detail: "Hook its brackets onto the upper clamps, then a push rivet low and a screw high at each end.", add: ["PEG"], fix: [pegRivets, pegScrews], tools: ["screwdriver"] },
    { title: "Hang the cable tray under the back", detail: "Hook it onto the hangers under the top and fix it with six push rivets.", add: ["TRAY"], fix: [trayRivets([-400, 400]), trayRivets([-560, -200, 200, 560])] },
    { title: "Drop the monitor arms onto the crossbar", detail: "One on each mount, pressed down until it sits.", add: ["MON_1", "MON_2", "MON_3"] },
    {
      title: "Hang your screens",
      detail: "Screws for the screen plates come in two sizes: pick the ones that fit your screen. Screens up to 27 inches and 7 kg each. Set each arm's spring with the Allen key so it holds its screen.",
      tools: ["screwdriver", "allen"],
    },
    { title: "Tidy the cables", detail: "Run each screen's cables under its arm's cover and through the loops, then strap them to the posts.", fix: [armCovers, straps] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["MÅLOMRÅDE", "MALOMRADE"],
  recipe: (s) => (/desk/i.test(`${s.variant} ${s.slug ?? ""}`) ? desk(s) : null),
};
export default family;

import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, ProductSpec, Vec3 } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * BYÅS, read from the TV bench's manual. The two drawers come first, each built on its front in a scene of its own:
 * long cam bolts and dowels in the front, the low sides pushed on and locked, the bottom slid in, the back held by
 * ribbed dowels, then upside down for the runners and upright for the grip. The bench is built on a rug: a plinth
 * frame on dowels is cam-locked under the bottom, which gets its felt pads and is turned over. Two dividers stand on
 * the bottom, the sides are pushed onto the back and the three are lowered on together, then the top. A bracket fixes
 * it to the wall, the cabinet runners and shelf pins go in, the three shelves, the drawers and last the bumpers.
 */

const T = 18;
const fx = (kind: CustomFix["kind"], at: Vec3[], o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, ...o });
const UP: Vec3 = [0, 1, 0];
const DOWN: Vec3 = [0, -1, 0];

const LONG_BOLT: HwDef = { kind: "camScrew", len: 44, dia: 7, name: "Long cam bolt" };
const DOWEL: HwDef = { kind: "dowel", len: 30, dia: 8 };
const DRAWER_CAM: HwDef = { kind: "cam", len: 12, dia: 15, name: "Drawer cam lock" };
const RIBBED: HwDef = { kind: "dowel", len: 32, dia: 7, name: "Ribbed plastic dowel" };
const DRAWER_RUNNER: HwDef = { kind: "runner", len: 330, dia: 20, name: "Drawer runner" };
const SHORT_SCREW: HwDef = { kind: "screw", len: 10, dia: 4 };
const SCREW: HwDef = { kind: "screw", len: 16, dia: 4 };
const GRIP: HwDef = { kind: "handle", len: 60, dia: 14, name: "Grip" };
const BUMPER: HwDef = { kind: "glide", len: 2, dia: 10, name: "Bumper" };

interface Geo {
  W: number;
  H: number;
  D: number;
  P: number; // plinth height
  yB: number; // top of the bottom
  yT: number; // underside of the top
  zB: number; // back of the carcass
  zF: number; // front edge of the carcass, the drawer fronts in front of it
  xi: number; // inside faces of the sides
  xv: number; // divider centres
  c: number; // compartment width
}

function geoOf(s: ProductSpec): Geo {
  // IKEA: 160 x 42, 45 high
  const W = s.size.w * 10 || 1600, H = s.size.h * 10 || 450, D = s.size.d * 10 || 420;
  const P = 60, yB = P + T, yT = H - T;
  const zB = -D / 2, zF = D / 2 - T - 2;
  const xi = W / 2 - T;
  const c = (2 * xi - 2 * T) / 3;
  return { W, H, D, P, yB, yT, zB, zF, xi, xv: xi - c - T / 2, c };
}

/* ---------- the drawers ---------- */

interface Drawer {
  cx: number;
  bw: number;
  front: string;
  sides: [string, string];
  bottom: string;
  back: string;
  fz: number; // front: centre x
}

const BOX_Y = 90, BOX_H = 120, BOX_D = 350;

function drawerParts(b: PlanBuilder, g: Geo): Drawer[] {
  const fw = g.c + 24, fh = g.yT - 4 - (g.P + 2);
  const bw = g.c - 25;
  const zc = g.zF - BOX_D / 2;
  const frontT = b.part("Drawer front", [fw, fh, T]);
  const sideT = b.part("Drawer side", [16, BOX_H, BOX_D]);
  const bottomT = b.part("Drawer bottom", [bw - 20, 3, BOX_D - 10], { material: "fiber" });
  const backT = b.part("Drawer back", [bw - 32, BOX_H - 20, 16]);
  return [-1, 1].map((sx): Drawer => {
    const cx = sx * (g.xv + T / 2 + g.c / 2);
    const fz = sx * (g.W / 2 - fw / 2 - 1);
    return {
      cx,
      bw,
      fz,
      front: b.place(frontT, [fz, g.P + 2 + fh / 2, g.zF + T / 2]),
      sides: [-1, 1].map((k) => b.place(sideT, [cx + k * (bw / 2 - 8), BOX_Y + BOX_H / 2, zc])) as [string, string],
      bottom: b.place(bottomT, [cx, BOX_Y + 10, zc]),
      back: b.place(backT, [cx, BOX_Y + 13 + (BOX_H - 20) / 2, g.zF - BOX_D + 8]),
    };
  });
}

function drawerFits(d: Drawer, g: Geo) {
  const per = (fn: (k: number, side: string) => FitOpts[]) => [-1, 1].flatMap((k) => fn(k, d.sides[k < 0 ? 0 : 1]));
  const xs = (k: number) => d.cx + k * (d.bw / 2 - 8);
  const zc = g.zF - BOX_D / 2;
  const fTop = g.yT - 4;
  return {
    bolts: per((k, sd) => [{ on: d.front, at: [xs(k), BOX_Y + 85, g.zF], dir: [0, 0, 1], mate: sd, mateHole: 4 }]),
    dowels: per((k, sd) => [{ on: d.front, at: [xs(k), BOX_Y + 30, g.zF], dir: [0, 0, 1], mate: sd }]),
    cams: per((k, sd) => [{ on: sd, at: [d.cx + k * (d.bw / 2), BOX_Y + 85, g.zF - 28], dir: [-k, 0, 0] }]),
    // driven in through the side: drawn from the joint, in the back's end and through the side
    ribbed: per((k, sd) => [{ on: d.back, at: [d.cx + k * (d.bw / 2 - 16), BOX_Y + 60, g.zF - BOX_D + 8], dir: [-k, 0, 0], mate: sd }]),
    runners: per((k, sd) => [{ on: sd, at: [xs(k), BOX_Y, zc], dir: UP, hole: false }]),
    runnerScrews: per((k, sd) => [-120, 120].map((dz): FitOpts => ({ on: sd, at: [xs(k), BOX_Y, zc + dz], dir: UP }))),
    grip: [{ on: d.front, at: [d.fz, fTop - 8, g.zF], dir: [0, 0, 1], hole: false }] as FitOpts[],
    gripScrews: [-18, 18].map((dx): FitOpts => ({ on: d.front, at: [d.fz + dx, fTop - 8, g.zF], dir: [0, 0, 1] })),
  };
}

/** The first drawer, built in a scene of its own; the second one the same way. */
function drawerSteps(b: PlanBuilder, g: Geo, d: Drawer) {
  const f = drawerFits(d, g);
  const c0: Vec3 = [d.cx, BOX_Y + BOX_H / 2, g.zF - BOX_D / 2];
  const rel = (k: string): Vec3 => {
    const p = b.partItem(k).final.pos;
    return [p[0] - c0[0], p[1] - c0[1], p[2] - c0[2]];
  };
  const stage = (k: string, from: Vec3) => b.stage(k, rel(k), b.partItem(k).final.rot, from);
  const scene = "drawer";
  b.step(
    { title: "Screw the long cam bolts into a drawer front", detail: "Lay the front face down on a rug. One bolt near each end, in the holes along the bottom.", tools: ["screwdriver"], kind: "cams", scene, pose: "-z", repeat: 2, warnings: ["face", "floor"] },
    () => {
      stage(d.front, [0, 0, -160]);
      b.then(0.15);
      b.fits(LONG_BOLT, f.bolts, 0.15);
    },
  );
  b.step({ title: "Tap in the dowels and push the sides on", detail: "One dowel beside each bolt. Push the sides down onto them, grooves facing in.", tools: ["hammer"], kind: "join", scene, pose: "-z", repeat: 2 }, () => {
    b.fits(DOWEL, f.dowels, 0.15);
    b.then(0.15);
    b.stagger(0.25);
    for (const sd of d.sides) stage(sd, [0, 0, -260]);
  });
  b.step({ title: "Lock the sides with the cam locks", detail: "One in each side, arrow towards the bolt, turned clockwise until tight.", tools: ["screwdriver"], kind: "cams", scene, pose: "-z", repeat: 2 }, () => b.fits(DRAWER_CAM, f.cams, 0.15));
  b.step({ title: "Slide the bottom into the grooves", detail: "All the way down to the front.", kind: "drawer", scene, pose: "-z", repeat: 2 }, () => stage(d.bottom, [0, 0, -420]));
  b.step(
    { title: "Fit the back and hammer in the ribbed dowels", detail: "The back drops in between the sides. One ribbed dowel through each side into it, until the head is flush.", tools: ["hammer"], kind: "dowels", scene, pose: "-z", repeat: 2 },
    () => {
      stage(d.back, [0, 0, -300]);
      b.then(0.15);
      b.fits(RIBBED, f.ribbed, 0.15);
    },
  );
  b.step(
    { title: "Screw the runners under the drawer", detail: "Turn the drawer upside down. Hook each runner onto the front first, then two short screws hold it to the side.", tools: ["screwdriver"], kind: "runners", scene, pose: "-y", repeat: 2 },
    () => {
      b.fits(DRAWER_RUNNER, f.runners, 0.2);
      b.then(0.1);
      b.fits(SHORT_SCREW, f.runnerScrews, 0.08);
    },
  );
  b.step(
    { title: "Screw the grip inside the front", detail: "Stand the drawer up. The grip's lip goes over the top edge of the front, two screws hold it.", tools: ["screwdriver"], kind: "screws", scene, pose: "+y", repeat: 2 },
    () => {
      b.fits(GRIP, f.grip);
      b.then(0.1);
      b.fits(SCREW, f.gripScrews, 0.1);
    },
  );
}

/* ---------- the bench ---------- */

function benchRecipe(g: Geo): { parts: CustomPart[]; steps: CustomStep[] } {
  const { W, P, yB, yT, zB, zF, xi, xv, c } = g;
  const Hs = yT - yB, Dc = zF - zB, zc = (zB + zF) / 2;
  const xs = W / 2 - T / 2;
  const pf = zF - 38, pb = zB + 18; // plinth rails, centres
  const pEnd = W / 2 - 28;
  const board = (id: string, name: string, size: Vec3, pos: Vec3): CustomPart => ({ id, name, size, pos, material: "board" });
  const zDiv = (zB + T + zF) / 2;
  const cxs = [-(xv + T / 2 + c / 2), 0, xv + T / 2 + c / 2];
  const shelfY = 280, shelfD = Dc - T - 10, shelfZ = zDiv - 5;
  const parts: CustomPart[] = [
    board("PF", "Plinth rail", [W - 40, P, 16], [0, P / 2, pf]),
    board("PB", "Plinth rail", [W - 40, P, 16], [0, P / 2, pb]),
    board("PL", "Plinth end", [16, P, pf - pb - 16], [-pEnd, P / 2, (pf + pb) / 2]),
    board("PR", "Plinth end", [16, P, pf - pb - 16], [pEnd, P / 2, (pf + pb) / 2]),
    board("BT", "Bottom", [W, T, Dc], [0, P + T / 2, zc]),
    board("V1", "Divider", [T, Hs, Dc - T], [-xv, yB + Hs / 2, zDiv]),
    board("V2", "Divider", [T, Hs, Dc - T], [xv, yB + Hs / 2, zDiv]),
    board("SL", "Side", [T, Hs, Dc], [-xs, yB + Hs / 2, zc]),
    board("BK", "Back", [2 * xi, Hs, T], [0, yB + Hs / 2, zB + T / 2]),
    board("SR", "Side", [T, Hs, Dc], [xs, yB + Hs / 2, zc]),
    board("TP", "Top", [W, T, Dc], [0, yT + T / 2, zc]),
    ...cxs.map((x, i) => board(`H${i}`, "Shelf", [c - 2, 16, shelfD], [x, shelfY, shelfZ])),
  ];
  const zs = [zc - 120, zc + 120];
  const rails = [-600, 0, 600];
  const sideIn = (sx: number) => sx * xi;
  const divFace = (sx: number) => sx * (xv - T / 2); // the face of a divider towards the middle
  const wallX = xv + T / 2 + c / 2;

  const steps: CustomStep[] = [
    {
      title: "Join the plinth with dowels",
      detail: "Lay the four plinth boards on the rug in a frame. Two dowels in each end board, then push the long rails onto them.",
      add: ["PL", "PR", "PF", "PB"],
      fix: [-1, 1].flatMap((sx) => [pf - 8, pb + 8].map((z) => fx("dowel", [18, 42].map((y): Vec3 => [sx * pEnd, y, z]), { dir: [0, 0, z > 0 ? 1 : -1], on: sx < 0 ? "PL" : "PR" }))),
      tools: ["hammer"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Screw six cam bolts into the bottom",
      detail: "Lay it upside down on the rug. Three bolts along the front and three along the back.",
      fix: [fx("camScrew", [pf, pb].flatMap((z) => rails.map((x): Vec3 => [x, P, z])), { dir: UP, on: "BT" })],
      wait: ["BT"],
      tools: ["screwdriver"],
    },
    { title: "Put the plinth and bottom together", detail: "The bolts go into the holes along the plinth's top edges.", add: ["BT"] },
    {
      title: "Lock the plinth with cam locks",
      detail: "Six, in the inside faces of the long rails, turned clockwise until tight.",
      fix: [fx("cam", rails.map((x): Vec3 => [x, P - 28, pf - 8]), { dir: [0, 0, 1], on: "PF" }), fx("cam", rails.map((x): Vec3 => [x, P - 28, pb + 8]), { dir: [0, 0, -1], on: "PB" })],
      tools: ["screwdriver"],
    },
    {
      title: "Stick the felt pads under the plinth",
      detail: "Four along each long rail.",
      fix: [pf, pb].map((z) => fx("glide", [-700, -240, 240, 700].map((x): Vec3 => [x, 0, z]), { dir: UP, on: z > 0 ? "PF" : "PB", len: 4, dia: 20 })),
    },
    {
      title: "Turn it over and screw in eight cam bolts",
      detail: "Two for each divider and two at each end for the sides.",
      fix: [fx("camScrew", [-xs, -xv, xv, xs].flatMap((x) => zs.map((z): Vec3 => [x, yB, z])), { dir: DOWN, on: "BT" })],
      tools: ["screwdriver"],
      pose: "+y",
    },
    { title: "Stand the dividers on the bolts", detail: "Holes for the cam locks face the middle, shelf pin holes face out.", add: ["V1", "V2"] },
    {
      title: "Lock the dividers to the bottom",
      detail: "Two cam locks low down in each divider.",
      fix: [-1, 1].map((sx) => fx("cam", zs.map((z): Vec3 => [divFace(sx), yB + 32, z]), { dir: [sx, 0, 0], on: sx < 0 ? "V1" : "V2" })),
      tools: ["screwdriver"],
    },
    {
      title: "Screw cam bolts into the sides",
      detail: "Lay both sides flat, inside up. Two bolts near the back edge of each.",
      fix: [-1, 1].map((sx) => fx("camScrew", [yB + Hs * 0.25, yB + Hs * 0.75].map((y): Vec3 => [sideIn(sx), y, zB + T / 2]), { dir: [sx, 0, 0], on: sx < 0 ? "SL" : "SR" })),
      wait: ["SL", "SR"],
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    {
      title: "Fit the back and sides onto the bottom together",
      detail: "Lay the back on the rug and push the sides onto its ends. Then lift the three together onto the bolts in the bottom.",
      add: ["SL", "BK", "SR"],
      fix: [-1, 1].map((sx) => fx("cam", [yB + Hs * 0.25, yB + Hs * 0.75].map((y): Vec3 => [sx * (xi - 28), y, zB + T]), { dir: [0, 0, -1], on: "BK" })),
      tools: ["screwdriver"],
      people: 2,
    },
    {
      title: "Lock the sides to the bottom",
      detail: "Two cam locks low down in each side.",
      fix: [-1, 1].map((sx) => fx("cam", zs.map((z): Vec3 => [sideIn(sx), yB + 32, z]), { dir: [sx, 0, 0], on: sx < 0 ? "SL" : "SR" })),
      tools: ["screwdriver"],
      warnings: ["tip"],
    },
    {
      title: "Screw the wall bracket to the back",
      detail: "Near the top, behind the right-hand compartment, with a washer under the screw head.",
      fix: [
        fx("bracket", [[wallX, yT - 30, zB]], { dir: [0, 0, 1], on: "BK", len: 60, dia: 40 }),
        fx("washer", [[wallX, yT - 30, zB - 3]], { dir: [0, 0, 1], len: 1.5, dia: 16 }),
        fx("screw", [[wallX, yT - 30, zB - 4]], { dir: [0, 0, 1], on: "BK", len: 13, dia: 4 }),
      ],
      tools: ["screwdriver"],
      wall: false,
    },
    {
      title: "Screw eight cam bolts into the top",
      detail: "Lay it upside down on the rug, in the holes over the sides and dividers.",
      fix: [fx("camScrew", [-xs, -xv, xv, xs].flatMap((x) => zs.map((z): Vec3 => [x, yT, z])), { dir: UP, on: "TP" })],
      wait: ["TP"],
      tools: ["screwdriver"],
    },
    { title: "Lay the top on", detail: "Its front edge lines up with the front edges of the sides.", add: ["TP"] },
    {
      title: "Lock the top with the cam locks",
      detail: "Two at the top of each side and each divider.",
      fix: [
        ...[-1, 1].map((sx) => fx("cam", zs.map((z): Vec3 => [sideIn(sx), yT - 32, z]), { dir: [sx, 0, 0], on: sx < 0 ? "SL" : "SR" })),
        ...[-1, 1].map((sx) => fx("cam", zs.map((z): Vec3 => [divFace(sx), yT - 32, z]), { dir: [sx, 0, 0], on: sx < 0 ? "V1" : "V2" })),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Fix the bracket to the wall",
      detail: "Push the bench against the wall, mark through the bracket's slot, then plug and screw it with the second washer. Wall screws aren't included: pick ones made for your wall.",
      fix: [
        fx("plug", [[wallX, yT - 30, zB - 2]], { dir: [0, 0, -1] }),
        fx("washer", [[wallX, yT - 30, zB + 2]], { dir: [0, 0, -1], len: 1.5, dia: 16 }),
        fx("screw", [[wallX, yT - 30, zB + 3]], { dir: [0, 0, -1], len: 50, dia: 5 }),
      ],
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    {
      title: "Screw the cabinet runners in",
      detail: "One on each wall of the two outer compartments, marked L and R. Two screws each.",
      fix: [
        // they lie on the bottom along each wall, screwed down into it
        fx("runner", [-1, 1].flatMap((sx) => [sideIn(sx) - sx * 10, sx * (xv + T / 2 + 10)].map((x): Vec3 => [x, yB, zc])), { name: "Cabinet runner", dir: [0, -1, 0], len: 330, dia: 20 }),
        fx("screw", [-1, 1].flatMap((sx) => [sideIn(sx) - sx * 10, sx * (xv + T / 2 + 10)].flatMap((x) => [-120, 120].map((dz): Vec3 => [x, yB + 4, zc + dz]))), { dir: [0, -1, 0], len: 16, dia: 4 }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Push in the shelf pins",
      detail: "Four for each shelf, at the same height in all four corners.",
      fix: cxs.flatMap((x, i) => {
        const walls = [["SL", "V1"], ["V1", "V2"], ["V2", "SR"]][i];
        return [-1, 1].map((k) => fx("pin", [-1, 1].map((sz): Vec3 => [x + (k * c) / 2, shelfY - 11, shelfZ + sz * (shelfD / 2 - 40)]), { dir: [k, 0, 0], on: walls[k < 0 ? 0 : 1], dia: 5 }));
      }),
    },
    { title: "Lay the shelves on the pins", detail: "One in each compartment.", add: ["H0", "H1", "H2"] },
  ];
  return { parts, steps };
}

function build(b: PlanBuilder, s: ProductSpec) {
  const g = geoOf(s);
  const ds = drawerParts(b, g);
  drawerSteps(b, g, ds[0]);
  buildCustom(b, { ...s, custom: benchRecipe(g) });
  b.step({ title: "Slide the drawers in", detail: "Set each drawer's runners into the cabinet runners and push it home.", kind: "drawer" }, () => {
    for (const d of ds) {
      b.stagger(0);
      for (const k of [d.front, ...d.sides, d.bottom, d.back]) b.add(k, [0, 0, 480]);
      if (d !== ds[0]) {
        const f = drawerFits(d, g);
        const sets: [HwDef, FitOpts[]][] = [[LONG_BOLT, f.bolts], [DOWEL, f.dowels], [DRAWER_CAM, f.cams], [RIBBED, f.ribbed], [DRAWER_RUNNER, f.runners], [SHORT_SCREW, f.runnerScrews], [GRIP, f.grip], [SCREW, f.gripScrews]];
        for (const [def, list] of sets) for (const fo of list) b.preset(def, fo);
      }
      b.wait(0.2);
    }
  });
  const edges = [-g.W / 2 + T / 2, -g.xv, g.xv, g.W / 2 - T / 2];
  b.step({ title: "Stick on the bumpers", detail: "Two on the front edge of each side and divider, behind the drawer fronts, so the fronts close softly.", kind: "drawer" }, () => {
    b.fits(BUMPER, edges.flatMap((x) => [g.P + 60, g.yT - 60].map((y): FitOpts => ({ at: [x, y, g.zF], dir: [0, 0, -1], hole: false }))), 0.08);
  });
  return true;
}

const family: Family = { names: ["BYÅS"], build };
export default family;

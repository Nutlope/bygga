import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * FÖRSÄLJARE, read from the sideboard's manual. The underframe is built upside down on a rug: four rails held at the
 * corners by brackets, the bottom panel laid on and cam-locked, the legs bolted to the brackets with hanger bolts,
 * washers and nuts, and adjustable feet turned in. Stood up, the bottom takes the left side, the divider (with one
 * drawer runner on it), the top with its gallery rail, the right side (with the other runner) and the back. Door
 * tracks go in top and bottom, the sideboard is levelled and fixed to the wall, the shelf goes on four supports, the
 * two sliding doors get their pulls, guides and wheels and are hung, and the drawer is built and slid onto its runners.
 */

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 139.8 wide, 45.5 deep, 78.2 high
  const W = 1398, D = 455, H = 782, t = 18;
  const yB = 230; // underside of the bottom panel
  const yb = yB + t; // its top
  const gal = 20; // gallery rail on the top
  const yT = H - gal - t; // underside of the top
  const xi = W / 2 - t; // inside faces of the sides
  const xm = xi - 656 - t / 2; // the divider: the right compartment is the drawer's width
  const zBack = -D / 2 + 8, zIn = D / 2 - 50; // back panel, front of the inside (doors run in front of it)
  const parts: CustomPart[] = [];
  const P = (p: CustomPart) => parts.push(p);

  // underframe: two long and two short rails, legs in the inside corners
  const ax = W / 2 - 70, az = D / 2 - 60, ah = 60, ar = 20;
  P({ id: "AF", name: "Long rail", size: [2 * ax, ah, ar], pos: [0, yB - ah / 2, az], material: "wood" });
  P({ id: "AB", name: "Long rail", size: [2 * ax, ah, ar], pos: [0, yB - ah / 2, -az], material: "wood" });
  const sx0 = ax - 10 - ar / 2;
  P({ id: "AL", name: "Short rail", size: [ar, ah, 2 * az - ar], pos: [-sx0, yB - ah / 2, 0], material: "wood" });
  P({ id: "AR", name: "Short rail", size: [ar, ah, 2 * az - ar], pos: [sx0, yB - ah / 2, 0], material: "wood" });
  const lx = sx0 - ar / 2 - 23, lz = az - ar / 2 - 23;
  const legPts: Vec3[] = [-1, 1].flatMap((x) => [-1, 1].map((z): Vec3 => [x * lx, 0, z * lz]));
  legPts.forEach((p, i) => P({ id: `G${i + 1}`, name: "Leg", size: [45, yB, 45], pos: [p[0], yB / 2, p[2]], material: "wood" }));
  const legs = legPts.map((_, i) => `G${i + 1}`);

  P({ id: "B", name: "Bottom panel", size: [2 * xi, t, D], pos: [0, yB + t / 2, 0], material: "wood" });
  P({ id: "L", name: "Side panel", size: [t, yT - yB, D], pos: [-W / 2 + t / 2, (yB + yT) / 2, 0], material: "wood" });
  P({ id: "R", name: "Side panel", size: [t, yT - yB, D], pos: [W / 2 - t / 2, (yB + yT) / 2, 0], material: "wood" });
  P({ id: "M", name: "Divider", size: [t, yT - yb, zIn - zBack - 4], pos: [xm, (yb + yT) / 2, (zIn + zBack + 4) / 2], material: "wood" });
  P({ id: "T", name: "Top panel", size: [W, t, D], pos: [0, yT + t / 2, 0], material: "wood" });
  const gp: PartPiece[] = [
    { shape: "box", size: [W, gal, 16], pos: [0, 0, -D / 2 + 8] },
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [16, gal, D - 16], pos: [sx * (W / 2 - 8), 0, 8] })),
  ];
  P({ id: "Q", name: "Gallery rail", size: [W, gal, D], pos: [0, H - gal / 2, 0], pieces: gp, material: "wood" });
  P({ id: "K", name: "Back panel", size: [2 * xi, yT - yb, 6], pos: [0, (yb + yT) / 2, zBack], material: "fiber" });
  const lw = xm - t / 2 + xi;
  P({ id: "S", name: "Shelf", size: [lw - 4, t, zIn - zBack - 10], pos: [(-xi + xm - t / 2) / 2, 470, (zIn + zBack) / 2], material: "wood" });
  // the drawer, in the top of the right compartment
  const dw = 640, dh = 120, dd = 360, dz0 = zIn - 4;
  const dc: Vec3 = [(xm + t / 2 + xi) / 2, yT - 12 - dh / 2, dz0 - dd / 2];
  const dp: PartPiece[] = [
    { shape: "box", size: [dw, dh, 16], pos: [0, 0, dd / 2 - 8] },
    { shape: "box", size: [dw, dh - 20, 12], pos: [0, -10, -dd / 2 + 6] },
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [12, dh - 20, dd - 28], pos: [sx * (dw / 2 - 6), -10, 0] })),
    { shape: "box", size: [dw - 24, 6, dd - 28], pos: [0, -dh / 2 + 3, 0], material: "fiber" },
  ];
  P({ id: "DW", name: "Drawer", size: [dw, dh, dd], pos: dc, pieces: dp, material: "wood" });
  // two sliding doors on two tracks, overlapping in the middle
  const dy0 = yb + 6, dy1 = yT - 6, ov = 25;
  const tz = [D / 2 - 36, D / 2 - 12];
  const tracks: string[] = [];
  for (const y of [yT - 3, yb + 3]) for (const z of tz) {
    const id = `TR${tracks.length + 1}`;
    tracks.push(id);
    P({ id, name: "Door track", size: [2 * xi - 4, 6, 12], pos: [0, y, z], material: "metal" });
  }
  const dwid = xi + ov;
  P({ id: "D1", name: "Sliding door", size: [dwid, dy1 - dy0, t], pos: [-xi + dwid / 2, (dy0 + dy1) / 2, D / 2 - 36], material: "board" });
  P({ id: "D2", name: "Sliding door", size: [dwid, dy1 - dy0, t], pos: [xi - dwid / 2, (dy0 + dy1) / 2, D / 2 - 12], material: "board" });

  const at = (pts: Vec3[], dir: Vec3, on?: string, mate?: string) => ({ count: pts.length, at: pts, dir, on, mate });
  const fx = (kind: CustomFix["kind"], o: Partial<CustomFix> & { count: number }): CustomFix => ({ kind, ...o });
  const corner = legPts.map((p): Vec3 => [p[0], yB - 10, p[2]]);
  const zs3 = [-D / 2 + 70, 0, D / 2 - 70];
  const zs2 = [-D / 2 + 90, D / 2 - 120];
  return {
    parts,
    steps: [
      {
        title: "Fit the corner brackets into the rails",
        detail: "Lay the four rails upside down on a rug, as a frame. One bracket in each corner, its tabs in the rails' slots.",
        add: ["AF", "AB", "AL", "AR"],
        fix: [fx("plate", { ...at(corner, [0, 1, 0]), len: 12, dia: 80, name: "Corner bracket" })],
        pose: "-y",
        warnings: ["floor"],
      },
      {
        title: "Screw the brackets to the rails",
        detail: "Four screws in each bracket, two into each rail.",
        fix: [fx("screw", { ...at(corner.flatMap((p) => [-1, 1].flatMap((a) => [[p[0] + Math.sign(p[0]) * 28, p[1], p[2] + a * 12] as Vec3, [p[0] + a * 12, p[1], p[2] + Math.sign(p[2]) * 28] as Vec3])), [0, 1, 0]), len: 16, dia: 4 })],
        tools: ["screwdriver"],
      },
      {
        title: "Tap dowels into the long rails",
        detail: "Two in the edge of each.",
        fix: [-1, 1].map((sz) => fx("dowel", at([-ax / 2, ax / 2].map((x): Vec3 => [x, yB, sz * az]), [0, 1, 0], sz > 0 ? "AF" : "AB", "B"))),
        tools: ["hammer"],
      },
      {
        title: "Screw the cam bolts into the bottom panel",
        detail: "Six, along its underside, by hand until they stop.",
        fix: [-1, 1].map((sz) => fx("camScrew", at([-ax + 120, 0, ax - 120].map((x): Vec3 => [x, yB, sz * az]), [0, -1, 0], "B", sz > 0 ? "AF" : "AB"))),
        wait: ["B"],
        tools: ["screwdriver"],
      },
      { title: "Lay the frame onto the bottom panel", detail: "Bottom panel face down on the rug, then turn the frame over onto its bolts and dowels.", add: ["B"] },
      {
        title: "Lock the frame with the cam locks",
        detail: "Six, in the long rails. Turn each clockwise until it pulls tight.",
        fix: [-1, 1].map((sz) => fx("cam", { ...at([-ax + 120, 0, ax - 120].map((x): Vec3 => [x, yB - 30, sz * (az - ar / 2)]), [0, 0, sz]), dia: 15, on: sz > 0 ? "AF" : "AB" })),
        tools: ["screwdriver"],
      },
      {
        title: "Fit the hanger bolts into the legs",
        detail: "Push a barrel nut into the side hole of each leg, slot lined up, then screw the bolt in from the top until it stops.",
        fix: [
          fx("legScrew", { ...at(corner.map((p): Vec3 => [p[0], yB, p[2]]), [0, -1, 0]), len: 100, dia: 8, name: "Hanger bolt" }),
          fx("nut", { ...at(legPts.map((p): Vec3 => [p[0] + Math.sign(p[0]) * 22, yB - 40, p[2]]), [-1, 0, 0]), len: 20, dia: 10, name: "Barrel nut" }),
        ],
        wait: legs,
        tools: ["flathead"],
      },
      {
        title: "Bolt the legs to the corner brackets",
        detail: "Bolt through the bracket, then a flat washer, a spring washer and a nut. Tighten with a spanner.",
        add: legs,
        fix: [
          fx("washer", { ...at(corner, [0, -1, 0]), len: 2, dia: 18, name: "Washer" }),
          fx("washer", { ...at(corner, [0, -1, 0]), len: 3, dia: 14, name: "Spring washer" }),
          fx("nut", { ...at(corner, [0, -1, 0]), len: 7, dia: 8 }),
        ],
        tools: ["wrench"],
      },
      {
        title: "Screw the adjustable feet into the legs",
        detail: "One in the end of each leg, all the way in for now.",
        fix: [fx("foot", { ...at(legPts, [0, 1, 0]), len: 20, dia: 30, name: "Adjustable foot" })],
      },
      {
        title: "Stand it up and fit the divider's cam bolts",
        detail: "Turn the base over onto its feet. Two cam bolts into the bottom panel where the divider will stand.",
        fix: [fx("camScrew", at(zs2.map((z): Vec3 => [xm, yb, z]), [0, 1, 0], "B", "M"))],
        tools: ["screwdriver"],
        pose: "+y",
      },
      {
        title: "Tap dowels into the ends of the bottom",
        detail: "Two in each end.",
        fix: [-1, 1].map((sx) => fx("dowel", at(zs2.map((z): Vec3 => [sx * xi, yB + t / 2, z]), [sx, 0, 0], "B", sx < 0 ? "L" : "R"))),
        tools: ["hammer"],
      },
      {
        title: "Screw cam bolts into the sides and divider",
        detail: "Three in the top end of each side, three in the bottom end, two in the top of the divider.",
        fix: [
          ...[-1, 1].flatMap((sx) => [yT, yB].map((y) => fx("camScrew", at(zs3.map((z): Vec3 => [sx * (W / 2 - t / 2), y, z]), [0, y === yT ? 1 : -1, 0], sx < 0 ? "L" : "R", y === yT ? "T" : "B")))),
          fx("camScrew", at(zs2.map((z): Vec3 => [xm, yT, z]), [0, 1, 0], "M", "T")),
        ],
        wait: ["L", "R", "M"],
        tools: ["screwdriver"],
      },
      {
        title: "Tap dowels into the tops of the sides",
        detail: "Two in each.",
        fix: [-1, 1].map((sx) => fx("dowel", at(zs2.map((z): Vec3 => [sx * (W / 2 - t / 2), yT, z + 40]), [0, 1, 0], sx < 0 ? "L" : "R", "T"))),
        wait: ["L", "R"],
        tools: ["hammer"],
      },
      {
        title: "Screw a drawer runner onto the divider",
        detail: "On its right face, near the top, three screws. The runner's front end goes to the front edge.",
        fix: [
          fx("runner", { ...at([[xm + t / 2, dc[1] - 30, dc[2]]], [-1, 0, 0], "M"), len: 350, dia: 40 }),
          fx("screw", { ...at([-120, 0, 120].map((z): Vec3 => [xm + t / 2 + 6, dc[1] - 30, dc[2] + z]), [-1, 0, 0], "M"), len: 12, dia: 4 }),
        ],
        wait: ["M"],
        tools: ["screwdriver"],
      },
      {
        title: "Screw the other runner onto the right side",
        detail: "On its inside face, at the same height, three screws.",
        fix: [
          fx("runner", { ...at([[xi, dc[1] - 30, dc[2]]], [1, 0, 0], "R"), len: 350, dia: 40 }),
          fx("screw", { ...at([-120, 0, 120].map((z): Vec3 => [xi - 6, dc[1] - 30, dc[2] + z]), [1, 0, 0], "R"), len: 12, dia: 4 }),
        ],
        wait: ["R"],
        tools: ["screwdriver"],
      },
      { title: "Fit the left side onto the bottom", detail: "Lay the base on its back. Push the side onto the dowels and bolts at the left end.", add: ["L"], pose: "+z", warnings: ["floor"] },
      {
        title: "Lock the left side",
        detail: "Three cam locks in the bottom panel, turned clockwise.",
        fix: [fx("cam", { ...at(zs3.map((z): Vec3 => [-xi + 30, yb, z]), [0, -1, 0], "B"), dia: 15 })],
        tools: ["screwdriver"],
      },
      { title: "Stand the divider on the bottom", detail: "Stand the base up again. The divider's runner faces right, its bolts go into the bottom panel.", add: ["M"], pose: "+y" },
      {
        title: "Lock the divider",
        detail: "Two cam locks in the foot of the divider.",
        fix: [fx("cam", { ...at(zs2.map((z): Vec3 => [xm - t / 2, yb + 30, z]), [1, 0, 0], "M"), dia: 15 })],
        tools: ["screwdriver"],
      },
      {
        title: "Tap dowels into the top's back edge",
        detail: "Six, on its upper face along the back, for the gallery rail.",
        fix: [fx("dowel", at([-500, -300, -100, 100, 300, 500].map((x): Vec3 => [x, H - gal, -D / 2 + 8]), [0, 1, 0], "T", "Q"))],
        wait: ["T", "Q"],
        tools: ["hammer"],
      },
      {
        title: "Screw cam bolts into the gallery rail",
        detail: "Four, along its underside.",
        fix: [fx("camScrew", at([-450, -150, 150, 450].map((x): Vec3 => [x, H - gal, -D / 2 + 8]), [0, -1, 0], "Q", "T"))],
        wait: ["T", "Q"],
        tools: ["screwdriver"],
      },
      {
        title: "Press the rail onto the top and lock it",
        detail: "Onto the dowels and bolts, flush with the edges. Two cam locks under the top hold it.",
        fix: [fx("cam", { ...at([-300, 300].map((x): Vec3 => [x, yT, -D / 2 + 40]), [0, 1, 0], "T"), dia: 12, name: "Small cam lock" })],
        wait: ["T", "Q"],
        tools: ["screwdriver"],
      },
      {
        title: "Lay the top onto the left side and divider",
        detail: "Hook it over the left side first, then lower it onto the divider's bolts.",
        add: ["T", "Q"],
        people: 2,
      },
      {
        title: "Lock the top",
        detail: "Five cam locks in the left side and one in the divider, turned clockwise.",
        fix: [
          fx("cam", { ...at([...zs3, ...zs2].map((z): Vec3 => [-xi, yT - 30, z]), [-1, 0, 0], "L"), dia: 15 }),
          fx("cam", { ...at([[xm - t / 2, yT - 30, 0]], [1, 0, 0], "M"), dia: 15 }),
        ],
        tools: ["screwdriver"],
      },
      { title: "Fit the right side", detail: "Push it onto the dowels and bolts of the bottom and the top.", add: ["R"] },
      {
        title: "Lock the right side",
        detail: "Six cam locks, three at the top and three at the bottom.",
        fix: [fx("cam", { ...at([yT - 30, yb + 30].flatMap((y) => zs3.map((z): Vec3 => [xi, y, z])), [1, 0, 0], "R"), dia: 15 })],
        tools: ["screwdriver"],
      },
      { title: "Slide the back panel in", detail: "Into the grooves from the side, smooth face to the front.", add: ["K"], from: { K: [1500, 0, 0] } },
      {
        title: "Fit the door tracks",
        detail: "Click the stops onto the ends of the four tracks, press two into the groove under the top and two into the bottom, then four screws hold the lower ones.",
        add: tracks,
        fix: [
          fx("screw", { ...at([-500, 500].flatMap((x) => tz.map((z): Vec3 => [x, yb + 6, z])), [0, -1, 0], undefined, "B"), len: 16, dia: 4 }),
        ],
        tools: ["screwdriver"],
      },
      {
        title: "Fit the clips and the soft-close dampers",
        detail: "Eight clips along the tracks, then a damper at each end of the top track.",
        fix: [
          fx("clip", { ...at([-600, -300, 300, 600].flatMap((x) => [D / 2 - 36, D / 2 - 12].map((z): Vec3 => [x, yT, z])), [0, 1, 0], "T"), len: 20, dia: 15, name: "Track clip" }),
          fx("connector", { ...at([-1, 1].map((sx): Vec3 => [sx * (xi - 60), yT, D / 2 - 24]), [0, 1, 0], "T"), len: 60, dia: 25, name: "Soft-close damper" }),
        ],
      },
      {
        title: "Level the sideboard",
        detail: "Turn the feet in or out until it stands level and steady.",
        tools: ["level"],
      },
      {
        title: "Fix it to the wall",
        detail: "Fit the wall bracket to the top's back edge and screw it to the wall. Use plugs and screws that suit your wall; they are not included.",
        fix: [
          fx("bracket", { ...at([[0, yT - 40, -D / 2]], [0, 0, -1], "K"), len: 120, dia: 30, name: "Wall bracket" }),
          fx("plug", at([-1, 1].map((sx): Vec3 => [sx * 40, yT - 40, -D / 2 - 2]), [0, 0, -1])),
          fx("screw", { ...at([-1, 1].map((sx): Vec3 => [sx * 40, yT - 40, -D / 2]), [0, 0, -1]), len: 50, dia: 5 }),
        ],
        tools: ["drill"],
        warnings: ["wall", "tip"],
        wall: true,
      },
      {
        title: "Put the shelf in",
        detail: "Four supports in the holes at the height you want, then lay the shelf on them.",
        add: ["S"],
        fix: [fx("pin", { count: 4, to: ["S"], len: 16, dia: 5, name: "Shelf support" })],
      },
      {
        title: "Fit the pulls, guides and wheels to the doors",
        detail: "Lay the doors face down. Press a round pull into each, two guides into the top edge and screw two wheels to the bottom.",
        fix: [
          fx("knob", { ...at([[-xi + 70, 480, D / 2 - 27]], [0, 0, -1], "D1"), len: 10, dia: 40, name: "Finger pull" }),
          fx("knob", { ...at([[xi - 70, 480, D / 2 - 3]], [0, 0, -1], "D2"), len: 10, dia: 40, name: "Finger pull" }),
          ...(["D1", "D2"] as const).flatMap((d) => {
            const x0 = d === "D1" ? -xi + dwid / 2 : xi - dwid / 2, z = d === "D1" ? D / 2 - 36 : D / 2 - 12;
            return [
              fx("clip", { ...at([-1, 1].map((e): Vec3 => [x0 + e * (dwid / 2 - 60), dy1, z]), [0, -1, 0], d), len: 20, dia: 15, name: "Top guide" }),
              fx("roller", { ...at([-1, 1].map((e): Vec3 => [x0 + e * (dwid / 2 - 60), dy0, z]), [0, 1, 0], d), len: 25, dia: 30, name: "Door wheel" }),
            ];
          }),
        ],
        wait: ["D1", "D2"],
        warnings: ["face"],
      },
      {
        title: "Hang the doors",
        detail: "Back door first: tip its top into the upper track, lower the wheels onto the bottom one and push up until it clicks. Then the front door.",
        add: ["D1", "D2"],
        people: 2,
      },
      {
        title: "Build the drawer",
        detail: "Push the dowels into the sides, join them to the front and back, slide the bottom in and lock the four small cam locks.",
        fix: [fx("cam", { ...at([-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [dc[0] + sx * (dw / 2 - 6), dc[1], dc[2] + sz * (dd / 2 - 30)])), [-1, 0, 0], "DW"), dia: 12, name: "Small cam lock" })],
        wait: ["DW"],
        tools: ["screwdriver"],
      },
      {
        title: "Slide the drawer onto its runners",
        detail: "Pull the runners out, set the drawer on them and push it in until both catches click.",
        add: ["DW"],
        from: { DW: [0, 0, 500] },
      },
    ],
  };
}

const family: Family = {
  names: ["FÖRSÄLJARE", "FORSALJARE"],
  recipe(s) {
    return /sideboard/i.test(`${s.slug ?? ""} ${s.variant}`) ? recipe(s) : null;
  },
};
export default family;

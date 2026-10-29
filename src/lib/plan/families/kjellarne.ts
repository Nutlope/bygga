import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartMaterial, ProductSpec, Vec3 } from "../../types";

/*
 * KJELLARNE corner desk, read from IKEA's manual (the layout with the cabinet under the left wing; the manual also
 * shows it mirrored). Two units carry the L-shaped top: an open shelf unit at the right end of the back, and a
 * cabinet with a door and a drawer at the front of the left wing, its door facing the knee space. Both are built
 * lying on a side with cam bolts, dowels and cam locks, and stand on plastic feet. A leg panel holds the inside
 * corner, and two modesty rails make an L along the back and under the left wing. The two halves of the top are
 * joined upside down with long dowels, long cam bolts and cams, then lowered on and locked with ten cams and five
 * corner blocks. Shelves, the door and the drawer go in last. IKEA's sizes: 138 x 130 cm, 76 high.
 */

const F = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const box = (id: string, name: string, lo: Vec3, hi: Vec3, material: PartMaterial = "board"): CustomPart => ({
  id,
  name,
  size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
  pos: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2],
  material,
});

function desk(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 1380, D = Math.round(s.size.d * 10) || 1300;
  const H = 760, tt = 25, Hu = H - tt, t = 18; // IKEA: 76 high (our listing says 74)
  const xl = -W / 2, xr = W / 2, zb = -D / 2, zf = D / 2;
  const back = 600; // depth of the back half of the top
  const zj = zb + back; // where the two halves of the top meet
  const wing = 600; // width of the left wing
  const xw = xl + wing; // inside edge of the wing
  // shelf unit, at the right end of the back
  const sx0 = xr - 400, sx1 = xr, sz0 = zb, sz1 = zj;
  // cabinet, at the front of the left wing, facing the knee space
  const cx0 = xl, cx1 = xw, cz0 = zf - 400, cz1 = zf;
  const yR = 485; // underside of the modesty rails

  const parts: CustomPart[] = [
    box("SA", "Shelf unit side", [sx0, 0, sz0], [sx0 + t, Hu, sz1]),
    box("SB", "Shelf unit side", [sx1 - t, 0, sz0], [sx1, Hu, sz1]),
    box("ST", "Shelf unit top", [sx0 + t, Hu - t, sz0], [sx1 - t, Hu, sz1]),
    box("SO", "Shelf unit bottom", [sx0 + t, 60, sz0], [sx1 - t, 60 + t, sz1]),
    box("SP", "Plinth", [sx0 + t, 0, sz1 - t], [sx1 - t, 60, sz1]),
    box("CR", "Cabinet side", [cx0, 0, cz1 - t], [cx1, Hu, cz1]),
    box("CL", "Cabinet side", [cx0, 0, cz0], [cx1, Hu, cz0 + t]),
    box("CT", "Cabinet top", [cx0, Hu - t, cz0 + t], [cx1, Hu, cz1 - t]),
    box("CB", "Cabinet bottom", [cx0, 60, cz0 + t], [cx1, 60 + t, cz1 - t]),
    box("CP", "Plinth", [cx1 - t, 0, cz0 + t], [cx1, 60, cz1 - t]),
    box("G", "Leg panel", [xw - 9, 0, zb + t], [xw + 9, Hu, zj]),
    box("R1", "Back modesty rail", [xl, yR, zb], [sx0, Hu, zb + t]),
    box("R2", "Side modesty rail", [xl, yR, zb + t], [xl + t, Hu, cz0]),
    box("D", "Door", [cx1, 64, cz0 + 2], [cx1 + t, 562, cz1 - 2]),
    // the drawer, above the door
    box("DK", "Drawer back", [cx0 + 110, 585, cz0 + 36], [cx0 + 122, 695, cz1 - 36]),
    box("DS0", "Drawer side", [cx0 + 110, 585, cz0 + 24], [cx1, 695, cz0 + 36]),
    box("DS1", "Drawer side", [cx0 + 110, 585, cz1 - 36], [cx1, 695, cz1 - 24]),
    box("DB", "Drawer bottom", [cx0 + 122, 590, cz0 + 36], [cx1, 594, cz1 - 36], "fiber"),
    box("DF", "Drawer front", [cx1, 572, cz0 + 2], [cx1 + t, 712, cz1 - 2]),
    box("P1", "Desk top, back", [xl, Hu, zb], [xr, H, zj]),
    box("P2", "Desk top, wing", [xl, Hu, zj], [xw, H, zf]),
    box("CS", "Shelf", [cx0 + 20, 300, cz0 + t + 1], [cx1 - 30, 300 + t, cz1 - t - 1]),
    box("S1", "Shelf", [sx0 + t + 1, 260, sz0 + 20], [sx1 - t - 1, 260 + t, sz1 - 20]),
    box("S2", "Shelf", [sx0 + t + 1, 480, sz0 + 20], [sx1 - t - 1, 480 + t, sz1 - 20]),
  ];

  // shelf unit joints: the top and bottom on cams, the bottom, top and plinth on dowels
  const sFace = (g: number) => (g < 0 ? sx0 + t : sx1 - t); // inside face of each side
  const sSide = (g: number) => (g < 0 ? "SA" : "SB");
  const sMid = (sz0 + sz1) / 2;
  const sCamBolts = (g: number) => [Hu - t / 2, 60 + t / 2].flatMap((y) => [-1, 1].map((k): Vec3 => [sFace(g), y, sMid + k * 220]));
  const sCams = (g: number): CustomFix[] => [
    F("cam", [-1, 1].map((k): Vec3 => [sFace(g) - g * 34, Hu - t, sMid + k * 220]), [0, 1, 0], { on: "ST", dia: 15 }),
    F("cam", [-1, 1].map((k): Vec3 => [sFace(g) - g * 34, 60 + t, sMid + k * 220]), [0, -1, 0], { on: "SO", dia: 15 }),
  ];
  const sDowels = [-1, 1].flatMap((g) => [
    F("dowel", [-1, 1].map((k): Vec3 => [sFace(g), Hu - t / 2, sMid + k * 120]), [-g, 0, 0], { on: "ST", mate: sSide(g) }),
    F("dowel", [-1, 1].map((k): Vec3 => [sFace(g), 60 + t / 2, sMid + k * 120]), [-g, 0, 0], { on: "SO", mate: sSide(g) }),
    F("dowel", [18, 42].map((y): Vec3 => [sFace(g), y, sz1 - t / 2]), [-g, 0, 0], { on: "SP", mate: sSide(g) }),
  ]);
  // cabinet joints: the top on cams, the bottom and plinth on dowels
  const cFace = (g: number) => (g < 0 ? cz0 + t : cz1 - t);
  const cSide = (g: number) => (g < 0 ? "CL" : "CR");
  const cMid = (cx0 + cx1) / 2;
  const cCamBolts = (g: number) => [-1, 1].map((k): Vec3 => [cMid + k * 220, Hu - t / 2, cFace(g)]);
  const cCams = (g: number) => F("cam", [-1, 1].map((k): Vec3 => [cMid + k * 220, Hu - t, cFace(g) - g * 34]), [0, 1, 0], { on: "CT", dia: 15 });
  const cDowels = [-1, 1].flatMap((g) => [
    F("dowel", [-1, 1].map((k): Vec3 => [cMid + k * 150, 60 + t / 2, cFace(g)]), [0, 0, -g], { on: "CB", mate: cSide(g) }),
    F("dowel", [18, 42].map((y): Vec3 => [cx1 - t / 2, y, cFace(g)]), [0, 0, -g], { on: "CP", mate: cSide(g) }),
  ]);
  const FOOT = { name: "Plastic foot", len: 6, dia: 30 };
  const feet = (id: string, pts: Vec3[]) => F("glide", pts, [0, 1, 0], { ...FOOT, on: id });
  const SCREW = { len: 12, dia: 4 };
  // the top: halves joined along zj, units locked to it with cam bolts in its underside
  const joint = [xl + 80, xl + 230, xw - 230, xw - 80];
  const unitCams: [string, Vec3][] = [
    ...[-1, 1].flatMap((k) => [-1, 1].map((j): [string, Vec3] => ["ST", [(sx0 + sx1) / 2 + j * 130, Hu, sMid + k * 200]])),
    ...[-1, 1].flatMap((k) => [-1, 1].map((j): [string, Vec3] => ["CT", [cMid + j * 200, Hu, (cz0 + cz1) / 2 + k * 120]])),
    ["R1", [xl + 300, Hu, zb + t / 2]],
    ["R1", [sx0 - 300, Hu, zb + t / 2]],
  ];
  const topDowels: [string, Vec3][] = [
    ...[-1, 1].flatMap((k) => [-1, 1].map((j): [string, Vec3] => ["ST", [(sx0 + sx1) / 2 + j * 160, Hu, sMid + k * 120]])),
    ...[-1, 1].flatMap((k) => [-1, 1].map((j): [string, Vec3] => ["CT", [cMid + j * 240, Hu, (cz0 + cz1) / 2 + k * 60]])),
    ["R1", [xl + 150, Hu, zb + t / 2]],
    ["R1", [sx0 - 150, Hu, zb + t / 2]],
    ["R2", [xl + t / 2, Hu, zb + 250]],
    ["R2", [xl + t / 2, Hu, cz0 - 150]],
  ];
  const byHost = (list: [string, Vec3][], kind: CustomFix["kind"], dir: Vec3, o: Partial<CustomFix>) =>
    [...new Set(list.map(([h]) => h))].map((h) => F(kind, list.filter(([x]) => x === h).map(([, p]) => p), dir, { on: h, ...o }));

  return {
    parts,
    steps: [
      // the shelf unit
      {
        title: "Fit the feet and cam bolts into the shelf unit's sides",
        detail: "Lay both sides on a rug, holes up. Two feet press into the bottom edge of each, and the cam bolts screw in by hand.",
        fix: [
          feet("SA", [sz0 + 60, sz1 - 60].map((z): Vec3 => [sx0 + t / 2, 0, z])),
          feet("SB", [sz0 + 60, sz1 - 60].map((z): Vec3 => [sx1 - t / 2, 0, z])),
          ...[-1, 1].map((g) => F("camScrew", sCamBolts(g), [-g, 0, 0], { on: sSide(g), len: 11 })),
        ],
        wait: ["SA"],
        pose: "-x",
        warnings: ["floor"],
      },
      {
        title: "Tap dowels into the top, bottom and plinth",
        detail: "Two in each end, tapped in gently with a hammer.",
        fix: sDowels,
        tools: ["hammer"],
        wait: ["ST", "SO", "SP"],
      },
      {
        title: "Push the top and bottom into the lying side",
        detail: "Their cam holes face in. Turn the cam locks clockwise until they pull tight.",
        add: ["ST", "SO"],
        fix: sCams(1),
        tools: ["screwdriver"],
      },
      {
        title: "Fit the plinth and the other side",
        detail: "Push the plinth in at the front, lower the second side onto all the dowels and bolts, then lock its four cams. Stand the unit up.",
        add: ["SP", "SA"],
        fix: sCams(-1),
        tools: ["screwdriver"],
      },
      // the cabinet
      {
        title: "Fit the feet, runners and cam bolts into the cabinet sides",
        detail: "The runners are marked for the left and right side: two screws each, along the row of holes at the top. Two feet in each bottom edge.",
        fix: [
          feet("CL", [cx0 + 60, cx1 - 60].map((x): Vec3 => [x, 0, cz0 + t / 2])),
          feet("CR", [cx0 + 60, cx1 - 60].map((x): Vec3 => [x, 0, cz1 - t / 2])),
          ...[-1, 1].map((g) => F("runner", [[cMid - 10, 640, cFace(g)]], [0, 0, g], { on: cSide(g), len: 440, dia: 20, twist: Math.PI / 2, name: "Cabinet runner" })),
          ...[-1, 1].map((g) => F("screw", [cMid - 190, cMid + 170].map((x): Vec3 => [x, 640, cFace(g) - g * 2]), [0, 0, g], { on: cSide(g), ...SCREW })), // through the runner into the side
          ...[-1, 1].map((g) => F("camScrew", cCamBolts(g), [0, 0, -g], { on: cSide(g), len: 11 })),
        ],
        pose: "+y",
        tools: ["screwdriver"],
        wait: ["CL"],
      },
      {
        title: "Tap dowels into the cabinet bottom and plinth",
        detail: "Two in each end.",
        fix: cDowels,
        tools: ["hammer"],
        wait: ["CB", "CP"],
      },
      {
        title: "Push the top, bottom and plinth into one cabinet side",
        detail: "With the side lying flat on the rug. Lock the two cams in the top.",
        add: ["CT", "CB", "CP"],
        fix: [cCams(1)],
        tools: ["screwdriver"],
      },
      {
        title: "Fit the other cabinet side",
        detail: "Turn the cabinet over, slide the second side on and lock its two cams. Stand it up.",
        add: ["CL"],
        fix: [cCams(-1)],
        tools: ["screwdriver"],
      },
      // the leg panel and the rails
      {
        title: "Fit the feet and long dowels into the leg panel",
        detail: "Two feet in the bottom edge, two long dowels in the top edge. Stand it where the inside corner of the desk will be.",
        add: ["G"],
        fix: [
          feet("G", [zb + 80, zj - 60].map((z): Vec3 => [xw, 0, z])),
          F("dowel", [zb + 150, zj - 120].map((z): Vec3 => [xw, Hu, z]), [0, -1, 0], { on: "G", mate: "P1", len: 40 }),
        ],
        tools: ["hammer"],
      },
      {
        title: "Screw the hinges onto the door",
        detail: "Lay the door face down. Each hinge cup presses into its hole and takes two screws.",
        fix: [
          F("hinge", [140, 490].map((y): Vec3 => [cx1 + 9, y, cz0 + 40]), [1, 0, 0], { on: "D", len: 50, dia: 35 }),
          F("screw", [140, 490].flatMap((y) => [-24, 24].map((dy): Vec3 => [cx1, y + dy, cz0 + 50])), [1, 0, 0], { on: "D", ...SCREW }),
        ],
        tools: ["screwdriver"],
        wait: ["D"],
      },
      // the drawer
      {
        title: "Fit cam bolts and dowels into the drawer back",
        detail: "A cam bolt and a dowel in each end.",
        fix: [-1, 1].flatMap((g) => [
          F("camScrew", [[cx0 + 116, 665, g < 0 ? cz0 + 36 : cz1 - 36]], [0, 0, -g], { on: "DK", mate: g < 0 ? "DS0" : "DS1", len: 11 }),
          F("dowel", [[cx0 + 116, 615, g < 0 ? cz0 + 36 : cz1 - 36]], [0, 0, -g], { on: "DK", mate: g < 0 ? "DS0" : "DS1" }),
        ]),
      },
      {
        title: "Join the drawer sides to the back",
        detail: "Push the sides on and lock a cam in each.",
        add: ["DK", "DS0", "DS1"],
        fix: [-1, 1].map((g) => F("cam", [[cx0 + 150, 695, g < 0 ? cz0 + 30 : cz1 - 30]], [0, -1, 0], { on: g < 0 ? "DS0" : "DS1", dia: 15 })),
        tools: ["screwdriver"],
      },
      { title: "Slide in the drawer bottom", detail: "Patterned side up, all the way into the grooves.", add: ["DB"], from: { DB: [300, 0, 0] } },
      {
        title: "Screw on the drawer front",
        detail: "Fold it onto the ends of the sides and fix it with two screws from inside.",
        add: ["DF"],
        fix: [F("screw", [-1, 1].map((g): Vec3 => [cx1 - 20, 640, g < 0 ? cz0 + 30 : cz1 - 30]), [1, 0, 0], { len: 30, dia: 5, mate: "DF" })],
        tools: ["screwdriver"],
      },
      {
        title: "Screw the runners onto the drawer",
        detail: "Left and right are marked. Two screws each, with the wheel at the back.",
        fix: [
          ...[-1, 1].map((g) => F("runner", [[cMid - 10, 600, g < 0 ? cz0 + 24 : cz1 - 24]], [0, 0, -g], { on: g < 0 ? "DS0" : "DS1", len: 440, dia: 20, twist: Math.PI / 2, name: "Drawer runner" })),
          F("screw", [-1, 1].flatMap((g) => [cMid - 190, cMid + 170].map((x): Vec3 => [x, 600, g < 0 ? cz0 + 24 : cz1 - 24])), [0, 0, 1], SCREW),
        ],
        tools: ["screwdriver"],
      },
      // joining the base
      {
        title: "Screw the side rail to the cabinet",
        detail: "First fit two long cam bolts in its back end and two cams to hold them. Then two connecting screws through the back of the cabinet into its front end.",
        add: ["R2"],
        fix: [
          F("camScrew", [yR + 70, Hu - 70].map((y): Vec3 => [xl + t / 2, y, zb + t]), [0, 0, 1], { on: "R2", mate: "R1", len: 60, name: "Long cam bolt" }),
          F("cam", [yR + 70, Hu - 70].map((y): Vec3 => [xl + t / 2, y, zb + t + 34]), [1, 0, 0], { on: "R2", dia: 15 }),
          F("screw", [yR + 60, Hu - 60].map((y): Vec3 => [xl + t / 2, y, cz0 + t]), [0, 0, -1], { on: "CL", mate: "R2", len: 50, dia: 7, name: "Connecting screw" }),
        ],
        tools: ["allen"],
      },
      {
        title: "Fit the back rail and the leg panel",
        detail: "The back rail goes onto the long cam bolts and against the shelf unit and the leg panel; lock its two cams. Four connecting screws.",
        add: ["R1"],
        people: 2,
        fix: [
          F("cam", [yR + 70, Hu - 70].map((y): Vec3 => [xl + 34, y, zb]), [0, 0, 1], { on: "R1", dia: 15 }),
          F("screw", [yR + 60, Hu - 60].map((y): Vec3 => [sx0 + t, y, zb + t / 2]), [-1, 0, 0], { on: "SA", mate: "R1", len: 50, dia: 7, name: "Connecting screw" }),
          F("screw", [yR + 60, Hu - 60].map((y): Vec3 => [xw, y, zb]), [0, 0, 1], { on: "R1", mate: "G", len: 50, dia: 7, name: "Connecting screw" }),
        ],
        tools: ["allen", "screwdriver"],
      },
      {
        title: "Tap dowels into the tops of the units and rails",
        detail: "Twelve in all, into the holes in the top edges.",
        fix: byHost(topDowels, "dowel", [0, -1, 0], {}),
        tools: ["hammer"],
      },
      {
        title: "Put the desk top together and lower it on",
        detail: "Join the two halves upside down on the rug: long dowels and long cam bolts in the joint, eight cams turned tight, and ten cam bolts screwed into the underside. Then turn it over together and lower it onto the dowels.",
        add: ["P1", "P2"],
        people: 2,
        fix: [
          F("dowel", joint.map((x): Vec3 => [x, Hu + tt / 2, zj]), [0, 0, -1], { on: "P1", mate: "P2", len: 40 }),
          F("camScrew", joint.map((x): Vec3 => [x + 45, Hu + tt / 2, zj - 60]), [0, 0, 1], { on: "P1", mate: "P2", len: 100, name: "Long cam bolt" }),
          F("cam", joint.map((x): Vec3 => [x + 45, Hu, zj + 60]), [0, 1, 0], { on: "P2", dia: 15 }),
          F("cam", joint.map((x): Vec3 => [x + 45, Hu, zj - 60]), [0, 1, 0], { on: "P1", dia: 15 }),
          F("camScrew", unitCams.map(([, p]) => p), [0, 1, 0], { len: 11 }),
        ],
        tools: ["screwdriver"],
        from: { P1: [0, 400, 0], P2: [0, 400, 0] },
      },
      {
        title: "Lock the top to the units",
        detail: "Ten cams, in the tops of both units and the back rail, turned clockwise from below.",
        fix: byHost(unitCams.map(([h, p]): [string, Vec3] => [h, [p[0], Hu - t, p[2] + (h === "R1" ? 0 : 34)]]), "cam", [0, 1, 0], { dia: 15 }),
        tools: ["screwdriver"],
      },
      {
        title: "Screw in the five corner blocks",
        detail: "Under the top: two on the leg panel, two on the back rail and one on the side rail. One screw up into the top through each.",
        fix: [
          F("angle", [
            [xw + 9, Hu, zb + 200],
            [xw + 9, Hu, zj - 120],
            [xl + 450, Hu, zb + t],
            [sx0 - 450, Hu, zb + t],
            [xl + t, Hu, zb + 450],
          ], [0, 1, 0], { name: "Corner block", len: 30, dia: 25, mate: "P1" }),
        ],
        tools: ["screwdriver"],
      },
      { title: "Press in the cable grommet", detail: "Into the round hole at the back of the top.", fix: [F("cap", [[xw - 120, H, zb + 80]], [0, -1, 0], { on: "P1", name: "Cable grommet", len: 10, dia: 60 })] },
      {
        title: "Put the shelf in the cabinet",
        detail: "Four shelf pins at the height you want, then lay the shelf on them.",
        add: ["CS"],
        fix: [-1, 1].map((g) => F("pin", [cx0 + 60, cx1 - 70].map((x): Vec3 => [x, 296, cFace(g)]), [0, 0, -g], { on: cSide(g) })),
        from: { CS: [400, 0, 0] },
      },
      {
        title: "Put the two shelves in the shelf unit",
        detail: "Eight shelf pins, four under each shelf.",
        add: ["S1", "S2"],
        fix: [-1, 1].flatMap((g) => [256, 476].map((y) => F("pin", [sz0 + 60, sz1 - 60].map((z): Vec3 => [sFace(g), y, z]), [-g, 0, 0], { on: sSide(g) }))),
        from: { S1: [0, 0, 400], S2: [0, 0, 400] },
      },
      { title: "Stick the bumper inside the cabinet", detail: "On the front edge of the side the door closes against.", fix: [F("glide", [[cx1, 460, cz1 - t / 2]], [-1, 0, 0], { on: "CR", name: "Door bumper", len: 3, dia: 10 })] },
      { title: "Press the cover caps in", detail: "Four, over the holes on the outside of the shelf unit.", fix: [F("cap", [Hu - 60, 120].flatMap((y) => [-1, 1].map((k): Vec3 => [sx1, y, sMid + k * 220])), [-1, 0, 0], { on: "SB", name: "Cover cap", len: 3, dia: 12 })] },
      {
        title: "Screw the hinge plates into the cabinet",
        detail: "Inside the side by the knee space, two screws each.",
        fix: [
          F("plate", [140, 490].map((y): Vec3 => [cx1 - 37, y, cz0 + t]), [0, 0, -1], { on: "CL", name: "Hinge plate", len: 3, dia: 40 }),
          F("screw", [140, 490].flatMap((y) => [-16, 16].map((dy): Vec3 => [cx1 - 37, y + dy, cz0 + t])), [0, 0, -1], { on: "CL", len: 14, dia: 4 }),
        ],
        tools: ["screwdriver"],
      },
      { title: "Clip the door on", detail: "Hook each hinge onto its plate and press until it clicks. The screws on the hinges line the door up.", add: ["D"], from: { D: [300, 0, 0] } },
      { title: "Slide the drawer in", detail: "Lift its front a little so the wheels drop past the runners' stops.", tools: ["screwdriver"] },
    ],
  };
}

const family: Family = {
  names: ["KJELLARNE"],
  recipe(s) {
    if (!/corner desk/i.test(`${s.variant} ${s.slug ?? ""}`.replace(/-/g, " "))) return null;
    return desk(s);
  },
};
export default family;

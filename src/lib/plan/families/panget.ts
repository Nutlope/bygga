import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * PANGET, read from the coat rack with shoe storage's manual. Solid wood on dowels and cam locks: cam bolts go into
 * both slatted side frames and glides into their feet, the bottom, bench and top get dowels, and the apron strips are
 * dowelled and cammed under the bench and the top. Lying on one side frame, the shelves, strips, hook rail and clothes
 * rail go in, the other side frame goes on top and the back plinth is screwed through. Standing, the knobs, shelf pins
 * and loose shoe shelf go in, and two brackets fix it to the wall.
 */

const T = 40; // side frames

function part(id: string, name: string, abs: PartPiece[], lo: Vec3, hi: Vec3, material: CustomPart["material"]): CustomPart {
  const c: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  const pieces = abs.map((p) => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]] as Vec3 }));
  return { id, name, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: c, pieces, material };
}

const box = (lo: Vec3, hi: Vec3): PartPiece => ({ shape: "box", size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2] });

function rack(s: ProductSpec): CustomParams {
  // IKEA: 59.5 wide, 40.5 deep, 190.5 high
  const W = s.size.w * 10 || 595, D = s.size.d * 10 || 405, H = s.size.h * 10 || 1905;
  const xs = W / 2 - T / 2, xi = W / 2 - T, Wi = W - 2 * T;
  const zs = D / 2 - 22, zStrip = D / 2 - 20;
  const yBot = 90, yShoe = 270, ySeat = 500, yTop = H - 25, yHook = 1150, yRod = H - 145;
  const sideFrame = (id: string, sx: number) => {
    const x0 = sx * xs - T / 2, x1 = sx * xs + T / 2, sl0 = sx * xs - 10, sl1 = sx * xs + 10;
    const slats = [-90, 0, 90].flatMap((z) => [box([sl0, 80, z - 15], [sl1, ySeat - 30, z + 15]), box([sl0, ySeat + 30, z - 15], [sl1, H - 60, z + 15])]);
    return part(
      id,
      "Side frame",
      [
        box([x0, 0, -D / 2], [x1, H, -D / 2 + 45]),
        box([x0, 0, D / 2 - 45], [x1, H, D / 2]),
        box([x0, H - 60, -D / 2 + 45], [x1, H, D / 2 - 45]),
        box([x0, 0, -D / 2 + 45], [x1, 80, D / 2 - 45]),
        box([x0, ySeat - 30, -D / 2 + 45], [x1, ySeat + 30, D / 2 - 45]),
        ...slats,
      ],
      [x0, 0, -D / 2],
      [x1, H, D / 2],
      "wood",
    );
  };
  const shelf = (id: string, name: string, y: number, th: number, d = D - 30): CustomPart => ({ id, name, size: [Wi, th, d], pos: [0, y, 0], material: "wood" });
  const strip = (id: string, name: string, y: number, h: number, z: number): CustomPart => ({ id, name, size: [Wi, h, 20], pos: [0, y, z], material: "wood" });
  const parts: CustomPart[] = [
    sideFrame("SL", -1),
    sideFrame("SR", 1),
    shelf("BOT", "Bottom shelf", yBot, 20),
    shelf("SEAT", "Bench", ySeat, 25),
    shelf("TOP", "Top shelf", yTop, 20),
    strip("PF", "Plinth", 50, 80, zStrip),
    strip("PB", "Plinth", 50, 80, -zStrip),
    strip("SA", "Apron", ySeat - 12.5 - 30, 60, zStrip),
    strip("TF", "Apron", yTop - 10 - 30, 60, zStrip),
    strip("HOOK", "Hook rail", yHook, 80, -D / 2 + 30),
    { id: "ROD", name: "Clothes rail", shape: "cyl", size: [Wi, 25, 25], pos: [0, yRod, 0], material: "metal" },
    shelf("SHOE", "Shoe shelf", yShoe, 18, D - 50),
  ];
  const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });
  const SX = [-1, 1] as const;
  const sid = (sx: number) => (sx < 0 ? "SL" : "SR");
  const CB = { len: 34, dia: 7 }, CAM = { len: 13, dia: 15 }, DOW = { len: 30, dia: 8 };
  const zCam = [-120, 0, 120];
  const panels: [string, number][] = [["BOT", yBot], ["SEAT", ySeat], ["TOP", yTop]];
  const strips: [string, number, number][] = [["PF", 50, zStrip], ["TF", yTop - 40, zStrip], ["HOOK", yHook, -D / 2 + 30]];
  const sideBolts = SX.map((sx) =>
    at("camScrew", [...panels.flatMap(([, y]) => zCam.map((z): Vec3 => [sx * xi, y, z])), ...strips.map(([, y, z]): Vec3 => [sx * xi, y, z])], [sx, 0, 0], sid(sx), undefined, CB),
  );
  const panelCams = (sx: number) => panels.map(([id, y]) => at("cam", zCam.map((z): Vec3 => [sx * (xi - 30), y + 10, z]), [0, -1, 0], id, undefined, CAM));
  const stripCam = (sx: number, id: string, y: number, z: number) => at("cam", [[sx * (xi - 30), y, z - Math.sign(z) * 10]], [0, 0, Math.sign(z)], id, undefined, CAM);
  return {
    parts,
    steps: [
      {
        title: "Screw the cam bolts into the side frames",
        detail: "Lay both frames flat on a rug, inside face up: twelve in each, by hand. Use the long cam bolts here.",
        add: ["SL"],
        fix: sideBolts,
        wait: ["SR"],
        from: { SR: [700, 0, 0] },
        pose: "+x",
        warnings: ["floor"],
      },
      { title: "Tap the glides into the feet", detail: "One under each foot of both frames.", fix: SX.map((sx) => at("glide", [[sx * xs, 0, -zs], [sx * xs, 0, zs]], [0, 1, 0], sid(sx), undefined, { name: "Glide", len: 6, dia: 30 })), tools: ["hammer"] },
      {
        title: "Screw the wall brackets to the frames",
        detail: "One at the back of each frame's top rail, two screws each.",
        fix: [
          ...SX.map((sx) => at("angle", [[sx * xi, H - 30, -D / 2 + 60]], [sx, 0, 0], sid(sx), undefined, { name: "Wall bracket", len: 50, dia: 40 })),
          ...SX.map((sx) => at("screw", [[sx * xi, H - 30, -D / 2 + 35], [sx * xi, H - 30, -D / 2 + 85]], [sx, 0, 0], sid(sx), undefined, { len: 16, dia: 4 })),
        ],
      },
      {
        title: "Tap the dowels into the shelves",
        detail: "Two in each end of the bottom shelf, the bench and the top shelf.",
        fix: panels.flatMap(([id, y]) => SX.map((sx) => at("dowel", [[sx * xi, y, -160], [sx * xi, y, 160]], [sx, 0, 0], id, sid(sx), DOW))),
        wait: ["BOT", "SEAT", "TOP"],
        tools: ["hammer"],
      },
      {
        title: "Screw a cam bolt under the bench and the top",
        detail: "Use the two short cam bolts, in the middle of the front edge.",
        fix: [at("camScrew", [[0, ySeat - 12.5, zStrip]], [0, 1, 0], "SEAT", "SA", { len: 22, dia: 7 }), at("camScrew", [[0, yTop - 10, zStrip]], [0, 1, 0], "TOP", "TF", { len: 22, dia: 7 })],
      },
      {
        title: "Tap the dowels into the strips",
        detail: "One in each end of the plinths and aprons, and two along the top edge of each apron.",
        fix: [
          ...(["PF", "PB", "SA", "TF"] as const).flatMap((id) => {
            const p = parts.find((q) => q.id === id)!;
            return SX.map((sx) => at("dowel", [[sx * xi, p.pos[1], p.pos[2]]], [sx, 0, 0], id, sid(sx), DOW));
          }),
          at("dowel", [[-150, ySeat - 12.5, zStrip], [150, ySeat - 12.5, zStrip]], [0, 1, 0], "SA", "SEAT", DOW),
          at("dowel", [[-150, yTop - 10, zStrip], [150, yTop - 10, zStrip]], [0, 1, 0], "TF", "TOP", DOW),
        ],
        wait: ["PF", "PB", "SA", "TF"],
        from: { SA: [0, 0, 0], TF: [0, 0, 0] }, // joined on two axes: they just wait beside the build
        tools: ["hammer"],
      },
      {
        title: "Fix the aprons under the bench and the top",
        detail: "Press each apron onto its dowels and turn its cam lock clockwise.",
        fix: [at("cam", [[0, ySeat - 40, zStrip - 10]], [0, 0, 1], "SA", undefined, CAM), at("cam", [[0, yTop - 40, zStrip - 10]], [0, 0, 1], "TF", undefined, CAM)],
      },
      {
        title: "Stand the shelves on the side frame",
        detail: "Push the bottom shelf, the bench and the top shelf onto the bolts in the frame on the floor and lock their cams.",
        add: ["BOT", "SEAT", "SA", "TOP", "TF"],
        fix: panelCams(-1),
      },
      { title: "Fit the front plinth", detail: "Push it on and lock the cams in it and the top apron.", add: ["PF"], fix: [stripCam(-1, "PF", 50, zStrip), stripCam(-1, "TF", yTop - 40, zStrip)] },
      { title: "Tap the dowels into the hook rail", detail: "One in each end.", fix: SX.map((sx) => at("dowel", [[sx * xi, yHook + 25, -D / 2 + 30]], [sx, 0, 0], "HOOK", sid(sx), DOW)), wait: ["HOOK"], tools: ["hammer"] },
      { title: "Fit the hook rail", detail: "At the back, between the bench and the top. Lock its cam.", add: ["HOOK"], fix: [stripCam(-1, "HOOK", yHook, -D / 2 + 30)] },
      { title: "Put the clothes rail in its cup", detail: "Push a cup on each end and set one end in the hole in the frame.", add: ["ROD"], fix: SX.map((sx) => at("cap", [[sx * (xi - 4), yRod, 0]], [sx, 0, 0], "ROD", sid(sx), { name: "Rail cup", len: 12, dia: 40 })) },
      {
        title: "Lay the other side frame on top",
        detail: "Lower it onto all the dowels and bolts at once, with the rail end in its hole, then lock the ten cams.",
        add: ["SR"],
        fix: [...panelCams(1), stripCam(1, "HOOK", yHook, -D / 2 + 30)],
        people: 2,
      },
      { title: "Lock the last two cams", detail: "In the front plinth and the top apron.", fix: [stripCam(1, "PF", 50, zStrip), stripCam(1, "TF", yTop - 40, zStrip)] },
      {
        title: "Screw on the back plinth",
        detail: "Push it onto its dowels at the back and turn a long screw through each side frame with the Allen key.",
        add: ["PB"],
        fix: SX.map((sx) => at("bolt", [[sx * (xs + T / 2), 50, -zStrip]], [-sx, 0, 0], sid(sx), "PB", { name: "Connecting screw", len: 70, dia: 6 })),
      },
      { title: "Stand it up", detail: "Lift it together, by the side frames.", pose: "+y", people: 2, warnings: ["two"] },
      {
        title: "Screw the knobs onto the hook rail",
        detail: "A screw through the back of the rail into each knob.",
        fix: [
          at("knob", [-180, -60, 60, 180].map((x): Vec3 => [x, yHook, -D / 2 + 40]), [0, 0, -1], "HOOK", undefined, { len: 40, dia: 35 }),
          at("screw", [-180, -60, 60, 180].map((x): Vec3 => [x, yHook, -D / 2 + 10]), [0, 0, 1], "HOOK", undefined, { len: 40, dia: 4 }),
        ],
      },
      { title: "Push in the shelf pins", detail: "Four, by hand, at the same height in both frames.", fix: SX.map((sx) => at("pin", [[sx * xi, yShoe - 9, -150], [sx * xi, yShoe - 9, 150]], [sx, 0, 0], sid(sx), undefined, { len: 16, dia: 5 })) },
      { title: "Lay the shoe shelf on the pins", add: ["SHOE"], from: { SHOE: [0, 0, 500] } },
      {
        title: "Fix it to the wall",
        detail: "Push it against the wall, mark through the brackets, then fix them with plugs and screws that suit your wall and clip the covers on.",
        fix: [
          at("plug", SX.map((sx): Vec3 => [sx * (xi - 20), H - 30, -D / 2]), [0, 0, -1], sid(-1), undefined, { len: 35, dia: 8, to: ["SL", "SR"] }),
          at("screw", SX.map((sx): Vec3 => [sx * (xi - 20), H - 30, -D / 2 + 5]), [0, 0, -1], sid(-1), undefined, { len: 50, dia: 5, to: ["SL", "SR"] }),
          ...SX.map((sx) => at("cap", [[sx * (xi - 2), H - 30, -D / 2 + 60]], [sx, 0, 0], sid(sx), undefined, { name: "Bracket cover", len: 10, dia: 40 })),
        ],
        wall: true,
        tools: ["drill"],
      },
    ],
  };
}

const family: Family = {
  names: ["PANGET"],
  recipe: (s) => (/coat-rack-shoe|coat rack with shoe/i.test(`${s.variant} ${s.slug ?? ""}`) ? rack(s) : null),
};
export default family;

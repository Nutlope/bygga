import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * ÅRSUNDA, read from the armchair's manual. The seat and back hang on a steel tube frame: two bent side tubes are
 * bolted to a cross tube, then a tube is screwed across the top and one across the front. The back cover is pulled
 * down over it from the top and the seat cover on from the front. Each bentwood side (armrest, front leg and floor
 * runner in one loop) is screwed to the tube frame with two long screws, the chair lying on its side; two rails with
 * dowels in their ends join the sides, and long bolts go through the sides into barrel nuts in the rails.
 */

const TUBE = 20;
const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });

/** A box or tube whose long side runs from a to b in the y-z plane, as a piece of a part centred at c. */
function along(shape: "cyl" | "box", a: Vec3, b: Vec3, c: Vec3, w: number, t: number, shift: [number, number] = [0, 0]): PartPiece {
  const dy = b[1] - a[1], dz = b[2] - a[2];
  return {
    shape,
    size: [w, Math.hypot(dy, dz), t],
    pos: [(a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 + shift[0] - c[1], (a[2] + b[2]) / 2 + shift[1] - c[2]],
    rot: [Math.atan2(dz, dy), 0, 0],
  };
}

function armchair(s: ProductSpec): CustomParams {
  // IKEA: 66.5 wide, 72.5 deep, 99.5 high, seat 36 high and 53 wide
  const W = 665, D = 725, H = 995;
  const xs = W / 2 - 20; // centre of each bentwood side
  const xi = xs - 20; // its inner face
  const xt = xi - 12; // the side tubes
  const F: Vec3 = [0, 330, 320], B: Vec3 = [0, 260, -110], T: Vec3 = [0, H - 20, -D / 2 + 30];
  const yArm = 585, zArmBack = -215, zPost = 325;

  const parts: CustomPart[] = [];
  for (const [id, sx] of [["S1", -1], ["S2", 1]] as const) {
    const lo: Vec3 = [sx * xt, B[1], B[2]];
    const c: Vec3 = [sx * xt, (F[1] + T[1]) / 2, (F[2] + T[2]) / 2];
    parts.push({
      id,
      name: "Side tube",
      size: [TUBE, T[1] - B[1] + TUBE, F[2] - T[2] + TUBE],
      pos: c,
      material: "metal",
      pieces: [along("cyl", lo, [sx * xt, F[1], F[2]], c, TUBE, TUBE), along("cyl", lo, [sx * xt, T[1], T[2]], c, TUBE, TUBE)],
    });
  }
  const rod = (id: string, name: string, p: Vec3): CustomPart => ({ id, name, shape: "cyl", size: [2 * xt - TUBE, TUBE, TUBE], pos: p, material: "metal" });
  parts.push(rod("X", "Cross tube", B), rod("TT", "Top tube", T), rod("FT", "Front tube", F));

  // the covers, as thick pads over the seat and the back
  const pad = (id: string, name: string, a: Vec3, b: Vec3, n: [number, number]): CustomPart => {
    const dy = b[1] - a[1], dz = b[2] - a[2];
    return { id, name, size: [2 * xt + 20, Math.hypot(dy, dz) + 40, 50], pos: [0, (a[1] + b[1]) / 2 + n[0], (a[2] + b[2]) / 2 + n[1]], rot: [Math.atan2(dz, dy), 0, 0], material: "soft" };
  };
  parts.push(pad("CB", "Back cover", B, T, [8, 24]), pad("CS", "Seat cover", B, F, [24, -4]));

  // a bentwood side: armrest, front leg and floor runner bent in one loop
  for (const [id, sx] of [["L", -1], ["R", 1]] as const) {
    const c: Vec3 = [sx * xs, (yArm + 25) / 2, 0];
    const box = (size: Vec3, p: Vec3): PartPiece => ({ shape: "box", size, pos: [p[0] - c[0], p[1] - c[1], p[2] - c[2]] });
    parts.push({
      id,
      name: "Side frame",
      size: [40, yArm + 25, D],
      pos: c,
      material: "wood",
      pieces: [
        box([40, 50, zPost + 25 - zArmBack], [sx * xs, yArm, (zPost + 25 + zArmBack) / 2]),
        box([40, yArm, 50], [sx * xs, yArm / 2, zPost]),
        box([40, 30, zPost + 25 + D / 2], [sx * xs, 15, (zPost + 25 - D / 2) / 2]),
      ],
    });
  }
  const yRail = 270, zBack = -D / 2 + 30;
  parts.push({ id: "RF", name: "Rail", size: [2 * xi, 50, 30], pos: [0, yRail, zPost], material: "wood" });
  parts.push({ id: "RB", name: "Rail", size: [2 * xi, 30, 50], pos: [0, 15, zBack], material: "wood" });

  // one fitting at each end, from the outside of the side tube in towards the middle
  const tubeEnds = (kind: CustomFix["kind"], p: Vec3, mate: string, o: Partial<CustomFix>): CustomFix[] =>
    ([[-1, "S1"], [1, "S2"]] as const).map(([sx, on]) => at(kind, [[sx * (xt + 10), p[1], p[2]]], [-sx, 0, 0], on, mate, o));
  const sideScrews = (id: "L" | "R") => {
    const sx = id === "L" ? -1 : 1;
    return [
      at("screw", [[sx * (xs + 20), yArm, zArmBack + 15]], [-sx, 0, 0], id, sx < 0 ? "S1" : "S2", { len: 70, dia: 6 }),
      at("screw", [[sx * (xs + 20), F[1], zPost]], [-sx, 0, 0], id, sx < 0 ? "S1" : "S2", { len: 70, dia: 6 }),
    ];
  };
  const railEnd = (id: "RF" | "RB", sx: number): Vec3[] => {
    const y = id === "RF" ? yRail : 15, z = id === "RF" ? zPost : zBack;
    return id === "RF" ? [[sx * xi, y - 12, z], [sx * xi, y + 12, z]] : [[sx * xi, y, z - 12], [sx * xi, y, z + 12]];
  };

  return {
    parts,
    steps: [
      {
        title: "Bolt the side tubes to the cross tube",
        detail: "Lay the two bent tubes on a rug with their curves the same way. Turn the bolts in by hand first, then tighten.",
        add: ["S1", "S2", "X"],
        fix: tubeEnds("bolt", B, "X", { len: 30, dia: 6 }),
        tools: ["allen"],
        warnings: ["floor"],
      },
      {
        title: "Screw the top tube between them",
        detail: "Push it onto the tops of the side tubes so the holes line up, one screw at each end.",
        add: ["TT"],
        fix: tubeEnds("screw", T, "TT", { len: 12, dia: 4 }),
        tools: ["screwdriver"],
      },
      {
        title: "Screw the front tube on",
        detail: "Same at the front of the seat: one screw at each end.",
        add: ["FT"],
        fix: tubeEnds("screw", F, "FT", { len: 12, dia: 4 }),
        tools: ["screwdriver"],
      },
      {
        title: "Pull the back cover down over the frame",
        detail: "Start at the top and work it down evenly on both sides. Fold the flaps at the bottom round the cross tube and press them shut.",
        add: ["CB"],
        from: { CB: [0, 400, 0] },
      },
      {
        title: "Pull the seat cover on from the front",
        detail: "Ease it over the front tube and back towards the cross tube, then fold its flaps underneath and tuck them in.",
        add: ["CS"],
        from: { CS: [0, 0, 300] },
      },
      {
        title: "Screw a side frame to the tube frame",
        detail: "Lay the seat on its side on a rug and the side frame on top. Use the shorter of the long screws: one at the back of the armrest, one at the front leg.",
        add: ["R"],
        fix: sideScrews("R"),
        tools: ["allen"],
        pose: "+x",
        warnings: ["floor"],
      },
      {
        title: "Tap the dowels into the rails",
        detail: "Two dowels in each end of both rails.",
        fix: [
          ...[-1, 1].map((sx) => at("dowel", railEnd("RF", sx), [-sx, 0, 0], "RF", sx < 0 ? "L" : "R")),
          ...[-1, 1].map((sx) => at("dowel", railEnd("RB", sx), [-sx, 0, 0], "RB", sx < 0 ? "L" : "R")),
        ],
        tools: ["hammer"],
        wait: ["RF", "RB"],
      },
      {
        title: "Turn it over and push the rails into the side frame",
        detail: "The fitted side frame now lies on the rug. The round holes in the rails face the way the manual shows, ready for the barrel nuts.",
        add: ["RF", "RB"],
        pose: "-x",
      },
      {
        title: "Fit the other side frame and screw it on",
        detail: "Lower it onto the dowels in the rails, then screw it to the tube frame like the first one.",
        add: ["L"],
        fix: sideScrews("L"),
        tools: ["allen"],
      },
      {
        title: "Bolt the rails to both sides",
        detail: "Lay the chair on its back. Drop a barrel nut into each rail with its slot facing the bolt, then turn the long bolts in through the sides.",
        fix: [
          at("nut", [-1, 1].map((sx) => [sx * (xi - 25), yRail + 25, zPost] as Vec3), [0, -1, 0], "RF", undefined, { name: "Barrel nut", len: 14, dia: 10 }),
          at("nut", [-1, 1].map((sx) => [sx * (xi - 25), 30, zBack] as Vec3), [0, -1, 0], "RB", undefined, { name: "Barrel nut", len: 14, dia: 10 }),
          ...[-1, 1].map((sx) => at("bolt", [[sx * (xs + 20), yRail, zPost], [sx * (xs + 20), 15, zBack]], [-sx, 0, 0], sx < 0 ? "L" : "R", "RF", { len: 90, dia: 6 })),
        ],
        tools: ["allen"],
        pose: "+z",
      },
      { title: "Stand the chair up", detail: "Lift it by the side frames and check it rocks gently on its runners without wobbling sideways.", pose: "+y" },
    ],
  };
}

const family: Family = {
  names: ["ÅRSUNDA", "ARSUNDA"],
  recipe(s) {
    if (/armchair/i.test(s.variant) || /arsunda-armchair/.test(s.slug ?? "")) return armchair(s);
    return null;
  },
};
export default family;

import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, ProductSpec, Vec3 } from "../../types";

/**
 * ÖVNING, read from the trolley's manual (the build with the metal compartment on the left; the other hand is the
 * same steps mirrored). A low box and a tall box go together on dowels, with shelf locks screwed in for the two
 * shelves, and are joined by two connecting screws. The base with four castors goes on upside down with six more.
 * Standing, two perforated panels slide in above the low box, the metal tray is put together and screwed on top,
 * then the shelves, their four stops and the hook.
 */

const t = 18;

function trolley(s: ProductSpec): CustomParams {
  // IKEA: 54 long, 33 wide, 70 high
  const W = s.size.w * 10 || 540, D = s.size.d * 10 || 330, H = s.size.h * 10 || 700;
  const yBase = 75, yFloor = yBase + t; // castors under the base
  const yTop = H - 110; // the tray stands 11 cm above the boxes
  const yLow = 450; // top of the low box, under the metal compartment
  const xO = W / 2, xD = -40; // the divider between the two columns
  const xL = -xO + t, xR = xO - t;
  const zs = [-D / 2 + 50, 0, D / 2 - 50];
  const box = (id: string, name: string, x0: number, x1: number, y0: number, y1: number, z0 = -D / 2, z1 = D / 2, material: CustomPart["material"] = "board"): CustomPart => ({
    id,
    name,
    size: [x1 - x0, y1 - y0, z1 - z0],
    pos: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
    material,
  });
  const ySh1 = 280, ySh2 = 390;
  // a tray end, its two edges bent round as tabs that sit inside the long sides and take the corner screws
  const trayEnd = (id: string, sx: number): CustomPart => ({
    ...box(id, "Tray end", sx < 0 ? -xO : xO - 14, sx < 0 ? -xO + 14 : xO, yTop, H, -D / 2 + 2, D / 2 - 2, "metal"),
    pieces: [
      { shape: "box", size: [2, H - yTop, D - 4], pos: [sx * 6, 0, 0] },
      ...[-1, 1].map((sz) => ({ shape: "box" as const, size: [12, H - yTop, 2] as Vec3, pos: [-sx, 0, sz * (D / 2 - 3)] as Vec3 })),
    ],
  });
  const parts: CustomPart[] = [
    box("C1B", "Bottom", xL, xD - t / 2, yFloor, yFloor + t),
    box("C1S", "Side panel", -xO, xL, yFloor, yLow + t),
    box("C1T", "Top", xL, xD - t / 2, yLow, yLow + t),
    box("C2B", "Bottom", xD + t / 2, xR, yFloor, yFloor + t),
    box("DIV", "Divider", xD - t / 2, xD + t / 2, yFloor, yTop - t),
    box("C2S", "Side panel", xR, xO, yFloor, yTop - t),
    box("C2T", "Top", -xO, xO, yTop - t, yTop),
    box("BASE", "Base", -xO, xO, yBase, yFloor),
    // the front panel's bottom edge is folded in, a lip that lies on the low box and takes two screws
    { ...box("MF", "Perforated panel", xL, xD - t / 2, yLow + t, yTop - t, D / 2 - 20, D / 2, "metal"), pieces: [
      { shape: "box", size: [xD - t / 2 - xL, yTop - yLow - 2 * t, 2], pos: [0, 0, 9] },
      { shape: "box", size: [xD - t / 2 - xL, 2, 20], pos: [0, -(yTop - yLow - 2 * t) / 2 + 1, 0] },
    ] },
    box("MS", "Perforated panel", -xO, -xO + 2, yLow + t, yTop - t, -D / 2, D / 2, "metal"),
    box("TRP", "Tray bottom", -xO, xO, yTop, yTop + 2, -D / 2, D / 2, "metal"),
    box("TRF", "Tray side", -xO, xO, yTop, H, D / 2 - 2, D / 2, "metal"),
    box("TRK", "Tray side", -xO, xO, yTop, H, -D / 2, -D / 2 + 2, "metal"),
    trayEnd("TRL", -1),
    trayEnd("TRR", 1),
    box("SH1", "Shelf", xL, xD - t / 2, ySh1, ySh1 + t, -D / 2 + 10, D / 2 - 10),
    box("SH2", "Shelf", xD + t / 2, xR, ySh2, ySh2 + t, -D / 2 + 10, D / 2 - 10),
  ];
  const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });
  const DOW = { len: 30, dia: 8 };
  const row = (x: number, y: number, n = 3): Vec3[] => (n === 2 ? [zs[0], zs[2]] : zs).map((z): Vec3 => [x, y, z]);
  const cy = (id: string) => parts.find((p) => p.id === id)!.pos[1];
  const LOCK = { name: "Shelf lock", len: 15, dia: 12 };
  const lock = (x: number, y: number, dir: Vec3, on: string) => at("clip", [[x, y, -D / 2 + 60], [x, y, D / 2 - 60]], dir, on, undefined, LOCK);
  const CONN = { name: "Connecting screw", len: 60, dia: 5 };
  const tray = ["TRP", "TRF", "TRK", "TRL", "TRR"];
  const aside: Vec3 = [0, 0, -700];
  return {
    parts,
    steps: [
      {
        title: "Tap the dowels into the low box",
        detail: "On a rug: ten dowels in the ends of its top and bottom.",
        add: ["C1B"],
        fix: [
          at("dowel", row(xL, cy("C1B")), [-1, 0, 0], "C1B", "C1S", DOW),
          at("dowel", row(xL, cy("C1T")), [-1, 0, 0], "C1T", "C1S", DOW),
          at("dowel", row(xD - t / 2, cy("C1B"), 2), [1, 0, 0], "C1B", "DIV", DOW),
          at("dowel", row(xD - t / 2, cy("C1T"), 2), [1, 0, 0], "C1T", "DIV", DOW),
        ],
        wait: ["C1T"],
        from: { C1T: aside },
        tools: ["hammer"],
        warnings: ["floor"],
      },
      { title: "Screw two shelf locks into the side panel", detail: "Screw them in with the screwdriver, then turn the lock so its open side faces up.", fix: [lock(xL, ySh1, [-1, 0, 0], "C1S")], wait: ["C1S"], tools: ["screwdriver"] },
      { title: "Press the side panel on", detail: "Push it onto the dowels in the bottom, shelf locks facing in.", add: ["C1S"] },
      { title: "Press the top on", detail: "Onto the dowels at the top of the side panel.", add: ["C1T"] },
      {
        title: "Tap the dowels into the tall box",
        detail: "Twelve: three in the top of the divider and of the side panel, three in each end of the bottom.",
        fix: [
          at("dowel", row(xD, yTop - t), [0, 1, 0], "DIV", "C2T", DOW),
          at("dowel", row(xR + t / 2, yTop - t), [0, 1, 0], "C2S", "C2T", DOW),
          at("dowel", row(xD + t / 2, cy("C2B")), [-1, 0, 0], "C2B", "DIV", DOW),
          at("dowel", row(xR, cy("C2B")), [1, 0, 0], "C2B", "C2S", DOW),
        ],
        wait: ["C2B", "DIV", "C2S"],
        from: { C2B: [700, 0, 0], DIV: [700, 0, 0], C2S: [700, 0, 0] },
        tools: ["hammer"],
      },
      { title: "Screw four shelf locks into the divider", detail: "Two on each face.", fix: [lock(xD - t / 2, ySh1, [1, 0, 0], "DIV"), lock(xD + t / 2, ySh2, [-1, 0, 0], "DIV")], tools: ["screwdriver"] },
      { title: "Screw two shelf locks into the other side panel", fix: [lock(xR, ySh2, [1, 0, 0], "C2S")], tools: ["screwdriver"] },
      { title: "Press the divider onto the bottom", detail: "Shelf locks to the inside.", add: ["C2B", "DIV"] },
      { title: "Press the side panel on", add: ["C2S"] },
      { title: "Press the long top on", detail: "It covers both boxes, so line it up with the divider and side panel.", add: ["C2T"] },
      { title: "Slide the low box against the divider", detail: "Its dowels go into the holes in the divider, and the tall box's top overhangs it." },
      {
        title: "Join the two boxes",
        detail: "Turn the two connecting screws in through the divider with the Allen key.",
        fix: [at("bolt", [[xD + t / 2, cy("C1T"), 60]], [-1, 0, 0], "DIV", "C1T", CONN), at("bolt", [[xD + t / 2, cy("C1B"), 60]], [-1, 0, 0], "DIV", "C1B", CONN)],
      },
      {
        title: "Screw the castors to the base",
        detail: "Four screws each. The two with a brake go at the front.",
        fix: [
          at("castor", [[-xO + 50, yBase, D / 2 - 50], [xO - 50, yBase, D / 2 - 50]], [0, 1, 0], "BASE", undefined, { name: "Castor with brake", len: 75, dia: 50 }),
          at("castor", [[-xO + 50, yBase, -D / 2 + 50], [xO - 50, yBase, -D / 2 + 50]], [0, 1, 0], "BASE", undefined, { len: 75, dia: 50 }),
          at("screw", [-1, 1].flatMap((sx) => [-1, 1].flatMap((sz) => [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]): Vec3 => [sx * (xO - 50) + a * 22, yBase, sz * (D / 2 - 50) + b * 22]))), [0, 1, 0], "BASE", undefined, { len: 16, dia: 4 }),
        ],
        wait: ["BASE"],
        from: { BASE: [0, 0, 700] },
      },
      { title: "Turn the boxes over and put the base on", detail: "Lay them upside down on a rug and press the base onto the bottom edges, castors up.", add: ["BASE"], pose: "-y", warnings: ["floor"] },
      {
        title: "Screw the base on",
        detail: "Six connecting screws, two into each upright panel.",
        fix: [at("bolt", [xO - t / 2, xD, -xO + t / 2].flatMap((x) => [[x, yBase, -D / 2 + 60], [x, yBase, D / 2 - 60]] as Vec3[]), [0, 1, 0], "BASE", undefined, CONN)],
      },
      { title: "Slide in the perforated panels", detail: "Stand the trolley up. Hook both panels into the slots above the low box, one at the front and one at the side.", add: ["MF", "MS"], pose: "+y", from: { MF: [0, 0, 300], MS: [-300, 0, 0] } },
      { title: "Screw the front panel down", detail: "Two connecting screws through its bottom edge into the low box.", fix: [at("bolt", [[xL + 30, yLow + t + 2, D / 2 - 10], [xD - t / 2 - 30, yLow + t + 2, D / 2 - 10]], [0, -1, 0], "MF", "C1T", CONN)] },
      {
        title: "Put the tray together",
        detail: "Hook the two ends onto the long sides, then lay the bottom sheet in so its tabs sit in the slots.",
        wait: tray,
        from: Object.fromEntries(tray.map((id) => [id, aside])),
      },
      {
        title: "Screw the tray's corners",
        detail: "One screw in each corner. Use the short screws here, not the countersunk ones.",
        fix: [-1, 1].map((sz) => at("screw", [-1, 1].map((sx): Vec3 => [sx * (xO - 7), yTop + 60, sz * D / 2]), [0, 0, -sz], sz < 0 ? "TRK" : "TRF", undefined, { len: 10, dia: 4, to: ["TRL", "TRR"] })),
      },
      { title: "Set the tray on top", detail: "Push its four tabs into the slots in the top and slide it back until it stops.", add: tray, from: Object.fromEntries(tray.map((id) => [id, [0, 250, 0] as Vec3])) },
      { title: "Screw the tray to the top", detail: "Four connecting screws through the tray's bottom.", fix: [at("bolt", [-1, 1].flatMap((sx) => [[sx * 150, yTop + 2, -80], [sx * 150, yTop + 2, 80]] as Vec3[]), [0, -1, 0], "TRP", "C2T", CONN)] },
      { title: "Fix the perforated panels to the tray", detail: "Two countersunk screws down through the tray.", fix: [at("screw", [[xL + 30, yTop + 2, D / 2 - 6], [-xO + 6, yTop + 2, 0]], [0, -1, 0], "TRP", undefined, { len: 12, dia: 4 })] },
      { title: "Lay the shelves on their locks", detail: "Press each shelf down until the four locks under it hold it.", add: ["SH1", "SH2"] },
      {
        title: "Screw on the shelf stops",
        detail: "Two at the back of each shelf. Screw them by hand, not with a drill.",
        fix: [
          at("clip", [[-200, ySh1 + t + 32, -D / 2 + 30], [-90, ySh1 + t + 32, -D / 2 + 30], [40, ySh2 + t + 32, -D / 2 + 30], [180, ySh2 + t + 32, -D / 2 + 30]], [0, -1, 0], "SH1", undefined, { name: "Shelf stop", len: 30, dia: 20, to: ["SH1", "SH2"] }),
          at("screw", [[-200, ySh1 + t + 8, -D / 2 + 30], [-90, ySh1 + t + 8, -D / 2 + 30], [40, ySh2 + t + 8, -D / 2 + 30], [180, ySh2 + t + 8, -D / 2 + 30]], [0, -1, 0], "SH1", undefined, { len: 12, dia: 3.5, to: ["SH1", "SH2"] }),
        ],
        tools: ["screwdriver"],
      },
      { title: "Hang the hook", detail: "Clip it into any of the holes in the tray or the panels. Lock the front castors to keep the trolley still.", fix: [at("hook", [[-xO + 90, H - 50, D / 2]], [0, 0, -1], "TRF", undefined, { len: 50, dia: 40 })] },
    ],
  };
}

const family: Family = {
  names: ["ÖVNING", "OVNING"],
  recipe: (s) => (/trolley/i.test(`${s.variant} ${s.slug ?? ""}`) ? trolley(s) : null),
};
export default family;

import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * RELATERA desks, read from the two underframe manuals (fixed height, and sit/stand with a crank).
 * The beam comes in two halves that slide together to the width of the top and are bolted with four bolts and nuts.
 * The frame is built upside down: the legs push onto the beam's ends and take ten shoulder bolts (in loosely, then
 * tightened), the top supports bolt onto the legs, the foot bars go on with four long bolts each and the adjustable
 * feet screw in. The fixed desk gets its hook here; the sit/stand one is turned over first so the drive shaft can
 * drop into the beam and click into both gearboxes, then the crank goes on one end and the hook on the other.
 * The frame is lowered onto the top lying face down on a rug and screwed on, two people turn it over, the cable
 * tray gets its pads and hooks onto the beam, and plugs go into the top's holes (four on the 117 cm top, three on 90).
 * IKEA's widths (91, 118, 101, 128 cm) include the hook and the crank; the top is 90 or 117 by 60.
 */

const T = 19; // table top
const LW = 60, LD = 40; // leg column

/** The top's own size from the slug ("relatera-desk-sit-stand-117-x-60"), in mm. */
function topOf(s: ProductSpec): [number, number] {
  const m = /(\d{2,3})-x-(\d{2})$/.exec(s.slug ?? "");
  return m ? [+m[1] * 10, +m[2] * 10] : [s.size.w * 10, s.size.d * 10];
}

function recipe(s: ProductSpec) {
  if (!/^relatera-desk/.test(s.slug ?? "")) return null;
  const sit = /sit-stand/.test(s.slug ?? "");
  const [TW, TD] = topOf(s);
  const W = s.size.w * 10;
  const H = s.size.h * 10;
  const yU = H - T; // underside of the top
  const xl = TW / 2 - 120; // legs
  const zl = -60;
  const footY = 12, footH = 26;
  const legY0 = footY + footH, legY1 = yU - 30;
  const xb = xl; // beam ends: they slide into the heads on top of the legs

  const parts: CustomPart[] = [];
  parts.push({ id: "TOP", name: "Table top", size: [TW, T, TD], pos: [0, H - T / 2, 0] });
  // the beam: two steel channels, open at the top, the second sliding inside the first
  const half = xb + 120;
  // each half has a tab across its top, halfway along, for a screw up into the top
  const channel = (len: number, d: number, h: number, tab: number): PartPiece[] => [
    { shape: "box", size: [len, 3, d], pos: [0, -h / 2 + 1.5, 0] },
    ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [len, h, 3], pos: [0, 0, sz * (d / 2 - 1.5)] })),
    { shape: "box", size: [30, 3, d], pos: [tab, h / 2 - 1.5, 0] },
  ];
  parts.push({ id: "BA", name: "Beam half", size: [half, 50, 60], pos: [-xb + half / 2, yU - 25, zl], material: "metal", pieces: channel(half, 60, 50, -xb * 0.5 - (-xb + half / 2)) });
  parts.push({ id: "BB", name: "Beam half, inner", size: [half, 46, 53], pos: [xb - half / 2, yU - 27, zl], material: "metal", pieces: channel(half, 53, 46, xb * 0.5 - (xb - half / 2)) });

  // the head on top of each leg takes the beam's end (on the sit/stand legs it holds the gearbox)
  const headY = yU - 45, headH = 30; // the head's middle, relative to the floor
  const legPieces = (len: number): PartPiece[] => {
    const head: PartPiece = { shape: "box", size: [LW + 16, headH, 70], pos: [0, headY - (legY0 + legY1) / 2, 0] };
    return sit
      ? [
          { shape: "box", size: [LW + 10, len * 0.5, LD + 10], pos: [0, -len * 0.25, 0] },
          { shape: "box", size: [LW, len * 0.5, LD], pos: [0, len * 0.25, 0] },
          head,
        ]
      : [{ shape: "box", size: [LW, len, LD], pos: [0, 0, 0] }, head];
  };
  const legLen = legY1 - legY0;
  for (const sx of [-1, 1]) {
    parts.push({ id: `L${sx}`, name: "Leg", size: [LW + 16, legLen, 70], pos: [sx * xl, (legY0 + legY1) / 2, zl], material: "metal", pieces: legPieces(legLen) });
    parts.push({ id: `S${sx}`, name: "Top support", size: [50, 30, TD - 120], pos: [sx * xl, yU - 15, 0], material: "metal" });
    parts.push({ id: `F${sx}`, name: "Foot bar", size: [70, footH, TD - 40], pos: [sx * xl, footY + footH / 2, 0], material: "metal" });
  }
  if (sit) {
    parts.push({ id: "SH", name: "Drive shaft", size: [2 * xl - 40, 14, 14], pos: [0, yU - 30, zl], shape: "cyl", material: "metal" });
    // the crank folds against the right end, its handle out past the top
    const reach = Math.max(80, W - TW);
    // its bracket plate sits on the outer face of the right leg's head
    const x0 = xl + (LW + 16) / 2, x1 = TW / 2 + reach - 20;
    const crank: PartPiece[] = [
      { shape: "box", size: [6, 30, 50], pos: [-(x1 - x0) / 2 + 3, 0, 0] },
      { shape: "box", size: [x1 - x0 - 6, 20, 30], pos: [3, -20, 0] },
      { shape: "cyl", size: [22, 90, 22], pos: [(x1 - x0) / 2, -65, 0] },
    ];
    parts.push({ id: "CR", name: "Crank", size: [x1 - x0, 130, 50], pos: [(x0 + x1) / 2, headY, zl + 20], material: "metal", pieces: crank });
  }
  // the cable tray hangs from the back of the beam
  const trW = Math.round(TW * 0.45), trH = 90, trD = 90;
  const tray: PartPiece[] = [
    { shape: "box", size: [trW, 3, trD], pos: [0, -trH / 2 + 1.5, 0] },
    { shape: "box", size: [trW, trH, 3], pos: [0, 0, -trD / 2 + 1.5] },
    { shape: "box", size: [trW, trH * 0.6, 3], pos: [0, -trH * 0.2, trD / 2 - 1.5] },
  ];
  const zTray = zl - 30 - trD / 2;
  parts.push({ id: "TR", name: "Cable tray", size: [trW, trH, trD], pos: [0, yU - 15 - trH / 2, zTray], material: "metal", pieces: tray });

  const sides = [-1, 1];
  const beamBolts: CustomFix[] = sides.map((sz) => ({
    kind: "bolt",
    count: 2,
    len: 16,
    dia: 6,
    at: [-40, 40].map((x): Vec3 => [x, yU - 25, zl + sz * 30]),
    dir: [0, 0, -sz] as Vec3,
    on: "BA",
    mate: "BB",
  }));
  const beamNuts: CustomFix = { kind: "nut", count: 4, len: 6, dia: 6, at: sides.flatMap((sz) => [-40, 40].map((x): Vec3 => [x, yU - 25, zl - sz * 27])), dir: [0, 0, 1], on: "BB" };
  const SHOULDER = { kind: "bolt" as const, name: "Shoulder bolt", len: 20, dia: 8 };
  const legBolts: CustomFix[] = [
    // down through the beam's floor into the head, and two through each face of the head into the beam's sides
    { ...SHOULDER, count: 2, at: sides.map((sx): Vec3 => [sx * xb, yU - 47, zl]), dir: [0, -1, 0] },
    ...sides.flatMap((sx) =>
      sides.map((sz): CustomFix => ({ ...SHOULDER, count: 2, at: [-15, 15].map((dx): Vec3 => [sx * xb + dx, headY, zl + sz * 35]), dir: [0, 0, -sz] as Vec3, on: `L${sx}` })),
    ),
  ];
  const supportBolts: CustomFix[] = sides.map((sx) => ({ kind: "bolt", count: 2, len: 12, dia: 8, at: [-40, 40].map((dz): Vec3 => [sx * (xl - 25), yU - 15, zl + dz]), dir: [sx, 0, 0] as Vec3, on: `S${sx}`, mate: `L${sx}` }));
  const footBolts: CustomFix[] = sides.map((sx) => ({
    kind: "bolt",
    count: 4,
    len: 50,
    dia: 8,
    at: [-1, 1].flatMap((dx) => [-1, 1].map((dz): Vec3 => [sx * xl + dx * 16, footY, zl + dz * 12])),
    dir: [0, 1, 0],
    on: `F${sx}`,
    mate: `L${sx}`,
  }));
  const feet: CustomFix = { kind: "foot", name: "Adjustable foot", count: 4, len: 12, dia: 34, at: sides.flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xl, footY, sz * (TD / 2 - 60)])), dir: [0, 1, 0] };
  const hookSide = sit ? -1 : 1;
  const hookAt: Vec3 = [hookSide * xl, yU - 30, TD / 2 - 64];
  const hook: CustomFix[] = [
    { kind: "hook", count: 1, at: [hookAt], dir: [0, 0, -1], on: `S${hookSide}` },
    { kind: "screw", count: 2, len: 10, dia: 5, at: [-1, 1].map((d): Vec3 => [hookAt[0], hookAt[1] + 2, hookAt[2] + d * 24]), dir: [0, 1, 0], on: `S${hookSide}` },
  ];
  const topScrews: CustomFix = { kind: "screw", count: 4, len: 16, dia: 6, at: sides.flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xl, yU - 30, sz * (TD / 2 - 150)])), dir: [0, 1, 0], mate: "TOP" };
  const beamScrews: CustomFix = { kind: "screw", count: 2, len: 12, dia: 4, at: [-1, 1].map((sx): Vec3 => [sx * xb * 0.5, yU - 3, zl]), dir: [0, 1, 0], mate: "TOP" };
  const pads: CustomFix = { kind: "glide", name: "Adhesive pad", count: 2, len: 2, dia: 30, at: [-1, 1].map((sx): Vec3 => [(sx * trW) / 3, yU - 40, zTray + trD / 2]), dir: [0, 0, -1], on: "TR" };
  const nPlugs = TW >= 1100 ? 4 : 3;
  const plugs: CustomFix = {
    kind: "cap",
    name: "Hole plug",
    count: nPlugs,
    len: 12,
    dia: 30,
    at: Array.from({ length: nPlugs }, (_, i): Vec3 => [-TW / 2 + 120 + ((TW - 240) * i) / (nPlugs - 1), H, -TD / 2 + 50]),
    dir: [0, -1, 0],
    on: "TOP",
  };

  const steps: CustomStep[] = [
    {
      title: "Slide the two beam halves together",
      detail: `Set them to the ${TW >= 1100 ? "117" : "90"} cm top: the holes in the two halves line up at that width.`,
      add: ["BA", "BB"],
      from: { BB: [400, 0, 0] },
    },
    { title: "Bolt the halves together", detail: "Four bolts through the sides, a nut on each inside. Tighten them with the crank key.", fix: [...beamBolts, beamNuts], tools: ["allen", "wrench"] },
    {
      title: "Push the legs onto the ends of the beam",
      detail: "Turn the beam upside down on the floor first. Each leg slides over a beam end.",
      add: ["L-1", "L1"],
      pose: "-y",
      warnings: ["floor"],
      from: { "L-1": [-300, 0, 0], L1: [300, 0, 0] },
    },
    { title: "Turn the shoulder bolts in loosely", detail: "One down through each beam end and four through each leg. Leave them a few turns short for now.", fix: legBolts, tools: ["allen"] },
    { title: "Tighten all ten bolts", detail: "Now that both legs sit square on the beam, turn each one until its head sits flat.", tools: ["allen"], check: "square" },
    { title: "Bolt on the top supports", detail: "One across the end of each leg, two bolts each.", add: ["S-1", "S1"], fix: supportBolts, tools: ["allen"] },
    ...(sit ? [] : [{ title: "Screw the hook onto a top support", detail: "On the right one, at the front end. Two screws.", fix: hook, tools: ["screwdriver" as const] }]),
    { title: "Bolt on the foot bars", detail: "Four long bolts through each into the end of its leg, driven with the crank key.", add: ["F-1", "F1"], fix: footBolts, tools: ["allen"] },
    { title: "Screw in the adjustable feet", detail: "One into each end of the foot bars, all the way in for now.", fix: [feet] },
  ];
  if (sit)
    steps.push(
      {
        title: "Turn it over and fit the drive shaft",
        detail: "Stand the frame on its feet together. Drop the shaft into the beam and push each end into the gearbox on top of its leg.",
        add: ["SH"],
        pose: "+y",
        people: 2,
        from: { SH: [0, 250, 0] },
      },
      { title: "Click the shaft together", detail: "Push the two halves of the shaft in the middle until they click. It must turn both gearboxes at once." },
      {
        title: "Screw the crank onto one gearbox",
        detail: "Choose the side you want it on. Four screws hold its bracket on the gearbox.",
        add: ["CR"],
        fix: [{ kind: "screw", count: 4, len: 12, dia: 5, at: [-1, 1].flatMap((dy) => [-1, 1].map((dz): Vec3 => [xl + (LW + 16) / 2 + 6, headY + dy * 12, zl + 20 + dz * 12])), dir: [-1, 0, 0], on: "CR", mate: "L1" }],
        tools: ["screwdriver"],
        from: { CR: [250, 0, 0] },
      },
      { title: "Screw the hook onto the other side", detail: "At the front end of the top support, two screws.", fix: hook, tools: ["screwdriver"] },
    );
  steps.push(
    {
      title: "Screw the frame onto the top",
      detail: sit
        ? "Lay the top face down on a rug and turn the frame upside down onto it together, supports on the screw holes. Four screws."
        : "Lay the top face down on a rug and lower the frame onto it, supports on the screw holes. Four screws.",
      add: ["TOP"],
      fix: [topScrews],
      pose: "-y",
      people: sit ? 2 : 1,
      tools: ["screwdriver"],
      warnings: ["floor"],
      from: { TOP: [0, 300, 0] },
    },
    { title: "Screw the beam to the top", detail: "Two screws up through the middle of the beam.", fix: [beamScrews], tools: ["screwdriver"] },
    { title: "Turn the desk over together", detail: "Lift it by the top, one at each end, and stand it on its feet.", pose: "+y", people: 2 },
    { title: "Stick the pads onto the cable tray", detail: "Cut the pad sheet in two and press one piece on the back of the tray near each end.", add: ["TR"], fix: [pads], from: { TR: [0, -260, 0] } },
    { title: "Hook the cable tray onto the beam", detail: "Push its tabs up into the slots at the back of the beam, then down until it clicks." },
    {
      title: "Push the plugs into the top",
      detail: `${nPlugs} plugs into the holes along the back. Level the desk by turning the feet.`,
      fix: [plugs],
    },
  );
  return { parts, steps };
}

const family: Family = {
  names: ["RELATERA"],
  recipe,
};
export default family;

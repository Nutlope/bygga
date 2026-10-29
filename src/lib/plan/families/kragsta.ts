import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, ProductSpec, Vec3 } from "../../types";

/**
 * KRAGSTA, read from the coffee table's manual. Four splayed legs and two crossed pairs of rails: an upper rail under
 * the top and a lower one near the floor. Each frame (two legs and a pair of rails) is put together on a rug: the
 * lower rail with a cross dowel and a long bolt through the leg, the upper rail on cam pins and cam locks. The first
 * frame is set on the upside-down top and bolted into it, the second crosses it at the rails' notches and is bolted
 * the same way, and one screw holds the lower rails where they cross. Then the table is turned over.
 */

const BOLT = { len: 100, dia: 6, name: "Long bolt" };

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 90 across, 48 high
  const Dm = s.size.w * 10 || 900, H = s.size.h * 10 || 480;
  const tT = 30, yU = H - tT; // underside of the top
  const r0 = Dm / 2 - 50, r1 = r0 - 100; // legs at the floor and under the top
  const q = 45, rt = 28; // leg and rail sections
  const rL = (y: number) => r0 - ((r0 - r1) * y) / yU;
  const tilt = Math.atan2(r0 - r1, yU), legL = Math.hypot(r0 - r1, yU);
  const yUR = yU - 30, hUR = 60, yLR = 130, hLR = 50;
  const inUR = rL(yUR) - q / 2, inLR = rL(yLR) - q / 2;
  type Ax = "x" | "z";
  const P = (ax: Ax, sg: number, r: number, y: number): Vec3 => (ax === "x" ? [sg * r, y, 0] : [0, y, sg * r]);
  const out = (ax: Ax, sg: number): Vec3 => (ax === "x" ? [sg, 0, 0] : [0, 0, sg]);
  const inw = (ax: Ax, sg: number): Vec3 => (ax === "x" ? [-sg, 0, 0] : [0, 0, -sg]);
  const legs: { id: string; ax: Ax; sg: number }[] = [
    { id: "L1", ax: "x", sg: -1 },
    { id: "L2", ax: "x", sg: 1 },
    { id: "L3", ax: "z", sg: -1 },
    { id: "L4", ax: "z", sg: 1 },
  ];
  const rail = (id: string, name: string, ax: Ax, len: number, y: number, h: number): CustomPart => ({
    id,
    name,
    size: ax === "x" ? [len, h, rt] : [rt, h, len],
    pos: [0, y, 0],
    material: "wood",
  });
  const parts: CustomPart[] = [
    { id: "T", name: "Table top", shape: "cyl", size: [Dm, tT, Dm], pos: [0, yU + tT / 2, 0], material: "wood" },
    ...legs.map(({ id, ax, sg }): CustomPart => ({
      id,
      name: "Leg",
      size: [q, legL, q],
      pos: P(ax, sg, (r0 + r1) / 2, yU / 2),
      rot: ax === "x" ? [0, 0, sg * tilt] : [-sg * tilt, 0, 0],
      material: "wood",
    })),
    rail("UR1", "Upper rail", "x", 2 * inUR, yUR, hUR),
    rail("LR1", "Lower rail", "x", 2 * inLR, yLR, hLR),
    rail("UR2", "Upper rail", "z", 2 * inUR, yUR, hUR),
    rail("LR2", "Lower rail", "z", 2 * inLR, yLR, hLR),
  ];
  const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });
  const eachLeg = (f: (l: (typeof legs)[number]) => CustomFix) => legs.map(f);
  const crossDowel = (lr: string, ax: Ax, sg: number) => fx("nut", [P(ax, sg, inLR - 30, yLR + hLR / 2)], [0, -1, 0], lr, { name: "Cross dowel", len: 30, dia: 10 });
  const legBolt = (leg: string, lr: string, ax: Ax, sg: number) => fx("bolt", [P(ax, sg, rL(yLR) + q / 2, yLR)], inw(ax, sg), leg, { ...BOLT, mate: lr });
  const camLocks = (ur: string, ax: Ax) => fx("cam", [-1, 1].map((sg) => P(ax, sg, inUR - 25, yUR + hUR / 2)), [0, -1, 0], ur, { dia: 15 });
  const smallDowels = (ur: string, ax: Ax) => fx("dowel", [-1, 1].map((sg) => P(ax, sg, 150, yU)), [0, -1, 0], ur, { len: 30, dia: 8 });
  const topBolts = (ur: string, ax: Ax) => fx("bolt", [-1, 1].map((sg) => P(ax, sg, 220, yUR - hUR / 2)), [0, 1, 0], ur, { ...BOLT, len: 80 });
  // the first frame is built where it ends up and the top goes on under it; the second waits behind the build until it crosses the first
  const f1 = ["L1", "L2", "UR1", "LR1"], f2 = ["L3", "L4", "UR2", "LR2"];
  const from = Object.fromEntries([["L2", [800, 0, 0]], ...f2.map((id) => [id, [0, 0, -800]])]) as Record<string, Vec3>;
  const steps: CustomStep[] = [
    {
      title: "Screw a cam pin into each leg",
      detail: "Lay the four legs on a rug and screw the pins into the holes on their inner faces, by hand.",
      fix: eachLeg(({ id, ax, sg }) => fx("camScrew", [P(ax, sg, rL(yUR) - q / 2, yUR)], out(ax, sg), id, { len: 24 })),
      wait: ["L2", ...f2.slice(0, 2)],
      from,
      warnings: ["floor"],
    },
    { title: "Screw a plastic foot into each leg", detail: "Into the hole at the bottom end, until it sits tight.", fix: eachLeg(({ id, ax, sg }) => fx("foot", [P(ax, sg, r0, 0)], [0, 1, 0], id)) },
    {
      title: "Tap a dowel into the top of each leg",
      detail: "The thick dowels go into the legs' top ends.",
      fix: eachLeg(({ id, ax, sg }) => fx("dowel", [P(ax, sg, r1, yU)], [0, -1, 0], id, { len: 40, dia: 10 })),
      tools: ["hammer"],
    },
    { title: "Push a cross dowel into a lower rail", detail: "Slot up, into the hole near one end. Its notch faces up.", add: ["LR1"], fix: [crossDowel("LR1", "x", -1)], from: { LR1: [300, 0, 0] } },
    { title: "Bolt a leg to the lower rail", detail: "Through the leg into the rail's end, so it catches the cross dowel. Not fully tight yet.", fix: [legBolt("L1", "LR1", "x", -1)], tools: ["allen"] },
    { title: "Press two cam locks into an upper rail", detail: "One near each end, arrows towards the ends.", fix: [camLocks("UR1", "x")], add: ["UR1"], from: { UR1: [300, 0, 0] } },
    { title: "Fit the upper rail onto the leg", detail: "Its end goes over the leg's cam pin. Turn the cam lock clockwise to pull it tight." },
    { title: "Fit the second leg on the other ends", detail: "Onto both rails' ends, then turn the cam lock.", add: ["L2"] },
    {
      title: "Bolt the second leg to the lower rail",
      detail: "Cross dowel first, then the long bolt. Tighten both leg bolts now.",
      fix: [crossDowel("LR1", "x", 1), legBolt("L2", "LR1", "x", 1)],
      tools: ["allen"],
    },
    { title: "Tap two dowels into the upper rail", detail: "Into the holes along its top edge.", fix: [smallDowels("UR1", "x")], tools: ["hammer"] },
    {
      title: "Bolt the first frame to the top",
      detail: "Lay the top upside down on a rug, stand the frame on it with the dowels in the holes, and screw the two long bolts through the rail into the top.",
      add: ["T"],
      fix: [topBolts("UR1", "x")],
      pose: "-y",
      warnings: ["floor"],
      from: { T: [0, 300, 0] },
    },
    { title: "Tap two dowels into the other upper rail", detail: "Along its top edge, as before.", fix: [smallDowels("UR2", "z")], wait: ["UR2"], from, tools: ["hammer"] },
    {
      title: "Bolt the third leg to the other lower rail",
      detail: "Cross dowel into the rail, then the long bolt through the leg.",
      fix: [crossDowel("LR2", "z", -1), legBolt("L3", "LR2", "z", -1)],
      wait: ["L3", "LR2"],
      from,
      tools: ["allen"],
    },
    { title: "Press two cam locks into the upper rail", detail: "One near each end.", fix: [camLocks("UR2", "z")] },
    { title: "Fit the upper rail onto the third leg", detail: "Over the cam pin, then turn the cam lock." },
    {
      title: "Lay the second frame across the first",
      detail: "The rails' notches slot into each other. Fit the last leg onto both rails' free ends and turn its cam lock.",
      add: f2,
      from: Object.fromEntries(f2.map((id) => [id, [0, -300, 0]])) as Record<string, Vec3>,
    },
    { title: "Bolt the last leg to the lower rail", detail: "Cross dowel, then the long bolt.", fix: [crossDowel("LR2", "z", 1), legBolt("L4", "LR2", "z", 1)], tools: ["allen"] },
    { title: "Press the frame down onto the top", detail: "Its dowels and the legs' dowels go into the holes in the top." },
    { title: "Bolt the second frame to the top", detail: "Two long bolts through the rail into the top.", fix: [topBolts("UR2", "z")] },
    {
      title: "Screw the lower rails together",
      detail: "One screw where they cross.",
      fix: [fx("screw", [[0, yLR - hLR / 2, 0]], [0, 1, 0], "LR1", { len: 40, dia: 4, mate: "LR2" })],
    },
    { title: "Turn the table over", detail: "Lift it by the top, not by the legs.", pose: "+y" },
  ];
  return { parts, steps };
}

const family: Family = { names: ["KRAGSTA"], recipe };
export default family;

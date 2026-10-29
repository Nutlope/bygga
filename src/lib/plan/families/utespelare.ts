import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * UTESPELARE, read from the gaming desk's manual. Four lower legs get adjustable feet and slide up into the two
 * steel A-frames, where eight bolts with cap nuts set the height. A stretcher is bolted between the frames, two top
 * rails clip onto the frames' crossbars and are bolted down. The table top and the perforated metal strip lie face
 * down on a rug and the frame goes on upside down: fourteen bolts hold them, ten clips go on for the cable net. The
 * desk is turned over, the feet levelled and the net hung under the top.
 */

type K = CustomFix["kind"];
const fx = (kind: K, at: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, mate, ...o });

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 160 x 80, 68 to 78 high (six heights)
  const W = (s.size.w || 160) * 10, D = (s.size.d || 80) * 10, H = Math.min(780, Math.max(680, (s.size.h || 68) * 10));
  const tT = 25, yTop = H - tT; // underside of the top
  const rH = 30, yRail = yTop - rH / 2; // top rails sit on the crossbars
  const cbY = yTop - rH - 15; // crossbar centre
  const afx = W / 2 - 180; // the A-frames, in from the ends
  const zFoot = D / 2 - 30, zHead = D / 2 - 150;
  const zAt = (y: number) => zHead + ((zFoot - zHead) * (cbY - y)) / cbY; // a leg's line, from under the crossbar to the floor
  const lean = Math.atan2(zFoot - zHead, cbY);
  const yUp0 = 250, yLow1 = 380;
  const leg = (y0: number, y1: number, sz: number, c: Vec3, t: number): PartPiece => {
    const len = (y1 - y0) / Math.cos(lean);
    return { shape: "box", size: [t, len, t], pos: [0, (y0 + y1) / 2 - c[1], sz * zAt((y0 + y1) / 2) - c[2]], rot: [-sz * lean, 0, 0] };
  };
  const frame = (sx: number): CustomPart => {
    const c: Vec3 = [sx * afx, (yUp0 + yTop + 10) / 2, 0];
    const yS = 300;
    return {
      id: sx < 0 ? "AL" : "AR",
      name: "A-frame",
      size: [40, yTop + 10 - yUp0, Math.max(2 * zAt(yUp0) + 40, D - 100)],
      pos: c,
      material: "metal",
      pieces: [
        { shape: "box", size: [40, 30, D - 100], pos: [0, cbY - c[1], 0] },
        // raised brackets on the crossbar, up to the top's underside, where it bolts to the top and the mesh strip
        // (the mesh strip sits 10 higher than the top's underside)
        ...[
          [D / 2 - 250, rH],
          [-D / 2 + 75, rH + 10],
        ].map(([z, h]): PartPiece => ({ shape: "box", size: [40, h, 40], pos: [0, cbY + 15 + h / 2 - c[1], z] })),
        ...[-1, 1].map((sz) => leg(yUp0, cbY - 15, sz, c, 40)),
        { shape: "box", size: [30, 30, 2 * zAt(yS)], pos: [0, yS - c[1], 0] },
      ],
    };
  };
  const lowers: CustomPart[] = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz): CustomPart => {
      const c: Vec3 = [sx * afx, yLow1 / 2, sz * zAt(yLow1 / 2)];
      return { id: `LL${sx < 0 ? "L" : "R"}${sz < 0 ? "B" : "F"}`, name: "Lower leg", size: [32, yLow1, 32], pos: c, material: "metal", pieces: [leg(15, yLow1, sz, c, 32)] };
    }),
  );
  const zTR = D / 2 - 180;
  const meshD = 150, zMesh = -D / 2 + meshD / 2;
  const yBS = cbY - 70, zBS = -zAt(cbY - 70) + 10;
  const parts: CustomPart[] = [
    ...lowers,
    frame(-1),
    frame(1),
    { id: "BS", name: "Stretcher", size: [2 * afx - 40, 40, 20], pos: [0, yBS, zBS], material: "metal" },
    ...[-1, 1].map((sz, i): CustomPart => ({ id: i ? "TRF" : "TRB", name: "Top rail", size: [W - 120, rH, 40], pos: [0, yRail, sz * zTR], material: "metal" })),
    { id: "TOP", name: "Table top", size: [W, tT, D - meshD], pos: [0, H - tT / 2, meshD / 2], material: "wood" },
    { id: "MESH", name: "Mesh strip", size: [W, 15, meshD], pos: [0, H - 7.5, zMesh], material: "metal" },
    { id: "NET", name: "Cable net", size: [2 * afx - 200, 90, 2 * zTR - 80], pos: [0, cbY - 60, 0], material: "fiber" },
  ];
  const legPt = (l: CustomPart, y: number): Vec3 => [l.pos[0], y, (l.id.endsWith("F") ? 1 : -1) * zAt(y)];
  const heightAt = lowers.flatMap((l) => [yUp0 + 25, yUp0 + 85].map((y) => ({ l, p: legPt(l, y) })));
  const nets: Vec3[] = [-1, 1].flatMap((sz) => [-500, -250, 0, 250, 500].map((x): Vec3 => [x, yTop, sz * (zTR - 60)]));
  const steps: CustomStep[] = [
    {
      title: "Screw a foot into each lower leg",
      detail: "Turn them in by hand until only the thread's last few turns show.",
      fix: lowers.map((l) => fx("foot", [legPt(l, 0)], [0, 1, 0], l.id)),
      wait: lowers.map((l) => l.id),
    },
    {
      title: "Slide the lower legs into the A-frames",
      detail: "Each one goes up inside a frame leg. Line up the holes for the height you want, all four the same.",
      add: ["AL", "AR", ...lowers.map((l) => l.id)],
      from: Object.fromEntries(lowers.map((l) => [l.id, [0, -250, 0] as Vec3])),
    },
    { title: "Thread a cap nut onto each height bolt", detail: "Eight bolts, one cap nut each, just a few turns for now." },
    {
      title: "Bolt the legs at your height",
      detail: "Two bolts through each leg, a cap nut on the other side. Hold one end with an Allen key while you turn the other.",
      fix: [
        fx("bolt", heightAt.map((h): Vec3 => [h.p[0] - 20, h.p[1], h.p[2]]), [1, 0, 0], undefined, undefined, { name: "Height bolt", len: 50, dia: 6 }),
        fx("nut", heightAt.flatMap((h): Vec3[] => [[h.p[0] - 20, h.p[1], h.p[2]], [h.p[0] + 20, h.p[1], h.p[2]]]), [1, 0, 0], undefined, undefined, { name: "Cap nut", dia: 6 }),
      ],
      tools: ["allen"],
    },
    {
      title: "Bolt the stretcher between the frames",
      detail: "One long bolt through each frame into the stretcher's ends.",
      add: ["BS"],
      fix: [-1, 1].map((sx) => fx("bolt", [[sx * (afx + 20), yBS, zBS]], [-sx, 0, 0], sx < 0 ? "AL" : "AR", "BS", { len: 120, dia: 6 })),
      tools: ["allen"],
    },
    { title: "Clip the top rails onto the crossbars", detail: "Front and back, pressed down until they snap over both crossbars.", add: ["TRB", "TRF"], from: { TRB: [0, 300, 0], TRF: [0, 300, 0] } },
    {
      title: "Bolt the rails to the frames",
      detail: "Four long bolts down through the rails into the crossbars. Then tighten the stretcher's bolts too.",
      fix: [-1, 1].flatMap((sz) => [-1, 1].map((sx) => fx("bolt", [[sx * afx, yTop, sz * zTR]], [0, -1, 0], sz < 0 ? "TRB" : "TRF", sx < 0 ? "AL" : "AR", { len: 120, dia: 6 }))),
      tools: ["allen"],
    },
    {
      title: "Lay the frame upside down on the top",
      detail: "Two of you. Put the top and the mesh strip face down on a rug, butted together, and lower the frame onto them, feet up.",
      add: ["TOP", "MESH"],
      pose: "-y",
      people: 2,
      warnings: ["floor", "two"],
    },
    {
      title: "Bolt the frame to the top",
      detail: "Five bolts through each rail and two through each crossbar, the back ones into the mesh strip.",
      fix: [
        ...[-1, 1].map((sz) => fx("bolt", [-700, -350, 0, 350, 700].map((x): Vec3 => [x, yTop - rH, sz * zTR]), [0, 1, 0], sz < 0 ? "TRB" : "TRF", "TOP", { len: 30, dia: 6 })),
        ...[-1, 1].map((sx) => fx("bolt", [[sx * afx, cbY + 13, D / 2 - 250], [sx * afx, cbY + 22, zMesh]], [0, 1, 0], sx < 0 ? "AL" : "AR", undefined, { len: 40, dia: 6 })),
      ],
      tools: ["allen"],
    },
    {
      title: "Screw on the clips for the cable net",
      detail: "Ten clips in the marked holes under the top, one small screw each.",
      fix: [fx("clip", nets, [0, 1, 0], "TOP", undefined, { name: "Net clip" }), fx("screw", nets, [0, 1, 0], "TOP", undefined, { len: 12, dia: 4 })],
      tools: ["screwdriver"],
    },
    { title: "Turn the desk over and level it", detail: "Two of you lift it onto its feet. Turn the feet until it stands steady.", pose: "+y", people: 2 },
    { title: "Hang the cable net", detail: "Hook its edges into the clips under the top, front and back.", add: ["NET"], from: { NET: [0, -300, 0] } },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["UTESPELARE"],
  recipe(s) {
    if (!/gaming desk/i.test(`${s.variant} ${s.slug ?? ""}`)) return null;
    return recipe(s);
  },
};
export default family;

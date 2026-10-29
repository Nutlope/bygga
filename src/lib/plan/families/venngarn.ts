import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";
import type { PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * VENNGARN, read from the loveseat's and the sofa's manuals (the same eleven steps and fittings, only the widths
 * differ). Four double-ended studs go into the top of the seat base, the back is lowered onto them and fastened
 * with washers and wing nuts. Each armrest, laid on the floor inside up, gets four studs and a spacer disc on each,
 * then two people push them onto the ends of the base and the back, fastened the same way from inside. Four corner
 * legs are bolted on with two bolts each and get two felt pads, then the sofa is turned up onto its legs and the
 * seat, back and scatter cushions go on. The 1.5-seat armchair's manual is the same, with two studs in the base.
 */

const AW = 260; // armrest width
const LEG_H = 80;
const ARM_H = 680;
const STUD = { name: "Double-ended stud", len: 60, dia: 8 };
const WASHER = { len: 1.5, dia: 18 };
const WING = { name: "Wing nut", len: 14, dia: 24 };

function fx(kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on?: string, o: Partial<CustomFix> = {}): CustomFix {
  return { kind, count: at.length, at, dir, on, ...o };
}

function recipe(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const xi = W / 2 - AW; // inside face of an armrest
  // the 1.5-seat armchair: two studs for the back instead of four, and one seat, back and scatter cushion
  const chair = /armchair|1-5-seat/i.test(`${s.slug ?? ""} ${s.variant}`);
  const deck = 400; // top of the seat base
  const backTop = H - 160; // the back's frame, under the back cushions
  const seatTop = 530;
  const zb0 = -D / 2 + 10, zb1 = zb0 + 200; // the back frame, front to back
  const parts: CustomPart[] = [
    { id: "BASE", name: "Seat base", size: [2 * xi, deck - LEG_H, D - 20], pos: [0, (LEG_H + deck) / 2, 0], material: "soft" },
    { id: "BACK", name: "Back", size: [2 * xi, backTop - deck, zb1 - zb0], pos: [0, (deck + backTop) / 2, (zb0 + zb1) / 2], material: "soft" },
  ];
  // armrests: a padded block with a roll along its top
  const roll = 200;
  const armPieces: PartPiece[] = [
    { shape: "box", size: [AW, ARM_H - LEG_H - roll / 2, D], pos: [0, -roll / 4, 0] },
    { shape: "cyl", size: [roll, D, roll], pos: [AW / 2 - roll / 2, (ARM_H - LEG_H) / 2 - roll / 2, 0], rot: [Math.PI / 2, 0, 0] },
    { shape: "box", size: [AW - roll / 2, roll / 2, D], pos: [-roll / 4, (ARM_H - LEG_H) / 2 - roll / 4, 0] },
  ];
  const arms = ["ARM_L", "ARM_R"];
  [-1, 1].forEach((sx, i) => {
    const pieces = armPieces.map((p) => ({ ...p, pos: [sx * p.pos[0], p.pos[1], p.pos[2]] as Vec3 }));
    parts.push({ id: arms[i], name: "Armrest", size: [AW, ARM_H - LEG_H, D], pos: [sx * (xi + AW / 2), (LEG_H + ARM_H) / 2, 0], pieces, material: "soft" });
  });
  // corner legs under the armrests
  const legAt = (sx: number, sz: number): Vec3 => [sx * (W / 2 - 70), LEG_H / 2, sz * (D / 2 - 70)];
  const legs: string[] = [];
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => {
    const id = `LEG${legs.length}`;
    legs.push(id);
    parts.push({ id, name: "Leg", size: [120, LEG_H, 120], pos: legAt(sx, sz), material: "wood" });
  }));
  // two seat cushions on the base, two back cushions leaning on the back, two scatter cushions in front of them
  const half = chair ? 2 * xi : xi;
  const cxs = chair ? [0] : [-1, 1];
  const zc1 = D / 2 - 10, zbc = zc1 - 700; // the back cushions' front, a seat depth behind the front edge
  cxs.forEach((sx, i) => {
    parts.push({ id: `SEAT${i}`, name: "Seat cushion", size: [half - 10, seatTop - deck, zc1 - zb1], pos: [sx * (half / 2), (deck + seatTop) / 2, (zb1 + zc1) / 2], material: "soft" });
  });
  cxs.forEach((sx, i) => {
    parts.push({ id: `BCUSH${i}`, name: "Back cushion", size: [half - 20, H - seatTop - 10, zbc - zb1], pos: [sx * (half / 2), (seatTop + H - 10) / 2 + 5, (zb1 + zbc) / 2 - 10], rot: [-0.1, 0, 0], material: "soft" });
  });
  cxs.forEach((sx, i) => {
    parts.push({ id: `PILLOW${i}`, name: "Scatter cushion", size: [440, 440, 140], pos: [sx * (half / 2), seatTop + 260, zbc + 50], rot: [-0.25, 0, 0], material: "soft" });
  });

  const zs = (zb0 + zb1) / 2;
  const baseStuds = (chair ? [-0.45, 0.45] : [-0.7, -0.25, 0.25, 0.7]).map((t): Vec3 => [t * xi, deck, zs]);
  const nStuds = chair ? "two" : "four";
  const backNuts = baseStuds.map((p): Vec3 => [p[0], deck + 50, p[2]]);
  // each armrest: two studs into the end of the base, two into the end of the back
  const armStuds = (sx: number) => {
    const base: Vec3[] = [-D / 2 + 360, D / 2 - 160].map((z): Vec3 => [sx * xi, (LEG_H + deck) / 2 + 30, z]);
    const back: Vec3[] = [deck + 90, backTop - 90].map((y): Vec3 => [sx * xi, y, zs]);
    return { base, back, all: [...base, ...back] };
  };
  const inside = (p: Vec3, sx: number): Vec3 => [p[0] - sx * 60, p[1], p[2]];
  const armNuts = (sx: number): CustomFix[] => {
    const a = armStuds(sx);
    return [
      fx("washer", a.base.map((p) => inside(p, sx)), [sx, 0, 0], "BASE", WASHER),
      fx("washer", a.back.map((p) => inside(p, sx)), [sx, 0, 0], "BACK", WASHER),
      fx("nut", a.base.map((p) => inside(p, sx)), [sx, 0, 0], "BASE", WING),
      fx("nut", a.back.map((p) => inside(p, sx)), [sx, 0, 0], "BACK", WING),
    ];
  };
  const legBolts = (i: number): Vec3[] => {
    const p = parts.find((q) => q.id === legs[i])!.pos;
    return [-25, 25].map((d): Vec3 => [p[0] + d, 0, p[2] - d]);
  };

  const steps: CustomStep[] = [
    {
      title: `Screw ${nStuds} studs into the seat base`,
      detail: "Stand the base on a rug. Turn each stud in by hand into the holes along the back edge until it stops.",
      add: ["BASE"],
      fix: [fx("stud", baseStuds, [0, -1, 0], "BASE", { ...STUD, mate: "BACK" })],
      warnings: ["floor"],
    },
    { title: "Lower the back onto the studs", detail: `Hold it upright over the back edge of the base so the ${chair ? "two" : "four"} studs go through the holes in its bottom.`, add: ["BACK"], from: { BACK: [0, 320, 0] }, people: 2 },
    {
      title: "Fasten the back with wing nuts",
      detail: "Reach in from behind: a washer, then a wing nut on each stud, turned tight by hand.",
      fix: [fx("washer", backNuts, [0, -1, 0], "BACK", WASHER), fx("nut", backNuts, [0, -1, 0], "BACK", WING)],
    },
    {
      title: "Screw four studs into each armrest",
      detail: "Lay both armrests on the rug with the inside face up and turn the studs in by hand.",
      fix: [-1, 1].map((sx, i) => fx("stud", armStuds(sx).all, [sx, 0, 0], arms[i], STUD)),
    },
    { title: "Screw a spacer disc onto each stud", detail: "Turn them down the studs until they sit flat against the armrest.", fix: [-1, 1].map((sx, i) => fx("washer", armStuds(sx).all, [sx, 0, 0], arms[i], { name: "Spacer disc", len: 8, dia: 60 })) },
    {
      title: "Push the armrests onto the ends",
      detail: "One of you on each side. The studs go through the holes in the ends of the base and the back.",
      add: arms,
      from: { ARM_L: [-380, 0, 0], ARM_R: [380, 0, 0] },
      people: 2,
      warnings: ["two"],
    },
    { title: "Fasten the armrests with wing nuts", detail: "From inside the base and the back, a washer and a wing nut on each stud. Tighten them all by hand.", fix: [...armNuts(-1), ...armNuts(1)] },
    {
      title: "Bolt on the legs",
      detail: "Lay the sofa down on its front on the rug. Each leg fits the corner under an armrest, with two bolts through it.",
      add: legs,
      fix: legs.map((id, i) => fx("bolt", legBolts(i), [0, 1, 0], id, { len: 100, dia: 8, mate: arms[i < 2 ? 0 : 1] })),
      tools: ["allen"],
      pose: "-z",
      people: 2,
    },
    { title: "Stick two felt pads under each leg", detail: "Over the bolt heads, pressed on firmly.", fix: legs.map((id, i) => fx("glide", legBolts(i), [0, 1, 0], id, { dia: 40 })) },
    chair
      ? { title: "Stand it up and lay in the seat cushion", detail: "Lift it together onto its legs. The cushion lies on the base, zip to the back.", add: ["SEAT0"], pose: "+y", people: 2, warnings: ["two"] }
      : { title: "Stand it up and lay in the seat cushions", detail: "Lift it together onto its legs. The seat cushions lie on the base, zips to the back.", add: ["SEAT0", "SEAT1"], pose: "+y", people: 2, warnings: ["two"] },
    chair
      ? { title: "Put the back cushion in place", detail: "Lean it against the back, then the scatter cushion in front.", add: ["BCUSH0", "PILLOW0"] }
      : { title: "Put the back cushions in place", detail: "Lean them against the back, then the two scatter cushions in front.", add: ["BCUSH0", "BCUSH1", "PILLOW0", "PILLOW1"] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["VENNGARN"],
  build(b: PlanBuilder, s: ProductSpec) {
    if (s.archetype !== "sofa" && !/sofa|loveseat/i.test(s.variant)) return false;
    const r = recipe(s);
    const W = s.size.w * 10, D = s.size.d * 10;
    const armStep = r.steps.findIndex((x) => /studs into each armrest/.test(x.title));
    const keyOf = (id: string) => {
      const p = r.parts.find((q) => q.id === id)!.pos;
      return b.items.find((it) => it.kind === "part" && it.final.pos.every((v, i) => Math.abs(v - p[i]) < 0.5))?.key;
    };
    const step = b.step.bind(b);
    // the armrests lie on the rug in front, inside face up, while their studs and discs go in
    b.step = (def, body) =>
      step(def, () => {
        if (b.steps.length - 1 === armStep) {
          b.stagger(0.15);
          [-1, 1].forEach((sx, i) => {
            const k = keyOf(i ? "ARM_R" : "ARM_L");
            if (k) b.stage(k, [sx * Math.min(W / 4, 700), AW / 2, D / 2 + 700], [0, 0, sx * (-Math.PI / 2)], [0, 200, 0]);
          });
          b.then(0.15);
        }
        body();
      });
    try {
      buildCustom(b, { ...s, custom: r });
    } finally {
      b.step = step;
    }
    return true;
  },
};
export default family;

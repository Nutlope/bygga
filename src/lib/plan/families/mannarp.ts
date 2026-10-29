import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomParams, CustomStep, ProductSpec, Vec3 } from "../../types";

/**
 * MANNARP, read from IKEA's manuals: an upholstered frame with no screws at all. The legs screw into plates pushed
 * onto the armrests, the covers go on every frame before it is joined, and everything is held by threaded rods with
 * a washer and a wing knob from inside the frame. The sofa (one manual for the 2- and 3-seat) is two armrests
 * pushed onto the seat frame, the backrest lowered in between them and fastened at the top. With a chaise longue
 * (its own manual, built together with the sofa section) the chaise takes its own four legs, the right armrest and a
 * steel back bar, then stands against the sofa section and gets its own backrest. The sofa with two chaise longues
 * is the 2-seat section with two chaises side by side on the left: the chaise manual done twice, the second chaise
 * standing against the first and taking the armrest.
 */

type Kind = CustomFix["kind"];
const at = (kind: Kind, pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: { len?: number; dia?: number; name?: string } = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });

// the fittings, as drawn on the fittings pages
const ROD = { len: 90, dia: 8, name: "Threaded rod" };
const LONG_ROD = { len: 140, dia: 8, name: "Long threaded rod" };
const COLLAR_ROD = { len: 220, dia: 8, name: "Rod with a collar" };
const CARRIAGE = { len: 60, dia: 8, name: "Carriage bolt" };
const KNOB = { len: 18, dia: 40, name: "Wing knob" };
const WASHER = { len: 1.5, dia: 20 };
const PLATE = { len: 6, dia: 80, name: "Leg plate" };

const box = (id: string, name: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, o: Partial<CustomPart> = {}): CustomPart => ({
  id,
  name,
  size: [x1 - x0, y1 - y0, z1 - z0],
  pos: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
  material: "soft",
  ...o,
});

/** A box leaning back by `tilt` about its bottom edge at (y0, zb): its back face starts there. */
const leaning = (id: string, name: string, x0: number, x1: number, y0: number, h: number, zb: number, t: number, tilt: number, o: Partial<CustomPart> = {}): CustomPart => {
  const c = Math.cos(tilt), s = Math.sin(tilt);
  return {
    id,
    name,
    size: [x1 - x0, h, t],
    pos: [(x0 + x1) / 2, y0 + (c * h) / 2 + (s * t) / 2, zb - (s * h) / 2 + (c * t) / 2],
    rot: [-tilt, 0, 0],
    material: "soft",
    ...o,
  };
};

/** Mirrors a recipe left to right. */
/** The back bar: an upright behind the chaise longue with a foot that lies on the chaise frame's top, bolted down through it. */
function backBar(id: string, x: number, FB: number, SEAT: number, zb: number): CustomPart {
  const yc = FB + 260, zc = zb + 125;
  return {
    id,
    name: "Back bar",
    size: [40, 520, 250],
    pos: [x, yc, zc],
    material: "metal",
    pieces: [
      { shape: "box", size: [40, 520, 8], pos: [0, 0, -121] },
      { shape: "box", size: [40, 8, 250], pos: [0, SEAT + 4 - yc, 0] },
    ],
  };
}

function mirror(p: CustomParams): CustomParams {
  const fx = (v: Vec3): Vec3 => [-v[0], v[1], v[2]];
  return {
    ...p,
    parts: p.parts.map((q) => ({ ...q, pos: fx(q.pos), rot: q.rot && [q.rot[0], -q.rot[1], -q.rot[2]], pieces: q.pieces?.map((pc) => ({ ...pc, pos: fx(pc.pos) })) })),
    steps: p.steps.map((st) => ({
      ...st,
      fix: st.fix?.map((f) => ({ ...f, at: f.at?.map(fx), dir: f.dir && fx(f.dir) })),
      from: st.from && Object.fromEntries(Object.entries(st.from).map(([k, v]) => [k, fx(v)])),
      pose: st.pose === "+x" ? "-x" : st.pose === "-x" ? "+x" : st.pose,
    })),
  };
}

/**
 * The 4-seat sofa with two chaise longues: armrest, two chaises, the 2-seat section, armrest (300 cm). Drawn with the
 * chaises on the right like the one-chaise sofa, then mirrored, as in IKEA's photo.
 */
function twoChaises(s: ProductSpec): CustomParams {
  const Ws = 1380, Wc = 710, A = 100;
  const W = Ws + 2 * Wc + 2 * A;
  const D = 950, Dc = 1600;
  const zb = -Dc / 2, zf = zb + D;
  const x0 = -W / 2, xs0 = x0 + A, xs1 = xs0 + Ws, xc1 = xs1 + Wc, xc2 = xc1 + Wc, x1 = xc2 + A;
  const LEG = 160, ARM = 650, SEAT = 450, FB = 200;
  const backH = 760, tilt = 0.1, bt = 110;
  const zSeat0 = zb + 90;
  const parts: CustomPart[] = [];
  const legsOf = (id: string, xs: number[], zs: number[]) => {
    const ids: string[] = [];
    for (const x of xs) for (const z of zs) {
      const lid = `${id}${ids.length + 1}`;
      parts.push({ id: lid, name: "Leg", size: [36, LEG, 36], pos: [x, LEG / 2, z], shape: "cyl", material: "wood" });
      ids.push(lid);
    }
    return ids;
  };
  parts.push(box("AL", "Armrest", x0, xs0, LEG, ARM, zb, zf));
  parts.push(box("AR", "Armrest", xc2, x1, LEG, ARM, zb, zf));
  const armLegs = [...legsOf("LL", [x0 + A / 2], [zb + 60, zf - 60]), ...legsOf("LR", [x1 - A / 2], [zb + 60, zf - 60])];
  parts.push(box("S", "2-seat frame", xs0, xs1, FB, SEAT, zSeat0, zf));
  parts.push(leaning("B", "Backrest frame", xs0, xs1, FB, backH - FB, zb, bt, tilt));
  const ch = [
    { c: "C", bc: "BC", bar: "BAR", lg: "LC", xa: xs1, xb: xc1 },
    { c: "C2", bc: "BC2", bar: "BAR2", lg: "LD", xa: xc1, xb: xc2 },
  ];
  const chLegs = ch.map((q) => {
    parts.push(box(q.c, "Chaise longue frame", q.xa, q.xb, LEG, SEAT, zSeat0, zb + Dc));
    const l = legsOf(q.lg, [q.xa + 60, q.xb - 60], [zSeat0 + 70, zb + Dc - 60]);
    parts.push(leaning(q.bc, "Chaise backrest frame", q.xa, q.xb, FB, backH - FB, zb, bt, tilt));
    parts.push(backBar(q.bar, q.xa + 40, FB, SEAT, zb));
    return l;
  });
  const cushions: string[] = [];
  const cush = (id: string, a: number, b: number) => {
    parts.push(leaning(id, "Back cushion", a + 4, b - 4, SEAT, s.size.h * 10 - SEAT, zb + bt + 4, 210, tilt + 0.05));
    cushions.push(id);
  };
  cush("K1", xs0, xs0 + Ws / 2);
  cush("K2", xs0 + Ws / 2, xs1);
  cush("K3", xs1, xc1);
  cush("K4", xc1, xc2);

  const legTop = (ids: string[]) => ids.map((id) => {
    const p = parts.find((q) => q.id === id)!.pos;
    return [p[0], LEG, p[2]] as Vec3;
  });
  const plates = (ids: string[]) => at("plate", legTop(ids), [0, 1, 0], undefined, undefined, PLATE);
  const yLow = FB + 110;
  const zA = zSeat0 + 140, zB = zf - 120;
  const zBack = (y: number) => zb + bt / 2 - (y - FB) * Math.tan(tilt);
  const yB1 = FB + 230, yB2 = backH - 90;
  const rods = (x: number, dx: number, pts: [number, number][], on: string, mate: string, o = ROD) => at("stud", pts.map(([y, z]) => [x, y, z] as Vec3), [dx, 0, 0], on, mate, o);
  const knobs = (x: number, dx: number, pts: [number, number][], on: string): CustomFix[] => [
    at("washer", pts.map(([y, z]) => [x + dx * 30, y, z] as Vec3), [-dx, 0, 0], on, undefined, WASHER),
    at("nut", pts.map(([y, z]) => [x + dx * 34, y, z] as Vec3), [-dx, 0, 0], on, undefined, KNOB),
  ];
  const lowPts: [number, number][] = [[yLow, zA], [yLow, zB]];
  const low = (y: number): [number, number][] => [[y, zBack(y)]];
  const steps: CustomStep[] = [];
  steps.push({ title: "Fit the leg plates and screw the legs into both armrests", detail: "Push a plate onto each hole underneath, the flat side against the frame, then screw a leg into it by hand. Lay the armrests on a rug, insides up.", add: ["AL", "AR", ...armLegs], fix: [plates(armLegs)], warnings: ["hand", "floor"] });
  steps.push({ title: "Pull the covers down over the armrests", detail: "Each cover has its own armrest: check the label. Work it down evenly so the seams sit on the edges.", kind: "cushions" });
  steps.push({ title: "Close the covers under the armrests", detail: "Lay them down again and press the hook strips together all along the bottom." });
  steps.push({ title: "Screw two rods into the right armrest", detail: "Into the two holes low down on its inside, by hand until they stop. This one goes on the sofa section.", fix: [rods(xs0, 1, lowPts, "AL", "S")], warnings: ["hand"] });
  steps.push({ title: "Pull the cover over the sofa section", detail: "Stand the frame on its back end. One of you each side: work the cover down over it and fasten the strip at the top.", add: ["S"], people: 2, warnings: ["two"], kind: "cushions" });
  steps.push({ title: "Fasten the cover under the sofa section", detail: "Turn it over and press the hook strips together underneath." });
  steps.push({ title: "Push the right armrest onto the sofa section", detail: "Guide the rods through the frame's end, then a washer and a wing knob on each from inside.", fix: knobs(xs0, 1, lowPts, "S"), warnings: ["hand"] });
  ch.forEach((q, i) => {
    const which = i ? "the second chaise longue" : "the first chaise longue";
    steps.push({ title: `Pull the cover over ${which}`, detail: "Stand it on its back end. Work the cover down over the seat end first, then the long sides.", add: [q.c], people: 2, warnings: ["two"], kind: "cushions" });
    steps.push({ title: `Fasten the cover under ${which}`, detail: "Lay it on its top and press the hook strips together all round." });
    steps.push({ title: `Fit the leg plates and screw the legs into ${which}`, detail: "Push a plate onto each hole underneath, the flat side against the frame, then screw a leg into it by hand.", add: chLegs[i], fix: [plates(chLegs[i])], warnings: ["hand", "floor"] });
    if (i) steps.push({ title: "Screw two rods into the left armrest and push the chaise onto them", detail: "This armrest goes on the outer chaise. Rods into the holes low down on its inside, then a washer and a wing knob on each, from inside the chaise.", fix: [rods(xc2, -1, lowPts, "AR", q.c), ...knobs(xc2, -1, lowPts, q.c)], warnings: ["hand"] });
    steps.push({
      title: `Bolt the back bar to ${which}`,
      detail: "At the back corner on the sofa side, foot down. Its foot lies on the chaise frame; the carriage bolt goes down through it, with a washer and a wing knob under the frame top.",
      add: [q.bar],
      fix: [at("bolt", [[q.xa + 40, SEAT + 8, zb + 100]], [0, -1, 0], q.c, undefined, CARRIAGE), at("washer", [[q.xa + 40, SEAT - 50, zb + 100], [q.xa + 40, SEAT - 52, zb + 100]], [0, 1, 0], q.c, undefined, WASHER), at("nut", [[q.xa + 40, SEAT - 56, zb + 100]], [0, 1, 0], q.c, undefined, KNOB)],
      warnings: ["hand"],
    });
    const barPts: [number, number][] = [[q.xa + 40, zb + 120], [q.xa + 40, zb + 220]];
    steps.push({
      title: "Push the two rods with collars down through the bar",
      detail: "Through the bar's holes into the chaise frame, a washer and a wing knob on each from underneath.",
      fix: [at("stud", barPts.map(([x, z]) => [x, SEAT + 8, z] as Vec3), [0, -1, 0], q.c, q.bar, COLLAR_ROD), at("washer", barPts.map(([x, z]) => [x, FB, z] as Vec3), [0, 1, 0], q.c, undefined, WASHER), at("nut", barPts.map(([x, z]) => [x, FB - 4, z] as Vec3), [0, 1, 0], q.c, undefined, KNOB)],
      warnings: ["hand"],
    });
  });
  const joinPts: [number, number][] = [[yLow, zA], [yLow, zf - 140]];
  steps.push({ title: "Stand the first chaise longue against the sofa section", detail: "Stand both on their legs. Screw two long rods into the sofa section's free end and push the chaise onto them.", fix: [rods(xs1, 1, joinPts, "S", "C", LONG_ROD)], people: 2, warnings: ["two", "hand"] });
  steps.push({ title: "Fasten it with two wing knobs", detail: "A washer and a knob on each rod, from inside the chaise frame.", fix: knobs(xs1, 1, joinPts, "C"), warnings: ["hand"] });
  steps.push({ title: "Stand the second chaise longue against the first", detail: "Two long rods into the free side of the first chaise, then push the second one onto them.", fix: [rods(xc1, 1, joinPts, "C", "C2", LONG_ROD)], people: 2, warnings: ["two", "hand"] });
  steps.push({ title: "Fasten it with two wing knobs", detail: "A washer and a knob on each rod, from inside the second chaise.", fix: knobs(xc1, 1, joinPts, "C2"), warnings: ["hand"] });
  steps.push({ title: "Screw a rod into the right armrest", detail: "Into the hole at the back, above the seat.", fix: [rods(xs0, 1, low(yB1), "AL", "B")], warnings: ["hand"] });
  steps.push({ title: "Lower the sofa section's backrest in", detail: "Slide its hole onto the rod, then let it down behind the seat. A washer and a wing knob join it to the first back bar.", add: ["B"], fix: knobs(xs1, -1, low(yB1), "B"), warnings: ["hand"] });
  steps.push({ title: "Lower the first chaise's backrest in", detail: "Between the two back bars. A washer and a wing knob join it to the second bar.", add: ["BC"], fix: knobs(xc1, -1, low(yB1), "BC"), warnings: ["hand"] });
  steps.push({ title: "Lower the second chaise's backrest in", detail: "Between the second bar and the left armrest, down onto the back of the chaise.", add: ["BC2"] });
  steps.push({ title: "Screw a rod in through the left armrest", detail: "Through the armrest into the outer backrest, by hand.", fix: [rods(xc2, -1, low(yB1), "AR", "BC2")], warnings: ["hand"] });
  steps.push({
    title: "Fasten the backrests with four wing knobs",
    detail: "A washer and a knob from inside: one at each armrest and one on each bar.",
    fix: [...knobs(xs0, 1, low(yB1), "B"), ...knobs(xc2, -1, low(yB1), "BC2"), ...knobs(xs1, 1, low(yB1), "BC"), ...knobs(xc1, 1, low(yB1), "BC2")],
    warnings: ["hand"],
  });
  steps.push({ title: "Pull the cover down over the sofa section's backrest", detail: "One of you at each end, from the top down.", people: 2, warnings: ["two"], kind: "cushions" });
  steps.push({ title: "Pull the covers down over the chaises' backrests", detail: "The same way, then press the edges where the covers meet.", people: 2, warnings: ["two"], kind: "cushions" });
  steps.push({ title: "Screw two rods in higher up", detail: "Through each armrest into the top of its backrest frame.", fix: [rods(xs0, 1, low(yB2), "AL", "B"), rods(xc2, -1, low(yB2), "AR", "BC2")], warnings: ["hand"] });
  steps.push({ title: "Join the backrests at the top with two wing knobs", detail: "A washer and a knob onto each bar's top rod, from behind.", fix: [...knobs(xs1, -1, low(yB2), "B"), ...knobs(xc1, -1, low(yB2), "BC")], warnings: ["hand"] });
  steps.push({ title: "Fasten the top rods with wing knobs", detail: "A washer and a knob on each of the four, from behind.", fix: [...knobs(xs0, 1, low(yB2), "B"), ...knobs(xc2, -1, low(yB2), "BC2"), ...knobs(xs1, 1, low(yB2), "BC"), ...knobs(xc1, 1, low(yB2), "BC2")], warnings: ["hand"] });
  steps.push({ title: "Tighten all eight backrest knobs", detail: "By hand, with the flat side of each knob against the washer." });
  steps.push({ title: "Push the cover's edge strips into the channels", detail: "Along the bottom of the backrests, the plastic strips slide into the slots in the frames from one end." });
  steps.push({ title: "Pull the 8 straps through and fasten them", detail: "Each strap goes down through its slot behind the seat and sticks to itself underneath. Keep them flat, not twisted." });
  steps.push({ title: "Close the cover at the back", detail: "Press the hook strips together down both sides and along the bottom of the back." });
  steps.push({ title: "Fill the 4 back cushions", detail: "Tie the inner bags, push them into the covers and shake the filling into the corners before you zip them.", kind: "cushions" });
  steps.push({ title: "Stand the back cushions on the seat", detail: "Lean them against the backrest, zips down.", add: cushions, kind: "cushions" });
  return mirror({ parts, steps });
}

function recipe(s: ProductSpec): CustomParams | null {
  const v = s.variant.toLowerCase();
  if (/longues/.test(v)) return twoChaises(s);
  const chaise = /chaise/.test(v);
  // the seat section between the armrests: 138 or 178 wide, the 3-seat frame under the 4-seat with chaise longue
  const Ws = /^2-seat|^3-seat sofa with/.test(v) ? 1380 : 1780;
  const Wc = chaise ? 710 : 0;
  const A = 100; // armrest
  const W = Ws + Wc + 2 * A;
  const D = 950, Dc = 1600;
  const zb = chaise ? -Dc / 2 : -D / 2; // the back
  const zf = zb + D; // front of the sofa section
  const x0 = -W / 2, xs0 = x0 + A, xs1 = xs0 + Ws, xc1 = xs1 + Wc, x1 = xc1 + A;
  const LEG = 160, ARM = 650, SEAT = 450, FB = 200; // heights: legs, armrests, seat, frames' bottoms
  const backH = 760, tilt = 0.1, bt = 110;
  const zSeat0 = zb + 90; // the seat frame starts in front of the backrest's foot

  /* ---------- parts ---------- */
  const parts: CustomPart[] = [];
  const legsOf = (id: string, xs: number[], zs: number[]) => {
    const ids: string[] = [];
    for (const x of xs) for (const z of zs) {
      const lid = `${id}${ids.length + 1}`;
      parts.push({ id: lid, name: "Leg", size: [36, LEG, 36], pos: [x, LEG / 2, z], shape: "cyl", material: "wood" });
      ids.push(lid);
    }
    return ids;
  };
  parts.push(box("AL", "Armrest", x0, xs0, LEG, ARM, zb, zf));
  parts.push(box("AR", "Armrest", xc1, x1, LEG, ARM, zb, zf));
  const armLegs = [...legsOf("LL", [x0 + A / 2], [zb + 60, zf - 60]), ...legsOf("LR", [x1 - A / 2], [zb + 60, zf - 60])];
  parts.push(box("S", Ws > 1500 ? "3-seat frame" : "2-seat frame", xs0, xs1, FB, SEAT, zSeat0, zf));
  parts.push(leaning("B", "Backrest frame", xs0, xs1, FB, backH - FB, zb, bt, tilt));
  let chaiseLegs: string[] = [];
  if (chaise) {
    parts.push(box("C", "Chaise longue frame", xs1, xc1, LEG, SEAT, zSeat0, zb + Dc));
    chaiseLegs = legsOf("LC", [xs1 + 60, xc1 - 60], [zSeat0 + 70, zb + Dc - 60]);
    parts.push(leaning("BC", "Chaise backrest frame", xs1, xc1, FB, backH - FB, zb, bt, tilt));
    parts.push(backBar("BAR", xs1 + 40, FB, SEAT, zb));
  }
  // back cushions: two on either sofa section, one on the chaise longue
  const cushions: string[] = [];
  const cush = (id: string, a: number, b: number) => {
    parts.push(leaning(id, "Back cushion", a + 4, b - 4, SEAT, s.size.h * 10 - SEAT, zb + bt + 4, 210, tilt + 0.05));
    cushions.push(id);
  };
  cush("K1", xs0, xs0 + Ws / 2);
  cush("K2", xs0 + Ws / 2, xs1);
  if (chaise) cush("K3", xs1, xc1);

  /* ---------- fitting points ---------- */
  const legTop = (ids: string[]) => ids.map((id) => {
    const p = parts.find((q) => q.id === id)!.pos;
    return [p[0], LEG, p[2]] as Vec3;
  });
  const plates = (ids: string[]) => at("plate", legTop(ids), [0, 1, 0], undefined, undefined, PLATE);
  const yLow = FB + 110;
  const zA = zSeat0 + 140, zB = zf - 120; // the two rods low down in an armrest
  const zBack = (y: number) => zb + bt / 2 - (y - FB) * Math.tan(tilt);
  const yB1 = FB + 230, yB2 = backH - 90; // the backrest's lower and upper rods
  // a rod screwed into an armrest's inner face at x, sticking in towards dx; washer and knob on it inside the frame
  const rods = (x: number, dx: number, pts: [number, number][], on: string, mate: string, o = ROD) => at("stud", pts.map(([y, z]) => [x, y, z] as Vec3), [dx, 0, 0], on, mate, o);
  const knobs = (x: number, dx: number, pts: [number, number][], on: string): CustomFix[] => [
    at("washer", pts.map(([y, z]) => [x + dx * 30, y, z] as Vec3), [-dx, 0, 0], on, undefined, WASHER),
    at("nut", pts.map(([y, z]) => [x + dx * 34, y, z] as Vec3), [-dx, 0, 0], on, undefined, KNOB),
  ];
  const lowPts: [number, number][] = [[yLow, zA], [yLow, zB]];
  const legSteps = (who: string, ids: string[], legs: string[], extra = ""): CustomStep => ({
    title: `Fit the leg plates and screw the legs into ${who}`,
    detail: `Push a plate onto each hole underneath, the flat side against the frame, then screw a leg into it by hand.${extra}`,
    add: [...ids, ...legs],
    fix: [plates(legs)],
    warnings: ["hand", "floor"],
  });

  const steps: CustomStep[] = [];
  steps.push(legSteps(chaise ? "both armrests" : "the armrests", ["AL", "AR"], armLegs, " Lay the armrests on a rug, insides up."));
  steps.push({ title: "Pull the covers down over the armrests", detail: "Each cover has its own armrest: check the label. Work it down evenly so the seams sit on the edges.", kind: "cushions" });
  steps.push({ title: "Close the covers under the armrests", detail: "Lay them down again and press the hook strips together all along the bottom." });

  if (!chaise) {
    steps.push({
      title: "Screw two rods into each armrest",
      detail: "Into the two holes low down on the inside, by hand until they stop.",
      fix: [rods(xs0, 1, lowPts, "AL", "S"), rods(xs1, -1, lowPts, "AR", "S")],
      warnings: ["hand"],
    });
    steps.push({ title: "Pull the cover over the seat frame", detail: "Stand the frame on its back end. One of you each side: work the cover down over it and fasten the strip at the top.", add: ["S"], people: 2, warnings: ["two"], kind: "cushions" });
    steps.push({ title: "Fasten the cover under the seat frame", detail: "Turn it over and press the hook strips together underneath, pulling the cover tight." });
    steps.push({ title: "Push the right armrest onto the seat frame", detail: "Lay the frame on its back. Guide the rods through its end, then a washer and a wing knob on each from inside.", fix: knobs(xs1, -1, lowPts, "S"), pose: "+z", warnings: ["hand"] });
    steps.push({ title: "Push on the left armrest the same way", detail: "Two more washers and wing knobs. Hand tight is enough.", fix: knobs(xs0, 1, lowPts, "S"), warnings: ["hand"] });
    steps.push({
      title: "Stand it up and screw a rod into the right armrest",
      detail: "Turn the sofa onto its legs. The rod goes into the hole at the back of the armrest, above the seat.",
      fix: [rods(xs1, -1, [[yB1, zBack(yB1)]], "AR", "B")],
      pose: "+y",
      people: 2,
      warnings: ["two", "hand"],
    });
    steps.push({ title: "Lower the backrest frame in", detail: "Tilt it in between the armrests, slide its hole onto the rod, then let it down onto the back of the seat frame.", add: ["B"] });
    steps.push({ title: "Screw a rod in through the left armrest", detail: "Through the armrest into the backrest frame, by hand.", fix: [rods(xs0, 1, [[yB1, zBack(yB1)]], "AL", "B")], warnings: ["hand"] });
    steps.push({ title: "Fasten the backrest with two wing knobs", detail: "A washer and a knob onto each rod, from inside the backrest frame.", fix: [...knobs(xs0, 1, [[yB1, zBack(yB1)]], "B"), ...knobs(xs1, -1, [[yB1, zBack(yB1)]], "B")], warnings: ["hand"] });
    steps.push({ title: "Pull the cover down over the backrest", detail: "One of you at each end, from the top down over the frame.", people: 2, warnings: ["two"], kind: "cushions" });
    steps.push({ title: "Screw two rods in higher up", detail: "Through each armrest into the top of the backrest frame.", fix: [rods(xs0, 1, [[yB2, zBack(yB2)]], "AL", "B"), rods(xs1, -1, [[yB2, zBack(yB2)]], "AR", "B")], warnings: ["hand"] });
    steps.push({ title: "Fasten them with wing knobs", detail: "A washer and a knob on each, from behind.", fix: [...knobs(xs0, 1, [[yB2, zBack(yB2)]], "B"), ...knobs(xs1, -1, [[yB2, zBack(yB2)]], "B")], warnings: ["hand"] });
    steps.push({ title: "Tighten all four backrest knobs", detail: "By hand, with the flat side of each knob against the washer." });
  } else {
    steps.push({ title: "Screw two rods into the left armrest", detail: "Into the two holes low down on its inside, by hand until they stop. This one goes on the sofa section.", fix: [rods(xs0, 1, lowPts, "AL", "S")], warnings: ["hand"] });
    steps.push({ title: "Pull the cover over the sofa section", detail: "Stand the frame on its back end. One of you each side: work the cover down over it and fasten the strip at the top.", add: ["S"], people: 2, warnings: ["two"], kind: "cushions" });
    steps.push({ title: "Fasten the cover under the sofa section", detail: "Turn it over and press the hook strips together underneath." });
    steps.push({ title: "Push the left armrest onto the sofa section", detail: "Guide the rods through the frame's end, then a washer and a wing knob on each from inside.", fix: knobs(xs0, 1, lowPts, "S"), warnings: ["hand"] });
    steps.push({ title: "Pull the cover over the chaise longue", detail: "Stand it on its back end. Work the cover down over the seat end first, then the long sides.", add: ["C"], people: 2, warnings: ["two"], kind: "cushions" });
    steps.push({ title: "Fasten the cover under the chaise longue", detail: "Lay it on its top and press the hook strips together all round." });
    steps.push(legSteps("the chaise longue", [], chaiseLegs));
    steps.push({ title: "Screw two rods into the right armrest and push the chaise onto them", detail: "Rods into the holes low down on its inside. Then a washer and a wing knob on each, from inside the chaise.", fix: [rods(xc1, -1, [[yLow, zA], [yLow, zB]], "AR", "C"), ...knobs(xc1, -1, [[yLow, zA], [yLow, zB]], "C")], warnings: ["hand"] });
    steps.push({
      title: "Bolt the back bar to the chaise longue",
      detail: "At the back corner on the sofa side, foot down. Its foot lies on the chaise frame; the carriage bolt goes down through it, with a washer and a wing knob under the frame top.",
      add: ["BAR"],
      fix: [at("bolt", [[xs1 + 40, SEAT + 8, zb + 100]], [0, -1, 0], "C", undefined, CARRIAGE), at("washer", [[xs1 + 40, SEAT - 50, zb + 100], [xs1 + 40, SEAT - 52, zb + 100]], [0, 1, 0], "C", undefined, WASHER), at("nut", [[xs1 + 40, SEAT - 56, zb + 100]], [0, 1, 0], "C", undefined, KNOB)],
      warnings: ["hand"],
    });
    const barPts: [number, number][] = [[xs1 + 40, zb + 120], [xs1 + 40, zb + 220]];
    steps.push({
      title: "Push the two rods with collars down through the bar",
      detail: "Through the bar's holes into the chaise frame, a washer and a wing knob on each from underneath.",
      fix: [at("stud", barPts.map(([x, z]) => [x, SEAT + 8, z] as Vec3), [0, -1, 0], "C", "BAR", COLLAR_ROD), at("washer", barPts.map(([x, z]) => [x, FB, z] as Vec3), [0, 1, 0], "C", undefined, WASHER), at("nut", barPts.map(([x, z]) => [x, FB - 4, z] as Vec3), [0, 1, 0], "C", undefined, KNOB)],
      warnings: ["hand"],
    });
    const joinPts: [number, number][] = [[yLow, zA], [yLow, zf - 140]];
    steps.push({ title: "Stand the chaise longue against the sofa section", detail: "Stand both on their legs. Screw two long rods into the sofa section's free end and push the chaise onto them.", fix: [rods(xs1, 1, joinPts, "S", "C", LONG_ROD)], people: 2, warnings: ["two", "hand"] });
    steps.push({ title: "Fasten the chaise longue with two wing knobs", detail: "A washer and a knob on each rod, from inside the chaise frame.", fix: knobs(xs1, 1, joinPts, "C"), warnings: ["hand"] });
    steps.push({ title: "Screw a rod into the left armrest", detail: "Into the hole at the back, above the seat.", fix: [rods(xs0, 1, [[yB1, zBack(yB1)]], "AL", "B")], warnings: ["hand"] });
    steps.push({ title: "Lower the sofa section's backrest in", detail: "Slide its hole onto the rod, then let it down behind the seat. A washer and a wing knob join it to the back bar.", add: ["B"], fix: knobs(xs1, -1, [[yB1, zBack(yB1)]], "B"), warnings: ["hand"] });
    steps.push({ title: "Lower the chaise longue's backrest in", detail: "Between the back bar and the right armrest, down onto the back of the chaise." , add: ["BC"] });
    steps.push({ title: "Screw a rod in through the right armrest", detail: "Through the armrest into the chaise's backrest, by hand.", fix: [rods(xc1, -1, [[yB1, zBack(yB1)]], "AR", "BC")], warnings: ["hand"] });
    steps.push({
      title: "Fasten both backrests with three wing knobs",
      detail: "A washer and a knob from inside: one at each armrest and one on the bar.",
      fix: [...knobs(xs0, 1, [[yB1, zBack(yB1)]], "B"), ...knobs(xc1, -1, [[yB1, zBack(yB1)]], "BC"), ...knobs(xs1, 1, [[yB1, zBack(yB1)]], "BC")],
      warnings: ["hand"],
    });
    steps.push({ title: "Pull the cover down over the sofa section's backrest", detail: "One of you at each end, from the top down.", people: 2, warnings: ["two"], kind: "cushions" });
    steps.push({ title: "Pull the cover down over the chaise's backrest", detail: "The same way, then press the edges where the two covers meet.", people: 2, warnings: ["two"], kind: "cushions" });
    steps.push({ title: "Screw two rods in higher up", detail: "Through each armrest into the top of its backrest frame.", fix: [rods(xs0, 1, [[yB2, zBack(yB2)]], "AL", "B"), rods(xc1, -1, [[yB2, zBack(yB2)]], "AR", "BC")], warnings: ["hand"] });
    steps.push({ title: "Join the backrests at the top with a wing knob", detail: "A washer and a knob onto the bar's top rod, from behind.", fix: knobs(xs1, -1, [[yB2, zBack(yB2)]], "B"), warnings: ["hand"] });
    steps.push({ title: "Fasten the top rods with wing knobs", detail: "A washer and a knob on each of the three, from behind.", fix: [...knobs(xs0, 1, [[yB2, zBack(yB2)]], "B"), ...knobs(xc1, -1, [[yB2, zBack(yB2)]], "BC"), ...knobs(xs1, 1, [[yB2, zBack(yB2)]], "BC")], warnings: ["hand"] });
    steps.push({ title: "Tighten all six backrest knobs", detail: "By hand, with the flat side of each knob against the washer." });
  }
  const nStraps = chaise ? 6 : 4;
  steps.push({ title: "Push the cover's edge strips into the channels", detail: "Along the bottom of the backrest, the plastic strips slide into the slots in the frame from one end." });
  steps.push({ title: `Pull the ${nStraps} straps through and fasten them`, detail: "Each strap goes down through its slot behind the seat and sticks to itself underneath. Keep them flat, not twisted." });
  steps.push({ title: "Close the cover at the back", detail: "Press the hook strips together down both sides and along the bottom of the back." });
  steps.push({ title: `Fill the ${cushions.length} back cushions`, detail: "Tie the inner bags, push them into the covers and shake the filling into the corners before you zip them.", kind: "cushions" });
  steps.push({ title: "Stand the back cushions on the seat", detail: "Lean them against the backrest, zips down.", add: cushions, kind: "cushions" });
  return { parts, steps };
}

const family: Family = { names: ["MANNARP"], recipe };
export default family;

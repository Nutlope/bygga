import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartItem, PartPiece, ProductSpec, Vec3 } from "../../types";
import type { PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * VRETSTORP, read from the 3-seat sofa-bed frame's manual. The seat is one piece: upside down, two posts bolt into
 * its front corners and take a leg and a felt pad each, then its cover goes on. The backrest gets its cover with two
 * of you. Each armrest takes two legs and pads, and four screws that two long rails hang on, keyhole slots over the
 * screw heads; the second armrest hooks on and everything is screwed tight. The armrest covers go on, the lifting
 * mechanisms are screwed inside the arms, and the fabric storage bottom clips onto the rails. Two of you lay the seat
 * on the mechanisms (wing nuts, then two long screws from below), hook the backrest onto its brackets and screw it,
 * and the back cushions go in.
 */

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });

function sofa(s: ProductSpec): CustomParams {
  // IKEA: 244 wide, 96 deep, 91 high, seat 46 high and 52 deep
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const legH = 100, aw = 210, armH = 650, inX = W / 2 - aw;
  const seatTop = 460, seatT = 150, zSeat0 = D / 2 - 780; // the seat reaches the front
  const zBack0 = -D / 2, backT = 200, backTop = 710;
  const railZ = D / 2 - 60, railY0 = 180;
  const seatC: Vec3 = [0, seatTop - seatT / 2, (zSeat0 + D / 2) / 2];
  const postX = inX - 60, postZ = D / 2 - 60;
  const parts: CustomPart[] = [
    // the seat frame, its two front posts reaching down to the legs
    {
      id: "SEAT",
      name: "Seat frame",
      size: [2 * inX - 20, seatTop - legH, D / 2 - zSeat0],
      pos: [0, (seatTop + legH) / 2, (zSeat0 + D / 2) / 2],
      pieces: [
        { shape: "box", size: [2 * inX - 20, seatT, D / 2 - zSeat0], pos: [0, (seatTop - legH) / 2 - seatT / 2, 0] },
        ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [50, seatTop - seatT - legH, 50], pos: [sx * postX, -seatT / 2, postZ - (zSeat0 + D / 2) / 2], material: "wood" })),
      ],
      material: "soft",
    },
    ...[-1, 1].map((sx): CustomPart => ({ id: `SLEG${sx}`, name: "Leg", size: [55, legH, 55], pos: [sx * postX, legH / 2, postZ], shape: "cyl", material: "wood" })),
    { id: "SCOVER", name: "Seat cover", size: [2 * inX - 10, seatTop - 20, 8], pos: [0, (seatTop + 20) / 2, D / 2 + 4], pieces: [{ shape: "box", size: [2 * inX - 10, seatTop - 20, 8], pos: [0, 0, 0] }, { shape: "box", size: [2 * inX - 10, 4, D / 2 - zSeat0], pos: [0, (seatTop - 20) / 2, -(D / 2 - zSeat0) / 2] }], material: "soft" },
    { id: "BACK", name: "Backrest", size: [2 * inX - 20, backTop - railY0, backT], pos: [0, (backTop + railY0) / 2, zBack0 + backT / 2], material: "soft" },
    ...[-1, 1].map((sx): CustomPart => ({ id: sx < 0 ? "ARM_L" : "ARM_R", name: "Armrest", size: [aw, armH - legH, D], pos: [sx * (W / 2 - aw / 2), (armH + legH) / 2, 0], pieces: [{ shape: "box", size: [aw, armH - legH - 90, D], pos: [0, -45, 0] }, { shape: "cyl", size: [aw + 30, D, aw + 30], pos: [sx * 15, (armH - legH) / 2 - (aw + 30) / 2 + 30, 0], rot: [Math.PI / 2, 0, 0] }], material: "soft" })),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz): CustomPart => ({ id: `ALEG${sx}${sz}`, name: "Leg", size: [55, legH, 55], pos: [sx * (W / 2 - aw / 2), legH / 2, sz * (D / 2 - 80)], shape: "cyl", material: "wood" }))),
    ...[-1, 1].map((sz): CustomPart => ({ id: sz < 0 ? "RAIL_B" : "RAIL_F", name: "Rail", size: [2 * inX, 80, 30], pos: [0, railY0 + 40, sz * railZ], material: "metal" })),
    ...[-1, 1].map((sx): CustomPart => ({ id: sx < 0 ? "ACOVER_L" : "ACOVER_R", name: "Armrest cover", size: [aw + 10, armH + 30 - 20, D + 10], pos: [sx * (W / 2 - aw / 2), (armH + 30 + 20) / 2, 0], pieces: [{ shape: "box", size: [aw + 10, armH - 80, D + 10], pos: [0, -45, 0] }, { shape: "cyl", size: [aw + 40, D + 10, aw + 40], pos: [sx * 15, (armH + 10) / 2 - (aw + 40) / 2 + 20, 0], rot: [Math.PI / 2, 0, 0] }], material: "soft" })),
    ...[-1, 1].map((sx): CustomPart => ({ id: sx < 0 ? "MECH_L" : "MECH_R", name: "Lifting mechanism", size: [16, 180, 500], pos: [sx * (inX - 8), seatTop - seatT - 90, 0], material: "metal" })),
    { id: "DECK", name: "Storage bottom", size: [2 * inX - 30, 10, 2 * railZ - 40], pos: [0, railY0 + 10, 0], material: "soft" },
    ...[-1, 1].map((sx): CustomPart => ({ id: sx < 0 ? "BRK_L" : "BRK_R", name: "Back bracket", size: [16, 120, 60], pos: [sx * (inX - 30), railY0 + 140, zBack0 + backT + 8], material: "metal" })),
    ...[0, 1, 2].map((i): CustomPart => ({ id: `CUSH${i}`, name: "Back cushion", size: [(2 * inX) / 3 - 20, H - 420, 170], pos: [-inX + ((i + 0.5) * 2 * inX) / 3, (420 + H) / 2, zBack0 + backT + 90], rot: [-0.1, 0, 0], material: "soft" })),
  ];
  const posts = [-1, 1].map((sx): Vec3 => [sx * postX, seatTop - seatT, postZ]);
  const armScrews = (sx: number): Vec3[] => [-1, 1].flatMap((sz) => [railY0 + 20, railY0 + 60].map((y): Vec3 => [sx * inX, y, sz * railZ]));
  const steps: CustomStep[] = [
    {
      title: "Push the posts into the seat frame",
      detail: "Lay the seat upside down on a rug and push a post into each front corner.",
      add: ["SEAT"],
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Bolt the posts in", detail: "Two bolts in each, tightened with the key.", fix: posts.flatMap((p) => [fx("bolt", [[p[0], p[1] - 40, p[2] - 25], [p[0], p[1] - 90, p[2] - 25]], [0, 0, 1], "SEAT", { len: 40, dia: 6 })]), tools: ["allen"] },
    { title: "Screw a leg onto each post", detail: "Clockwise by hand until it stops.", add: ["SLEG-1", "SLEG1"] },
    { title: "Stick a felt pad on each leg", detail: "Pressed flat in the middle of the leg's end.", fix: [-1, 1].map((sx) => fx("glide", [[sx * postX, 0, postZ]], [0, 1, 0], `SLEG${sx}`, { name: "Felt pad", dia: 50 })) },
    { title: "Pull the seat cover on", detail: "Over the upside-down seat, the skirt toward the legs.", add: ["SCOVER"], from: { SCOVER: [0, -400, 0] } },
    { title: "Turn the seat over and fasten the cover", detail: "Smooth the cover over the top and press its strips down along the back edge.", pose: "+y" },
    { title: "Fasten the cover round the posts", detail: "Wrap the flaps round each post and close them, so the skirt hangs straight." },
    {
      title: "Pull the backrest cover on together",
      detail: "Stand the backrest on its edge and pull the cover down over it, one of you at each end.",
      add: ["BACK"],
      people: 2,
      warnings: ["two"],
    },
    { title: "Fasten the backrest cover", detail: "Lay the backrest down and press the strips closed along its lower edge.", pose: "+z" },
    {
      title: "Screw the legs into the armrests",
      detail: "Lay each armrest upside down. Two legs in each, clockwise by hand.",
      add: ["ARM_L", "ALEG-1-1", "ALEG-11"],
      // the right armrest gets its legs, pads and screws beside the build and hooks on after the rails
      wait: ["ARM_R", "ALEG1-1", "ALEG11"],
      from: { ARM_R: [600, 0, 0], "ALEG1-1": [600, 0, 0], ALEG11: [600, 0, 0] },
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Stick the felt pads on",
      detail: "One under each armrest leg.",
      fix: [-1, 1].flatMap((sx) => [-1, 1].map((sz) => fx("glide", [[sx * (W / 2 - aw / 2), 0, sz * (D / 2 - 80)]], [0, 1, 0], `ALEG${sx}${sz}`, { name: "Felt pad", dia: 50 }))),
    },
    {
      title: "Turn screws into the armrests",
      detail: "Stand the armrests up. Four in the inside of each, turned in only until a few millimetres show: the rails hang on their heads.",
      fix: [-1, 1].map((sx) => fx("screw", armScrews(sx), [sx, 0, 0], sx < 0 ? "ARM_L" : "ARM_R", { name: "Allen screw", len: 30, dia: 6 })),
      tools: ["allen"],
      pose: "+y",
    },
    { title: "Hang the back rail on the left armrest", detail: "Its keyhole slots go over the screw heads, then push it down.", add: ["RAIL_B"], people: 2 },
    { title: "Hang the front rail on", detail: "The same way, slots over the heads and down.", add: ["RAIL_F"], people: 2 },
    { title: "Hook the right armrest onto the rails", detail: "Lift it so its screw heads slide into the rails' slots, then lower it.", add: ["ARM_R", "ALEG1-1", "ALEG11"], people: 2, from: { ARM_R: [400, 0, 0], "ALEG1-1": [400, 0, 0], ALEG11: [400, 0, 0] } },
    { title: "Tighten the screws", detail: "The four at the rails' ends, firmly with the key.", tools: ["allen"] },
    {
      title: "Add the locking screws",
      detail: "Eight more through the rails' brackets into the armrests.",
      fix: [-1, 1].map((sx) => fx("screw", [-1, 1].flatMap((sz) => [railY0 + 10, railY0 + 70].map((y): Vec3 => [sx * inX, y, sz * (railZ - 40)])), [sx, 0, 0], sx < 0 ? "ARM_L" : "ARM_R", { name: "Allen screw", len: 30, dia: 6 })),
      tools: ["allen"],
    },
    { title: "Pull the armrest covers on", detail: "One over each armrest, the roll at the top.", add: ["ACOVER_L", "ACOVER_R"], from: { ACOVER_L: [0, 400, 0], ACOVER_R: [0, 400, 0] } },
    { title: "Fasten the armrest covers", detail: "Wrap the flaps under the rails and press them closed, two on each side." },
    {
      title: "Screw the lifting mechanisms inside the armrests",
      detail: "One on each side, the spring toward the back. One screw each, tightened with the key.",
      add: ["MECH_L", "MECH_R"],
      fix: [-1, 1].map((sx) => fx("screw", [[sx * (inX - 16), seatTop - seatT - 140, 150]], [sx, 0, 0], sx < 0 ? "MECH_L" : "MECH_R", { name: "Allen screw", len: 30, dia: 6 })),
      tools: ["allen"],
    },
    { title: "Clip the ends of the storage bottom's rods", detail: "Push a clip onto each of the four rod ends.", fix: [fx("clip", [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * (inX - 30), railY0 + 10, sz * (railZ - 30)])), [0, -1, 0], "DECK")], wait: ["DECK"], from: { DECK: [0, 0, 900] } },
    { title: "Lay the storage bottom between the rails", detail: "Two of you, rods across, clips over the rails.", add: ["DECK"], people: 2, warnings: ["two"] },
    { title: "Click the clips onto the rails", detail: "Ten along the front and back rails, pressed until they click." },
    { title: "Close the straps round the rails", detail: "Four on each side, wrapped round and pressed closed." },
    { title: "Hook the back brackets onto the mechanisms", detail: "One on each side, pushed down into the slots.", add: ["BRK_L", "BRK_R"] },
    {
      title: "Lay the seat on the mechanisms",
      detail: "Two of you lower it in, the posts at the front. A wing nut on each mechanism's bolt holds it, by hand.",
      fix: [-1, 1].map((sx) => fx("nut", [[sx * (inX - 30), seatTop - seatT, 100]], [0, 1, 0], sx < 0 ? "MECH_L" : "MECH_R", { name: "Wing nut", dia: 30, mate: "SEAT" })),
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Screw the seat on from below",
      detail: "One long screw up through each mechanism into the seat frame.",
      fix: [-1, 1].map((sx) => fx("screw", [[sx * (inX - 30), seatTop - seatT, -100]], [0, 1, 0], sx < 0 ? "MECH_L" : "MECH_R", { len: 70, dia: 6, mate: "SEAT" })),
      tools: ["allen"],
    },
    {
      title: "Hook the backrest on",
      detail: "Two of you lower it onto the back brackets, its slots over their pins.",
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Screw the backrest to the brackets",
      detail: "Two short screws on each side, with the key.",
      fix: [-1, 1].map((sx) => fx("screw", [railY0 + 110, railY0 + 170].map((y): Vec3 => [sx * (inX - 30), y, zBack0 + backT + 16]), [0, 0, -1], sx < 0 ? "BRK_L" : "BRK_R", { name: "Allen screw", len: 16, dia: 6, mate: "BACK" })),
      tools: ["allen"],
    },
    { title: "Try the bed out", detail: "Lift the seat front, pull it out and lower the back down flat, then fold it back." },
    { title: "Stand the back cushions in", detail: "Unpack them and let them fill out, then three side by side against the back.", add: ["CUSH0", "CUSH1", "CUSH2"] },
  ];
  return { parts, steps };
}

/** Parts built on their own are shown in their own scene for steps `from` to `until`, and come in at `join`. */
function apart(b: PlanBuilder, r: CustomParams, ids: string[], scene: string, from: number, until: number, join: number, off: Vec3) {
  for (let i = from; i < until; i++) if (b.steps[i]) b.steps[i].scene = scene;
  for (const id of ids) {
    const p = r.parts.find((q) => q.id === id)!;
    const it = b.items.find((x): x is PartItem => x.kind === "part" && x.final.pos.every((v, k) => Math.abs(v - p.pos[k]) < 0.5));
    if (!it) continue;
    it.states = it.states.filter((st) => st.step < join).map((st) => ({ ...st, scene }));
    it.states.push({ step: join, scene: "main", pos: it.final.pos, rot: it.final.rot, from: off, delay: 0.2 });
  }
}

const family: Family = {
  names: ["VRETSTORP"],
  build(b, s) {
    if (!/sofa-bed|sofa bed/i.test(`${s.variant} ${s.slug ?? ""}`)) return false;
    const r = sofa(s);
    buildCustom(b, { ...s, custom: r });
    const idx = (re: RegExp) => r.steps.findIndex((x) => re.test(x.title));
    apart(b, r, ["SEAT", "SLEG-1", "SLEG1", "SCOVER"], "seat", 0, idx(/backrest cover on/), idx(/seat on the mechanisms/), [0, 500, 0]);
    apart(b, r, ["BACK"], "back", idx(/backrest cover on/), idx(/legs into the armrests/), idx(/Hook the backrest on/), [0, 500, -300]);
    return true;
  },
};
export default family;

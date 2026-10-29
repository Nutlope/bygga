import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * RAMNEFJÄLL upholstered bed, read from its two manuals: the single (also the twin) and the double (also the king).
 * The headboard frame lies face up on a rug: the posts are bolted to the curved top, then the centre stile, the
 * bottom rail and the two feet, and the board goes on with a screw and washer at the top. The footboard gets four
 * screws for its two keyhole feet. Screws turned part way into both ends take the side rails' keyhole brackets:
 * the rails hook onto the headboard, the footboard hooks onto the rails, and four bolts in the brackets are
 * tightened. The cross bar goes in with a bolt and spacer at each end (the double also gets a centre beam, its
 * foot bolt and a long bolt through the cross bar). Then the covers: the headboard's is pulled down over it and
 * closed at the back, the footboard's the same, the side covers grip the rails. Slat holders clip onto the slat
 * rails and the slats roll out under them.
 * IKEA's sizes: 104 x 200 (single), 111 x 200 (twin), 144 x 200 (double), 203 x 212 (king); headboard 100 cm,
 * footboard 43 cm.
 */

function dims(s: ProductSpec): [number, number] {
  const slug = s.slug ?? "";
  if (/king/.test(slug)) return [2030, 2120];
  if (/double/.test(slug)) return [1440, 2000];
  if (/twin/.test(slug)) return [1110, 2000];
  return [1040, 2000];
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const BOLT = { kind: "bolt" as const, len: 60, dia: 8 };
const SCREW = { kind: "screw" as const, len: 15, dia: 6 };

function slatRoll(w: number, len: number): PartPiece[] {
  const n = Math.max(12, Math.round(len / 110));
  const pitch = (len - 60) / (n - 1);
  return [
    ...range(n).map((i): PartPiece => ({ shape: "box", size: [w, 9, 55], pos: [0, 2, -len / 2 + 30 + i * pitch] })),
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [24, 4, len], pos: [sx * (w / 2 - 90), -4, 0], material: "fiber" })),
  ];
}

function recipe(s: ProductSpec) {
  if (!/^ramnefjall-upholstered-bed-frame/.test(s.slug ?? "")) return null;
  const [W, L] = dims(s);
  const wide = W >= 1400; // the double manual
  const H = 1000, FH = 430;
  const HT = 90, FT = 70; // covered thickness of the head and foot boards
  const zh = -L / 2 + HT / 2, zf = L / 2 - FT / 2;
  const zi0 = -L / 2 + HT, zi1 = L / 2 - FT; // inside faces
  const P = 50, xp = W / 2 - 15 - P / 2; // headboard posts
  const yFoot = 120, yArch = 850, sag = H - 15 - yArch;
  const R = ((W - 2 * 15) ** 2 / 4 + sag * sag) / (2 * sag), cy = H - 15 - R;
  const archY = (x: number) => cy + Math.sqrt(Math.max(0, R * R - x * x));
  const parts: CustomPart[] = [];
  const wood = "wood" as const;

  // the headboard frame, inside its cover
  const zF = zh - 5; // frame
  const archPts = range(13).map((i) => -xp + (2 * xp * i) / 12);
  const arch: PartPiece[] = archPts.slice(1).map((x, i) => {
    const x0 = archPts[i], y0 = archY(x0) - 25, y1 = archY(x) - 25;
    return { shape: "box", size: [Math.hypot(x - x0, y1 - y0) + 2, 50, 50], pos: [(x + x0) / 2, (y0 + y1) / 2 - (yArch + H - 15) / 2, 0], rot: [0, 0, Math.atan2(y1 - y0, x - x0)] };
  });
  parts.push({ id: "HA", name: "Headboard top", size: [2 * xp + P, H - 15 - yArch + 25, 50], pos: [0, (yArch + H - 15) / 2, zF], material: wood, pieces: arch });
  for (const sx of [-1, 1]) parts.push({ id: `HP${sx}`, name: "Headboard post", size: [P, yArch - yFoot, 50], pos: [sx * xp, (yArch + yFoot) / 2, zF], material: wood });
  const yStile = archY(0) - 50; // up to the underside of the curve
  parts.push({ id: "HS", name: "Centre stile", size: [40, yStile - 260, 40], pos: [0, (yStile + 260) / 2, zF], material: wood });
  parts.push({ id: "HR", name: "Headboard bottom rail", size: [2 * xp - P, 60, 50], pos: [0, 230, zF], material: wood });
  for (const sx of [-1, 1]) parts.push({ id: `HF${sx}`, name: "Headboard foot", size: [P + 10, yFoot, 60], pos: [sx * xp, yFoot / 2, zF], material: wood });
  parts.push({ id: "HBD", name: "Headboard board", size: [2 * xp + P, yArch - 200, 6], pos: [0, (yArch + 200) / 2, zF + 28], material: "board" });
  // its cover: a body up to where the curve starts, and a band of tilted pieces that follows the curve
  const yc0 = (H + 20) / 2;
  const edge = range(15).map((i) => -W / 2 + (W * i) / 14);
  const topY = (x: number) => Math.min(H, archY(Math.min(Math.abs(x), xp)) + 15);
  const band = 160;
  const cover: PartPiece[] = [
    { shape: "box", size: [W, yArch - 20, HT], pos: [0, (yArch + 20) / 2 - yc0, 0] },
    ...edge.slice(1).map((x, i): PartPiece => {
      const x0 = edge[i], y0 = topY(x0), y1 = topY(x);
      const a = Math.atan2(y1 - y0, x - x0);
      return { shape: "box", size: [Math.hypot(x - x0, y1 - y0) + 4, band, HT], pos: [(x + x0) / 2 + (Math.sin(a) * band) / 2, (y0 + y1) / 2 - (Math.cos(a) * band) / 2 - yc0, 0], rot: [0, 0, a] };
    }),
  ];
  parts.push({ id: "HC", name: "Headboard cover", size: [W, H - 20, HT], pos: [0, (H + 20) / 2, zh], material: "soft", pieces: cover });

  // the footboard on two keyhole feet, and its cover
  parts.push({ id: "FB", name: "Footboard", size: [W - 20, FH - 40, 30], pos: [0, 40 + (FH - 40) / 2, zf], material: "board" });
  for (const sx of [-1, 1]) parts.push({ id: `FF${sx}`, name: "Footboard foot", size: [90, 40, 50], pos: [sx * (W / 2 - 90), 20, zf], material: wood });
  parts.push({ id: "FC", name: "Footboard cover", size: [W, FH, FT], pos: [0, FH / 2 + 5, zf], material: "soft" });

  // side rails with the slat rail along their inside, and their covers down to the floor
  const xr = W / 2 - 30;
  const yR0 = 220, yR1 = 400, ySl = 330;
  const Lr = zi1 - zi0;
  for (const sx of [-1, 1]) {
    parts.push({
      id: `SR${sx}`,
      name: "Side rail",
      size: [50, yR1 - yR0, Lr],
      pos: [sx * xr, (yR0 + yR1) / 2, (zi0 + zi1) / 2],
      material: wood,
      rot: sx < 0 ? [0, Math.PI, 0] : undefined,
      pieces: [
        { shape: "box", size: [20, yR1 - yR0, Lr], pos: [15, 0, 0] },
        { shape: "box", size: [30, 30, Lr - 20], pos: [-10, ySl - 15 - (yR0 + yR1) / 2, 0], material: "metal" },
      ],
    });
    parts.push({ id: `SC${sx}`, name: "Side cover", size: [12, yR1 + 10, Lr], pos: [sx * (W / 2 - 6), (yR1 + 10) / 2 + 5, (zi0 + zi1) / 2], material: "soft" });
  }
  const xin = xr - 25; // inside of the slat rails
  parts.push({ id: "CB", name: "Cross bar", size: [2 * xin, 40, 60], pos: [0, ySl - 20, 0], material: wood });
  if (wide) {
    // the beam, with its leg down towards the floor where the foot bolt goes in
    const zc = (zi0 + zi1) / 2, legZ = -L / 4 - zc, legLo = 20;
    parts.push({
      id: "CM",
      name: "Centre beam",
      size: [60, ySl - legLo, Lr],
      pos: [0, (ySl + legLo) / 2, zc],
      material: wood,
      pieces: [
        { shape: "box", size: [60, 40, Lr], pos: [0, (ySl - legLo) / 2 - 20, 0] },
        { shape: "box", size: [50, ySl - 40 - legLo, 50], pos: [0, -20, legZ] },
      ],
    });
  }
  const rolls = wide ? [-1, 1].map((sx) => ({ id: `SL${sx}`, x: (sx * (xin + 30)) / 2, w: xin - 40 })) : [{ id: "SL", x: 0, w: 2 * xin - 10 }];
  for (const r of rolls) parts.push({ id: r.id, name: "Slatted bed base", size: [r.w, 14, Lr - 20], pos: [r.x, ySl + 7, (zi0 + zi1) / 2], material: wood, pieces: slatRoll(r.w, Lr - 20) });

  const sides = [-1, 1];
  const keyY = [270, 350];
  const keyScrews = (z: number, dz: number, on: (sx: number) => string): CustomFix[] => sides.map((sx) => ({ ...SCREW, count: 2, at: keyY.map((y): Vec3 => [sx * xr, y, z]), dir: [0, 0, dz] as Vec3, on: on(sx) }));
  const steps: CustomStep[] = [
    {
      title: "Bolt the posts to the headboard top",
      detail: "Lay the parts face up on a rug. Two bolts through each post into the curved top, turned with the key in its handle.",
      add: ["HA", "HP-1", "HP1"],
      // down through the ends of the curve into the tops of the posts
      fix: sides.map((sx): CustomFix => ({ ...BOLT, count: 2, at: [-1, 1].map((d): Vec3 => [sx * xp, archY(xp), zF + d * 12]), dir: [0, -1, 0], on: "HA", mate: `HP${sx}` })),
      pose: "+z",
      tools: ["allen"],
      warnings: ["floor"],
      from: { "HP-1": [0, -300, 0], HP1: [0, -300, 0] },
    },
    { title: "Bolt in the centre stile", detail: "Up into the middle of the curved top, two bolts.", add: ["HS"], fix: [{ ...BOLT, count: 2, at: [-1, 1].map((d): Vec3 => [0, archY(0), zF + d * 12]), dir: [0, -1, 0], on: "HA", mate: "HS" }], tools: ["allen"], from: { HS: [0, -300, 0] } },
    {
      title: "Bolt on the bottom rail",
      detail: "Its strip of grip tape faces out. One bolt through each post and one into the stile.",
      add: ["HR"],
      fix: [
        ...sides.map((sx): CustomFix => ({ ...BOLT, count: 1, at: [[sx * (xp + P / 2), 230, zF]], dir: [-sx, 0, 0], on: `HP${sx}`, mate: "HR" })),
        { ...BOLT, count: 1, at: [[0, 200, zF]], dir: [0, 1, 0], on: "HR", mate: "HS" },
      ],
      tools: ["allen"],
      from: { HR: [0, -300, 0] },
    },
    {
      title: "Bolt on the feet",
      detail: "One at the bottom of each post, two bolts each.",
      add: ["HF-1", "HF1"],
      fix: sides.map((sx): CustomFix => ({ ...BOLT, count: 2, at: [-1, 1].map((d): Vec3 => [sx * xp + d * 12, 0, zF]), dir: [0, 1, 0], on: `HF${sx}`, mate: `HP${sx}` })),
      tools: ["allen"],
      from: { "HF-1": [0, -200, 0], HF1: [0, -200, 0] },
    },
    {
      title: "Screw on the headboard board",
      detail: "Lay it over the frame and fix it at the top in the middle, one screw through the washer.",
      add: ["HBD"],
      fix: [
        { kind: "washer", count: 1, len: 2, dia: 30, at: [[0, yArch - 30, zF + 31]], dir: [0, 0, -1], on: "HBD" },
        { ...SCREW, count: 1, at: [[0, yArch - 30, zF + 32]], dir: [0, 0, -1], on: "HBD", mate: "HS" },
      ],
      tools: ["allen"],
      from: { HBD: [0, 0, 300] },
    },
    {
      title: "Turn four screws into the footboard",
      detail: "Into the holes along its bottom edge, leaving the heads standing out.",
      add: ["FB"],
      fix: [{ ...SCREW, count: 4, at: sides.flatMap((sx) => [-1, 1].map((d): Vec3 => [sx * (W / 2 - 90) + d * 25, 40, zf])), dir: [0, 1, 0], on: "FB" }],
      pose: "+y",
      tools: ["allen"],
      from: { FB: [0, 300, 0] },
    },
    { title: "Slide the feet onto the screw heads", detail: "Push each foot's keyholes over two heads, slide it along, then tighten the screws.", add: ["FF-1", "FF1"], tools: ["allen"], from: { "FF-1": [-200, 0, 0], FF1: [200, 0, 0] } },
    {
      title: "Turn in the screws for the rails",
      detail: wide ? "Four into the headboard and four into the footboard where the rails go, and one more in each for the centre beam. Leave the heads standing out." : "Four into the headboard and four into the footboard where the rails go. Leave the heads standing out.",
      fix: [
        // into the frame faces inside the covers
        ...keyScrews(zF + 31, -1, (sx) => `HP${sx}`),
        ...keyScrews(zf - 15, 1, () => "FB"),
        ...(wide ? [
          { ...SCREW, count: 1, at: [[0, ySl - 20, zF + 31]] as Vec3[], dir: [0, 0, -1] as Vec3, on: "HBD", mate: "HS" },
          { ...SCREW, count: 1, at: [[0, ySl - 20, zf - 15]] as Vec3[], dir: [0, 0, 1] as Vec3, on: "FB" },
        ] : []),
      ],
      tools: ["allen"],
    },
    {
      title: "Hook the side rails onto the headboard",
      detail: "Stand the headboard up. Each rail's bracket drops over two screw heads.",
      add: ["SR-1", "SR1"],
      people: 2,
      from: { "SR-1": [0, 300, 0], SR1: [0, 300, 0] },
    },
    { title: "Hook the footboard onto the rails", detail: "Lift it over the brackets and lower it onto the screw heads together.", people: 2 },
    { title: "Tighten the bolts in the brackets", detail: "Four bolts, one in each rail bracket, with the key in its handle.", tools: ["allen"], check: "square" },
    {
      title: "Fit the cross bar",
      detail: "Across the middle, on the slat rails. A bolt from below through each slat rail, a spacer between the rail and the bar.",
      add: ["CB"],
      fix: [
        { kind: "washer", name: "Spacer", count: 2, len: 10, dia: 20, at: sides.map((sx): Vec3 => [sx * (xin - 20), ySl - 40, 0]), dir: [0, 1, 0], on: "CB" },
        { ...BOLT, count: 2, at: sides.map((sx): Vec3 => [sx * (xin - 20), ySl - 70, 0]), dir: [0, 1, 0], on: "CB" },
      ],
      tools: ["allen"],
      from: { CB: [0, 300, 0] },
    },
  ];
  if (wide)
    steps.push(
      {
        title: "Hook the centre beam on",
        detail: "From the headboard to the footboard, its end brackets over the screw heads. One screw at each end fixes it.",
        add: ["CM"],
        fix: [{ kind: "screw", count: 2, len: 15, dia: 6, at: [[0, ySl, zi0 + 20], [0, ySl, zi1 - 20]], dir: [0, -1, 0], on: "CM" }],
        tools: ["allen"],
        from: { CM: [0, 300, 0] },
      },
      { title: "Bolt the foot under the centre beam", detail: "A bolt up into the beam's middle leg, turned until it stands on the floor.", fix: [{ ...BOLT, count: 1, at: [[0, 0, -L / 4]], dir: [0, 1, 0], on: "CM" }], tools: ["allen"] },
      { title: "Bolt the beam to the cross bar", detail: "One long bolt down through the centre beam where it crosses the bar.", fix: [{ kind: "bolt", count: 1, len: 100, dia: 8, at: [[0, ySl, 0]], dir: [0, -1, 0], on: "CM", mate: "CB" }], tools: ["allen"] },
    );
  steps.push(
    { title: "Pull the cover over the headboard", detail: "From the top down, together, with the seams on the edges.", add: ["HC"], people: 2, from: { HC: [0, 400, 0] } },
    { title: "Fasten it round the feet", detail: "Pull the bottom edge down round each foot and press it onto the grip tape." },
    { title: "Smooth the cover over the top", detail: "Work it down so it sits tight along the curve." },
    { title: "Close the back of the cover", detail: "Pull the back flaps together and press them onto the tape." },
    { title: "Pull the cover over the footboard", detail: "From the top down, then fold it round the feet and press it onto the tape.", add: ["FC"], from: { FC: [0, 300, 0] } },
    { title: "Hang the side covers on the rails", detail: "Start at the head end, then the foot end, then the middle, pressing each part onto the rail's grip tape.", add: ["SC-1", "SC1"], from: { "SC-1": [-200, 200, 0], SC1: [200, 200, 0] } },
    {
      title: "Clip on the slat holders",
      detail: wide ? "Eight, on the slat rails and the centre beam, near the head and the foot." : "Four, on the slat rails near the head and the foot.",
      fix: [
        {
          kind: "clip",
          name: "Slat holder",
          count: wide ? 8 : 4,
          at: [...sides.map((sx) => sx * (xin - 5)), ...(wide ? [-20, 20] : [])].flatMap((x) => [zi0 + 60, zi1 - 60].map((z): Vec3 => [x, ySl + 14, z])),
          dir: [0, -1, 0],
        },
      ],
    },
    { title: "Roll out the slats", detail: wide ? "One roll each side of the centre beam, ends tucked under the holders." : "Ends tucked under the holders.", add: rolls.map((r) => r.id), from: Object.fromEntries(rolls.map((r) => [r.id, [0, 250, -600] as Vec3])) },
  );
  return { parts, steps };
}

const family: Family = {
  names: ["RAMNEFJÄLL", "RAMNEFJALL"],
  recipe,
};
export default family;

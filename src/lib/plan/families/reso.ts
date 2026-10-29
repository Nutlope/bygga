import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomParams, HwKind, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * RESÖ, read from the children's picnic table's manual. Each end frame is two splayed legs bolted across a bench
 * beam, built lying flat. The slatted top comes in one piece: it is laid upside down, the two frames are stood on
 * it and bolted to its end battens, every bolt is tightened, and it is turned over for the two benches, screwed
 * down onto the beam ends.
 */

const fx = (kind: HwKind, at: Vec3[], dir: Vec3, on: string, more: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...more });
const BOLT = { len: 50, dia: 6 };
const SCREW = { len: 40, dia: 4 };

function recipe(s: ProductSpec): CustomParams | null {
  if (!/picnic/i.test(s.variant)) return null;
  // IKEA: 92 long, 89 wide with the benches, 49 high
  const L = 920, H = 490;
  const slat = 18, gap = 12, sw = 90, topW = 5 * sw + 4 * gap;
  const bat = 40, batY = H - slat - bat / 2; // battens under the top, along its ends and middle
  const batX = L / 2 - 50 - bat / 2;
  const legT = 30, legW = 70, legX = batX + bat / 2 + legT / 2;
  const zb = 300, zt = 150, yt = H - slat - 10; // a leg runs from the floor at zb up to zt under the top
  const legZ = (y: number) => zb - ((zb - zt) * y) / yt;
  const legLen = Math.hypot(zb - zt, yt), tilt = Math.atan2(zb - zt, yt);
  const benchY = 280, bw = 90, bgap = 8, benchIn = 257, benchZ = benchIn + bw + bgap / 2;
  const beamH = 70, beamY = benchY - slat - beamH / 2, beamX = legX - legT / 2 - 15, beamD = 2 * (benchIn + 2 * bw + bgap);
  const topY = H - (slat + bat) / 2;
  const top: CustomPart = {
    id: "T", name: "Table top", size: [L, slat + bat, topW], pos: [0, topY, 0], material: "wood",
    pieces: [
      ...[0, 1, 2, 3, 4].map((i): PartPiece => ({ shape: "box", size: [L, slat, sw], pos: [0, (slat + bat) / 2 - slat / 2, -topW / 2 + sw / 2 + i * (sw + gap)] })),
      ...[-batX, 0, batX].map((x): PartPiece => ({ shape: "box", size: [bat, bat, topW - 20], pos: [x, -slat / 2, 0] })),
    ],
  };
  const parts: CustomPart[] = [top];
  const frames = [1, -1].map((sx, k) => {
    const beam = `B${k}`, legs = [`L${k}0`, `L${k}1`];
    parts.push({ id: beam, name: "Bench beam", size: [legT, beamH, beamD], pos: [sx * beamX, beamY, 0], material: "wood" });
    [1, -1].forEach((sz, j) =>
      parts.push({ id: legs[j], name: "Leg", size: [legT, legLen, legW], pos: [sx * legX, yt / 2, (sz * (zb + zt)) / 2], rot: [-sz * tilt, 0, 0], material: "wood" }),
    );
    return { sx, beam, legs };
  });
  const benches = [1, -1].map((sz, k) => {
    const id = `S${k}`;
    parts.push({
      id, name: "Bench", size: [L, slat, 2 * bw + bgap], pos: [0, benchY - slat / 2, sz * benchZ], material: "wood",
      pieces: [-1, 1].map((o): PartPiece => ({ shape: "box", size: [L, slat, bw], pos: [0, 0, (o * (bw + bgap)) / 2] })),
    });
    return { sz, id };
  });
  const out = (sx: number) => sx * (legX + legT / 2);
  const beamBolts = (f: (typeof frames)[number]) =>
    f.legs.map((leg, j) => {
      const sz = j === 0 ? 1 : -1;
      return fx("bolt", [beamY - 18, beamY + 18].map((y) => [out(f.sx), y, sz * legZ(y)] as Vec3), [-f.sx, 0, 0], leg, { ...BOLT, mate: f.beam });
    });
  const topBolts = frames.flatMap((f) =>
    f.legs.map((leg, j) => {
      const y = batY;
      return fx("bolt", [[out(f.sx), y, (j === 0 ? 1 : -1) * legZ(y)]], [-f.sx, 0, 0], leg, { ...BOLT, mate: "T" });
    }),
  );
  // five screws down through the two bench boards into each beam end
  const benchScrews = benches.map((b) => {
    const outer = b.sz * (benchZ + (bw + bgap) / 2), inner = b.sz * (benchZ - (bw + bgap) / 2);
    const row = (x: number): Vec3[] => [...[-25, 0, 25].map((dz) => [x, benchY, outer + dz] as Vec3), ...[-20, 20].map((dz) => [x, benchY, inner + dz] as Vec3)];
    return fx("screw", frames.flatMap((f) => row(f.sx * beamX)), [0, -1, 0], b.id, { ...SCREW });
  });
  // both frames wait at the same height while lying flat: the second one is moved across to the first one's side
  const aside = (f: (typeof frames)[number]) =>
    Object.fromEntries([f.beam, ...f.legs].map((id) => [id, (f.sx > 0 ? [0, 0, 700] : [(2 * beamX) / 1.6, 0, -700]) as Vec3]));
  const onto = Object.fromEntries(frames.flatMap((f) => [f.beam, ...f.legs]).map((id) => [id, [0, -360, 0] as Vec3]));
  return {
    parts,
    steps: [
      ...frames.map((f, k) => ({
        title: k === 0 ? "Bolt two legs across a bench beam" : "Build the second end frame the same way",
        detail: k === 0
          ? "Lay the beam flat and the two legs over it, splayed like an A with the beam across them. Two bolts through each leg, by hand for now."
          : "Two legs over the other beam, two bolts through each.",
        fix: beamBolts(f),
        wait: [f.beam, ...f.legs],
        from: aside(f),
        tools: ["allen" as const],
        pose: (f.sx > 0 ? "+x" : "-x") as "+x" | "-x",
      })),
      {
        title: "Lay the table top upside down",
        detail: "On the flattened box or a rug, battens up.",
        add: ["T"],
        pose: "-y",
        warnings: ["floor"],
      },
      {
        title: "Stand the end frames on and bolt them to the top",
        detail: "Each frame goes against an end batten, beam out. One bolt through each leg into the batten.",
        add: [...frames.flatMap((f) => [f.beam, ...f.legs])],
        from: onto,
        fix: topBolts,
        people: 2,
      },
      {
        title: "Tighten every bolt",
        detail: "All twelve, now the frames sit square on the top.",
        tools: ["allen"],
      },
      {
        title: "Turn it over",
        detail: "Two of you, lifting by the top and the frames, not one leg.",
        pose: "+y",
        people: 2,
      },
      {
        title: "Screw the benches onto the beams",
        detail: "Each bench rests on the two beam ends on its side. Five screws down into each beam end.",
        add: benches.map((b) => b.id),
        fix: benchScrews,
        tools: ["screwdriver"],
      },
    ],
  };
}

const family: Family = { names: ["RESÖ", "RESO"], recipe };
export default family;

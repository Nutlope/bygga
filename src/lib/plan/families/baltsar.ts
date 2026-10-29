import type { Family } from "./family";
import type { CustomParams, CustomPart, CustomStep, ProductSpec } from "../../types";

/**
 * BALTSAR, read from the swivel chair's manual. No tools and no screws: the column pushes into the round base
 * with a ring, the seat shell presses onto its top with a cup, and the seat pad clips into the shell. Sitting on
 * it presses the shell home. The four-legged chair has no manual online; IKEA's page says it goes together without
 * tools or screws: the four beech legs push into the sockets under the same shell, and the pad clips in as above.
 */

function swivel(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10;
  const H = Math.min(s.size.h * 10, 850); // IKEA: 85 cm at the top of the back
  const seatY = 450; // top of the pad
  const base = 480, bt = 30;
  const shellY = seatY - 25; // top of the shell's seat
  const colTop = shellY - 60;
  const mid = colTop + (H - colTop) / 2;
  const parts: CustomPart[] = [
    { id: "A", name: "Base", shape: "cyl", size: [base, bt, base], pos: [0, bt / 2, 0], material: "metal" },
    { id: "B", name: "Column", shape: "cyl", size: [55, colTop - bt, 55], pos: [0, bt + (colTop - bt) / 2, 0], material: "metal" },
    {
      id: "C",
      name: "Seat shell",
      size: [W, H - colTop, D],
      pos: [0, colTop + (H - colTop) / 2, 0],
      material: "board",
      pieces: [
        // the bowl of the seat, the cup under it, the back and its rounded sides
        { shape: "box", size: [W - 100, 30, D - 60], pos: [0, shellY - 15 - mid, 30] },
        { shape: "cyl", size: [90, 30, 90], pos: [0, colTop + 15 - mid, 0] },
        // the back: straight at the bottom, rounded at the top
        { shape: "box", size: [W - 60, H - shellY - (W - 60) / 2, 30], pos: [0, (shellY + H - (W - 60) / 2) / 2 - mid, -D / 2 + 15] },
        { shape: "halfcyl", size: [W - 60, 30, (W - 60) / 2], pos: [0, H - (W - 60) / 4 - mid, -D / 2 + 15], rot: [-Math.PI / 2, 0, 0] },
        { shape: "box", size: [30, 120, D - 160], pos: [-W / 2 + 15, shellY + 50 - mid, -40] },
        { shape: "box", size: [30, 120, D - 160], pos: [W / 2 - 15, shellY + 50 - mid, -40] },
      ],
    },
    { id: "D", name: "Seat pad", size: [W - 140, 25, D - 130], pos: [0, seatY - 12, 40], material: "soft" },
  ];
  const steps: CustomStep[] = [
    {
      title: "Push the column into the base",
      detail: "Put the ring into the hole in the base first, then push the narrow end of the column into it.",
      add: ["A", "B"],
      fix: [{ kind: "clip", name: "Ring", count: 1, len: 8, dia: 40, at: [[0, bt, 0]], dir: [0, -1, 0], on: "A", mate: "B" }],
      warnings: ["floor"],
    },
    { title: "Press the column down", detail: "Push down hard on top of the column until it sits firmly in the base.", warnings: ["hand"] },
    {
      title: "Press the seat shell onto the column",
      detail: "Fit the cup onto the top of the column, then push the shell straight down onto it.",
      add: ["C"],
      fix: [{ kind: "clip", name: "Cup", count: 1, len: 30, dia: 60, at: [[0, colTop, 0]], dir: [0, -1, 0], on: "B", mate: "C" }],
    },
    {
      title: "Clip in the seat pad",
      detail: "Slide its back edge in under the lip first, then press the front down. Sit on the chair once to press the shell fully home.",
      add: ["D"],
    },
  ];
  return { parts, steps };
}

function chair(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10;
  const H = Math.min(s.size.h * 10, 850);
  const seatY = 460, shellY = seatY - 25, under = shellY - 60;
  const mid = under + (H - under) / 2;
  const legLen = under + 30, splay = 0.13;
  const lx = W / 2 - 110, lz = D / 2 - 120; // where the legs meet the shell
  const parts: CustomPart[] = [
    {
      id: "C",
      name: "Seat shell",
      size: [W, H - under, D],
      pos: [0, mid, 0],
      material: "board",
      pieces: [
        { shape: "box", size: [W - 100, 30, D - 60], pos: [0, shellY - 15 - mid, 30] },
        { shape: "box", size: [W - 60, H - shellY - (W - 60) / 2, 30], pos: [0, (shellY + H - (W - 60) / 2) / 2 - mid, -D / 2 + 15] },
        { shape: "halfcyl", size: [W - 60, 30, (W - 60) / 2], pos: [0, H - (W - 60) / 4 - mid, -D / 2 + 15], rot: [-Math.PI / 2, 0, 0] },
        { shape: "box", size: [30, 120, D - 160], pos: [-W / 2 + 15, shellY + 50 - mid, -40] },
        { shape: "box", size: [30, 120, D - 160], pos: [W / 2 - 15, shellY + 50 - mid, -40] },
        // the four leg sockets under the seat
        ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ shape: "cyl" as const, size: [50, 60, 50] as [number, number, number], pos: [sx * lx, under + 30 - mid, sz * lz] as [number, number, number], rot: [-sz * splay, 0, sx * splay] as [number, number, number] }))),
      ],
    },
    ...[-1, 1].flatMap((sx) =>
      [-1, 1].map((sz, j): CustomPart => {
        const dx = Math.sin(splay) * legLen / 2, dz = Math.sin(splay) * legLen / 2;
        return { id: `L${sx < 0 ? 0 : 1}${j}`, name: "Leg", shape: "cyl", size: [36, legLen, 36], pos: [sx * (lx + dx), under + 20 - legLen / 2, sz * (lz + dz)], rot: [-sz * splay, 0, sx * splay], material: "wood" };
      }),
    ),
    { id: "D", name: "Seat pad", size: [W - 140, 25, D - 130], pos: [0, seatY - 12, 40], material: "soft" },
  ];
  const legs = parts.filter((p) => p.name === "Leg").map((p) => p.id);
  const steps: CustomStep[] = [
    { title: "Lay the shell upside down", detail: "On a rug or the flattened box, so the seat doesn't get scratched.", add: ["C"], pose: "-y", warnings: ["floor"] },
    {
      title: "Push the legs into the shell",
      detail: "Each leg straight into its socket, firmly, until it stops. No tools or screws.",
      add: legs,
      from: Object.fromEntries(legs.map((id) => [id, [0, -260, 0] as [number, number, number]])),
      warnings: ["hand"],
    },
    { title: "Stand the chair up", detail: "Check all four legs touch the floor.", pose: "+y" },
    { title: "Clip in the seat pad", detail: "Slide its back edge in under the lip first, then press the front down.", add: ["D"] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["BALTSAR"],
  recipe(s) {
    if (/swivel/i.test(s.variant)) return swivel(s);
    if (/baltsar-chair/.test(s.slug ?? "")) return chair(s);
    return null;
  },
};
export default family;

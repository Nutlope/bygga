import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartMaterial, ProductSpec, Vec3 } from "../../types";

/**
 * BEKANT, read from the storage unit's manual (the desk has no manual we can read, so it keeps its old guide).
 * The unit is built upside down on its top: corner connectors go into the ends of the four aluminium posts, the
 * first post clicks into the top, and the three mesh panels slide into the posts' grooves one after another with
 * a post between each. Screws hold the mesh at the top, the bottom board (with the drawer runners already on it)
 * is bolted on with four plates, the castors are tightened in with the spanner and the cable ring clicks into its
 * hole. Stood up, more screws hold the mesh at the bottom and the two shelves go in. The drawer is a box with a
 * castor leg under its front, two runner catches and a handle bar; its folding tray goes inside, and the hook
 * hangs on the side.
 */

type Kind = CustomFix["kind"];
const at = (kind: Kind, pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: { len?: number; dia?: number; name?: string } = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });
const P = (id: string, name: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material: PartMaterial = "board"): CustomPart => ({
  id,
  name,
  size: [x1 - x0, y1 - y0, z1 - z0],
  pos: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
  material,
});

const SCREW = { len: 13, dia: 4 }; // the 12 short screws through the mesh
const CHIP = { len: 12, dia: 5, name: "Chipboard screw" };

function storage(s: ProductSpec): CustomParams {
  // IKEA: 41 wide, 45 deep, 101 high
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const C = 95, T = 18, Q = 26; // castor height, boards, posts
  const yB = C + T, yT = H - T; // top of the bottom board, underside of the top
  const px = W / 2 - Q / 2, pz = D / 2 - Q / 2;
  const posts: [string, number, number][] = [
    ["PLB", -1, -1],
    ["PLF", -1, 1],
    ["PRB", 1, -1],
    ["PRF", 1, 1],
  ];
  const parts: CustomPart[] = [
    P("TOP", "Top", -W / 2, W / 2, yT, H, -D / 2, D / 2),
    ...posts.map(([id, sx, sz]) => ({ id, name: "Corner post", size: [Q, yT - yB, Q] as Vec3, pos: [sx * px, (yB + yT) / 2, sz * pz] as Vec3, material: "metal" as const })),
    P("ML", "Mesh panel", -W / 2, -W / 2 + 4, yB, yT, -pz + Q / 2, pz - Q / 2, "metal"),
    P("MB", "Mesh panel", -px + Q / 2, px - Q / 2, yB, yT, -D / 2, -D / 2 + 4, "metal"),
    P("MR", "Mesh panel", W / 2 - 4, W / 2, yB, yT, -pz + Q / 2, pz - Q / 2, "metal"),
    P("BOT", "Bottom board", -W / 2, W / 2, C, yB, -D / 2, D / 2),
    P("SH0", "Shelf", -W / 2 + 4, W / 2 - 4, 420, 420 + T, -D / 2 + 4, D / 2),
    P("SH1", "Shelf", -W / 2 + 4, W / 2 - 4, 705, 705 + T, -D / 2 + 4, D / 2),
  ];
  // the drawer: front, two sides, a bottom and a back, on runners on the bottom board
  const xd = W / 2 - 30, zb = -D / 2 + 20, zf = D / 2 - 18;
  const dy0 = yB + 12, dy1 = 400;
  parts.push(
    P("DF", "Drawer front", -W / 2 + 6, W / 2 - 6, yB + 4, 410, zf, D / 2),
    P("DL", "Drawer side", -xd, -xd + 12, dy0, dy1 - 20, zb, zf),
    P("DR", "Drawer side", xd - 12, xd, dy0, dy1 - 20, zb, zf),
    P("DT", "Drawer bottom", -xd + 12, xd - 12, dy0, dy0 + 16, zb, zf),
    P("DB", "Drawer back", -xd + 12, xd - 12, dy0 + 16, dy1 - 20, zb, zb + 12),
    { id: "TRAY", name: "Tray", size: [2 * xd - 40, 60, 160], pos: [0, dy1 - 60, zb + 110], material: "soft", pieces: [{ shape: "box", size: [2 * xd - 40, 4, 160], pos: [0, -28, 0] }, { shape: "box", size: [2 * xd - 40, 60, 4], pos: [0, 0, -78] }, { shape: "box", size: [2 * xd - 40, 60, 4], pos: [0, 0, 78] }] },
  );
  const end = (y: number) => posts.map(([, sx, sz]): Vec3 => [sx * px, y, sz * pz]);
  const pair = (ids: string[]) => posts.filter(([id]) => ids.includes(id));
  // a connector into each end of a post, and a locking pin through each from the inside
  const connectors = (ids: string[]) =>
    pair(ids).flatMap(([id, x, z]) => [
      at("connector", [yB, yT].map((y): Vec3 => [x * px, y, z * pz]), [0, 1, 0], id, undefined, { len: 30, dia: 22, name: "Corner connector" }),
      at("stud", [yB + 30, yT - 30].map((y): Vec3 => [x * (px - Q / 2), y, z * pz]), [x, 0, 0], id, undefined, { len: 12, dia: 6, name: "Locking pin" }),
    ]);
  const click = (id: string): CustomFix => {
    const [, x, z] = posts.find(([p]) => p === id)!;
    return at("clip", [[x * px, yT, z * pz]], [0, 1, 0], id, "TOP", { len: 14, dia: 20, name: "Post clip" });
  };
  // through the mesh panel's bent edge into the top (going up) or the bottom board (going down)
  const meshScrews = (y: number, up: boolean): CustomFix[] => [
    at("screw", [[-W / 2 + 2, y, -120], [-W / 2 + 2, y, 120]], [0, up ? 1 : -1, 0], "ML", undefined, SCREW),
    at("screw", [[-100, y, -D / 2 + 2], [100, y, -D / 2 + 2]], [0, up ? 1 : -1, 0], "MB", undefined, SCREW),
    at("screw", [[W / 2 - 2, y, -120], [W / 2 - 2, y, 120]], [0, up ? 1 : -1, 0], "MR", undefined, SCREW),
  ];
  const castorAt = (sz: number) => [-1, 1].map((x): Vec3 => [x * (px - 10), C, sz * (pz - 10)]);
  const runnerX = xd + 6;

  const steps: CustomStep[] = [
    { title: "Fit corner connectors into two of the posts", detail: "One into each end of the post, pushed in until it sits flush, then a locking pin through each.", fix: connectors(["PLB", "PLF"]), wait: ["PLB", "PLF"], warnings: ["floor"] },
    { title: "Fit corner connectors into the other two posts", detail: "The same way. Check the grooves of each pair face the same way as the drawing.", fix: connectors(["PRB", "PRF"]), wait: ["PRB", "PRF"] },
    {
      title: "Click the first post into the top",
      detail: "Lay the top upside down on a rug. Push a post clip into the corner, then the post onto it until it clicks.",
      add: ["TOP", "PLB"],
      fix: [click("PLB")],
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Slide a mesh panel into the post", detail: "Hook its edge into the post's groove at an angle.", add: ["ML"], from: { ML: [0, 0, 300] } },
    { title: "Swing it in line with the top", detail: "Turn the panel until it stands straight along the edge of the top." },
    { title: "Slide the next post onto the panel's free edge", add: ["PLF"], from: { PLF: [0, 0, 300] } },
    { title: "Click that post into the top", detail: "A post clip in the corner first.", fix: [click("PLF")] },
    { title: "Slide the back mesh panel into the first post", detail: "Into the other groove, then swing it in line with the back edge.", add: ["MB"], from: { MB: [300, 0, 0] } },
    { title: "Slide the third post onto the back panel", add: ["PRB"], from: { PRB: [300, 0, 0] } },
    { title: "Click it into the top", fix: [click("PRB")] },
    { title: "Slide the last mesh panel in", detail: "Into the third post's free groove, then swing it straight.", add: ["MR"], from: { MR: [0, 0, 300] } },
    { title: "Slide the last post onto it", add: ["PRF"], from: { PRF: [0, 0, 300] } },
    { title: "Click the last post into the top", fix: [click("PRF")] },
    { title: "Screw the mesh panels to the top", detail: "Six screws, two through the top edge of each panel.", fix: meshScrews(yT - 2, true), tools: ["screwdriver"] },
    {
      title: "Screw the drawer runners onto the bottom board",
      detail: "The left and right runners are marked. Two screws in each, along the side edges.",
      fix: [
        at("runner", [[-runnerX, yB, 0], [runnerX, yB, 0]], [0, -1, 0], "BOT", undefined, { len: 380, dia: 30 }),
        at("screw", [-1, 1].flatMap((x) => [-120, 120].map((z): Vec3 => [x * runnerX, yB, z])), [0, -1, 0], "BOT", undefined, CHIP),
      ],
      wait: ["BOT"],
      tools: ["screwdriver"],
    },
    {
      title: "Bolt the bottom board onto the posts",
      detail: "Lower it onto the upside-down frame, cut-out edge at the front. A plate and a bolt into each corner.",
      add: ["BOT"],
      fix: [
        at("plate", posts.map(([, sx, sz]): Vec3 => [sx * (px - 25), C, sz * (pz - 25)]), [0, 1, 0], "BOT", undefined, { len: 50, dia: 25, name: "Corner plate" }),
        // up through the plate and the board into the corner connector in the post
        at("bolt", end(C - 5), [0, 1, 0], "BOT", undefined, { len: 30, dia: 6 }),
      ],
      tools: ["allen"],
      from: { BOT: [0, -300, 0] },
    },
    { title: "Screw in the two castors with brakes", detail: "At the front corners. Turn them in by hand, then tighten with the spanner.", fix: [at("castor", castorAt(1), [0, 1, 0], "BOT", undefined, { len: C, dia: 60, name: "Castor with brake" })], tools: ["wrench"] },
    { title: "Screw in the two other castors", detail: "At the back, the same way.", fix: [at("castor", castorAt(-1), [0, 1, 0], "BOT", undefined, { len: C, dia: 60 })], tools: ["wrench"] },
    { title: "Tighten the four corner bolts", detail: "Go round each one again with the Allen key. The key clips into the cable strip for keeping.", tools: ["allen"] },
    { title: "Click the cable ring into its hole", detail: "Push the two halves together through the hole in the bottom board.", fix: [at("cap", [[0, C, -D / 2 + 90]], [0, 1, 0], "BOT", undefined, { len: 15, dia: 60, name: "Cable ring" })] },
    { title: "Stand it up and screw the mesh to the bottom", detail: "Six more screws, two low down through each panel.", fix: meshScrews(yB + 2, false), pose: "+y", tools: ["screwdriver"], people: 2, warnings: ["two"] },
    { title: "Put in the lower shelf", detail: "Smooth side up, sloping edge at the front.", add: ["SH0"], from: { SH0: [0, 0, 400] } },
    { title: "Press it down onto the posts", detail: "The four clips under it click onto the posts." },
    { title: "Turn the shelf supports round", detail: "The four supports on the posts above, so they point into the unit." },
    { title: "Lay the upper shelf on them", detail: "Push it down until it clicks.", add: ["SH1"], from: { SH1: [0, 0, 400] } },
    {
      title: "Fit the drawer sides to the front",
      detail: "Lay the front face down. Two push-in fasteners into the end of each side, pressed into the front's holes.",
      add: ["DF", "DL", "DR"],
      fix: [at("nail", [[-xd + 6, 160, zf], [-xd + 6, 330, zf]], [0, 0, 1], "DL", "DF", { len: 30, dia: 8, name: "Push-in fastener" }), at("nail", [[xd - 6, 160, zf], [xd - 6, 330, zf]], [0, 0, 1], "DR", "DF", { len: 30, dia: 8, name: "Push-in fastener" })],
      warnings: ["floor"],
    },
    { title: "Turn the four cam locks", detail: "Two in each side, clockwise until the front sits tight.", fix: [-1, 1].map((x) => at("cam", [[x * (xd - 12), 160, zf - 34], [x * (xd - 12), 330, zf - 34]], [-x, 0, 0], x < 0 ? "DL" : "DR", undefined, { len: 13, dia: 15 })), tools: ["screwdriver"] },
    { title: "Slide the bottom into the grooves", add: ["DT"], from: { DT: [0, 0, -400] } },
    { title: "Push the back in", detail: "Its four tabs drop into the slots in the sides.", add: ["DB"], from: { DB: [0, 250, 0] } },
    { title: "Turn the drawer over and screw on the guide rail", detail: "Two screws, along the bottom edge of the front.", fix: [at("clip", [[0, yB + 4, zf + 9]], [0, 1, 0], "DF", undefined, { len: 12, dia: 40, name: "Guide rail" }), at("screw", [[-100, yB + 4, zf + 9], [100, yB + 4, zf + 9]], [0, 1, 0], "DF", undefined, CHIP)], pose: "-y", tools: ["screwdriver"] },
    { title: "Click the small castor into its leg", fix: [at("castor", [[0, 0, zf - 60]], [0, 1, 0], "DT", undefined, { len: 50, dia: 45, name: "Small castor" })] },
    { title: "Screw the leg under the drawer", detail: "Four screws through its plate, near the front.", fix: [at("plate", [[0, dy0, zf - 60]], [0, 1, 0], "DT", undefined, { len: 80, dia: 30, name: "Castor leg" }), at("screw", [-1, 1].flatMap((x) => [-1, 1].map((z): Vec3 => [x * 30, dy0, zf - 60 + z * 15])), [0, 1, 0], "DT", undefined, SCREW)], tools: ["screwdriver"] },
    { title: "Screw on the first runner catch", detail: "Under the drawer side, two screws.", fix: [at("clip", [[-xd + 6, dy0, zf - 50]], [0, 1, 0], "DL", undefined, { len: 60, dia: 20, name: "Runner catch" }), at("screw", [[-xd + 6, dy0, zf - 24], [-xd + 6, dy0, zf - 76]], [0, 1, 0], "DL", undefined, SCREW)], tools: ["screwdriver"] },
    { title: "Screw on the other runner catch", detail: "Under the other side, the same way.", fix: [at("clip", [[xd - 6, dy0, zf - 50]], [0, 1, 0], "DR", undefined, { len: 60, dia: 20, name: "Runner catch" }), at("screw", [[xd - 6, dy0, zf - 24], [xd - 6, dy0, zf - 76]], [0, 1, 0], "DR", undefined, SCREW)], tools: ["screwdriver"] },
    { title: "Turn it over and screw on the handle bar", detail: "Along the top of the front, three screws from inside.", fix: [at("handle", [[0, 395, D / 2]], [0, 0, -1], "DF", undefined, { len: 300, dia: 20, name: "Handle bar" }), at("screw", [-120, 0, 120].map((x): Vec3 => [x, 395, zf]), [0, 0, 1], "DF", undefined, CHIP)], pose: "+y", tools: ["screwdriver"] },
    { title: "Fold the tray", detail: "Bend both ends up along the creases until they stand square." },
    { title: "Clip the tray's ends", detail: "Hook the folded ends over its sides so it holds its shape." },
    { title: "Set the tray in the drawer", detail: "It hangs at the back of the drawer.", add: ["TRAY"], from: { TRAY: [0, 300, 0] } },
    { title: "Slide the drawer in", detail: "Line it up with the runners and push until both catches click. To take it out, pull it all the way and lift the catches." },
    { title: "Hang the hook on the side", detail: "Push it into the mesh at the height you want.", fix: [at("hook", [[W / 2, 820, 60]], [-1, 0, 0], "MR", undefined, { len: 80, dia: 50, name: "Bag hook" })] },
  ];
  return finish({ parts, steps });
}

/** Parts that first show up holding their fittings are listed on the last step too, so none is added twice. */
function finish(c: CustomParams): CustomParams {
  const added = new Set(c.steps.flatMap((st) => st.add ?? []));
  const rest = c.parts.filter((p) => !added.has(p.id)).map((p) => p.id);
  const last = c.steps[c.steps.length - 1];
  last.add = [...(last.add ?? []), ...rest];
  return c;
}

const family: Family = {
  names: ["BEKANT"],
  recipe(s) {
    if (!/storage unit on castors/i.test(s.variant) && !/storage-unit-on-castors/.test(s.slug ?? "")) return null;
    return storage(s);
  },
};
export default family;

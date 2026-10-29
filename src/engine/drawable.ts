import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import type { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { faceMaterial, hullMaterial, lineMaterial, withBoxHullDir, withCylHullDir, withHullDir } from "./materials";
import type { HwKind, Hole, PartType } from "@/lib/types";
import { FACE } from "./materials";

export class Drawable {
  root = new THREE.Group();
  faces: THREE.ShaderMaterial[] = [];
  lines: LineMaterial[] = [];
  thin: LineMaterial[] = [];
  hulls: THREE.ShaderMaterial[] = [];
  meshes: THREE.Mesh[] = [];
  base: THREE.Color[] = [];
  opacity = 1;
}

interface GeoEntry {
  geo: THREE.BufferGeometry;
  edges: LineSegmentsGeometry;
}
const geoCache = new Map<string, GeoEntry>();

function entry(key: string, make: () => THREE.BufferGeometry, threshold = 30): GeoEntry {
  let e = geoCache.get(key);
  if (!e) {
    const geo = make();
    const edges = new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(geo, threshold));
    e = { geo, edges };
    geoCache.set(key, e);
  }
  return e;
}

type HullKind = "cyl" | "radial" | "box" | null;

export function addSolid(
  d: Drawable,
  key: string,
  make: () => THREE.BufferGeometry,
  color: THREE.Color,
  o: { hull?: HullKind; half?: THREE.Vector3Tuple; cy?: number; position?: THREE.Vector3Tuple; rotation?: THREE.Vector3Tuple; edges?: boolean; parent?: THREE.Object3D } = {},
) {
  const e = entry(key, () => {
    const g = make();
    if (o.hull === "cyl") withCylHullDir(g, o.cy ?? 0);
    else if (o.hull === "box" && o.half) withBoxHullDir(g, ...o.half);
    else if (o.hull === "radial") {
      g.computeBoundingBox();
      const c = new THREE.Vector3();
      g.boundingBox!.getCenter(c);
      withHullDir(g, c);
    }
    return g;
  });
  const holder = new THREE.Group();
  if (o.position) holder.position.set(...o.position);
  if (o.rotation) holder.rotation.set(...o.rotation);
  const fm = faceMaterial(color);
  const mesh = new THREE.Mesh(e.geo, fm);
  holder.add(mesh);
  d.faces.push(fm);
  d.base.push(color.clone());
  d.meshes.push(mesh);
  if (o.edges !== false) {
    const lm = lineMaterial(1.6);
    const ls = new LineSegments2(e.edges, lm);
    holder.add(ls);
    d.lines.push(lm);
  }
  if (o.hull) {
    const hm = hullMaterial(1.6);
    const hull = new THREE.Mesh(e.geo, hm);
  if (o.hull === "box") hm.uniforms.uWidth.value = 2;
    hull.renderOrder = -1;
    holder.add(hull);
    d.hulls.push(hm);
  }
  (o.parent ?? d.root).add(holder);
  return holder;
}

/* ---------------- parts ---------------- */

const MAT_COLOR: Record<string, THREE.Color> = {
  board: FACE.board,
  fiber: FACE.fiber,
  wood: FACE.wood,
  metal: FACE.metal,
  soft: FACE.soft,
  glass: FACE.glass,
};

export function partDrawable(p: PartType, holes: Hole[]) {
  const d = new Drawable();
  const [sx, sy, sz] = p.size;
  const color = MAT_COLOR[p.material] ?? FACE.board;
  if (p.pieces) {
    for (const q of p.pieces) {
      const [qx, qy, qz] = q.size;
      const mat = q.material ?? p.material;
      const c = MAT_COLOR[mat] ?? FACE.board;
      const at = { position: q.pos, rotation: q.rot };
      if (q.shape === "slab" && q.outline?.length) addSolid(d, `slab:${qy}:${q.round ?? 0}:${q.outline.flat().map(Math.round).join(",")}`, () => slab(q.outline!, qy, q.round ?? 0), c, { hull: "radial", ...at });
      else if (q.shape === "halfcyl") addSolid(d, `hcyl:${qx}:${qy}`, () => halfDisc(qx, qy), c, { hull: "radial", ...at });
      else if (q.shape === "cyl") addSolid(d, `cyl:${qx}:${qy}`, () => new THREE.CylinderGeometry(qx / 2, qx / 2, qy, 32), c, { hull: "cyl", ...at });
      else if (mat === "soft") addSolid(d, `soft:${qx}:${qy}:${qz}`, () => roundedBox(qx, qy, qz, Math.min(42, qy / 2.4, qx / 3, qz / 3)), c, { hull: "box", half: [qx / 2, qy / 2, qz / 2], edges: false, ...at });
      else addSolid(d, `box:${qx}:${qy}:${qz}`, () => new THREE.BoxGeometry(qx, qy, qz), c, at);
    }
  } else if (p.shape === "cyl") {
    addSolid(d, `cyl:${sx}:${sy}`, () => new THREE.CylinderGeometry(sx / 2, sx / 2, sy, 32), color, { hull: "cyl" });
  } else if (p.material === "soft") {
    addSolid(d, `soft:${sx}:${sy}:${sz}`, () => roundedBox(sx, sy, sz, Math.min(42, sy / 2.4, sx / 3, sz / 3)), color, { hull: "box", half: [sx / 2, sy / 2, sz / 2], edges: false });
  } else {
    addSolid(d, `box:${sx}:${sy}:${sz}`, () => new THREE.BoxGeometry(sx, sy, sz), color);
  }
  // a hole is drawn only where it sits on the part: one recorded off it would float in the air
  const near = (h: Hole) => h.p.every((v, i) => Math.abs(v) <= p.size[i] / 2 + 3);
  holes = holes.filter(near);
  if (holes.length) {
    const pts: number[] = [];
    const seg = 14;
    const n = new THREE.Vector3();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (const h of holes) {
      n.set(...h.n).normalize();
      a.set(Math.abs(n.y) < 0.9 ? 0 : 1, Math.abs(n.y) < 0.9 ? 1 : 0, 0).cross(n).normalize();
      b.copy(n).cross(a).normalize();
      c.set(...h.p).addScaledVector(n, 0.35);
      for (let i = 0; i < seg; i++) {
        const t0 = (i / seg) * Math.PI * 2, t1 = ((i + 1) / seg) * Math.PI * 2;
        pts.push(
          c.x + (a.x * Math.cos(t0) + b.x * Math.sin(t0)) * h.r,
          c.y + (a.y * Math.cos(t0) + b.y * Math.sin(t0)) * h.r,
          c.z + (a.z * Math.cos(t0) + b.z * Math.sin(t0)) * h.r,
          c.x + (a.x * Math.cos(t1) + b.x * Math.sin(t1)) * h.r,
          c.y + (a.y * Math.cos(t1) + b.y * Math.sin(t1)) * h.r,
          c.z + (a.z * Math.cos(t1) + b.z * Math.sin(t1)) * h.r,
        );
      }
    }
    const g = new LineSegmentsGeometry();
    g.setPositions(pts);
    const lm = lineMaterial(1);
    d.root.add(new LineSegments2(g, lm));
    d.thin.push(lm);
  }
  return d;
}

/** A flat board cut to an outline of [x, z] corners, each corner rounded, centred on its thickness. */
function slab(pts: [number, number][], h: number, r: number) {
  const s = new THREE.Shape();
  const n = pts.length;
  pts.forEach((c, i) => {
    const prev = pts[(i + n - 1) % n], next = pts[(i + 1) % n];
    const toward = (o: [number, number], k: number): [number, number] => {
      const dx = o[0] - c[0], dz = o[1] - c[1], l = Math.hypot(dx, dz) || 1;
      return [c[0] + (dx / l) * k, c[1] + (dz / l) * k];
    };
    const k = Math.min(r, Math.hypot(prev[0] - c[0], prev[1] - c[1]) / 2, Math.hypot(next[0] - c[0], next[1] - c[1]) / 2);
    const a = toward(prev, k), b = toward(next, k);
    if (i === 0) s.moveTo(a[0], a[1]);
    else s.lineTo(a[0], a[1]);
    s.quadraticCurveTo(c[0], c[1], b[0], b[1]);
  });
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 14 });
  g.rotateX(Math.PI / 2);
  g.translate(0, h / 2, 0);
  return g;
}

/** Half a disc (one half of a round table top): flat edge along x at the back, curve towards the front, centred on its box. */
function halfDisc(dia: number, h: number) {
  const s = new THREE.Shape();
  s.absarc(0, 0, dia / 2, 0, Math.PI, false);
  s.lineTo(dia / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 32 });
  g.rotateX(Math.PI / 2);
  g.translate(0, h / 2, -dia / 4);
  return g;
}

function roundedBox(w: number, h: number, dpt: number, r: number) {
  const shape = new THREE.Shape();
  const x = -w / 2, y = -dpt / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + dpt - r);
  shape.quadraticCurveTo(x + w, y + dpt, x + w - r, y + dpt);
  shape.lineTo(x + r, y + dpt);
  shape.quadraticCurveTo(x, y + dpt, x, y + dpt - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(shape, { depth: h - r, bevelEnabled: true, bevelThickness: r / 2, bevelSize: r / 3, bevelSegments: 3, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -(h - r) / 2, 0);
  return g;
}

/* ---------------- hardware ---------------- */

const cyl = (r: number, h: number, seg = 18) => () => new THREE.CylinderGeometry(r, r, h, seg);

/**
 * Hardware is modelled along +Y with the origin on the surface it goes into.
 * Everything below y = 0 ends up inside the panel.
 */
export function hwDrawable(kind: HwKind, len: number, dia: number) {
  const d = new Drawable();
  const metal = FACE.hwMetal, wood = FACE.hwWood, plastic = FACE.hwPlastic;
  const r = dia / 2;
  switch (kind) {
    case "dowel":
      // seated 12 mm deep, like real face-drilled holes, so it never shows through a 15 mm panel
      addSolid(d, `dowel:${len}:${dia}`, cyl(r, len, 16), wood, { hull: "cyl", position: [0, len / 2 - 12, 0] });
      break;
    case "camScrew":
      addSolid(d, "cs:thread", cyl(2.9, 11, 12), metal, { hull: "cyl", position: [0, -5.5, 0] });
      addSolid(d, "cs:neck", cyl(2.2, 17, 12), metal, { hull: "cyl", position: [0, 8.5, 0] });
      addSolid(d, "cs:head", () => new THREE.SphereGeometry(3.6, 14, 10), metal, { hull: "radial", position: [0, 19.5, 0], edges: false });
      break;
    case "cam": {
      addSolid(d, "cam:body", cyl(7.4, 12.4, 22), metal, { hull: "cyl", position: [0, -6.2, 0] });
      addSolid(d, "cam:slot", () => new THREE.BoxGeometry(9, 0.8, 1.6), FACE.hwMetal, { position: [0, 0.4, 0] });
      addSolid(d, "cam:arrow", () => new THREE.ConeGeometry(1.4, 2.6, 3), FACE.hwMetal, { position: [5.2, 0.4, 0], rotation: [0, 0, -Math.PI / 2], edges: true });
      break;
    }
    case "screw": {
      const hr = Math.max(dia, 3.2);
      addSolid(d, `sc:shank:${len}:${dia}`, cyl(r * 0.92, len - 2, 10), metal, { hull: "cyl", position: [0, -(len - 2) / 2 - 2, 0] });
      addSolid(d, `sc:tip:${dia}`, () => new THREE.ConeGeometry(r * 0.92, 2.6, 10), metal, { position: [0, -len - 0.7, 0], rotation: [Math.PI, 0, 0], edges: false });
      addSolid(d, `sc:head:${dia}`, cyl(hr, 1.9, 18), metal, { hull: "cyl", position: [0, 0.95, 0] });
      addSolid(d, `sc:x1:${dia}`, () => new THREE.BoxGeometry(hr * 1.2, 0.4, 0.5), metal, { position: [0, 2.0, 0] });
      addSolid(d, `sc:x2:${dia}`, () => new THREE.BoxGeometry(0.5, 0.4, hr * 1.2), metal, { position: [0, 2.0, 0] });
      break;
    }
    case "nail":
      addSolid(d, `nail:${len}`, cyl(r, len, 8), metal, { hull: "cyl", position: [0, -len / 2, 0] });
      addSolid(d, "nail:head", cyl(r * 1.7, 0.7, 12), metal, { hull: "cyl", position: [0, 0.35, 0] });
      break;
    case "pin":
      addSolid(d, `pin:${dia}`, cyl(r, 16, 12), metal, { hull: "cyl" });
      addSolid(d, `pin:collar:${dia}`, cyl(r + 1.2, 1.2, 14), metal, { hull: "cyl", position: [0, 0.6, 0] });
      break;
    case "legScrew":
      addSolid(d, `leg:${len}`, cyl(r, len, 14), metal, { hull: "cyl" });
      break;
    case "bolt":
      addSolid(d, `bolt:${len}:${dia}`, cyl(r, len, 12), metal, { hull: "cyl", position: [0, -len / 2, 0] });
      addSolid(d, `bolt:head:${dia}`, cyl(dia * 0.85, 5, 18), metal, { hull: "cyl", position: [0, 2.5, 0] });
      addSolid(d, `bolt:hex:${dia}`, cyl(dia * 0.4, 0.6, 6), FACE.hwMetal, { position: [0, 5.2, 0] });
      break;
    case "plate":
      addSolid(d, "plate", () => new THREE.BoxGeometry(70, 3, 70), metal, { position: [0, 1.5, 0] });
      addSolid(d, "plate:sock", cyl(9, 10, 18), metal, { hull: "cyl", position: [0, 8, 0] });
      break;
    case "bracket":
      addSolid(d, "br:h", () => new THREE.BoxGeometry(40, 2, 32), metal, { position: [0, 1, 0] });
      addSolid(d, "br:v", () => new THREE.BoxGeometry(40, 42, 2), metal, { position: [0, 21, -15] });
      break;
    case "runner":
      addSolid(d, `run:${len}`, () => new THREE.BoxGeometry(20, 11, len), metal, { position: [0, 5.5, 0] });
      addSolid(d, `run:lip:${len}`, () => new THREE.BoxGeometry(4, 6, len), metal, { position: [-8, 14, 0] });
      break;
    case "knob":
      addSolid(d, "knob:stem", cyl(5.5, 12, 14), wood, { hull: "cyl", position: [0, 6, 0] });
      addSolid(d, "knob:head", () => new THREE.SphereGeometry(14, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), wood, { hull: "radial", position: [0, 14, 0], edges: false });
      break;
    case "handle":
      for (const x of [-len / 2, len / 2]) addSolid(d, "hd:post", cyl(5, 26, 12), metal, { hull: "cyl", position: [x, 13, 0] });
      addSolid(d, `hd:bar:${len}`, () => new THREE.CylinderGeometry(6, 6, len + 24, 14).rotateZ(Math.PI / 2), metal, { hull: "radial", position: [0, 30, 0] });
      break;
    case "hinge":
      addSolid(d, "hg:cup", cyl(17.5, 12, 24), metal, { hull: "cyl", position: [0, -6, 0] });
      addSolid(d, "hg:flange", () => new THREE.BoxGeometry(52, 1.6, 14), metal, { position: [0, 0.8, 0] });
      addSolid(d, "hg:arm", () => new THREE.BoxGeometry(12, 40, 11), metal, { position: [4, 20, 0] });
      addSolid(d, "hg:plate", () => new THREE.BoxGeometry(4, 18, 40), metal, { position: [-4, 34, 0] });
      break;
    case "glide":
      addSolid(d, "glide", cyl(10, 4, 18), plastic, { hull: "cyl", position: [0, 2, 0] });
      break;
    case "plug":
      addSolid(d, `plug:${len}`, cyl(r, len, 12), plastic, { hull: "cyl", position: [0, -len / 2, 0] });
      addSolid(d, "plug:lip", cyl(r + 1.5, 1.5, 14), plastic, { hull: "cyl", position: [0, 0.75, 0] });
      break;
    case "castor": {
      // a pin that pushes into the base, a hood and twin wheels trailing behind the pin
      addSolid(d, "ca:pin", cyl(5.5, 22, 12), metal, { hull: "cyl", position: [0, -11, 0] });
      addSolid(d, "ca:collar", cyl(9, 3, 16), plastic, { hull: "cyl", position: [0, 1.5, 0] });
      addSolid(d, `ca:hood:${dia}`, () => new THREE.BoxGeometry(dia * 0.68, len - r - 2, dia * 0.9), plastic, { position: [0, 3 + (len - r - 2) / 2, -dia * 0.12] });
      for (const x of [-1, 1])
        addSolid(d, `ca:wheel:${dia}`, () => new THREE.CylinderGeometry(r, r, dia * 0.26, 24).rotateZ(Math.PI / 2), plastic, { hull: "radial", position: [x * dia * 0.21, len - r, -dia * 0.16] });
      break;
    }
    case "flatHinge":
      // two leaves either side of a pin, lying flat across a joint
      for (const x of [-1, 1]) addSolid(d, `fh:leaf:${len}:${dia}`, () => new THREE.BoxGeometry(len / 2 - 3, 1.6, dia), metal, { position: [x * (len / 4 + 1.5), 0.8, 0] });
      addSolid(d, `fh:pin:${dia}`, () => new THREE.CylinderGeometry(3, 3, dia, 12).rotateX(Math.PI / 2), metal, { hull: "radial", position: [0, 2.2, 0] });
      break;
    case "hook":
      // a coat peg: a thread into the wood, a round plate against it, a stem, and a ball on the end
      addSolid(d, "hk:thread", cyl(2.5, 12, 10), metal, { hull: "cyl", position: [0, -6, 0] });
      addSolid(d, `hk:plate:${dia}`, cyl(r * 0.55, 3, 20), metal, { hull: "cyl", position: [0, 1.5, 0] });
      addSolid(d, `hk:stem:${len}`, cyl(4, len - 12, 14), metal, { hull: "cyl", position: [0, 3 + (len - 12) / 2, 0] });
      addSolid(d, `hk:ball:${dia}`, () => new THREE.SphereGeometry(r * 0.42, 18, 12), metal, { hull: "radial", position: [0, len - 6, 0], edges: false });
      break;
    case "roller":
      // a sliding door's roller: a plate screwed to the door's edge, an arm, and a wheel that runs in the track
      addSolid(d, `ro:plate:${len}`, () => new THREE.BoxGeometry(len, 3, 14), metal, { position: [0, 1.5, 0] });
      addSolid(d, "ro:arm", () => new THREE.BoxGeometry(8, len * 0.45, 8), metal, { position: [0, 3 + len * 0.22, 0] });
      addSolid(d, `ro:wheel:${dia}`, () => new THREE.CylinderGeometry(r, r, 7, 22).rotateX(Math.PI / 2), plastic, { hull: "radial", position: [0, 3 + len * 0.45 + r * 0.4, 0] });
      break;
    case "connector":
      // a flat strip screwed across the joint between two sofa sections
      addSolid(d, `cn:${len}:${dia}`, () => new THREE.BoxGeometry(len, 2, dia), metal, { position: [0, 1, 0] });
      break;
    case "clip":
      // a push-in plastic clip: a stem into the hole and a flat head
      addSolid(d, "clip:stem", cyl(2.6, 9, 10), plastic, { hull: "cyl", position: [0, -4.5, 0] });
      addSolid(d, `clip:head:${dia}`, () => new THREE.BoxGeometry(dia, 3, dia * 0.7), plastic, { position: [0, 1.5, 0] });
      break;
    case "strap":
      // a wall strap lying flat against the panel
      addSolid(d, `st:${len}:${dia}`, () => new THREE.BoxGeometry(dia, 1.4, len), plastic, { position: [0, 0.7, 0] });
      break;
    case "nut":
      addSolid(d, `nut:${dia}`, cyl(dia * 0.95, Math.max(3, len), 6), metal, { hull: "cyl", position: [0, Math.max(3, len) / 2, 0] });
      break;
    case "washer":
      addSolid(d, `wa:${dia}`, cyl(r, 1.6, 20), metal, { hull: "cyl", position: [0, 0.8, 0] });
      break;
    case "stud":
      addSolid(d, `sd:${len}:${dia}`, cyl(r * 0.8, len, 12), metal, { hull: "cyl", position: [0, len / 2 - 10, 0] });
      addSolid(d, `sd:head:${dia}`, cyl(r * 1.25, 3, 16), metal, { hull: "cyl", position: [0, len - 8.5, 0] });
      break;
    case "clamp":
      addSolid(d, `cl:${len}:${dia}`, () => new THREE.BoxGeometry(len, 2.5, dia), metal, { position: [0, 1.25, 0] });
      for (const x of [-1, 1]) addSolid(d, `cl:lip:${dia}`, () => new THREE.BoxGeometry(2.5, 9, dia), metal, { position: [x * (len / 2 - 1.25), 6, 0] });
      break;
    case "angle":
      addSolid(d, `an:h:${len}:${dia}`, () => new THREE.BoxGeometry(dia, 2, len), metal, { position: [0, 1, 0] });
      addSolid(d, `an:v:${len}:${dia}`, () => new THREE.BoxGeometry(dia, len, 2), metal, { position: [0, len / 2, -len / 2 + 1] });
      break;
    case "foot":
      addSolid(d, "ft:thread", cyl(4, 14, 10), metal, { hull: "cyl", position: [0, -7, 0] });
      addSolid(d, `ft:body:${len}:${dia}`, cyl(r, len, 20), plastic, { hull: "cyl", position: [0, len / 2, 0] });
      break;
    case "spacer":
      addSolid(d, `sp:${len}:${dia}`, cyl(r, len, 18), plastic, { hull: "cyl", position: [0, len / 2, 0] });
      addSolid(d, "sp:screw", cyl(2, 10, 10), metal, { hull: "cyl", position: [0, -5, 0] });
      break;
    case "cap":
      addSolid(d, `cap:${dia}`, cyl(r, 2, 18), plastic, { hull: "cyl", position: [0, 1, 0] });
      break;
    case "gasLift": {
      // the narrow end drops into the base; the rod at the top goes up into the seat
      addSolid(d, "gl:foot", cyl(14, 60, 18), metal, { hull: "cyl", position: [0, -30, 0] });
      addSolid(d, `gl:body:${len}:${dia}`, cyl(r, len - 40, 24), metal, { hull: "cyl", position: [0, (len - 40) / 2, 0] });
      addSolid(d, "gl:ring", cyl(18, 6, 20), plastic, { hull: "cyl", position: [0, len - 37, 0] });
      addSolid(d, "gl:rod", cyl(11, 36, 16), metal, { hull: "cyl", position: [0, len - 18, 0] });
      break;
    }
  }
  return d;
}

export function wallDrawable(w: number, h: number) {
  const d = new Drawable();
  addSolid(d, `wall:${w}:${h}`, () => new THREE.BoxGeometry(w, h, 40), FACE.wall);
  return d;
}

// Small helper that collects primitive shapes and merges them into ONE mesh per material, so the
// whole home is drawn with a few dozen draw calls instead of several hundred (phones care).
// Three.js only; no React. Colours/textures are decided by the caller through the materials.
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  Euler,
  Group,
  Material,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'

export type V3 = [number, number, number]

interface Slot {
  material: Material
  cast: boolean
  geos: BufferGeometry[]
}

function mergeNonIndexed(geos: BufferGeometry[]): BufferGeometry {
  let verts = 0
  for (const g of geos) verts += g.getAttribute('position').count
  const position = new Float32Array(verts * 3)
  const normal = new Float32Array(verts * 3)
  const uv = new Float32Array(verts * 2)
  let o = 0
  for (const g of geos) {
    const p = g.getAttribute('position')
    const n = g.getAttribute('normal')
    const t = g.getAttribute('uv')
    for (let i = 0; i < p.count; i++, o++) {
      position[o * 3] = p.getX(i)
      position[o * 3 + 1] = p.getY(i)
      position[o * 3 + 2] = p.getZ(i)
      normal[o * 3] = n.getX(i)
      normal[o * 3 + 1] = n.getY(i)
      normal[o * 3 + 2] = n.getZ(i)
      uv[o * 2] = t.getX(i)
      uv[o * 2 + 1] = t.getY(i)
    }
    g.dispose()
  }
  const out = new BufferGeometry()
  out.setAttribute('position', new BufferAttribute(position, 3))
  out.setAttribute('normal', new BufferAttribute(normal, 3))
  out.setAttribute('uv', new BufferAttribute(uv, 2))
  out.computeBoundingSphere()
  return out
}

export class Batch {
  private slots = new Map<string, Slot>()
  private m = new Matrix4()
  private q = new Quaternion()
  private e = new Euler()
  private p = new Vector3()
  private s = new Vector3()

  /** Adds any geometry, positioned with `pos` and rotated (YXZ order, radians) by `rot`. */
  add(material: Material, geo: BufferGeometry, pos: V3, rot: V3 = [0, 0, 0], cast = true, scale: V3 = [1, 1, 1]): void {
    const key = `${material.uuid}|${cast ? 1 : 0}`
    let slot = this.slots.get(key)
    if (!slot) {
      slot = { material, cast, geos: [] }
      this.slots.set(key, slot)
    }
    this.e.set(rot[0], rot[1], rot[2], 'YXZ')
    this.q.setFromEuler(this.e)
    this.p.set(pos[0], pos[1], pos[2])
    this.s.set(scale[0], scale[1], scale[2])
    this.m.compose(this.p, this.q, this.s)
    const g = geo.index ? geo.toNonIndexed() : geo.clone()
    g.applyMatrix4(this.m)
    slot.geos.push(g)
    geo.dispose()
  }

  box(material: Material, size: V3, pos: V3, rot?: V3, cast = true): void {
    this.add(material, new BoxGeometry(size[0], size[1], size[2]), pos, rot, cast)
  }

  cyl(material: Material, rTop: number, rBottom: number, height: number, pos: V3, seg = 16, rot?: V3, cast = true): void {
    this.add(material, new CylinderGeometry(rTop, rBottom, height, seg), pos, rot, cast)
  }

  sphere(material: Material, r: number, pos: V3, seg = 12, scale?: V3, cast = true): void {
    this.add(material, new SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.7))), pos, [0, 0, 0], cast, scale)
  }

  torus(material: Material, r: number, tube: number, pos: V3, rot?: V3, cast = false): void {
    this.add(material, new TorusGeometry(r, tube, 8, 40), pos, rot, cast)
  }

  /** A flat rectangle; `uvScale` repeats a texture (uv × scale). By default lies flat and faces up. */
  plane(material: Material, w: number, h: number, pos: V3, rot: V3 = [-Math.PI / 2, 0, 0], uvScale: [number, number] = [1, 1], cast = false): void {
    const g = new PlaneGeometry(w, h)
    const uv = g.getAttribute('uv') as BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvScale[0], uv.getY(i) * uvScale[1])
    this.add(material, g, pos, rot, cast)
  }

  build(): Group {
    const group = new Group()
    for (const slot of this.slots.values()) {
      const mesh = new Mesh(mergeNonIndexed(slot.geos), slot.material)
      mesh.castShadow = slot.cast
      mesh.receiveShadow = true
      group.add(mesh)
    }
    this.slots.clear()
    return group
  }
}

/** A vertical sheet of cloth with regular pleats, lying in the XY plane and facing +z. */
export function pleatedSheet(width: number, height: number, pleats: number, depth: number): BufferGeometry {
  const segs = pleats * 8
  const g = new PlaneGeometry(width, height, segs, 1)
  const pos = g.getAttribute('position') as BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    pos.setZ(i, depth * Math.sin((x / width) * pleats * Math.PI * 2))
  }
  g.computeVertexNormals()
  return g
}

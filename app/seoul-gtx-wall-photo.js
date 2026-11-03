import config from './seoul-gtx-wall-photo.json' with {type: 'json'};

export const GTX_WALL_PHOTO = config;

// Feature-level visibility only: no extra tileset shader or wall clipping.
export function gtxBarricadeRetirementStyleConditions(site) {
  if (!config.enabled || site !== config.siteId) return [];
  return [[`\${FLOOR} === '${config.floor}' && \${MODEL_NAME} === '${config.barricade.model}' && \${TD_ID} === '${config.barricade.tdId}'`, false]];
}

// Follow the two existing wall faces, with one continuous image across the seam.
// Source coordinates run north to south: image left to right from the concourse.
export function gtxWallPhotoMesh() {
  const lengths = config.points.slice(1).map((b, i) => Math.hypot(b[0] - config.points[i][0], b[1] - config.points[i][1]));
  const total = lengths.reduce((sum, n) => sum + n, 0);
  const width = config.fit === 'contain' ? Math.min(total, config.height * config.imageAspect) : total;
  const start = (total - width) / 2, end = start + width;
  const positions = [], normals = [], st = [], indices = [];
  let along = 0;
  for (let i = 0; i < lengths.length; i++) {
    const originalA = config.points[i], originalB = config.points[i + 1], length = lengths[i];
    const low = Math.max(along, start), high = Math.min(along + length, end);
    if (high <= low) {along += length; continue;}
    const at = s => originalA.map((v, k) => v + (originalB[k] - v) * (s - along) / length);
    const a = at(low), b = at(high), segmentLength = high - low;
    const normal = [(b[1] - a[1]) / segmentLength, -(b[0] - a[0]) / segmentLength, 0];
    const offset = p => p.map((v, k) => v + normal[k] * config.frontOffset);
    const aa = offset(a), bb = offset(b), base = positions.length;
    positions.push(aa, bb, [bb[0], bb[1], bb[2] + config.height], [aa[0], aa[1], aa[2] + config.height]);
    normals.push(normal, normal, normal, normal);
    st.push((low - start) / width, 0, (high - start) / width, 0, (high - start) / width, 1, (low - start) / width, 1);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    along += length;
  }
  return {positions, normals, st, indices, width, availableWidth: total};
}

export function createGtxWallPhoto(C, viewer, site) {
  if (!config.enabled || site !== config.siteId) return null;
  const frame = C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(...config.origin));
  const world = p => C.Matrix4.multiplyByPoint(frame, new C.Cartesian3(...p), new C.Cartesian3());
  const mesh = gtxWallPhotoMesh(), corners = mesh.positions.map(world);
  const normals = mesh.normals.map(n => C.Matrix4.multiplyByPointAsVector(frame, new C.Cartesian3(...n), new C.Cartesian3()));
  const geometry = new C.Geometry({attributes: {
    position: new C.GeometryAttribute({componentDatatype: C.ComponentDatatype.DOUBLE, componentsPerAttribute: 3, values: new Float64Array(corners.flatMap(p => [p.x, p.y, p.z]))}),
    normal: new C.GeometryAttribute({componentDatatype: C.ComponentDatatype.FLOAT, componentsPerAttribute: 3, values: new Float32Array(normals.flatMap(p => [p.x, p.y, p.z]))}),
    st: new C.GeometryAttribute({componentDatatype: C.ComponentDatatype.FLOAT, componentsPerAttribute: 2, values: new Float32Array(mesh.st)}),
  }, indices: new Uint16Array(mesh.indices), primitiveType: C.PrimitiveType.TRIANGLES, boundingSphere: C.BoundingSphere.fromPoints(corners)});
  const entity = new C.Entity({id: config.id, name: config.label,
    properties: {facilityAssetId: config.id, floor: config.floor, mode: config.mode, sourceWallSlot: config.wallSlot}});
  const primitive = viewer.scene.primitives.add(new C.Primitive({
    geometryInstances: new C.GeometryInstance({geometry, id: entity}),
    appearance: new C.MaterialAppearance({
      material: C.Material.fromType('Image', {image: config.image}),
      materialSupport: C.MaterialAppearance.MaterialSupport.TEXTURED,
      flat: true, faceForward: true, closed: false, translucent: false,
    }), asynchronous: false, show: false,
  }));
  let disposed = false;
  return {
    primitive,
    setVisible(show) {primitive.show = Boolean(show); viewer.scene.requestRender();},
    focus(duration = 0) {
      const a = config.points[0], b = config.points.at(-1);
      const center = a.map((v, k) => (v + b[k]) / 2 + (k === 2 ? config.height / 2 : 0));
      viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);
      viewer.camera.flyToBoundingSphere(new C.BoundingSphere(world(center), 1), {
        duration, offset: new C.HeadingPitchRange(C.Math.toRadians(93), 0, 6.5),
      });
    },
    destroy() {if (disposed) return; disposed = true; viewer.scene.primitives.remove(primitive);},
  };
}

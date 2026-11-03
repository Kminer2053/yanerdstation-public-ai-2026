// Exact upper sign-frame surfaces decoded from B_1_23_15 / F02WL072.
// One catalogue colour swatch is repeated across these six coplanar panels.
export const F02WL072_FRAME = Object.freeze({
  slotKey: "45021744d021f0f515143bb63e962060f8a91ed1287c05f13aeb128f9a3ea1cb",
  slotAlias: "F02WL072-FRAME-S01",
  site: "S202103",
  floor: "2F",
  tdId: "b00540045882300332204131200",
  targetAssetId: "SEOUL-2F-F02WL072",
  targetSurfaceId: "upper-sign-frame",
  pixelWidth: 256,
  pixelHeight: 256,
  maskOffset: .010,
  imageOffset: .015,
  surfaces: Object.freeze([
    Object.freeze({
      id: "top-inner", part: "top", faces: Object.freeze([234, 235]), primary: true,
      area: 14.733275, width: 23.1591765, height: .6365315,
      normalEnu: Object.freeze([-.00822501, -.02399967, .99967813]),
      corners: Object.freeze([
        Object.freeze([126.970242178485, 37.553913334755, 41.465608]),
        Object.freeze([126.970244837611, 37.553919114939, 41.482944]),
        Object.freeze([126.969996693203, 37.553986827304, 41.483221]),
        Object.freeze([126.969994801174, 37.553981732792, 41.483223]),
      ]),
    }),
    Object.freeze({
      id: "top-outer", part: "top", faces: Object.freeze([246, 247]), primary: false,
      area: 42.342059, width: 23.080554, height: 1.8356355,
      normalEnu: Object.freeze([.00072018, -.0002132, .99999972]),
      corners: Object.freeze([
        Object.freeze([126.970242178485, 37.553913334755, 41.465608]),
        Object.freeze([126.969994801174, 37.553981732792, 41.483223]),
        Object.freeze([126.969988739745, 37.553965411544, 41.483217]),
        Object.freeze([126.970235243743, 37.553898261057, 41.420398]),
      ]),
    }),
    Object.freeze({
      id: "left-inner", part: "left", faces: Object.freeze([244, 245]), primary: false,
      area: .854422, width: .4961385, height: 1.7476055,
      normalEnu: Object.freeze([.93901271, -.34387782, -.00178229]),
      corners: Object.freeze([
        Object.freeze([126.970243342935, 37.553915946792, 39.750717]),
        Object.freeze([126.970244837611, 37.553919114939, 41.482944]),
        Object.freeze([126.970242178485, 37.553913334755, 41.465608]),
        Object.freeze([126.970242140876, 37.553913334811, 39.742883]),
      ]),
    }),
    Object.freeze({
      id: "left-middle", part: "left", faces: Object.freeze([252, 253]), primary: false,
      area: 3.046505, width: 1.7690185, height: 1.7224845,
      normalEnu: Object.freeze([.9390094, -.34388674, -.00180347]),
      corners: Object.freeze([
        Object.freeze([126.970242140876, 37.553913334811, 39.742883]),
        Object.freeze([126.970242178485, 37.553913334755, 41.465608]),
        Object.freeze([126.970235243743, 37.553898261057, 41.420398]),
        Object.freeze([126.970235307572, 37.55389848581, 39.698347]),
      ]),
    }),
    Object.freeze({
      id: "right-inner", part: "right", faces: Object.freeze([250, 251]), primary: false,
      area: .67874, width: .394071, height: 1.744305,
      normalEnu: Object.freeze([-.95892587, .28365679, .00000971]),
      corners: Object.freeze([
        Object.freeze([126.969995437996, 37.553983448021, 39.760842]),
        Object.freeze([126.969994800766, 37.55398173292, 39.760841]),
        Object.freeze([126.969994801174, 37.553981732792, 41.483223]),
        Object.freeze([126.969996693203, 37.553986827304, 41.483221]),
      ]),
    }),
    Object.freeze({
      id: "right-middle", part: "right", faces: Object.freeze([240, 241]), primary: false,
      area: 3.252131, width: 1.888163, height: 1.7223785,
      normalEnu: Object.freeze([-.95894672, .28358629, .00005569]),
      corners: Object.freeze([
        Object.freeze([126.969994800766, 37.55398173292, 39.760841]),
        Object.freeze([126.969988743836, 37.553965426299, 39.760842]),
        Object.freeze([126.969988739745, 37.553965411544, 41.483217]),
        Object.freeze([126.969994801174, 37.553981732792, 41.483223]),
      ]),
    }),
  ]),
});

export function isF02wl072FrameReplacement(replacement) {
  const slot = replacement?.slot;
  return replacement?.slot_key === F02WL072_FRAME.slotKey
    && slot?.site_id === F02WL072_FRAME.site
    && slot?.source_kind === "app_asset"
    && slot?.td_id === F02WL072_FRAME.tdId
    && slot?.target_asset_id === F02WL072_FRAME.targetAssetId
    && slot?.target_surface_id === F02WL072_FRAME.targetSurfaceId;
}

export function createF02wl072UpperFrame(Cesium, viewer, site) {
  if (site !== F02WL072_FRAME.site) return null;

  const primitives = viewer.scene.primitives.add(new Cesium.PrimitiveCollection());
  const originFrame = Cesium.Transforms.eastNorthUpToFixedFrame(
    Cesium.Cartesian3.fromDegrees(126.97082, 37.55363, 27.2),
  );
  let replacementId = "";
  let replacementUrl = "";
  let visible = true;
  let disposed = false;

  const worldNormal = (surface, distance) => Cesium.Matrix4.multiplyByPointAsVector(
    originFrame,
    new Cesium.Cartesian3(...surface.normalEnu.map((value) => value * distance)),
    new Cesium.Cartesian3(),
  );
  const offsetCorners = (surface, distance) => {
    const offset = worldNormal(surface, distance);
    return surface.corners.map(([longitude, latitude, height]) => Cesium.Cartesian3.add(
      Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
      offset,
      new Cesium.Cartesian3(),
    ));
  };
  const geometry = (surface, distance, vertexFormat) => new Cesium.CoplanarPolygonGeometry({
    polygonHierarchy: new Cesium.PolygonHierarchy(offsetCorners(surface, distance)),
    vertexFormat,
  });

  const clear = () => {
    primitives.removeAll();
    replacementId = "";
    replacementUrl = "";
    viewer.scene.requestRender();
  };

  const rebuild = (replacement) => {
    primitives.removeAll();
    const maskInstances = F02WL072_FRAME.surfaces.map((surface) => new Cesium.GeometryInstance({
      id: `${F02WL072_FRAME.slotAlias}:mask:${surface.id}`,
      geometry: geometry(surface, F02WL072_FRAME.maskOffset, Cesium.PerInstanceColorAppearance.FLAT_VERTEX_FORMAT),
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.fromCssColorString("#081117")),
      },
    }));
    const imageInstances = F02WL072_FRAME.surfaces.map((surface) => new Cesium.GeometryInstance({
      id: `${F02WL072_FRAME.slotAlias}:image:${surface.id}`,
      geometry: geometry(
        surface,
        F02WL072_FRAME.imageOffset,
        Cesium.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
      ),
    }));
    primitives.add(new Cesium.Primitive({
      geometryInstances: maskInstances,
      appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: false, closed: false }),
      asynchronous: false,
      allowPicking: false,
    }));
    primitives.add(new Cesium.Primitive({
      geometryInstances: imageInstances,
      appearance: new Cesium.MaterialAppearance({
        material: Cesium.Material.fromType("Image", {
          image: replacement.image_url,
          repeat: new Cesium.Cartesian2(1, 1),
          color: Cesium.Color.WHITE,
        }),
        materialSupport: Cesium.MaterialAppearance.MaterialSupport.TEXTURED,
        translucent: true,
        flat: true,
        faceForward: true,
        closed: false,
      }),
      asynchronous: false,
      allowPicking: false,
    }));
    replacementId = String(replacement.id || "");
    replacementUrl = String(replacement.image_url || "");
    primitives.show = visible;
    viewer.scene.requestRender();
  };

  return {
    primitives,
    setReplacement(replacement) {
      if (!isF02wl072FrameReplacement(replacement) || !replacement.image_url) {
        if (replacementId || replacementUrl) clear();
        return;
      }
      const nextId = String(replacement.id || "");
      const nextUrl = String(replacement.image_url);
      if (replacementId === nextId && replacementUrl === nextUrl) return;
      rebuild(replacement);
    },
    hasReplacement() {
      return Boolean(replacementUrl);
    },
    setVisible(nextVisible) {
      visible = Boolean(nextVisible);
      primitives.show = visible;
      viewer.scene.requestRender();
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      viewer.scene.primitives.remove(primitives);
    },
  };
}

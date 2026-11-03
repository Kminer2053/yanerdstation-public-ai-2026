import { isCoplanarSurfacePlacement } from "../src/replacement-surface-contract.js";

function offsetCorners(Cesium, placement, distance) {
  const frame = Cesium.Transforms.eastNorthUpToFixedFrame(
    Cesium.Cartesian3.fromDegrees(Number(placement.longitude), Number(placement.latitude), 0),
  );
  const localNormal = new Cesium.Cartesian3(...placement.normal_enu.map(Number));
  const worldNormal = Cesium.Matrix4.multiplyByPointAsVector(frame, localNormal, new Cesium.Cartesian3());
  Cesium.Cartesian3.normalize(worldNormal, worldNormal);
  const offset = Cesium.Cartesian3.multiplyByScalar(worldNormal, distance, new Cesium.Cartesian3());
  return placement.corners_wgs84.map(([longitude, latitude, height]) => Cesium.Cartesian3.add(
    Cesium.Cartesian3.fromDegrees(Number(longitude), Number(latitude), Number(height)),
    offset,
    new Cesium.Cartesian3(),
  ));
}

function geometry(Cesium, placement, distance, vertexFormat, textured = false) {
  const options = {
    polygonHierarchy: new Cesium.PolygonHierarchy(offsetCorners(Cesium, placement, distance)),
    vertexFormat,
  };
  if (textured) {
    options.textureCoordinates = new Cesium.PolygonHierarchy(
      placement.texture_coordinates.map(([u, v]) => new Cesium.Cartesian2(Number(u), Number(v))),
    );
  }
  return new Cesium.CoplanarPolygonGeometry(options);
}

export function createCoplanarReplacementPrimitives(Cesium, {
  replacement, slot, placement, placementIndex, placementCount, maskOffset, imageOffset,
}) {
  if (!isCoplanarSurfacePlacement(placement) || !replacement?.image_url) return null;
  const suffix = placementCount > 1 ? `:${placementIndex + 1}` : "";
  const baseId = `${replacement.slot_key}${suffix}`;
  const properties = {
    replacementSlot: slot.slot_alias || slot.model_name || replacement.slot_key,
    floor: slot.floor,
    tdId: slot.td_id,
    replacementVersion: replacement.id,
    sourceKind: slot.source_kind || "vworld_uv",
    targetAssetId: slot.target_asset_id || "",
    surfacePlacementIndex: placementIndex,
    surfacePlacementCount: placementCount,
  };
  const pickEntity = (id, name) => new Cesium.Entity({ id, name, properties });
  const mask = new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      id: pickEntity(`approved-replacement-mask:${baseId}`, `${properties.replacementSlot} 원본 이미지 차폐면`),
      geometry: geometry(Cesium, placement, maskOffset, Cesium.PerInstanceColorAppearance.FLAT_VERTEX_FORMAT),
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.fromCssColorString("#081117")),
      },
    }),
    appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: false, closed: false }),
    asynchronous: false,
    allowPicking: true,
  });
  const image = new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      id: pickEntity(`approved-replacement:${baseId}`, `${properties.replacementSlot} 승인 교체 이미지`),
      geometry: geometry(
        Cesium,
        placement,
        imageOffset,
        Cesium.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
        true,
      ),
    }),
    appearance: new Cesium.MaterialAppearance({
      material: Cesium.Material.fromType("Image", {
        image: replacement.render_image || replacement.image_url,
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
    allowPicking: true,
  });
  return { primitives: [mask, image], floor: slot.floor };
}

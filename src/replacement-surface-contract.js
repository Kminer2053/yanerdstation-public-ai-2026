const finiteNumber = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const positiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) > 0;
const WGS84_SEMI_MAJOR_METERS = 6378137;
const WGS84_ECCENTRICITY_SQUARED = 6.69437999014e-3;

export function coplanarSurfaceWindingAlignment(placement) {
  const longitude = Number(placement?.longitude);
  const latitude = Number(placement?.latitude);
  const height = Number(placement?.height_m);
  const corners = placement?.corners_wgs84;
  const normal = placement?.normal_enu?.map(Number);
  if (![longitude, latitude, height].every(Number.isFinite)
    || !Array.isArray(corners) || corners.length < 3
    || !Array.isArray(normal) || normal.length !== 3 || !normal.every(Number.isFinite)) return NaN;

  const radians = Math.PI / 180;
  const latitudeRadians = latitude * radians;
  const sinLatitude = Math.sin(latitudeRadians);
  const curvature = 1 - WGS84_ECCENTRICITY_SQUARED * sinLatitude * sinLatitude;
  const primeVerticalRadius = WGS84_SEMI_MAJOR_METERS / Math.sqrt(curvature);
  const meridionalRadius = WGS84_SEMI_MAJOR_METERS * (1 - WGS84_ECCENTRICITY_SQUARED)
    / Math.pow(curvature, 1.5);
  const point = (corner) => [
    (Number(corner[0]) - longitude) * radians * (primeVerticalRadius + height) * Math.cos(latitudeRadians),
    (Number(corner[1]) - latitude) * radians * (meridionalRadius + height),
    Number(corner[2]) - height,
  ];
  const [origin, second, third] = corners.slice(0, 3).map(point);
  const firstEdge = second.map((value, index) => value - origin[index]);
  const secondEdge = third.map((value, index) => value - origin[index]);
  const windingNormal = [
    firstEdge[1] * secondEdge[2] - firstEdge[2] * secondEdge[1],
    firstEdge[2] * secondEdge[0] - firstEdge[0] * secondEdge[2],
    firstEdge[0] * secondEdge[1] - firstEdge[1] * secondEdge[0],
  ];
  const windingLength = Math.hypot(...windingNormal);
  const normalLength = Math.hypot(...normal);
  if (windingLength <= 0 || normalLength <= 0) return NaN;
  return windingNormal.reduce((sum, value, index) => sum + value * normal[index], 0)
    / (windingLength * normalLength);
}

export function isCoplanarSurfacePlacement(placement) {
  if (placement?.render_kind !== "coplanar_polygon") return false;
  const normal = placement.normal_enu;
  const corners = placement.corners_wgs84;
  const textureCoordinates = placement.texture_coordinates;
  return Array.isArray(normal)
    && normal.length === 3
    && normal.every(finiteNumber)
    && Math.abs(Math.hypot(...normal.map(Number)) - 1) < .001
    && Array.isArray(corners)
    && corners.length === 4
    && corners.every((corner) => Array.isArray(corner)
      && corner.length === 3
      && corner.every(finiteNumber)
      && Number(corner[0]) >= -180 && Number(corner[0]) <= 180
      && Number(corner[1]) >= -90 && Number(corner[1]) <= 90)
    && Array.isArray(textureCoordinates)
    && textureCoordinates.length === corners.length
    && textureCoordinates.every((coordinate) => Array.isArray(coordinate)
      && coordinate.length === 2
      && coordinate.every((value) => finiteNumber(value) && Number(value) >= 0 && Number(value) <= 1))
    && coplanarSurfaceWindingAlignment(placement) > .99;
}

export function matchingLegacyReplacementCrop(slot, replacement) {
  const placements = Array.isArray(slot?.surface_placements) ? slot.surface_placements : [];
  for (const placement of placements) {
    const crop = placement?.legacy_replacement_crop;
    if (!crop) continue;
    const sourceWidth = Number(crop.source_width_px);
    const sourceHeight = Number(crop.source_height_px);
    const left = Number(crop.left_px);
    const top = Number(crop.top_px);
    const width = Number(crop.width_px);
    const height = Number(crop.height_px);
    if (![sourceWidth, sourceHeight, width, height].every(positiveInteger)
      || ![left, top].every((value) => Number.isInteger(value) && value >= 0)
      || left + width > sourceWidth
      || top + height > sourceHeight
      || Number(replacement?.replacement_width_px) !== sourceWidth
      || Number(replacement?.replacement_height_px) !== sourceHeight) continue;
    return { sourceWidth, sourceHeight, left, top, width, height };
  }
  return null;
}

export function legacyReplacementCropStyle(slot, replacement) {
  const crop = matchingLegacyReplacementCrop(slot, replacement);
  if (!crop) return "";
  return [
    `width:${100 * crop.sourceWidth / crop.width}%`,
    `height:${100 * crop.sourceHeight / crop.height}%`,
    `left:${-100 * crop.left / crop.width}%`,
    `top:${-100 * crop.top / crop.height}%`,
  ].join(";");
}

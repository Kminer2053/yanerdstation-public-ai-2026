// Current Seoul Station 2F information area, reconstructed from the user's
// IMG_6176.jpg and the user-selected F02WL072-S04 storefront.
// Coordinates use the image-catalog ENU frame.
// Dimensions are photo-aligned estimates rather than surveyed measurements.

const DEFAULT_ASSET_ROOT = "/assets/seoul-information-zone";

export const INFORMATION_ZONE = Object.freeze({
  id: "SEOUL-2F-INFORMATION-ZONE",
  site: "S202103",
  floor: "2F",
  origin: Object.freeze([126.97082, 37.55363, 27.2]),
  // East/front lower corner of S04, confirmed in the user's 3D view.
  // Several separate booths share F02WL054: S10/S11 is NOT this booth.
  joint: Object.freeze([-5.1958088534, -1.4853219892, 9.0584818485]),
  referenceFarCorner: Object.freeze([-13.1801625406849, -1.6756733179233976, 9.058465898623252]),
  width: 7.986622404493558,
  targetModel: "F02WL054",
  targetTdId: "b00540045882300332204276900",
  referenceFacadeSlot: "F02WL072-S04",
  referenceLogoSlot: "F02WL072-S03",
  referenceLogoSlots: Object.freeze(["F02WL072-S03", "F02WL072-S05"]),
  sourcePhoto: "IMG_6176.jpg",
  sourceObservedAt: "2026-09-11",
});

// Only these three single-placement surfaces belong to the removed S04 booth.
// Approved overlays live outside the tileset and need the same scoped exclusion.
export const RETIRED_INFORMATION_SHOP_SLOTS = Object.freeze([
  "F02WL072-S03", "F02WL072-S04", "F02WL072-S05",
]);

const facility = (definition) => Object.freeze({
  ...definition,
  surface: Object.freeze(definition.surface),
});

export const INFORMATION_FACILITIES = Object.freeze([
  facility({
    id: "SEOUL-2F-INFORMATION-BOOTH-01",
    label: "서울역 2층 인포메이션 부스",
    type: "information_booth",
    slotKey: "44692b61d4446ce8637f431c0060df7d99997dd78d507f6495845476c242ef2f",
    slotAlias: "INFO-BOOTH-01-S01",
    x: -4.55,
    frontY: -0.2,
    baseZ: 0.02,
    width: 2.25,
    depth: 1.5,
    height: 2.5,
    defaultImage: `${DEFAULT_ASSET_ROOT}/information-booth-front.png`,
    surface: { id: "front-display", width: 2.05, height: 2.47, pixelWidth: 830, pixelHeight: 1000 },
  }),
  facility({
    id: "SEOUL-2F-TRAIN-DEPARTURE-DISPLAY-01",
    label: "서울역 2층 열차행선안내 디스플레이",
    type: "train_departure_display",
    slotKey: "fc28178b5bc5646da81520d5a64731bd5e41f5693ca2b171d2016cb3fc7f36e4",
    slotAlias: "TIDS-01-S01",
    x: -4.55,
    frontY: -2.95,
    baseZ: 3.75,
    width: 3.8,
    depth: 0.22,
    height: 1.29,
    defaultImage: `${DEFAULT_ASSET_ROOT}/train-departure-display.png`,
    surface: { id: "display-face", width: 3.64, height: 1.226, pixelWidth: 960, pixelHeight: 323 },
  }),
  facility({
    id: "SEOUL-2F-GUIDE-BOARD-01",
    label: "서울역 2층 좌측 세로 안내게시판 1",
    type: "guide_board",
    slotKey: "524dcbef517f512b1e9624e8999eed47d62a47c06889f7254ddd06ca9bac010e",
    slotAlias: "INFO-GUIDE-01-S01",
    x: -0.65,
    frontY: -0.35,
    baseZ: 0.02,
    width: 0.68,
    depth: 0.18,
    height: 1.78,
    defaultImage: `${DEFAULT_ASSET_ROOT}/guide-board-default.png`,
    surface: { id: "display-face", width: 0.64, height: 1.44, pixelWidth: 400, pixelHeight: 900, baseOffset: 0.18 },
  }),
  facility({
    id: "SEOUL-2F-GUIDE-BOARD-02",
    label: "서울역 2층 좌측 세로 안내게시판 2",
    type: "guide_board",
    slotKey: "de2ba6d6b7acfe52548a90e389728a108d51b2636819b1fc15f17b455e477a8f",
    slotAlias: "INFO-GUIDE-02-S01",
    x: -1.45,
    frontY: -0.35,
    baseZ: 0.02,
    width: 0.68,
    depth: 0.18,
    height: 1.78,
    defaultImage: `${DEFAULT_ASSET_ROOT}/guide-board-default.png`,
    surface: { id: "display-face", width: 0.64, height: 1.44, pixelWidth: 400, pixelHeight: 900, baseOffset: 0.18 },
  }),
  facility({
    id: "SEOUL-2F-INFORMATION-TV-01",
    label: "서울역 2층 인포메이션 우측 TV",
    type: "information_tv",
    slotKey: "905302e1d8bd62c38c2e8bac6dceefbc37c2b3106477570e66db910b104178d1",
    slotAlias: "INFO-TV-01-S01",
    x: -6.85,
    frontY: -0.3,
    baseZ: 1.15,
    width: 1.36,
    depth: 0.16,
    height: 0.8,
    defaultImage: `${DEFAULT_ASSET_ROOT}/information-tv-default.png`,
    surface: { id: "display-face", width: 1.28, height: 0.72, pixelWidth: 1280, pixelHeight: 720, baseOffset: 0.04 },
  }),
]);

export const INFORMATION_FACILITY_IDS = Object.freeze(
  INFORMATION_FACILITIES.map((item) => item.id),
);

// The F02WL054 shell connected to S04, not the western S10/S11 shell.
// The back limit also preserves the separate F02FC089 surface at local Y<-3.898.
// Negative local X
// follows the kiosk frontage and negative local Y points into its body. Keeping
// the lower bound above U=9.017 protects the floor and tactile paving.
export const STAIR_FRONT_SHOP_PRISM = Object.freeze({
  id: "stair-front-shop-f02wl072-s04",
  xMin: -8.04,
  xMax: 0.02,
  yMin: -3.89,
  yMax: 0.02,
  zMin: 9.025,
  zMax: 12.20,
});

// No legacy overhead TIDS was found above S04. Do not translate the unrelated
// western display/support masks here or erase platform signs and CCTV.
export const OBSOLETE_VWORLD_PRISMS = Object.freeze([]);

export const OBSOLETE_VWORLD_VOLUMES = Object.freeze([]);

export function informationZoneAxes() {
  const [a, b] = [INFORMATION_ZONE.joint, INFORMATION_ZONE.referenceFarCorner];
  const length = Math.hypot(a[0] - b[0], a[1] - b[1]);
  const tangent = [(a[0] - b[0]) / length, (a[1] - b[1]) / length];
  return { tangent, normal: [-tangent[1], tangent[0]], angle: Math.atan2(tangent[1], tangent[0]) };
}

export function informationZoneCatalogPoint(x, y, z) {
  const { tangent, normal } = informationZoneAxes();
  return [
    INFORMATION_ZONE.joint[0] + tangent[0] * x + normal[0] * y,
    INFORMATION_ZONE.joint[1] + tangent[1] * x + normal[1] * y,
    INFORMATION_ZONE.joint[2] + z,
  ];
}

export function informationFacilitySurfaceCenter(asset) {
  return informationZoneCatalogPoint(
    asset.x,
    asset.frontY + 0.015,
    asset.baseZ + Number(asset.surface.baseOffset || 0) + asset.surface.height / 2,
  );
}

export function informationZoneLocalPoint(point) {
  const { tangent, normal } = informationZoneAxes();
  const dx = point[0] - INFORMATION_ZONE.joint[0];
  const dy = point[1] - INFORMATION_ZONE.joint[1];
  return [
    dx * tangent[0] + dy * tangent[1],
    dx * normal[0] + dy * normal[1],
    point[2],
  ];
}

export function isStairFrontShopPoint(point) {
  const [x, y, z] = informationZoneLocalPoint(point);
  const prism = STAIR_FRONT_SHOP_PRISM;
  return x >= prism.xMin && x <= prism.xMax
    && y >= prism.yMin && y <= prism.yMax
    && z >= prism.zMin && z <= prism.zMax;
}

export function isInformationZonePrismPoint(point, prism) {
  const [x, y, z] = informationZoneLocalPoint(point);
  return x >= prism.min[0] && x <= prism.max[0]
    && y >= prism.min[1] && y <= prism.max[1]
    && z >= prism.min[2] && z <= prism.max[2];
}

export function isObsoleteVworldPoint(point) {
  return isStairFrontShopPoint(point)
    || OBSOLETE_VWORLD_PRISMS.some((prism) => isInformationZonePrismPoint(point, prism))
    || OBSOLETE_VWORLD_VOLUMES.some((volume) => point.every(
      (value, index) => value >= volume.min[index] && value <= volume.max[index],
    ));
}

export function informationZoneShaderText() {
  const vector = (values) => `vec3(${values.map((value) => value.toFixed(5)).join(", ")})`;
  const prism = STAIR_FRONT_SHOP_PRISM;
  const checks = [
    `insideInformationZonePrism(localPoint, ${vector([prism.xMin, prism.yMin, prism.zMin])}, ${vector([prism.xMax, prism.yMax, prism.zMax])})`,
    ...OBSOLETE_VWORLD_PRISMS.map((volume) => `insideInformationZonePrism(localPoint, ${vector(volume.min)}, ${vector(volume.max)})`),
    ...OBSOLETE_VWORLD_VOLUMES.map((volume) => `insideInformationZoneRetirement(p, ${vector(volume.min)}, ${vector(volume.max)})`),
  ];
  return `
    bool insideInformationZoneRetirement(vec3 p, vec3 lo, vec3 hi) {
      return all(greaterThanEqual(p, lo)) && all(lessThanEqual(p, hi));
    }
    vec3 informationZoneLocal(vec3 p) {
      vec2 delta = p.xy - vec2(${INFORMATION_ZONE.joint[0].toFixed(8)}, ${INFORMATION_ZONE.joint[1].toFixed(8)});
      float localX = dot(delta, vec2(${informationZoneAxes().tangent.map((value) => value.toFixed(8)).join(", ")}));
      float localY = dot(delta, vec2(${informationZoneAxes().normal.map((value) => value.toFixed(8)).join(", ")}));
      return vec3(localX, localY, p.z);
    }
    bool insideInformationZonePrism(vec3 localPoint, vec3 lo, vec3 hi) {
      return all(greaterThanEqual(localPoint, lo)) && all(lessThanEqual(localPoint, hi));
    }
    void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
      if (u_informationZoneEnabled < 0.5) return;
      vec3 p = (u_catalogFromEye * vec4(fsInput.attributes.positionEC, 1.0)).xyz;
      vec3 localPoint = informationZoneLocal(p);
      if (${checks.join(" ||\n          ")}) discard;
    }`;
}

export function isInformationFacilityReplacement(replacement) {
  const slot = replacement?.slot;
  return slot?.source_kind === "app_asset"
    && INFORMATION_FACILITIES.some((asset) => asset.slotKey === replacement?.slot_key
      && asset.id === slot?.target_asset_id
      && asset.surface.id === slot?.target_surface_id);
}

function transparentPixelCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  canvas.getContext("2d").clearRect(0, 0, 1, 1);
  return canvas;
}

export async function createSeoulInformationZone(Cesium, viewer, tileset, site, { maskManagedExternally = false } = {}) {
  if (site !== INFORMATION_ZONE.site) return null;

  const catalogFrame = Cesium.Transforms.eastNorthUpToFixedFrame(
    Cesium.Cartesian3.fromDegrees(...INFORMATION_ZONE.origin),
  );
  let shader = null;
  let removePreRender = () => {};
  if (!maskManagedExternally) {
    const inverseCatalog = Cesium.Matrix4.inverseTransformation(catalogFrame, new Cesium.Matrix4());
    const eyeToCatalog = new Cesium.Matrix4();
    shader = new Cesium.CustomShader({
      uniforms: {
        u_catalogFromEye: { type: Cesium.UniformType.MAT4, value: eyeToCatalog },
        u_informationZoneEnabled: { type: Cesium.UniformType.FLOAT, value: 0 },
      },
      fragmentShaderText: informationZoneShaderText(),
    });
    const updateEyeMatrix = () => {
      Cesium.Matrix4.multiply(inverseCatalog, viewer.camera.inverseViewMatrix, eyeToCatalog);
      shader.setUniform("u_catalogFromEye", eyeToCatalog);
    };
    tileset.customShader = shader;
    removePreRender = viewer.scene.preRender.addEventListener(updateEyeMatrix);
    updateEyeMatrix();
  }

  const source = new Cesium.CustomDataSource("STATION_ONE_SEOUL_INFORMATION_ZONE_CURRENT");
  await viewer.dataSources.add(source);
  const { angle } = informationZoneAxes();
  const rotation = Cesium.Matrix3.fromRotationZ(angle);
  const root = Cesium.Matrix4.multiply(
    catalogFrame,
    Cesium.Matrix4.fromRotationTranslation(rotation, new Cesium.Cartesian3(...INFORMATION_ZONE.joint)),
    new Cesium.Matrix4(),
  );
  const orientation = Cesium.Quaternion.fromRotationMatrix(
    Cesium.Matrix4.getMatrix3(root, new Cesium.Matrix3()),
  );
  const position = (x, y, z) => Cesium.Matrix4.multiplyByPoint(
    catalogFrame,
    new Cesium.Cartesian3(...informationZoneCatalogPoint(x, y, z)),
    new Cesium.Cartesian3(),
  );
  const color = (css) => Cesium.Color.fromCssColorString(css);
  const white = color("#f4f5f1");
  const blue = color("#083f93");
  const dark = color("#141b20");
  const silver = color("#9da9ac");
  const surfaceRecords = new Map();
  let entityIndex = 0;

  const propertiesFor = (asset) => ({
    facilityAssetId: asset.id,
    facilityType: asset.type,
    replacementSlot: asset.slotAlias,
    targetAssetId: asset.id,
    floor: INFORMATION_ZONE.floor,
    source: INFORMATION_ZONE.sourcePhoto,
    surveyed: false,
  });
  const addBox = (asset, name, x, y, z, width, depth, height, material) => source.entities.add({
    id: `${asset.id}:${name}:${entityIndex++}`,
    name: asset.label,
    position: position(x, y, z + height / 2),
    orientation,
    properties: propertiesFor(asset),
    box: {
      dimensions: new Cesium.Cartesian3(width, depth, height),
      material,
      shadows: Cesium.ShadowMode.ENABLED,
    },
  });
  const addSurface = (asset) => {
    const surfaceBaseZ = asset.baseZ + Number(asset.surface.baseOffset || 0);
    const left = position(asset.x + asset.surface.width / 2, asset.frontY + 0.015, surfaceBaseZ);
    const right = position(asset.x - asset.surface.width / 2, asset.frontY + 0.015, surfaceBaseZ);
    const leftHeight = Cesium.Cartographic.fromCartesian(left).height;
    const rightHeight = Cesium.Cartographic.fromCartesian(right).height;
    const material = new Cesium.ImageMaterialProperty({
      image: asset.defaultImage || transparentPixelCanvas(),
      transparent: false,
      color: Cesium.Color.WHITE,
    });
    const entity = source.entities.add({
      id: `${asset.id}:${asset.surface.id}`,
      name: `${asset.label} · 관리 화면`,
      properties: {
        ...propertiesFor(asset),
        targetSurfaceId: asset.surface.id,
        replacementSlotKey: asset.slotKey,
      },
      wall: {
        // Positive local X is screen-left from the concourse. This order keeps
        // uploaded files in their ordinary, non-mirrored left-to-right direction.
        positions: [left, right],
        minimumHeights: [leftHeight, rightHeight],
        maximumHeights: [leftHeight + asset.surface.height, rightHeight + asset.surface.height],
        material,
        outline: false,
        shadows: Cesium.ShadowMode.DISABLED,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 650),
      },
    });
    surfaceRecords.set(asset.slotKey, {
      asset,
      entity,
      material,
      active: false,
      url: "",
      request: 0,
    });
  };

  for (const asset of INFORMATION_FACILITIES) {
    const bodyY = asset.frontY - asset.depth / 2;
    if (asset.type === "information_booth") {
      addBox(asset, "body", asset.x, bodyY, asset.baseZ, asset.width, asset.depth, asset.height, white);
      addBox(asset, "blue-plinth", asset.x, asset.frontY - 0.035, asset.baseZ, asset.width, 0.07, 0.67, blue);
      addBox(asset, "roof-cap", asset.x, bodyY, asset.baseZ + asset.height, asset.width + 0.12, asset.depth + 0.12, 0.1, silver);
    } else if (asset.type === "train_departure_display") {
      addBox(asset, "display-case", asset.x, bodyY, asset.baseZ, asset.width, asset.depth, asset.height, dark);
      // The field photo has a grounded canopy frame behind the booth, with
      // the TIDS supported above it, rather than a floating display beam.
      for (const supportX of [asset.x - 2.08, asset.x + 2.08]) {
        for (const supportY of [-1.55, -3.10]) {
          addBox(asset, "canopy-column", supportX, supportY, 0.02, 0.14, 0.14, 2.98, silver);
        }
        addBox(asset, "canopy-side-beam", supportX, -2.325, 2.96, 0.18, 1.72, 0.18, silver);
      }
      for (const beamY of [-1.55, -3.10]) {
        addBox(asset, "canopy-cross-beam", asset.x, beamY, 2.96, 4.42, 0.20, 0.18, silver);
      }
      for (const supportX of [asset.x - 1.38, asset.x + 1.38]) {
        addBox(asset, "support", supportX, asset.frontY - 0.16, 3.10, 0.12, 0.12, asset.baseZ - 3.10, dark);
      }
    } else if (asset.type === "guide_board") {
      addBox(asset, "frame", asset.x, bodyY, asset.baseZ, asset.width, asset.depth, asset.height, dark);
      addBox(asset, "foot", asset.x, bodyY, asset.baseZ - 0.01, asset.width + 0.16, asset.depth + 0.18, 0.08, silver);
    } else if (asset.type === "information_tv") {
      addBox(asset, "screen-case", asset.x, bodyY, asset.baseZ, asset.width, asset.depth, asset.height, dark);
      addBox(asset, "stand", asset.x, asset.frontY - 0.11, 0.04, 0.1, 0.1, asset.baseZ - 0.04, dark);
      addBox(asset, "stand-foot", asset.x, asset.frontY - 0.11, 0.02, 0.58, 0.34, 0.06, dark);
    }
    addSurface(asset);
  }

  let disposed = false;
  const setSurfaceReplacement = (record, replacement) => {
    const nextUrl = String(replacement?.image_url || "");
    const request = ++record.request;
    if (!nextUrl) {
      record.active = false;
      record.url = "";
      record.material.image = record.asset.defaultImage;
      viewer.scene.requestRender();
      return;
    }
    if (record.active && record.url === nextUrl) return;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      if (disposed || request !== record.request) return;
      record.material.image = image;
      record.active = true;
      record.url = nextUrl;
      viewer.scene.requestRender();
    };
    image.onerror = () => {
      if (disposed || request !== record.request) return;
      console.warn("Information facility replacement image failed to load", record.asset.slotAlias);
    };
    image.src = nextUrl;
  };

  return {
    source,
    setReplacements(replacements = []) {
      const approvedBySlot = new Map(
        replacements.filter(isInformationFacilityReplacement).map((replacement) => [replacement.slot_key, replacement]),
      );
      for (const [slotKey, record] of surfaceRecords) {
        setSurfaceReplacement(record, approvedBySlot.get(slotKey) || null);
      }
    },
    hasReplacement(assetId) {
      return [...surfaceRecords.values()].some((record) => record.asset.id === assetId && record.active);
    },
    setVisible(visible) {
      source.show = Boolean(visible);
      shader?.setUniform("u_informationZoneEnabled", visible ? 1 : 0);
      viewer.scene.requestRender();
    },
    focusAsset(assetId, duration = 0.8) {
      const asset = INFORMATION_FACILITIES.find((item) => item.id === assetId);
      if (!asset) return false;
      const center = position(asset.x, asset.frontY, asset.baseZ + asset.height / 2);
      const radius = Math.max(asset.width, asset.height, asset.depth) * 0.68;
      viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(center, radius), {
        duration,
        offset: new Cesium.HeadingPitchRange(Math.PI - angle, -0.12, Math.max(6, asset.width * 3.1)),
      });
      return true;
    },
    focus(duration = 0.8) {
      const center = position(-4.0, -0.9, 2.0);
      viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(center, 4.8), {
        duration,
        offset: new Cesium.HeadingPitchRange(Math.PI - angle, -0.38, 18),
      });
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      for (const record of surfaceRecords.values()) record.request += 1;
      removePreRender();
      if (shader && tileset.customShader === shader) tileset.customShader = undefined;
      viewer.dataSources.remove(source, true);
      shader?.destroy();
    },
  };
}

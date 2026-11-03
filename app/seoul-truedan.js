// Photo-based renovation, anchored to decoded B_1_23_15/F02WL072-S08 vertices.
// These coordinates use the catalog ENU origin, NOT the viewer's floor origin.
// Source tiles and the neighbouring two shops are never rewritten.
import { feedbackRetirementShaderDeclarations } from './seoul-feedback-retirement.js';
import { celadonRetirementShaderDeclarations } from './seoul-celadon-retirement.js';
import { s38RetirementShaderDeclarations } from './seoul-s38-retirement.js';
import { woodDisplayRetirementShaderDeclarations } from './seoul-wood-display-retirement.js';
import { loungeSignRetirementShaderDeclarations } from './seoul-lounge-sign-retirement.js';
import { photoboothChargerRetirementShaderDeclarations } from './seoul-photobooth-retirement.js';
export const TRUEDAN = Object.freeze({
  id: 'SEOUL-2F-TRUEDAN', site: 'S202103', floor: '2F',
  origin: [126.97082, 37.55363, 27.2],
  joint: [13.6916638921, .2879689592, 9.0584676265],
  referenceFarCorner: [5.7700919495, -.7148520663, 9.0584762566],
  width: 6.0, // Estimated from the user's current photograph; not a survey dimension.
  depth: 3.676, bodyHeight: 2.45614, ridgeHeight: 3.11280, ridgeDepth: 1.261,
  referenceSlot: 'F02WL072-S08',
});

// The catalogue treats the complete front elevation as one replaceable image.
// It is intentionally independent from referenceSlot, which belongs to the
// neighbouring VWorld booth and must never receive TRUEDAN replacements.
export const TRUEDAN_FACADE = Object.freeze({
  slotKey: '7afba516acfae10344297172e7c5c80368d4d3d43b140a71a14ccedc208852bc',
  slotAlias: 'TRUEDAN-FRONT-S01',
  targetAssetId: TRUEDAN.id,
  targetSurfaceId: 'front-facade',
  width: TRUEDAN.width,
  minZ: -.025,
  maxZ: TRUEDAN.ridgeHeight,
  height: TRUEDAN.ridgeHeight + .025,
  pixelWidth: 1920,
  pixelHeight: 1004,
  maskOffset: .055,
  imageOffset: .065,
});

// Only the obsolete information equipment at this location. The same TD_ID
// contains equipment elsewhere, so globally hiding its ID would remove too much.
// Bottoms deliberately stay above the floor and tactile paving (ENU U ~9.017).
export const RETIRED_INFORMATION_VOLUMES = Object.freeze([
  { id: 'information-booth', min: [15.49, -1.33, 9.025], max: [17.42, .60, 11.05] },
  { id: 'information-screen', min: [14.52, -.40, 9.025], max: [15.59, .42, 10.88] },
  { id: 'guide-terminal', min: [17.36, -1.86, 9.025], max: [19.14, -.99, 11.25] },
]);

export function truedanAxes() {
  const [a, b] = [TRUEDAN.joint, TRUEDAN.referenceFarCorner];
  const length = Math.hypot(a[0] - b[0], a[1] - b[1]);
  const tangent = [(a[0] - b[0]) / length, (a[1] - b[1]) / length];
  return { tangent, normal: [-tangent[1], tangent[0]], angle: Math.atan2(tangent[1], tangent[0]) };
}

export function truedanCatalogPoint(x, y, z) {
  const { tangent: t, normal: n } = truedanAxes();
  return [TRUEDAN.joint[0] + t[0] * x + n[0] * y,
    TRUEDAN.joint[1] + t[1] * x + n[1] * y, TRUEDAN.joint[2] + z];
}

export function isRetiredInformationPoint(point) {
  return RETIRED_INFORMATION_VOLUMES.some(box => point.every((v, i) => v >= box.min[i] && v <= box.max[i]));
}

export function retirementShaderText() {
  const vec = values => `vec3(${values.map(n => n.toFixed(5)).join(', ')})`;
  return `
    ${feedbackRetirementShaderDeclarations()}
    ${celadonRetirementShaderDeclarations()}
    ${s38RetirementShaderDeclarations()}
    ${woodDisplayRetirementShaderDeclarations()}
    ${loungeSignRetirementShaderDeclarations()}
    ${photoboothChargerRetirementShaderDeclarations()}
    bool insideRetiredBox(vec3 p, vec3 lo, vec3 hi) {
      return all(greaterThanEqual(p, lo)) && all(lessThanEqual(p, hi));
    }
    void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
      vec3 p = (u_catalogFromEye * vec4(fsInput.attributes.positionEC, 1.0)).xyz;
      if (isReviewedFacadeRetirementPoint(p, fsInput.attributes.texCoord_0)) discard;
      if (isRetiredCeladonCase(p, fsInput.attributes.texCoord_0)) discard;
      if (isRetiredS38Booth(p, fsInput.attributes.texCoord_0)) discard;
      if (isRetiredWoodDisplay(p, fsInput.attributes.texCoord_0)) discard;
      if (isRetiredLoungeSign(p, fsInput.attributes.texCoord_0)) discard;
      if (isRetiredPhotoboothCharger(p, fsInput.attributes.texCoord_0)) discard;
      if (u_renovationEnabled < 0.5) return;
      if (${RETIRED_INFORMATION_VOLUMES.map(b => `insideRetiredBox(p, ${vec(b.min)}, ${vec(b.max)})`).join(' ||\n          ')}) discard;
    }`;
}

function wordmarkCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 1536; canvas.height = 176;
  const ctx = canvas.getContext('2d');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '700 136px Arial, sans-serif';
  ctx.lineWidth = 9; ctx.strokeStyle = '#24272a'; ctx.fillStyle = '#f6f5ef';
  ctx.strokeText('TRUEDAN', 768, 88); ctx.fillText('TRUEDAN', 768, 88);
  return canvas;
}

function transparentPixelCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 1; canvas.height = 1;
  canvas.getContext('2d').clearRect(0, 0, 1, 1);
  return canvas;
}

export async function createSeoulTruedan(Cesium, viewer, tileset, site, { maskManagedExternally = false } = {}) {
  if (site !== TRUEDAN.site) return null;
  const catalogFrame = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(...TRUEDAN.origin));
  let shader = null;
  let removePreRender = () => {};
  if (!maskManagedExternally) {
    const inverseCatalog = Cesium.Matrix4.inverseTransformation(catalogFrame, new Cesium.Matrix4());
    const eyeToCatalog = new Cesium.Matrix4();
    // Compute in CPU double precision before sending the small, eye-relative
    // matrix to the GPU. World-position floats cause visible metre-scale jitter.
    const updateEyeMatrix = () => {
      Cesium.Matrix4.multiply(inverseCatalog, viewer.camera.inverseViewMatrix, eyeToCatalog);
      shader.setUniform('u_catalogFromEye', eyeToCatalog);
    };
    shader = new Cesium.CustomShader({
      uniforms: {
        u_catalogFromEye: { type: Cesium.UniformType.MAT4, value: eyeToCatalog },
        u_renovationEnabled: { type: Cesium.UniformType.FLOAT, value: 0 },
      },
      fragmentShaderText: retirementShaderText(),
    });
    tileset.customShader = shader;
    removePreRender = viewer.scene.preRender.addEventListener(updateEyeMatrix);
    updateEyeMatrix();
  }
  const source = new Cesium.CustomDataSource('STATION_ONE_SEOUL_TRUEDAN_RENOVATION');
  await viewer.dataSources.add(source);
  const roofPrimitives = viewer.scene.primitives.add(new Cesium.PrimitiveCollection());
  const position = (x, y, z) => Cesium.Matrix4.multiplyByPoint(catalogFrame,
    new Cesium.Cartesian3(...truedanCatalogPoint(x, y, z)), new Cesium.Cartesian3());
  const rotation = Cesium.Matrix3.fromRotationZ(truedanAxes().angle);
  const root = Cesium.Matrix4.multiply(catalogFrame,
    Cesium.Matrix4.fromRotationTranslation(rotation, new Cesium.Cartesian3(...TRUEDAN.joint)), new Cesium.Matrix4());
  const orientation = Cesium.Quaternion.fromRotationMatrix(Cesium.Matrix4.getMatrix3(root, new Cesium.Matrix3()));
  const color = hex => Cesium.Color.fromCssColorString(hex);
  const gray = color('#454e50'), frame = color('#222a2c'), fascia = color('#a3a297');
  const glass = color('#172d30'), wood = color('#765036'), silver = color('#939c99');
  let index = 0;
  const properties = { renovationId: TRUEDAN.id, floor: TRUEDAN.floor, source: 'user-photo', surveyed: false };
  const box = (name, x, y, z, width, depth, height, material) => source.entities.add({
    id: `${TRUEDAN.id}:${name}:${index++}`, name: 'TRUEDAN · 사진 기준 현황 모델',
    position: position(x, y, z + height / 2), orientation, properties,
    box: { dimensions: new Cesium.Cartesian3(width, depth, height), material, shadows: Cesium.ShadowMode.ENABLED },
  });
  // Coplanar geometry handles vertical gable triangles as well as sloped roofs.
  // Geographic PolygonGraphics projects onto the ellipsoid and can collapse them.
  const face = (name, points, material) => {
    const entity = source.entities.add({
      id: `${TRUEDAN.id}:${name}:${index++}`, name: 'TRUEDAN · 사진 기준 현황 모델', properties,
    });
    const primitive = roofPrimitives.add(new Cesium.Primitive({
      geometryInstances: new Cesium.GeometryInstance({
        id: entity,
        geometry: new Cesium.CoplanarPolygonGeometry({
          polygonHierarchy: new Cesium.PolygonHierarchy(points.map(p => position(...p))),
          vertexFormat: Cesium.PerInstanceColorAppearance.FLAT_VERTEX_FORMAT,
        }),
        attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(material) },
      }),
      appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: false, closed: false }),
      asynchronous: false,
    }));
    return { entity, primitive };
  };
  const facadeForeground = [];
  const facadeForegroundPrimitives = [];
  const facadeBox = (...args) => {
    const entity = box(...args);
    facadeForeground.push(entity);
    return entity;
  };
  const { width: w, depth: d, bodyHeight: h, ridgeHeight: r, ridgeDepth: rd } = TRUEDAN;
  // Positive X is the left-hand extension as seen from the public concourse.
  // Negative Y goes into the booth; every part shares the same rigid frame.
  box('plinth', w / 2, -d / 2, -.025, w, d, .105, frame);
  box('rear-wall', w / 2, -d + .06, .08, w, .12, h - .08, gray);
  box('left-wall', w - .06, -d / 2, .08, .12, d, h - .08, gray);
  box('shared-side', .05, -d / 2, .08, .10, d, h - .08, gray);
  facadeBox('front-wall', w / 2, -.06, .08, w, .12, h - .08, gray);
  const roofFront = face('roof-front', [[0,0,h],[w,0,h],[w,-rd,r],[0,-rd,r]], fascia);
  facadeForegroundPrimitives.push(roofFront.primitive);
  face('roof-rear', [[0,-rd,r],[w,-rd,r],[w,-d,h],[0,-d,h]], fascia);
  face('roof-left', [[w,0,h],[w,-rd,r],[w,-d,h]], fascia);
  face('roof-joint', [[0,0,h],[0,-d,h],[0,-rd,r]], fascia);
  facadeBox('front-trim', w / 2, .012, h - .075, w, .08, .075, silver);

  // Ventilated utility door at the join with the existing neighbouring booth.
  facadeBox('door-frame', .66, .022, .09, 1.03, .045, 2.05, frame);
  facadeBox('door', .66, .049, .15, .89, .022, 1.93, gray);
  facadeBox('vent', .66, .063, .28, .57, .025, 1.55, frame);
  for (let z = .30; z < 1.82; z += .052) facadeBox('vent-louvre', .66, .085, z, .56, .04, .018, gray);
  facadeBox('door-handle', .995, .085, 1.04, .037, .08, .13, silver);

  facadeBox('side-window-frame', 1.91, .024, 1.04, .89, .052, 1.27, frame);
  facadeBox('side-window-glass', 1.91, .059, 1.10, .77, .024, 1.15, glass);
  // Main serving bay: window mullions, recessed glass and timber lower counter.
  facadeBox('serving-frame', 4.18, .025, .20, 3.28, .055, 2.11, frame);
  facadeBox('counter-wood', 4.18, .061, .25, 3.14, .03, .66, wood);
  for (let z = .28; z < .89; z += .071) facadeBox('wood-joint', 4.18, .082, z, 3.13, .007, .012, frame);
  facadeBox('serving-glass', 4.18, .065, 1.00, 3.14, .028, 1.24, glass);
  facadeBox('countertop', 4.18, .15, .92, 3.32, .38, .07, silver);
  for (const x of [3.12, 4.18, 5.24]) facadeBox('mullion', x, .099, 1.00, .045, .035, 1.24, frame);
  // Neutral menu panels are geometry placeholders, not invented product photos.
  for (const x of [3.52, 4.78]) {
    facadeBox('menu-frame', x, .096, 1.78, .79, .03, .39, frame);
    facadeBox('menu-panel', x, .116, 1.815, .72, .012, .32, color('#cfcec1'));
  }
  const wordmarkBase = Cesium.Cartographic.fromCartesian(position(3.96, .035, 0)).height;
  const wordmark = source.entities.add({
    id: `${TRUEDAN.id}:fixed-wordmark`, name: 'TRUEDAN · 사진 기준 현황 모델', properties,
    wall: {
      positions: [position(5.77, .035, 0), position(2.15, .035, 0)],
      minimumHeights: [wordmarkBase + 2.51, wordmarkBase + 2.51],
      maximumHeights: [wordmarkBase + 2.97, wordmarkBase + 2.97],
      material: new Cesium.ImageMaterialProperty({ image: wordmarkCanvas(), transparent: true, color: Cesium.Color.WHITE }),
    },
  });
  facadeForeground.push(wordmark);

  const facadeWall = (id, offset, material) => {
    const left = position(w, offset, 0);
    const right = position(0, offset, 0);
    const leftBase = Cesium.Cartographic.fromCartesian(left).height;
    const rightBase = Cesium.Cartographic.fromCartesian(right).height;
    return source.entities.add({
      id: `${TRUEDAN.id}:${id}`,
      name: 'TRUEDAN · 전체 파사드 교체 이미지',
      show: false,
      properties: {
        ...properties,
        replacementSlot: TRUEDAN_FACADE.slotAlias,
        targetAssetId: TRUEDAN_FACADE.targetAssetId,
        fullFacade: true,
      },
      wall: {
        // Positive X is screen-left from the public concourse, so this order
        // preserves the uploaded image's ordinary left-to-right orientation.
        positions: [left, right],
        minimumHeights: [leftBase + TRUEDAN_FACADE.minZ, rightBase + TRUEDAN_FACADE.minZ],
        maximumHeights: [leftBase + TRUEDAN_FACADE.maxZ, rightBase + TRUEDAN_FACADE.maxZ],
        material,
        outline: false,
        shadows: Cesium.ShadowMode.DISABLED,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 650),
      },
    });
  };
  const facadeImageMaterial = new Cesium.ImageMaterialProperty({
    image: transparentPixelCanvas(),
    transparent: true,
    color: Cesium.Color.WHITE,
  });
  const facadeMask = facadeWall('facade-replacement-mask', TRUEDAN_FACADE.maskOffset, color('#081117'));
  const facadeImage = facadeWall('facade-replacement-image', TRUEDAN_FACADE.imageOffset, facadeImageMaterial);
  let facadeImageActive = false;
  let facadeImageUrl = '';
  let facadeImageRequest = 0;

  const setFacadeActive = active => {
    facadeImageActive = active;
    facadeMask.show = active;
    facadeImage.show = active;
    for (const entity of facadeForeground) entity.show = !active;
    for (const primitive of facadeForegroundPrimitives) primitive.show = !active;
    viewer.scene.requestRender();
  };

  let disposed = false;
  return {
    source,
    setFacadeImage(imageUrl) {
      const nextUrl = String(imageUrl || '');
      const request = ++facadeImageRequest;
      if (!nextUrl) {
        facadeImageUrl = '';
        setFacadeActive(false);
        return;
      }
      if (facadeImageActive && facadeImageUrl === nextUrl) return;
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.decoding = 'async';
      image.onload = () => {
        if (disposed || request !== facadeImageRequest) return;
        facadeImageMaterial.image = image;
        facadeImageUrl = nextUrl;
        setFacadeActive(true);
      };
      image.onerror = () => {
        if (disposed || request !== facadeImageRequest) return;
        console.warn('TRUEDAN facade replacement image failed to load');
      };
      image.src = nextUrl;
    },
    hasFacadeImage() {
      return facadeImageActive;
    },
    setVisible(visible) {
      source.show = Boolean(visible);
      roofPrimitives.show = Boolean(visible);
      shader?.setUniform('u_renovationEnabled', visible ? 1 : 0);
      viewer.scene.requestRender();
    },
    focus(duration = .8) {
      viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(position(w / 2, 0, 1.5), 4), {
        duration,
        offset: new Cesium.HeadingPitchRange(Math.PI - truedanAxes().angle, -.14, 16),
      });
    },
    destroy() {
      if (disposed) return;
      disposed = true; facadeImageRequest += 1; removePreRender();
      if (shader && tileset.customShader === shader) tileset.customShader = undefined;
      viewer.dataSources.remove(source, true); viewer.scene.primitives.remove(roofPrimitives); shader?.destroy();
    },
  };
}

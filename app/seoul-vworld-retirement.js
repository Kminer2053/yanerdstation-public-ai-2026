// One owner for the Seoul tileset custom shader. Cesium exposes only one
// customShader per tileset, so the TRUEDAN and stair-front current-state layers
// must share this bounded retirement mask instead of overwriting each other.

import { RETIRED_INFORMATION_VOLUMES, TRUEDAN } from "./seoul-truedan.js";
import { feedbackRetirementShaderDeclarations } from './seoul-feedback-retirement.js';
import { celadonRetirementShaderDeclarations } from './seoul-celadon-retirement.js';
import { s11RetirementDeclarations } from './seoul-s11-booths.js';
import { s38RetirementShaderDeclarations } from './seoul-s38-retirement.js';
import { woodDisplayRetirementShaderDeclarations } from './seoul-wood-display-retirement.js';
import { platform111RetirementShaderDeclarations, platform111RetirementUniforms } from './seoul-platform111-retirement.js';
import { loungeSignRetirementShaderDeclarations } from './seoul-lounge-sign-retirement.js';
import { photoboothChargerRetirementShaderDeclarations } from './seoul-photobooth-retirement.js';
import { dessertBannerRetirementShaderDeclarations } from './seoul-dessert-banner-retirement.js';
import { createRetirementTriangleTable } from './retirement-triangle-table.js';
import {
  INFORMATION_ZONE,
  OBSOLETE_VWORLD_PRISMS,
  OBSOLETE_VWORLD_VOLUMES,
  STAIR_FRONT_SHOP_PRISM,
  informationZoneAxes,
} from "./seoul-information-zone.js";

const vec3 = (values) => `vec3(${values.map((value) => value.toFixed(5)).join(", ")})`;

export function seoulVworldRetirementShaderText(table = createRetirementTriangleTable()) {
  const { tangent, normal } = informationZoneAxes();
  const informationZoneChecks = [
    "insideStairFrontShop(informationLocalPoint)",
    ...OBSOLETE_VWORLD_PRISMS.map(
      (prism) => `insideInformationZonePrism(informationLocalPoint, ${vec3(prism.min)}, ${vec3(prism.max)})`,
    ),
    ...OBSOLETE_VWORLD_VOLUMES.map(
      (volume) => `insideCurrentStateBox(p, ${vec3(volume.min)}, ${vec3(volume.max)})`,
    ),
  ].join(" ||\n        ");
  return `
    ${table.declarations}
    ${feedbackRetirementShaderDeclarations(table.checks)}
    ${celadonRetirementShaderDeclarations(table.checks)}
    ${s11RetirementDeclarations(table.checks)}
    ${s38RetirementShaderDeclarations(table.checks)}
    ${woodDisplayRetirementShaderDeclarations(table.checks)}
    ${platform111RetirementShaderDeclarations()}
    ${loungeSignRetirementShaderDeclarations(table.checks)}
    ${photoboothChargerRetirementShaderDeclarations(table.checks)}
    ${dessertBannerRetirementShaderDeclarations()}
    bool insideCurrentStateBox(vec3 p, vec3 lo, vec3 hi) {
      return all(greaterThanEqual(p, lo)) && all(lessThanEqual(p, hi));
    }
    vec3 informationZoneLocal(vec3 p) {
      vec2 delta = p.xy - vec2(${INFORMATION_ZONE.joint[0].toFixed(8)}, ${INFORMATION_ZONE.joint[1].toFixed(8)});
      float localX = dot(delta, vec2(${tangent.map((value) => value.toFixed(8)).join(", ")}));
      float localY = dot(delta, vec2(${normal.map((value) => value.toFixed(8)).join(", ")}));
      return vec3(localX, localY, p.z);
    }
    bool insideInformationZonePrism(vec3 localPoint, vec3 lo, vec3 hi) {
      return all(greaterThanEqual(localPoint, lo)) && all(lessThanEqual(localPoint, hi));
    }
    bool insideStairFrontShop(vec3 localPoint) {
      return localPoint.x >= ${STAIR_FRONT_SHOP_PRISM.xMin.toFixed(5)} && localPoint.x <= ${STAIR_FRONT_SHOP_PRISM.xMax.toFixed(5)}
        && localPoint.y >= ${STAIR_FRONT_SHOP_PRISM.yMin.toFixed(5)} && localPoint.y <= ${STAIR_FRONT_SHOP_PRISM.yMax.toFixed(5)}
        && localPoint.z >= ${STAIR_FRONT_SHOP_PRISM.zMin.toFixed(5)} && localPoint.z <= ${STAIR_FRONT_SHOP_PRISM.zMax.toFixed(5)};
    }
    void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
      vec3 p = (u_catalogFromEye * vec4(fsInput.attributes.positionEC, 1.0)).xyz;
      if (isReviewedFacadeRetirementPoint(p, fsInput.attributes.texCoord_0)) discard;
      if (isRetiredCeladonCase(p, fsInput.attributes.texCoord_0)) discard;
      if (isRetiredS38Booth(p, fsInput.attributes.texCoord_0)) discard;
      if (isRetiredWoodDisplay(p, fsInput.attributes.texCoord_0)) discard;
      if (u_platform111Enabled > 0.5 && isRetiredPlatform111(p, fsInput.attributes.texCoord_0)) discard;
      if (isRetiredLoungeSign(p, fsInput.attributes.texCoord_0)) discard;
      if (isRetiredPhotoboothCharger(p, fsInput.attributes.texCoord_0)) discard;
      if (isRetiredDessertBanner(p, fsInput.attributes.texCoord_0)) discard;
      if (u_informationZoneCurrentEnabled > 0.5 && isS11RetirementPoint(p, fsInput.attributes.texCoord_0)) discard;
      vec3 informationLocalPoint = informationZoneLocal(p);
      bool retireForTruedan = u_truedanCurrentEnabled > 0.5 && (
        ${RETIRED_INFORMATION_VOLUMES.map((volume) => `insideCurrentStateBox(p, ${vec3(volume.min)}, ${vec3(volume.max)})`).join(" ||\n        ")}
      );
      bool retireForInformationZone = u_informationZoneCurrentEnabled > 0.5 && (
        ${informationZoneChecks}
      );
      if (retireForTruedan || retireForInformationZone) discard;
    }`;
}

export function createSeoulVworldRetirementMask(Cesium, viewer, tileset, site) {
  if (site !== INFORMATION_ZONE.site || site !== TRUEDAN.site) return null;
  const sameOrigin = INFORMATION_ZONE.origin.every((value, index) => value === TRUEDAN.origin[index]);
  if (!sameOrigin) throw new Error("Seoul current-state layers must use the same catalog ENU origin");

  const catalogFrame = Cesium.Transforms.eastNorthUpToFixedFrame(
    Cesium.Cartesian3.fromDegrees(...INFORMATION_ZONE.origin),
  );
  const inverseCatalog = Cesium.Matrix4.inverseTransformation(catalogFrame, new Cesium.Matrix4());
  const eyeToCatalog = new Cesium.Matrix4();
  const triangleTable = createRetirementTriangleTable();
  const fragmentShaderText = seoulVworldRetirementShaderText(triangleTable);
  const shader = new Cesium.CustomShader({
    uniforms: {
      ...triangleTable.uniforms(Cesium),
      ...platform111RetirementUniforms(Cesium),
      u_catalogFromEye: { type: Cesium.UniformType.MAT4, value: eyeToCatalog },
      u_truedanCurrentEnabled: { type: Cesium.UniformType.FLOAT, value: 0 },
      u_informationZoneCurrentEnabled: { type: Cesium.UniformType.FLOAT, value: 0 },
      u_platform111Enabled: { type: Cesium.UniformType.FLOAT, value: 0 },
    },
    fragmentShaderText,
  });
  const updateEyeMatrix = () => {
    Cesium.Matrix4.multiply(inverseCatalog, viewer.camera.inverseViewMatrix, eyeToCatalog);
    shader.setUniform("u_catalogFromEye", eyeToCatalog);
  };
  tileset.customShader = shader;
  const removePreRender = viewer.scene.preRender.addEventListener(updateEyeMatrix);
  updateEyeMatrix();

  let disposed = false;
  return {
    setVisible({ truedan = false, informationZone = false, platform111 = informationZone } = {}) {
      shader.setUniform("u_truedanCurrentEnabled", truedan ? 1 : 0);
      shader.setUniform("u_informationZoneCurrentEnabled", informationZone ? 1 : 0);
      shader.setUniform("u_platform111Enabled", platform111 ? 1 : 0);
      viewer.scene.requestRender();
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      removePreRender();
      if (tileset.customShader === shader) tileset.customShader = undefined;
      shader.destroy();
    },
  };
}

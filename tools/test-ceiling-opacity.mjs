import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SEOUL_LIGHTING_ZONES as zones,stationLightingZone} from '../app/station-zone-lighting.js';

const source=fs.readFileSync(new URL('../app/station-zone-lighting.js',import.meta.url),'utf8');
const definition=source.slice(source.indexOf('const ceilingMaterial='),source.indexOf(' const geometry='));
// Capture the actual constructor options. Appearance.translucent=false is not
// sufficient: Cesium MaterialAppearance delegates to Material.isTranslucent().
const C={
 Cartesian4:class {constructor(x,y,z,w){Object.assign(this,{x,y,z,w});}},
 Material:class {constructor(options){Object.assign(this,options);}}
};
const material=new Function('C','zones','x0','y0','x1','y1',definition+';return ceilingMaterial;')(C,zones,...zones.bounds);
assert.equal(material.translucent,false,'Ceiling material must explicitly use the opaque pass');
assert.equal(material.fabric.type,'StationSquareLedCeiling');
assert.match(material.fabric.source,/m\.alpha=1\.0/);
assert.equal(material.fabric.uniforms.panelSpacing,3.6);
assert.equal(material.fabric.uniforms.panelSize,.66);
for(const point of [[-30,50,10.7],[-5,45,10.7],[-66,72,10.6]])assert.equal(stationLightingZone(point),'led');
assert.equal(stationLightingZone([-104,48,10.6]),'daylight');
assert.equal(stationLightingZone([-30,50,16.7]),null);
console.log('PASS: explicit opaque ceiling Material, unchanged LED pattern, walking-height regression locations and open/3F boundaries.');

import * as T from 'three';
import config from '../app/seoul-platform111.json' with {type:'json'};
import windowLayout from '../app/seoul-platform111-window.json' with {type:'json'};
import {platform111Spans} from '../app/seoul-platform111.js';
export async function createCommonsScreens(scene,hall,onChange){
 const loader=new T.TextureLoader(),[train,message,departures]=await Promise.all(['ktx','message','departures'].map(name=>loader.loadAsync('/data/commons/screens/'+name+'.webp')));for(const texture of [train,message,departures])texture.colorSpace=T.SRGBColorSpace;
 train.wrapS=message.wrapS=T.RepeatWrapping;train.repeat.x=941/2167;message.repeat.x=1/3;
 const meshes=[],materials=[],media=[];let last=-1;
 for(const layout of [config,windowLayout])for(const s of [config.media,config.tids]){const positions=[],uv=[],indices=[];for(const span of platform111Spans(s,layout)){const offset=positions.length/3,a=span.a,b=span.b,c=b.map((v,i)=>v+(i===2?layout.height:0)),d=a.map((v,i)=>v+(i===2?layout.height:0));for(const p of [a,b,c,d])positions.push(p[0]-hall.origin.east0,p[2]-hall.origin.up0,hall.origin.north0-p[1]);const scale=s===config.media?layout.length/config.length/layout.height:1/(s.end-s.start),u0=(span.start-s.start)*scale,u1=(span.end-s.start)*scale;uv.push(u0,0,u1,0,u1,1,u0,1);indices.push(offset,offset+1,offset+2,offset,offset+2,offset+3);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);const material=new T.MeshBasicMaterial({map:s===config.media?train:departures,side:T.DoubleSide,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),mesh=new T.Mesh(g,material);mesh.renderOrder=2;mesh.userData.floor=layout.floor;scene.add(mesh);meshes.push(mesh);materials.push(material);if(s===config.media)media.push(material);
 }
 return {setVisibility(floor){for(const mesh of meshes)mesh.visible=mesh.userData.floor===floor;onChange();},tick(time){const frame=matchMedia('(prefers-reduced-motion:reduce)').matches?0:Math.floor(time/4)%2;if(frame!==last){for(const material of media)material.map=frame?message:train;last=frame;onChange();}},dispose(){for(const mesh of meshes){scene.remove(mesh);mesh.geometry.dispose();}for(const m of materials)m.dispose();for(const t of [train,message,departures])t.dispose();}};
}

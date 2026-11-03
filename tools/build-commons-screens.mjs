import fs from 'node:fs';
import sharp from 'sharp';
import config from '../app/seoul-platform111.json' with {type:'json'};
import {platform111Homography} from '../app/seoul-platform111.js';
const out='public/data/commons/screens';fs.mkdirSync(out,{recursive:true});
const image=await sharp('public'+config.tids.image).removeAlpha().raw().toBuffer({resolveWithObject:true}),h=platform111Homography(config.tids.photoQuad),w=1024,height=297,bytes=Buffer.alloc(w*height*3);
for(let y=0;y<height;y++)for(let x=0;x<w;x++){const p=[x/(w-1),y/(height-1),1],dot=r=>r.reduce((s,v,i)=>s+v*p[i],0),d=dot(h[2]),sx=Math.max(0,Math.min(image.info.width-1,Math.round(dot(h[0])/d*(image.info.width-1)))),sy=Math.max(0,Math.min(image.info.height-1,Math.round(dot(h[1])/d*(image.info.height-1)))),source=(sy*image.info.width+sx)*3;for(let c=0;c<3;c++)bytes[(y*w+x)*3+c]=image.data[source+c];}
await sharp(bytes,{raw:{width:w,height,channels:3}}).webp({quality:87}).toFile(out+'/departures.webp');
await sharp('public/assets/seoul-platform111/ktx-poster.webp').resize({width:1536,withoutEnlargement:true}).webp({quality:85}).toFile(out+'/ktx.webp');
await sharp('public/assets/seoul-platform111/platform111-message.svg').resize({width:1024}).webp({quality:90}).toFile(out+'/message.webp');
console.log('플랫폼111: 기존 승인 시연 이미지와 실제 촬영 열차안내 화면을 경량 재가공했습니다.');

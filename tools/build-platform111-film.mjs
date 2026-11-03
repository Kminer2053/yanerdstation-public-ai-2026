// One generated panorama, one gentle 24-second loop. No train-data fabrication.
// Usage: node tools/build-platform111-film.mjs /absolute/panorama.png
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
const input=process.argv[2];if(!input)throw Error('Pass generated panorama PNG');
const output=fileURLToPath(new URL('../public/assets/seoul-platform111/',import.meta.url));
await sharp(input).resize(1920,640,{fit:'fill'}).webp({quality:91}).toFile(output+'city-demo-poster.webp');
const phase='2*PI*on/576';
const filter=`scale=1920:640,zoompan=z='1.035+0.012*(1-cos(${phase}))':x='(iw-iw/zoom)/2+15*sin(${phase})':y='(ih-ih/zoom)/2':d=576:s=1920x640:fps=24,format=yuv420p`;
for(const [ext,args] of [['mp4',['-c:v','libx264','-preset','medium','-crf','23','-movflags','+faststart']],['webm',['-c:v','libvpx-vp9','-b:v','0','-crf','34','-row-mt','1']]]){
 const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',input,'-vf',filter,'-frames:v','576','-an','-threads','4',...args,output+'city-demo-loop.'+ext],{stdio:'inherit'});
 if(r.status!==0)throw Error(`ffmpeg ${ext} failed`);
 console.log(ext,fs.statSync(output+'city-demo-loop.'+ext).size);
}

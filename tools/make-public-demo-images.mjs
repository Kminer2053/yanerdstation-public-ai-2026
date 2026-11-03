import fs from 'node:fs';
import crypto from 'node:crypto';
import sharp from 'sharp';
const rows=JSON.parse(fs.readFileSync(new URL('./public-synthetic-images.json',import.meta.url)));
for(const [i,r] of rows.entries()){
 const label='SYNTHETIC DEMO '+String(i+1).padStart(3,'0'),w=r.width,h=r.height,size=Math.max(8,Math.min(w/12,h/4,36));
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'"><rect width="100%" height="100%" fill="#153b52"/><path d="M0 '+h/2+'H'+w+' M'+w/2+' 0V'+h+'" stroke="#6fabb9" stroke-width="2"/><text x="50%" y="48%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="'+size+'" fill="#fff">'+label+'</text><text x="50%" y="70%" text-anchor="middle" font-family="sans-serif" font-size="'+size/2+'" fill="#b8e9f0">NO ORIGINAL PHOTO</text></svg>';
 let output=sharp(Buffer.from(svg));if(/\.jpe?g$/i.test(r.path))output=output.jpeg({quality:75});else if(/\.webp$/i.test(r.path))output=output.webp({quality:75});else output=output.png();
 await output.toFile(r.path);
}
const file='public/data/jury-frozen/approved-facades.json',d=JSON.parse(fs.readFileSync(file));
for(const r of d.replacements){const local='public'+r.image_url;if(fs.existsSync(local)){r.sha256=crypto.createHash('sha256').update(fs.readFileSync(local)).digest('hex');r.file_name='synthetic-demo'+local.slice(local.lastIndexOf('.'));}}
d.basis='Public synthetic image placeholders. No original facade photo is distributed.';fs.writeFileSync(file,JSON.stringify(d)+'\n');
console.log('Generated',rows.length,'synthetic placeholders; no original photos used.');

// Screen-space labels stay inside the viewport and don't cover each other.
export function placeMapLabels(anchors,width,height){
  const w=Math.min(300,Math.max(120,width-24)),h=56,gap=8;
  const occupied=[{x:Math.max(0,width-285),y:0,w:285,h:108},{x:0,y:height-82,w:width,h:82}];
  const overlaps=(a,b)=>a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;
  return anchors.map(p=>{
    const candidates=[];
    for(const dy of [-62,-120,0,62,-180,120])for(const dx of [0,-w*.8,w*.8])candidates.push({x:p.x+dx-w/2,y:p.y+dy,w,h});
    for(let y=10;y<height-82-h;y+=h+gap)for(let x=8;x<=width-w-8;x+=(w+12))candidates.push({x,y,w,h});
    candidates.sort((a,b)=>Math.hypot(a.x+w/2-p.x,a.y+h/2-p.y)-Math.hypot(b.x+w/2-p.x,b.y+h/2-p.y));
    const box=candidates.find(b=>b.x>=8&&b.x+b.w<=width-8&&b.y>=8&&b.y+b.h<=height-82&&!occupied.some(o=>overlaps(b,o)));
    if(!box)return null;occupied.push(box);return {...box,dx:box.x+w/2-p.x,dy:box.y+h/2-p.y};
  });
}

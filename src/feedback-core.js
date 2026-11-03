// Explicit scenario inputs: no inferred rent, unique customers, or observed occupancy.
export function retailScenario(v){
  const keys=['ticket','margin','rent','labor','utilities','other','fees','days','customers'];
  if(keys.some(k=>!Number.isFinite(v[k])||v[k]<0)||v.ticket<=0||v.days<=0||v.days>31||v.margin>100||v.fees>=v.margin)return null;
  const fixed=v.rent+v.labor+v.utilities+v.other,contribution=(v.margin-v.fees)/100;
  const revenue=v.ticket*v.customers*v.days;
  return {revenue,fixed,contribution,profit:revenue*contribution-fixed,breakEven:fixed/contribution,transactionsPerDay:fixed/contribution/v.ticket/v.days};
}
export function localMetricScale(rows,key){return Math.max(1,...rows.map(r=>key==='flow'?r.nearby?.value:r[key]).filter(Number.isFinite));}
export function autoEnvironment([lon,lat,height]){
  // Reviewable approximate station envelopes. Not a measured indoor-positioning classifier.
  if(height<29)return 'indoor';
  const hall=lon>=126.96948&&lon<=126.97170&&lat>=37.55378&&lat<=37.55463;
  const bridge=lon>=126.96920&&lon<=126.97177&&lat>=37.55323&&lat<37.55378;
  // The 2F over-track passage is an open terrace, not an enclosed concourse.
  // Upper floors keep their existing fallback; exact 2F slab coverage wins below.
  if(bridge&&height>=33&&height<42)return 'outdoor';
  return height>=33&&height<57&&(hall||bridge)?'indoor':'outdoor';
}
export function zoneEnvironment(zone,point){
  return zone==='led'?'indoor':zone==='daylight'?'outdoor':autoEnvironment(point);
}
export function crowdBudget(hourlyPassages,{radius=30,speed=1.25,limit=180}={}){
  const expected=Math.max(0,Math.round(hourlyPassages/3600*(radius*2/speed)));
  return {expected,rendered:Math.min(limit,expected),scale:expected>limit?expected/limit:1};
}
// Prefer a connected, central open-grid point over the first (often boundary) tile.
export function floorExplorePoint(graph,floor){
  const nodes=graph.points.map((p,i)=>({p,i,degree:graph.adj[i].filter(e=>!e[2]).length})).filter(n=>n.p[1]===floor&&n.p[0].startsWith('GRID-')&&n.degree>=2);
  if(!nodes.length)return null;
  const median=k=>nodes.map(n=>n.p[k]).sort((a,b)=>a-b)[Math.floor(nodes.length/2)];
  const x=median(5),y=median(6),threshold=Math.min(6,Math.max(...nodes.map(n=>n.degree)));
  return nodes.filter(n=>n.degree>=threshold).sort((a,b)=>(a.p[5]-x)**2+(a.p[6]-y)**2-((b.p[5]-x)**2+(b.p[6]-y)**2))[0].p.slice(2,5);
}

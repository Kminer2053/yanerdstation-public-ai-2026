import assert from 'node:assert/strict';
import {CrowdDeadlineQueue,catchUpAgent,poseInterval,dotInterval,offscreenDelay} from '../src/crowd-scheduling.js';

const q=new CrowdDeadlineQueue(),agents=Array.from({length:10000},(_,id)=>({id,active:true,t0:0,dur:1+id/10000}));
for(const a of agents)q.schedule(a,a.t0+a.dur);
assert.equal(q.size,10000);assert.equal(q.take(.99),null);
// Rescheduling an existing person must not duplicate them or leave a stale event.
q.schedule(agents[9000],.5);assert.equal(q.take(.5),agents[9000]);
q.schedule(agents[9000],4);q.schedule(agents[0],3);
let last=0,n=0;for(let a;(a=q.take(5));){assert(a.dur>=0);const due=a===agents[9000]?4:a===agents[0]?3:a.dur;assert(due>=last);last=due;n++;}
assert.equal(n,10000);assert.equal(q.size,0);q.clear();
// Repeated earlier/later rescheduling agrees with a simple reference queue.
const active=new Map();let seed=13;
const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let i=0;i<20000;i++){
  if(rnd()<.7){const a=agents[Math.floor(rnd()*500)],t=rnd()*100;q.schedule(a,t);active.set(a,t);}
  else{const t=rnd()*100,a=q.take(t),min=Math.min(...active.values());if(a){assert.equal(active.get(a),min);assert(min<=t);active.delete(a);}else assert(min>t);assert.equal(q.size,active.size);}
}

// Same elapsed simulation time, different render frequencies / hidden updates:
// the exact same steps, seeded random sequence and floor transitions survive.
function simulate(hz,hidden){
  const a={id:3,active:true,t0:0,dur:.12,steps:0,floor:'2F',rs:23};
  const step=(a,due)=>{a.steps++;a.rs=(Math.imul(a.rs,1664525)+1013904223)>>>0;a.t0=due;a.dur=.05+(a.rs%100)/100;a.floor=a.steps%4<2?'2F':'3F';};
  for(let t=0;t<20;t+=1/hz)if(!hidden||Math.floor(t*2)!==Math.floor((t-1/hz)*2))catchUpAgent(a,t,step);
  catchUpAgent(a,20,step);return a;
}
assert.deepEqual(simulate(60,false),simulate(12,true));
assert.deepEqual(simulate(60,false),simulate(30,false));
const zero={active:true,t0:0,dur:0};assert.equal(catchUpAgent(zero,.1,()=>{}),3,'invalid zero-length steps do not lock the loop');
assert.equal(poseInterval(17**2),0);assert.equal(poseInterval(20**2),1/12);assert.equal(poseInterval(50**2),1/6);
assert.equal(dotInterval(10**2),1/20);assert.equal(dotInterval(40**2),1/10);assert.equal(dotInterval(100**2),1/4);
assert.equal(offscreenDelay({id:7,inView:true}),0);assert.equal(offscreenDelay({id:7,inView:false}),.5);
console.log('PASS: 10,000-person indexed schedule, no duplicate deadlines, frame-independent movement/2F–3F transitions, zero-duration guard, distance update tiers');

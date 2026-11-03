// Motion stays on the existing lanes. Only when to calculate/present it changes.
export class CrowdDeadlineQueue {
  constructor(){this.heap=[];this.nodes=new WeakMap();}
  clear(){this.heap.length=0;this.nodes=new WeakMap();}
  swap(a,b){const h=this.heap;[h[a],h[b]]=[h[b],h[a]];h[a].index=a;h[b].index=b;}
  up(i){const h=this.heap;while(i>0){const p=(i-1)>>1;if(h[p].at<=h[i].at)break;this.swap(p,i);i=p;}return i;}
  down(i){const h=this.heap;for(;;){let c=i*2+1;if(c>=h.length)break;if(c+1<h.length&&h[c+1].at<h[c].at)c++;if(h[i].at<=h[c].at)break;this.swap(i,c);i=c;}}
  schedule(agent,at){
    let n=this.nodes.get(agent);if(!n){n={agent,at,index:-1};this.nodes.set(agent,n);}n.at=at;
    if(n.index<0){n.index=this.heap.length;this.heap.push(n);}this.down(this.up(n.index));
  }
  take(now){
    const h=this.heap;if(!h.length||h[0].at>now)return null;
    const n=h[0],last=h.pop();n.index=-1;if(h.length){h[0]=last;last.index=0;this.down(0);}return n.agent;
  }
  get size(){return this.heap.length;}
}

// Close bodies retain frame-rate animation. Farther bodies sample the same walk
// phase, rather than slowing down their walk or restarting an animation clip.
export const poseInterval=d2=>d2<18*18?0:d2<45*45?1/12:1/6;
export const dotInterval=d2=>d2<25*25?1/20:d2<90*90?1/10:1/4;
export const offscreenDelay=a=>a.inView?0:(1+a.id%8)/16;

// Advance at the original deadline, not at the later rendering frame. This
// prevents hidden people slowing down, route skipping or losing a floor ride.
export function catchUpAgent(a,now,step){
  let n=0;
  while(a.active&&a.t0+a.dur<=now){
    const due=a.t0+a.dur;step(a,due);n++;
    // An invalid/zero-length step must never lock the render loop.
    if(a.active&&a.t0+a.dur<=due)a.dur=Math.max(.05,due-a.t0+.05);
  }
  return n;
}

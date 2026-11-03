// Each finger owns its input until release/cancel, including two fingers on one key.
export function createPointerKeys(onChange){
  const held=new Map();
  const emit=()=>onChange([...new Set(held.values())]);
  return {
    down(id,key){if(held.get(id)===key)return;held.set(id,key);emit();},
    up(id){if(held.delete(id))emit();},
    reset(){held.clear();emit();},
  };
}

export function bindExplorationPointers({movement,jump,onKeys,onJump,enabled=()=>true,documentTarget=document,windowTarget=window}){
  const buttons=new Map(),keys=createPointerKeys(onKeys);
  const release=id=>{
    const button=buttons.get(id);buttons.delete(id);keys.up(id);
    if(button&&![...buttons.values()].includes(button))button.classList.remove('input-held');
  };
  const hold=(event,button)=>{
    event.preventDefault();buttons.set(event.pointerId,button);button.classList.add('input-held');
    try{button.setPointerCapture(event.pointerId);}catch{/* Global release handlers remain as fallback. */}
  };
  const valid=e=>enabled()&&!(e.pointerType==='mouse'&&e.button!==0);
  movement.addEventListener('pointerdown',e=>{
    const b=e.target.closest('[data-key]');if(!b||!movement.contains(b)||!valid(e))return;
    hold(e,b);keys.down(e.pointerId,b.dataset.key);
  });
  // Do not filter isPrimary: jump is commonly the second finger while walking.
  jump.addEventListener('pointerdown',e=>{if(!valid(e))return;hold(e,jump);onJump();});
  // Pointer activation already ran on down. Preserve keyboard/assistive clicks only.
  jump.addEventListener('click',e=>{if(enabled()&&e.detail===0&&!e.pointerType)onJump();});
  const up=e=>release(e.pointerId);
  for(const type of ['pointerup','pointercancel'])windowTarget.addEventListener(type,up);
  movement.addEventListener('lostpointercapture',up);jump.addEventListener('lostpointercapture',up);
  const reset=()=>{
    const active=[...buttons];buttons.clear();keys.reset();
    for(const [id,b]of active){
      b.classList.remove('input-held');
      try{if(b.hasPointerCapture(id))b.releasePointerCapture(id);}catch{/* Already released. */}
    }
  };
  documentTarget.addEventListener('visibilitychange',()=>{if(documentTarget.hidden)reset();});
  windowTarget.addEventListener('pagehide',reset);
  windowTarget.addEventListener('blur',()=>{if(!documentTarget.hasFocus())reset();});
  return {reset};
}

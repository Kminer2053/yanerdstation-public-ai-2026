// Fit the whole incoming frame; never impose portrait framing on a landscape stream.
export function cameraPipSize({videoWidth,videoHeight,stageWidth,stageHeight,controlsHeight=0}){
  const ratio=videoWidth>0&&videoHeight>0?videoWidth/videoHeight:16/9;
  const maxHeight=Math.max(0,Math.min(stageHeight*.42,stageHeight-controlsHeight-32));
  const width=Math.max(0,Math.min(stageWidth*.4,maxHeight*ratio));
  return {width,height:width/ratio};
}

export function createCameraComparison({video,status,container,button,buttons=[],mediaDevices=navigator.mediaDevices}){
  let stream=null,request=0,active=false;
  const all=[button,...buttons].filter(Boolean);
  const state=value=>{if(container.dataset)container.dataset.cameraState=value;};
  const mark=(text,pressed)=>{for(const b of all){b.textContent=text;b.setAttribute('aria-pressed',String(pressed));}};
  const stop=()=>{request++;active=false;if(stream)for(const track of stream.getTracks())track.stop();stream=null;video.srcObject=null;container.hidden=true;state('closed');mark('카메라 비교',false);status.textContent='카메라 꺼짐';};
  const start=async()=>{
    if(active){stop();return}
    if(!window.isSecureContext||!mediaDevices?.getUserMedia){state('error');status.textContent='HTTPS 또는 localhost와 카메라를 지원하는 브라우저가 필요합니다.';container.hidden=false;return}
    active=true;const version=++request;state('pending');container.hidden=false;status.textContent='카메라 권한을 기다리는 중입니다. 영상은 저장·전송하지 않습니다.';mark('카메라 끄기',true);
    try{
      const mobile=globalThis.matchMedia?.('(max-width:650px)').matches;
      const next=await mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:mobile?720:1280},height:{ideal:mobile?1280:720},resizeMode:{ideal:'none'}}});
      if(version!==request||document.hidden){next.getTracks().forEach(t=>t.stop());return}
      stream=next;video.srcObject=stream;await video.play();if(version!==request)return;state('playing');status.textContent='실제 카메라 · 직접 비교용. 위치·방향 자동 정렬 및 촬영·업로드 없음.';
    }catch(e){if(version!==request)return;state('error');active=false;stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;mark('카메라 다시 시도',false);status.textContent=e.name==='NotAllowedError'?'카메라 권한이 허용되지 않았습니다. 브라우저 권한을 확인하거나 3D 안내만 사용하세요.':e.name==='NotFoundError'?'이 기기에서 카메라를 찾을 수 없습니다.':'카메라를 시작하지 못했습니다. 다른 앱 사용 여부를 확인하세요.';}
  };
  const onHidden=()=>{if(document.hidden)stop()};document.addEventListener('visibilitychange',onHidden);window.addEventListener('pagehide',stop);
  for(const b of all)b.addEventListener('click',start);
  return {stop,toggle:start,get active(){return active;},destroy(){stop();for(const b of all)b.removeEventListener('click',start);document.removeEventListener('visibilitychange',onHidden);window.removeEventListener('pagehide',stop)}};
}

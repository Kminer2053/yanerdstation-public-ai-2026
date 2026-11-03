// Facility tab panel: facade image facts (jury original + demo replacement) and the walking access point,
// both checked on the map beside the editor. Edits stay in the demo copy; the jury snapshot is never changed.
import {esc} from './experience-core.js';
import {facadeInfo,facilityPoint,nearbyWalkPoints,recommendAccess,metres} from './manager-core.js';

const KIND_LABEL={approved:'심사 승인 이미지',model:'전용 모델 면',unapproved:'승인 이미지 없음',none:'정면 사진 없음'};
const fmt=(v,d=1)=>Number.isFinite(v)?Number(v).toFixed(d):'—';
const download=(href,name)=>{const a=document.createElement('a');a.href=href;a.download=name;document.body.append(a);a.click();a.remove();};

export function mountFacilityPanel({record,override,facility,approved,index,form,actions,notify,scene}){
  const f=facility||record,info=facadeInfo(f,approved),center=facilityPoint(facility);
  let access=override.access_id??record.access_id??'',view='facade',showDemo=true,previewSent=false,candidates=null;
  const host=document.createElement('div');host.className='facility-panel';form.prepend(host);
  const changed=()=>form.dispatchEvent(new Event('input',{bubbles:true}));
  actions.innerHTML='<div class="map-view-switch" role="group" aria-label="오른쪽 지도 보기"><button type="button" data-view="facade" aria-pressed="true">시설 정면</button><button type="button" data-view="access" aria-pressed="false">출입점 지정</button></div><p id="mapHint" role="status"></p>';
  const approvedMeta=info.kind==='approved'?[['파일',info.file],['해상도',info.width+' × '+info.height+' px'],['면 넓이',fmt(info.area,2)+' m²'],['정면 방향',fmt(info.heading)+'°'],['모델 면',[info.model,info.label].filter(Boolean).join(' · ')],['승인',String(info.reviewed||'').slice(0,10)]]
    :info.kind==='none'?[['보기 기준','시설 위치 기준 시점 (정면 사진 없음)']]
    :[['모델',info.model],['면 크기',fmt(info.surface?.[0],2)+' × '+fmt(info.surface?.[1],2)+' m'],['정면 방향',fmt(info.heading)+'°']];
  host.innerHTML='<section class="facade-card"><header><h4>파사드 이미지</h4><span class="panel-badge" data-kind="'+info.kind+'">'+KIND_LABEL[info.kind]+'</span></header>'+
    '<div class="facade-images">'+(info.kind==='approved'?'<figure><img id="facadeApproved" src="'+esc(info.image)+'" alt="'+esc(f.name)+' 심사 승인 파사드"><figcaption>심사 승인본</figcaption></figure>':'')+
    '<figure id="facadeDemoFigure" hidden><img id="facadeDemo" alt="'+esc(f.name)+' 시연 교체 파사드"><figcaption>시연 교체본</figcaption></figure></div>'+
    '<dl class="facade-meta">'+approvedMeta.map(([k,v])=>'<dt>'+k+'</dt><dd>'+esc(v||'—')+'</dd>').join('')+'</dl>'+
    '<div class="panel-actions">'+(info.kind==='approved'?'<button type="button" id="facadeDownload">승인 이미지 저장</button>':'')+'<button type="button" id="facadeDemoDownload" hidden>교체본 저장</button><button type="button" id="facadeInfoSave">이미지 정보 저장</button></div>'+
    '<div class="panel-actions"><label class="file-button">교체 사진 선택<input id="demoFacadeFile" type="file" accept="image/png,image/jpeg"></label><button type="button" id="facadeToggle" hidden>심사 원본으로 보기</button><button type="button" id="facadeRemove" hidden>교체본 삭제</button></div>'+
    '<input type="hidden" data-field="facade_url"><p class="panel-note" id="facadeStatus" role="status"></p></section>'+
    '<section class="access-card"><header><h4>보행 출입점</h4><span class="panel-badge" id="accessBadge"></span></header><p id="accessSummary"></p>'+
    '<div class="panel-actions"><button type="button" id="accessPick" aria-pressed="false">지도에서 지정</button><button type="button" id="accessSuggest">정면 앞 추천</button><button type="button" id="accessClear">지정 해제</button></div>'+
    '<label>출입점 ID<input data-field="access_id" list="demoPointChoices" autocomplete="off" spellcheck="false"></label><datalist id="demoPointChoices"></datalist></section><h4 class="form-section">운영 정보</h4>';
  const $=s=>host.querySelector(s)||actions.querySelector(s),facadeField=$('[data-field=facade_url]'),accessField=$('[data-field=access_id]');
  facadeField.value=override.facade_url??'';accessField.value=access;

  function hint(text){$('#mapHint').textContent=text;}
  function facadeStatus(text){$('#facadeStatus').textContent=text;}
  function draw(fit=false){
    // The facade view keeps the storefront clear: only the access point is marked there.
    const marks=[],lines=[],a=access&&index.byId.get(access),picking=view==='access';
    if(center&&picking)marks.push({id:'facility',kind:'facility',point:center,label:'시설 기준점'});
    if(a){const p=a.slice(2,5);marks.push({id:'access',kind:'access',point:p,label:'보행 출입점'});if(center&&picking)lines.push({coordinates:[center,p],color:'#22c55e',width:3,dashed:true});}
    if(picking&&center){candidates??=nearbyWalkPoints(index,record.floor,center,{radius:14,limit:260,floorOnly:true});for(const k of candidates)if(k.id!==access)marks.push({id:'cand:'+k.id,kind:'candidate',point:k.point});}
    scene.overlay({marks,lines,fit,selected:a?'access':null});
  }
  function setView(next){
    view=next;for(const b of actions.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===view));$('#accessPick').setAttribute('aria-pressed',String(view==='access'));
    if(!center){hint('이 시설은 지도 좌표가 없어 위치를 표시할 수 없습니다.');return;}
    if(view==='facade'){scene.focusFacade(facility);draw(false);hint(info.kind==='none'?'정면 사진이 없는 시설은 위치 기준 시점으로 보여줍니다.':'오른쪽 지도: 시설 정면 · 초록 점은 보행 출입점');}
    else{draw(true);hint('흰 점(보행 가능 지점)을 누르면 출입점으로 지정합니다. 벽 뒤 점은 선택되지 않습니다.');}
  }
  function summary(){
    const a=access&&index.byId.get(access),d=a&&center?metres(center,a.slice(2,5)):null;
    $('#accessBadge').textContent=a?'지정됨':'미지정';$('#accessBadge').dataset.kind=a?'approved':'none';
    $('#accessSummary').innerHTML=a?'<b>'+esc(access)+'</b> · 시설 기준점에서 '+fmt(d)+'m'+(d>12?'<br><span class="warn">기준점과 멀리 떨어져 있습니다. 실제 출입구 앞인지 확인하세요.</span>':'')
      :'지정되지 않았습니다. 방문객 경로 안내 목적지에서 제외됩니다.';
  }
  function setAccess(id,{quiet=false}={}){
    if(id&&index.byId.get(id)?.[1]!==record.floor){notify('시설과 같은 층('+record.floor+')의 보행점을 지정하세요.');accessField.value=access;return;}
    access=id;accessField.value=id;summary();draw(false);if(!quiet)changed();
  }
  function demoShown(){const url=facadeField.value;$('#facadeDemoFigure').hidden=!url;if(url)$('#facadeDemo').src=url;$('#facadeDemoDownload').hidden=!url.startsWith('data:');$('#facadeRemove').hidden=!url;$('#facadeToggle').hidden=!(url.startsWith('data:')&&info.replaceable);$('#facadeToggle').textContent=showDemo?'심사 원본으로 보기':'시연 교체본으로 보기';}
  function applyPreview(){
    const url=facadeField.value;demoShown();
    if(url&&url.startsWith('data:')&&showDemo&&info.replaceable){scene.previewFacade(info.slotAlias,url);previewSent=true;facadeStatus('3D 모델에 시연 교체본 적용 중…');return;}
    if(previewSent){scene.previewFacade(null,null);previewSent=false;}
    facadeStatus(!url?(info.kind==='approved'?'3D 모델은 심사 승인본을 표시합니다.':info.kind==='none'?'정면 사진이 없는 시설입니다. 교체 사진은 편집본에만 저장됩니다.':'이 시설은 3D 교체 면이 없어 교체 사진은 편집본에만 저장됩니다.')
      :!info.replaceable?'이 시설은 3D 교체 면이 없어 사진만 편집본에 저장됩니다.':!url.startsWith('data:')?'외부 주소 이미지는 3D 미리보기에 쓰지 않습니다.':'3D 모델은 심사 원본을 표시 중입니다.');
  }

  actions.onclick=e=>{const b=e.target.closest('[data-view]');if(b)setView(b.dataset.view);};
  $('#accessPick').onclick=()=>setView(view==='access'?'facade':'access');
  $('#accessSuggest').onclick=()=>{const r=recommendAccess(index,facility);if(!r)return notify('추천할 보행점을 찾지 못했습니다.');setAccess(r.id);notify('정면 앞 보행점 '+r.id+' 을(를) 제안했습니다. 지도에서 확인 후 저장하세요.');};
  $('#accessClear').onclick=()=>setAccess('');
  accessField.oninput=()=>{const q=accessField.value.toLowerCase();$('#demoPointChoices').innerHTML=(index.byFloor.get(record.floor)||[]).filter(p=>p[0].toLowerCase().includes(q)).slice(0,150).map(p=>'<option value="'+esc(p[0])+'">'+esc(p[1]+' · '+p[0])+'</option>').join('');};
  accessField.onfocus=accessField.oninput;accessField.onchange=()=>setAccess(accessField.value.trim());
  $('#facadeDownload')?.addEventListener('click',()=>download(info.image,info.file||record.id+'.png'));
  $('#facadeDemoDownload').onclick=()=>download(facadeField.value,record.id+'-demo-facade.jpg');
  $('#facadeInfoSave').onclick=()=>{const a=access&&index.byId.get(access),body={facility:{id:record.id,name:f.name,floor:record.floor,source_id:f.source_id},facade:info.kind==='approved'?{kind:info.kind,file:info.file,image_url:info.image,width_px:info.width,height_px:info.height,surface_area_m2:info.area,camera_heading_deg:info.heading,model:info.model,label:info.label,reviewed_at:info.reviewed,sha256:info.sha256}:{kind:info.kind,model:info.model||null,camera_heading_deg:info.heading??null},
    demo_replacement:{present:Boolean(facadeField.value),bytes:facadeField.value.length,saved:Boolean(override.facade_url)},access_point:a?{id:access,lon:a[2],lat:a[3],height:a[4],distance_m:center?Number(metres(center,a.slice(2,5)).toFixed(2)):null}:null,basis:'서울역 심사 고정본은 변경하지 않은 시연 편집 정보'};
    const url=URL.createObjectURL(new Blob([JSON.stringify(body,null,2)],{type:'application/json'}));download(url,record.id+'-facade.json');setTimeout(()=>URL.revokeObjectURL(url),1000);};
  $('#demoFacadeFile').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(!['image/png','image/jpeg'].includes(file.type)||file.size>12000000)throw Error('12MB 이하 PNG/JPEG 사진을 선택하세요.');
    const bitmap=await createImageBitmap(file),canvas=document.createElement('canvas'),ratio=Math.min(1,1024/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
    let output=canvas.toDataURL('image/jpeg',.8);if(output.length>270000)output=canvas.toDataURL('image/jpeg',.5);if(output.length>270000)throw Error('사진을 더 작게 저장한 뒤 업로드하세요.');
    facadeField.value=output;showDemo=true;changed();applyPreview();if(view!=='facade')setView('facade');notify('교체 사진을 3D 정면에 미리 적용했습니다. 저장해야 편집본에 남습니다.');}catch(err){notify(err.message);}finally{e.target.value='';}};
  $('#facadeToggle').onclick=()=>{showDemo=!showDemo;applyPreview();};
  $('#facadeRemove').onclick=()=>{facadeField.value='';changed();applyPreview();facadeStatus('교체본을 지웠습니다. 저장하면 편집본에서도 삭제됩니다.');};

  summary();applyPreview();setView('facade');
  return {
    read:()=>({}),
    pick(id){if(id.startsWith('cand:')&&view==='access')setAccess(id.slice(5));},
    previewApplied(d){if(!d.ok){facadeStatus('3D 미리보기를 적용하지 못했습니다. 사진은 편집본에 저장할 수 있습니다.');return;}
      if(d.matched===null)return;facadeStatus(d.matched?'3D 정면에 시연 교체본 표시 중 · 심사 원본은 변경되지 않습니다.':'이 시설의 3D 면을 찾지 못해 사진만 편집본에 저장됩니다.');},
    destroy(){if(previewSent)scene.previewFacade(null,null);previewSent=false;},
  };
}

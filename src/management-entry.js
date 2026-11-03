const r=await fetch('/api/session',{cache:'no-store'});
const user=r.ok?await r.json():null;
if(!user?.authenticated){location.replace('/signin-with-chatgpt?return_to='+encodeURIComponent(location.pathname+location.search));}
else if(!user.manager){document.body.replaceChildren();const p=document.createElement('p');p.textContent='관리기업 계정의 접근 승인이 필요합니다.';const a=document.createElement('a');a.href='/?role=manager';a.textContent='홈에서 접근 상태 확인';document.body.append(p,a);}
else {const home=document.createElement('a');home.href='/?role=manager';home.textContent='← 운영 화면';home.style.cssText='position:fixed;right:20px;bottom:10px;z-index:999;background:#102a38;color:white;padding:10px 16px;border-radius:8px;font-size:12px';document.body.append(home);if(location.pathname.startsWith('/catalog'))await import('./catalog-workbench.js');else await import('./route-review.js');}

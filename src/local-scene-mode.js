export function preserveScene(href) {
  const url=new URL(href,location.href);
  if(new URLSearchParams(location.search).get('scene')==='local'&&url.origin===location.origin&&/^\/(app|routes)\//.test(url.pathname))url.searchParams.set('scene','local');
  return url.href;
}
// Preserve the selected source across dynamically rendered reference links, too.
document.addEventListener('click',e=>{
  const a=e.target.closest?.('a[href]');if(a)a.href=preserveScene(a.href);
},true);

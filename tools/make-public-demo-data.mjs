import fs from 'node:fs';
// Independent arithmetic fixtures. Existing numeric values are never used as inputs.
const salesFile='server/data/sales.json',usageFile='public/data/experience/usage.json';
const sales=JSON.parse(fs.readFileSync(salesFile)),usage=JSON.parse(fs.readFileSync(usageFile));
const weights=[0,0,0,0,0,2,4,6,7,6,7,9,12,10,7,8,9,12,11,7,5,3,0,0],total=weights.reduce((a,b)=>a+b,0);
const hourly=n=>{const a=weights.map(w=>Math.floor(n*w/total));a[12]+=n-a.reduce((x,y)=>x+y,0);return a;};
for(const [i,id]of Object.keys(sales.stores).sort().entries()){
 const daily=sales.dates.map((_,d)=>(1800+((i*97+d*131)%2600))*100);
 sales.stores[id]={daily,hourly:daily.map(hourly)};
}
for(const [i,id]of Object.keys(usage.stores).sort().entries()){
 const daily=usage.dates.map((_,d)=>40+((i*17+d*23)%180));
 usage.stores[id]={daily,hourly:daily.map(hourly)};
}
// Two artificial lone-zero days exercise the data-quality warning and masking path.
const gapId='DEST-B01WL039-S02',otherId=Object.keys(usage.stores).sort().find(id=>id!==gapId);
usage.stores[gapId].daily[16]=121;usage.stores[gapId].daily[17]=0;usage.stores[gapId].daily[18]=141;
usage.stores[otherId].daily[11]=0;
for(const id of [gapId,otherId])usage.stores[id].hourly=usage.stores[id].daily.map(hourly);
sales.basis='독립 합성 매출 DEMO-2026-v1. 실제 영업금액·원자료의 변형값이 아님. 정수 산식으로 생성.';
usage.basis='독립 합성 이용인원(결제건수 형식) DEMO-2026-v1. 실제 고객·거래 자료 미사용.';
usage.hourly_basis='정해진 가상 시간대 가중치로 일합을 배분. 7월12일·18일의 0건은 누락 경고 검증용 인공 사례.';
fs.writeFileSync(salesFile,JSON.stringify(sales)+'\n');fs.writeFileSync(usageFile,JSON.stringify(usage)+'\n');
console.log('Generated independent synthetic series for',Object.keys(sales.stores).length,'stores.');

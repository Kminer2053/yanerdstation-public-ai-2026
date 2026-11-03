// Data relationship diagram for the manager data tab: sources → aggregation → assignment → derived values → services.
// Every number comes from dataFlowValues() for the chosen date and hour.
import {esc,int} from './experience-core.js';

export const DIAGRAM_TYPES={관측:['#dff0e5','#1a6b3a'],추정:['#fff3d4','#8a6d1a'],가공:['#e5eef8','#2d5a8e'],확정:['#f0e8f5','#6b3a8e'],모형:['#e3f3f1','#0f766e'],산출:['#173b47','#173b47']};
const COLS=[10,290,570,850,1130],WIDTHS=[220,220,220,220,240];
const HEADERS=['① 원천 자료','② 지점·자료 집계','③ 이동 배분 모형','④ 파생 지표','⑤ 서비스 산출'];

function nodes(v){
  const n=(id,col,y,h,type,title,lines,tip)=>({id,col,x:COLS[col],y,w:WIDTHS[col],h,type,title,lines,tip});
  const m=v.modes||{},won=x=>x==null?'매출 미확보':'매출 '+int(Math.round(x/10000))+'만원';
  return [
    n('subway',0,48,52,'관측','지하철·광역철도',['원점 '+(m['지하철·광역철도']||0)+'곳 · 시간대 승하차'],'서울교통공사 CardSubwayTime + 코레일 광역 OA-12913 (일자×시간 승하차)'),
    n('ktx',0,110,52,'관측','KTX·일반열차',['원점 '+(m['KTX·일반철도']||0)+'곳 · 열차 하차'],'코레일 역별 승하차 공개자료'),
    n('gtx',0,172,52,'추정','GTX-A',['원점 '+(m.GTX||0)+'곳 · 수요 추정'],'국토부 사전타당성 수요 + 경의선 시간대 구성비 대리 적용'),
    n('bus',0,234,52,'관측','버스 정류장 하차',['원점 '+(m['버스']||0)+'곳'],'서울시·경기도 버스 정류장 승하차 (일자×시간)'),
    n('parking',0,296,52,'추정','주차장 유입',['원점 '+(m['주차']||0)+'곳 · 규모×회전율'],'주차면 규모 × 회전율 × 차량당 인원 × 역사 이용 비율'),
    n('taxi',0,358,52,'추정','택시 승하차',['원점 '+(m['택시']||0)+'곳'],'택시 승차장별 추정'),
    n('sales',0,420,52,'가공','매장 결제자료',[v.stores+'개 매장 · 일자×시간'],'매장별 제출 자료를 가공한 시연값'),
    n('register',0,482,52,'확정','시설 등록부',[v.facilities+'개 시설 · 정면·출입점'],'현행화 확정 등록부 (심사 리비전 337)'),
    n('grid',0,544,52,'확정','보행 격자·층간연결',['보행점 '+int(v.walkPoints)+' · 연결 '+v.connections],'모델 바닥·장애물 검사를 통과한 2m 격자와 계단·에스컬레이터·엘리베이터 연결'),
    n('endpoints',1,179,100,'모형','출도착점 '+v.endpoints+'곳',['진입 '+int(v.arrivals)+'건/시','이탈 '+int(v.departures)+'건/시','원점 '+v.origins+'곳을 영역별 합산'],'원점별 시간대 승하차를 출도착 영역에 합산'),
    n('storeHour',1,420,52,'가공','매장 시간대 배분',['이용 '+int(v.storeUsage)+'건 · '+won(v.storeSales)],'일별 합계를 월별 시간대 구성비로 배분 (영업시간 밖 발생 유지)'),
    n('facade',1,482,52,'확정','시설 정면·출입점',['승인 정면 '+v.facades+'곳 · 출입점 '+v.access+'/'+v.facilities],'심사 고정본 파사드 승인 이미지와 시설별 보행 출입점'),
    n('network',1,544,52,'확정','보행 경로망',['등록 '+v.registeredRoutes+' → 방향별 '+v.routes+' · 구간 '+int(v.edges)],'격자 보행점과 층간연결로 만든 등록 경로와 구간'),
    n('ipf',2,110,80,'모형','시간확장 중력모형',['IPF/RAS 경로 배분','경로 이동 '+int(v.routeFlow)+'건/시','동일인 복수 이동 포함'],'출도착 진입·이탈 합계를 맞추도록 경로별 이동량을 반복 비례 조정'),
    n('edgeFlow',3,40,62,'모형','구간 통과량',['활성 '+int(v.activeEdges)+'/'+int(v.edges)+'구간','최대 '+int(v.maxEdge)+'건/시'],'경로 이동량을 경로가 지나는 구간마다 누적'),
    n('dwell',3,150,62,'모형','출도착 대기',['이동 × 모드별 체류시간','대기 '+int(v.dwell)+'명'],'경로 이동량 × 출발·도착 지점 체류시간(초) ÷ 3600'),
    n('ambient',3,290,62,'추정','비환승 체류',['관측 하차 '+int(v.real)+' − 모형 출발 '+int(v.model),'= '+int(v.ambient)+'명/시'],'원점 관측 하차 중 모형 경로로 설명되지 않은 인원 (KTX는 3방향 분산 · 2층 몫 일부는 3층 맞이방 순환으로 표시 · 심야 제외)'),
    n('occupancy',4,110,170,'산출','동시체류 추정',[],'보행 중(구간 통과량 × 구간 길이 ÷ 1.25m/s ÷ 3600) + 출도착 대기 + 비환승 체류'),
    n('screen',4,300,52,'산출','3D 화면 표시',['가까운 인원 사람 모델 · 먼 인원 점'],'성능 한도 안에서 카메라에 가까운 순으로 사람 모델 배정'),
    n('store',4,420,52,'산출','매장 영업실적',['이용·매출 · 인근 통과 비교'],'총괄 탭 매장별 영업실적 표'),
    n('guide',4,482,114,'산출','길안내 서비스',['출입점 지정 시설 '+v.access+'곳','시설 → 출입점 → 경로','정면 보기로 도착 확인'],'방문객: 시설 선택 → 경로 확인 → 1인칭 따라걷기'),
  ];
}
// [from,to,label,sourcePort,targetPort,labelT]
const EDGES=[
  ['subway','endpoints'],['ktx','endpoints'],['gtx','endpoints'],['bus','endpoints'],['parking','endpoints'],['taxi','endpoints'],
  ['endpoints','ipf','진입·이탈',.25,.55],['network','ipf','경로 후보',.3,.88,.55],
  ['ipf','edgeFlow','경로별 이동',.3,.5],['ipf','dwell','',.62,.5],['ipf','ambient','모형 출발',.9,.3],['endpoints','ambient','관측 하차',.85,.72],
  ['edgeFlow','occupancy','보행 중',.5,.2],['dwell','occupancy','대기',.5,.5],['ambient','occupancy','비환승',.5,.8],['occupancy','screen','',.5,.5],
  ['sales','storeHour'],['storeHour','store','이용·매출',.5,.5],['edgeFlow','store','인근 통과',.8,.35,.82],
  ['register','facade'],['grid','facade','',.3,.8],['grid','network'],['facade','guide','출입점',.5,.25],['network','guide','경로',.5,.75],
];
export const DIAGRAM_EDGES=EDGES.map(([from,to])=>[from,to]);

const bez=(p,t)=>{const u=1-t;return [0,1].map(k=>u*u*u*p[0][k]+3*u*u*t*p[1][k]+3*u*t*t*p[2][k]+t*t*t*p[3][k]);};
function text(x,y,value,{size=12,weight=400,fill='#183b31',anchor='start'}={}){return '<text x="'+x+'" y="'+y+'" font-size="'+size+'" font-weight="'+weight+'" fill="'+fill+'" text-anchor="'+anchor+'">'+esc(value)+'</text>';}
function occupancyNode(o,v){
  const parts=[['보행 중',v.walking,'#5eead4'],['출도착 대기',v.dwell,'#fbbf24'],['비환승 체류',v.ambient,'#f9a8d4']],total=Math.max(1,v.walking+v.dwell+v.ambient),bar=o.w-24;
  return text(o.x+12,o.y+22,o.title,{size:13,weight:700,fill:'#ffffff'})+text(o.x+12,o.y+56,int(v.expected)+'명',{size:26,weight:800,fill:'#ffffff'})+
    text(o.x+12,o.y+75,v.date+' '+v.hour+'시 · 동시에 역 안에 있는 인원',{size:11,fill:'#cfe3e8'})+
    parts.map(([label,value,color],i)=>{const y=o.y+96+i*24;return text(o.x+12,y,label,{size:11,fill:'#e8f3f5'})+text(o.x+o.w-12,y,int(value)+'명',{size:11,weight:700,fill:'#ffffff',anchor:'end'})+
      '<rect x="'+(o.x+12)+'" y="'+(y+4)+'" width="'+bar+'" height="5" rx="2.5" fill="#2c5260"/><rect x="'+(o.x+12)+'" y="'+(y+4)+'" width="'+Math.max(2,bar*value/total).toFixed(1)+'" height="5" rx="2.5" fill="'+color+'"/>';}).join('');
}
export function dataDiagramSVG(v){
  const list=nodes(v),byId=new Map(list.map(n=>[n.id,n]));
  const edges=EDGES.map(([from,to,label='',fs=.5,ft=.5,lt=.5])=>{
    const a=byId.get(from),b=byId.get(to);
    if(a.col===b.col){const x=a.x+a.w/2;return '<path d="M'+x+' '+(a.y+a.h)+' L'+x+' '+(b.y-3)+'" class="dg-edge" stroke="#58727a" marker-end="url(#dgArrow)"/>';}
    const p=[[a.x+a.w,a.y+a.h*fs],[0,0],[0,0],[b.x-3,b.y+b.h*ft]],mid=(p[0][0]+p[3][0])/2;p[1]=[mid,p[0][1]];p[2]=[mid,p[3][1]];
    const [lx,ly]=bez(p,lt),stroke=DIAGRAM_TYPES[a.type][1];
    return '<path d="M'+p[0].join(' ')+' C'+p[1].join(' ')+' '+p[2].join(' ')+' '+p[3].join(' ')+'" class="dg-edge" stroke="'+stroke+'" marker-end="url(#dgArrow)"/>'+
      (label?'<text x="'+lx.toFixed(1)+'" y="'+(ly+4).toFixed(1)+'" font-size="11" font-weight="700" fill="'+stroke+'" text-anchor="middle" class="dg-edge-label">'+esc(label)+'</text>':'');
  }).join('');
  const boxes=list.map(o=>{
    const [fill,stroke]=DIAGRAM_TYPES[o.type],dark=o.type==='산출';
    return '<g class="dg-node" data-node="'+o.id+'"><title>'+esc(o.title+' — '+o.tip)+'</title><rect x="'+o.x+'" y="'+o.y+'" width="'+o.w+'" height="'+o.h+'" rx="9" fill="'+fill+'" stroke="'+stroke+'" stroke-width="1.4"/>'+
      (o.id==='occupancy'?occupancyNode(o,v):text(o.x+11,o.y+20,o.title,{size:13,weight:700,fill:dark?'#ffffff':'#17323b'})+text(o.x+o.w-10,o.y+19,o.type,{size:10,weight:700,fill:dark?'#9fd6cf':stroke,anchor:'end'})+
        o.lines.map((line,i)=>text(o.x+11,o.y+38+i*17,line,{size:12,fill:dark?'#e3f0f2':'#3a5560'})).join(''))+'</g>';
  }).join('');
  const heads=HEADERS.map((h,i)=>text(COLS[i],24,h,{size:12,weight:800,fill:'#29535c'})).join('');
  return '<svg class="data-diagram" viewBox="0 0 1380 610" role="img" aria-label="연계 데이터 관계도: 원천 자료가 출도착점 집계와 경로 배분 모형을 거쳐 동시체류·매장실적·길안내로 이어지는 구조"><defs><marker id="dgArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#58727a"/></marker></defs>'+heads+'<g fill="none" stroke-width="1.6">'+edges+'</g>'+boxes+'</svg>';
}

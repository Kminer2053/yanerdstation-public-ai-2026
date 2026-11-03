// CSV values are read-only evidence; source dates, periods and row classes remain intact.
export function parseCsv(text){
  const rows=[];let row=[],value='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(value);value='';}else if(c==='\n'&&!quoted){row.push(value.replace(/\r$/,''));rows.push(row);row=[];value='';}else value+=c;}
  if(quoted)throw Error('시간대 CSV 따옴표가 닫히지 않았습니다.');
  if(value||row.length){row.push(value.replace(/\r$/,''));rows.push(row);}
  const header=rows.shift().map((v,i)=>i===0?v.replace(/^\uFEFF/,''):v);
  return rows.filter(r=>r.length===header.length).map(r=>Object.fromEntries(header.map((k,i)=>[k,r[i]])));
}

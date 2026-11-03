// Both controls share the same preference; compact walking UI never resets it.
export function bindPeopleToggle({checkbox,button,onChange}){
 const sync=()=>{const on=checkbox.checked;button.textContent=on?'사람 켜짐':'사람 꺼짐';button.setAttribute('aria-pressed',String(on));button.setAttribute('aria-label',on?'유동인구 사람 표시 끄기':'유동인구 사람 표시 켜기');};
 const changed=()=>{sync();onChange(checkbox.checked);};
 button.addEventListener('click',()=>{checkbox.checked=!checkbox.checked;changed();});
 checkbox.addEventListener('change',changed);sync();
}

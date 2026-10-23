import React from 'react';
import {brand} from './brand';
export const AppointmentThread:React.FC<{state:'chat'|'selected'|'scheduled'|'returned';style?:React.CSSProperties}>=({state,style})=>{
 const note=state==='scheduled'||state==='returned';
 return <div style={{position:'relative',padding:note?'30px 32px':'22px 24px',borderRadius:note?22:12,background:note?'#FFFFFF':state==='selected'?'#FBE7D2':'#FFFFFF',border:`1px solid ${state==='selected'?'#C88962':'#E9E0D9'}`,color:brand.colors.text,lineHeight:1.5,...style}}>{note?<><div style={{fontSize:20,color:'#776A65',marginBottom:12}}>{state==='returned'?'日程提醒':'我们的约定'}</div><div style={{fontSize:32,fontWeight:600}}>一起去喝咖啡</div><div style={{fontSize:27,marginTop:20,color:'#B8554F',fontWeight:600}}>周六 · 15:00</div></>:<div style={{fontSize:28}}>周六下午3点，<br/>一起去喝咖啡</div>}</div>;
};

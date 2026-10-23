import React from 'react';
import {Img,staticFile} from 'remotion';
import {Chat,NotificationScreen} from './Chat';
import {events,at} from './sceneGraph';
import {cameraAt,progress,windowOpacity,tapPosition} from './motion';
import {theme} from './theme';
const ProductShot=({src,opacity}:{src:string;opacity:number})=><Img src={staticFile(src)} style={{position:'absolute',inset:0,width:540,height:1170,opacity}}/>;
export const Device=({frame}:{frame:number})=>{
 const c=cameraAt(frame),enter=progress(frame,0,26),out=progress(frame,at('cta'),28,theme.curves.exit);
 const chat=1-progress(frame,events.open,18),home=progress(frame,events.open,18)*(1-progress(frame,events.preview,8));
 const clip=progress(frame,events.preview,8)*(1-progress(frame,events.filled,8));
 const filled=progress(frame,events.filled,8)*(1-progress(frame,events.confirmPage,12));
 const confirm=progress(frame,events.confirmPage,12)*(1-progress(frame,events.saving,6));
 const saving=progress(frame,events.saving,6)*(1-progress(frame,events.timeJump+12,10));
 const notify=progress(frame,events.timeJump+12,10);
 const focus=windowOpacity(frame,at('review',24),at('review',110),18,16);
 const left=540-c.x*c.scale,top=c.height/2-c.y*c.scale;
 return <div data-testid="continuous-device" style={{position:'absolute',left:0,right:0,top:c.top,height:c.height,overflow:'hidden',zIndex:theme.layer.device,opacity:1-out,maskImage:'linear-gradient(to bottom,transparent,#000 18px,#000 calc(100% - 18px),transparent)'}}>
 <div style={{position:'absolute',left,top:top+70*(1-enter),width:540,height:1170,transform:`scale(${c.scale}) rotate(${-1.1*(1-enter)}deg)`,transformOrigin:'top left',opacity:.9+.1*enter,filter:`drop-shadow(0 18px 24px rgba(91,61,47,${.10*(1-progress(c.scale,1.25,.6))}))`}}>
 <div style={{position:'absolute',inset:-7,border:'2px solid #DBD0C7',borderRadius:56,background:'#E8E0D9',opacity:1-progress(c.scale,1.3,.4)}}/>
 <div style={{position:'absolute',inset:0,borderRadius:49,overflow:'hidden',background:'#FFF9F5'}}>
 <div style={{position:'absolute',inset:0,opacity:chat}}><Chat frame={frame}/></div>
 <ProductShot src="home.png" opacity={home}/><ProductShot src="clipboard.png" opacity={clip}/><ProductShot src="filled.png" opacity={filled}/><ProductShot src="confirm.png" opacity={confirm}/><ProductShot src="authorization.png" opacity={saving}/>
 <div style={{position:'absolute',inset:0,opacity:notify}}><NotificationScreen frame={frame}/></div>
 <svg width="540" height="1170" style={{position:'absolute',inset:0,pointerEvents:'none',opacity:focus}}><rect x="44" y="458" width="450" height="114" rx="14" fill="none" stroke="#AA5149" strokeWidth="1.5" strokeDasharray="1128" strokeDashoffset={1128*(1-progress(frame,at('review',24),28))}/></svg>
 </div></div></div>;
};
export const Interaction=({frame}:{frame:number})=>{
 const c=cameraAt(frame);
 const taps=[{at:events.copy,x:184,y:218},{at:events.clipboard,x:251,y:507},{at:events.use,x:94,y:694},{at:events.ping,x:465,y:508},{at:events.confirm,x:270,y:1023}];
 return <>{taps.map(t=>{const p=progress(frame,t.at,20),alpha=windowOpacity(frame,t.at-7,t.at+24,6,16);const loc=tapPosition(c,t.x,t.y);return <div key={t.at} style={{position:'absolute',left:loc.x,top:loc.y,pointerEvents:'none',zIndex:theme.layer.focus,opacity:alpha}}><div style={{position:'absolute',left:-25,top:-25,width:50,height:50,borderRadius:'50%',border:'2px solid #AA5149',background:'rgba(242,140,130,.12)',transform:`scale(${.65+p*.85})`,opacity:1-p*.7}}/><div style={{position:'absolute',left:-5,top:-5,width:10,height:10,borderRadius:'50%',background:'#AA5149',opacity:.7*(1-p)}}/></div>})}</>;
};

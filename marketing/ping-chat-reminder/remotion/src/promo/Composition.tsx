import React from 'react';
import {AbsoluteFill,Img,staticFile,useCurrentFrame,Sequence,useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {theme} from './theme';
import {Typography} from './Typography';
import {Device,Interaction} from './Device';
import {at,events,sounds} from './sceneGraph';
import {progress,windowOpacity} from './motion';
export const Closing=({frame}:{frame:number})=>{
 const start=at('cta'),logo=progress(frame,start+16,24),note=progress(frame,start+34,24),action=progress(frame,start+53,22);
 return <div style={{position:'absolute',inset:0,zIndex:5,pointerEvents:'none'}}>
 <div style={{position:'absolute',left:80,top:485,width:620,height:180,overflow:'hidden',opacity:logo,transform:`translateY(${32*(1-logo)}px)`}}><Img src={staticFile('ping-wordmark.svg')} style={{width:700,height:200,objectFit:'contain',objectPosition:'left top'}}/></div>
 <div style={{position:'absolute',left:80,right:80,top:804,padding:'54px 52px',border:'1px solid #E4D6CD',borderRadius:28,background:'rgba(255,255,255,.92)',boxShadow:'0 18px 42px rgba(91,61,47,.05)',opacity:note,transform:`translateY(${36*(1-note)}px) scale(${.97+.03*note})`,transformOrigin:'left center'}}>
 <div style={{fontSize:26,color:theme.color.secondary}}>我们的约定</div><div style={{marginTop:24,fontSize:52,fontWeight:600}}>一起去喝咖啡</div><div style={{marginTop:27,fontSize:38,fontWeight:600,color:theme.color.accentInk}}>周六 · 15:00</div>
 </div>
 <div style={{position:'absolute',left:80,top:1390,opacity:action,transform:`translateY(${24*(1-action)}px)`}}><div style={{fontSize:64,fontWeight:600,color:theme.color.ink}}>打开 Ping</div><div style={{fontSize:32,marginTop:22,color:theme.color.secondary}}>记下下一件想记住的事。</div></div>
 </div>;
};
const AudioTrack=()=>{const {fps}=useVideoConfig();return <>
 <Audio name="原创轻音乐 · 96 BPM" src={staticFile('audio/music-bed.wav')} volume={(f)=>.8*progress(f,0,24)*(1-progress(f,840,60))} premountFor={fps}/>
 {sounds.map(s=><Sequence key={s.id} name={`SFX · ${s.id}`} from={s.frame} durationInFrames={s.frames} premountFor={fps}><Audio src={staticFile(`audio/${s.src}`)} volume={s.volume} premountFor={fps}/></Sequence>)}
 </>};
export const Promo=()=>{const frame=useCurrentFrame();const permission=windowOpacity(frame,events.permissionNote,at('notify')+2,16,12);const jump=windowOpacity(frame,at('notify')-13,events.notification+6,12,12);
 return <AbsoluteFill style={{background:theme.color.background,fontFamily:theme.font,color:theme.color.ink,overflow:'hidden'}}>
 <AbsoluteFill style={{background:`radial-gradient(ellipse 90% 65% at ${12+progress(frame,0,900)*45}% 25%,rgba(242,140,130,.13),transparent 72%)`,zIndex:0}}/>
 <AbsoluteFill style={{background:'radial-gradient(ellipse at 95% 75%,rgba(217,207,240,.17),transparent 55%)',opacity:progress(frame,100,300)*(1-progress(frame,650,150)),zIndex:0}}/>
 <div style={{position:'absolute',left:80,top:90,right:80,display:'flex',justifyContent:'space-between',alignItems:'center',zIndex:8,fontSize:28,fontWeight:600}}><span style={{color:theme.color.accentInk}}>Ping</span><span style={{fontSize:23,fontWeight:400,color:theme.color.secondary}}>一句话，轻轻记住</span></div>
 <Device frame={frame}/><Interaction frame={frame}/><Typography frame={frame}/>
 <div style={{position:'absolute',left:110,right:110,top:1570,zIndex:7,padding:'18px 26px',borderRadius:18,background:'rgba(255,249,245,.96)',border:'1px solid #E5D6CD',opacity:permission,transform:`translateY(${14*(1-permission)}px)`}}><span style={{fontSize:20,color:theme.color.secondary}}>通知说明</span><div style={{fontSize:28,marginTop:7}}>允许订阅消息后，才能接收提醒。</div></div>
 <div style={{position:'absolute',left:100,right:100,top:835,zIndex:9,textAlign:'center',opacity:jump,background:'rgba(255,249,245,.96)',padding:'40px 0',borderRadius:28}}><div style={{fontSize:28,color:theme.color.secondary}}>到了约定时间</div><div style={{fontSize:100,fontWeight:600,marginTop:14,letterSpacing:-3}}>周六 15:00</div></div>
 <Closing frame={frame}/><AudioTrack/>
 </AbsoluteFill>;
};

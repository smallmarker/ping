import React from 'react';
import {Img,staticFile} from 'remotion';
import {events} from './sceneGraph';
import {progress,windowOpacity} from './motion';
import {theme} from './theme';
export const Status=({time='18:00'}:{time?:string})=><><div style={{position:'absolute',top:24,left:24,fontSize:21,fontWeight:600}}>{time}</div><div style={{position:'absolute',right:24,top:25,width:26,height:13,border:'1.5px solid #322E2D',borderRadius:4}}><div style={{margin:2,width:19,height:7,background:'#322E2D',borderRadius:1}}/></div><div style={{position:'absolute',top:0,left:118,width:304,height:45,borderRadius:'0 0 26px 26px',background:'#322E2D'}}/><div style={{position:'absolute',bottom:12,left:180,width:180,height:6,borderRadius:4,background:'#322E2D'}}/></>;
export const Chat=({frame}:{frame:number})=>{
 const a=progress(frame,events.incoming,16),b=progress(frame,events.reply,14),select=progress(frame,events.longPress,7),menu=windowOpacity(frame,events.longPress+5,events.copy+5,9,5);
 return <div style={{position:'absolute',inset:0,background:'#F2F1EE',color:theme.color.ink}}>
 <Status/>
 <div style={{position:'absolute',top:78,left:24,right:24,paddingBottom:22,borderBottom:'1px solid #DFDAD5',fontSize:27,fontWeight:600}}>〈 <span style={{position:'absolute',left:223}}>悦悦</span><span style={{float:'right'}}>···</span></div>
 <div style={{position:'absolute',top:195,left:0,right:0,textAlign:'center',fontSize:18,color:'#8D827C'}}>星期五 18:00</div>
 <div style={{position:'absolute',left:24,top:265,width:52,height:52,display:'grid',placeItems:'center',borderRadius:13,background:'#E6D3C6',fontSize:25,opacity:a,transform:`translateY(${12*(1-a)}px)`}}>悦</div>
 <div style={{position:'absolute',top:265,left:94,width:345,padding:'22px 24px',border:'1px solid #E8DED5',borderRadius:14,background:select>.2?'#FBE7D2':'#FFFFFF',fontSize:28,lineHeight:1.5,opacity:a,transform:`translateY(${24*(1-a)}px) scale(${.97+.03*a})`,transformOrigin:'top left'}}>周六下午3点，<br/>一起去喝咖啡</div>
 <div style={{position:'absolute',top:452,right:24,width:52,height:52,borderRadius:13,background:'#D8E0CE',display:'grid',placeItems:'center',fontSize:25,opacity:b}}>我</div>
 <div style={{position:'absolute',top:452,right:94,padding:'18px 24px',fontSize:28,background:'#D9E8C9',borderRadius:14,opacity:b,transform:`translateX(${18*(1-b)}px)`}}>好呀！</div>
 <div style={{position:'absolute',left:126,top:190,borderRadius:12,padding:'15px 30px',fontSize:24,color:'#FFF9F5',background:'#3F3936',opacity:menu,transform:`translateY(${8*(1-menu)}px)`}}>复制</div>
 <div style={{position:'absolute',left:183,top:590,padding:'10px 20px',borderRadius:24,fontSize:19,background:'#E7E0D8',color:'#776A65',opacity:windowOpacity(frame,events.copy+2,events.open+2,6,8)}}>这句话，已复制</div>
 <div style={{position:'absolute',bottom:30,left:0,right:0,height:70,borderTop:'1px solid #DED9D3',display:'flex',alignItems:'center',gap:16,padding:'0 24px',fontSize:30}}><span>⊙</span><div style={{height:45,flex:1,background:'white',borderRadius:8}}/><span>⊕</span></div>
 <div style={{position:'absolute',bottom:132,right:24,fontSize:16,color:'#8C8079'}}>聊天演示</div>
 </div>;
};
export const NotificationScreen=({frame}:{frame:number})=>{
 const p=progress(frame,events.notification,20);
 return <div style={{position:'absolute',inset:0,background:'#F2F1EE',color:theme.color.ink}}><Status time="15:00"/>
 <div style={{position:'absolute',top:78,left:24,right:24,fontSize:27,paddingBottom:22,borderBottom:'1px solid #DFDAD5'}}>〈 <span style={{position:'absolute',left:187,fontWeight:600}}>服务通知</span></div>
 <div style={{position:'absolute',top:198,left:0,right:0,fontSize:20,textAlign:'center',color:theme.color.secondary}}>周六 15:00</div>
 <div style={{position:'absolute',left:28,right:28,top:267,opacity:p,transform:`translateY(${30*(1-p)}px)`}}>
 <div style={{display:'flex',alignItems:'center',gap:15,marginBottom:18}}><Img src={staticFile('ping-logo-v1.png')} style={{width:50,height:50,borderRadius:12}}/><span style={{fontSize:24}}>Ping</span></div>
 <div style={{padding:'30px 28px',border:'1px solid #E4D9D1',borderRadius:20,background:'white'}}><div style={{fontSize:20,color:theme.color.secondary}}>日程提醒</div><div style={{marginTop:18,fontSize:30,fontWeight:650}}>一起去喝咖啡</div><div style={{marginTop:22,fontSize:26,color:theme.color.accentInk,fontWeight:600}}>周六 · 15:00</div><div style={{height:1,background:'#ECE4DE',margin:'24px 0'}}/><div style={{fontSize:19,lineHeight:1.8,color:theme.color.secondary}}>日程标题：一起去喝咖啡<br/>日程时间：2026年10月17日 15:00</div></div>
 </div>
 <div style={{position:'absolute',bottom:98,left:28,right:28,fontSize:18,lineHeight:1.6,color:theme.color.secondary}}>通知演示<br/>实际通知需用户允许微信订阅消息</div>
 </div>;
};

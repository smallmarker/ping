import React from 'react';
import {Img,staticFile,useCurrentFrame} from 'remotion';
import {AppointmentThread} from '../appointment-thread';
import {Shell,Heading,Note,reveal} from '../ui';
export default function Closing(){const f=useCurrentFrame();return <Shell step="06 / 记下下一件事"><Heading>把想记住的事，<br/>轻轻 Ping 一下。</Heading><div style={{position:'absolute',top:505,left:76,right:76,opacity:reveal(f,0,12)}}><Img src={staticFile('ping-wordmark.svg')} style={{width:375,height:150,objectFit:'contain',objectPosition:'left center'}}/><div style={{marginTop:72,width:928}}><AppointmentThread state="scheduled" style={{padding:'62px 56px',borderRadius:32,boxShadow:'0 14px 48px rgba(91,61,47,.06)'}}/></div></div><div style={{position:'absolute',left:76,top:1320,width:928,borderTop:'1px solid #DDC9BE',paddingTop:45}}><div style={{fontSize:52,fontWeight:600}}>打开 Ping</div><div style={{marginTop:20,fontSize:32,color:'#736660'}}>记下下一件想记住的事。</div></div><Note>一句话记下，在合适的时候提醒你。</Note></Shell>}

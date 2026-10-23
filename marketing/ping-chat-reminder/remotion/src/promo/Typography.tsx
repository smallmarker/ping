import React from 'react';
import {beats} from './sceneGraph';
import {progress,windowOpacity} from './motion';
import {theme} from './theme';
export const Typography=({frame}:{frame:number})=><>
 {beats.map((b,i)=>{const end=b.startFrame+b.durationInFrames;return <React.Fragment key={b.id}>
 <div data-testid={`headline-${b.id}`} style={{position:'absolute',left:80,top:169,right:60,zIndex:theme.layer.text,fontSize:theme.type.hero,fontWeight:650,lineHeight:1.18,letterSpacing:-3,color:theme.color.ink}}>
 {b.headline.map((line,j)=>{const enter=progress(frame,b.startFrame+(i===0?0:6)+j*4,18),exit=progress(frame,end-14,12,theme.curves.exit);return <div key={line} style={{overflow:'hidden'}}><div style={{opacity:enter*(1-exit),transform:`translateY(${34*(1-enter)-24*exit}px)`,filter:`blur(${1.5*(1-enter)}px)`}}>{line}</div></div>})}</div>
 <div style={{position:'absolute',left:80,right:80,bottom:126,zIndex:theme.layer.text,fontSize:32,lineHeight:1.5,color:theme.color.secondary,opacity:windowOpacity(frame,b.startFrame+22,end-4,16,10),transform:`translateY(${12*(1-progress(frame,b.startFrame+22,16))}px)`}}>{b.caption}</div>
 </React.Fragment>})}
 </>;

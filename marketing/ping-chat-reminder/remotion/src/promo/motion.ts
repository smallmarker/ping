import {interpolate,Easing} from 'remotion';
import {theme} from './theme';
import {at,events} from './sceneGraph';
export const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
export const progress=(f:number,start:number,duration=20,easing=theme.curves.enter)=>interpolate(f,[start,start+duration],[0,1],{...clamp,easing});
export const windowOpacity=(f:number,start:number,end:number,enter=16,exit=12)=>progress(f,start,enter)*(1-progress(f,end-exit,exit,theme.curves.exit));
export type Camera={scale:number;x:number;y:number;top:number;height:number};
type Key=Camera & {frame:number};
export const cameraKeys:Key[]=[
{frame:0,scale:1.0,x:270,y:585,top:420,height:1260},
{frame:at('chat',35),scale:1.06,x:270,y:565,top:420,height:1260},
{frame:at('copy',8),scale:1.22,x:270,y:420,top:420,height:1260},
{frame:events.copy+12,scale:1.25,x:270,y:420,top:420,height:1260},
{frame:events.open+21,scale:1.06,x:270,y:585,top:420,height:1260},
{frame:at('clipboard',12),scale:1.06,x:270,y:585,top:420,height:1260},
{frame:at('clipboard',56),scale:2.02,x:270,y:525,top:520,height:990},
{frame:events.filled+12,scale:2.02,x:270,y:525,top:520,height:990},
{frame:at('parse',36),scale:1.92,x:300,y:550,top:520,height:990},
{frame:events.confirmPage+30,scale:1.63,x:270,y:470,top:440,height:1190},
{frame:at('review',110),scale:1.67,x:270,y:470,top:440,height:1190},
{frame:at('save',44),scale:1.53,x:270,y:850,top:450,height:1180},
{frame:events.saving+20,scale:1.53,x:270,y:850,top:450,height:1180},
{frame:at('notify',9),scale:1.06,x:270,y:585,top:420,height:1260},
{frame:at('notify',40),scale:1.30,x:270,y:480,top:420,height:1260},
{frame:at('notify',105),scale:1.33,x:270,y:480,top:420,height:1260},
{frame:at('cta',30),scale:.8,x:135,y:585,top:520,height:1180},
];
export const cameraAt=(f:number):Camera=>{
 let i=0;while(i<cameraKeys.length-2&&f>cameraKeys[i+1].frame)i++;
 const a=cameraKeys[i],b=cameraKeys[i+1];const p=progress(f,a.frame,b.frame-a.frame,theme.curves.camera);
 const mix=(k:keyof Camera)=>a[k]+(b[k]-a[k])*p;
 return {scale:mix('scale'),x:mix('x'),y:mix('y'),top:mix('top'),height:mix('height')};
};
export const tapPosition=(camera:Camera,x:number,y:number)=>({x:540+(x-camera.x)*camera.scale,y:camera.top+camera.height/2+(y-camera.y)*camera.scale});

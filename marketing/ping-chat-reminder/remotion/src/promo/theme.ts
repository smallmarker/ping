import {Easing} from 'remotion';
import {brand} from '../brand';
export const theme={
 width:1080,height:1920,fps:30,duration:900,
 color:{...brand.colors,ink:'#322E2D',secondary:'#786B65',accentInk:'#AA5149',line:'#E5D6CD',paper:'#FFFFFF'},
 font:brand.font.family,
 type:{hero:84,body:34,small:26,label:24},
 space:{safeX:80,safeTop:90,safeBottom:120},
 radius:{device:49,card:28},
 layer:{background:0,device:2,focus:4,text:8,transition:10},
 curves:{enter:Easing.bezier(.16,1,.3,1),exit:Easing.in(Easing.cubic),camera:Easing.bezier(.45,0,.55,1),standard:Easing.bezier(.4,0,.2,1)},
} as const;

import {brand} from './brand';
import type {Story} from './story-types';
export const story:Story={meta:{aspectRatio:'9:16',fps:30,slug:'ping-chat-reminder'},brand,scenes:[
{type:'Custom',componentName:'ChatHook',durationFrames:90,props:{}},
{type:'Custom',componentName:'CopyOpen',durationFrames:150,props:{}},
{type:'Custom',componentName:'Clipboard',durationFrames:180,props:{}},
{type:'Custom',componentName:'Confirm',durationFrames:210,props:{}},
{type:'Custom',componentName:'Notification',durationFrames:120,props:{}},
{type:'Custom',componentName:'Closing',durationFrames:150,props:{}}
]};

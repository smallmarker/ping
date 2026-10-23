import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Shell,Heading,Phone,Touch,Note} from '../ui';
export default function Confirm(){const f=useCurrentFrame();return <Shell step="04 / 确认提醒"><Heading>事项、时间，<br/>核对一下。</Heading><Phone src="confirm.png"/><Touch x={543} y={1541} at={136}/><div style={{position:'absolute',left:275,top:925,width:532,height:104,border:'2px solid #BC6E63',borderRadius:14,opacity:f>=45&&f<124?.75:0,zIndex:5}}/><Note>{f<135?'一起去喝咖啡 · 周六 15:00':'确认后需允许微信订阅消息，才能接收通知。'}</Note></Shell>}

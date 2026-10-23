import React from 'react';
import {useCurrentFrame} from 'remotion';
import {ChatSurface} from './ChatHook';
import {Shell,Heading,Phone,Touch,Note,reveal} from '../ui';
export default function CopyOpen(){const f=useCurrentFrame();return <Shell variant="vignette" step="02 / 复制约定"><Heading>聊天里的约定，<br/>变成提醒。</Heading><Phone opacity={1-reveal(f,51,16)}><ChatSurface selected={f>=8} menu={f>=20}/></Phone><Phone src="home.png" opacity={reveal(f,51,16)}/>{f<51?<Touch x={410} y={655} at={20}/>:<Touch x={518} y={963} at={109}/>}<Note>{f<58?'长按约定，选择复制。':'打开 Ping，点击「使用剪贴板」。'}</Note></Shell>}

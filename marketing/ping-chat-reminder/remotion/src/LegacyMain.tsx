import React from 'react';
import {Series,useVideoConfig} from 'remotion';
import {story} from './story';
import type {Scene} from './story-types';
import ChatHook from './scenes/ChatHook';
import CopyOpen from './scenes/CopyOpen';
import Clipboard from './scenes/Clipboard';
import Confirm from './scenes/Confirm';
import Notification from './scenes/Notification';
import Closing from './scenes/Closing';
function renderScene(scene:Scene){if(scene.type!=='Custom')throw new Error('This story uses product demo scenes');switch(scene.componentName){case 'ChatHook':return <ChatHook/>;case 'CopyOpen':return <CopyOpen/>;case 'Clipboard':return <Clipboard/>;case 'Confirm':return <Confirm/>;case 'Notification':return <Notification/>;case 'Closing':return <Closing/>;default:throw new Error(`Missing scene ${scene.componentName}`)}}
export const LegacyMain=()=>{const {fps}=useVideoConfig();return <Series>
<Series.Sequence name="聊天约定" durationInFrames={90} premountFor={fps}>{renderScene(story.scenes[0])}</Series.Sequence>
<Series.Sequence name="复制并打开 Ping" durationInFrames={150} premountFor={fps}>{renderScene(story.scenes[1])}</Series.Sequence>
<Series.Sequence name="真实剪贴板与输入" durationInFrames={180} premountFor={fps}>{renderScene(story.scenes[2])}</Series.Sequence>
<Series.Sequence name="核对并确认提醒" durationInFrames={210} premountFor={fps}>{renderScene(story.scenes[3])}</Series.Sequence>
<Series.Sequence name="微信通知演示" durationInFrames={120} premountFor={fps}>{renderScene(story.scenes[4])}</Series.Sequence>
<Series.Sequence name="记下下一件事" durationInFrames={150} premountFor={fps}>{renderScene(story.scenes[5])}</Series.Sequence>
</Series>};

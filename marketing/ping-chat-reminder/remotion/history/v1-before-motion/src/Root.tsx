import {Composition,Folder} from 'remotion';
import {Main} from './Main';
import ChatHook from './scenes/ChatHook';
import CopyOpen from './scenes/CopyOpen';
import Clipboard from './scenes/Clipboard';
import Confirm from './scenes/Confirm';
import Notification from './scenes/Notification';
import Closing from './scenes/Closing';
export const RemotionRoot=()=> <>
<Composition id="Main" component={Main} width={1080} height={1920} fps={30} durationInFrames={900}/>
<Folder name="Scenes">
<Composition id="ChatHook" component={ChatHook} width={1080} height={1920} fps={30} durationInFrames={90}/>
<Composition id="CopyOpen" component={CopyOpen} width={1080} height={1920} fps={30} durationInFrames={150}/>
<Composition id="Clipboard" component={Clipboard} width={1080} height={1920} fps={30} durationInFrames={180}/>
<Composition id="Confirm" component={Confirm} width={1080} height={1920} fps={30} durationInFrames={210}/>
<Composition id="Notification" component={Notification} width={1080} height={1920} fps={30} durationInFrames={120}/>
<Composition id="Closing" component={Closing} width={1080} height={1920} fps={30} durationInFrames={150}/>
</Folder></>;

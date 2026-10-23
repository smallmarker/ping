export type SceneBeat={id:string;startFrame:number;durationInFrames:number;narrativeGoal:string;headline:readonly string[];caption:string;visual:string;motion:string;audio:string;assetRefs:readonly string[]};
type Input=Omit<SceneBeat,'startFrame'>;
const plan:Input[]=[
{id:'chat',durationInFrames:90,narrativeGoal:'闺蜜约好咖啡，但约定可能被聊天淹没',headline:['聊好了，','怕忘了？'],caption:'和闺蜜约好的事，别只留在聊天里。',visual:'演示聊天中的同一句咖啡约定',motion:'消息先出现，回复后出现，镜头缓慢推进',audio:'消息短音、轻音乐渐入',assetRefs:[]},
{id:'copy',durationInFrames:90,narrativeGoal:'复制后可以把约定带到 Ping',headline:['聊天里的约定，','交给 Ping。'],caption:'复制这句话，打开 Ping。',visual:'复制菜单与真实首页连续交接',motion:'保留设备，原句离开气泡后进入产品空间',audio:'复制声与轻移动声',assetRefs:['home.png']},
{id:'clipboard',durationInFrames:120,narrativeGoal:'剪贴板需要主动点击并确认使用',headline:['复制的话，','直接用。'],caption:'点击「使用剪贴板」，预览后使用。',visual:'真实剪贴板预览',motion:'连续镜头推到剪贴板预览，点击后显示填入结果',audio:'两次点击与屏幕反馈对齐',assetRefs:['home.png','clipboard.png','filled.png']},
{id:'parse',durationInFrames:90,narrativeGoal:'原句直接交给 Ping 解析',headline:['原句填好，','Ping 一下。'],caption:'不用重新整理事项和时间。',visual:'真实输入区与 Ping 图标',motion:'从剪贴板预览平滑平移回输入和提交图标',audio:'点击声、轻移动声',assetRefs:['filled.png','confirm.png']},
{id:'review',durationInFrames:120,narrativeGoal:'识别的事项和时间可核对',headline:['事项、时间，','核对一下。'],caption:'一起去喝咖啡 · 周六 15:00',visual:'真实确认页的事项与时间',motion:'推到摘要，框线渐入，停留阅读',audio:'安静音乐段',assetRefs:['confirm.png']},
{id:'save',durationInFrames:120,narrativeGoal:'确认后需允许订阅消息才能收通知',headline:['确认提醒，','记下这次约定。'],caption:'接收提醒，需要允许微信订阅消息。',visual:'真实确认按钮与真实保存中截图',motion:'镜头平移到确认按钮，点击后显示保存中，授权说明作为编辑层出现',audio:'点击声',assetRefs:['confirm.png','authorization.png']},
{id:'notify',durationInFrames:120,narrativeGoal:'时间跳转后，同一约定作为微信通知回来',headline:['到了约定时间，','咖啡局别忘了。'],caption:'时间跳转 · 微信订阅消息通知演示',visual:'明确标注的通知演示',motion:'时间锚点衔接，通知卡轻落位',audio:'原创 Ping 提示音',assetRefs:['ping-logo-v1.png']},
{id:'cta',durationInFrames:150,narrativeGoal:'打开 Ping 记下自己的下一件事',headline:['把想记住的事，','轻轻 Ping 一下。'],caption:'打开 Ping，记下下一件事。',visual:'真实品牌字标和同一句约定',motion:'设备退场，品牌、事项小记页、CTA 分层入场',audio:'柔和收束并渐出',assetRefs:['ping-wordmark.svg']},
];
let cursor=0;
export const beats:SceneBeat[]=plan.map(b=>{const result={...b,startFrame:cursor};cursor+=b.durationInFrames;return result;});
export const totalFrames=cursor;
export const at=(id:string,offset=0)=>{const beat=beats.find(b=>b.id===id);if(!beat)throw new Error(`Unknown beat ${id}`);return beat.startFrame+offset;};
export const events={incoming:at('chat',17),reply:at('chat',49),longPress:at('copy',16),copy:at('copy',35),open:at('copy',59),clipboard:at('clipboard',14),preview:at('clipboard',18),use:at('clipboard',96),filled:at('clipboard',100),ping:at('parse',66),confirmPage:at('parse',70),confirm:at('save',60),saving:at('save',64),permissionNote:at('save',80),timeJump:at('notify'),notification:at('notify',16),brand:at('cta',22)};
export const sounds=[
{id:'message',frame:events.incoming,src:'message.wav',volume:.48,frames:22},
{id:'reply',frame:events.reply,src:'tap.wav',volume:.38,frames:5},
{id:'copy',frame:events.copy,src:'copy.wav',volume:.55,frames:10},
{id:'open',frame:events.open,src:'move.wav',volume:.45,frames:12},
{id:'clipboard',frame:events.clipboard,src:'tap.wav',volume:.65,frames:5},
{id:'use',frame:events.use,src:'tap.wav',volume:.65,frames:5},
{id:'parse',frame:events.ping,src:'tap.wav',volume:.65,frames:5},
{id:'result',frame:events.confirmPage,src:'move.wav',volume:.3,frames:12},
{id:'confirm',frame:events.confirm,src:'tap.wav',volume:.65,frames:5},
{id:'notification',frame:events.notification,src:'ping.wav',volume:.64,frames:36},
{id:'brand',frame:events.brand,src:'copy.wav',volume:.35,frames:10},
];

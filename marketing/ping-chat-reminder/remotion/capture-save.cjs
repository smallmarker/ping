const a=require('miniprogram-automator');const path=require('path');
(async()=>{const m=await a.connect({wsEndpoint:'ws://127.0.0.1:9420'});const p=await m.currentPage();console.log('Before',p.path);await p.callMethod('onConfirm');await m.screenshot({path:path.resolve('public/authorization.png')});const q=await m.currentPage();console.log('After',q.path);m.disconnect()})().catch(console.error)

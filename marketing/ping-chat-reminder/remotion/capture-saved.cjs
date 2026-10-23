const a=require('miniprogram-automator');const path=require('path');
(async()=>{const m=await a.connect({wsEndpoint:'ws://127.0.0.1:9420'});let p=await m.currentPage();console.log(p.path,JSON.stringify(await p.data()));await m.screenshot({path:path.resolve('public/saved.png')});m.disconnect()})().catch(console.error)

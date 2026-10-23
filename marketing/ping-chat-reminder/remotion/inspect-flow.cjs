const a=require('miniprogram-automator');
(async()=>{const m=await a.connect({wsEndpoint:'ws://127.0.0.1:9420'});const p=await m.currentPage();console.log(p.path,JSON.stringify(await p.data()));await m.screenshot({path:require('path').resolve('public/confirm.png')});m.disconnect()})().catch(console.error)

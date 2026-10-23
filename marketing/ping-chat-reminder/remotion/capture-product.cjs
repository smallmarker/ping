const automator = require('miniprogram-automator');
const path = require('node:path');
(async()=> {
 const mini = await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'});
 const page = await mini.currentPage();
 console.log('Current:',page.path);
 await mini.screenshot({path:path.resolve('public/home.png')});
 console.log('Saved public/home.png');
 mini.disconnect();
})().catch(e=>{console.error(e);process.exit(1)});

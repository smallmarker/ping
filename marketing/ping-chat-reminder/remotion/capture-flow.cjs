const automator=require('miniprogram-automator');
const path=require('node:path');
(async()=>{
 const mini=await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'});
 const shot=async(name)=>{await mini.screenshot({path:path.resolve('public/'+name+'.png')});console.log('Saved',name)};
 let page=await mini.currentPage();
 await mini.callWxMethod('setClipboardData',{data:'周六下午3点，一起去喝咖啡'});
 await page.callMethod('readClipboard');
 console.log('Clipboard visible:',await page.data('clipboardVisible'));
 await shot('clipboard');
 await page.callMethod('useClipboard');
 console.log('Input:',await page.data('text'));
 await shot('filled');
 await page.callMethod('onCreate');
 page=await mini.currentPage();
 console.log('Page:',page.path,'Summary:',JSON.stringify(await page.data('reminder')));
 await shot('confirm');
 mini.disconnect();
})().catch(e=>{console.error(e);process.exit(1)});

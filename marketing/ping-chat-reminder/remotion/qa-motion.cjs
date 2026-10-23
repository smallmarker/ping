const {bundle}=require('@remotion/bundler');
const {selectComposition,renderStill,renderMedia}=require('@remotion/renderer');
const path=require('node:path');const fs=require('node:fs');
(async()=>{
 const serveUrl=await bundle({entryPoint:path.resolve('src/index.ts')});
 fs.mkdirSync('out/motion',{recursive:true});
 const browserExecutable='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
 const composition=await selectComposition({serveUrl,id:'Main',browserExecutable});
 console.log('Composition',composition.width,composition.height,composition.fps,composition.durationInFrames);
 fs.writeFileSync('out/motion/composition.json',JSON.stringify(composition,null,2));
 for(const frame of (process.argv.includes("--affected")?[248,320]:[45,132,170,248,320,450,555,604,680,840])){
  await renderStill({serveUrl,composition,output:path.resolve(`out/motion/frame-${frame}.png`),frame,scale:1,imageFormat:'png',browserExecutable});
  console.log('QA frame',frame);
 }
 if(process.argv.includes('--draft')){
  await renderMedia({serveUrl,composition,outputLocation:path.resolve('out/motion/draft-ui-focus.mp4'),frameRange:[165,389],scale:.5,codec:'h264',crf:20,pixelFormat:'yuv420p',browserExecutable,concurrency:3});
  console.log('QA draft range 5.5s–13.0s complete');
  await renderMedia({serveUrl,composition,outputLocation:path.resolve('out/motion/draft-notification-closing.mp4'),frameRange:[615,824],scale:.5,codec:'h264',crf:20,pixelFormat:'yuv420p',browserExecutable,concurrency:3});
  console.log('QA draft range 20.5s–27.5s complete');
 }
})().catch(e=>{console.error(e);process.exit(1)});

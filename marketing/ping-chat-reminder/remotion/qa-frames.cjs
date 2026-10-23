const {bundle}=require('@remotion/bundler');
const {selectComposition,renderStill}=require('@remotion/renderer');
const path=require('node:path');
(async()=>{
 const serveUrl=await bundle({entryPoint:path.resolve('src/index.ts')});
 const browserExecutable='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
 const composition=await selectComposition({serveUrl,id:'Main',browserExecutable});
 for(const frame of [55,210,290,360,510,600,690,840]){
  await renderStill({serveUrl,composition,output:path.resolve(`out/frame-${frame}.png`),frame,scale:1,imageFormat:'png',browserExecutable});
  console.log('Verified frame',frame);
 }
})().catch(e=>{console.error(e);process.exit(1)});

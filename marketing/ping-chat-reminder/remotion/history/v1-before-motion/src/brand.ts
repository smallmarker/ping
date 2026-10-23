// Detected from miniprogram/app.wxss and docs/ui/DESIGN.md.
export const brand = {
 colors: { primary:'#F28C82', accent:'#F4F0FA', background:'#FFF9F5', text:'#322E2D', muted:'#827A76', success:'#77AF91', danger:'#D67D76' },
 font: { family:'"PingFang SC", -apple-system, BlinkMacSystemFont, sans-serif', mono:'monospace', googleFont:'PingFang SC' },
 introPath:null, outroPath:null,
 logo:'ping-wordmark.svg',
 logoPath:'ping-wordmark.svg',
};
export const hexToRgba=(hex:string,alpha:number)=>{const n=parseInt(hex.replace('#',''),16);return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${alpha})`;};

export type Brand = typeof brand;

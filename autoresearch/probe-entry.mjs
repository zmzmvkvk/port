// 진단(비동결): 엔트리 중 인트로 헤딩과 링이 겹치는지 뷰포트별로 본다.
// 사용: node probe-entry.mjs [WxH ...]
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../web/out");
const MIME={".html":"text/html",".js":"text/javascript",".css":"text/css",".webp":"image/webp",".svg":"image/svg+xml",".otf":"font/otf",".ttf":"font/ttf",".woff2":"font/woff2",".txt":"text/plain",".xml":"application/xml"};
const server=createServer(async(req,res)=>{let p=decodeURIComponent(new URL(req.url,"http://x").pathname);if(p.endsWith("/"))p+="index.html";
try{const b=await readFile(join(root,p));res.writeHead(200,{"content-type":MIME[extname(p)]??"application/octet-stream"});res.end(b);}catch{res.writeHead(404);res.end();}});
await new Promise(ok=>server.listen(4688,ok));
const args=process.argv.slice(2);
const START=+(process.env.START??0), STEP=+(process.env.STEP??420);
const sizes=(args.length?args:["708x547","1512x982","1024x768","390x844"]).map(s=>s.split("x").map(Number));
await mkdir(join(here,"shots"),{recursive:true});
const browser=await chromium.launch({headless:true,args:["--enable-gpu"]});
for(const [w,h] of sizes){
  const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,isMobile:w<700,hasTouch:w<700});
  const page=await ctx.newPage();
  await page.goto("http://127.0.0.1:4688/");
  // 헤딩이 처음 그려지는 순간부터 일정 간격으로 담는다.
  const frames=[];
  const t0=Date.now();
  if(START) await page.waitForTimeout(START);
  for(let i=0;i<12;i++){ frames.push({ms:Date.now()-t0,buf:await page.screenshot()}); await page.waitForTimeout(STEP); }
  const cols=4, tw=Math.round(w/2), th=Math.round(h/2);
  const strip=await page.evaluate(async([shots,tw,th,cols])=>{
    const rows=Math.ceil(shots.length/cols);
    const c=document.createElement("canvas");c.width=tw*cols;c.height=th*rows;
    const g=c.getContext("2d");g.fillStyle="#ddd";g.fillRect(0,0,c.width,c.height);
    for(let i=0;i<shots.length;i++){const img=new Image();
      await new Promise(ok=>{img.onload=ok;img.src="data:image/png;base64,"+shots[i].b64});
      const x=(i%cols)*tw,y=Math.floor(i/cols)*th;
      g.drawImage(img,x,y,tw,th);g.fillStyle="#c00";g.font="bold 13px monospace";
      g.fillText(shots[i].ms+"ms",x+5,y+15);g.strokeStyle="#999";g.strokeRect(x,y,tw,th);}
    return c.toDataURL("image/png");
  },[frames.map(f=>({ms:f.ms,b64:f.buf.toString("base64")})),tw,th,cols]);
  await writeFile(join(here,"shots",`entry-${w}x${h}.png`),Buffer.from(strip.split(",")[1],"base64"));
  console.log(`entry-${w}x${h}.png`);
  await ctx.close();
}
await browser.close();server.close();

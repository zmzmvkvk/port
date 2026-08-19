// 진단(비동결): 우하단 이름 뒤에 카드가 얼마나 깔려 있는지 픽셀로 잰다.
// 배경(#fafafa)이 아닌 픽셀의 비율 — 0 이면 완전히 비어 있는 자리다.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createRequire } from "node:module";
const here = dirname(fileURLToPath(import.meta.url));
const sharp = createRequire(resolve(here, "../web/package.json"))("sharp");
const root = resolve(here, "../web/out");
const MIME={".html":"text/html",".js":"text/javascript",".css":"text/css",".webp":"image/webp",".svg":"image/svg+xml",".woff2":"font/woff2",".txt":"text/plain",".xml":"application/xml"};
const server=createServer(async(req,res)=>{let p=decodeURIComponent(new URL(req.url,"http://x").pathname);if(p.endsWith("/"))p+="index.html";
  try{const b=await readFile(join(root,p));res.writeHead(200,{"content-type":MIME[extname(p)]??"application/octet-stream"});res.end(b);}catch{res.writeHead(404);res.end();}});
await new Promise(ok=>server.listen(4680,ok));
const sizes=(process.argv.slice(2).length?process.argv.slice(2):["320x568","360x640","390x844","430x932"]).map(s=>s.split("x").map(Number));
const browser=await chromium.launch({headless:true});
for(const [w,h] of sizes){
  const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const page=await ctx.newPage();
  await page.goto("http://127.0.0.1:4680/");
  await page.waitForFunction(()=>document.querySelector('div[aria-live="polite"]')?.textContent.trim().length>0,{timeout:40000});
  await page.waitForTimeout(1500);
  // 가장 긴 이름(Taylor's University)까지 돌려 최악의 경우를 본다.
  const steps = +(process.env.STEPS ?? 0);
  if (steps) {
    await page.focus('[role="group"]');
    for (let i = 0; i < steps; i++) {
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(700);
    }
    await page.waitForTimeout(600);
  }
  // 이름이 그려진 실제 글자 상자
  const box=await page.evaluate(()=>{
    const boxes=[...document.querySelectorAll('div[aria-hidden="true"]')].filter(d=>d.className.includes("fixed")&&d.querySelector("span span span"));
    let best=null;
    for(const b of boxes) for(const s of b.querySelectorAll("span")){
      if(s.children.length||!s.textContent.trim()) continue;
      if(+getComputedStyle(s).opacity<0.5) continue;
      const r=s.getBoundingClientRect();
      if(r.width<20) continue;
      if(!best||r.width>best.width) best={x:r.x,y:r.y,width:r.width,height:r.height,text:s.textContent};
    }
    return best;
  });
  if(!box){ console.log(`${w}x${h}: 이름을 찾지 못함`); await ctx.close(); continue; }
  const pad=4;
  const clip={x:Math.max(0,Math.floor(box.x-pad)),y:Math.max(0,Math.floor(box.y-pad)),
    width:Math.min(w,Math.ceil(box.width+pad*2)),height:Math.min(h,Math.ceil(box.height+pad*2))};
  // 글자 자체를 지우고 그 자리를 찍는다. 글자를 남긴 채로 재면 한글 획의
  // 안티에일리어싱이 배경도 잉크도 아닌 회색으로 잡혀 바닥값이 깔리고,
  // 채도로 가르면 어두운 무채색 카드를 놓친다.
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('div[aria-hidden="true"]'))
      if (b.className.includes("fixed")) b.style.visibility = "hidden";
  });
  await page.waitForTimeout(120);
  const buf=await page.screenshot({clip});
  await sharp(buf).resize({width:clip.width*3,kernel:"nearest"}).png().toFile(`shots/lockup-${w}.png`);
  const {data,info}=await sharp(buf).raw().toBuffer({resolveWithObject:true});
  let off=0;const total=info.width*info.height;
  for(let i=0;i<data.length;i+=info.channels){
    const r=data[i],g=data[i+1],b=data[i+2];
    // 이제 이 자리에 글자는 없다. 페이지 바탕(#fafafa)이 아니면 전부 카드다.
    if(!(Math.abs(r-250)<8&&Math.abs(g-250)<8&&Math.abs(b-250)<8)) off++;
  }
  const pct=(off/total*100).toFixed(1);
  console.log(`${w}x${h}  "${box.text}"  x=${Math.round(box.x)} y=${Math.round(box.y)}  이름 뒤 카드 ${pct}%  ${pct>2?"<- 겹침":"깨끗"}`);
  await ctx.close();
}
await browser.close();server.close();

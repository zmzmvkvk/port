// 진단(비동결): 인트로 건너뛰기 버튼이 실제로 대기 시간을 없애는지.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../web/out");
const MIME={".html":"text/html",".js":"text/javascript",".css":"text/css",".webp":"image/webp",".svg":"image/svg+xml",".woff2":"font/woff2",".txt":"text/plain",".xml":"application/xml"};
const server=createServer(async(req,res)=>{let p=decodeURIComponent(new URL(req.url,"http://x").pathname);if(p.endsWith("/"))p+="index.html";
  try{const b=await readFile(join(root,p));res.writeHead(200,{"content-type":MIME[extname(p)]??"application/octet-stream"});res.end(b);}catch{res.writeHead(404);res.end();}});
await new Promise(ok=>server.listen(4683,ok));
const browser=await chromium.launch({headless:true,args:["--enable-gpu"]});
async function run(mode){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await ctx.newPage();
  const errs=[]; page.on("console",m=>m.type()==="error"&&errs.push(m.text()));
  const t0=Date.now();
  await page.goto("http://127.0.0.1:4683/");
  if(mode==="skip"){
    // 키보드만으로: Tab 으로 버튼에 닿아 Enter
    await page.waitForSelector("button:not([hidden])",{timeout:20000});
    await page.keyboard.press("Tab");
    const focused=await page.evaluate(()=>document.activeElement?.textContent?.trim());
    await page.keyboard.press("Enter");
    var via=`Tab 한 번으로 "${focused}" 에 도달 후 Enter`;
  }
  await page.waitForFunction(()=>document.querySelector('div[aria-live="polite"]')?.textContent.trim().length>0,{timeout:60000});
  const ms=Date.now()-t0;
  const btn=await page.$("button:not([hidden])");
  // 이름이 공지되는 것과 링이 제자리에 선 것은 다른 일이다. 화면을 남겨 둔다.
  await page.waitForTimeout(1500);
  const shot=await page.screenshot();
  console.log(`${mode==="skip"?"건너뛰기":"그대로 두기"}: 첫 작업명까지 ${ms} ms` + (mode==="skip"?`  (${via})`:"") + `  버튼 남아있음:${btn?"예":"아니오"}  에러:${errs.length}`);
  await ctx.close();
  return shot;
}
const a=await run("wait");
const b=await run("skip");
// 두 화면이 같아야 한다 — 건너뛰기는 "빨리 감기"지 다른 결말이 아니다.
const { createRequire } = await import("node:module");
const sharp = createRequire(new URL("../web/package.json", import.meta.url).pathname.slice(1))("sharp");
const [ra, rb] = await Promise.all([sharp(a).raw().toBuffer({resolveWithObject:true}), sharp(b).raw().toBuffer({resolveWithObject:true})]);
let diff=0; const n=Math.min(ra.data.length, rb.data.length);
for(let i=0;i<n;i+=ra.info.channels) if(Math.abs(ra.data[i]-rb.data[i])>12) diff++;
const pct=(diff/(n/ra.info.channels)*100).toFixed(1);
console.log(`두 결말의 화면 차이: ${pct}%  ${pct>4?"<- 다른 결말이다":"같은 결말"}`);
await sharp(a).toFile("shots/skip-wait.png"); await sharp(b).toFile("shots/skip-done.png");
await browser.close();server.close();

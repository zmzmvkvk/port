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
  console.log(`${mode==="skip"?"건너뛰기":"그대로 두기"}: 첫 작업명까지 ${ms} ms` + (mode==="skip"?`  (${via})`:"") + `  버튼 남아있음:${btn?"예":"아니오"}  에러:${errs.length}`);
  await ctx.close();
}
await run("wait");
await run("skip");
await browser.close();server.close();

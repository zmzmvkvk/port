// 진단(비동결): 주장과 근거 레이어가 키보드로 열리고 닫히는지, 포커스가
// 레이어 안에 머무는지, 링이 그동안 조작 대상에서 빠지는지.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../web/out");
const MIME={".html":"text/html",".js":"text/javascript",".css":"text/css",".webp":"image/webp",".svg":"image/svg+xml",".woff2":"font/woff2"};
const server=createServer(async(req,res)=>{let p=decodeURIComponent(new URL(req.url,"http://x").pathname);if(p.endsWith("/"))p+="index.html";
  try{const b=await readFile(join(root,p));res.writeHead(200,{"content-type":MIME[extname(p)]??"application/octet-stream"});res.end(b);}catch{res.writeHead(404);res.end();}});
await new Promise(ok=>server.listen(4672,ok));
const browser=await chromium.launch({headless:true,args:["--enable-gpu"]});
const page=await (await browser.newContext({viewport:{width:1512,height:982}})).newPage();
const errs=[]; page.on("console",m=>m.type()==="error"&&errs.push(m.text()));
await page.goto("http://127.0.0.1:4672/");
await page.waitForSelector("button:not([hidden])",{timeout:20000});
await page.keyboard.press("Tab"); await page.keyboard.press("Enter");  // 인트로 건너뛰기
await page.waitForFunction(()=>document.querySelector('div[aria-live="polite"]')?.textContent.trim().length>0,{timeout:30000});
await page.waitForTimeout(600);
// 키보드만으로 '주장과 근거' 에 닿는다
const stops=[];
for(let i=0;i<4;i++){
  await page.keyboard.press("Tab");
  stops.push(await page.evaluate(()=>document.activeElement?.textContent?.trim().slice(0,12)||document.activeElement?.tagName));
  const hit=await page.evaluate(()=>document.activeElement?.textContent?.trim()==="주장과 근거");
  if(hit) break;
}
console.log("Tab 경로:", stops.join(" → "));
await page.keyboard.press("Enter");
await page.waitForSelector('[role="dialog"]',{timeout:8000});
await page.waitForTimeout(700);
const where=async()=>page.evaluate(()=>{const a=document.activeElement;return `${a?.tagName}${a?.getAttribute?.("aria-label")?`[${a.getAttribute("aria-label")}]`:""}${a?.closest?.('[role="dialog"]')?" (안)":" (밖)"}`;});
console.log("열린 직후 포커스:", await where());
console.log("링 inert:", await page.evaluate(()=>document.querySelector('[role="group"]')?.inert));
const seen=await page.evaluate(()=>({h2:document.querySelector('[role="dialog"] h2')?.textContent, claims:document.querySelectorAll('[role="dialog"] li').length,
  verify:[...document.querySelectorAll('[role="dialog"] dd')].map(d=>d.textContent.slice(0,20))}));
console.log("레이어 내용:", JSON.stringify(seen,null,0).slice(0,220));
await page.keyboard.press("Escape");
await page.waitForTimeout(600);
console.log("Escape 후:", (await page.$('[role="dialog"]'))?"안 닫힘":"닫힘", "· 포커스", await where(), "· 링 inert", await page.evaluate(()=>document.querySelector('[role="group"]')?.inert));
console.log("에러:", errs.length);
await page.screenshot({path:"shots/claims-layer.png"});
await browser.close();server.close();

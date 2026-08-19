// 진단(비동결): 상세 레이어가 열려 있는 동안 포커스가 레이어 밖으로 새는지.
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
await new Promise(ok=>server.listen(4681,ok));
const browser=await chromium.launch({headless:true});
const page=await (await browser.newContext({viewport:{width:1512,height:982}})).newPage();
await page.goto("http://127.0.0.1:4681/");
// 인트로를 건너뛰고 키보드로 상세를 연다
await page.waitForSelector("button:not([hidden])",{timeout:20000});
await page.keyboard.press("Tab"); await page.keyboard.press("Enter");
await page.waitForTimeout(600);
await page.focus('[role="group"]');
await page.keyboard.press("Enter");
await page.waitForSelector('[role="dialog"]',{timeout:8000});
await page.waitForTimeout(700);
const where = async () => page.evaluate(()=>{
  const a=document.activeElement; if(!a) return "none";
  const inDialog = !!a.closest?.('[role="dialog"]');
  return `${a.tagName}${a.getAttribute?.("aria-label")?`[${a.getAttribute("aria-label")}]`:""}${inDialog?" (레이어 안)":" (레이어 밖!)"}`;
});
console.log("열린 직후 포커스:", await where());
const stops=[];
for(let i=0;i<5;i++){ await page.keyboard.press("Tab"); stops.push(await where()); }
console.log("Tab 5번:");
for(const s of stops) console.log("   ", s);
const shiftStops=[];
for(let i=0;i<2;i++){ await page.keyboard.press("Shift+Tab"); shiftStops.push(await where()); }
console.log("Shift+Tab 2번:", shiftStops.join(" -> "));
await page.keyboard.press("Escape");
await page.waitForTimeout(700);
console.log("Escape 후 닫힘:", (await page.$('[role="dialog"]'))?"아니오":"예", "/ 포커스:", await where());
await browser.close();server.close();

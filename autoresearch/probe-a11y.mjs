// 진단(비동결): 키보드만으로 어디까지 갈 수 있는지, 랜드마크/헤딩이 있는지.
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
await new Promise(ok=>server.listen(4685,ok));
const browser=await chromium.launch({headless:true,args:["--enable-gpu"]});
const page=await (await browser.newContext({viewport:{width:1512,height:982}})).newPage();
await page.goto("http://127.0.0.1:4685/");
await page.waitForFunction(()=>document.querySelector('div[aria-live="polite"]')?.textContent.trim().length>0,{timeout:40000});
const struct=await page.evaluate(()=>({
  h1:[...document.querySelectorAll("h1")].map(e=>e.textContent),
  headings:[...document.querySelectorAll("h1,h2,h3")].map(e=>e.tagName+":"+e.textContent.slice(0,30)),
  landmarks:[...document.querySelectorAll("main,nav,header,footer,[role=main],[role=navigation]")].map(e=>e.tagName),
  links:[...document.querySelectorAll("a[href]")].map(a=>a.href),
  focusable:[...document.querySelectorAll("a[href],button,input,select,textarea,[tabindex]:not([tabindex='-1'])")].map(e=>e.tagName+(e.getAttribute("aria-label")?`[${e.getAttribute("aria-label")}]`:"")),
  lang:document.documentElement.lang,
  title:document.title,
}));
console.log("구조:", JSON.stringify(struct,null,1));
// Tab 을 눌러 실제로 포커스가 어디로 가는지
const stops=[];
for(let i=0;i<6;i++){
  await page.keyboard.press("Tab");
  stops.push(await page.evaluate(()=>{const a=document.activeElement;return a?a.tagName+(a.getAttribute?.("aria-label")?`[${a.getAttribute("aria-label")}]`:""):"none";}));
}
console.log("Tab 6번:", stops.join(" -> "));
// 화살표/Enter 로 링을 돌리거나 카드를 열 수 있는가
// 링에 초점을 준 뒤에 키를 눌러야 의미가 있다 (컨테이너에 핸들러가 달려 있다).
await page.focus('[role="group"]').catch(()=>{});
const before=await page.textContent('div[aria-live="polite"]');
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(900);
const mid=await page.textContent('div[aria-live="polite"]');
await page.keyboard.press("Enter");
await page.waitForTimeout(1200);
const after=await page.textContent('div[aria-live="polite"]');
const dialog=await page.$('[role="dialog"]');
console.log(`키보드로 카드 이동: ${before.trim()!==mid.trim()?"가능":"불가"} (${before.trim()} -> ${mid.trim()})`);
console.log("키보드로 상세 열기:", dialog?"가능":"불가");
await browser.close();server.close();

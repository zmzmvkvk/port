// 카드 아트 아홉 장을 생성한다. 로컬 grok 프록시(OpenAI 호환)
// /v1/images/generations.
//
//   node scripts/generate-cards.mjs
//   node scripts/generate-cards.mjs 02 07
//
// 아홉 장은 서로 다른 세계다. 같은 스튜디오·같은 세 톤·같은 폰 목업으로
// 묶지 않는다. 링에서 90px 로 줄여도 색과 실루엣으로 구분돼야 한다.
// 글자·로고는 깨져 나오므로 금지.

import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

const PROXY = process.env.GROK_PROXY_URL || "http://127.0.0.1:8300";
const MODEL = process.env.GROK_IMAGE_MODEL || "grok-imagine-image-quality";
const KEY_FILE =
  process.env.GROK_PROXY_KEY_FILE ||
  path.join(process.env.USERPROFILE || process.env.HOME || "", "grok-proxy", "proxy-api-key.txt"); // prettier-ignore

const OUT = path.resolve(import.meta.dirname, "cards-src");

const FRAME = `3:2 landscape, single image, high detail. No readable text, no letters, no numbers, no logos, no watermarks, no brand names, no people, no hands. Not a matching product-series shot. Not beige paper craft. Not a terracotta-cream-black stationery set. Not gray wireframe bars on white boards.`;

const CARDS = [
  {
    n: "01",
    name: "메가스터디교육",
    prompt: `Cinematic night photograph of a Korean cram-school study desk. Two large computer monitors glow ice-blue with an abstract education dashboard and a paused video lecture (UI is blurred shapes, no glyphs). A warm amber desk lamp pools light on a stack of thick workbooks with blank solid navy covers. Headphones, a mechanical pencil, scattered eraser dust. Shot on 35mm, shallow depth of field, cool shadows. Palette: navy, ice blue, amber. ${FRAME}`,
  },
  {
    n: "02",
    name: "AI 퍼블리싱 자동화",
    prompt: `Dark industrial machine room. A steel print robot extrudes a curved stream of identical glossy webpage sheets into the air, while a lime-green holographic master layout floats beside it. Cable looms, server LEDs, sparks of electric lime on brushed metal. Anamorphic cinema still, wet floor reflections. Palette: black, electric lime, cold steel. ${FRAME}`,
  },
  {
    n: "03",
    name: "roomy.page",
    prompt: `Octane 3D render of nine translucent glass portfolio cards orbiting on a viscous honey ring in a dark void. Neighbours melt into amber threads. One cream card faces camera, catching a volumetric god ray. Macro, cinematic, not a tabletop photo, not paper standing on a desk. Palette: charcoal, honey gold, cream. ${FRAME}`,
  },
  {
    n: "04",
    name: "버킷스토어",
    prompt: `High-fashion editorial photograph of a raw concrete studio. A single clothing rack holds camel wool coats, ivory silk shirts and one black leather jacket. Hard spotlight, long shadows, dust in the beam. No phone, no website, no lookbook pages. Helmut Newton lighting. Palette: camel, ivory, charcoal. ${FRAME}`,
  },
  {
    n: "05",
    name: "롯데백화점 앱",
    prompt: `Night interior of a luxury department-store atrium: black marble floors, gold escalators, a constellation of glossy crimson shopping bags, and a giant vertical LED wall showing an abstract shopping-app mosaic (coloured tiles, no glyphs). Teal reflections in the marble. Cinematic wide shot. Palette: black marble, crimson, gold. ${FRAME}`,
  },
  {
    n: "06",
    name: "공통 템플릿 시스템",
    prompt: `Exploded isometric CAD drawing of a modular interface kit floating in Prussian-blue blueprint space. White construction lines, orange registration crosses. Dozens of UNIQUE pieces — buttons, navs, cards, toggles — not a grid of identical squares. Technical illustration, orthographic feel. Palette: blueprint blue, white, signal orange. ${FRAME}`,
  },
  {
    n: "07",
    name: "차병원 뉴스룸",
    prompt: `Dawn architectural photograph of a contemporary hospital glass pavilion in mist. Mint surgical light leaks from interior windows. In the lobby, a tall totem display shows a clean news-site layout as soft rectangles (no glyphs). Pale fog, warm gold in the windows, wet plaza. Palette: mist white, medical teal, window gold. ${FRAME}`,
  },
  {
    n: "08",
    name: "하마그룹",
    prompt: `Cinematic night composite of three stacked city skylines in one frame: neon Seoul, tropical Kuala Lumpur towers, and a European old-town riverfront. Faint translucent UI panes hover between them like glass layers. Teal-and-gold grade, wet streets. Palette: navy, gold, magenta neon. ${FRAME}`,
  },
  {
    n: "09",
    name: "Taylor's University",
    prompt: `Golden-hour photograph of a lush Malaysian university campus: red-brick colonial buildings, tropical palms, a hospitality terrace set with white linen and empty ceramic plates (no logos). Monsoon light, humid air, National Geographic. Palette: palm green, brick red, gold hour. Not a studio, not a paper leaf, not a tablet. ${FRAME}`,
  },
];

async function generate(card, key) {
  const res = await fetch(`${PROXY}/v1/images/generations`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      prompt: card.prompt,
      n: 1,
      response_format: "b64_json",
      aspect_ratio: "3:2",
    }),
  });
  if (!res.ok) {
    throw new Error(`${card.n}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`); // prettier-ignore
  }
  const body = await res.json();
  const item = body?.data?.[0];
  if (!item?.b64_json) throw new Error(`${card.n}: no image in response`);
  const file = path.join(OUT, `card-${card.n}.jpg`);
  await writeFile(file, Buffer.from(item.b64_json, "base64"));
  return file;
}

const only = process.argv.slice(2);
const wanted = only.length ? CARDS.filter((c) => only.includes(c.n)) : CARDS;

const key = (await readFile(KEY_FILE, "utf8")).trim();
await mkdir(OUT, { recursive: true });

for (const card of wanted) {
  try {
    const file = await generate(card, key);
    console.log(`${card.n} ${card.name} -> ${path.basename(file)}`);
  } catch (err) {
    console.error(`${card.n} ${card.name} FAILED: ${err.message}`);
  }
}

// 카드 아트 아홉 장을 생성한다. 로컬 grok 프록시(OpenAI 호환)의
// /v1/images/generations 로 붙는다.
//
//   node scripts/generate-cards.mjs           # 아홉 장 전부
//   node scripts/generate-cards.mjs 02 07     # 지정한 것만 다시
//
// 결과는 scripts/cards-src/card-NN.jpg 로 떨어지고, 웹으로 넘기는 것은
// convert-cards.mjs 가 맡는다 (768x512 webp).
//
// 왜 이렇게 생겼는지 — 아홉 장이 한 사람의 작업으로 읽혀야 한다. 그 전 세트는
// 다크 3D 파티클 렌더와 납작한 일러스트와 광택 폰 목업이 섞여 있어서, 아홉 개의
// 프로젝트가 아니라 아홉 군데서 주워 온 스톡 이미지처럼 보였다. 그래서 재질과
// 조명을 하나로 고정한다: 컷 페이퍼 정물, 같은 부드러운 자연광, 세 가지 톤.
//
// 대신 바탕은 셋으로 돌린다. 페이지가 #fafafa 라 크림 바탕으로만 아홉 장을
// 채우면 링이 배경에 녹아 버린다. 크림·블랙·러스트를 세 장씩, 링에서 이웃한
// 카드끼리는 절대 같은 바탕이 오지 않게 배치했다 (아래 GROUNDS 순서).
//
// 형태는 프로젝트마다 실루엣이 겹치지 않게 골랐다. 쌓임 / 구멍 뚫린 판 / 원 /
// 부채꼴 / 삼면 / 격자 / 지그재그 / 방사 / 잎 — 90px 로 줄여 놔도 아홉 개가
// 서로 구분된다.

import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

const PROXY = process.env.GROK_PROXY_URL || "http://127.0.0.1:8300";
const MODEL = process.env.GROK_IMAGE_MODEL || "grok-imagine-image-quality";
const KEY_FILE =
  process.env.GROK_PROXY_KEY_FILE ||
  path.join(process.env.USERPROFILE || process.env.HOME || "", "grok-proxy", "proxy-api-key.txt"); // prettier-ignore

const OUT = path.resolve(import.meta.dirname, "cards-src");

// 세 톤. 프롬프트에 그대로 박히는 문자열이라 카드마다 흔들리지 않는다.
const CREAM = "warm off-white paper (#f7f4ee)";
const BLACK = "matte near-black paper (#0e0e0e)";
const RUST = "terracotta rust paper (#a2542f)";

const ground = (bg, forms) =>
  `The whole frame is a seamless surface of ${bg}. The subject sits on it and is cut from ${forms}.`;

// 재질·조명·구도. 카드마다 바뀌는 것은 subject 와 바탕 조합뿐이다.
const STYLE = `Editorial still-life photograph seen straight down, flat lay. Everything in frame is made of matte cut and folded paper — clean modern paper stock, never aged, no yellowing, no stains, no crumpling. Soft diffuse north daylight from the upper left, gentle contact shadows under every lifted edge, fine paper grain, shallow depth of field. The palette is strictly three tones and nothing else: ${CREAM}, ${BLACK}, ${RUST}. The form is large, occupying roughly two thirds of the frame, so it stays legible shrunk to a thumbnail, with calm empty ground around it. Quiet, confident, expensive art direction. Absolutely no text, no letters, no numbers, no logos, no screens or user interfaces, no people, no hands.`;

const CARDS = [
  {
    n: "01",
    name: "메가스터디교육",
    // 대형 웹서비스를 여러 면에서 계속 만들고 고치는 일. 분량과, 그중 지금
    // 손대고 있는 한 장.
    subject: `A tall stack of many identical rectangular paper sheets, edges crisp and slightly fanned so every individual sheet reads, ${ground(CREAM, `${CREAM} with one single sheet of ${RUST} slipped in near the top and pulled out a few centimetres, and a thin ${BLACK} sheet at the very base`)}`,
  },
  {
    n: "02",
    name: "AI 퍼블리싱 자동화",
    // 한 사람의 규칙을 기계가 재현한다: 형판 하나와, 거기서 찍혀 나온 동일한
    // 결과물들.
    // 형태는 반드시 둥근 사각형. 뾰족하거나 길쭉하게 두면 탄두처럼 찍혀 나온다.
    subject: `A single flat paper stencil sheet with one clean rounded-square hole punched out of its centre, and beside it a precise evenly spaced row of five identical rounded-square paper chips already punched free and lying flat. Every shape is a plain rounded square, never pointed, never elongated, never tapered. ${ground(BLACK, `${CREAM}, with the first chip in the row being ${RUST}`)}`,
  },
  {
    n: "03",
    name: "roomy.page",
    // 이 사이트 자체 — 카드가 둥글게 서서 도는 링.
    subject: `Nine identical small paper cards standing upright on their long edges in one precise even circle, exactly equally spaced, every card leaning outward by the same angle, the ring geometrically regular with a clean empty centre and shadows radiating inward. ${ground(CREAM, `${CREAM}, with one card in ${RUST} and one in ${BLACK}`)}`,
  },
  {
    n: "04",
    name: "버킷스토어",
    // 패션 커머스. 원단 스와치 다발처럼 펼쳐진 종이.
    // 낱장이 흩어지면 그냥 어질러진 사진이 된다. 한 점에서 고르게 펴진
    // 부채꼴 하나, 떨어져 나온 조각 없이.
    subject: `A clean even fan of identical paper swatch cards spread in one wide arc from a single small paper eyelet at the lower corner, every card the same size and the spacing perfectly regular, nothing loose or scattered. ${ground(RUST, `${CREAM} and ${BLACK} alternating, with one ${RUST} swatch at the centre of the arc`)}`,
  },
  {
    n: "05",
    name: "롯데백화점 앱",
    // 큰 앱의 여러 화면을 하나의 규격으로 관통시키는 일.
    subject: `Three identical tall paper panels standing upright side by side, evenly spaced, with one continuous ribbon of paper running horizontally across all three and bridging the gaps between them. ${ground(BLACK, `${CREAM}, with the continuous ribbon in ${RUST}`)}`,
  },
  {
    n: "06",
    name: "공통 템플릿 시스템",
    // 반복 요소를 같은 규격의 모듈로. 같은 자리에서 서로 바꿔 끼울 수 있다.
    subject: `A four by three grid of large identical square paper tiles laid flat with generous even gaps, filling most of the frame, and two of the tiles lifted several centimetres above their now empty slots, casting soft shadows down into the holes they left. Few, large tiles — never a fine mosaic. ${ground(RUST, `${CREAM}, with the two lifted tiles in ${BLACK}`)}`,
  },
  {
    n: "07",
    name: "차병원 뉴스룸",
    // 반응형 — 같은 내용이 넓은 쪽에서 좁은 쪽으로 접혀 들어간다.
    subject: `A single sheet folded into a crisp accordion standing on edge, running straight across the frame and seen from directly above so the folds read as a bold clean chevron pattern, tightly compressed into narrow pleats at the left and opening progressively into wide calm folds at the right. ${ground(CREAM, `${CREAM}, with the inner faces of the folds in ${RUST} and one ${BLACK} fold at the compressed end`)}`,
  },
  {
    n: "08",
    name: "하마그룹",
    // 공통 컴포넌트와 다국어 — 하나의 중심에서 같은 조각이 방사한다.
    subject: `A radial rosette of identical paper petals fanning out evenly from a single small centre disc, like a paper pinwheel pressed flat, each petal slightly overlapping the next. ${ground(BLACK, `${CREAM}, with every third petal in ${RUST} and the centre disc in ${RUST}`)}`,
  },
  {
    n: "09",
    name: "Taylor's University",
    // 말레이시아에서 보낸 학부 시절. 관광 엽서가 아니라 재질로 말한다.
    subject: `One large tropical monstera leaf cut from a single sheet of paper, its split fronds crisp and slightly curled off the surface, casting a long soft shadow. ${ground(RUST, `${CREAM}, with the leaf's central vein cut as a narrow ${BLACK} line`)}`,
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
      prompt: `${STYLE}\n\nThe subject: ${card.subject}`,
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

// 순차로 돈다. 프록시 하나에 아홉 장을 동시에 던져 봐야 빨라지지 않고,
// 실패한 장이 어느 것인지 흐려진다.
for (const card of wanted) {
  try {
    const file = await generate(card, key);
    console.log(`${card.n} ${card.name} -> ${path.basename(file)}`);
  } catch (err) {
    console.error(`${card.n} ${card.name} FAILED: ${err.message}`);
  }
}

// generate-cards.mjs 가 만든 카드 원본을 아틀라스 셀(512x341)에 맞는 크기의 webp로 변환한다.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";

// generate-cards.mjs 가 떨어뜨린 원본. 이 기계 밖에서도 도는 상대 경로다.
const src = path.resolve(import.meta.dirname, "cards-src");
// public/ 이 아니라 컴포넌트 옆. projects.js 가 import 하면 Next 가 내용 해시를
// 붙여 _next/static/media 로 내보내고, 그림이 바뀌면 URL 이 같이 바뀐다.
// public/ 에 고정 이름으로 두었을 때는 그림을 갈아 끼워도 캐시가 옛것을 계속
// 내줬다 (max-age=86400 + 존의 브라우저 TTL).
const dst = path.resolve(import.meta.dirname, "../components/ring/cards");
mkdirSync(dst, { recursive: true });

for (let i = 1; i <= 9; i++) {
  const n = String(i).padStart(2, "0");
  await sharp(path.join(src, `card-${n}.jpg`))
    .resize(768, 512, { fit: "cover" })
    .webp({ quality: 82 })
    .toFile(path.join(dst, `${n}.webp`));
  console.log(`${n}.webp done`);
}

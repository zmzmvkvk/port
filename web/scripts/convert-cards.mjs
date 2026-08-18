// generate-cards.mjs 가 만든 카드 원본을 아틀라스 셀(512x341)에 맞는 크기의 webp로 변환한다.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";

// generate-cards.mjs 가 떨어뜨린 원본. 이 기계 밖에서도 도는 상대 경로다.
const src = path.resolve(import.meta.dirname, "cards-src");
const dst = path.resolve(import.meta.dirname, "../public");
mkdirSync(dst, { recursive: true });

for (let i = 1; i <= 9; i++) {
  const n = String(i).padStart(2, "0");
  await sharp(path.join(src, `card-${n}.jpg`))
    .resize(768, 512, { fit: "cover" })
    .webp({ quality: 82 })
    .toFile(path.join(dst, `${n}.webp`));
  console.log(`${n}.webp done`);
}

// 생성된 카드 PNG를 아틀라스 셀(512x341)에 맞는 크기의 webp로 변환한다.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";

const src = String.raw`C:\Users\zmzmv\.cursor\projects\c-Users-zmzmv-Desktop-workspace-port\assets`;
const dst = path.resolve(import.meta.dirname, "../public");
mkdirSync(dst, { recursive: true });

for (let i = 1; i <= 9; i++) {
  const n = String(i).padStart(2, "0");
  await sharp(path.join(src, `card-${n}.png`))
    .resize(768, 512, { fit: "cover" })
    .webp({ quality: 82 })
    .toFile(path.join(dst, `${n}.webp`));
  console.log(`${n}.webp done`);
}

# 사이트에 실제로 쓰이는 글자만 남긴 웹폰트를 만든다.
#
#   python scripts/subset-fonts.py
#
# 필요한 것: pip install fonttools brotli
# 원본: scripts/fonts-src/Freesentation-{4Regular,5Medium}.ttf (OFL 1.1)
# 결과: app/fonts/Freesentation-{Regular,Medium}.woff2
#
# 왜 서브셋을 뜨는가 — 한글 폰트는 완성형 음절이 11,172자라 원본이 2.5MB다.
# 두 굵기면 5MB, 사이트 전체(이미지 아홉 장 136KB)의 서른 배가 넘고, 엔트리
# 타임라인이 document.fonts.ready 를 기다리기 때문에 첫 화면이 그만큼 늦는다.
# 실제로 등장하는 글자만 남기면 굵기당 50KB 남짓이다.
#
# 글자 목록은 소스에서 직접 긁는다. 카피를 고치면 여기를 다시 돌려야 하고,
# 잊으면 없는 글자가 시스템 폰트로 떨어진다 — 깨지지는 않지만 티가 난다.
# SOURCES 에 한글이 들어갈 수 있는 파일을 모두 넣어 두는 이유다.

import os
import sys

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(HERE)
SRC = os.path.join(HERE, "fonts-src")
DST = os.path.join(WEB, "app", "fonts")

# 화면에 나갈 수 있는 문자열이 들어 있는 파일. 주석까지 통째로 긁으므로 실제
# 필요분의 상위집합이 되고, 그래서 빠뜨리는 쪽으로는 틀리지 않는다.
SOURCES = [
    "components/ring/projects.js",
    "components/ring/params.js",
    "components/DetailPanel.jsx",
    "components/Carousel.jsx",
    "app/layout.js",
]

# 본문에 아직 없더라도 들고 가는 것들. 숫자·영문·구두점은 연도나 프로젝트가
# 하나만 늘어도 바로 필요해진다.
ALWAYS = set(chr(c) for c in range(0x20, 0x7F)) | set(
    "—–·…‘’“”₩°※→←↔「」『』〈〉《》"
)

FACES = [
    ("Freesentation-4Regular.ttf", "Freesentation-Regular.woff2"),
    ("Freesentation-5Medium.ttf", "Freesentation-Medium.woff2"),
]


def charset():
    chars = set(ALWAYS)
    for rel in SOURCES:
        path = os.path.join(WEB, rel)
        with open(path, encoding="utf-8") as f:
            chars |= set(f.read())
    # 제어문자는 글리프가 없다.
    return {c for c in chars if c.isprintable()}


def main():
    chars = charset()
    os.makedirs(DST, exist_ok=True)
    text = "".join(sorted(chars))
    print(f"{len(chars)} characters")

    for src_name, out_name in FACES:
        src = os.path.join(SRC, src_name)
        if not os.path.exists(src):
            sys.exit(f"missing {src} — see scripts/fonts-src/README.md")
        font = TTFont(src)
        options = Options()
        options.flavor = "woff2"
        options.desubroutinize = True
        options.layout_features = ["*"]
        # 라이선스·저작자 정보를 남긴다. OFL 은 고지를 요구하고, 서브셋을 뜨면
        # name 테이블이 통째로 날아가는 것이 기본값이다.
        options.name_IDs = ["*"]
        options.name_legacy = True
        options.name_languages = ["*"]
        subsetter = Subsetter(options=options)
        subsetter.populate(text=text)
        subsetter.subset(font)
        out = os.path.join(DST, out_name)
        font.save(out)
        font.close()
        print(f"{out_name}  {os.path.getsize(out) / 1024:.1f} KB")


if __name__ == "__main__":
    main()

# Freesentation — 원본

`subset-fonts.py` 가 여기 있는 TTF에서 서브셋을 떠 `app/fonts/*.woff2` 를 만든다.
사이트가 싣는 것은 그 woff2 뿐이고, 이 원본은 카피가 바뀌어 서브셋을 다시 떠야
할 때 필요해서 같이 둔다.

- 서체: Freesentation 2.001, PT&
- 라이선스: SIL Open Font License 1.1 — https://scripts.sil.org/OFL
- 원 출처: https://www.designptn.com

OFL 은 재배포와 상업적 사용을 모두 허용하고, 고지를 남길 것과 폰트 자체를
단독으로 판매하지 말 것을 요구한다. 서브셋에도 name 테이블의 저작권·라이선스
항목을 그대로 남기도록 `subset-fonts.py` 에서 `name_IDs=["*"]` 를 준다.

Freesentation 은 Roboto(Christian Robertson)의 라틴과 Noto Sans CJK(Source Han
Sans)의 한글을 바탕으로 PT&(이주임)가 다시 그린 서체다.

import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://roomy.page"),
  title: "김서준 — 프론트엔드 · 웹 퍼블리싱",
  description:
    "반복되는 웹 운영을 페이지가 아니라 규칙·모듈·가이드로 바꿔 온 프론트엔드. 사실과 주장을 나눠 적은 작업들.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "profile",
    title: "김서준 — 프론트엔드 · 웹 퍼블리싱",
    description: "반복되는 웹 운영을 규칙·모듈·가이드로 바꿔 온 작업들.",
    url: "https://roomy.page/",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="min-h-full flex flex-col">
        {/* JavaScript 가 없으면 캔버스는 영원히 비어 있다. 그때는 링을 치우고
            문서 사본의 클립만 풀어 준다 — 같은 마크업 한 벌로 두 경우를 다
            감당한다. noscript 안의 스타일은 스크립트가 켜져 있으면 파싱조차
            되지 않으므로 깜빡임이 없다. */}
        <noscript>
          <style>{`[data-ring]{display:none}.readable-copy{position:static;width:auto;height:auto;margin:0 auto;padding:4rem 1.5rem;overflow:visible;clip-path:none;white-space:normal}`}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}

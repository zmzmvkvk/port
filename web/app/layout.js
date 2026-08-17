import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://roomy.page"),
  title: "김서준 — 프론트엔드 · 웹 퍼블리싱",
  description:
    "반복되는 웹 운영 작업을 규칙과 공통 모듈로 정리해 온 프론트엔드·웹 퍼블리싱 경력. WebGL 카드 캐러셀로 정리한 포트폴리오.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "profile",
    title: "김서준 — 프론트엔드 · 웹 퍼블리싱",
    description:
      "반복되는 웹 운영 작업을 규칙과 공통 모듈로 정리해 온 경력 포트폴리오.",
    url: "https://roomy.page/",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

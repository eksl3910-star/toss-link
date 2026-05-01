import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "토스 링크 교환",
  description: "토스 링크를 서로 교환해요",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const antiInspectScript = `
    (() => {
      const REDIRECT_URL = "https://www.naver.com";
      const REDIRECT_COOLDOWN_MS = 3000;
      let lastRedirectAt = 0;
      let overlayShown = false;

      const ensureOverlay = () => {
        if (overlayShown) return;
        overlayShown = true;
        document.documentElement.style.overflow = "hidden";
        document.body.style.filter = "blur(6px)";
        const overlay = document.createElement("div");
        overlay.id = "als-devtools-overlay";
        overlay.style.position = "fixed";
        overlay.style.inset = "0";
        overlay.style.zIndex = "2147483647";
        overlay.style.background = "rgba(0,0,0,0.72)";
        overlay.style.color = "#fff";
        overlay.style.display = "flex";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";
        overlay.style.textAlign = "center";
        overlay.style.padding = "24px";
        overlay.style.fontSize = "16px";
        overlay.style.lineHeight = "1.5";
        overlay.textContent = "보안 정책에 의해 페이지를 종료합니다.";
        document.body.appendChild(overlay);
      };

      const handleDetect = () => {
        ensureOverlay();
        const now = Date.now();
        if (now - lastRedirectAt < REDIRECT_COOLDOWN_MS) return;
        lastRedirectAt = now;
        location.replace(REDIRECT_URL);
      };

      document.addEventListener("contextmenu", (e) => e.preventDefault());
      document.addEventListener("dragstart", (e) => e.preventDefault());
      document.addEventListener("selectstart", (e) => e.preventDefault());
      document.addEventListener("keydown", (e) => {
        const key = e.key.toLowerCase();
        const blocked =
          key === "f12" ||
          ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === "i" || key === "j" || key === "c")) ||
          ((e.ctrlKey || e.metaKey) && key === "u");
        if (blocked) {
          e.preventDefault();
          handleDetect();
        }
      });

      const threshold = 160;
      setInterval(() => {
        const widthGap = window.outerWidth - window.innerWidth;
        const heightGap = window.outerHeight - window.innerHeight;
        if (widthGap > threshold || heightGap > threshold) {
          handleDetect();
        }
      }, 1200);
    })();
  `;

  return (
    <html lang="ko" className="h-full">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
          rel="stylesheet"
        />
      </head>
      <body
        className="min-h-full flex flex-col antialiased"
        style={{ fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
      >
        <script dangerouslySetInnerHTML={{ __html: antiInspectScript }} />
        <span style={{ display: "none" }}>Created by Daniel (eksl3910)</span>
        {children}
      </body>
    </html>
  );
}

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
      const REDIRECT_RETRY_MS = 900;
      const REDIRECT_COOLDOWN_MS = 3000;
      let isLocked = false;
      let lastRedirectAt = 0;

      const blockBasicActions = () => {
        const prevent = (e) => e.preventDefault();
        document.addEventListener("contextmenu", prevent);
        document.addEventListener("dragstart", prevent);
        document.addEventListener("selectstart", prevent);
      };

      const tryRedirect = () => {
        const now = Date.now();
        if (now - lastRedirectAt < REDIRECT_COOLDOWN_MS) return;
        lastRedirectAt = now;
        window.location.replace(REDIRECT_URL);
      };

      const hardBlock = () => {
        isLocked = true;
        document.documentElement.classList.add("als-devtools-open");
        try {
          if (!document.getElementById("als-devtools-shield")) {
            const shield = document.createElement("div");
            shield.id = "als-devtools-shield";
            shield.setAttribute("role", "presentation");
            shield.textContent = "보안 정책에 의해 페이지를 종료합니다.";
            document.documentElement.appendChild(shield);
          }
        } catch (_) {}
        try {
          if (document.body) {
            document.body.innerHTML = "";
            document.body.style.display = "none";
          }
        } catch (_) {}
        tryRedirect();
      };

      const triggerLock = () => {
        if (!isLocked) hardBlock();
      };

      const isBlockedDevToolsShortcut = (e) => {
        const key = (e.key || "").toLowerCase();
        const code = e.code || "";
        const winLinux =
          key === "f12" ||
          code === "F12" ||
          (e.ctrlKey &&
            e.shiftKey &&
            (["i", "j", "c", "k"].includes(key) ||
              ["KeyI", "KeyJ", "KeyC", "KeyK"].includes(code))) ||
          (e.ctrlKey &&
            (["u", "s", "p"].includes(key) ||
              ["KeyU", "KeyS", "KeyP"].includes(code)));
        const mac =
          e.metaKey &&
          e.altKey &&
          (["i", "j", "c", "u"].includes(key) ||
            ["KeyI", "KeyJ", "KeyC", "KeyU"].includes(code));
        return winLinux || mac;
      };

      document.addEventListener(
        "keydown",
        (e) => {
          const blocked = isBlockedDevToolsShortcut(e);
          if (blocked || isLocked) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
          }
          if (blocked) triggerLock();
        },
        true
      );

      blockBasicActions();
      setInterval(() => {
        if (isLocked && window.location.href !== REDIRECT_URL) {
          tryRedirect();
        }
      }, REDIRECT_RETRY_MS);
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
        <span
          aria-hidden="true"
          className="pointer-events-none fixed -left-[9999px] -top-[9999px] opacity-0 select-none"
        >
          Created by Daniel (eksl3910)
        </span>
        {children}
      </body>
    </html>
  );
}

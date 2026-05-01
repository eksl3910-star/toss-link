import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

// ── Path classifiers ──────────────────────────────────────────────────────────

function isProtectedUserRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/api/links/") ||
    pathname.startsWith("/api/auth/logout") ||
    pathname.startsWith("/api/auth/delete") ||
    pathname.startsWith("/api/auth/me")
  );
}

// ── Middleware ────────────────────────────────────────────────────────────────
//
// 참고: /admin·/api/admin/* 에 HTTP Basic Auth 를 걸면, 브라우저가 페이지 로드 후
// fetch() 로 API 를 호출할 때 Authorization 헤더를 붙이지 않는 경우가 많아
// 401 + WWW-Authenticate 가 반복되며 "무한 로그인 창"이 뜰 수 있습니다.
// 관리자 API는 이미 POST body 의 password(ADMIN_TOGGLE_PASS / ADMIN_BASIC_PASS)로 검증합니다.

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // Protected user routes → session cookie check
  if (isProtectedUserRoute(pathname)) {
    const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
    if (!hasSession) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
      }
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};

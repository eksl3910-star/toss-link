import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getOptionalRequestContext } from "@cloudflare/next-on-pages";
import { SESSION_COOKIE } from "@/lib/constants";
import { verifyAdminBasicAuthHeader } from "@/lib/admin-basic-auth";
import { getMaintenanceOnSafe } from "@/lib/database";

// ── Path classifiers ──────────────────────────────────────────────────────────

/** 점검 중에도 접근 허용 (관리·설정 조회). */
function isMaintenanceExempt(pathname: string): boolean {
  if (pathname === "/maintenance" || pathname.startsWith("/maintenance/")) return true;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true;
  if (pathname.startsWith("/api/admin")) return true;
  if (pathname === "/api/settings" || pathname.startsWith("/api/settings/")) return true;
  return false;
}

/** 관리자 화면(HTML)만 — /api/admin 은 제외(페이지 내 fetch 가 Authorization 을 유지하지 않음). */
function isAdminPagePath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isProtectedUserRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/api/links/") ||
    pathname.startsWith("/api/auth/logout") ||
    pathname.startsWith("/api/auth/delete") ||
    pathname.startsWith("/api/auth/me")
  );
}

function getAdminBasicCredentials(): { user: string; pass: string } {
  const ctx = getOptionalRequestContext();
  const env = ctx?.env as Record<string, unknown> | undefined;
  const envUser = typeof env?.ADMIN_BASIC_USER === "string" ? env.ADMIN_BASIC_USER : "";
  const envPass = typeof env?.ADMIN_BASIC_PASS === "string" ? env.ADMIN_BASIC_PASS : "";
  const user = envUser || process.env.ADMIN_BASIC_USER || "";
  const pass = envPass || process.env.ADMIN_BASIC_PASS || "";
  return { user, pass };
}

// ── Middleware ────────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  const maintenanceOn = await getMaintenanceOnSafe();

  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  if (
    (pathname === "/welcome" || pathname.startsWith("/welcome/")) &&
    hasSession
  ) {
    const homeUrl = req.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  if (maintenanceOn) {
    if (!isMaintenanceExempt(pathname)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "현재 점검 중입니다. 잠시 후 다시 시도해주세요." },
          { status: 503 }
        );
      }
      const maintenanceUrl = req.nextUrl.clone();
      maintenanceUrl.pathname = "/maintenance";
      maintenanceUrl.search = "";
      return NextResponse.redirect(maintenanceUrl);
    }
  } else {
    if (pathname === "/maintenance" || pathname.startsWith("/maintenance/")) {
      const homeUrl = req.nextUrl.clone();
      homeUrl.pathname = "/";
      homeUrl.search = "";
      return NextResponse.redirect(homeUrl);
    }
  }

  if (isAdminPagePath(pathname)) {
    const { user: basicUser, pass: basicPass } = getAdminBasicCredentials();
    const dev = process.env.NODE_ENV === "development";
    if (!basicUser || !basicPass) {
      if (!dev) {
        return new NextResponse(
          "ADMIN_BASIC_USER / ADMIN_BASIC_PASS 가 설정되지 않았습니다. Cloudflare 환경 변수를 확인하세요.",
          { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
        );
      }
      /* 로컬(next dev)에서 env 미설정 시 Basic 생략 — 프로덕션에서는 반드시 설정 */
    } else if (!verifyAdminBasicAuthHeader(req.headers.get("authorization"), basicUser, basicPass)) {
      return new NextResponse("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="ably-admin", charset="UTF-8"' },
      });
    }
  }

  if (isProtectedUserRoute(pathname)) {
    if (!hasSession) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
      }
      const welcomeUrl = req.nextUrl.clone();
      welcomeUrl.pathname = "/welcome";
      welcomeUrl.search = "";
      return NextResponse.redirect(welcomeUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon\\.ico).*)"],
};

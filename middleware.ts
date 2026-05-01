import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

// ── Path classifiers ──────────────────────────────────────────────────────────

function isAdminRoute(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/")
  );
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

// ── Basic Auth guard for admin routes ─────────────────────────────────────────

function requireBasicAuth(req: NextRequest): NextResponse | null {
  const user = process.env.ADMIN_BASIC_USER ?? "";
  const pass = process.env.ADMIN_BASIC_PASS ?? "";

  if (!user || !pass) {
    return new NextResponse("Forbidden — admin credentials not configured.", {
      status: 403,
    });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Basic ")) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Admin Area"' },
    });
  }

  try {
    const decoded = atob(authHeader.slice("Basic ".length));
    const colon = decoded.indexOf(":");
    if (colon < 0) throw new Error("malformed");
    const u = decoded.slice(0, colon);
    const p = decoded.slice(colon + 1);
    if (u !== user || p !== pass) throw new Error("wrong creds");
  } catch {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Admin Area"' },
    });
  }

  return null; // authorized
}

// ── Middleware ────────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // 1. Admin routes → HTTP Basic Auth
  if (isAdminRoute(pathname)) {
    const denied = requireBasicAuth(req);
    if (denied) return denied;
    return NextResponse.next();
  }

  // 2. Protected user routes → session cookie check
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

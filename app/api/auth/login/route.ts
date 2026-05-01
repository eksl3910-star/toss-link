import { NextResponse } from "next/server";
import { findUserByEmail, normalizeEmail } from "@/lib/database";
import { verifyKey } from "@/lib/password";
import { issueSession } from "@/lib/session";

export const runtime = "edge";

export async function POST(req: Request) {
  let body: { email?: unknown; password?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
  const password = typeof body.password === "string" ? body.password : "";

  const user = await findUserByEmail(email);
  if (!user) {
    return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const valid = await verifyKey(password, user.pwHash, user.pwSalt);
  if (!valid) {
    return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  await issueSession(user.id);
  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email } });
}

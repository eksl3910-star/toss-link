import { NextResponse } from "next/server";
import { findUserByEmail, insertUser, normalizeEmail } from "@/lib/database";
import { deriveKey } from "@/lib/password";
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

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "이메일 주소를 확인해주세요." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "비밀번호는 8자 이상이어야 합니다." }, { status: 400 });
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return NextResponse.json({ error: "이미 가입된 이메일입니다." }, { status: 409 });
  }

  const { hash, salt } = await deriveKey(password);
  const user = await insertUser(email, hash, salt);
  await issueSession(user.id);

  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email } });
}

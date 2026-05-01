import { NextResponse } from "next/server";
import { setMaintenance } from "@/lib/database";
import { timingSafeCompare } from "@/lib/password";
import { ADMIN_PASS_ENVS } from "@/lib/constants";

export const runtime = "edge";

function checkAdminPassword(input: string): boolean {
  for (const key of ADMIN_PASS_ENVS) {
    const expected = process.env[key] ?? "";
    if (expected && timingSafeCompare(input, expected)) return true;
  }
  return false;
}

export async function POST(req: Request) {
  let body: { password?: unknown; on?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!checkAdminPassword(password)) {
    return NextResponse.json({ error: "관리자 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  if (typeof body.on !== "boolean") {
    return NextResponse.json({ error: "on 값(boolean)이 필요합니다." }, { status: 400 });
  }

  const result = await setMaintenance(body.on);
  return NextResponse.json({ ok: true, maintenanceOn: result.maintenanceOn, touchedAt: result.touchedAt });
}

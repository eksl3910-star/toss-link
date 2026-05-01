import { NextResponse } from "next/server";
import { resolveUser } from "@/lib/session";
import { getSettings, acquireLink } from "@/lib/database";

export const runtime = "edge";

export async function POST() {
  const { maintenanceOn } = await getSettings();
  if (maintenanceOn) {
    return NextResponse.json({ error: "현재 점검 중입니다. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const user = await resolveUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const result = await acquireLink(user.id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason });
  }

  return NextResponse.json({
    ok: true,
    link: {
      id: result.link.id,
      url: result.link.url,
      deadline: result.link.deadline,
    },
  });
}

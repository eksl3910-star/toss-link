import { NextResponse } from "next/server";
import { getSettings } from "@/lib/database";

export const runtime = "edge";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json(
    { maintenanceOn: settings.maintenanceOn, touchedAt: settings.touchedAt },
    {
      headers: {
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=45",
      },
    }
  );
}

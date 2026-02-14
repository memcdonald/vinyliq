import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { probeAllSources } from "@/server/services/suggestions/probe";

export const dynamic = "force-dynamic";

/**
 * Cron endpoint: probe all data sources for all users.
 * Secured via CRON_SECRET header matching.
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all users
    const users = await db.select({ id: user.id }).from(user);

    const results: { userId: string; discovered: number }[] = [];

    for (const u of users) {
      try {
        const { totalDiscovered } = await probeAllSources(u.id);
        results.push({ userId: u.id, discovered: totalDiscovered });
      } catch {
        console.error(`Cron: failed to probe sources for user ${u.id}`);
        results.push({ userId: u.id, discovered: 0 });
      }
    }

    const totalDiscovered = results.reduce((s, r) => s + r.discovered, 0);

    return NextResponse.json({
      success: true,
      usersProcessed: results.length,
      totalDiscovered,
      results,
    });
  } catch (error) {
    console.error("Cron probe-sources failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

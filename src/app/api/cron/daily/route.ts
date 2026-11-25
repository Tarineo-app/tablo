import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { closeTrialIfOver, trialReport } from "@/lib/billing";
import { emailConfigured } from "@/lib/email";
import { sendNudgeTables, sendTrialReport, sendTrialSoon } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Tous les matins (planifié dans vercel.json) : on ferme les soirées test terminées
 * et on envoie les relances. Vercel signe l'appel avec CRON_SECRET ; sans ce secret, rien ne tourne.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const now = Date.now();
  const out = { closed: 0, reports: 0, nudges: 0, soon: 0 };

  // 1. Soirées test terminées : on referme, puis le bilan part une seule fois.
  for (const v of await db.venue.findMany({ where: { billing: "TRIAL", trialEventId: { not: null } }, select: { id: true } })) {
    if (await closeTrialIfOver(v.id)) out.closed++;
  }
  if (emailConfigured()) {
    const toReport = await db.venue.findMany({
      where: { billing: "LOCKED", trialEventId: { not: null }, trialClosedAt: { gte: new Date(now - 3 * 864e5) }, trialReportSentAt: null },
      select: { id: true, trialEventId: true },
    });
    for (const v of toReport) {
      // On note l'envoi avant d'envoyer : en cas de double appel, un seul bilan part.
      const claim = await db.venue.updateMany({ where: { id: v.id, trialReportSentAt: null }, data: { trialReportSentAt: new Date() } });
      if (claim.count && (await sendTrialReport(v.id, await trialReport(v.id, v.trialEventId!)))) out.reports++;
    }

    // 2. Inscrits hier, aucun carré posé.
    const fresh = await db.venue.findMany({
      where: { isDemo: false, createdAt: { gte: new Date(now - 2 * 864e5), lt: new Date(now - 864e5) }, tables: { none: {} } },
      select: { id: true },
    });
    for (const v of fresh) if (await sendNudgeTables(v.id)) out.nudges++;

    // 3. Soirée test dans deux jours.
    const soon = await db.venue.findMany({
      where: { billing: "TRIAL", trialEventId: { not: null } },
      select: { id: true, trialEventId: true },
    });
    const events = await db.event.findMany({
      where: { id: { in: soon.map((v) => v.trialEventId!) }, date: { gte: new Date(now + 36 * 3600e3), lt: new Date(now + 60 * 3600e3) } },
      select: { id: true },
    });
    const due = new Set(events.map((e) => e.id));
    for (const v of soon) if (due.has(v.trialEventId!) && (await sendTrialSoon(v.id))) out.soon++;
  }
  return NextResponse.json(out);
}

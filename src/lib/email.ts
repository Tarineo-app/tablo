import "server-only";

/**
 * Envoi d'emails par Resend (API HTTP, sans dépendance).
 * Sans RESEND_API_KEY, rien ne part et rien ne casse : on renvoie `false`
 * pour que l'appelant affiche un lien à copier à la place.
 */
export const emailConfigured = () => !!process.env.RESEND_API_KEY;

type Mail = { to: string; subject: string; html: string; text: string; replyTo?: string; idempotencyKey?: string };

export async function sendEmail(m: Mail): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !m.to) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(m.idempotencyKey ? { "Idempotency-Key": m.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Tablo <onboarding@resend.dev>",
        to: [m.to],
        subject: m.subject,
        html: m.html,
        text: m.text,
        ...(m.replyTo ? { reply_to: m.replyTo } : {}),
      }),
    });
    if (!res.ok) console.error("[email] refusé par Resend", res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } catch (e) {
    console.error("[email] envoi impossible", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Échappe le texte pour l'insérer dans du HTML. */
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Gabarit sobre, lisible dans toutes les messageries : un titre, des lignes, un bouton. */
export function layout(o: { venue: string; title: string; intro: string; lines?: [string, string][]; button?: { label: string; url: string }; foot?: string }) {
  const rows = (o.lines ?? [])
    .map(([k, v]) => `<tr><td style="padding:6px 0;color:#6b6876">${esc(k)}</td><td style="padding:6px 0;text-align:right;font-weight:700">${esc(v)}</td></tr>`)
    .join("");
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f3f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#15141a">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;padding:28px">
<tr><td style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#8a8796;font-weight:700">${esc(o.venue)}</td></tr>
<tr><td style="padding:10px 0 6px;font-size:24px;font-weight:800;line-height:1.2">${esc(o.title)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6;color:#3b3946">${esc(o.intro)}</td></tr>
${rows ? `<tr><td style="padding-top:16px"><table width="100%" style="font-size:14px;border-top:1px solid #eee">${rows}</table></td></tr>` : ""}
${o.button ? `<tr><td style="padding-top:22px"><a href="${esc(o.button.url)}" style="display:inline-block;background:#15141a;color:#fff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:999px">${esc(o.button.label)}</a></td></tr>` : ""}
${o.foot ? `<tr><td style="padding-top:22px;font-size:12px;line-height:1.5;color:#8a8796">${esc(o.foot)}</td></tr>` : ""}
</table>
<p style="font-size:11px;color:#9a98a6;margin-top:14px">Envoyé par Tablo pour ${esc(o.venue)}.</p>
</td></tr></table></body></html>`;
  const text = [o.venue, "", o.title, "", o.intro, "", ...(o.lines ?? []).map(([k, v]) => `${k} : ${v}`), o.button ? `\n${o.button.label} : ${o.button.url}` : "", o.foot ? `\n${o.foot}` : ""].join("\n");
  return { html, text };
}

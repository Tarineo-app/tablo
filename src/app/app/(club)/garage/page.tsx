import { deleteGarageItem, extendGarageItem, retrieveGarageItem, saveGarageSettings } from "@/app/actions/garage";
import ActionForm from "@/components/ActionForm";
import ConfirmButton from "@/components/ConfirmButton";
import { requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { now as maintenant } from "@/lib/dates";
import { GARAGE_STATUS } from "@/lib/garage";
import { isManagement } from "@/lib/roles";
import GarageForm from "./GarageForm";

export const metadata = { title: "Garage · Tablo" };

const jour = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" });

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; nom?: string; tel?: string; email?: string }> }) {
  const { q, nom, tel, email } = await searchParams;
  const { venue, membership } = await requireMembership();
  const manage = isManagement(membership.role);

  const [settings, bottles, items] = await Promise.all([
    db.venue.findUnique({ where: { id: venue.id }, select: { garageEnabled: true, garageMinBottles: true, garageDays: true, garageKeepsMin: true } }),
    db.bottle.findMany({ where: { venueId: venue.id, active: true }, include: { sizes: { orderBy: { priceCents: "asc" } } }, orderBy: { name: "asc" } }),
    db.garageItem.findMany({
      where: { venueId: venue.id, ...(q ? { OR: [{ ownerName: { contains: q, mode: "insensitive" } }, { ownerPhone: { contains: q } }, { ownerEmail: { contains: q, mode: "insensitive" } }, { code: { contains: q.toUpperCase() } }] } : {}) },
      include: { bottleSize: { include: { bottle: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 300,
    }),
  ]);

  const sizes = bottles.flatMap((b) => b.sizes.map((s) => ({ id: s.id, label: `${b.name} ${s.label} ${s.volume}` })));
  const now = maintenant().getTime();
  const stored = items.filter((i) => i.status === "STORED" && i.expiresAt.getTime() >= now);
  const late = items.filter((i) => i.status === "STORED" && i.expiresAt.getTime() < now);

  return (
    <>
      <header>
        <h1>Garage</h1>
        <p>Les bouteilles entamées que vous gardez pour la prochaine venue du client. Chacune a un code : le client le saisit dans le widget pour la reprendre, à condition d&apos;en racheter assez.</p>
      </header>

      <div className="grid3" style={{ marginBottom: 18 }}>
        <div className="card"><span className="mute">Bouteilles gardées</span><div style={{ font: "800 28px Unbounded", marginTop: 6 }}>{stored.length}</div></div>
        <div className="card"><span className="mute">Délai dépassé</span><div style={{ font: "800 28px Unbounded", marginTop: 6 }}>{late.length}</div></div>
        <div className="card"><span className="mute">Reprises</span><div style={{ font: "800 28px Unbounded", marginTop: 6 }}>{items.filter((i) => i.status === "RETRIEVED").length}</div></div>
      </div>

      {manage && (
        <section className="card" style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 17, marginBottom: 6 }}>Comment marche votre garage</h2>
          <p className="mute" style={{ marginTop: 0, marginBottom: 14, fontSize: 14 }}>Tant que le garage est éteint, rien n&apos;apparaît dans le widget.</p>
          <ActionForm action={saveGarageSettings} submit="Enregistrer">
            <label className="row" style={{ gap: 8, fontSize: 14 }}><input type="checkbox" name="garageEnabled" defaultChecked={settings?.garageEnabled} /> Proposer le garage dans le widget</label>
            <div className="grid2">
              <label className="field">Bouteilles à racheter pour la reprendre<input className="input" name="garageMinBottles" inputMode="numeric" defaultValue={settings?.garageMinBottles ?? 1} /></label>
              <label className="field">Durée de conservation (jours)<input className="input" name="garageDays" inputMode="numeric" defaultValue={settings?.garageDays ?? 60} /></label>
            </div>
            <label className="row" style={{ gap: 8, fontSize: 14 }}><input type="checkbox" name="garageKeepsMin" defaultChecked={settings?.garageKeepsMin} /> Le minimum du carré s&apos;applique quand même (sinon il est remplacé par le nombre de bouteilles ci-dessus)</label>
          </ActionForm>
        </section>
      )}

      <section className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 17, marginBottom: 14 }}>Mettre une bouteille au garage</h2>
        {sizes.length === 0 ? <p className="mute">Ajoutez d&apos;abord des bouteilles à votre carte.</p> : <GarageForm sizes={sizes} prefill={{ name: nom, email, phone: tel }} />}
      </section>

      <form className="card row" style={{ marginBottom: 16, gap: 10 }}>
        <input className="input" name="q" defaultValue={q ?? ""} placeholder="Chercher un nom, un téléphone, un code" style={{ flex: 1, minWidth: 200 }} />
        <button className="btn btn-out">Chercher</button>
      </form>

      <section className="card" style={{ overflowX: "auto" }}>
        <table className="list">
          <thead><tr><th>Code</th><th>Client</th><th>Bouteille</th><th>À reprendre avant</th><th>État</th><th /></tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={6} className="mute">{q ? "Rien ne correspond à cette recherche." : "Aucune bouteille au garage."}</td></tr>}
            {items.map((i) => {
              const dépassé = i.status === "STORED" && i.expiresAt.getTime() < now;
              return (
                <tr key={i.id}>
                  <td style={{ fontFamily: "monospace", fontWeight: 700 }}>{i.code}</td>
                  <td>{i.ownerName}<div className="mute" style={{ fontSize: 12 }}>{i.ownerPhone || i.ownerEmail || "—"}</div></td>
                  <td>{i.quantity > 1 ? `${i.quantity} × ` : ""}{i.bottleSize.bottle.name} {i.bottleSize.label}{i.flavor ? ` · ${i.flavor}` : ""}
                    {i.note && <div className="mute" style={{ fontSize: 12 }}>{i.note}</div>}</td>
                  <td className={dépassé ? "err" : undefined}>{jour(i.expiresAt)}</td>
                  <td><span className="tag soft">{dépassé ? "Délai dépassé" : GARAGE_STATUS[i.status]}</span></td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <ConfirmButton className="btn btn-out" label={i.status === "RETRIEVED" ? "Remettre au garage" : "Reprise"} run={retrieveGarageItem.bind(null, i.id)} />
                      {manage && dépassé && <ConfirmButton className="btn btn-out" label="Prolonger" run={extendGarageItem.bind(null, i.id)} />}
                      {manage && <ConfirmButton label="Supprimer" confirm={`Supprimer la bouteille de ${i.ownerName} ?`} run={deleteGarageItem.bind(null, i.id)} />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}

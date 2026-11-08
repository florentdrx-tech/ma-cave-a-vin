import { useState } from 'react';
import { Link } from 'react-router-dom';
import { db, drinkStatus, drinkWindow, STATUS_LABEL, type Wine } from '../db';
import { DECANT_LABEL, DISHES, decantSentence, effectiveAdvice, fmtDuration, serveSentence, type Advice, type Decant } from '../advice';
import { aiAdvice, getApiKey } from '../labelScan';
import { Modal } from './ui';

export default function AdviceCard({ wine }: { wine: Wine }) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const a = effectiveAdvice(wine);
  const win = drinkWindow(wine);
  const status = drinkStatus(wine);
  const year = new Date().getFullYear();
  const hasKey = !!getApiKey();

  async function askAi() {
    setLoading(true);
    setError(undefined);
    try {
      const r = await aiAdvice(wine);
      await db.wines.update(wine.id!, {
        advice: r.advice,
        drinkFrom: wine.drinkFrom ?? r.drinkFrom,
        drinkUntil: wine.drinkUntil ?? r.drinkUntil,
        updatedAt: Date.now(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card advice">
      <div className="row between">
        <h2>Conseils de service</h2>
        <span className={`badge ${a.isAuto ? 'badge-auto' : 'badge-ia'}`}>
          {a.isAuto ? 'Estimation' : a.source === 'ia' ? '✨ IA' : 'Vos conseils'}
        </span>
      </div>

      <div className="advice-row">
        <span className="advice-ico" aria-hidden>🕰️</span>
        <div className="grow">
          <b>Quand le boire</b>
          {win.from || win.until ? (
            <>
              <span>
                {win.from && win.until ? `De ${win.from} à ${win.until}` : win.from ? `À partir de ${win.from}` : `Jusqu'en ${win.until}`}
                {' · '}<span className={`status-${status}`}>{STATUS_LABEL[status]}</span>
              </span>
              <Timeline from={win.from ?? wine.vintage ?? year} until={win.until ?? (win.from ?? year) + 5} vintage={wine.vintage} status={status} />
              {win.estimated && <small className="muted">Estimation selon l'appellation et le millésime.</small>}
            </>
          ) : (
            <span className="muted">Indiquez le millésime pour obtenir une estimation.</span>
          )}
        </div>
      </div>

      <div className="advice-row">
        <span className="advice-ico" aria-hidden>🌡️</span>
        <div className="grow">
          <b>Température de service</b>
          <span>{serveSentence(a.serveMin, a.serveMax)}</span>
        </div>
      </div>

      <div className="advice-row">
        <span className="advice-ico" aria-hidden>🫗</span>
        <div className="grow">
          <b>Carafe</b>
          <span>{decantSentence(a.decant, a.aeration)}</span>
        </div>
      </div>

      <div className="advice-row">
        <span className="advice-ico" aria-hidden>🍽️</span>
        <div className="grow">
          <b>Accords mets-vin</b>
          <span>{a.pairings}</span>
          {a.dishes.length > 0 && (
            <div className="chips small-chips">
              {a.dishes.map((id) => {
                const d = DISHES.find((x) => x.id === id)!;
                return <Link key={id} className="chip" to={`/vins?plat=${id}`}>{d.emoji} {d.label}</Link>;
              })}
            </div>
          )}
        </div>
      </div>

      <div className="advice-row">
        <span className="advice-ico" aria-hidden>📝</span>
        <div className="grow">
          <b>Description</b>
          <span className="pre">{a.description}</span>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      <div className="actions wrap">
        {hasKey ? (
          <button className="btn primary" disabled={loading} onClick={askAi}>
            {loading ? <><span className="spinner light" /> L'IA réfléchit…</> : a.source === 'ia' ? '✨ Redemander à l\'IA' : '✨ Conseils personnalisés (IA)'}
          </button>
        ) : (
          <small className="muted">
            Conseils estimés selon l'appellation et l'âge du vin. Pour des conseils propres à cette cuvée, activez l'IA dans{' '}
            <Link to="/reglages">⚙️ Réglages</Link>.
          </small>
        )}
        <button className="btn ghost" onClick={() => setEditing(true)}>✏️ Modifier</button>
      </div>

      {editing && <AdviceEditor wine={wine} onClose={() => setEditing(false)} />}
    </section>
  );
}

function Timeline({ from, until, vintage, status }: { from: number; until: number; vintage?: number; status: string }) {
  const year = new Date().getFullYear();
  const start = Math.min(vintage ?? from, from, year);
  const end = Math.max(until, year) + 1;
  const pct = (y: number) => ((y - start) / (end - start)) * 100;
  return (
    <div className="timeline">
      <div className={`window ${status}`} style={{ left: `${pct(from)}%`, width: `${pct(until + 1) - pct(from)}%` }} />
      <div className="now" style={{ left: `${pct(year + 0.5)}%` }} title="Aujourd'hui" />
      <span className="tl-label" style={{ left: `${pct(from)}%` }}>{from}</span>
      <span className="tl-label" style={{ left: `${pct(until + 1)}%` }}>{until}</span>
    </div>
  );
}

const AERATIONS = [15, 30, 45, 60, 90, 120, 180, 240];
const num = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(',', '.')));

function AdviceEditor({ wine, onClose }: { wine: Wine; onClose: () => void }) {
  const eff = effectiveAdvice(wine);
  const [v, setV] = useState<Advice>({
    description: wine.advice?.description ?? '',
    pairings: wine.advice?.pairings ?? '',
    serveMin: wine.advice?.serveMin,
    serveMax: wine.advice?.serveMax,
    decant: wine.advice?.decant,
    aeration: wine.advice?.aeration,
  });
  const [from, setFrom] = useState(wine.drinkFrom);
  const [until, setUntil] = useState(wine.drinkUntil);
  const win = drinkWindow(wine);
  const decant = v.decant ?? eff.decant;

  async function save() {
    const advice: Advice = {
      description: v.description?.trim() || undefined,
      pairings: v.pairings?.trim() || undefined,
      serveMin: v.serveMin,
      serveMax: v.serveMax,
      decant: v.decant,
      aeration: decant === 'ouvrir' || decant === 'carafer' ? v.aeration ?? eff.aeration : undefined,
      source: 'manuel',
    };
    const empty = !advice.description && !advice.pairings && advice.serveMin === undefined && advice.serveMax === undefined && !advice.decant;
    await db.wines.update(wine.id!, { advice: empty ? undefined : advice, drinkFrom: from, drinkUntil: until, updatedAt: Date.now() });
    onClose();
  }

  async function reset() {
    await db.wines.update(wine.id!, { advice: undefined, updatedAt: Date.now() });
    onClose();
  }

  return (
    <Modal title="Conseils de service" onClose={onClose}>
      <p className="muted small">Laissez un champ vide pour garder l'estimation affichée en gris.</p>
      <div className="grid2">
        <label className="field"><span>Boire à partir de</span>
          <input type="number" inputMode="numeric" value={from ?? ''} placeholder={win.from ? String(win.from) : 'Année'} onChange={(e) => setFrom(num(e.target.value))} />
        </label>
        <label className="field"><span>Jusqu'en</span>
          <input type="number" inputMode="numeric" value={until ?? ''} placeholder={win.until ? String(win.until) : 'Année'} onChange={(e) => setUntil(num(e.target.value))} />
        </label>
      </div>
      <div className="grid2">
        <label className="field"><span>Service min (°C)</span>
          <input inputMode="numeric" value={v.serveMin ?? ''} placeholder={String(eff.serveMin)} onChange={(e) => setV({ ...v, serveMin: num(e.target.value) })} />
        </label>
        <label className="field"><span>Service max (°C)</span>
          <input inputMode="numeric" value={v.serveMax ?? ''} placeholder={String(eff.serveMax)} onChange={(e) => setV({ ...v, serveMax: num(e.target.value) })} />
        </label>
      </div>
      <div className="grid2">
        <label className="field"><span>Carafe</span>
          <select value={decant} onChange={(e) => setV({ ...v, decant: e.target.value as Decant })}>
            {(Object.keys(DECANT_LABEL) as Decant[]).map((d) => <option key={d} value={d}>{DECANT_LABEL[d]}</option>)}
          </select>
        </label>
        {(decant === 'ouvrir' || decant === 'carafer') && (
          <label className="field"><span>Combien de temps avant</span>
            <select value={v.aeration ?? eff.aeration ?? 60} onChange={(e) => setV({ ...v, aeration: Number(e.target.value) })}>
              {AERATIONS.map((m) => <option key={m} value={m}>{fmtDuration(m)}</option>)}
            </select>
          </label>
        )}
      </div>
      <label className="field"><span>Accords mets-vin</span>
        <textarea rows={2} value={v.pairings} placeholder={eff.pairings} onChange={(e) => setV({ ...v, pairings: e.target.value })} />
      </label>
      <label className="field"><span>Description</span>
        <textarea rows={3} value={v.description} placeholder={eff.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
      </label>
      <div className="actions wrap">
        {wine.advice && <button className="btn ghost" onClick={reset}>Revenir à l'estimation</button>}
        <button className="btn ghost" onClick={onClose}>Annuler</button>
        <button className="btn primary" onClick={save}>Enregistrer</button>
      </div>
    </Modal>
  );
}

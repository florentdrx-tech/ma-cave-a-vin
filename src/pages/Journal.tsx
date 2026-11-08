import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, wineTitle } from '../db';
import { ColorDot, Empty, Stars, fmtDate } from '../components/ui';

export default function Journal() {
  const tastings = useLiveQuery(() => db.tastings.orderBy('date').reverse().toArray(), []);
  const outs = useLiveQuery(() => db.movements.where('date').above(0).filter((m) => m.type === 'out').reverse().sortBy('date'), []);
  const wines = useLiveQuery(() => db.wines.toArray(), []);
  const [tab, setTab] = useState<'notes' | 'sorties'>('notes');
  const wineById = useMemo(() => new Map(wines?.map((w) => [w.id!, w])), [wines]);

  if (!tastings || !outs || !wines) return null;

  const thisYear = new Date().getFullYear();
  const drunkThisYear = outs.filter((m) => new Date(m.date).getFullYear() === thisYear).reduce((s, m) => s + m.qty, 0);

  return (
    <div className="stack">
      <h1>Journal</h1>
      <p className="muted">{drunkThisYear} bouteille{drunkThisYear > 1 ? 's' : ''} sortie{drunkThisYear > 1 ? 's' : ''} en {thisYear}</p>
      <div className="chips">
        <button className={`chip ${tab === 'notes' ? 'on' : ''}`} onClick={() => setTab('notes')}>Dégustations ({tastings.length})</button>
        <button className={`chip ${tab === 'sorties' ? 'on' : ''}`} onClick={() => setTab('sorties')}>Sorties de cave ({outs.length})</button>
      </div>

      {tab === 'notes' &&
        (tastings.length === 0 ? (
          <Empty>Vos notes de dégustation s'afficheront ici. Ajoutez-en une en sortant une bouteille (🍷).</Empty>
        ) : (
          <ul className="list">
            {tastings.map((t) => {
              const w = wineById.get(t.wineId);
              return (
                <li key={t.id} className="tasting">
                  <Link to={w ? `/vin/${w.id}` : '#'} className="block">
                    <div className="row">
                      {w && <ColorDot color={w.color} />}
                      <b className="grow">{w ? `${wineTitle(w)} ${w.vintage ?? ''}` : 'Vin supprimé'}</b>
                      <small className="muted">{fmtDate(t.date)}</small>
                    </div>
                    {t.rating > 0 && <Stars value={t.rating} size={16} />}
                    {t.notes && <p className="pre">{t.notes}</p>}
                    {t.pairing && <p className="muted">🍽️ {t.pairing}</p>}
                  </Link>
                </li>
              );
            })}
          </ul>
        ))}

      {tab === 'sorties' &&
        (outs.length === 0 ? (
          <Empty>Aucune bouteille sortie pour l'instant.</Empty>
        ) : (
          <ul className="list">
            {outs.map((m) => {
              const w = wineById.get(m.wineId);
              return (
                <li key={m.id}>
                  <Link to={w ? `/vin/${w.id}` : '#'} className="row">
                    {w && <ColorDot color={w.color} />}
                    <span className="grow">
                      <b>{w ? `${wineTitle(w)} ${w.vintage ?? ''}` : 'Vin supprimé'}</b>
                      <small className="muted">{fmtDate(m.date)} · {m.note}</small>
                    </span>
                    <span className="qty">−{m.qty}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ))}
    </div>
  );
}

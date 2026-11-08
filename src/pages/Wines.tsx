import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { addBottles, COLORS, db, drinkStatus, STATUS_LABEL, wineTitle, type DrinkStatus, type Wine, type WineColor } from '../db';
import { ColorDot, Empty, StatusBadge } from '../components/ui';
import DrinkModal from '../components/DrinkModal';

type Sort = 'producer' | 'vintage' | 'drink' | 'recent';

function norm(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function Wines() {
  const wines = useLiveQuery(() => db.wines.toArray(), []);
  const placements = useLiveQuery(() => db.placements.toArray(), []);
  const [q, setQ] = useState('');
  const [color, setColor] = useState<WineColor | ''>('');
  const [status, setStatus] = useState<DrinkStatus | ''>('');
  const [sort, setSort] = useState<Sort>('producer');
  const [showEmpty, setShowEmpty] = useState(false);
  const [drinking, setDrinking] = useState<Wine>();

  const placedCount = useMemo(() => {
    const m = new Map<number, number>();
    placements?.forEach((p) => m.set(p.wineId, (m.get(p.wineId) ?? 0) + 1));
    return m;
  }, [placements]);

  const list = useMemo(() => {
    if (!wines) return [];
    const nq = norm(q.trim());
    const res = wines.filter((w) => {
      if (!showEmpty && w.quantity <= 0) return false;
      if (color && w.color !== color) return false;
      if (status && drinkStatus(w) !== status) return false;
      if (nq) {
        const hay = norm([w.producer, w.name, w.appellation, w.region, w.vintage, w.grapes, w.supplier].join(' '));
        return nq.split(/\s+/).every((t) => hay.includes(t));
      }
      return true;
    });
    const cmp: Record<Sort, (a: Wine, b: Wine) => number> = {
      producer: (a, b) => wineTitle(a).localeCompare(wineTitle(b), 'fr'),
      vintage: (a, b) => (a.vintage ?? 0) - (b.vintage ?? 0),
      drink: (a, b) => (a.drinkUntil ?? 9999) - (b.drinkUntil ?? 9999),
      recent: (a, b) => b.updatedAt - a.updatedAt,
    };
    return res.sort(cmp[sort]);
  }, [wines, q, color, status, sort, showEmpty]);

  if (!wines) return null;
  const total = list.reduce((s, w) => s + w.quantity, 0);

  return (
    <div className="stack">
      <input className="search" type="search" placeholder="Rechercher (domaine, appellation, millésime…)" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips scroll">
        <button className={`chip ${color === '' ? 'on' : ''}`} onClick={() => setColor('')}>Toutes</button>
        {COLORS.map((c) => (
          <button key={c.value} className={`chip ${color === c.value ? 'on' : ''}`} onClick={() => setColor(color === c.value ? '' : c.value)}>
            <ColorDot color={c.value} /> {c.label}
          </button>
        ))}
      </div>
      <div className="filters">
        <select value={status} onChange={(e) => setStatus(e.target.value as DrinkStatus | '')}>
          <option value="">Toutes apogées</option>
          {(Object.keys(STATUS_LABEL) as DrinkStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="producer">Tri : nom</option>
          <option value="vintage">Tri : millésime</option>
          <option value="drink">Tri : à boire avant</option>
          <option value="recent">Tri : modifiés récemment</option>
        </select>
        <label className="check"><input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} /> Épuisés</label>
      </div>
      <p className="muted small">{list.length} référence{list.length > 1 ? 's' : ''} · {total} bouteille{total > 1 ? 's' : ''}</p>

      {list.length === 0 ? (
        <Empty>{wines.length === 0 ? <>Aucun vin pour l'instant. <Link to="/vin/nouveau">Ajouter un vin</Link></> : 'Aucun vin ne correspond.'}</Empty>
      ) : (
        <ul className="list">
          {list.map((w) => {
            const unplaced = w.quantity - (placedCount.get(w.id!) ?? 0);
            return (
              <li key={w.id} className={w.quantity <= 0 ? 'faded' : ''}>
                <Link to={`/vin/${w.id}`} className="row">
                  {w.photo ? <img className="thumb" src={w.photo} alt="" /> : <ColorDot color={w.color} size={14} />}
                  <span className="grow">
                    <b>{wineTitle(w)}</b>
                    <small className="muted">
                      {[w.appellation, w.vintage ?? 'NM'].filter(Boolean).join(' · ')}
                      {unplaced > 0 && placedCount.size > 0 ? ` · ${unplaced} non rangée${unplaced > 1 ? 's' : ''}` : ''}
                    </small>
                    <StatusBadge wine={w} />
                  </span>
                </Link>
                <div className="quick">
                  <button aria-label="Sortir une bouteille" disabled={w.quantity <= 0} onClick={() => setDrinking(w)}>−</button>
                  <span className="qty">{w.quantity}</span>
                  <button aria-label="Ajouter une bouteille" onClick={() => addBottles(w.id!, 1)}>+</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {drinking && <DrinkModal wine={drinking} onClose={() => setDrinking(undefined)} />}
    </div>
  );
}

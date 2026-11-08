import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { colorHex, db, deleteRack, wineTitle, type Placement, type Rack, type Wine } from '../db';
import { ColorDot, Empty, Modal, Stepper } from '../components/ui';
import DrinkModal from '../components/DrinkModal';

function norm(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function Racks() {
  const [params, setParams] = useSearchParams();
  const placeWineId = params.get('placer') ? Number(params.get('placer')) : undefined;

  const racks = useLiveQuery(() => db.racks.toArray(), []);
  const wines = useLiveQuery(() => db.wines.toArray(), []);
  const placements = useLiveQuery(() => db.placements.toArray(), []);

  const [rackId, setRackId] = useState<number>();
  const [editRack, setEditRack] = useState<Rack | null>(null);
  const [cell, setCell] = useState<{ row: number; col: number }>();
  const [moving, setMoving] = useState<Placement>();
  const [drinking, setDrinking] = useState<{ wine: Wine; placementId: number }>();
  const [highlight, setHighlight] = useState('');

  useEffect(() => {
    if (racks?.length && !racks.find((r) => r.id === rackId)) setRackId(racks[0].id);
  }, [racks, rackId]);

  const wineById = useMemo(() => new Map(wines?.map((w) => [w.id!, w])), [wines]);
  const placedCount = useMemo(() => {
    const m = new Map<number, number>();
    placements?.forEach((p) => m.set(p.wineId, (m.get(p.wineId) ?? 0) + 1));
    return m;
  }, [placements]);

  if (!racks || !wines || !placements) return null;

  const rack = racks.find((r) => r.id === rackId);
  const inRack = placements.filter((p) => p.rackId === rackId);
  const cellItems = (row: number, col: number) => inRack.filter((p) => p.row === row && p.col === col);
  const placeWine = placeWineId ? wineById.get(placeWineId) : undefined;
  const remaining = placeWine ? placeWine.quantity - (placedCount.get(placeWine.id!) ?? 0) : 0;
  const unplacedWines = wines.filter((w) => w.quantity - (placedCount.get(w.id!) ?? 0) > 0);
  const hq = norm(highlight.trim());

  async function onCell(row: number, col: number) {
    if (!rack) return;
    const items = cellItems(row, col);
    const hasRoom = items.length < rack.capacity;
    if (moving && hasRoom) {
      await db.placements.update(moving.id!, { rackId: rack.id!, row, col });
      setMoving(undefined);
      return;
    }
    if (placeWine && remaining > 0 && hasRoom) {
      await db.placements.add({ wineId: placeWine.id!, rackId: rack.id!, row, col });
      return;
    }
    setCell({ row, col });
  }

  const totalSlots = rack ? rack.rows * rack.cols * rack.capacity : 0;

  return (
    <div className="stack">
      <div className="row between">
        <h1>Casiers</h1>
        <button className="btn ghost" onClick={() => setEditRack({ name: `Casier ${racks.length + 1}`, rows: 6, cols: 8, capacity: 1 })}>+ Casier</button>
      </div>

      {placeWine && (
        <div className={`banner ${remaining === 0 ? 'ok' : ''}`}>
          {remaining > 0 ? (
            <>Touchez une case libre pour ranger <b>{wineTitle(placeWine)} {placeWine.vintage ?? ''}</b> · {remaining} restante{remaining > 1 ? 's' : ''}</>
          ) : (
            <>Toutes les bouteilles de {wineTitle(placeWine)} sont rangées ✓</>
          )}
          <button className="link-btn" onClick={() => setParams({})}>Terminer</button>
        </div>
      )}
      {moving && (
        <div className="banner">
          Touchez la case de destination. <button className="link-btn" onClick={() => setMoving(undefined)}>Annuler</button>
        </div>
      )}

      {racks.length === 0 ? (
        <Empty>
          <p>Décrivez votre cave : un casier par meuble, étagère ou armoire, avec son nombre de rangées et de colonnes.</p>
          <p className="muted">Pour un casier en vrac ou une caisse, indiquez combien de bouteilles tiennent dans chaque case.</p>
        </Empty>
      ) : (
        <>
          <div className="chips scroll">
            {racks.map((r) => (
              <button key={r.id} className={`chip ${r.id === rackId ? 'on' : ''}`} onClick={() => setRackId(r.id)}>
                {r.name}
              </button>
            ))}
          </div>
          {rack && (
            <>
              <div className="row between">
                <small className="muted">{inRack.length}/{totalSlots} places occupées</small>
                <button className="link-btn" onClick={() => setEditRack(rack)}>Modifier le casier</button>
              </div>
              <input className="search" type="search" placeholder="Surligner un vin…" value={highlight} onChange={(e) => setHighlight(e.target.value)} />
              <div className="rack-scroll">
                <div className="rack" style={{ gridTemplateColumns: `1.5em repeat(${rack.cols}, minmax(2.6em, 1fr))` }}>
                  <span />
                  {Array.from({ length: rack.cols }, (_, c) => <span key={c} className="axis">{c + 1}</span>)}
                  {Array.from({ length: rack.rows }, (_, r) => (
                    <FragmentRow key={r} r={r}>
                      {Array.from({ length: rack.cols }, (_, c) => {
                        const items = cellItems(r, c);
                        const first = items[0] ? wineById.get(items[0].wineId) : undefined;
                        const match = hq && items.some((p) => {
                          const w = wineById.get(p.wineId);
                          return w && norm([w.producer, w.name, w.appellation, w.vintage].join(' ')).includes(hq);
                        });
                        const target = (placeWine && remaining > 0) || moving;
                        return (
                          <button
                            key={c}
                            className={`cell ${items.length ? 'full' : 'free'} ${match ? 'hl' : ''} ${hq && !match ? 'dim' : ''} ${target && items.length < rack.capacity ? 'target' : ''}`}
                            style={first ? { background: colorHex(first.color) } : undefined}
                            onClick={() => onCell(r, c)}
                            title={first ? wineTitle(first) : 'Libre'}
                          >
                            {first && (rack.capacity > 1 ? items.length : first.vintage ? `'${String(first.vintage).slice(2)}` : 'NM')}
                          </button>
                        );
                      })}
                    </FragmentRow>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {unplacedWines.length > 0 && racks.length > 0 && !placeWine && (
        <section>
          <h2>À ranger</h2>
          <ul className="list">
            {unplacedWines.map((w) => (
              <li key={w.id}>
                <button className="row" onClick={() => setParams({ placer: String(w.id) })}>
                  <ColorDot color={w.color} />
                  <span className="grow"><b>{wineTitle(w)}</b><small className="muted">{w.vintage ?? 'NM'}</small></span>
                  <span className="qty">{w.quantity - (placedCount.get(w.id!) ?? 0)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {cell && rack && (
        <CellModal
          rack={rack}
          row={cell.row}
          col={cell.col}
          items={cellItems(cell.row, cell.col)}
          wineById={wineById}
          candidates={unplacedWines}
          onClose={() => setCell(undefined)}
          onMove={(p) => { setMoving(p); setCell(undefined); }}
          onDrink={(wine, placementId) => { setDrinking({ wine, placementId }); setCell(undefined); }}
        />
      )}
      {editRack && <RackModal rack={editRack} onClose={() => setEditRack(null)} onSaved={(id) => setRackId(id)} />}
      {drinking && <DrinkModal wine={drinking.wine} placementId={drinking.placementId} onClose={() => setDrinking(undefined)} />}
    </div>
  );
}

function FragmentRow({ r, children }: { r: number; children: ReactNode }) {
  return (
    <>
      <span className="axis">{String.fromCharCode(65 + (r % 26))}</span>
      {children}
    </>
  );
}

function CellModal(props: {
  rack: Rack;
  row: number;
  col: number;
  items: Placement[];
  wineById: Map<number, Wine>;
  candidates: Wine[];
  onClose: () => void;
  onMove: (p: Placement) => void;
  onDrink: (w: Wine, placementId: number) => void;
}) {
  const { rack, row, col, items, wineById, candidates, onClose } = props;
  const [q, setQ] = useState('');
  const hasRoom = items.length < rack.capacity;
  const nq = norm(q);
  const list = candidates.filter((w) => norm([w.producer, w.name, w.appellation, w.vintage].join(' ')).includes(nq));

  return (
    <Modal title={`${rack.name} · ${String.fromCharCode(65 + (row % 26))}${col + 1}`} onClose={onClose}>
      {items.map((p) => {
        const w = wineById.get(p.wineId);
        if (!w) return null;
        return (
          <div key={p.id} className="card">
            <div className="row"><ColorDot color={w.color} /><b className="grow">{wineTitle(w)} {w.vintage ?? ''}</b></div>
            <small className="muted">{w.appellation}</small>
            <div className="actions wrap">
              <Link className="btn ghost" to={`/vin/${w.id}`}>Fiche</Link>
              <button className="btn ghost" onClick={() => props.onMove(p)}>Déplacer</button>
              <button className="btn ghost" onClick={async () => { await db.placements.delete(p.id!); if (items.length === 1) onClose(); }}>Retirer</button>
              <button className="btn primary" onClick={() => props.onDrink(w, p.id!)}>🍷 Sortir</button>
            </div>
          </div>
        );
      })}
      {hasRoom && (
        <>
          <h3>Ranger ici</h3>
          {candidates.length === 0 ? (
            <p className="muted">Toutes vos bouteilles sont déjà rangées.</p>
          ) : (
            <>
              <input className="search" placeholder="Chercher un vin non rangé…" value={q} onChange={(e) => setQ(e.target.value)} />
              <ul className="list compact">
                {list.slice(0, 30).map((w) => (
                  <li key={w.id}>
                    <button className="row" onClick={async () => { await db.placements.add({ wineId: w.id!, rackId: rack.id!, row, col }); onClose(); }}>
                      <ColorDot color={w.color} />
                      <span className="grow">{wineTitle(w)} <span className="muted">{w.vintage ?? 'NM'}</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

function RackModal({ rack, onClose, onSaved }: { rack: Rack; onClose: () => void; onSaved: (id: number) => void }) {
  const [r, setR] = useState(rack);
  const placements = useLiveQuery(() => (rack.id ? db.placements.where('rackId').equals(rack.id).toArray() : Promise.resolve([] as Placement[])), [rack.id]);
  const outside = placements?.filter((p) => p.row >= r.rows || p.col >= r.cols).length ?? 0;

  async function save() {
    if (rack.id && outside > 0 && !confirm(`${outside} bouteille(s) se trouvent hors des nouvelles dimensions et seront retirées du casier. Continuer ?`)) return;
    if (rack.id && outside > 0) await db.placements.bulkDelete(placements!.filter((p) => p.row >= r.rows || p.col >= r.cols).map((p) => p.id!));
    const id = await db.racks.put(r);
    onSaved(id);
    onClose();
  }

  return (
    <Modal title={rack.id ? 'Modifier le casier' : 'Nouveau casier'} onClose={onClose}>
      <label className="field"><span>Nom</span><input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} /></label>
      <div className="grid2">
        <div className="field"><span>Rangées</span><Stepper value={r.rows} min={1} max={40} onChange={(v) => setR({ ...r, rows: v })} /></div>
        <div className="field"><span>Colonnes</span><Stepper value={r.cols} min={1} max={40} onChange={(v) => setR({ ...r, cols: v })} /></div>
      </div>
      <div className="field"><span>Bouteilles par case</span><Stepper value={r.capacity} min={1} max={200} onChange={(v) => setR({ ...r, capacity: v })} /></div>
      <p className="muted small">Capacité totale : {r.rows * r.cols * r.capacity} bouteilles</p>
      <div className="actions wrap">
        {rack.id && (
          <button className="btn danger" onClick={async () => { if (confirm('Supprimer ce casier ? Les bouteilles restent dans votre inventaire, sans emplacement.')) { await deleteRack(rack.id!); onClose(); } }}>
            Supprimer
          </button>
        )}
        <button className="btn ghost" onClick={onClose}>Annuler</button>
        <button className="btn primary" onClick={save}>Enregistrer</button>
      </div>
    </Modal>
  );
}

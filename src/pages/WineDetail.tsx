import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { addBottles, COLORS, db, deleteWine, drinkStatus, wineTitle } from '../db';
import { ColorDot, Modal, Stars, StatusBadge, Stepper, fmtDate, fmtMoney } from '../components/ui';
import DrinkModal from '../components/DrinkModal';

export default function WineDetail() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const wine = useLiveQuery(() => db.wines.get(id), [id]);
  const tastings = useLiveQuery(() => db.tastings.where('wineId').equals(id).reverse().sortBy('date'), [id]);
  const movements = useLiveQuery(() => db.movements.where('wineId').equals(id).reverse().sortBy('date'), [id]);
  const placements = useLiveQuery(() => db.placements.where('wineId').equals(id).toArray(), [id]);
  const racks = useLiveQuery(() => db.racks.toArray(), []);
  const [drink, setDrink] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addQty, setAddQty] = useState(6);

  if (wine === undefined) return null;
  if (!wine) return <p>Ce vin n'existe plus. <Link to="/vins">Retour</Link></p>;

  const status = drinkStatus(wine);
  const year = new Date().getFullYear();
  const unplaced = wine.quantity - (placements?.length ?? 0);

  async function remove() {
    if (confirm(`Supprimer définitivement « ${wineTitle(wine!)} » et son historique ?`)) {
      await deleteWine(id);
      navigate('/vins', { replace: true });
    }
  }

  return (
    <div className="stack">
      <div className="detail-head">
        {wine.photo && <img className="label-photo" src={wine.photo} alt="Étiquette" />}
        <div>
          <p className="muted"><ColorDot color={wine.color} /> {COLORS.find((c) => c.value === wine.color)?.label} · {wine.size} cl</p>
          <h1>{wine.producer || wine.appellation}</h1>
          {wine.name && <p className="lead">{wine.name}</p>}
          <p>{[wine.appellation, wine.region].filter(Boolean).join(' · ')}</p>
          <p className="vintage">{wine.vintage ?? 'Non millésimé'}</p>
        </div>
      </div>

      <section className="card stock">
        <div>
          <b className="big">{wine.quantity}</b> bouteille{wine.quantity > 1 ? 's' : ''}
          {wine.price ? <small className="muted"> · {fmtMoney(wine.price)} l'unité</small> : null}
        </div>
        <div className="actions">
          <button className="btn ghost" onClick={() => setAdding(true)}>+ Ajouter</button>
          <button className="btn primary" disabled={wine.quantity <= 0} onClick={() => setDrink(true)}>🍷 Sortir une bouteille</button>
        </div>
      </section>

      <section className="card">
        <h2>Apogée</h2>
        {wine.drinkFrom || wine.drinkUntil ? (
          <>
            <StatusBadge wine={wine} />
            <div className="timeline">
              {(() => {
                const from = wine.drinkFrom ?? wine.vintage ?? year;
                const until = wine.drinkUntil ?? from + 5;
                const start = Math.min(wine.vintage ?? from, from, year) ;
                const end = Math.max(until, year) + 1;
                const pct = (y: number) => ((y - start) / (end - start)) * 100;
                return (
                  <>
                    <div className={`window ${status}`} style={{ left: `${pct(from)}%`, width: `${pct(until + 1) - pct(from)}%` }} />
                    <div className="now" style={{ left: `${pct(year + 0.5)}%` }} title="Aujourd'hui" />
                    <span className="tl-label" style={{ left: `${pct(from)}%` }}>{from}</span>
                    <span className="tl-label" style={{ left: `${pct(until + 1)}%` }}>{until}</span>
                  </>
                );
              })()}
            </div>
          </>
        ) : (
          <p className="muted">Non renseignée. <Link to={`/vin/${id}/modifier`}>Ajouter une fenêtre de dégustation</Link></p>
        )}
      </section>

      <section className="card">
        <h2>Emplacement</h2>
        {placements && placements.length > 0 ? (
          <ul className="plain">
            {placements.map((p) => {
              const r = racks?.find((x) => x.id === p.rackId);
              return <li key={p.id}>📍 {r?.name ?? 'Casier'} · rangée {p.row + 1}, colonne {p.col + 1}</li>;
            })}
          </ul>
        ) : (
          <p className="muted">Aucune bouteille rangée.</p>
        )}
        {unplaced > 0 && (
          <Link className="btn ghost" to={`/casiers?placer=${id}`}>Ranger {unplaced > 1 ? `les ${unplaced} bouteilles` : 'la bouteille'} restante{unplaced > 1 ? 's' : ''}</Link>
        )}
      </section>

      {(wine.grapes || wine.supplier || wine.notes) && (
        <section className="card">
          <h2>Infos</h2>
          {wine.grapes && <p><b>Cépages :</b> {wine.grapes}</p>}
          {wine.supplier && <p><b>Acheté chez :</b> {wine.supplier}</p>}
          {wine.notes && <p className="pre">{wine.notes}</p>}
        </section>
      )}

      <section className="card">
        <h2>Dégustations</h2>
        {tastings?.length ? (
          <ul className="plain">
            {tastings.map((t) => (
              <li key={t.id} className="tasting">
                <div className="row"><Stars value={t.rating} size={16} /><small className="muted">{fmtDate(t.date)}</small></div>
                {t.notes && <p className="pre">{t.notes}</p>}
                {t.pairing && <p className="muted">🍽️ {t.pairing}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Les notes saisies en sortant une bouteille apparaîtront ici.</p>
        )}
      </section>

      <section className="card">
        <h2>Historique</h2>
        <ul className="plain small">
          {movements?.map((m) => (
            <li key={m.id}>
              {fmtDate(m.date)} · <b className={m.type === 'in' ? 'in' : 'out'}>{m.type === 'in' ? '+' : '−'}{m.qty}</b> {m.note}
            </li>
          ))}
        </ul>
      </section>

      <div className="actions wrap">
        <Link className="btn ghost" to={`/vin/${id}/modifier`}>✏️ Modifier</Link>
        <Link className="btn ghost" to={`/vin/nouveau?depuis=${id}`}>⧉ Autre millésime</Link>
        <button className="btn danger" onClick={remove}>Supprimer</button>
      </div>

      {drink && <DrinkModal wine={wine} onClose={() => setDrink(false)} />}
      {adding && (
        <Modal title="Ajouter des bouteilles" onClose={() => setAdding(false)}>
          <Stepper value={addQty} onChange={setAddQty} min={1} />
          <div className="actions">
            <button className="btn ghost" onClick={() => setAdding(false)}>Annuler</button>
            <button className="btn primary" onClick={async () => { await addBottles(id, addQty); setAdding(false); }}>Ajouter {addQty}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

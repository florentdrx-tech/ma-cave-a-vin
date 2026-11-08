import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { COLORS, db, drinkStatus, wineTitle } from '../db';
import { ColorDot, Empty, StatusBadge, fmtMoney, fmtTemp } from '../components/ui';
import { tempLevel, humLevel } from '../thermometer';
import { useThermo } from '../thermoContext';

export default function Home() {
  const wines = useLiveQuery(() => db.wines.filter((w) => w.quantity > 0).toArray(), []);
  const lastReading = useLiveQuery(() => db.readings.orderBy('date').last(), []);
  const thermo = useThermo();

  if (!wines) return null;

  const bottles = wines.reduce((s, w) => s + w.quantity, 0);
  const value = wines.reduce((s, w) => s + (w.price ?? 0) * w.quantity, 0);
  const year = new Date().getFullYear();
  const toDrink = wines
    .filter((w) => ['urgent', 'passe', 'apogee'].includes(drinkStatus(w, year)))
    .sort((a, b) => (a.drinkUntil ?? 9999) - (b.drinkUntil ?? 9999))
    .slice(0, 8);

  const temp = thermo.live?.temp ?? lastReading?.temp;
  const hum = thermo.live?.humidity ?? lastReading?.humidity;

  if (wines.length === 0) {
    return (
      <Empty>
        <h1>Bienvenue dans votre cave 🍷</h1>
        <p>Ajoutez votre premier vin avec le bouton <b>＋</b>. Seuls le domaine (ou l'appellation) et la couleur sont nécessaires : le reste peut attendre.</p>
        <p className="muted">Vous venez d'une autre application ? Exportez vos vins en CSV et importez-les depuis ⚙️ Réglages.</p>
        <Link className="btn primary" to="/vin/nouveau">Ajouter un vin</Link>
      </Empty>
    );
  }

  return (
    <div className="stack">
      <section className="stats">
        <div className="stat"><b>{bottles}</b><small>bouteilles</small></div>
        <div className="stat"><b>{wines.length}</b><small>références</small></div>
        <div className="stat"><b>{value > 0 ? fmtMoney(value) : '—'}</b><small>valeur</small></div>
      </section>

      <section className="card">
        <div className="colors-bar">
          {COLORS.map((c) => {
            const n = wines.filter((w) => w.color === c.value).reduce((s, w) => s + w.quantity, 0);
            return n ? <div key={c.value} style={{ flex: n, background: c.hex }} title={`${c.label} : ${n}`} /> : null;
          })}
        </div>
        <div className="legend">
          {COLORS.map((c) => {
            const n = wines.filter((w) => w.color === c.value).reduce((s, w) => s + w.quantity, 0);
            return n ? <span key={c.value}><ColorDot color={c.value} /> {c.label} {n}</span> : null;
          })}
        </div>
      </section>

      <Link to="/temperature" className={`card temp-card ${temp !== undefined ? tempLevel(temp) : ''}`}>
        <span className="temp-big">{temp !== undefined ? fmtTemp(temp) : '— °C'}</span>
        <span>
          {hum !== undefined && <span className={`hum ${humLevel(hum)}`}>{Math.round(hum)} % HR</span>}
          <small className="muted">
            {thermo.connected ? `En direct · ${thermo.deviceName}` : lastReading ? 'Dernier relevé' : 'Aucun relevé : touchez pour en ajouter'}
          </small>
        </span>
      </Link>

      <section>
        <h2>À boire en priorité</h2>
        {toDrink.length === 0 ? (
          <p className="muted">Rien d'urgent. Renseignez l'apogée de vos vins pour être prévenu au bon moment.</p>
        ) : (
          <ul className="list">
            {toDrink.map((w) => (
              <li key={w.id}>
                <Link to={`/vin/${w.id}`} className="row">
                  <ColorDot color={w.color} />
                  <span className="grow">
                    <b>{wineTitle(w)}</b>
                    <small className="muted">{[w.appellation, w.vintage].filter(Boolean).join(' · ')}{w.drinkUntil ? ` · jusqu'en ${w.drinkUntil}` : ''}</small>
                  </span>
                  <StatusBadge wine={w} />
                  <span className="qty">×{w.quantity}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

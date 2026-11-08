import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Reading } from '../db';
import { bluetoothAvailable, humLevel, SERVING, STORAGE, tempLevel } from '../thermometer';
import { useThermo } from '../thermoContext';
import { fmtDate, fmtTemp } from '../components/ui';

const DAY = 86400000;

export default function Temperature() {
  const thermo = useThermo();
  const [days, setDays] = useState(30);
  const readings = useLiveQuery(() => db.readings.where('date').above(Date.now() - days * DAY).sortBy('date'), [days]);
  const [t, setT] = useState('');
  const [h, setH] = useState('');

  async function addManual(e: FormEvent) {
    e.preventDefault();
    const temp = Number(t.replace(',', '.'));
    if (!t || Number.isNaN(temp)) return;
    const hum = h ? Number(h.replace(',', '.')) : undefined;
    await db.readings.add({ date: Date.now(), temp, humidity: hum, source: 'manuel' });
    setT('');
    setH('');
  }

  async function saveLive() {
    if (thermo.live?.temp === undefined) return;
    await db.readings.add({
      date: Date.now(),
      temp: Math.round(thermo.live.temp * 10) / 10,
      humidity: thermo.live.humidity !== undefined ? Math.round(thermo.live.humidity) : undefined,
      source: 'bluetooth',
    });
  }

  const temps = readings?.map((r) => r.temp) ?? [];
  const min = temps.length ? Math.min(...temps) : undefined;
  const max = temps.length ? Math.max(...temps) : undefined;

  return (
    <div className="stack">
      <h1>Température de la cave</h1>

      <section className="card">
        <h2>Thermomètre connecté</h2>
        {thermo.connected ? (
          <>
            <div className="live">
              <span className={`temp-big ${thermo.live?.temp !== undefined ? tempLevel(thermo.live.temp) : ''}`}>
                {thermo.live?.temp !== undefined ? fmtTemp(thermo.live.temp) : '…'}
              </span>
              {thermo.live?.humidity !== undefined && (
                <span className={`hum ${humLevel(thermo.live.humidity)}`}>{Math.round(thermo.live.humidity)} % HR</span>
              )}
            </div>
            <p className="muted small">
              {thermo.deviceName} · un relevé est enregistré automatiquement toutes les 10 minutes tant que l'application reste ouverte.
            </p>
            <div className="actions">
              <button className="btn ghost" onClick={thermo.disconnect}>Déconnecter</button>
              <button className="btn primary" onClick={saveLive}>Enregistrer ce relevé</button>
            </div>
          </>
        ) : bluetoothAvailable() ? (
          <>
            <p className="muted small">
              Compatible avec les capteurs Bluetooth exposant le service standard « Environmental Sensing » (ex. Xiaomi LYWSD03MMC avec firmware pvvx/ATC),
              le Xiaomi LYWSD03MMC d'origine, et les thermomètres au profil « Health Thermometer ».
            </p>
            <button className="btn primary" disabled={thermo.connecting} onClick={thermo.connect}>
              {thermo.connecting ? 'Connexion…' : '📡 Connecter un thermomètre'}
            </button>
          </>
        ) : (
          <p className="muted small">
            Ce navigateur ne prend pas en charge le Bluetooth web (c'est le cas de Safari sur iPhone/iPad). Utilisez Chrome sur Android ou sur ordinateur
            pour connecter un capteur, ou saisissez vos relevés ci-dessous.
          </p>
        )}
        {thermo.error && <p className="error">{thermo.error}</p>}
      </section>

      <form className="card" onSubmit={addManual}>
        <h2>Relevé manuel</h2>
        <div className="grid2">
          <label className="field"><span>Température (°C)</span><input inputMode="decimal" value={t} onChange={(e) => setT(e.target.value)} placeholder="12,5" /></label>
          <label className="field"><span>Humidité (%)</span><input inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} placeholder="70" /></label>
        </div>
        <button className="btn primary" type="submit" disabled={!t}>Ajouter le relevé</button>
      </form>

      <section className="card">
        <div className="row between">
          <h2>Historique</h2>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>7 jours</option>
            <option value={30}>30 jours</option>
            <option value={365}>1 an</option>
          </select>
        </div>
        {readings && readings.length > 0 ? (
          <>
            <Chart readings={readings} />
            <p className="small">
              Min <b>{fmtTemp(min!)}</b> · Max <b>{fmtTemp(max!)}</b> · Écart <b className={max! - min! > 4 ? 'bad' : 'ok'}>{fmtTemp(max! - min!)}</b>
              {max! - min! > 4 && <span className="muted"> : variations importantes, à surveiller</span>}
            </p>
            <ul className="plain small readings">
              {[...readings].reverse().slice(0, 20).map((r) => (
                <li key={r.id} className="row">
                  <span className="grow">{fmtDate(r.date)} {new Date(r.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                  <b className={tempLevel(r.temp)}>{fmtTemp(r.temp)}</b>
                  {r.humidity !== undefined && <span className={humLevel(r.humidity)}>{r.humidity} %</span>}
                  <span className="muted">{r.source === 'bluetooth' ? '📡' : '✍️'}</span>
                  <button className="icon-btn" aria-label="Supprimer le relevé" onClick={() => db.readings.delete(r.id!)}>✕</button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted">Aucun relevé sur la période.</p>
        )}
      </section>

      <section className="card">
        <h2>Conditions idéales de conservation</h2>
        <ul className="plain">
          <li>🌡️ <b>{STORAGE.tempMin} à {STORAGE.tempMax} °C</b>, idéalement autour de {STORAGE.tempIdeal} °C</li>
          <li>📉 <b>Le plus stable possible</b> : les variations brusques abîment le vin plus qu'une température un peu haute mais constante</li>
          <li>💧 <b>Humidité de {STORAGE.humMin} à {STORAGE.humMax} %</b> pour éviter que les bouchons sèchent (en dessous) ou que les étiquettes moisissent (au-dessus)</li>
          <li>🌑 Dans l'obscurité, sans vibrations ni odeurs fortes</li>
          <li>↔️ Bouteilles bouchées liège couchées</li>
        </ul>
        <h3>Température de service</h3>
        <table className="table">
          <tbody>
            {SERVING.map((s) => (
              <tr key={s.label}><td>{s.label}</td><td className="nowrap"><b>{s.range}</b></td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Chart({ readings }: { readings: Reading[] }) {
  const W = 320;
  const H = 140;
  const pad = { l: 28, r: 8, t: 8, b: 18 };
  const temps = readings.map((r) => r.temp);
  const lo = Math.floor(Math.min(STORAGE.tempMin - 2, ...temps));
  const hi = Math.ceil(Math.max(STORAGE.tempMax + 2, ...temps));
  const t0 = readings[0].date;
  const t1 = Math.max(readings[readings.length - 1].date, t0 + 1);
  const x = (d: number) => pad.l + ((d - t0) / (t1 - t0)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const path = readings.map((r, i) => `${i ? 'L' : 'M'}${x(r.date).toFixed(1)},${y(r.temp).toFixed(1)}`).join(' ');
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const short = t1 - t0 < 2 * DAY;
  const lbl = (d: number) =>
    short
      ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Courbe des températures relevées">
      <rect x={pad.l} y={y(STORAGE.tempMax)} width={W - pad.l - pad.r} height={y(STORAGE.tempMin) - y(STORAGE.tempMax)} className="band" />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="grid" />
          <text x={pad.l - 4} y={y(v) + 3} textAnchor="end">{v}°</text>
        </g>
      ))}
      <text x={pad.l} y={H - 4}>{lbl(t0)}</text>
      <text x={W - pad.r} y={H - 4} textAnchor="end">{lbl(t1)}</text>
      <path d={path} className="line" />
      {readings.length < 40 && readings.map((r) => <circle key={r.id} cx={x(r.date)} cy={y(r.temp)} r={2.5} className="pt" />)}
    </svg>
  );
}

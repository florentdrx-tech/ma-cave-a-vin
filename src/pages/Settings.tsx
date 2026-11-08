import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, download, exportCSV, exportJSON, importJSON } from '../db';
import { FIELD_LABELS, guessMapping, importWines, parseCSV, rowsToWines } from '../csvImport';
import { Modal } from '../components/ui';

export default function Settings() {
  const counts = useLiveQuery(async () => ({ wines: await db.wines.count(), tastings: await db.tastings.count(), readings: await db.readings.count() }), []);
  const [msg, setMsg] = useState<string>();
  const [csv, setCsv] = useState<{ header: string[]; rows: string[][]; mapping: Record<number, string> }>();
  const stamp = new Date().toISOString().slice(0, 10);

  async function onJSON(file?: File) {
    if (!file) return;
    if (!confirm('Restaurer cette sauvegarde ? Les données actuelles seront remplacées.')) return;
    try {
      await importJSON(await file.text());
      setMsg('Sauvegarde restaurée ✓');
    } catch (e) {
      setMsg(`Erreur : ${e instanceof Error ? e.message : e}`);
    }
  }

  async function onCSV(file?: File) {
    if (!file) return;
    const rows = parseCSV(await file.text());
    if (rows.length < 2) { setMsg('Fichier CSV vide ou illisible.'); return; }
    setCsv({ header: rows[0], rows: rows.slice(1), mapping: guessMapping(rows[0]) });
  }

  async function confirmCSV() {
    if (!csv) return;
    const wines = rowsToWines(csv.rows, csv.mapping);
    await importWines(wines);
    setCsv(undefined);
    setMsg(`${wines.length} vin${wines.length > 1 ? 's' : ''} importé${wines.length > 1 ? 's' : ''} ✓`);
  }

  return (
    <div className="stack">
      <h1>Réglages</h1>
      {msg && <div className="toast" onClick={() => setMsg(undefined)}>{msg}</div>}

      <section className="card">
        <h2>Vos données</h2>
        <p className="muted small">
          Tout est stocké <b>uniquement sur cet appareil</b> : pas de compte, pas de publicité, pas d'abonnement.
          {counts && ` ${counts.wines} vins, ${counts.tastings} dégustations, ${counts.readings} relevés de température.`}
        </p>
        <p className="muted small">Pensez à exporter une sauvegarde régulièrement (et pour passer sur un autre appareil).</p>
        <div className="actions wrap">
          <button className="btn primary" onClick={async () => download(`ma-cave-${stamp}.json`, await exportJSON(), 'application/json')}>💾 Sauvegarde complète (JSON)</button>
          <button className="btn ghost" onClick={async () => download(`ma-cave-${stamp}.csv`, await exportCSV(), 'text/csv;charset=utf-8')}>Exporter l'inventaire (CSV / Excel)</button>
        </div>
      </section>

      <section className="card">
        <h2>Restaurer une sauvegarde</h2>
        <label className="btn ghost">
          Choisir un fichier .json
          <input type="file" accept="application/json,.json" hidden onChange={(e) => { onJSON(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </section>

      <section className="card">
        <h2>Importer depuis une autre application</h2>
        <p className="muted small">
          Exportez votre cave en CSV ou Excel (enregistré au format CSV) depuis Viniou ou une autre application, puis importez le fichier ici.
          Les colonnes sont reconnues automatiquement, et vous pouvez corriger la correspondance avant d'importer. Les vins importés s'ajoutent à ceux déjà présents.
        </p>
        <label className="btn ghost">
          Choisir un fichier .csv
          <input type="file" accept=".csv,text/csv,.txt" hidden onChange={(e) => { onCSV(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </section>

      <section className="card">
        <h2>Installer l'application</h2>
        <ul className="plain small">
          <li><b>iPhone / iPad (Safari)</b> : bouton Partager, puis « Sur l'écran d'accueil ».</li>
          <li><b>Android (Chrome)</b> : menu ⋮, puis « Installer l'application ».</li>
          <li><b>Ordinateur (Chrome / Edge)</b> : icône d'installation dans la barre d'adresse.</li>
        </ul>
        <p className="muted small">Une fois installée, l'application fonctionne aussi hors connexion.</p>
      </section>

      <section className="card">
        <h2>Zone sensible</h2>
        <button className="btn danger" onClick={async () => {
          if (confirm('Effacer TOUTES les données de la cave sur cet appareil ?') && confirm('Vraiment ? Cette action est irréversible.')) {
            await Promise.all(db.tables.map((t) => t.clear()));
            setMsg('Données effacées.');
          }
        }}>Tout effacer</button>
      </section>

      {csv && (
        <Modal title="Correspondance des colonnes" onClose={() => setCsv(undefined)}>
          <p className="muted small">{csv.rows.length} lignes détectées. Vérifiez à quoi correspond chaque colonne :</p>
          <table className="table">
            <tbody>
              {csv.header.map((h, i) => (
                <tr key={i}>
                  <td>
                    <b>{h || `Colonne ${i + 1}`}</b>
                    <br />
                    <small className="muted">{csv.rows[0]?.[i]}</small>
                  </td>
                  <td>
                    <select value={csv.mapping[i] ?? ''} onChange={(e) => setCsv({ ...csv, mapping: { ...csv.mapping, [i]: e.target.value } })}>
                      <option value="">(ignorer)</option>
                      {Object.entries(FIELD_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="actions">
            <button className="btn ghost" onClick={() => setCsv(undefined)}>Annuler</button>
            <button className="btn primary" onClick={confirmCSV}>Importer</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

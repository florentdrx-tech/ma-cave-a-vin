import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, download, exportCSV, exportJSON, importJSON } from '../db';
import { FIELD_LABELS, guessMapping, importWines, parseCSV, rowsToWines } from '../csvImport';
import { Modal } from '../components/ui';
import { AI_MODELS, getAiModel, getApiKey, setAiModel, setApiKey } from '../labelScan';

export default function Settings() {
  const counts = useLiveQuery(async () => ({ wines: await db.wines.count(), tastings: await db.tastings.count(), readings: await db.readings.count() }), []);
  const [msg, setMsg] = useState<string>();
  const [csv, setCsv] = useState<{ header: string[]; rows: string[][]; mapping: Record<number, string> }>();
  const stamp = new Date().toISOString().slice(0, 10);
  const [key, setKey] = useState(getApiKey);
  const [model, setModel] = useState(getAiModel);
  const [showKey, setShowKey] = useState(false);

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
        <h2>Lecture des étiquettes</h2>
        <p className="muted small">
          Sans réglage, le texte de l'étiquette est lu directement sur votre appareil : c'est gratuit, mais peu fiable sur les étiquettes
          très graphiques.
        </p>
        <p className="muted small">
          Pour une lecture bien plus précise, vous pouvez utiliser l'IA Claude avec votre propre clé d'API, à créer sur console.anthropic.com.
          Vous ne payez que ce que vous utilisez, sans abonnement : de l'ordre d'un centime par étiquette avec le modèle le plus précis,
          beaucoup moins avec Haiku. La clé reste sur cet appareil et la photo n'est envoyée qu'à Anthropic, au moment du scan.
        </p>
        <label className="field">
          <span>Clé d'API Anthropic</span>
          <div className="row">
            <input type={showKey ? 'text' : 'password'} value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" autoComplete="off" />
            <button className="btn ghost" type="button" onClick={() => setShowKey(!showKey)}>{showKey ? 'Masquer' : 'Voir'}</button>
          </div>
        </label>
        <label className="field">
          <span>Modèle</span>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {AI_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <div className="actions wrap">
          <button className="btn primary" onClick={() => { setApiKey(key); setAiModel(model); setMsg(key.trim() ? 'Lecture par IA activée ✓' : 'Lecture par IA désactivée.'); }}>Enregistrer</button>
          {getApiKey() && <button className="btn ghost" onClick={() => { setApiKey(''); setKey(''); setMsg('Clé supprimée.'); }}>Supprimer la clé</button>}
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

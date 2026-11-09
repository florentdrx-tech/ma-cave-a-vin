import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, wineTitle } from '../db';
import { aiAdvice, getApiKey } from '../labelScan';

/** Analyse par l'IA de tous les vins déjà enregistrés (conseils de service + apogée). */
export default function BulkAnalyze({ compact = false }: { compact?: boolean }) {
  const wines = useLiveQuery(() => db.wines.filter((w) => w.quantity > 0).toArray(), []);
  const [redo, setRedo] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; current?: string }>();
  const [errors, setErrors] = useState<string[]>([]);
  const [finished, setFinished] = useState<string>();
  const stop = useRef(false);

  if (!wines) return null;
  const hasKey = !!getApiKey();
  const todo = wines.filter((w) => redo || !w.advice?.source);
  if (compact && (!hasKey || todo.length === 0) && !running && !finished) return null;

  async function run() {
    stop.current = false;
    setRunning(true);
    setErrors([]);
    setFinished(undefined);
    const list = [...todo];
    let ok = 0;
    for (let i = 0; i < list.length; i++) {
      if (stop.current) break;
      const w = list[i];
      setProgress({ done: i, total: list.length, current: `${wineTitle(w)} ${w.vintage ?? ''}` });
      try {
        const r = await aiAdvice(w);
        const fresh = await db.wines.get(w.id!);
        await db.wines.update(w.id!, {
          advice: r.advice,
          drinkFrom: fresh?.drinkFrom ?? r.drinkFrom,
          drinkUntil: fresh?.drinkUntil ?? r.drinkUntil,
          updatedAt: Date.now(),
        });
        ok++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setErrors((x) => [...x, `${wineTitle(w)} : ${msg}`]);
        // Inutile de continuer si la clé est refusée ou s'il n'y a pas de connexion
        if (/Clé API|connexion|crédit|credit|billing/i.test(msg)) break;
      }
    }
    setProgress(undefined);
    setRunning(false);
    setFinished(`${ok} vin${ok > 1 ? 's' : ''} analysé${ok > 1 ? 's' : ''}${stop.current ? ' (arrêté)' : ''}.`);
  }

  return (
    <section className="card bulk">
      <h2>✨ Analyser ma cave avec l'IA</h2>
      {!hasKey ? (
        <p className="muted small">
          Ajoutez d'abord votre clé d'API Anthropic dans <Link to="/reglages">⚙️ Réglages</Link>, section « Lecture des étiquettes ».
        </p>
      ) : running && progress ? (
        <>
          <p className="small">Analyse {progress.done + 1} / {progress.total} : <b>{progress.current}</b></p>
          <div className="progress"><div style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
          <button className="btn ghost" onClick={() => (stop.current = true)}>Arrêter</button>
        </>
      ) : (
        <>
          <p className="muted small">
            L'IA rédige pour chaque vin la description, les accords, la température, la carafe et l'apogée.
            {todo.length > 0
              ? ` ${todo.length} vin${todo.length > 1 ? 's' : ''} à analyser, environ 1 centime par vin. Vos conseils saisis à la main ne sont pas remplacés, sauf si vous cochez la case.`
              : ' Tous vos vins ont déjà des conseils.'}
          </p>
          <label className="check"><input type="checkbox" checked={redo} onChange={(e) => setRedo(e.target.checked)} /> Refaire aussi les vins déjà analysés</label>
          <button className="btn primary" disabled={todo.length === 0} onClick={run}>
            Analyser {todo.length} vin{todo.length > 1 ? 's' : ''}
          </button>
        </>
      )}
      {finished && <p className="ok small">✓ {finished}</p>}
      {errors.length > 0 && (
        <div className="error small">
          {errors.slice(0, 5).map((e, i) => <p key={i}>⚠️ {e}</p>)}
          {errors.length > 5 && <p>… et {errors.length - 5} autre(s).</p>}
        </div>
      )}
    </section>
  );
}

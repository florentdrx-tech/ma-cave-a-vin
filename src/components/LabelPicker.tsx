import { useEffect, useRef, useState } from 'react';
import { Modal } from './ui';
import { googleImagesUrl, importImage, searchLabelImages, type ImageResult } from '../labelSearch';

/** Choix de l'image d'étiquette affichée sur la bouteille. */
export default function LabelPicker({
  initialQuery,
  photo,
  onPick,
  onClose,
}: {
  initialQuery: string;
  photo?: string;
  onPick: (image: string | undefined) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<ImageResult[]>();
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string>();
  const [url, setUrl] = useState('');
  const ctrl = useRef<AbortController>();

  async function search(query = q) {
    if (!query.trim()) return;
    ctrl.current?.abort();
    ctrl.current = new AbortController();
    setLoading(true);
    try {
      const r = await searchLabelImages(query.trim(), ctrl.current.signal);
      setResults(r.results);
      setErrors(r.errors);
    } catch {
      /* recherche annulée */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialQuery.trim()) search(initialQuery);
    return () => ctrl.current?.abort();
  }, []);

  async function choose(src: string) {
    setSaving(src);
    const img = await importImage(src);
    setSaving(undefined);
    onPick(img);
    onClose();
  }

  return (
    <Modal title="Image de l'étiquette" onClose={onClose}>
      <form className="row" onSubmit={(e) => { e.preventDefault(); search(); }}>
        <input className="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Domaine, cuvée, appellation…" />
        <button className="btn primary" type="submit" disabled={loading}>🔎</button>
      </form>

      {loading && <p className="muted">Recherche en cours…</p>}
      {!loading && results && results.length === 0 && (
        <p className="muted">Aucune image trouvée dans les bases ouvertes. Essayez avec moins de mots (par exemple le domaine seul), ou utilisez une des options ci-dessous.</p>
      )}
      {errors.length > 0 && <p className="muted small">Source indisponible : {errors.join(', ')}.</p>}
      {results && results.length > 0 && (
        <>
          <p className="muted small">Touchez une image pour l'utiliser :</p>
          <div className="img-grid">
            {results.map((r) => (
              <button key={r.full} className="img-pick" onClick={() => choose(r.full)} disabled={!!saving} title={`${r.title} (${r.source})`}>
                <img src={r.thumb} alt={r.title} loading="lazy" />
                {saving === r.full && <span className="img-saving">…</span>}
              </button>
            ))}
          </div>
          <p className="muted small">Images issues d'Open Food Facts et de Wikimedia Commons.</p>
        </>
      )}

      <details className="card">
        <summary><b>Trouver l'image ailleurs (Google Images, site du domaine…)</b></summary>
        <ol className="small">
          <li><a href={googleImagesUrl(q)} target="_blank" rel="noreferrer">Ouvrir la recherche Google Images ↗</a></li>
          <li>Appuyez longuement sur l'image souhaitée, puis « Copier l'adresse de l'image ».</li>
          <li>Collez-la ici :</li>
        </ol>
        <div className="row">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" inputMode="url" />
          <button className="btn primary" disabled={!/^https?:\/\//.test(url.trim()) || !!saving} onClick={() => choose(url.trim())}>OK</button>
        </div>
      </details>

      <div className="actions wrap">
        {photo && <button className="btn ghost" onClick={() => { onPick(photo); onClose(); }}>📷 Utiliser ma photo</button>}
        <button className="btn ghost" onClick={() => { onPick(undefined); onClose(); }}>✒️ Étiquette dessinée</button>
      </div>
    </Modal>
  );
}

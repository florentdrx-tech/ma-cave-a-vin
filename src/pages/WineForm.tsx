import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { COLORS, db, resizeImage, saveWine, suggestWindow, type Wine, type WineColor } from '../db';
import { ColorDot, Stepper } from '../components/ui';

const SIZES = [
  { v: 37.5, l: 'Demi (37,5 cl)' },
  { v: 50, l: '50 cl' },
  { v: 75, l: 'Bouteille (75 cl)' },
  { v: 150, l: 'Magnum (1,5 L)' },
  { v: 300, l: 'Jéroboam (3 L)' },
];

const blank = (): Wine => ({
  name: '',
  producer: '',
  appellation: '',
  region: '',
  color: 'rouge',
  size: 75,
  quantity: 1,
  createdAt: 0,
  updatedAt: 0,
});

function uniq(values: (string | undefined)[]) {
  return [...new Set(values.filter((v): v is string => !!v && v.trim() !== ''))].sort((a, b) => a.localeCompare(b, 'fr'));
}

const numOrUndef = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(',', '.')));

export default function WineForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const fromId = params.get('depuis');
  const navigate = useNavigate();
  const all = useLiveQuery(() => db.wines.toArray(), []);
  const [w, setW] = useState<Wine>(blank);
  const [more, setMore] = useState(false);
  const [saved, setSaved] = useState<string>();
  const editing = !!id;

  useEffect(() => {
    const src = id ?? fromId;
    if (!src) return;
    db.wines.get(Number(src)).then((x) => {
      if (!x) return;
      if (id) setW(x);
      else {
        const { id: _omit, photo: _p, ...rest } = x;
        setW({ ...rest, quantity: 1, vintage: undefined, drinkFrom: undefined, drinkUntil: undefined });
      }
      if (x.drinkFrom || x.supplier || x.grapes || x.notes) setMore(true);
    });
  }, [id, fromId]);

  const lists = useMemo(
    () => ({
      producers: uniq(all?.map((x) => x.producer) ?? []),
      appellations: uniq(all?.map((x) => x.appellation) ?? []),
      regions: uniq(all?.map((x) => x.region) ?? []),
      suppliers: uniq(all?.map((x) => x.supplier) ?? []),
    }),
    [all],
  );

  const set = <K extends keyof Wine>(k: K, v: Wine[K]) => setW((p) => ({ ...p, [k]: v }));

  /** Complète automatiquement les champs vides à partir des vins déjà saisis. */
  function autofill(field: 'producer' | 'appellation', value: string) {
    const match = all?.find((x) => x[field].toLowerCase() === value.trim().toLowerCase());
    if (!match) return;
    setW((p) => ({
      ...p,
      appellation: p.appellation || match.appellation,
      region: p.region || match.region,
      color: field === 'producer' && !p.appellation ? match.color : p.color,
    }));
  }

  const suggestion = suggestWindow(w.color, w.vintage);

  async function submit(e: FormEvent, again = false) {
    e.preventDefault();
    if (!w.producer.trim() && !w.appellation.trim() && !w.name.trim()) {
      alert('Indiquez au moins un domaine, une cuvée ou une appellation.');
      return;
    }
    const clean: Wine = { ...w, producer: w.producer.trim(), name: w.name.trim(), appellation: w.appellation.trim(), region: w.region.trim() };
    const newId = await saveWine(clean);
    if (again) {
      setSaved(`« ${clean.producer || clean.appellation} ${clean.vintage ?? ''} » ajouté ✓`);
      setW((p) => ({ ...blank(), producer: p.producer, appellation: p.appellation, region: p.region, color: p.color, size: p.size, supplier: p.supplier, price: undefined }));
      window.scrollTo(0, 0);
    } else {
      navigate(`/vin/${newId}`, { replace: true });
    }
  }

  async function onPhoto(file?: File) {
    if (file) set('photo', await resizeImage(file));
  }

  return (
    <form className="stack form" onSubmit={(e) => submit(e)}>
      <h1>{editing ? 'Modifier le vin' : 'Ajouter un vin'}</h1>
      {saved && <div className="toast">{saved}</div>}

      <div className="chips">
        {COLORS.map((c) => (
          <button type="button" key={c.value} className={`chip ${w.color === c.value ? 'on' : ''}`} onClick={() => set('color', c.value as WineColor)}>
            <ColorDot color={c.value} /> {c.label}
          </button>
        ))}
      </div>

      <label className="field">
        <span>Domaine / Château</span>
        <input list="dl-producers" value={w.producer} autoFocus={!editing} onChange={(e) => set('producer', e.target.value)} onBlur={(e) => autofill('producer', e.target.value)} placeholder="Ex. Domaine Huet" />
      </label>
      <label className="field">
        <span>Cuvée</span>
        <input value={w.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex. Le Haut-Lieu (facultatif)" />
      </label>
      <div className="grid2">
        <label className="field">
          <span>Appellation</span>
          <input list="dl-appellations" value={w.appellation} onChange={(e) => set('appellation', e.target.value)} onBlur={(e) => autofill('appellation', e.target.value)} placeholder="Ex. Vouvray" />
        </label>
        <label className="field">
          <span>Région</span>
          <input list="dl-regions" value={w.region} onChange={(e) => set('region', e.target.value)} placeholder="Ex. Loire" />
        </label>
      </div>
      <div className="grid2">
        <label className="field">
          <span>Millésime</span>
          <input type="number" inputMode="numeric" min={1900} max={2100} value={w.vintage ?? ''} onChange={(e) => set('vintage', numOrUndef(e.target.value))} placeholder="Non millésimé" />
        </label>
        <div className="field">
          <span>{editing ? 'Quantité en stock' : 'Nombre de bouteilles'}</span>
          <Stepper value={w.quantity} onChange={(v) => set('quantity', v)} />
        </div>
      </div>
      <div className="grid2">
        <label className="field">
          <span>Contenance</span>
          <select value={w.size} onChange={(e) => set('size', Number(e.target.value))}>
            {SIZES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Prix unitaire (€)</span>
          <input type="text" inputMode="decimal" value={w.price ?? ''} onChange={(e) => set('price', numOrUndef(e.target.value))} placeholder="Facultatif" />
        </label>
      </div>

      <button type="button" className="link-btn" onClick={() => setMore(!more)}>
        {more ? '▾ Moins de détails' : '▸ Plus de détails (apogée, cépages, photo…)'}
      </button>

      {more && (
        <>
          <div className="grid2">
            <label className="field">
              <span>À boire à partir de</span>
              <input type="number" inputMode="numeric" value={w.drinkFrom ?? ''} onChange={(e) => set('drinkFrom', numOrUndef(e.target.value))} placeholder={suggestion.from ? String(suggestion.from) : 'Année'} />
            </label>
            <label className="field">
              <span>Jusqu'en</span>
              <input type="number" inputMode="numeric" value={w.drinkUntil ?? ''} onChange={(e) => set('drinkUntil', numOrUndef(e.target.value))} placeholder={suggestion.until ? String(suggestion.until) : 'Année'} />
            </label>
          </div>
          {suggestion.from && !w.drinkFrom && !w.drinkUntil && (
            <button type="button" className="link-btn" onClick={() => setW((p) => ({ ...p, drinkFrom: suggestion.from, drinkUntil: suggestion.until }))}>
              Utiliser l'estimation {suggestion.from}–{suggestion.until} (indicative, selon la couleur)
            </button>
          )}
          <label className="field">
            <span>Cépages</span>
            <input value={w.grapes ?? ''} onChange={(e) => set('grapes', e.target.value)} placeholder="Ex. Chenin" />
          </label>
          <label className="field">
            <span>Acheté chez</span>
            <input list="dl-suppliers" value={w.supplier ?? ''} onChange={(e) => set('supplier', e.target.value)} placeholder="Caviste, salon, domaine…" />
          </label>
          <label className="field">
            <span>Notes</span>
            <textarea rows={3} value={w.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
          </label>
          <div className="field">
            <span>Photo de l'étiquette</span>
            <div className="row">
              {w.photo && <img className="thumb lg" src={w.photo} alt="Étiquette" />}
              <label className="btn ghost">
                📷 {w.photo ? 'Changer' : 'Prendre une photo'}
                <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
              </label>
              {w.photo && <button type="button" className="btn ghost" onClick={() => set('photo', undefined)}>Retirer</button>}
            </div>
          </div>
        </>
      )}

      <datalist id="dl-producers">{lists.producers.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-appellations">{lists.appellations.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-regions">{lists.regions.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-suppliers">{lists.suppliers.map((v) => <option key={v} value={v} />)}</datalist>

      <div className="actions sticky">
        <button type="button" className="btn ghost" onClick={() => navigate(-1)}>Annuler</button>
        {!editing && <button type="button" className="btn ghost" onClick={(e) => submit(e, true)}>Enregistrer + autre</button>}
        <button type="submit" className="btn primary">Enregistrer</button>
      </div>
    </form>
  );
}

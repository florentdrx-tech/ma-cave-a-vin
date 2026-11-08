import { db, type Wine, type WineColor } from './db';

/** Analyse un CSV (séparateur ; , ou tabulation détecté automatiquement, guillemets gérés). */
export function parseCSV(text: string): string[][] {
  text = text.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0];
  const sep = [';', '\t', ','].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Noms de colonnes reconnus (français / anglais, exports d'applications courantes). */
const SYNONYMS: Record<string, string[]> = {
  producer: ['domaine', 'producteur', 'chateau', 'producer', 'winery', 'proprietaire', 'viticulteur'],
  name: ['cuvee', 'nom', 'name', 'vin', 'wine', 'designation', 'libelle'],
  appellation: ['appellation', 'aoc', 'aop', 'denomination'],
  region: ['region', 'vignoble', 'area'],
  color: ['couleur', 'color', 'colour', 'type', 'typedevin'],
  vintage: ['millesime', 'vintage', 'annee', 'year'],
  quantity: ['quantite', 'quantity', 'qte', 'qty', 'stock', 'nombre', 'nb', 'bouteilles', 'nbbouteilles', 'enstock'],
  size: ['contenance', 'format', 'taille', 'size', 'volume', 'contenancecl'],
  price: ['prix', 'price', 'prixachat', 'prixdachat', 'cout', 'prixunitaire'],
  supplier: ['fournisseur', 'achetechez', 'caviste', 'lieudachat', 'supplier', 'store', 'provenance'],
  drinkFrom: ['apogeedebut', 'aboireapartirde', 'debutapogee', 'boiredes', 'from', 'drinkfrom', 'gardedebut'],
  drinkUntil: ['apogeefin', 'aboirejusqua', 'finapogee', 'boireavant', 'until', 'drinkuntil', 'gardefin', 'aboireavant'],
  grapes: ['cepages', 'cepage', 'grapes', 'grape', 'varietal'],
  notes: ['notes', 'note', 'commentaire', 'commentaires', 'comments', 'remarques'],
};

export function guessMapping(header: string[]): Record<number, keyof typeof SYNONYMS | ''> {
  const map: Record<number, keyof typeof SYNONYMS | ''> = {};
  const used = new Set<string>();
  header.forEach((h, i) => {
    const n = norm(h);
    let found: string | undefined = Object.keys(SYNONYMS).find((k) => !used.has(k) && SYNONYMS[k].includes(n));
    if (!found) found = Object.keys(SYNONYMS).find((k) => !used.has(k) && SYNONYMS[k].some((s) => s.length > 3 && n.includes(s)));
    if (found) used.add(found);
    map[i] = (found as keyof typeof SYNONYMS) ?? '';
  });
  return map;
}

export const FIELD_LABELS: Record<string, string> = {
  producer: 'Domaine', name: 'Cuvée', appellation: 'Appellation', region: 'Région', color: 'Couleur', vintage: 'Millésime',
  quantity: 'Quantité', size: 'Contenance', price: 'Prix', supplier: 'Fournisseur', drinkFrom: 'Apogée début',
  drinkUntil: 'Apogée fin', grapes: 'Cépages', notes: 'Notes',
};

function toColor(s: string): WineColor {
  const n = norm(s);
  if (n.includes('effervescent') || n.includes('champagne') || n.includes('petillant') || n.includes('sparkling') || n.includes('cremant') || n.includes('mousseux')) return 'effervescent';
  if (n.includes('rose')) return 'rose';
  if (n.includes('blanc') || n.includes('white')) {
    if (n.includes('liquoreux') || n.includes('moelleux') || n.includes('doux')) return 'liquoreux';
    return 'blanc';
  }
  if (n.includes('liquoreux') || n.includes('moelleux') || n.includes('doux') || n.includes('sweet')) return 'liquoreux';
  return 'rouge';
}

function toNum(s: string): number | undefined {
  const v = parseFloat(s.replace(/\s/g, '').replace(',', '.').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(v) ? v : undefined;
}

function toSize(s: string): number {
  const v = toNum(s);
  if (v === undefined) return 75;
  if (/l\b|litre/i.test(s) && v < 10) return v * 100; // 1,5 L -> 150 cl
  if (/ml/i.test(s)) return v / 10;
  return v < 10 ? v * 100 : v;
}

export function rowsToWines(rows: string[][], mapping: Record<number, string>): Wine[] {
  const now = Date.now();
  return rows.map((r) => {
    const get = (f: string) => {
      const idx = Object.keys(mapping).find((k) => mapping[Number(k)] === f);
      return idx === undefined ? '' : (r[Number(idx)] ?? '').trim();
    };
    const year = (f: string) => {
      const v = toNum(get(f));
      return v && v > 1800 && v < 2200 ? Math.round(v) : undefined;
    };
    const qty = toNum(get('quantity'));
    return {
      producer: get('producer'),
      name: get('name'),
      appellation: get('appellation'),
      region: get('region'),
      color: toColor(get('color') || get('name')),
      vintage: year('vintage'),
      quantity: qty === undefined ? 1 : Math.max(0, Math.round(qty)),
      size: get('size') ? toSize(get('size')) : 75,
      price: toNum(get('price')),
      supplier: get('supplier') || undefined,
      drinkFrom: year('drinkFrom'),
      drinkUntil: year('drinkUntil'),
      grapes: get('grapes') || undefined,
      notes: get('notes') || undefined,
      createdAt: now,
      updatedAt: now,
    } satisfies Wine;
  }).filter((w) => w.producer || w.name || w.appellation);
}

export async function importWines(wines: Wine[]) {
  await db.transaction('rw', db.wines, db.movements, async () => {
    for (const w of wines) {
      const id = await db.wines.add(w);
      if (w.quantity > 0) await db.movements.add({ wineId: id, type: 'in', qty: w.quantity, date: w.createdAt, note: 'Import' });
    }
  });
}

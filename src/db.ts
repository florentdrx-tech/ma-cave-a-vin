import Dexie, { type Table } from 'dexie';
import { decantSentence, effectiveAdvice, estimateWindow, serveSentence, type Advice } from './advice';

export type WineColor = 'rouge' | 'blanc' | 'rose' | 'effervescent' | 'liquoreux';

export const COLORS: { value: WineColor; label: string; hex: string }[] = [
  { value: 'rouge', label: 'Rouge', hex: '#8e1b32' },
  { value: 'blanc', label: 'Blanc', hex: '#e2c86a' },
  { value: 'rose', label: 'Rosé', hex: '#ec9aa6' },
  { value: 'effervescent', label: 'Effervescent', hex: '#cfd8a6' },
  { value: 'liquoreux', label: 'Liquoreux', hex: '#d99a2b' },
];

export interface Wine {
  id?: number;
  name: string; // cuvée
  producer: string; // domaine / château
  appellation: string;
  region: string;
  color: WineColor;
  vintage?: number; // millésime (vide = non millésimé)
  size: number; // contenance en cl
  quantity: number; // bouteilles en stock
  price?: number; // prix d'achat unitaire
  supplier?: string;
  drinkFrom?: number; // année de début d'apogée
  drinkUntil?: number; // année de fin d'apogée
  grapes?: string;
  notes?: string;
  photo?: string; // photo prise avec l'appareil (miniature dataURL)
  labelImage?: string; // image d'étiquette affichée sur la bouteille (dataURL ou adresse web)
  advice?: Advice; // conseils de service (description, accords, carafe, température)
  createdAt: number;
  updatedAt: number;
}

export interface Rack {
  id?: number;
  name: string;
  rows: number;
  cols: number;
  capacity: number; // bouteilles par case (1 = casier classique, plus pour un casier en vrac)
}

export interface Placement {
  id?: number;
  wineId: number;
  rackId: number;
  row: number;
  col: number;
}

export interface Movement {
  id?: number;
  wineId: number;
  type: 'in' | 'out';
  qty: number;
  date: number;
  note?: string;
}

export interface Tasting {
  id?: number;
  wineId: number;
  date: number;
  rating: number; // 0..5 (demi-étoiles)
  notes: string;
  pairing?: string;
}

export interface Reading {
  id?: number;
  date: number;
  temp: number;
  humidity?: number;
  source: 'manuel' | 'bluetooth';
}

class CaveDB extends Dexie {
  wines!: Table<Wine, number>;
  racks!: Table<Rack, number>;
  placements!: Table<Placement, number>;
  movements!: Table<Movement, number>;
  tastings!: Table<Tasting, number>;
  readings!: Table<Reading, number>;

  constructor() {
    super('ma-cave-a-vin');
    this.version(1).stores({
      wines: '++id, producer, appellation, region, color, vintage, drinkUntil, updatedAt',
      racks: '++id',
      placements: '++id, wineId, rackId, [rackId+row+col]',
      movements: '++id, wineId, date',
      tastings: '++id, wineId, date',
      readings: '++id, date',
    });
    this.version(2).upgrade((tx) =>
      tx.table('wines').toCollection().modify((w: Wine) => {
        if (!COLORS.some((c) => c.value === w.color)) {
          const n = String(w.color ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          w.color = /efferv|champ|cremant/.test(n) ? 'effervescent' : /liquor|moelleu/.test(n) ? 'liquoreux' : /rose/.test(n) ? 'rose' : /blanc/.test(n) ? 'blanc' : 'rouge';
        }
      }),
    );
  }
}

export const db = new CaveDB();

/* ---------- Opérations métier ---------- */

export async function saveWine(wine: Wine, addedQty?: number): Promise<number> {
  const now = Date.now();
  return db.transaction('rw', db.wines, db.movements, db.placements, async () => {
    if (wine.id) {
      const before = await db.wines.get(wine.id);
      await db.wines.put({ ...wine, updatedAt: now });
      const diff = wine.quantity - (before?.quantity ?? wine.quantity);
      if (diff !== 0) {
        await db.movements.add({ wineId: wine.id, type: diff > 0 ? 'in' : 'out', qty: Math.abs(diff), date: now, note: 'Correction d\'inventaire' });
        const placed = await db.placements.where('wineId').equals(wine.id).toArray();
        if (placed.length > wine.quantity) await db.placements.bulkDelete(placed.slice(wine.quantity).map((p) => p.id!));
      }
      return wine.id;
    }
    const id = await db.wines.add({ ...wine, createdAt: now, updatedAt: now });
    const qty = addedQty ?? wine.quantity;
    if (qty > 0) await db.movements.add({ wineId: id, type: 'in', qty, date: now, note: 'Ajout' });
    return id;
  });
}

export async function addBottles(wineId: number, qty: number, note = 'Achat') {
  await db.transaction('rw', db.wines, db.movements, async () => {
    const w = await db.wines.get(wineId);
    if (!w) return;
    await db.wines.update(wineId, { quantity: w.quantity + qty, updatedAt: Date.now() });
    await db.movements.add({ wineId, type: 'in', qty, date: Date.now(), note });
  });
}

/** Sort une bouteille. Si placementId est fourni, libère cet emplacement ; sinon libère
 *  un emplacement uniquement si toutes les bouteilles restantes ne tiennent plus. */
export async function drinkBottle(wineId: number, placementId?: number, note = 'Bue') {
  await db.transaction('rw', db.wines, db.movements, db.placements, async () => {
    const w = await db.wines.get(wineId);
    if (!w || w.quantity <= 0) return;
    const newQty = w.quantity - 1;
    await db.wines.update(wineId, { quantity: newQty, updatedAt: Date.now() });
    await db.movements.add({ wineId, type: 'out', qty: 1, date: Date.now(), note });
    if (placementId) {
      await db.placements.delete(placementId);
    } else {
      const placed = await db.placements.where('wineId').equals(wineId).toArray();
      if (placed.length > newQty) await db.placements.bulkDelete(placed.slice(newQty).map((p) => p.id!));
    }
  });
}

export async function deleteWine(wineId: number) {
  await db.transaction('rw', [db.wines, db.placements, db.movements, db.tastings], async () => {
    await db.placements.where('wineId').equals(wineId).delete();
    await db.movements.where('wineId').equals(wineId).delete();
    await db.tastings.where('wineId').equals(wineId).delete();
    await db.wines.delete(wineId);
  });
}

export async function deleteRack(rackId: number) {
  await db.transaction('rw', db.racks, db.placements, async () => {
    await db.placements.where('rackId').equals(rackId).delete();
    await db.racks.delete(rackId);
  });
}

/* ---------- Apogée ---------- */

export type DrinkStatus = 'jeune' | 'apogee' | 'urgent' | 'passe' | 'inconnu';

/** Fenêtre d'apogée : celle saisie, sinon l'estimation selon l'appellation et le millésime. */
export function drinkWindow(w: Wine): { from?: number; until?: number; estimated: boolean } {
  if (w.drinkFrom || w.drinkUntil) return { from: w.drinkFrom, until: w.drinkUntil, estimated: false };
  return { ...estimateWindow(w), estimated: true };
}

export function drinkStatus(w: Wine, year = new Date().getFullYear()): DrinkStatus {
  const { from, until } = drinkWindow(w);
  if (!from && !until) return 'inconnu';
  if (until && year > until) return 'passe';
  if (from && year < from) return 'jeune';
  if (until && until - year <= 1) return 'urgent';
  return 'apogee';
}

export const STATUS_LABEL: Record<DrinkStatus, string> = {
  jeune: 'À garder',
  apogee: 'À boire',
  urgent: 'À boire vite',
  passe: 'Apogée dépassée',
  inconnu: 'Apogée non renseignée',
};

/** Fenêtre de garde indicative (en années après le millésime) selon la couleur. */
export function suggestWindow(color: WineColor, vintage?: number): { from?: number; until?: number } {
  if (!vintage) return {};
  const table: Record<WineColor, [number, number]> = {
    rouge: [3, 10],
    blanc: [1, 5],
    rose: [0, 2],
    effervescent: [1, 6],
    liquoreux: [5, 25],
  };
  const [a, b] = table[color];
  return { from: vintage + a, until: vintage + b };
}

/* ---------- Export / import ---------- */

export async function exportJSON(): Promise<string> {
  const data = {
    app: 'ma-cave-a-vin',
    version: 1,
    exportedAt: new Date().toISOString(),
    wines: await db.wines.toArray(),
    racks: await db.racks.toArray(),
    placements: await db.placements.toArray(),
    movements: await db.movements.toArray(),
    tastings: await db.tastings.toArray(),
    readings: await db.readings.toArray(),
  };
  return JSON.stringify(data, null, 2);
}

export async function importJSON(text: string) {
  const data = JSON.parse(text);
  if (data.app !== 'ma-cave-a-vin') throw new Error('Fichier non reconnu');
  await db.transaction('rw', [db.wines, db.racks, db.placements, db.movements, db.tastings, db.readings], async () => {
    await Promise.all([db.wines.clear(), db.racks.clear(), db.placements.clear(), db.movements.clear(), db.tastings.clear(), db.readings.clear()]);
    await db.wines.bulkAdd(data.wines ?? []);
    await db.racks.bulkAdd(data.racks ?? []);
    await db.placements.bulkAdd(data.placements ?? []);
    await db.movements.bulkAdd(data.movements ?? []);
    await db.tastings.bulkAdd(data.tastings ?? []);
    await db.readings.bulkAdd(data.readings ?? []);
  });
}

function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? '' : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportCSV(): Promise<string> {
  const wines = await db.wines.toArray();
  const head = ['Domaine', 'Cuvée', 'Appellation', 'Région', 'Couleur', 'Millésime', 'Contenance (cl)', 'Quantité', 'Prix', 'Fournisseur', 'Apogée début', 'Apogée fin', 'Cépages', 'Notes',
    'Description', 'Accords', 'Température de service', 'Carafe'];
  const rows = wines.map((w) => {
    const a = effectiveAdvice(w);
    const win = drinkWindow(w);
    return [w.producer, w.name, w.appellation, w.region, w.color, w.vintage, w.size, w.quantity, w.price, w.supplier, win.from, win.until, w.grapes, w.notes,
      a.description, a.pairings, serveSentence(a.serveMin, a.serveMax), decantSentence(a.decant, a.aeration)].map(csvCell).join(';');
  });
  return '﻿' + [head.join(';'), ...rows].join('\n');
}

export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Réduit une photo d'étiquette pour la stocker localement sans alourdir la base. */
export function resizeImage(file: File, max = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function wineTitle(w: Wine) {
  return [w.producer, w.name].filter(Boolean).join(' – ') || w.appellation || 'Vin sans nom';
}

export function colorHex(c: WineColor) {
  return COLORS.find((x) => x.value === c)?.hex ?? '#999';
}

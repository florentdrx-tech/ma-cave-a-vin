import type { WineColor } from './db';
import { APPELLATIONS, GRAPES, norm, squash } from './appellations';

/** Informations lues sur une étiquette. Les champs absents n'ont pas été reconnus. */
export interface LabelInfo {
  producer?: string;
  name?: string;
  appellation?: string;
  region?: string;
  color?: WineColor;
  vintage?: number;
  size?: number;
  grapes?: string;
}

/* ---------- Réglages de la lecture par IA (stockés sur l'appareil) ---------- */

const KEY_STORAGE = 'cave.anthropicKey';
const MODEL_STORAGE = 'cave.anthropicModel';

export const AI_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (le plus précis)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (le moins cher)' },
];

function safeGet(k: string) {
  try {
    return localStorage.getItem(k) ?? '';
  } catch {
    return '';
  }
}
function safeSet(k: string, v: string) {
  try {
    if (v) localStorage.setItem(k, v);
    else localStorage.removeItem(k);
  } catch {
    /* stockage indisponible */
  }
}

export const getApiKey = () => safeGet(KEY_STORAGE);
export const setApiKey = (v: string) => safeSet(KEY_STORAGE, v.trim());
export const getAiModel = () => safeGet(MODEL_STORAGE) || AI_MODELS[0].id;
export const setAiModel = (v: string) => safeSet(MODEL_STORAGE, v);

/* ---------- Point d'entrée ---------- */

export type ScanMode = 'ia' | 'ocr';

export async function scanLabel(
  image: string,
  knownProducers: string[],
  onProgress?: (msg: string) => void,
): Promise<{ info: LabelInfo; mode: ScanMode; rawText?: string }> {
  const key = getApiKey();
  if (key) {
    onProgress?.("Lecture de l'étiquette par l'IA…");
    return { info: await aiScan(image, key, getAiModel()), mode: 'ia' };
  }
  const text = await ocr(image, onProgress);
  return { info: parseLabelText(text, knownProducers), mode: 'ocr', rawText: text };
}

/* ---------- Lecture par l'IA (Claude), avec la clé de l'utilisateur ---------- */

async function aiScan(image: string, apiKey: string, model: string): Promise<LabelInfo> {
  const [{ default: Anthropic }, { zodOutputFormat }, { z }] = await Promise.all([
    import('@anthropic-ai/sdk'),
    import('@anthropic-ai/sdk/helpers/zod'),
    import('zod'),
  ]);

  const Schema = z.object({
    producer: z.string().describe('Domaine, château ou maison. Chaîne vide si absent.'),
    name: z.string().describe('Nom de la cuvée, sans le domaine ni l\'appellation. Chaîne vide si absent.'),
    appellation: z.string().describe('Appellation (AOC/AOP/IGP) telle qu\'écrite officiellement, sans « Appellation … Contrôlée ».'),
    region: z.string().describe('Région viticole (Bordeaux, Bourgogne, Loire, Rhône, Champagne, Alsace…).'),
    color: z.enum(['rouge', 'blanc', 'rose', 'effervescent', 'liquoreux', '']),
    vintage: z.number().int().nullable().describe('Millésime, ou null si non millésimé ou illisible.'),
    size_cl: z.number().nullable().describe('Contenance en centilitres, ou null.'),
    grapes: z.string().describe('Cépages mentionnés, séparés par des virgules. Chaîne vide si absent.'),
  });

  const media = image.match(/^data:(image\/[a-z+]+);base64,/)?.[1] ?? 'image/jpeg';
  const data = image.replace(/^data:[^,]+,/, '');

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  try {
    const response = await client.messages.parse({
      model,
      max_tokens: 4000,
      output_config: { format: zodOutputFormat(Schema), effort: 'low' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: media as 'image/jpeg', data } },
            {
              type: 'text',
              text:
                "Voici la photo d'une étiquette de vin. Relève les informations qui y figurent. " +
                "N'invente rien : laisse vide ce qui n'est pas lisible. Tu peux déduire la région et la couleur de l'appellation " +
                "quand elles ne sont pas écrites.",
            },
          ],
        },
      ],
    });
    if (response.stop_reason === 'refusal') throw new Error("L'IA n'a pas pu analyser cette image.");
    const p = response.parsed_output;
    if (!p) throw new Error("Réponse de l'IA illisible.");
    return {
      producer: p.producer || undefined,
      name: p.name || undefined,
      appellation: p.appellation || undefined,
      region: p.region || undefined,
      color: (p.color || undefined) as WineColor | undefined,
      vintage: p.vintage ?? undefined,
      size: p.size_cl ?? undefined,
      grapes: p.grapes || undefined,
    };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('Clé API refusée : vérifiez-la dans ⚙️ Réglages.');
    if (e instanceof Anthropic.RateLimitError) throw new Error('Trop de demandes, réessayez dans un instant.');
    if (e instanceof Anthropic.APIConnectionError) throw new Error('Pas de connexion internet.');
    if (e instanceof Anthropic.APIError) throw new Error(`Erreur du service (${e.status}) : ${e.message}`);
    throw e;
  }
}

/* ---------- Lecture du texte directement sur l'appareil (gratuit) ---------- */

async function ocr(image: string, onProgress?: (msg: string) => void): Promise<string> {
  onProgress?.('Chargement de la lecture de texte…');
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('fra', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(`Lecture du texte… ${Math.round(m.progress * 100)} %`);
    },
  });
  try {
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

const PRODUCER_RE = /\b(ch[aâ]teau|chateau|ch\.|domaine|dom\.|clos|mas|maison|caves?|vignobles?|famille|cellier|bodega|weingut|tenuta)\b/i;

function titleCase(s: string) {
  const small = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'sur', 'sous', "d'", "l'"]);
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w, i) => (i > 0 && small.has(w) ? w : w.replace(/(^|[-'])(\p{L})/gu, (_m, a, b) => a + b.toUpperCase())))
    .join(' ');
}

function cleanLine(s: string) {
  return s.replace(/[^\p{L}\p{N}'’\-., ]/gu, ' ').replace(/\s+/g, ' ').trim();
}

/** Extrait les informations d'un texte lu par OCR (souvent bruité). */
export function parseLabelText(text: string, knownProducers: string[] = []): LabelInfo {
  const info: LabelInfo = {};
  const lines = text.split(/\n+/).map(cleanLine).filter((l) => l.length > 1);
  const flat = norm(lines.join(' '));
  const squashed = squash(text);
  const year = new Date().getFullYear();

  // Millésime : première année plausible, en ignorant « depuis 1850 », « fondé en … »
  const years = [...flat.matchAll(/(?<!depuis |fonde en |since |founded )\b(19[4-9]\d|20[0-9]\d)\b/g)].map((m) => Number(m[1])).filter((y) => y <= year);
  if (years.length) info.vintage = years[0];

  // Appellation : la plus longue trouvée dans le texte
  const app = [...APPELLATIONS].sort((a, b) => b.name.length - a.name.length).find((a) => squashed.includes(squash(a.name)));
  if (app) {
    info.appellation = app.name;
    info.region = app.region;
    info.color = app.color;
  } else {
    const m = flat.match(/appellation\s+(.{3,40}?)\s+(controlee|protegee|d'origine)/);
    if (m) info.appellation = titleCase(m[1]);
  }

  // Domaine : un producteur déjà connu, sinon une ligne « Château X », « Domaine Y »…
  const known = knownProducers.filter(Boolean).sort((a, b) => b.length - a.length).find((p) => squash(p).length > 3 && squashed.includes(squash(p)));
  if (known) info.producer = known;
  else {
    const idx = lines.findIndex((l) => PRODUCER_RE.test(l) && !/mis en bouteille|bottled|fond[ée]e?|depuis|since|founded|propri[ée]taire|r[ée]coltant/i.test(norm(l)));
    if (idx >= 0) {
      let line = lines[idx];
      // « CHÂTEAU » seul sur sa ligne, le nom étant sur la ligne suivante
      if (line.trim().split(/\s+/).length === 1 && lines[idx + 1]) line = `${line} ${lines[idx + 1]}`;
      const start = line.search(PRODUCER_RE);
      info.producer = titleCase(line.slice(start).split(/\s{2,}| - /)[0].slice(0, 50))
        .replace(/^Ch\. /, 'Château ')
        .replace(/^Chateau\b/, 'Château');
    }
  }

  // Cuvée
  for (const l of lines) {
    const m = norm(l).match(/cuvee\s+(.{3,40})/);
    if (m) {
      info.name = titleCase(l.slice(l.length - m[1].length));
      break;
    }
  }

  // Couleur explicite
  if (/champagne|cremant|brut|petillant|mousseux|methode traditionnelle/.test(flat)) info.color = 'effervescent';
  else if (/\brose\b/.test(flat)) info.color = 'rose';
  else if (/liquoreux|moelleux|vendanges tardives|selection de grains nobles/.test(flat)) info.color = 'liquoreux';
  else if (/\bblanc\b|white/.test(flat)) info.color = info.color === 'liquoreux' ? 'liquoreux' : 'blanc';
  else if (/\brouge\b|\bred\b/.test(flat)) info.color = 'rouge';

  // Contenance
  const size = flat.match(/(\d+(?:[.,]\d+)?)\s*(cl|ml|l)\b/);
  if (size) {
    const v = Number(size[1].replace(',', '.'));
    const cl = size[2] === 'ml' ? v / 10 : size[2] === 'l' ? v * 100 : v;
    if ([37.5, 50, 75, 150, 300].includes(cl)) info.size = cl;
  }

  // Cépages
  const grapes = GRAPES.filter((g) => squashed.includes(squash(g)));
  if (grapes.length) info.grapes = [...new Set(grapes)].join(', ');

  return info;
}

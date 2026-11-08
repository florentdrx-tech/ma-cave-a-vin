import type { Wine, WineColor } from './db';
import { norm } from './appellations';

/* ---------- Types ---------- */

/** non : servir directement · ouvrir : déboucher à l'avance · carafer : aérer en carafe · decanter : séparer le dépôt (vieux vin) */
export type Decant = 'non' | 'ouvrir' | 'carafer' | 'decanter';

/** Conseils de service enregistrés sur un vin (saisis à la main ou proposés par l'IA). */
export interface Advice {
  description?: string;
  pairings?: string;
  decant?: Decant;
  aeration?: number; // minutes avant le service
  serveMin?: number;
  serveMax?: number;
  source?: 'ia' | 'manuel';
}

export const DECANT_LABEL: Record<Decant, string> = {
  non: 'Servir directement',
  ouvrir: 'Déboucher à l\'avance',
  carafer: 'Carafer pour l\'aérer',
  decanter: 'Décanter délicatement (dépôt)',
};

/* ---------- Catégories de plats (accords et recherche « quel vin avec… ») ---------- */

export const DISHES = [
  { id: 'viande-rouge', label: 'Viande rouge', emoji: '🥩', words: ['boeuf', 'bœuf', 'entrecote', 'côte de bœuf', 'viande rouge', 'steak', 'tournedos', 'filet'] },
  { id: 'agneau', label: 'Agneau', emoji: '🐑', words: ['agneau', 'gigot', 'souris'] },
  { id: 'gibier', label: 'Gibier', emoji: '🦌', words: ['gibier', 'chevreuil', 'sanglier', 'lievre', 'lièvre', 'faisan', 'perdreau', 'pigeon', 'biche'] },
  { id: 'volaille', label: 'Volaille', emoji: '🍗', words: ['volaille', 'poulet', 'poularde', 'chapon', 'dinde', 'pintade', 'coq', 'canard', 'magret'] },
  { id: 'porc', label: 'Porc & charcuterie', emoji: '🥓', words: ['porc', 'charcuterie', 'jambon', 'saucisse', 'rillettes', 'rillons', 'terrine', 'choucroute', 'cochon'] },
  { id: 'mijote', label: 'Plats mijotés', emoji: '🍲', words: ['mijot', 'daube', 'bourguignon', 'cassoulet', 'pot-au-feu', 'civet', 'ragout', 'ragoût', 'tajine', 'confit'] },
  { id: 'grillades', label: 'Grillades & barbecue', emoji: '🔥', words: ['grillade', 'barbecue', 'grillé', 'plancha', 'brochette'] },
  { id: 'poisson', label: 'Poisson', emoji: '🐟', words: ['poisson', 'saumon', 'bar', 'sole', 'turbot', 'cabillaud', 'thon', 'truite', 'brochet', 'lotte', 'daurade'] },
  { id: 'fruits-de-mer', label: 'Fruits de mer', emoji: '🦞', words: ['fruits de mer', 'huitre', 'huître', 'homard', 'langouste', 'crevette', 'saint-jacques', 'coquillage', 'moule', 'crustac', 'crabe'] },
  { id: 'fromage', label: 'Fromages', emoji: '🧀', words: ['fromage', 'comte', 'comté', 'brie', 'camembert', 'munster', 'epoisses', 'époisses', 'reblochon', 'beaufort'] },
  { id: 'chevre', label: 'Chèvre', emoji: '🐐', words: ['chevre', 'chèvre', 'crottin', 'sainte-maure', 'valençay'] },
  { id: 'bleu', label: 'Bleus', emoji: '🫐', words: ['roquefort', 'bleu', 'fourme', 'gorgonzola', 'stilton'] },
  { id: 'foie-gras', label: 'Foie gras', emoji: '🦆', words: ['foie gras'] },
  { id: 'asiatique', label: 'Cuisine épicée / asiatique', emoji: '🌶️', words: ['epice', 'épicé', 'asiatique', 'curry', 'thai', 'thaï', 'indien', 'exotique', 'sushi'] },
  { id: 'vegetarien', label: 'Légumes & champignons', emoji: '🍄', words: ['legume', 'légume', 'champignon', 'truffe', 'risotto', 'vegetarien', 'végétarien', 'asperge', 'cèpe'] },
  { id: 'mediterraneen', label: 'Cuisine méditerranéenne', emoji: '🫒', words: ['mediterran', 'méditerran', 'provençal', 'ratatouille', 'bouillabaisse', 'tapenade', 'salade', 'pizza', 'pâtes'] },
  { id: 'aperitif', label: 'Apéritif', emoji: '🥂', words: ['aperitif', 'apéritif', 'amuse-bouche', 'gougère'] },
  { id: 'dessert', label: 'Desserts', emoji: '🍰', words: ['dessert', 'tarte', 'fruit', 'patisserie', 'pâtisserie', 'crème brûlée', 'tatin'] },
  { id: 'chocolat', label: 'Chocolat', emoji: '🍫', words: ['chocolat'] },
] as const;

export type DishId = (typeof DISHES)[number]['id'];

/* ---------- Styles de vin ---------- */

type Body = 'leger' | 'moyen' | 'puissant';

interface Style {
  description: string;
  dishes: DishId[];
  pairingText: string;
  serve: [number, number];
  body: Body;
  /** Années de garde après le millésime : [début, fin] de l'apogée. */
  garde: [number, number];
}

const S = (description: string, pairingText: string, dishes: DishId[], serve: [number, number], body: Body, garde: [number, number]): Style => ({
  description, pairingText, dishes, serve, body, garde,
});

const STYLES = {
  bordeauxGauche: S(
    'Rouge de la rive gauche bordelaise, dominé par le cabernet sauvignon : cassis, cèdre, graphite, tanins fermes qui s\'assouplissent avec les années.',
    'Côte de bœuf, gigot d\'agneau, gibier à plume, fromages affinés.', ['viande-rouge', 'agneau', 'gibier', 'fromage'], [16, 18], 'puissant', [7, 30]),
  bordeauxDroite: S(
    'Rouge de la rive droite, à majorité de merlot : prune, fruits noirs, truffe, tanins veloutés et texture ample.',
    'Magret de canard, filet de bœuf, plats aux champignons ou à la truffe, fromages.', ['viande-rouge', 'volaille', 'vegetarien', 'fromage'], [16, 18], 'puissant', [5, 20]),
  bordeaux: S(
    'Rouge bordelais d\'assemblage (merlot, cabernets) : fruits rouges et noirs, tanins souples.',
    'Viandes rouges, volailles rôties, charcuterie, fromages à pâte pressée.', ['viande-rouge', 'volaille', 'porc', 'fromage'], [16, 17], 'moyen', [2, 8]),
  bourgogneRouge: S(
    'Pinot noir de Bourgogne : cerise, framboise, sous-bois et épices douces, tanins fins et grande finesse.',
    'Volaille rôtie, bœuf bourguignon, coq au vin, plats aux champignons, époisses.', ['volaille', 'mijote', 'vegetarien', 'fromage'], [15, 17], 'moyen', [3, 15]),
  beaujolais: S(
    'Gamay croquant et gourmand : fruits rouges frais, souplesse, faible tannin.',
    'Charcuterie, cuisine de bistrot, volaille, fromages doux.', ['porc', 'volaille', 'fromage', 'grillades'], [13, 15], 'leger', [1, 6]),
  rhoneNord: S(
    'Syrah du Rhône septentrional : mûre, violette, poivre noir, olive, tanins serrés.',
    'Gibier, agneau, viandes grillées, plats poivrés.', ['gibier', 'agneau', 'grillades', 'viande-rouge'], [16, 18], 'puissant', [4, 18]),
  rhoneSud: S(
    'Rouge du Rhône méridional à base de grenache : fruits noirs mûrs, garrigue, épices, chaleur et rondeur.',
    'Daube provençale, agneau aux herbes, gibier, cuisine du Sud.', ['mijote', 'agneau', 'gibier', 'mediterraneen'], [16, 18], 'puissant', [3, 15]),
  cotesDuRhone: S(
    'Rouge du Sud gourmand et épicé : fruits rouges mûrs, garrigue, tanins souples.',
    'Grillades, charcuterie, pizza, plats du quotidien.', ['grillades', 'porc', 'mediterraneen'], [15, 17], 'moyen', [1, 5]),
  loireRouge: S(
    'Cabernet franc de Loire : framboise, violette, notes de poivron et de graphite, fraîcheur.',
    'Charcuterie, rillons, volaille, porc rôti, fromages de chèvre secs.', ['porc', 'volaille', 'chevre'], [14, 16], 'leger', [2, 10]),
  sudOuest: S(
    'Rouge puissant du Sud-Ouest (malbec, tannat) : fruits noirs, épices, tanins robustes.',
    'Magret et confit de canard, cassoulet, viandes grillées.', ['volaille', 'mijote', 'grillades', 'viande-rouge'], [16, 18], 'puissant', [4, 15]),
  sudRouge: S(
    'Rouge du Languedoc-Roussillon (syrah, grenache, carignan, mourvèdre) : fruits noirs, garrigue, réglisse.',
    'Grillades, agneau, cassoulet, cuisine méditerranéenne.', ['grillades', 'agneau', 'mijote', 'mediterraneen'], [16, 18], 'moyen', [2, 10]),
  bandol: S(
    'Mourvèdre de Bandol : fruits noirs, cuir, garrigue, tanins puissants. Grand vin de garde.',
    'Daube, gibier, agneau de sept heures.', ['mijote', 'gibier', 'agneau'], [16, 18], 'puissant', [6, 20]),
  rougeLeger: S(
    'Rouge léger et digeste : fruits rouges, fraîcheur, peu de tanins.',
    'Charcuterie, volaille, raclette ou fondue, fromages.', ['porc', 'volaille', 'fromage'], [14, 16], 'leger', [1, 6]),
  chablis: S(
    'Chardonnay de Chablis : vif et minéral, agrumes, pierre à fusil, notes iodées.',
    'Huîtres, fruits de mer, poissons grillés, chèvre.', ['fruits-de-mer', 'poisson', 'chevre'], [10, 12], 'moyen', [2, 10]),
  bourgogneBlanc: S(
    'Chardonnay bourguignon : beurre frais, noisette, fruits blancs, texture ample et belle tension.',
    'Volaille à la crème, poissons nobles en sauce, Saint-Jacques, comté.', ['volaille', 'poisson', 'fruits-de-mer', 'fromage'], [11, 13], 'moyen', [3, 12]),
  sauvignonLoire: S(
    'Sauvignon de Loire : agrumes, bourgeon de cassis, buis, grande fraîcheur minérale.',
    'Crottin de Chavignol, poissons, asperges, fruits de mer.', ['chevre', 'poisson', 'fruits-de-mer', 'vegetarien'], [8, 10], 'leger', [1, 6]),
  chenin: S(
    'Chenin de Loire : coing, pomme, miel, acidité vibrante, du sec au moelleux selon les cuvées.',
    'Poissons en sauce, volaille, cuisine asiatique, rillettes.', ['poisson', 'volaille', 'asiatique', 'porc'], [10, 12], 'moyen', [2, 15]),
  muscadet: S(
    'Melon de Bourgogne : vif, salin et iodé, idéal sur la marée.',
    'Huîtres, moules, fruits de mer, poissons grillés.', ['fruits-de-mer', 'poisson'], [8, 10], 'leger', [1, 5]),
  alsace: S(
    'Blanc d\'Alsace aromatique (riesling, gewurztraminer, pinot gris) : fruits, fleurs, épices, du sec au moelleux.',
    'Choucroute, cuisine asiatique, poissons, munster.', ['porc', 'asiatique', 'poisson', 'fromage'], [8, 10], 'moyen', [2, 10]),
  rhoneBlanc: S(
    'Blanc du Rhône (viognier, marsanne, roussanne) : abricot, fleurs blanches, texture ample et généreuse.',
    'Volaille, poissons nobles, cuisine épicée, fromages.', ['volaille', 'poisson', 'asiatique', 'fromage'], [11, 13], 'moyen', [2, 10]),
  bordeauxBlanc: S(
    'Blanc bordelais (sauvignon, sémillon) : agrumes, fleurs, fraîcheur, parfois boisé pour les grands Graves.',
    'Poissons, fruits de mer, volaille, chèvre.', ['poisson', 'fruits-de-mer', 'volaille', 'chevre'], [10, 12], 'moyen', [1, 8]),
  jura: S(
    'Blanc du Jura (chardonnay, savagnin) : noix, épices, curry, parfois oxydatif.',
    'Comté, volaille aux morilles, poissons de rivière.', ['fromage', 'volaille', 'vegetarien'], [12, 14], 'moyen', [3, 20]),
  blanc: S(
    'Blanc sec : fruits blancs, agrumes, fraîcheur.',
    'Poissons, fruits de mer, volaille, apéritif.', ['poisson', 'fruits-de-mer', 'volaille', 'aperitif'], [10, 12], 'leger', [1, 5]),
  roseProvence: S(
    'Rosé pâle de Provence : agrumes, petits fruits rouges, fraîcheur et légèreté.',
    'Apéritif, cuisine méditerranéenne, grillades, salades d\'été.', ['aperitif', 'mediterraneen', 'grillades', 'poisson'], [8, 10], 'leger', [0, 2]),
  roseGastro: S(
    'Rosé de gastronomie, coloré et vineux : fruits rouges mûrs, épices, de la matière.',
    'Grillades, cuisine épicée, charcuterie, cuisine méditerranéenne.', ['grillades', 'asiatique', 'porc', 'mediterraneen'], [10, 12], 'moyen', [0, 4]),
  champagne: S(
    'Effervescent de méthode traditionnelle : bulles fines, agrumes, brioche, belle fraîcheur.',
    'Apéritif, fruits de mer, poissons, volaille.', ['aperitif', 'fruits-de-mer', 'poisson', 'volaille'], [7, 9], 'moyen', [0, 8]),
  cremant: S(
    'Crémant : bulles vives, fruits frais, fraîcheur.',
    'Apéritif, entrées, desserts aux fruits.', ['aperitif', 'poisson', 'dessert'], [6, 8], 'leger', [0, 4]),
  liquoreux: S(
    'Vin liquoreux : miel, abricot confit, agrumes confits, safran, équilibré par une belle fraîcheur.',
    'Foie gras, roquefort et bleus, desserts aux fruits, cuisine épicée.', ['foie-gras', 'bleu', 'dessert', 'asiatique'], [8, 10], 'moyen', [5, 30]),
  vdnRouge: S(
    'Vin doux naturel rouge : fruits noirs confits, cacao, épices.',
    'Desserts au chocolat, fromages bleus.', ['chocolat', 'bleu', 'dessert'], [14, 16], 'moyen', [3, 30]),
  rouge: S(
    'Vin rouge : fruits rouges et noirs, tanins plus ou moins présents selon l\'élevage.',
    'Viandes, plats mijotés, fromages.', ['viande-rouge', 'mijote', 'fromage'], [15, 17], 'moyen', [2, 8]),
} satisfies Record<string, Style>;

type StyleId = keyof typeof STYLES;

const has = (s: string, ...words: string[]) => words.some((w) => s.includes(w));

export function wineStyle(w: Pick<Wine, 'color' | 'appellation' | 'region' | 'grapes'>): Style {
  const a = norm(`${w.appellation} ${w.grapes ?? ''}`);
  const r = norm(w.region);
  const c: WineColor = w.color;
  const pick = (id: StyleId) => STYLES[id];

  if (c === 'effervescent') return pick(has(a + r, 'champagne') ? 'champagne' : 'cremant');
  if (c === 'liquoreux') return pick(has(a, 'banyuls', 'maury') ? 'vdnRouge' : 'liquoreux');
  if (c === 'rose') return pick(has(a, 'tavel', 'riceys', 'bandol') ? 'roseGastro' : 'roseProvence');

  if (c === 'blanc') {
    if (has(a, 'chablis')) return pick('chablis');
    if (has(a, 'muscadet', 'melon')) return pick('muscadet');
    if (has(a, 'sancerre', 'pouilly-fume', 'menetou', 'quincy', 'reuilly', 'touraine', 'sauvignon') && r.includes('loire')) return pick('sauvignonLoire');
    if (has(a, 'vouvray', 'montlouis', 'savennieres', 'jasnieres', 'saumur', 'anjou', 'chenin')) return pick('chenin');
    if (r.includes('alsace')) return pick('alsace');
    if (r.includes('jura')) return pick('jura');
    if (r.includes('rhone')) return pick('rhoneBlanc');
    if (r.includes('bourgogne')) return pick('bourgogneBlanc');
    if (r.includes('bordeaux')) return pick('bordeauxBlanc');
    return pick('blanc');
  }

  // Rouges
  if (has(a, 'medoc', 'pauillac', 'margaux', 'saint-julien', 'saint-estephe', 'listrac', 'moulis', 'pessac', 'graves')) return pick('bordeauxGauche');
  if (has(a, 'emilion', 'pomerol', 'fronsac', 'castillon')) return pick('bordeauxDroite');
  if (r.includes('bordeaux')) return pick('bordeaux');
  if (r.includes('beaujolais')) return pick('beaujolais');
  if (r.includes('bourgogne')) return pick('bourgogneRouge');
  if (has(a, 'cote-rotie', 'hermitage', 'saint-joseph', 'cornas')) return pick('rhoneNord');
  if (has(a, 'cotes du rhone')) return pick('cotesDuRhone');
  if (r.includes('rhone')) return pick('rhoneSud');
  if (r.includes('loire')) return pick('loireRouge');
  if (r.includes('sud-ouest')) return pick('sudOuest');
  if (has(a, 'bandol')) return pick('bandol');
  if (has(r, 'languedoc', 'roussillon', 'provence', 'corse')) return pick('sudRouge');
  if (has(r, 'jura', 'savoie')) return pick('rougeLeger');
  return pick('rouge');
}

/** Fenêtre d'apogée estimée d'après le style de l'appellation. */
export function estimateWindow(w: Pick<Wine, 'color' | 'appellation' | 'region' | 'grapes' | 'vintage'>): { from?: number; until?: number } {
  if (!w.vintage) return {};
  const [a, b] = wineStyle(w).garde;
  return { from: w.vintage + a, until: w.vintage + b };
}

function autoDecant(style: Style, color: WineColor, age: number): { decant: Decant; aeration?: number } {
  if (color === 'effervescent' || color === 'rose' || color === 'liquoreux') return { decant: 'non' };
  if (color === 'blanc') {
    if (style.body !== 'leger' && age < 4) return { decant: 'ouvrir', aeration: 30 };
    return { decant: 'non' };
  }
  if (style.body === 'leger') return age < 3 ? { decant: 'ouvrir', aeration: 30 } : { decant: 'non' };
  if (style.body === 'moyen') {
    if (age < 5) return { decant: 'carafer', aeration: 60 };
    if (age <= 12) return { decant: 'ouvrir', aeration: 60 };
    return { decant: 'decanter' };
  }
  if (age < 6) return { decant: 'carafer', aeration: 120 };
  if (age <= 15) return { decant: 'carafer', aeration: 60 };
  return { decant: 'decanter' };
}

/** Conseils estimés automatiquement (gratuit, sans connexion). */
export function autoAdvice(w: Wine, year = new Date().getFullYear()): Required<Omit<Advice, 'source' | 'aeration'>> & { aeration?: number; dishes: DishId[] } {
  const style = wineStyle(w);
  const age = w.vintage ? year - w.vintage : 3;
  const d = autoDecant(style, w.color, age);
  return {
    description: style.description,
    pairings: style.pairingText,
    dishes: style.dishes,
    serveMin: style.serve[0],
    serveMax: style.serve[1],
    ...d,
  };
}

/** Conseils affichés : ceux enregistrés (IA ou saisis) priment sur l'estimation automatique. */
export function effectiveAdvice(w: Wine) {
  const auto = autoAdvice(w);
  const a = w.advice ?? {};
  const pairings = a.pairings || auto.pairings;
  return {
    description: a.description || auto.description,
    pairings,
    serveMin: a.serveMin ?? auto.serveMin,
    serveMax: a.serveMax ?? auto.serveMax,
    decant: a.decant ?? auto.decant,
    aeration: a.decant ? a.aeration : auto.aeration,
    dishes: a.pairings ? dishesFromText(pairings) : auto.dishes,
    source: a.source,
    isAuto: !a.source,
  };
}

export function dishesFromText(text: string): DishId[] {
  const t = norm(text);
  return DISHES.filter((d) => d.words.some((w) => t.includes(norm(w)))).map((d) => d.id);
}

export function fmtDuration(min?: number) {
  if (!min) return '';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

/** Phrase courte : « Carafer 2 h avant », « Déboucher 30 min avant »… */
export function decantSentence(decant: Decant, aeration?: number) {
  switch (decant) {
    case 'non': return 'Pas besoin de carafe : servir directement';
    case 'ouvrir': return `Déboucher ${aeration ? fmtDuration(aeration) + ' ' : ''}avant le service`;
    case 'carafer': return `Carafer ${aeration ? fmtDuration(aeration) + ' ' : ''}avant le service`;
    case 'decanter': return 'Décanter délicatement juste avant le service pour séparer le dépôt (bouteille redressée la veille), puis boire sans trop attendre';
  }
}

export function serveSentence(min: number, max: number) {
  return min === max ? `${min} °C` : `${min} à ${max} °C`;
}

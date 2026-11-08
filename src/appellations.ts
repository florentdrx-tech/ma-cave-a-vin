import type { WineColor } from './db';

/**
 * Principales appellations françaises : nom | région | couleur la plus courante.
 * Sert à la reconnaissance des étiquettes, à l'autocomplétion et au choix de la forme de bouteille.
 */
const RAW = `
Margaux|Bordeaux|rouge
Pauillac|Bordeaux|rouge
Saint-Julien|Bordeaux|rouge
Saint-Estèphe|Bordeaux|rouge
Moulis-en-Médoc|Bordeaux|rouge
Listrac-Médoc|Bordeaux|rouge
Haut-Médoc|Bordeaux|rouge
Médoc|Bordeaux|rouge
Pessac-Léognan|Bordeaux|rouge
Graves|Bordeaux|rouge
Saint-Émilion Grand Cru|Bordeaux|rouge
Saint-Émilion|Bordeaux|rouge
Montagne-Saint-Émilion|Bordeaux|rouge
Lussac-Saint-Émilion|Bordeaux|rouge
Puisseguin-Saint-Émilion|Bordeaux|rouge
Pomerol|Bordeaux|rouge
Lalande-de-Pomerol|Bordeaux|rouge
Fronsac|Bordeaux|rouge
Canon-Fronsac|Bordeaux|rouge
Castillon Côtes de Bordeaux|Bordeaux|rouge
Blaye Côtes de Bordeaux|Bordeaux|rouge
Côtes de Bourg|Bordeaux|rouge
Entre-Deux-Mers|Bordeaux|blanc
Bordeaux Supérieur|Bordeaux|rouge
Bordeaux|Bordeaux|rouge
Sauternes|Bordeaux|liquoreux
Barsac|Bordeaux|liquoreux
Loupiac|Bordeaux|liquoreux
Cadillac|Bordeaux|liquoreux
Crémant de Bordeaux|Bordeaux|effervescent
Bergerac|Sud-Ouest|rouge
Pécharmant|Sud-Ouest|rouge
Monbazillac|Sud-Ouest|liquoreux
Cahors|Sud-Ouest|rouge
Madiran|Sud-Ouest|rouge
Pacherenc du Vic-Bilh|Sud-Ouest|liquoreux
Jurançon|Sud-Ouest|liquoreux
Irouléguy|Sud-Ouest|rouge
Gaillac|Sud-Ouest|rouge
Fronton|Sud-Ouest|rouge
Marcillac|Sud-Ouest|rouge
Buzet|Sud-Ouest|rouge
Côtes de Gascogne|Sud-Ouest|blanc
Chablis Grand Cru|Bourgogne|blanc
Chablis Premier Cru|Bourgogne|blanc
Petit Chablis|Bourgogne|blanc
Chablis|Bourgogne|blanc
Irancy|Bourgogne|rouge
Gevrey-Chambertin|Bourgogne|rouge
Chambertin|Bourgogne|rouge
Morey-Saint-Denis|Bourgogne|rouge
Chambolle-Musigny|Bourgogne|rouge
Musigny|Bourgogne|rouge
Clos de Vougeot|Bourgogne|rouge
Vougeot|Bourgogne|rouge
Vosne-Romanée|Bourgogne|rouge
Romanée-Saint-Vivant|Bourgogne|rouge
Échezeaux|Bourgogne|rouge
Nuits-Saint-Georges|Bourgogne|rouge
Marsannay|Bourgogne|rouge
Fixin|Bourgogne|rouge
Côte de Nuits-Villages|Bourgogne|rouge
Hautes-Côtes de Nuits|Bourgogne|rouge
Aloxe-Corton|Bourgogne|rouge
Corton-Charlemagne|Bourgogne|blanc
Corton|Bourgogne|rouge
Pernand-Vergelesses|Bourgogne|rouge
Savigny-lès-Beaune|Bourgogne|rouge
Chorey-lès-Beaune|Bourgogne|rouge
Beaune|Bourgogne|rouge
Pommard|Bourgogne|rouge
Volnay|Bourgogne|rouge
Monthélie|Bourgogne|rouge
Auxey-Duresses|Bourgogne|rouge
Saint-Romain|Bourgogne|blanc
Meursault|Bourgogne|blanc
Puligny-Montrachet|Bourgogne|blanc
Chassagne-Montrachet|Bourgogne|blanc
Bâtard-Montrachet|Bourgogne|blanc
Montrachet|Bourgogne|blanc
Saint-Aubin|Bourgogne|blanc
Santenay|Bourgogne|rouge
Maranges|Bourgogne|rouge
Hautes-Côtes de Beaune|Bourgogne|rouge
Côte de Beaune-Villages|Bourgogne|rouge
Rully|Bourgogne|blanc
Mercurey|Bourgogne|rouge
Givry|Bourgogne|rouge
Montagny|Bourgogne|blanc
Bouzeron|Bourgogne|blanc
Pouilly-Fuissé|Bourgogne|blanc
Pouilly-Loché|Bourgogne|blanc
Pouilly-Vinzelles|Bourgogne|blanc
Saint-Véran|Bourgogne|blanc
Viré-Clessé|Bourgogne|blanc
Mâcon-Villages|Bourgogne|blanc
Mâcon|Bourgogne|blanc
Bourgogne Aligoté|Bourgogne|blanc
Bourgogne Passe-Tout-Grains|Bourgogne|rouge
Coteaux Bourguignons|Bourgogne|rouge
Bourgogne|Bourgogne|rouge
Crémant de Bourgogne|Bourgogne|effervescent
Moulin-à-Vent|Beaujolais|rouge
Morgon|Beaujolais|rouge
Fleurie|Beaujolais|rouge
Chiroubles|Beaujolais|rouge
Chénas|Beaujolais|rouge
Juliénas|Beaujolais|rouge
Saint-Amour|Beaujolais|rouge
Régnié|Beaujolais|rouge
Brouilly|Beaujolais|rouge
Côte de Brouilly|Beaujolais|rouge
Beaujolais-Villages|Beaujolais|rouge
Beaujolais|Beaujolais|rouge
Champagne|Champagne|effervescent
Coteaux Champenois|Champagne|rouge
Rosé des Riceys|Champagne|rose
Alsace Grand Cru|Alsace|blanc
Crémant d'Alsace|Alsace|effervescent
Alsace|Alsace|blanc
Côte-Rôtie|Rhône|rouge
Condrieu|Rhône|blanc
Château-Grillet|Rhône|blanc
Saint-Joseph|Rhône|rouge
Crozes-Hermitage|Rhône|rouge
Hermitage|Rhône|rouge
Cornas|Rhône|rouge
Saint-Péray|Rhône|blanc
Châteauneuf-du-Pape|Rhône|rouge
Gigondas|Rhône|rouge
Vacqueyras|Rhône|rouge
Rasteau|Rhône|rouge
Cairanne|Rhône|rouge
Vinsobres|Rhône|rouge
Lirac|Rhône|rouge
Tavel|Rhône|rose
Beaumes-de-Venise|Rhône|rouge
Muscat de Beaumes-de-Venise|Rhône|liquoreux
Ventoux|Rhône|rouge
Luberon|Rhône|rouge
Costières de Nîmes|Rhône|rouge
Côtes du Rhône Villages|Rhône|rouge
Côtes du Rhône|Rhône|rouge
Clairette de Die|Rhône|effervescent
Sancerre|Loire|blanc
Pouilly-Fumé|Loire|blanc
Menetou-Salon|Loire|blanc
Quincy|Loire|blanc
Reuilly|Loire|blanc
Vouvray|Loire|blanc
Montlouis-sur-Loire|Loire|blanc
Chinon|Loire|rouge
Bourgueil|Loire|rouge
Saint-Nicolas-de-Bourgueil|Loire|rouge
Saumur-Champigny|Loire|rouge
Saumur|Loire|rouge
Crémant de Loire|Loire|effervescent
Anjou|Loire|rouge
Rosé d'Anjou|Loire|rose
Cabernet d'Anjou|Loire|rose
Savennières|Loire|blanc
Coteaux du Layon|Loire|liquoreux
Bonnezeaux|Loire|liquoreux
Quarts de Chaume|Loire|liquoreux
Coteaux de l'Aubance|Loire|liquoreux
Muscadet Sèvre et Maine|Loire|blanc
Muscadet|Loire|blanc
Touraine|Loire|blanc
Cheverny|Loire|blanc
Jasnières|Loire|blanc
Bandol|Provence|rouge
Cassis|Provence|blanc
Bellet|Provence|rouge
Palette|Provence|rouge
Les Baux-de-Provence|Provence|rouge
Coteaux d'Aix-en-Provence|Provence|rose
Coteaux Varois en Provence|Provence|rose
Côtes de Provence|Provence|rose
Patrimonio|Corse|rouge
Ajaccio|Corse|rouge
Corse|Corse|rouge
Pic Saint-Loup|Languedoc|rouge
Terrasses du Larzac|Languedoc|rouge
Faugères|Languedoc|rouge
Saint-Chinian|Languedoc|rouge
Minervois|Languedoc|rouge
Corbières|Languedoc|rouge
Fitou|Languedoc|rouge
La Clape|Languedoc|rouge
Picpoul de Pinet|Languedoc|blanc
Limoux|Languedoc|blanc
Crémant de Limoux|Languedoc|effervescent
Blanquette de Limoux|Languedoc|effervescent
Languedoc|Languedoc|rouge
Collioure|Roussillon|rouge
Banyuls|Roussillon|liquoreux
Maury|Roussillon|liquoreux
Rivesaltes|Roussillon|liquoreux
Côtes du Roussillon Villages|Roussillon|rouge
Côtes du Roussillon|Roussillon|rouge
Arbois|Jura|blanc
Château-Chalon|Jura|blanc
L'Étoile|Jura|blanc
Côtes du Jura|Jura|blanc
Crémant du Jura|Jura|effervescent
Vin de Savoie|Savoie|blanc
Roussette de Savoie|Savoie|blanc
Pays d'Oc|Languedoc|rouge
`;

export interface Appellation {
  name: string;
  region: string;
  color: WineColor;
}

export const APPELLATIONS: Appellation[] = RAW.trim()
  .split('\n')
  .map((l) => {
    const [name, region, color] = l.split('|');
    return { name, region, color: color as WineColor };
  });

export const GRAPES = [
  'Cabernet Sauvignon', 'Cabernet Franc', 'Merlot', 'Malbec', 'Petit Verdot', 'Carménère', 'Pinot Noir', 'Gamay',
  'Syrah', 'Grenache', 'Mourvèdre', 'Carignan', 'Cinsault', 'Tannat', 'Négrette', 'Poulsard', 'Trousseau', 'Mondeuse',
  'Chardonnay', 'Sauvignon Blanc', 'Sauvignon', 'Sémillon', 'Muscadelle', 'Chenin', 'Melon de Bourgogne', 'Viognier',
  'Marsanne', 'Roussanne', 'Clairette', 'Picpoul', 'Vermentino', 'Rolle', 'Riesling', 'Gewurztraminer', 'Pinot Gris',
  'Pinot Blanc', 'Sylvaner', 'Muscat', 'Savagnin', 'Aligoté', 'Petit Manseng', 'Gros Manseng', 'Jacquère', 'Altesse',
  'Pinot Meunier', 'Meunier', 'Tempranillo', 'Sangiovese', 'Nebbiolo', 'Zinfandel',
];

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const squash = (s: string) => norm(s).replace(/[^a-z0-9]/g, '');

export function findAppellation(name: string): Appellation | undefined {
  const n = squash(name);
  if (!n) return undefined;
  return APPELLATIONS.find((a) => squash(a.name) === n);
}

export type BottleShape = 'bordelaise' | 'bourguignonne' | 'flute' | 'champenoise';

export function bottleShape(color: WineColor, region = '', appellation = ''): BottleShape {
  const r = norm(`${region} ${appellation}`);
  if (color === 'effervescent' || r.includes('champagne')) return 'champenoise';
  if (/alsace|moselle|allemagne|germany/.test(r)) return 'flute';
  if (/bordeaux|sud-ouest|bergerac|cahors|madiran|sauternes/.test(r)) return 'bordelaise';
  if (/bourgogne|beaujolais|rhone|loire|jura|savoie|languedoc|roussillon|provence|corse/.test(r)) return 'bourguignonne';
  return color === 'rouge' ? 'bordelaise' : 'bourguignonne';
}

/**
 * Recherche d'images de bouteilles / étiquettes sur des sources ouvertes, sans clé :
 *  - Open Food Facts (base collaborative de produits, contient de nombreux vins)
 *  - Wikimedia Commons (photos libres, surtout pour les vins connus)
 */

export interface ImageResult {
  thumb: string;
  full: string;
  title: string;
  source: 'Open Food Facts' | 'Wikimedia Commons';
}

async function getJSON(url: string, signal?: AbortSignal) {
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function searchOFF(q: string, signal?: AbortSignal): Promise<ImageResult[]> {
  const params = new URLSearchParams({
    search_terms: q,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '16',
    fields: 'product_name,brands,image_front_url,image_front_small_url',
    tagtype_0: 'categories',
    tag_contains_0: 'contains',
    tag_0: 'wines',
  });
  const data = await getJSON(`https://world.openfoodfacts.org/cgi/search.pl?${params}`, signal);
  return (data.products ?? [])
    .filter((p: Record<string, string>) => p.image_front_url)
    .map((p: Record<string, string>) => ({
      thumb: p.image_front_small_url || p.image_front_url,
      full: p.image_front_url,
      title: [p.brands, p.product_name].filter(Boolean).join(' – '),
      source: 'Open Food Facts' as const,
    }));
}

async function searchCommons(q: string, signal?: AbortSignal): Promise<ImageResult[]> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `${q} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: '16',
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: '400',
    format: 'json',
    origin: '*',
  });
  const data = await getJSON(`https://commons.wikimedia.org/w/api.php?${params}`, signal);
  const pages = Object.values(data.query?.pages ?? {}) as { title: string; index: number; imageinfo?: { thumburl: string; url: string }[] }[];
  return pages
    .sort((a, b) => a.index - b.index)
    .filter((p) => p.imageinfo?.[0])
    .map((p) => ({
      thumb: p.imageinfo![0].thumburl,
      full: p.imageinfo![0].thumburl, // la vignette 400 px suffit et reste légère
      title: p.title.replace(/^File:|\.\w+$/g, ''),
      source: 'Wikimedia Commons' as const,
    }));
}

export async function searchLabelImages(q: string, signal?: AbortSignal): Promise<{ results: ImageResult[]; errors: string[] }> {
  const settled = await Promise.allSettled([searchOFF(q, signal), searchCommons(q, signal)]);
  const results: ImageResult[] = [];
  const errors: string[] = [];
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled') results.push(...s.value);
    else errors.push(i === 0 ? 'Open Food Facts' : 'Wikimedia Commons');
  });
  return { results, errors };
}

/**
 * Récupère l'image pour la stocker sur l'appareil (affichage hors connexion).
 * Si le site ne l'autorise pas, on garde simplement l'adresse de l'image.
 */
export async function importImage(url: string, max = 600): Promise<string> {
  try {
    const r = await fetch(url, { mode: 'cors' });
    if (!r.ok) throw new Error();
    const blob = await r.blob();
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  } catch {
    return url;
  }
}

export function googleImagesUrl(q: string) {
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q + ' étiquette vin')}`;
}

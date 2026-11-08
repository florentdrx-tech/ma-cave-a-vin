import { useId } from 'react';
import type { Wine, WineColor } from '../db';
import { bottleShape, type BottleShape } from '../appellations';

const SHAPES: Record<BottleShape, { path: string; label: { x: number; y: number; w: number; h: number }; capsule: number }> = {
  bordelaise: {
    path: 'M41,8 L59,8 L59,88 C59,108 84,110 84,130 L84,304 Q84,312 76,312 L24,312 Q16,312 16,304 L16,130 C16,110 41,108 41,88 Z',
    label: { x: 20, y: 168, w: 60, h: 112 },
    capsule: 58,
  },
  bourguignonne: {
    path: 'M42,8 L58,8 L58,78 C58,120 86,140 86,176 L86,304 Q86,312 78,312 L22,312 Q14,312 14,304 L14,176 C14,140 42,120 42,78 Z',
    label: { x: 18, y: 192, w: 64, h: 98 },
    capsule: 56,
  },
  flute: {
    path: 'M43,8 L57,8 L57,66 C57,120 77,140 77,172 L77,304 Q77,312 70,312 L30,312 Q23,312 23,304 L23,172 C23,140 43,120 43,66 Z',
    label: { x: 26, y: 198, w: 48, h: 88 },
    capsule: 52,
  },
  champenoise: {
    path: 'M39,8 L61,8 L61,66 C61,114 88,130 88,170 L88,302 Q88,312 78,312 L22,312 Q12,312 12,302 L12,170 C12,130 39,114 39,66 Z',
    label: { x: 16, y: 194, w: 68, h: 94 },
    capsule: 112,
  },
};

/** Verre, vin visible (verre clair) et capsule selon la couleur. */
const LOOK: Record<WineColor, { glass: string; glassOpacity: number; liquid?: string; capsule: string }> = {
  rouge: { glass: '#1b2e20', glassOpacity: 1, capsule: '#6b1f2f' },
  blanc: { glass: '#8d9c55', glassOpacity: 0.75, liquid: '#e6d77f', capsule: '#c9a646' },
  rose: { glass: '#dfe7ea', glassOpacity: 0.35, liquid: '#f09aa9', capsule: '#e7c3cb' },
  effervescent: { glass: '#1f2f1d', glassOpacity: 1, capsule: '#cfae55' },
  liquoreux: { glass: '#e3e6e0', glassOpacity: 0.3, liquid: '#d4902a', capsule: '#7a4a14' },
};

/** Styles d'étiquette dessinée, choisis de façon stable d'après le nom du domaine. */
const LABEL_STYLES = [
  { bg: '#f6efe0', ink: '#2a1d20', accent: '#8a1c32' },
  { bg: '#fbfaf6', ink: '#1d2a3a', accent: '#a07c2c' },
  { bg: '#1e1b18', ink: '#efe6d2', accent: '#c9a646' },
  { bg: '#ead9bf', ink: '#3b2a1a', accent: '#6b1f2f' },
  { bg: '#f3f1ea', ink: '#2c3b2c', accent: '#4f6b3a' },
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Coupe un texte en au plus deux lignes équilibrées. */
function split2(s: string): string[] {
  if (s.length <= 14) return [s];
  let words = s.split(' ');
  if (words.length < 2) words = s.split(/(?<=-)/); // « BILLECART-SALMON » -> « BILLECART- » / « SALMON »
  if (words.length < 2) return [s];
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
    if (d < bestDiff) { bestDiff = d; best = i; }
  }
  const sep = s.includes(' ') ? ' ' : '';
  return [words.slice(0, best).join(sep).trim(), words.slice(best).join(sep).trim()];
}

/** Taille de police qui fait tenir le texte dans la largeur. */
const fit = (text: string, width: number, max: number, ratio = 0.62) => Math.min(max, width / Math.max(1, text.length * ratio));

type BottleWine = Pick<Wine, 'color' | 'region' | 'appellation' | 'producer' | 'name' | 'vintage' | 'labelImage'>;

export default function Bottle({ wine, height = 160, className = '' }: { wine: BottleWine; height?: number; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const shape = SHAPES[bottleShape(wine.color, wine.region, wine.appellation)];
  const look = LOOK[wine.color];
  const { x, y, w, h } = shape.label;
  const style = LABEL_STYLES[hash(wine.producer || wine.appellation || 'x') % LABEL_STYLES.length];

  const producerLines = split2((wine.producer || wine.appellation || 'Vin').toUpperCase());
  const showAppellation = wine.appellation && wine.producer;
  const cx = x + w / 2;

  return (
    <svg
      viewBox="0 0 100 320"
      height={height}
      width={(height * 100) / 320}
      className={`bottle ${className}`}
      role="img"
      aria-label={`Bouteille ${[wine.producer, wine.name, wine.vintage].filter(Boolean).join(' ')}`}
    >
      <defs>
        <clipPath id={`b${uid}`}><path d={shape.path} /></clipPath>
        <clipPath id={`l${uid}`}><rect x={x} y={y} width={w} height={h} rx={2} /></clipPath>
        <linearGradient id={`s${uid}`} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.35" />
          <stop offset="0.18" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.3" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.8" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      <g clipPath={`url(#b${uid})`}>
        {look.liquid && <rect x="0" y="60" width="100" height="260" fill={look.liquid} />}
        <rect x="0" y="0" width="100" height="320" fill={look.glass} opacity={look.glassOpacity} />
        <rect x="0" y="0" width="100" height={shape.capsule} fill={look.capsule} />
        <rect x="0" y={shape.capsule - 3} width="100" height="3" fill="#000" opacity="0.18" />
      </g>

      {wine.labelImage ? (
        <g clipPath={`url(#l${uid})`}>
          <rect x={x} y={y} width={w} height={h} fill="#f4efe6" />
          <image href={wine.labelImage} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid slice" />
        </g>
      ) : (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={2} fill={style.bg} />
          <rect x={x + 2.5} y={y + 2.5} width={w - 5} height={h - 5} rx={1.5} fill="none" stroke={style.accent} strokeWidth="0.6" />
          <g fontFamily="Georgia, 'Times New Roman', serif" textAnchor="middle" fill={style.ink}>
            {producerLines.map((l, i) => {
              const fs = fit(l, w - 12, 9, 0.74);
              return (
                <text key={i} x={cx} y={y + 16 + i * (fs + 2)} fontSize={fs} fontWeight="700" letterSpacing="0.3">{l}</text>
              );
            })}
            <line x1={cx - w / 5} x2={cx + w / 5} y1={y + 22 + (producerLines.length - 1) * 10} y2={y + 22 + (producerLines.length - 1) * 10} stroke={style.accent} strokeWidth="0.7" />
            {wine.name && (
              <text x={cx} y={y + h * 0.5} fontSize={fit(wine.name, w - 10, 7.5, 0.5)} fontStyle="italic">{wine.name}</text>
            )}
            {showAppellation && (
              <text x={cx} y={y + h * 0.5 + (wine.name ? 11 : 4)} fontSize={fit(wine.appellation, w - 12, 5.5, 0.7)} fill={style.accent} letterSpacing="0.4">
                {wine.appellation.toUpperCase()}
              </text>
            )}
            {wine.vintage && (
              <text x={cx} y={y + h - 9} fontSize="11" fontWeight="700" fill={style.accent}>{wine.vintage}</text>
            )}
          </g>
        </g>
      )}

      <path d={shape.path} fill={`url(#s${uid})`} pointerEvents="none" />
    </svg>
  );
}

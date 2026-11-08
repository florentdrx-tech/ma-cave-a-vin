import { useEffect, type ReactNode } from 'react';
import { colorHex, drinkStatus, STATUS_LABEL, type Wine } from '../db';

export function ColorDot({ color, size = 12 }: { color: Wine['color']; size?: number }) {
  return <span className="dot" style={{ background: colorHex(color), width: size, height: size }} />;
}

export function StatusBadge({ wine }: { wine: Wine }) {
  const s = drinkStatus(wine);
  if (s === 'inconnu') return null;
  return <span className={`badge badge-${s}`}>{STATUS_LABEL[s]}</span>;
}

export function Stepper({ value, onChange, min = 0, max = 999 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Moins">−</button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || 0)))}
      />
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label="Plus">+</button>
    </div>
  );
}

export function Stars({ value, onChange, size = 28 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className="stars" style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = value >= i ? 'full' : value >= i - 0.5 ? 'half' : 'empty';
        return (
          <button
            key={i}
            type="button"
            disabled={!onChange}
            className={`star ${fill}`}
            onClick={() => onChange?.(value === i ? i - 0.5 : i)}
            aria-label={`${i} étoile${i > 1 ? 's' : ''}`}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtTemp(t: number) {
  return `${t.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} °C`;
}

export function fmtMoney(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

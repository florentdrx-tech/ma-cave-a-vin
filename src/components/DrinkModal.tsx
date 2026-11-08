import { useState } from 'react';
import { db, drinkBottle, wineTitle, type Wine } from '../db';
import { Modal, Stars } from './ui';
import { decantSentence, effectiveAdvice, serveSentence } from '../advice';

/** Sortie d'une bouteille + note de dégustation facultative, en une seule étape. */
export default function DrinkModal({ wine, placementId, onClose }: { wine: Wine; placementId?: number; onClose: () => void }) {
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [pairing, setPairing] = useState('');
  const [reason, setReason] = useState<'Bue' | 'Offerte' | 'Cassée / bouchonnée'>('Bue');

  async function confirm() {
    await drinkBottle(wine.id!, placementId, reason);
    if (rating > 0 || notes.trim() || pairing.trim()) {
      await db.tastings.add({ wineId: wine.id!, date: Date.now(), rating, notes: notes.trim(), pairing: pairing.trim() || undefined });
    }
    onClose();
  }

  return (
    <Modal title="Sortir une bouteille" onClose={onClose}>
      <p className="muted">
        {wineTitle(wine)} {wine.vintage ?? ''} · reste {wine.quantity - 1} après sortie
      </p>
      {(() => {
        const a = effectiveAdvice(wine);
        return (
          <div className="service-tip">
            <span>🌡️ Température de service : <b>{serveSentence(a.serveMin, a.serveMax)}</b></span>
            <span>🫗 {decantSentence(a.decant, a.aeration)}</span>
            <span>🍽️ {a.pairings}</span>
          </div>
        );
      })()}
      <div className="chips">
        {(['Bue', 'Offerte', 'Cassée / bouchonnée'] as const).map((r) => (
          <button key={r} type="button" className={`chip ${reason === r ? 'on' : ''}`} onClick={() => setReason(r)}>
            {r}
          </button>
        ))}
      </div>
      {reason === 'Bue' && (
        <>
          <label className="field">
            <span>Note (facultatif)</span>
            <Stars value={rating} onChange={setRating} />
          </label>
          <label className="field">
            <span>Impressions</span>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Nez, bouche, finale…" />
          </label>
          <label className="field">
            <span>Accord mets-vin</span>
            <input value={pairing} onChange={(e) => setPairing(e.target.value)} placeholder="Ex. côte de bœuf" />
          </label>
        </>
      )}
      <div className="actions">
        <button className="btn ghost" onClick={onClose}>Annuler</button>
        <button className="btn primary" onClick={confirm}>Confirmer</button>
      </div>
    </Modal>
  );
}

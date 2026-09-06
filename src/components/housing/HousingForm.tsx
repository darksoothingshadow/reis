import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import {
  HOUSING_KINDS,
  HOUSING_LIMITS,
  HOUSING_ROOM_TYPES,
  type HousingDraft,
  type HousingKind,
  type HousingRoomType,
} from '../../types/housing';

// No <form> submit: the extension iframe is sandboxed (same reason as
// EventComposer). Publish is a button gated on the required fields AND the
// consent tick — the tick is what authorises attaching the IS login.
export function HousingForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const publishHousing = useAppStore((s) => s.publishHousing);
  const posterLogin = useAppStore((s) => s.housingPosterLogin);
  const [kind, setKind] = useState<HousingKind>('offer');
  const [roomType, setRoomType] = useState<HousingRoomType>('room_private');
  const [district, setDistrict] = useState('');
  const [price, setPrice] = useState('');
  const [freeFrom, setFreeFrom] = useState('');
  const [freeUntil, setFreeUntil] = useState('');
  const [note, setNote] = useState('');
  const [contact, setContact] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const ready = district.trim() && freeFrom && contact.trim() && consent && !busy;

  const publish = async () => {
    if (!ready) return;
    setBusy(true);
    setMessage(null);
    const parsedPrice = Number(price);
    const priceCzk =
      price.trim() === '' || !Number.isFinite(parsedPrice)
        ? null
        : Math.min(100000, Math.max(0, Math.round(parsedPrice)));
    const draft: HousingDraft = {
      kind,
      roomType,
      district: district.trim(),
      priceCzk,
      freeFrom,
      freeUntil: freeUntil || null,
      note: note.trim(),
      contact: contact.trim(),
    };
    const result = await publishHousing(draft);
    setBusy(false);
    if (result === 'ok') {
      onDone();
      return;
    }
    setMessage(t(result === 'refused' ? 'housing.form.refused' : 'housing.form.failed'));
  };

  // `form-control` is DaisyUI 4 — this project is on daisyui@5, which does not
  // define the class at all, so it was a no-op and the label (default
  // `display: inline`) let its span and the control share one line box: the
  // input's border ran straight through the label text instead of sitting
  // below it. `flex flex-col` is the real stacking rule.
  const field = (id: string, label: string, input: React.ReactNode) => (
    <label className="flex w-full flex-col" htmlFor={id}>
      <span className="label-text mb-1 text-sm">{label}</span>
      {input}
    </label>
  );

  return (
    <div className="flex flex-col gap-3 p-3">
      <h3 className="text-lg font-semibold">{t('housing.form.title')}</h3>
      {/* Same tabs-box contrast fix as HousingBoard's offer/request tabs —
          see the comment there. */}
      <div role="tablist" className="tabs tabs-box tabs-sm border border-base-content/10">
        {HOUSING_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            className={`tab flex-1 ${kind === k ? 'tab-active font-semibold' : 'text-base-content'}`}
            onClick={() => setKind(k)}
          >
            {t(`housing.kind.${k}`)}
          </button>
        ))}
      </div>
      {field(
        'h-type',
        t('housing.form.roomType'),
        <select
          id="h-type"
          className="select select-bordered select-sm"
          value={roomType}
          onChange={(e) => setRoomType(e.target.value as HousingRoomType)}
        >
          {HOUSING_ROOM_TYPES.map((r) => (
            <option key={r} value={r}>
              {t(`housing.roomType.${r}`)}
            </option>
          ))}
        </select>
      )}
      {field(
        'h-district',
        t('housing.form.district'),
        <input
          id="h-district"
          className="input input-bordered input-sm"
          maxLength={HOUSING_LIMITS.district}
          placeholder={t('housing.form.districtPlaceholder')}
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
        />
      )}
      {field(
        'h-price',
        t('housing.form.price'),
        <input
          id="h-price"
          type="number"
          inputMode="numeric"
          min={0}
          max={100000}
          className="input input-bordered input-sm"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      )}
      {field(
        'h-from',
        t('housing.form.freeFrom'),
        <input
          id="h-from"
          type="date"
          className="input input-bordered input-sm"
          value={freeFrom}
          onChange={(e) => setFreeFrom(e.target.value)}
        />
      )}
      {field(
        'h-until',
        t('housing.form.freeUntil'),
        <input
          id="h-until"
          type="date"
          className="input input-bordered input-sm"
          min={freeFrom || undefined}
          value={freeUntil}
          onChange={(e) => setFreeUntil(e.target.value)}
        />
      )}
      {field(
        'h-note',
        t('housing.form.note'),
        <textarea
          id="h-note"
          className="textarea textarea-bordered textarea-sm"
          rows={3}
          maxLength={HOUSING_LIMITS.note}
          placeholder={t('housing.form.notePlaceholder')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      )}
      {field(
        'h-contact',
        t('housing.form.contact'),
        <input
          id="h-contact"
          className="input input-bordered input-sm"
          maxLength={HOUSING_LIMITS.contact}
          placeholder={t('housing.form.contactPlaceholder')}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
      )}
      <div className="text-xs opacity-70">
        {t('housing.form.loginLabel')}: <span className="font-mono">{posterLogin ?? '…'}</span>
      </div>
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="checkbox checkbox-sm mt-0.5"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>{t('housing.form.consent')}</span>
      </label>
      {message && <div className="alert alert-warning py-2 text-sm">{message}</div>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
          {t('housing.form.cancel')}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!ready}
          onClick={publish}
        >
          {t('housing.form.publish')}
        </button>
      </div>
    </div>
  );
}

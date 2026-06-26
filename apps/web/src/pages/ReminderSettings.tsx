import { useCallback, useEffect, useState } from 'react';
import { reminderSettingsApi, type ReminderSettings as ReminderSettingsData } from '../lib/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_CADENCE = 1;
const MAX_CADENCE = 90;

/** Formate les offsets (ex: [-7, -3, 0]) en libellés lisibles (J-7, J-3, le jour J). */
function formatOffset(offset: number): string {
  if (offset === 0) return 'le jour J';
  if (offset < 0) return `J${offset}`;
  return `J+${offset}`;
}

export default function ReminderSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [email, setEmail] = useState('');
  const [cadence, setCadence] = useState('30');
  const [offsets, setOffsets] = useState<number[]>([-7, -3, 0]);

  const applySettings = useCallback((settings: ReminderSettingsData) => {
    setEnabled(settings.payment_reminders_enabled);
    setEmail(settings.notification_email ?? '');
    setCadence(String(settings.payment_reminder_cadence_days));
    if (Array.isArray(settings.offsets) && settings.offsets.length > 0) {
      setOffsets(settings.offsets);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const settings = await reminderSettingsApi.get();
      applySettings(settings);
    } catch {
      setLoadError('Impossible de charger les réglages.');
    } finally {
      setLoading(false);
    }
  }, [applySettings]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setSaveError(null);
    setSuccess(false);

    const trimmedEmail = email.trim();
    if (trimmedEmail && !EMAIL_REGEX.test(trimmedEmail)) {
      setSaveError('Adresse e-mail invalide.');
      return;
    }

    const cadenceValue = parseInt(cadence, 10);
    if (Number.isNaN(cadenceValue) || cadenceValue < MIN_CADENCE || cadenceValue > MAX_CADENCE) {
      setSaveError(`La cadence doit être comprise entre ${MIN_CADENCE} et ${MAX_CADENCE} jours.`);
      return;
    }

    setSaving(true);
    try {
      const updated = await reminderSettingsApi.update({
        payment_reminders_enabled: enabled,
        notification_email: trimmedEmail || null,
        payment_reminder_cadence_days: cadenceValue,
      });
      applySettings(updated);
      setSuccess(true);
    } catch {
      setSaveError('Impossible d’enregistrer les réglages.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Réglages relances</h1>
        <p className="text-slate-500">Relances automatiques des créances</p>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-card text-slate-400">
          Chargement…
        </div>
      ) : loadError ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-card">
          <p className="text-slate-500">{loadError}</p>
          <button
            onClick={() => void load()}
            className="mt-3 rounded-lg bg-action-500 px-4 py-2 text-white hover:bg-action-600"
          >
            Réessayer
          </button>
        </div>
      ) : (
        <div className="max-w-2xl space-y-6">
          {/* Carte info : calendrier */}
          <div className="flex items-start gap-4 rounded-2xl bg-action-50 p-5 shadow-card">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-action-100 text-action-600">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-primary-900">Calendrier des relances</p>
              <p className="text-sm text-slate-600">
                Les relances sont envoyées {offsets.map(formatOffset).join(', ')}.
              </p>
            </div>
          </div>

          {/* Toggle activation */}
          <div className="rounded-2xl bg-white p-5 shadow-card">
            <label className="flex cursor-pointer items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-primary-900">
                  Activer les relances automatiques
                </p>
                <p className="text-sm text-slate-500">
                  Envoie automatiquement les rappels d’échéance aux clients concernés.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => {
                  setEnabled(prev => !prev);
                  setSuccess(false);
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  enabled ? 'bg-action-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    enabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </label>
          </div>

          {/* Champs */}
          <div className="space-y-5 rounded-2xl bg-white p-5 shadow-card">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                E-mail de notification
              </label>
              <input
                type="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  setSuccess(false);
                }}
                placeholder="exemple@boutique.com"
                autoComplete="off"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-action-400 focus:bg-white focus:ring-2 focus:ring-action-100 transition-colors"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Cadence de rappel (jours)
              </label>
              <input
                type="number"
                min={MIN_CADENCE}
                max={MAX_CADENCE}
                value={cadence}
                onChange={e => {
                  setCadence(e.target.value.replace(/[^0-9]/g, ''));
                  setSuccess(false);
                }}
                placeholder="30"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-action-400 focus:bg-white focus:ring-2 focus:ring-action-100 transition-colors"
              />
              <p className="mt-1 text-xs text-slate-400">
                Entre {MIN_CADENCE} et {MAX_CADENCE} jours.
              </p>
            </div>
          </div>

          {/* Note canaux */}
          <p className="px-1 text-sm text-slate-500">
            Les canaux (SMS / WhatsApp / E-mail) se configurent par client sur sa fiche.
          </p>

          {saveError ? (
            <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
              {saveError}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-lg bg-success-50 px-4 py-3 text-sm font-medium text-success-700">
              Réglages enregistrés.
            </div>
          ) : null}

          {/* Bouton enregistrer */}
          <div>
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-lg bg-action-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-action-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

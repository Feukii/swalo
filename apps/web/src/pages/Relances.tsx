import { useEffect, useState, useCallback } from 'react';
import { sellerTasksApi, type ReminderChannel, type SellerTask } from '../lib/api';

function formatDate(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** Formatte un montant entier en FCFA -> "12 345 F" (aucune division). */
function formatMoney(amount?: number | null): string {
  if (amount == null) return '';
  return `${Math.round(amount).toLocaleString('fr-FR')} F`;
}

/** Libellé lisible d'un canal de relance. */
const CHANNEL_LABEL: Record<ReminderChannel, string> = {
  SMS: 'SMS',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'E-mail',
};

/** Retour visuel après une tentative d'envoi de relance. */
type Feedback = { kind: 'success' | 'error'; text: string } | null;

export default function Relances() {
  const [tasks, setTasks] = useState<SellerTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  // Dialogue de relance manuelle
  const [sheetTask, setSheetTask] = useState<SellerTask | null>(null);
  const [sheetChannel, setSheetChannel] = useState<ReminderChannel | undefined>(undefined);
  const [sheetMessage, setSheetMessage] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await sellerTasksApi.getTasks();
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDone = async (id: string) => {
    try {
      await sellerTasksApi.markDone(id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch {
      // garde la tâche si échec
    }
  };

  const isOverdue = (due?: string) => !!due && new Date(due).getTime() < Date.now();

  const openSheet = (task: SellerTask) => {
    setFeedback(null);
    setSheetTask(task);
    // Pré-sélection du premier canal disponible
    setSheetChannel(task.channels && task.channels.length > 0 ? task.channels[0] : undefined);
    setSheetMessage(task.preview_message ?? task.description ?? '');
  };

  const closeSheet = () => {
    setSheetTask(null);
    setSheetChannel(undefined);
    setSheetMessage('');
  };

  const handleSend = async () => {
    if (!sheetTask) return;
    const task = sheetTask;
    setSending(true);
    try {
      const result = await sellerTasksApi.remind(task.id, sheetChannel);
      if (result.ok) {
        const sent = result.channelsSent?.length
          ? result.channelsSent.map(c => CHANNEL_LABEL[c]).join(', ')
          : null;
        closeSheet();
        setFeedback({
          kind: 'success',
          text: sent ? `Relance envoyée sur : ${sent}.` : 'Relance envoyée.',
        });
      } else {
        setFeedback({
          kind: 'error',
          text: result.error ?? "La relance n'a pas pu être envoyée.",
        });
      }
    } catch {
      setFeedback({
        kind: 'error',
        text: "Impossible d'envoyer la relance. Réessayez plus tard.",
      });
    } finally {
      setSending(false);
    }
  };

  const sheetChannels = sheetTask?.channels ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Relances</h1>
        <p className="text-slate-500">Clients à relancer · échéances proches ou dépassées</p>
      </div>

      {feedback ? (
        <div
          role="status"
          className={`flex items-center justify-between gap-4 rounded-xl px-4 py-3 text-sm ${
            feedback.kind === 'success'
              ? 'bg-success-50 text-success-700'
              : 'bg-danger-50 text-danger-700'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            onClick={() => setFeedback(null)}
            className="shrink-0 font-medium opacity-70 hover:opacity-100"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-card text-slate-400">
          Chargement…
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-card">
          <p className="text-slate-500">Impossible de charger les relances.</p>
          <button
            onClick={() => void load()}
            className="mt-3 rounded-lg bg-action-500 px-4 py-2 text-white hover:bg-action-600"
          >
            Réessayer
          </button>
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-card">
          <p className="text-lg font-semibold text-primary-900">Aucune relance</p>
          <p className="text-slate-500">Tous les clients sont à jour pour le moment.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          {tasks.map((task, i) => {
            const overdue = isOverdue(task.due_date);
            const name = task.customer?.name ?? task.title;
            const channels = task.channels ?? [];
            return (
              <div
                key={task.id}
                className={`flex items-center gap-4 p-4 ${i > 0 ? 'border-t border-slate-100' : ''}`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    overdue ? 'bg-danger-50 text-danger-600' : 'bg-action-50 text-action-600'
                  }`}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-primary-900">{name}</p>
                  {task.due_date ? (
                    <p className={`text-sm ${overdue ? 'text-danger-600' : 'text-slate-500'}`}>
                      {overdue ? 'En retard · ' : 'Échéance '}
                      {formatDate(task.due_date)}
                    </p>
                  ) : null}
                  {task.description ? (
                    <p className="truncate text-sm text-slate-400">{task.description}</p>
                  ) : null}
                  {channels.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {channels.map(ch => (
                        <span
                          key={ch}
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500"
                        >
                          {CHANNEL_LABEL[ch]}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                {task.amount != null ? (
                  <span className="shrink-0 text-sm font-bold tabular-nums text-danger-600">
                    {formatMoney(task.amount)}
                  </span>
                ) : null}
                <button
                  onClick={() => openSheet(task)}
                  className="shrink-0 rounded-lg bg-action-500 px-4 py-2 text-sm font-medium text-white hover:bg-action-600"
                >
                  Relancer
                </button>
                <button
                  onClick={() => void handleDone(task.id)}
                  className="shrink-0 rounded-lg bg-success-500 px-4 py-2 text-sm font-medium text-white hover:bg-success-600"
                >
                  Marquer fait
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* DIALOGUE DE RELANCE */}
      {sheetTask ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={closeSheet}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-primary-900">Relancer le client</h2>
                <p className="truncate text-sm font-semibold text-danger-600">
                  {sheetTask.customer?.name ?? sheetTask.title}
                  {sheetTask.amount != null ? (
                    <span className="font-bold"> · {formatMoney(sheetTask.amount)}</span>
                  ) : null}
                </p>
                {sheetTask.due_date ? (
                  <p className="text-xs text-slate-500">Échéance le {formatDate(sheetTask.due_date)}</p>
                ) : null}
              </div>
              <button
                onClick={closeSheet}
                className="shrink-0 text-slate-400 hover:text-slate-600"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <p className="mt-5 text-sm font-semibold text-slate-600">Envoyer sur</p>
            {sheetChannels.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Aucun canal activé pour ce client.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {sheetChannels.map(ch => {
                  const active = sheetChannel === ch;
                  return (
                    <button
                      key={ch}
                      onClick={() => setSheetChannel(ch)}
                      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                        active
                          ? 'border-action-500 bg-action-50 text-action-600'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {CHANNEL_LABEL[ch]}
                      {active ? ' ✓' : ''}
                    </button>
                  );
                })}
              </div>
            )}

            <p className="mt-5 text-sm font-semibold text-slate-600">Aperçu du message</p>
            <textarea
              value={sheetMessage}
              onChange={e => setSheetMessage(e.target.value)}
              disabled={sending}
              rows={5}
              placeholder="Message de relance…"
              className="mt-2 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 focus:border-action-500 focus:outline-none disabled:opacity-60"
            />

            <div className="mt-6 flex gap-3">
              <button
                onClick={closeSheet}
                disabled={sending}
                className="flex-1 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                onClick={() => void handleSend()}
                disabled={sending || sheetChannels.length === 0}
                className="flex-[2] rounded-lg bg-action-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-action-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending ? 'Envoi…' : 'Envoyer la relance'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

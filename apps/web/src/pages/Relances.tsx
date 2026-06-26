import { useEffect, useState, useCallback } from 'react';
import { sellerTasksApi, type SellerTask } from '../lib/api';

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

export default function Relances() {
  const [tasks, setTasks] = useState<SellerTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Relances</h1>
        <p className="text-slate-500">Clients à relancer · échéances proches ou dépassées</p>
      </div>

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
                  <p className="truncate font-semibold text-primary-900">{task.title}</p>
                  {task.due_date ? (
                    <p className={`text-sm ${overdue ? 'text-danger-600' : 'text-slate-500'}`}>
                      {overdue ? 'En retard · ' : 'Échéance '}
                      {formatDate(task.due_date)}
                    </p>
                  ) : null}
                  {task.description ? (
                    <p className="truncate text-sm text-slate-400">{task.description}</p>
                  ) : null}
                </div>
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
    </div>
  );
}

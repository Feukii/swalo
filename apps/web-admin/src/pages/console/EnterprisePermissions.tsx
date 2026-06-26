import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  CAPABILITY_LABELS,
  CONFIGURABLE_ROLES,
  MODULE_CAPABILITIES,
  PERMISSION_MODULES,
  buildDefaultMatrix,
  type Capability,
  type PermissionMatrix,
  type PermissionModule,
  type Role,
} from '@swalo/core/modules/permissions';
import { adminApi, type PermissionConfigResponse } from '../../lib/api';

// Fully-resolved, non-partial matrix used as local editing state.
type FullMatrix = Record<PermissionModule, Record<Role, Capability[]>>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** French labels for the configurable roles. */
const ROLE_LABELS: Record<Role, string> = {
  EMPLOYEE: 'Employé',
  MANAGER: 'Gérant',
  BOSS: 'Patron',
  SUPERADMIN: 'Super-admin',
};

/** French labels for the operational modules. */
const MODULE_LABELS: Record<PermissionModule, string> = {
  products: 'Produits',
  customers: 'Clients',
  sales: 'Ventes',
  cash: 'Caisse',
  inventory: 'Inventaire',
  suppliers: 'Fournisseurs',
  receivables: 'Créances',
  debts: 'Dettes',
  reports: 'Rapports',
  transfers: 'Transferts',
  invoices: 'Factures',
  'packaging-types': 'Emballages',
  notifications: 'Notifications',
};

/**
 * Build the full editing matrix from a defaults map plus an optional stored
 * (partial) configuration. The stored config wins where present, otherwise we
 * fall back to defaults — guaranteeing every module/role cell is defined.
 */
function buildEditingMatrix(
  defaults: Record<Role, Record<PermissionModule, Capability[]>>,
  current: PermissionMatrix | null
): FullMatrix {
  const out = {} as FullMatrix;
  for (const module of PERMISSION_MODULES) {
    out[module] = {} as Record<Role, Capability[]>;
    for (const role of CONFIGURABLE_ROLES) {
      const fromCurrent = current?.[module]?.[role];
      const fallback = defaults[role]?.[module] ?? [];
      const caps = fromCurrent ?? fallback;
      // Keep only capabilities the module actually exposes.
      out[module][role] = MODULE_CAPABILITIES[module].filter(c => caps.includes(c));
    }
  }
  return out;
}

/** Convert the full editing matrix back into the stored (module → role) shape. */
function toPermissionMatrix(matrix: FullMatrix): PermissionMatrix {
  const out: PermissionMatrix = {};
  for (const module of PERMISSION_MODULES) {
    out[module] = {};
    for (const role of CONFIGURABLE_ROLES) {
      out[module]![role] = [...matrix[module][role]];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EnterprisePermissions() {
  const { shopId } = useParams<{ enterpriseId: string; shopId: string }>();

  const [payload, setPayload] = useState<PermissionConfigResponse | null>(null);
  const [matrix, setMatrix] = useState<FullMatrix | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null
  );

  const load = useCallback(async () => {
    if (!shopId) return;
    setIsLoading(true);
    setError(null);
    setFeedback(null);
    try {
      const data = await adminApi.getShopPermissions(shopId);
      const defaults = data.defaults ?? buildDefaultMatrix();
      setPayload(data);
      setMatrix(buildEditingMatrix(defaults, data.current ?? null));
    } catch {
      setError('Impossible de charger les permissions de cette boutique.');
    } finally {
      setIsLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleCapability = useCallback(
    (module: PermissionModule, role: Role, capability: Capability) => {
      setMatrix(prev => {
        if (!prev) return prev;
        const current = prev[module][role];
        const next = current.includes(capability)
          ? current.filter(c => c !== capability)
          : MODULE_CAPABILITIES[module].filter(c => current.includes(c) || c === capability);
        return {
          ...prev,
          [module]: { ...prev[module], [role]: next },
        };
      });
      setFeedback(null);
    },
    []
  );

  const handleReset = useCallback(() => {
    const defaults = payload?.defaults ?? buildDefaultMatrix();
    setMatrix(buildEditingMatrix(defaults, null));
    setFeedback({ kind: 'success', text: 'Matrice réinitialisée aux valeurs par défaut.' });
  }, [payload]);

  const handleSave = useCallback(async () => {
    if (!shopId || !matrix) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      await adminApi.setShopPermissions(shopId, toPermissionMatrix(matrix));
      setFeedback({ kind: 'success', text: 'Permissions enregistrées avec succès.' });
    } catch {
      setFeedback({ kind: 'error', text: "Échec de l'enregistrement des permissions." });
    } finally {
      setIsSaving(false);
    }
  }, [shopId, matrix]);

  const roles = useMemo<readonly Role[]>(
    () => payload?.roles?.filter(r => r !== 'SUPERADMIN') ?? CONFIGURABLE_ROLES,
    [payload]
  );

  // -------------------------------------------------------------------------
  // Render: loading
  // -------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="space-y-5">
        <PageHeading />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-white shadow-card" />
          ))}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: error
  // -------------------------------------------------------------------------

  if (error || !matrix) {
    return (
      <div className="space-y-5">
        <PageHeading />
        <div className="rounded-2xl bg-white p-10 text-center shadow-card">
          <p className="font-medium text-danger-700">
            {error ?? 'Permissions indisponibles.'}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 rounded-lg bg-action-500 px-4 py-2 text-sm text-white transition-colors hover:bg-action-600"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: content
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeading />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={isSaving}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Réinitialiser aux défauts
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="rounded-lg bg-action-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-action-600 disabled:opacity-50"
          >
            {isSaving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            feedback.kind === 'success'
              ? 'bg-success-50 text-success-700'
              : 'bg-danger-50 text-danger-700'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {PERMISSION_MODULES.map(module => {
        const caps = MODULE_CAPABILITIES[module];
        return (
          <section key={module} className="rounded-2xl bg-white p-6 shadow-card">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-base font-semibold text-primary-900">
                {MODULE_LABELS[module]}
              </h2>
              <span className="text-xs text-slate-400">{module}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pr-4">Rôle</th>
                    {caps.map(cap => (
                      <th key={cap} className="pb-3 pr-4 text-center">
                        {CAPABILITY_LABELS[cap]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roles.map(role => (
                    <tr key={role} className="text-sm">
                      <td className="py-3 pr-4 font-medium text-primary-900">
                        {ROLE_LABELS[role]}
                      </td>
                      {caps.map(cap => {
                        const checked = matrix[module][role].includes(cap);
                        return (
                          <td key={cap} className="py-3 pr-4 text-center">
                            <label className="inline-flex cursor-pointer items-center justify-center">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCapability(module, role, cap)}
                                aria-label={`${ROLE_LABELS[role]} — ${CAPABILITY_LABELS[cap]} — ${MODULE_LABELS[module]}`}
                                className="h-4 w-4 rounded border-slate-300 text-action-500 focus:ring-action-400"
                              />
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page heading
// ---------------------------------------------------------------------------

function PageHeading() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-primary-900">Accès &amp; permissions</h1>
      <p className="mt-0.5 text-sm text-slate-500">
        Modules, fonctionnalités et vues par rôle
      </p>
    </div>
  );
}

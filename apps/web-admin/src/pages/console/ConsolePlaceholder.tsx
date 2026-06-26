interface ConsolePlaceholderProps {
  title: string;
  subtitle: string;
  enterpriseId?: string;
  /** Optional — only shop-scoped pages pass it. */
  shopId?: string;
}

/**
 * Shared placeholder for the enterprise drill-down console pages. These pages
 * are intentionally minimal — their real content is implemented separately.
 */
export default function ConsolePlaceholder({
  title,
  subtitle,
  enterpriseId,
  shopId,
}: ConsolePlaceholderProps) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-primary-900">{title}</h1>
        <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-card">
        <p className="text-base font-medium text-slate-600">Contenu à venir</p>
        <p className="mt-1 text-sm text-slate-400">Chargement…</p>
        <p className="mt-4 text-xs text-slate-400">
          Entreprise <span className="font-mono text-slate-500">{enterpriseId ?? '—'}</span>
          {shopId ? (
            <>
              {' · '}Boutique <span className="font-mono text-slate-500">{shopId}</span>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { adminApi } from '../../lib/api';

interface RedirectShop {
  id: string;
}

interface RedirectEnterprise {
  shops?: RedirectShop[];
}

/**
 * Entry point for the enterprise console: resolves the first shop of the
 * enterprise and redirects to its Point-of-Sale view. If the enterprise has
 * no shop, falls back to the enterprise-level reports view.
 */
export default function EnterpriseConsoleRedirect() {
  const { enterpriseId } = useParams<{ enterpriseId: string }>();
  const [target, setTarget] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enterpriseId) return;
    let cancelled = false;

    const resolve = async () => {
      try {
        const data = (await adminApi.getEnterpriseDetails(enterpriseId)) as RedirectEnterprise;
        if (cancelled) return;
        const firstShop = data.shops?.[0];
        if (firstShop) {
          setTarget(`/enterprises/${enterpriseId}/console/${firstShop.id}/pos`);
        } else {
          setTarget(`/enterprises/${enterpriseId}/console/reports`);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [enterpriseId]);

  if (failed) return <Navigate to="/enterprises" replace />;

  if (!target) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <p className="text-sm text-slate-500">Ouverture de la console…</p>
      </div>
    );
  }

  return <Navigate to={target} replace />;
}

import { useState, useEffect } from 'react';
import { invoicesApi } from '../lib/api';

interface Invoice {
  id: string;
  invoice_number: string;
  created_at: string;
  customer?: {
    name: string;
    first_name?: string;
  };
  total_ttc: number;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED';
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Brouillon', className: 'bg-gray-100 text-gray-700' },
  ISSUED: { label: 'Émise', className: 'bg-blue-100 text-blue-700' },
  PAID: { label: 'Payée', className: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Annulée', className: 'bg-red-100 text-red-700' },
};

const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loadingPdfId, setLoadingPdfId] = useState<string | null>(null);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async (filters?: { start_date?: string; end_date?: string }) => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filters?.start_date) params.start_date = filters.start_date;
      if (filters?.end_date) params.end_date = filters.end_date;

      const data = await invoicesApi.getAll(Object.keys(params).length > 0 ? params : undefined);
      setInvoices(data);
    } catch (error) {
      console.error('Erreur lors du chargement des factures:', error);
      alert('Impossible de charger les factures.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilter = () => {
    const filters: { start_date?: string; end_date?: string } = {};
    if (startDate) filters.start_date = startDate;
    if (endDate) filters.end_date = endDate;
    loadInvoices(filters);
  };

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    loadInvoices();
  };

  const handleViewPdf = async (invoice: Invoice) => {
    setLoadingPdfId(invoice.id);
    try {
      const data = await invoicesApi.getPdfBase64(invoice.id);
      const base64 = data.pdf_base64 || data.base64 || data;

      // Ouvrir le PDF dans un nouvel onglet
      const pdfData = typeof base64 === 'string' && base64.startsWith('data:')
        ? base64
        : `data:application/pdf;base64,${base64}`;
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(
          `<html><head><title>Facture ${invoice.invoice_number}</title></head>` +
          `<body style="margin:0"><iframe src="${pdfData}" width="100%" height="100%" style="border:none;"></iframe></body></html>`
        );
        newWindow.document.close();
      }
    } catch (error) {
      console.error('Erreur lors du chargement du PDF:', error);
      alert('Impossible de charger le PDF de la facture.');
    } finally {
      setLoadingPdfId(null);
    }
  };

  const stats = {
    total: invoices.length,
    issued: invoices.filter(i => i.status === 'ISSUED').length,
    paid: invoices.filter(i => i.status === 'PAID').length,
    totalAmount: invoices
      .filter(i => i.status !== 'CANCELLED')
      .reduce((sum, i) => sum + i.total_ttc, 0),
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header avec stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-primary-500 to-primary-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 text-sm">Total Factures</p>
              <p className="text-3xl font-bold mt-1">{stats.total}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Émises</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.issued}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Payées</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.paid}</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Montant total</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatAmount(stats.totalAmount)}
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Filtres par date */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-end">
          <div className="flex flex-col md:flex-row gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Date début</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Date fin</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="input"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleFilter} className="btn-primary whitespace-nowrap">
              Filtrer
            </button>
            {(startDate || endDate) && (
              <button onClick={handleResetFilters} className="btn-secondary whitespace-nowrap">
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table des factures */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Liste des factures</h2>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-12 h-12 spinner"></div>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-gray-500">Aucune facture trouvée</p>
            <p className="text-gray-400 text-sm mt-1">
              {startDate || endDate
                ? 'Essayez de modifier les filtres de date'
                : 'Les factures apparaîtront ici après leur création'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    N° Facture
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total TTC
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map(invoice => {
                  const statusConfig = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.DRAFT;
                  const customerName = invoice.customer
                    ? `${invoice.customer.first_name || ''} ${invoice.customer.name}`.trim()
                    : 'Client anonyme';

                  return (
                    <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{invoice.invoice_number}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600">{formatDate(invoice.created_at)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900">{customerName}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">
                          {formatAmount(invoice.total_ttc)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.className}`}
                        >
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleViewPdf(invoice)}
                          disabled={loadingPdfId === invoice.id}
                          className="text-primary-600 hover:text-primary-700 font-medium text-sm disabled:text-gray-400 disabled:cursor-wait flex items-center gap-1 ml-auto"
                        >
                          {loadingPdfId === invoice.id ? (
                            <>
                              <div className="w-4 h-4 spinner"></div>
                              <span>Chargement...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                />
                              </svg>
                              <span>Voir PDF</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

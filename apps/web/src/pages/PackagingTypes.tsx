import { useState, useEffect } from 'react';
import { packagingTypesApi } from '../lib/api';

interface PackagingType {
  id: string;
  name: string;
  symbol?: string;
  is_default: boolean;
}

export default function PackagingTypes() {
  const [packagingTypes, setPackagingTypes] = useState<PackagingType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedType, setSelectedType] = useState<PackagingType | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
  });

  useEffect(() => {
    loadPackagingTypes();
  }, []);

  const loadPackagingTypes = async () => {
    setIsLoading(true);
    try {
      const data = await packagingTypesApi.getAll();
      setPackagingTypes(data);
    } catch (error) {
      console.error('Erreur lors du chargement des conditionnements:', error);
      alert('Impossible de charger les conditionnements.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (type?: PackagingType) => {
    if (type) {
      setSelectedType(type);
      setFormData({
        name: type.name,
        symbol: type.symbol || '',
      });
    } else {
      setSelectedType(null);
      setFormData({ name: '', symbol: '' });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedType(null);
    setFormData({ name: '', symbol: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      name: formData.name.trim(),
      symbol: formData.symbol.trim() || undefined,
    };

    if (!payload.name) {
      alert('Le nom est obligatoire.');
      return;
    }

    setIsSaving(true);
    try {
      if (selectedType) {
        await packagingTypesApi.update(selectedType.id, payload);
      } else {
        await packagingTypesApi.create(payload);
      }
      handleCloseModal();
      loadPackagingTypes();
    } catch (error) {
      console.error("Erreur lors de l'enregistrement:", error);
      alert("Impossible d'enregistrer le conditionnement.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await packagingTypesApi.delete(id);
      setShowDeleteConfirm(null);
      loadPackagingTypes();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Impossible de supprimer le conditionnement.');
    }
  };

  const handleInitDefaults = async () => {
    try {
      await packagingTypesApi.initDefaults();
      loadPackagingTypes();
    } catch (error) {
      console.error("Erreur lors de l'initialisation:", error);
      alert("Impossible d'initialiser les conditionnements par défaut.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="card bg-gradient-to-br from-primary-500 to-primary-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Conditionnements</h1>
            <p className="text-primary-100 text-sm mt-1">
              Gérez les types de conditionnement pour vos produits
            </p>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <p className="text-gray-600 text-sm">
            {packagingTypes.length} conditionnement{packagingTypes.length !== 1 ? 's' : ''}{' '}
            enregistré{packagingTypes.length !== 1 ? 's' : ''}
          </p>
          <div className="flex gap-3">
            {packagingTypes.length === 0 && !isLoading && (
              <button
                onClick={handleInitDefaults}
                className="btn-secondary flex items-center gap-2 whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>Initialiser par défaut</span>
              </button>
            )}
            <button
              onClick={() => handleOpenModal()}
              className="btn-primary flex items-center gap-2 whitespace-nowrap"
            >
              <span>+</span>
              <span>Ajouter un conditionnement</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Liste des conditionnements</h2>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-12 h-12 spinner"></div>
          </div>
        ) : packagingTypes.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-50 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <p className="text-gray-500">Aucun conditionnement enregistré</p>
            <p className="text-gray-400 text-sm mt-1">
              Cliquez sur "Initialiser par défaut" ou ajoutez-en un manuellement
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nom
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Symbole
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Par défaut
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {packagingTypes.map(type => (
                  <tr key={type.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{type.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600">{type.symbol || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      {type.is_default ? (
                        <span className="badge badge-success">Par défaut</span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handleOpenModal(type)}
                          className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(type.id)}
                          disabled={type.is_default}
                          className={`font-medium text-sm ${
                            type.is_default
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-danger-600 hover:text-danger-700'
                          }`}
                          title={
                            type.is_default
                              ? 'Les types par défaut ne peuvent pas être supprimés'
                              : 'Supprimer'
                          }
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Formulaire */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-medium animate-scale-in max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 px-6 py-5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">
                    {selectedType ? 'Modifier le conditionnement' : 'Nouveau conditionnement'}
                  </h2>
                  <p className="text-sm text-primary-100 mt-1">
                    {selectedType
                      ? 'Mettre à jour les informations'
                      : 'Ajouter un nouveau type de conditionnement'}
                  </p>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Nom <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="Ex: Carton, Sachet, Blister..."
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Symbole</label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={e => setFormData({ ...formData, symbol: e.target.value })}
                  className="input"
                  placeholder="Ex: CTN, SCH, BLS..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Abréviation courte utilisée dans les documents
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={handleCloseModal} className="btn-secondary flex-1">
                  Annuler
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={isSaving}>
                  {isSaving ? 'Enregistrement...' : selectedType ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmation Suppression */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-medium animate-scale-in">
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-danger-50 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-danger-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Confirmer la suppression</h3>
              <p className="text-gray-600 mb-6">
                Voulez-vous vraiment supprimer ce conditionnement ? Cette action est irréversible.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(null)} className="btn-secondary flex-1">
                  Annuler
                </button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm)}
                  className="flex-1 px-4 py-2.5 bg-danger-600 text-white rounded-xl font-medium hover:bg-danger-700 transition-colors"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

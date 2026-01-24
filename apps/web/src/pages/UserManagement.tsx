import { useState, useEffect } from 'react';
import { adminApi } from '../lib/api';
import { formatDate } from '@swalo/core/utils';

interface Device {
  id: string;
  device_id: string;
  device_name?: string;
  device_type?: string;
  last_login_at?: string;
  is_active: boolean;
  revoked_at?: string;
  created_at: string;
}

interface User {
  id: string;
  display_name: string;
  email?: string;
  phone?: string;
  pin_code?: string;
  is_active: boolean;
  created_at: string;
  devices: Device[];
}

interface UserRole {
  id: string;
  role: string;
  work_start_time?: string;
  work_end_time?: string;
  work_days?: string;
  user: User;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserRole | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDevicesModal, setShowDevicesModal] = useState(false);

  // Form state
  const [role, setRole] = useState('');
  const [workStartTime, setWorkStartTime] = useState('');
  const [workEndTime, setWorkEndTime] = useState('');
  const [workDays, setWorkDays] = useState<string[]>([]);

  const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const DAY_LABELS: Record<string, string> = {
    MON: 'Lundi',
    TUE: 'Mardi',
    WED: 'Mercredi',
    THU: 'Jeudi',
    FRI: 'Vendredi',
    SAT: 'Samedi',
    SUN: 'Dimanche',
  };

  const ROLES = [
    { value: 'EMPLOYEE', label: 'Employé' },
    { value: 'ADMIN', label: 'Administrateur' },
    { value: 'OWNER', label: 'Propriétaire' },
  ];

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await adminApi.getShopUsers();
      setUsers(data);
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
      alert('Impossible de charger les utilisateurs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenEditModal = (userRole: UserRole) => {
    setSelectedUser(userRole);
    setRole(userRole.role);
    setWorkStartTime(userRole.work_start_time || '07:00');
    setWorkEndTime(userRole.work_end_time || '20:00');

    if (userRole.work_days) {
      try {
        setWorkDays(JSON.parse(userRole.work_days));
      } catch {
        setWorkDays(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
      }
    } else {
      setWorkDays(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
    }

    setShowModal(true);
  };

  const handleOpenDevicesModal = (userRole: UserRole) => {
    setSelectedUser(userRole);
    setShowDevicesModal(true);
  };

  const handleSaveUserRole = async () => {
    if (!selectedUser) return;

    try {
      await adminApi.updateUserRole(selectedUser.user.id, {
        role,
        work_start_time: workStartTime,
        work_end_time: workEndTime,
        work_days: JSON.stringify(workDays),
      });

      alert('Utilisateur mis à jour avec succès');
      setShowModal(false);
      loadUsers();
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour:', error);
      alert(error.response?.data?.message || 'Erreur lors de la mise à jour');
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir révoquer cet appareil ?')) return;

    try {
      await adminApi.revokeDevice(deviceId);
      alert('Appareil révoqué avec succès');
      loadUsers();
    } catch (error: any) {
      console.error('Erreur lors de la révocation:', error);
      alert(error.response?.data?.message || 'Erreur lors de la révocation');
    }
  };

  const handleDeactivateUser = async (userId: string, displayName: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir désactiver l'accès de ${displayName} ?`)) return;

    try {
      await adminApi.deactivateUser(userId);
      alert('Utilisateur désactivé avec succès');
      loadUsers();
    } catch (error: any) {
      console.error('Erreur lors de la désactivation:', error);
      alert(error.response?.data?.message || 'Erreur lors de la désactivation');
    }
  };

  const toggleDay = (day: string) => {
    if (workDays.includes(day)) {
      setWorkDays(workDays.filter(d => d !== day));
    } else {
      setWorkDays([...workDays, day]);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestion des utilisateurs</h1>
        <p className="text-gray-600 mt-1">Gérez les accès et permissions des utilisateurs</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilisateur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rôle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Horaires
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Appareils
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map(userRole => (
                <tr key={userRole.id}>
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {userRole.user.display_name}
                      </div>
                      {userRole.user.email && (
                        <div className="text-sm text-gray-500">{userRole.user.email}</div>
                      )}
                      {userRole.user.phone && (
                        <div className="text-sm text-gray-500">{userRole.user.phone}</div>
                      )}
                      {userRole.user.pin_code && (
                        <div className="text-xs text-gray-400">PIN: {userRole.user.pin_code}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`badge ${
                        userRole.role === 'ADMIN' || userRole.role === 'OWNER'
                          ? 'badge-primary'
                          : 'badge-secondary'
                      }`}
                    >
                      {userRole.role === 'EMPLOYEE' && 'Employé'}
                      {userRole.role === 'ADMIN' && 'Admin'}
                      {userRole.role === 'OWNER' && 'Propriétaire'}
                      {userRole.role === 'MANAGER' && 'Manager'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {userRole.work_start_time && userRole.work_end_time ? (
                      <div>
                        {userRole.work_start_time} - {userRole.work_end_time}
                      </div>
                    ) : (
                      <span className="text-gray-400">Non défini</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleOpenDevicesModal(userRole)}
                      className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                    >
                      {userRole.user.devices.length} appareil(s)
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`badge ${
                        userRole.user.is_active ? 'badge-success' : 'badge-danger'
                      }`}
                    >
                      {userRole.user.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => handleOpenEditModal(userRole)}
                        className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() =>
                          handleDeactivateUser(userRole.user.id, userRole.user.display_name)
                        }
                        className="text-red-600 hover:text-red-700 font-medium text-sm"
                      >
                        Désactiver
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit User Modal */}
      {showModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content max-w-2xl">
            <div className="modal-header">
              <h3 className="modal-title">Modifier l'utilisateur</h3>
              <button onClick={() => setShowModal(false)} className="modal-close">
                ✕
              </button>
            </div>

            <div className="modal-body space-y-4">
              <div>
                <label className="form-label">Utilisateur</label>
                <div className="text-gray-900 font-medium">{selectedUser.user.display_name}</div>
              </div>

              <div>
                <label className="form-label">Rôle</label>
                <select value={role} onChange={e => setRole(e.target.value)} className="form-input">
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Heure de début</label>
                  <input
                    type="time"
                    value={workStartTime}
                    onChange={e => setWorkStartTime(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Heure de fin</label>
                  <input
                    type="time"
                    value={workEndTime}
                    onChange={e => setWorkEndTime(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Jours de travail</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map(day => (
                    <button
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        workDays.includes(day)
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {DAY_LABELS[day]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">
                Annuler
              </button>
              <button onClick={handleSaveUserRole} className="btn btn-primary">
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Devices Modal */}
      {showDevicesModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content max-w-3xl">
            <div className="modal-header">
              <h3 className="modal-title">Appareils de {selectedUser.user.display_name}</h3>
              <button onClick={() => setShowDevicesModal(false)} className="modal-close">
                ✕
              </button>
            </div>

            <div className="modal-body">
              {selectedUser.user.devices.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Aucun appareil enregistré</p>
              ) : (
                <div className="space-y-3">
                  {selectedUser.user.devices.map(device => (
                    <div
                      key={device.id}
                      className={`p-4 rounded-lg border ${
                        device.is_active
                          ? 'border-green-200 bg-green-50'
                          : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {device.device_name || device.device_type || 'Appareil'}
                            </span>
                            <span
                              className={`badge ${
                                device.is_active ? 'badge-success' : 'badge-danger'
                              }`}
                            >
                              {device.is_active ? 'Actif' : 'Révoqué'}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            ID: {device.device_id.substring(0, 16)}...
                          </div>
                          {device.last_login_at && (
                            <div className="text-sm text-gray-500 mt-1">
                              Dernière connexion: {formatDate(device.last_login_at)}
                            </div>
                          )}
                          {device.revoked_at && (
                            <div className="text-sm text-red-600 mt-1">
                              Révoqué le: {formatDate(device.revoked_at)}
                            </div>
                          )}
                        </div>
                        {device.is_active && (
                          <button
                            onClick={() => handleRevokeDevice(device.id)}
                            className="btn btn-sm btn-danger"
                          >
                            Révoquer
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowDevicesModal(false)} className="btn btn-secondary">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

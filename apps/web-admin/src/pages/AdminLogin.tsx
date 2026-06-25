import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Logo from '../components/ui/Logo';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login, error, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/');
    } catch {
      // Error is handled by the store
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md">
        {/* Card principale */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 animate-scale-in">
          {/* Logo et titre */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex items-center justify-center">
              <Logo variant="icon" size="lg" />
            </div>
            <h1 className="text-3xl font-bold text-primary-900 mb-1">Swalo Admin</h1>
            <p className="text-gray-600 text-sm">Plateforme d'administration</p>
          </div>

          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Connexion</h2>
          <p className="text-sm text-gray-600 text-center mb-6">
            Accedez a la plateforme d'administration
          </p>

          {error && (
            <div className="mb-4 p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-xl text-sm text-center animate-slide-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email ou telephone
              </label>
              <input
                id="email"
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                placeholder="admin@swalo.app"
                required
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input"
                placeholder="Votre mot de passe"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full btn-primary btn-lg"
            >
              {isLoading ? (
                <span className="flex items-center justify-center space-x-2">
                  <span className="spinner w-5 h-5"></span>
                  <span>Connexion...</span>
                </span>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center animate-slide-in">
          <p className="text-sm text-white font-medium opacity-90">
            Acces reserve aux administrateurs Swalo
          </p>
        </div>
      </div>
    </div>
  );
}

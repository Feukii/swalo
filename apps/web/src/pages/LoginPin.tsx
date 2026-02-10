import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function LoginPin() {
  const [shopCode, setShopCode] = useState('');
  const [pin, setPin] = useState('');
  const { loginWithPin, error, isLoading } = useAuthStore();
  const navigate = useNavigate();

  // Ref to prevent multiple auto-submit attempts
  const hasAutoSubmittedRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Auto-submit when PIN reaches 4 digits and shop code is complete
  useEffect(() => {
    if (pin.length === 4 && shopCode.length === 6 && !isLoading && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      // Trigger form submission programmatically
      formRef.current?.requestSubmit();
    }
  }, [pin, shopCode, isLoading]);

  // Reset auto-submit flag when PIN is cleared (e.g., after error)
  useEffect(() => {
    if (pin.length === 0) {
      hasAutoSubmittedRef.current = false;
    }
  }, [pin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (shopCode.length !== 6) {
      return;
    }

    if (pin.length !== 4) {
      return;
    }

    try {
      await loginWithPin(shopCode, pin);
      navigate('/pos');
    } catch (err) {
      console.error('Login failed:', err);
      // Effacer les champs en cas d'erreur
      setShopCode('');
      setPin('');
    }
  };

  const handleShopCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
    setShopCode(value);
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    setPin(value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-purple-800 flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md">
        {/* Card principale */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 animate-scale-in">
          {/* Logo et titre */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-4xl font-bold text-white">S</span>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent mb-2">
              SWALO
            </h1>
            <p className="text-gray-600 text-sm">Gérez, Vendez, Prospérez</p>
          </div>

          {/* Formulaire */}
          <form ref={formRef} onSubmit={handleSubmit}>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Bienvenue</h2>
              <p className="text-sm text-gray-600 text-center mb-6">
                Entrez votre code boutique et PIN
              </p>

              {/* Code Boutique */}
              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Code Boutique (6 chiffres)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={shopCode}
                  onChange={handleShopCodeChange}
                  placeholder="123456"
                  maxLength={6}
                  autoFocus
                  disabled={isLoading}
                  className="w-full px-4 py-3 text-center text-lg font-mono tracking-widest bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-purple-600 focus:ring-2 focus:ring-purple-200 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Code PIN */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Code PIN (4 chiffres)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin}
                  onChange={handlePinChange}
                  placeholder="••••"
                  maxLength={4}
                  disabled={isLoading}
                  className="w-full px-4 py-3 text-center text-lg font-mono tracking-widest bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-purple-600 focus:ring-2 focus:ring-purple-200 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Message d'erreur */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl animate-slide-in">
                  <p className="text-red-700 text-sm text-center">{error}</p>
                </div>
              )}

              {/* Bouton de connexion */}
              <button
                type="submit"
                disabled={isLoading || shopCode.length !== 6 || pin.length !== 4}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold rounded-xl shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Connexion...
                  </div>
                ) : (
                  'SE CONNECTER'
                )}
              </button>

              {/* Info */}
              <p className="text-xs text-gray-500 text-center mt-4">
                Les codes sont fournis par l'administrateur
              </p>
            </div>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white text-gray-500">ou</span>
            </div>
          </div>

          {/* Lien création boutique (Admin uniquement) */}
          <div className="text-center">
            <Link
              to="/create-shop"
              className="text-purple-600 text-sm font-medium hover:text-purple-700 hover:underline transition-colors"
            >
              Créer une nouvelle boutique (Admin)
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center animate-slide-in">
          <p className="text-sm text-white font-medium opacity-90">SWALO v1.0 - Gestion Retail</p>
        </div>
      </div>
    </div>
  );
}

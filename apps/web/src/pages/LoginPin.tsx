import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Logo from '../components/ui/Logo';

export default function LoginPin() {
  const [shopCode, setShopCode] = useState('');
  const [pin, setPin] = useState('');
  const { loginWithPin, error, isLoading } = useAuthStore();
  const navigate = useNavigate();

  // Ref to prevent multiple auto-submit attempts
  const hasAutoSubmittedRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Auto-submit when PIN is complete and the shop code respects the policy length
  useEffect(() => {
    const isShopCodeValid = shopCode.length >= 4 && shopCode.length <= 10;
    if (pin.length === 4 && isShopCodeValid && !isLoading && !hasAutoSubmittedRef.current) {
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
    if (shopCode.length < 4 || shopCode.length > 10) {
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
    const value = e.target.value
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 10);
    setShopCode(value);
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    setPin(value);
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
            <h1 className="text-3xl font-bold text-primary-900 mb-2">Swalo</h1>
            <p className="text-gray-600 text-sm">Gerez, Vendez, Prosperez</p>
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
                  Code Boutique
                </label>
                <input
                  type="text"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  value={shopCode}
                  onChange={handleShopCodeChange}
                  placeholder="BTQ01"
                  maxLength={10}
                  autoFocus
                  disabled={isLoading}
                  className="w-full px-4 py-3 text-center text-lg font-mono tracking-widest bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-action-500 focus:ring-2 focus:ring-action-200 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="w-full px-4 py-3 text-center text-lg font-mono tracking-widest bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-action-500 focus:ring-2 focus:ring-action-200 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                disabled={
                  isLoading || shopCode.length < 4 || shopCode.length > 10 || pin.length !== 4
                }
                className="w-full py-3 bg-action-500 hover:bg-action-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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
              className="text-action-600 text-sm font-medium hover:text-action-700 hover:underline transition-colors"
            >
              Créer une nouvelle boutique (Admin)
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center animate-slide-in">
          <p className="text-sm text-white font-medium opacity-90">Swalo v1.0 - Gestion Retail</p>
        </div>
      </div>
    </div>
  );
}

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'icon' | 'full';
  /** Color treatment of the wordmark — `marine` on light surfaces, `light` on dark surfaces */
  tone?: 'marine' | 'light';
  className?: string;
}

const sizeMap = {
  sm: { img: 'w-8 h-8', text: 'text-lg', sub: 'text-xs' },
  md: { img: 'w-10 h-10', text: 'text-xl', sub: 'text-xs' },
  lg: { img: 'w-20 h-20', text: 'text-3xl', sub: 'text-sm' },
};

/**
 * Logo Swalo Admin — miroir du composant Logo de apps/web.
 * Utilise l'icône "ciel" de la marque et le wordmark "Swalo" avec un sous-titre "Admin".
 */
const Logo = ({ size = 'md', variant = 'full', tone = 'marine', className = '' }: LogoProps) => {
  const s = sizeMap[size];
  const wordmarkColor = tone === 'light' ? 'text-white' : 'text-primary-900';
  const subColor = tone === 'light' ? 'text-action-300' : 'text-action-500';
  // Sur fond clair: monogramme « S » marine. Sur fond marine: variante ciel (lisible).
  const monogram = tone === 'light' ? '/swalo_icone_ciel.svg' : '/swalo_icone_marine.png';

  if (variant === 'icon') {
    return <img src={monogram} alt="Swalo" className={`${s.img} object-contain ${className}`} />;
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <img src={monogram} alt="Swalo" className={`${s.img} object-contain`} />
      <div className="leading-none">
        <span className={`${s.text} font-bold ${wordmarkColor}`}>Swalo</span>
        <span className={`${s.sub} ${subColor} block font-medium -mt-0.5`}>Admin</span>
      </div>
    </div>
  );
};

export default Logo;

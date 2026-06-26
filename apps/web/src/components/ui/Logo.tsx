import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'icon' | 'full';
  /** Color treatment of the wordmark — `marine` on light surfaces, `light` on dark/marine surfaces */
  tone?: 'marine' | 'light';
  className?: string;
}

const sizeMap = {
  sm: { img: 'w-8 h-8', text: 'text-lg' },
  md: { img: 'w-10 h-10', text: 'text-xl' },
  lg: { img: 'w-20 h-20', text: 'text-3xl' },
};

/**
 * Logo Swalo — charte "Marine + Sky vif".
 * Règle de marque: sur fond blanc/clair on affiche le monogramme « S » (marine)
 * + le wordmark "Swalo" en texte stylé (marine), jamais le logo horizontal complet.
 * Sur fond marine, on bascule le wordmark en blanc (tone="light").
 */
const Logo: React.FC<LogoProps> = ({
  size = 'md',
  variant = 'full',
  tone = 'marine',
  className = '',
}) => {
  const s = sizeMap[size];
  const wordmarkColor = tone === 'light' ? 'text-white' : 'text-primary-900';

  if (variant === 'icon') {
    return (
      <img
        src="/swalo_icone_marine.png"
        alt="Swalo"
        className={`${s.img} object-contain ${className}`}
      />
    );
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <img src="/swalo_icone_marine.png" alt="Swalo" className={`${s.img} object-contain`} />
      <span className={`${s.text} font-bold ${wordmarkColor}`}>Swalo</span>
    </div>
  );
};

export default Logo;

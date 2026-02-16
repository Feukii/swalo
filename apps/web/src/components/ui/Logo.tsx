import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'icon' | 'full';
  className?: string;
}

const sizeMap = {
  sm: { img: 'w-8 h-8', text: 'text-lg' },
  md: { img: 'w-10 h-10', text: 'text-xl' },
  lg: { img: 'w-20 h-20', text: 'text-3xl' },
};

const Logo: React.FC<LogoProps> = ({ size = 'md', variant = 'full', className = '' }) => {
  const s = sizeMap[size];

  if (variant === 'icon') {
    return <img src="/logo.png" alt="SWALO" className={`${s.img} object-contain ${className}`} />;
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <img src="/logo.png" alt="SWALO" className={`${s.img} object-contain`} />
      <span className={`${s.text} font-bold text-primary-900`}>SWALO</span>
    </div>
  );
};

export default Logo;

import React from 'react';

interface ErpPremiaLogoProps {
  variant?: 'full' | 'compact' | 'emblem';
  layout?: 'horizontal' | 'stacked';
  theme?: 'dark' | 'light';
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const ErpPremiaEmblem: React.FC<{ size?: number; className?: string }> = ({
  size = 40,
  className = '',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 340 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-label="ERPremIA Emblem"
    >
      <defs>
        {/* Gradients */}
        <linearGradient id="ep-e-grad" x1="50" y1="40" x2="200" y2="240" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="45%" stopColor="#0f2b5c" />
          <stop offset="100%" stopColor="#08142c" />
        </linearGradient>

        <linearGradient id="ep-wave-grad" x1="140" y1="230" x2="240" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="40%" stopColor="#06b6d4" />
          <stop offset="85%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#7dd3fc" />
        </linearGradient>

        <linearGradient id="ep-a-right-grad" x1="200" y1="50" x2="250" y2="240" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0e3a75" />
          <stop offset="60%" stopColor="#1e3a8a" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>

        <radialGradient id="ep-core-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="40%" stopColor="#fef08a" stopOpacity="0.85" />
          <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0f224a" stopOpacity="0" />
        </radialGradient>

        <filter id="ep-glow-filter" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Network Node Lines (Left & Background of E) */}
      <g stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" opacity="0.85">
        {/* External Satellite Stems */}
        <line x1="38" y1="105" x2="75" y2="95" />
        <line x1="25" y1="145" x2="75" y2="145" strokeWidth="3" />
        <line x1="36" y1="185" x2="75" y2="185" />
        <line x1="150" y1="18" x2="150" y2="48" strokeWidth="3" />
        <line x1="188" y1="218" x2="208" y2="248" />

        {/* Mesh Lines on E block */}
        <line x1="75" y1="95" x2="115" y2="65" />
        <line x1="75" y1="95" x2="110" y2="115" />
        <line x1="75" y1="145" x2="110" y2="115" />
        <line x1="75" y1="145" x2="110" y2="175" />
        <line x1="75" y1="185" x2="110" y2="175" />
        <line x1="110" y1="115" x2="150" y2="90" />
        <line x1="110" y1="175" x2="145" y2="195" />
        <line x1="115" y1="65" x2="150" y2="90" />
        <line x1="150" y1="90" x2="175" y2="110" />
        <line x1="110" y1="175" x2="75" y2="215" />
        <line x1="75" y1="215" x2="145" y2="215" />
      </g>

      {/* External Satellite Circles */}
      <circle cx="38" cy="105" r="5" fill="#0284c7" />
      <circle cx="25" cy="145" r="6.5" fill="#0284c7" />
      <circle cx="36" cy="185" r="5" fill="#0284c7" />
      <circle cx="150" cy="18" r="6" fill="#0284c7" />
      <circle cx="208" cy="248" r="5" fill="#0284c7" />

      {/* Internal Constellation Circles */}
      <circle cx="75" cy="95" r="4.5" fill="#38bdf8" />
      <circle cx="75" cy="145" r="5" fill="#38bdf8" />
      <circle cx="75" cy="185" r="4.5" fill="#38bdf8" />
      <circle cx="115" cy="65" r="4.5" fill="#38bdf8" />
      <circle cx="110" cy="115" r="5" fill="#38bdf8" />
      <circle cx="110" cy="175" r="5" fill="#38bdf8" />
      <circle cx="145" cy="195" r="4.5" fill="#38bdf8" />
      <circle cx="75" cy="215" r="5" fill="#38bdf8" />

      {/* Primary Structure: Solid Letter E Elements */}
      {/* Top Arm of E */}
      <path
        d="M75 48 H182 C192 48 198 56 194 65 L182 82 H75 Z"
        fill="url(#ep-e-grad)"
      />
      {/* Vertical Spine of E */}
      <path
        d="M75 48 H100 V215 H75 Z"
        fill="url(#ep-e-grad)"
      />
      {/* Center Arm of E (pointing like an arrow towards the star core) */}
      <path
        d="M75 133 H125 L140 145 L125 157 H75 Z"
        fill="#0284c7"
      />
      {/* Bottom Arm of E */}
      <path
        d="M75 198 H152 C165 198 178 206 186 215 H75 Z"
        fill="url(#ep-e-grad)"
      />

      {/* Letter A: Right Structural Leg (Navy) */}
      <path
        d="M192 50 C210 50 230 75 236 100 L256 215 C258 226 250 235 238 235 H214 C206 235 200 228 198 220 L188 170 C186 160 192 152 202 152 H222 L212 95 C208 78 198 65 186 60 Z"
        fill="url(#ep-a-right-grad)"
      />

      {/* Central Circular Lens / Compass Iris */}
      <circle
        cx="160"
        cy="145"
        r="28"
        fill="#0a1936"
        stroke="#06b6d4"
        strokeWidth="3.5"
      />

      {/* Radiating Satellite Dots around Core */}
      <g fill="#7dd3fc">
        <circle cx="160" cy="111" r="3" />
        <circle cx="184" cy="121" r="3" />
        <circle cx="194" cy="145" r="3" />
        <circle cx="184" cy="169" r="3" />
        <circle cx="160" cy="179" r="3" />
        <circle cx="136" cy="169" r="3" />
        <circle cx="126" cy="145" r="3" />
        <circle cx="136" cy="121" r="3" />
      </g>

      {/* Radial Rays from Spark */}
      <g stroke="#fef08a" strokeWidth="1.5" strokeLinecap="round" opacity="0.8">
        <line x1="160" y1="125" x2="160" y2="135" />
        <line x1="160" y1="155" x2="160" y2="165" />
        <line x1="140" y1="145" x2="150" y2="145" />
        <line x1="170" y1="145" x2="180" y2="145" />
        <line x1="146" y1="131" x2="153" y2="138" />
        <line x1="167" y1="152" x2="174" y2="159" />
        <line x1="146" y1="159" x2="153" y2="152" />
        <line x1="167" y1="138" x2="174" y2="131" />
      </g>

      {/* Glowing Star Burst / AI Spark (8-point diamond star) */}
      <g filter="url(#ep-glow-filter)">
        {/* Core Halo */}
        <circle cx="160" cy="145" r="14" fill="url(#ep-core-glow)" />

        {/* Primary 4-point Diamond Star (White) */}
        <polygon
          points="160,118 165,140 187,145 165,150 160,172 155,150 133,145 155,140"
          fill="#ffffff"
        />
        {/* Secondary 4-point Diamond Star (Gold/Cyan accent) */}
        <polygon
          points="160,130 163,142 175,145 163,148 160,160 157,148 145,145 157,142"
          fill="#fef08a"
          opacity="0.9"
        />
      </g>

      {/* Letter A: Dynamic Fluid Ribbon Wave (Cyan to Turquoise) */}
      {/* Front sweeping wing / crest */}
      <path
        d="M138 235 C162 235 192 215 210 180 C232 138 245 92 254 62 C255 58 250 56 247 59 C238 72 225 105 208 140 C194 168 174 196 150 208 C138 214 130 226 138 235 Z"
        fill="url(#ep-wave-grad)"
      />
      {/* Trailing Swoosh Tail with Sharp Crest */}
      <path
        d="M210 175 C230 145 248 105 253 66 C254 63 252 61 249 62 C240 76 226 108 205 145 C185 180 160 210 142 226 C155 220 188 202 210 175 Z"
        fill="#38bdf8"
        opacity="0.75"
      />
    </svg>
  );
};

export const ErpPremiaLogo: React.FC<ErpPremiaLogoProps> = ({
  variant = 'full',
  layout = 'horizontal',
  theme = 'dark',
  className = '',
  size = 'md',
}) => {
  const emblemSizes = {
    sm: 28,
    md: 38,
    lg: 48,
    xl: 60,
  };

  const isDark = theme === 'dark';

  if (variant === 'emblem') {
    return <ErpPremiaEmblem size={emblemSizes[size]} className={className} />;
  }

  const primaryTextColor = isDark ? 'text-white' : 'text-[#0a1936]';
  const accentTextColor = isDark ? 'text-cyan-400' : 'text-[#0284c7]';
  const subtitleColor = isDark ? 'text-slate-400' : 'text-slate-500';

  if (layout === 'stacked') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <ErpPremiaEmblem size={emblemSizes[size] * 1.3} className="mb-2" />
        <div className="flex items-baseline tracking-tight font-sans">
          <span className={`font-black text-xl tracking-tight ${primaryTextColor}`}>
            ERP
          </span>
          <span className={`font-medium text-xl ${primaryTextColor}`}>
            rem
          </span>
          <span className={`font-black text-xl tracking-tight ${accentTextColor}`}>
            IA
          </span>
        </div>
        {variant === 'full' && (
          <span className={`text-[9px] font-bold tracking-[0.2em] uppercase mt-0.5 ${subtitleColor}`}>
            ERP AGÉNTICO CON IA
          </span>
        )}
      </div>
    );
  }

  // Horizontal Layout (for Navbar and Headers)
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <ErpPremiaEmblem size={emblemSizes[size]} />
      <div className="flex flex-col justify-center leading-none">
        <div className="flex items-baseline tracking-tight font-sans">
          <span className={`font-black text-lg sm:text-xl tracking-tight ${primaryTextColor}`}>
            ERP
          </span>
          <span className={`font-semibold text-lg sm:text-xl ${primaryTextColor}`}>
            rem
          </span>
          <span className={`font-black text-lg sm:text-xl tracking-tight ${accentTextColor}`}>
            IA
          </span>
        </div>
        {variant === 'full' && (
          <span className={`text-[8.5px] sm:text-[9px] font-bold tracking-[0.16em] uppercase mt-0.5 ${subtitleColor}`}>
            ERP AGÉNTICO CON IA
          </span>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import { isDemoModeEnabled } from '../config/demoMode';

/**
 * 1.6: franja visible en toda la interfaz cuando DEMO_MODE=true.
 * Con DEMO_MODE apagado no se renderiza nada.
 */
export const DemoModeBanner: React.FC = () => {
  if (!isDemoModeEnabled()) return null;
  return (
    <div
      role="status"
      data-testid="demo-mode-banner"
      className="sticky top-0 z-[9999] w-full bg-amber-400 text-amber-950 text-center text-xs font-extrabold tracking-widest py-1 shadow"
    >
      DEMOSTRACIÓN · Datos de ejemplo sin validez tributaria ni contable
    </div>
  );
};

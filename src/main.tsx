import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installGlobalFetchInterceptor } from './services/apiClient';

// Instalar interceptor global para adjuntar Bearer token automáticamente a todas las llamadas /api
installGlobalFetchInterceptor();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

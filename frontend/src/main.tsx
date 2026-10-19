import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import { CourseProvider } from './context/CourseContext';
import { ChunkLoadBoundary, reloadAfterChunkError } from './components/ChunkLoadBoundary';
import './index.css';
import './app-shell.css';

const Landing = lazy(() => import('./pages/Landing').then(module => ({ default: module.Landing })));
const host = window.location.hostname;
const isPublicSite = ['facilitaestudos.com.br', 'www.facilitaestudos.com.br'].includes(host) || (['localhost', '127.0.0.1'].includes(host) && window.location.pathname === '/');

window.addEventListener('vite:preloadError', event => {
  if (reloadAfterChunkError((event as Event & { payload?: unknown }).payload)) event.preventDefault();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChunkLoadBoundary>{isPublicSite ? <Suspense fallback={<p role="status" style={{ padding: 40 }}>Carregando Facilita Estudos…</p>}><Landing /></Suspense> : <AuthProvider>
      <CourseProvider>
        <App />
      </CourseProvider>
    </AuthProvider>}</ChunkLoadBoundary>
  </React.StrictMode>
);

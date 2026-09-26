import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { setUnauthorizedListener } from './api/client';
import { useAuthStore } from './stores/auth-store';
import './index.css';

// A 401 the client could not recover from ends the session everywhere in the app.
setUnauthorizedListener(() => useAuthStore.getState().expireSession());
void useAuthStore.getState().checkSession();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Missing #root element');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

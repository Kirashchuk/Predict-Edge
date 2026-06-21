import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import '../styles/index.css';

// Swallow noisy injected-wallet provider errors (no extension installed).
window.addEventListener('unhandledrejection', (event) => {
  const message = (event.reason as { message?: string } | undefined)?.message ?? '';
  const name = (event.reason as { name?: string } | undefined)?.name ?? '';
  if (name === 'ProviderNotFoundError' || message.startsWith('Provider not found')) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(<App />);

import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

declare global {
  interface Window {
    gm_authFailure?: () => void;
    __gmpBillingRestricted?: boolean;
    __gmpLastDiagnosticMessage?: string;
  }
}

const GMP_BILLING_OR_QUOTA_REGEX =
  /BillingNotEnabledMapError|enable Billing on the Google Cloud Project|project\/_\/billing\/enable|gmp-get-started|LegacyApiNotActivatedMapError|ApiNotActivatedMapError|RefererNotAllowedMapError|InvalidKeyMapError|OverQuotaMapError|QuotaExceededError|DIRECTIONS_ROUTE|REQUEST_DENIED/i;

window.gm_authFailure = () => {
  window.__gmpBillingRestricted = true;
  window.dispatchEvent(new CustomEvent('gmp-billing-error', { detail: 'BillingNotEnabledMapError' }));
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};

const origConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const msg = args
    .map((a) => {
      if (typeof a === 'string') return a;
      if (a && typeof (a as any).message === 'string') return (a as any).message;
      try {
        return String(a);
      } catch {
        return '';
      }
    })
    .join(' ');

  if (GMP_BILLING_OR_QUOTA_REGEX.test(msg)) {
    window.__gmpBillingRestricted = true;
    window.__gmpLastDiagnosticMessage = msg;
    window.dispatchEvent(new CustomEvent('gmp-billing-error', { detail: msg }));
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    return;
  }

  origConsoleError.apply(console, args);
};

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration optional in restricted iframe contexts
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);


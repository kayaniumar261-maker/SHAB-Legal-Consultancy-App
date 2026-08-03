import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';

import App from './App';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element was not found.');
}

const Router =
  window.location.protocol === 'file:'
    ? HashRouter
    : BrowserRouter;

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator) {
  if (
    import.meta.env.PROD &&
    window.location.protocol !== 'file:'
  ) {
    window.addEventListener(
      'load',
      () => {
        void navigator.serviceWorker.register('/sw.js');
      },
    );
  } else if (import.meta.env.DEV) {
    window.addEventListener(
      'load',
      () => {
        void (async () => {
          const registrations =
            await navigator.serviceWorker.getRegistrations();

          await Promise.all(
            registrations.map((registration) =>
              registration.unregister()
            ),
          );

          const cacheKeys = await caches.keys();

          await Promise.all(
            cacheKeys
              .filter((key) =>
                key.startsWith('shab-legal-')
              )
              .map((key) => caches.delete(key)),
          );

          if (
            navigator.serviceWorker.controller &&
            sessionStorage.getItem(
              'shab-dev-sw-cleared',
            ) !== 'true'
          ) {
            sessionStorage.setItem(
              'shab-dev-sw-cleared',
              'true',
            );
            window.location.reload();
          }
        })();
      },
    );
  }
}

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

if (
  'serviceWorker' in navigator &&
  import.meta.env.PROD &&
  window.location.protocol !== 'file:'
) {
  window.addEventListener(
    'load',
    () => {
      void navigator.serviceWorker.register('/sw.js');
    },
  );
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Self-hosted Inter (same-origin) so the app works offline and PNG export can
// embed the font without cross-origin stylesheet errors.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './index.css';
import '@xyflow/react/dist/style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

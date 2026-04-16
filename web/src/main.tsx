import React from 'react';
import ReactDOM from 'react-dom/client';

import '@fontsource-variable/geist/wght.css';
import '@fontsource-variable/geist-mono/wght.css';
import '@fontsource/noto-sans-sc/400.css';
import '@fontsource/noto-sans-sc/500.css';

import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

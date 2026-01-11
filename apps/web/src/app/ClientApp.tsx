'use client';

import { BrowserRouter } from 'react-router-dom';
import App from '../App';

export function ClientApp() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}

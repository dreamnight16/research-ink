import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MobileApp } from './App';
import './styles/mobile.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

createRoot(container).render(
  <StrictMode>
    <MobileApp />
  </StrictMode>,
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

import App from './App.tsx';
import { WebSocketProvider } from './contexts/WebSocketContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider>
      <Notifications position="top-right" />
      <WebSocketProvider>
        <App />
      </WebSocketProvider>
    </MantineProvider>
  </StrictMode>,
);

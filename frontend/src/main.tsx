import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { Notifications } from '@mantine/notifications';
import 'dayjs/locale/ko';

import App from './App.tsx';
import { WebSocketProvider } from './contexts/WebSocketContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider>
      <DatesProvider settings={{ locale: 'ko' }}>
        <Notifications position="top-right" />
        <WebSocketProvider>
          <App />
        </WebSocketProvider>
      </DatesProvider>
    </MantineProvider>
  </StrictMode>,
);

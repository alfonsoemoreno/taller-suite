'use client';

import { CssBaseline, ThemeProvider } from '@mui/material';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@neondatabase/neon-js/ui/css';
import { NeonAuthUIProvider } from '@neondatabase/neon-js/auth/react';
import { AuthProvider } from '../auth/AuthContext';
import { authClient } from '../lib/neon-auth';
import theme from '../theme/theme';
import { useEffect, useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {mounted ? (
        <NeonAuthUIProvider emailOTP authClient={authClient}>
          <AuthProvider>{children}</AuthProvider>
        </NeonAuthUIProvider>
      ) : (
        <AuthProvider>{children}</AuthProvider>
      )}
    </ThemeProvider>
  );
}

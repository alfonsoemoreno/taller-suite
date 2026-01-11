import { useState } from 'react';
import { Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useAuth } from '../auth/AuthContext';
import { Panel } from '../components/ui/Panel';

export function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await login();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Panel>
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">Iniciar sesión</Typography>
          <Typography variant="body2" color="text.secondary">
            Accede con tu cuenta de Neon Auth.
          </Typography>
        </Stack>

        {error && (
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        )}
        <Button variant="contained" fullWidth disabled={isSubmitting} onClick={handleLogin}>
          {isSubmitting ? <CircularProgress size={22} /> : 'Continuar con Neon'}
        </Button>
      </Stack>
    </Panel>
  );
}

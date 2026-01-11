import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useAuth } from '../auth/AuthContext';
import { Panel } from '../components/ui/Panel';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Panel component="form" onSubmit={handleSubmit}>
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">Iniciar sesión</Typography>
          <Typography variant="body2" color="text.secondary">
            Accede con tu correo y contraseña.
          </Typography>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}

        <TextField
          label="Correo"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          fullWidth
          required
          autoComplete="email"
        />
        <TextField
          label="Contraseña"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          fullWidth
          required
          autoComplete="current-password"
        />
        <Button type="submit" variant="contained" fullWidth disabled={isSubmitting}>
          {isSubmitting ? <CircularProgress size={22} /> : 'Ingresar'}
        </Button>
      </Stack>
    </Panel>
  );
}

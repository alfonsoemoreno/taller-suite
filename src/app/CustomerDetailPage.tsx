'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  TextField,
} from '@mui/material';
import { CustomerUpdateSchema } from '@/shared';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { usePageTitle } from '../hooks/usePageTitle';
import { FormSection } from '../components/ui/FormSection';

type Customer = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

export function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : params.id?.[0];
  const { apiFetch } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    phone: '',
    notes: '',
  });

  usePageTitle(customer?.name ? `Cliente: ${customer.name}` : 'Detalle de cliente');

  const loadCustomer = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Customer>(`/customers/${id}`);
      setCustomer(data);
      setFormState({
        name: data.name ?? '',
        email: data.email ?? '',
        phone: data.phone ?? '',
        notes: data.notes ?? '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando cliente.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomer();
  }, [id]);

  const payload = useMemo(
    () => ({
      name: formState.name.trim(),
      email: formState.email.trim(),
      phone: formState.phone.trim(),
      notes: formState.notes.trim(),
    }),
    [formState],
  );

  const handleSave = async () => {
    if (!id) return;
    setFormError(null);
    setIsSaving(true);
    try {
      const parsed = CustomerUpdateSchema.safeParse(payload);
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? 'Datos invalidos.');
        return;
      }
      await apiFetch(`/customers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(parsed.data),
      });
      await loadCustomer();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error guardando.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Panel sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Panel>
    );
  }

  if (error || !customer) {
    return (
      <Alert severity="error">
        {error ?? 'Cliente no encontrado.'}
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 720 }}>
      <PageHeader
        title={customer.name}
        subtitle="Edita la información de contacto del cliente."
        actions={
          <Button onClick={() => router.push(`/app/customers/${customer.id}/vehicles`)}>
            Ver vehículos
          </Button>
        }
      />

      {formError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {formError}
        </Alert>
      )}

      <Panel>
        <FormSection>
          <TextField
            label="Nombre"
            value={formState.name}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, name: event.target.value }))
            }
            fullWidth
            required
          />
          <TextField
            label="Email"
            value={formState.email}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, email: event.target.value }))
            }
            fullWidth
          />
          <TextField
            label="Teléfono"
            value={formState.phone}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, phone: event.target.value }))
            }
            fullWidth
          />
          <TextField
            label="Notas"
            value={formState.notes}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, notes: event.target.value }))
            }
            fullWidth
            multiline
            minRows={3}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="contained" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <CircularProgress size={20} /> : 'Guardar cambios'}
            </Button>
            <Button onClick={() => router.push('/app/customers')}>Volver</Button>
          </Box>
        </FormSection>
      </Panel>
    </Box>
  );
}

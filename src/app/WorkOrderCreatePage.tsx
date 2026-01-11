'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  TextField,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { WorkOrderCreateSchema } from '@/shared';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { FormSection } from '../components/ui/FormSection';
import { FormRow } from '../components/ui/FormRow';
import { usePageTitle } from '../hooks/usePageTitle';

type Customer = {
  id: string;
  name: string;
};

type Vehicle = {
  id: string;
  plate: string;
  brand?: string | null;
  model?: string | null;
};

export function WorkOrderCreatePage() {
  const router = useRouter();
  const { apiFetch } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [formState, setFormState] = useState({
    customerId: '',
    vehicleId: '',
    title: '',
    description: '',
    odometer: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  usePageTitle('Nueva orden');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiFetch<Customer[]>('/customers');
        setCustomers(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error cargando clientes.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!formState.customerId) {
      setVehicles([]);
      setFormState((prev) => ({ ...prev, vehicleId: '' }));
      return;
    }
    const loadVehicles = async () => {
      try {
        const data = await apiFetch<Vehicle[]>(
          `/customers/${formState.customerId}/vehicles`,
        );
        setVehicles(data);
      } catch {
        setVehicles([]);
      }
    };
    loadVehicles();
  }, [formState.customerId]);

  const payload = useMemo(() => {
    return {
      customerId: formState.customerId,
      vehicleId: formState.vehicleId || undefined,
      title: formState.title.trim(),
      description: formState.description.trim(),
      odometer: formState.odometer ? Number(formState.odometer) : undefined,
    };
  }, [formState]);

  const handleSave = async () => {
    setError(null);
    setFormError(null);
    setIsSaving(true);
    try {
      const parsed = WorkOrderCreateSchema.safeParse(payload);
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? 'Datos inválidos.');
        return;
      }
      const data = await apiFetch<{ id: string }>('/work-orders', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      router.push(`/app/work-orders/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creando orden.');
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

  return (
    <Box>
      <PageHeader
        title="Nueva orden"
        subtitle="Crea una orden y luego agrega items y notas."
        actions={
          <Button onClick={() => router.push('/app/work-orders')}>Volver</Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Panel>
        <FormSection>
          {formError && (
            <Alert severity="error">{formError}</Alert>
          )}
          <FormRow>
            <TextField
              select
              label="Cliente"
              value={formState.customerId}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  customerId: event.target.value,
                }))
              }
              fullWidth
              required
            >
              <MenuItem value="">Selecciona un cliente</MenuItem>
              {customers.map((customer) => (
                <MenuItem key={customer.id} value={customer.id}>
                  {customer.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Vehículo"
              value={formState.vehicleId}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  vehicleId: event.target.value,
                }))
              }
              fullWidth
              disabled={!formState.customerId}
            >
              <MenuItem value="">Sin vehículo</MenuItem>
              {vehicles.map((vehicle) => (
                <MenuItem key={vehicle.id} value={vehicle.id}>
                  {vehicle.plate} {vehicle.brand ? `• ${vehicle.brand}` : ''}{' '}
                  {vehicle.model ?? ''}
                </MenuItem>
              ))}
            </TextField>
          </FormRow>
          <TextField
            label="Título"
            value={formState.title}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, title: event.target.value }))
            }
            fullWidth
          />
          <TextField
            label="Descripción / diagnóstico"
            value={formState.description}
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                description: event.target.value,
              }))
            }
            fullWidth
            multiline
            minRows={3}
          />
          <FormRow>
            <TextField
              label="Kilometraje"
              value={formState.odometer}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, odometer: event.target.value }))
              }
              fullWidth
              type="number"
            />
          </FormRow>
          <Button variant="contained" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <CircularProgress size={20} /> : 'Crear orden'}
          </Button>
        </FormSection>
      </Panel>
    </Box>
  );
}

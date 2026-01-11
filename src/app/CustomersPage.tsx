'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  Stack,
  TextField,
  TableCell,
  TableRow,
} from '@mui/material';
import { CustomerCreateSchema, CustomerUpdateSchema } from '@/shared';
import { useAuth } from '../auth/AuthContext';
import { useRouter } from 'next/navigation';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { DataTable } from '../components/ui/DataTable';
import { usePageTitle } from '../hooks/usePageTitle';
import { FormSection } from '../components/ui/FormSection';

type Customer = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  notes: '',
};

export function CustomersPage() {
  const { apiFetch } = useAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formState, setFormState] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  usePageTitle('Clientes');

  const loadCustomers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Customer[]>('/customers');
      setCustomers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando clientes.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const openCreateDialog = () => {
    setEditingCustomer(null);
    setFormState(emptyForm);
    setFormError(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormState({
      name: customer.name ?? '',
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      notes: customer.notes ?? '',
    });
    setFormError(null);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
  };

  const handleFormChange = (field: keyof typeof formState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

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
    setFormError(null);
    setIsSaving(true);
    try {
      if (editingCustomer) {
        const parsed = CustomerUpdateSchema.safeParse(payload);
        if (!parsed.success) {
          setFormError(parsed.error.issues[0]?.message ?? 'Datos invalidos.');
          return;
        }
        await apiFetch(`/customers/${editingCustomer.id}`, {
          method: 'PATCH',
          body: JSON.stringify(parsed.data),
        });
        setSnackbar('Cliente actualizado');
      } else {
        const parsed = CustomerCreateSchema.safeParse(payload);
        if (!parsed.success) {
          setFormError(parsed.error.issues[0]?.message ?? 'Datos invalidos.');
          return;
        }
        await apiFetch('/customers', {
          method: 'POST',
          body: JSON.stringify(parsed.data),
        });
        setSnackbar('Cliente creado');
      }
      closeDialog();
      await loadCustomers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error guardando.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!customerToDelete) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/customers/${customerToDelete.id}`, { method: 'DELETE' });
      setSnackbar('Cliente eliminado');
      await loadCustomers();
    } catch (err) {
      setSnackbar(err instanceof Error ? err.message : 'Error eliminando.');
    } finally {
      setIsDeleting(false);
      setCustomerToDelete(null);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Clientes"
        subtitle="Gestiona la cartera de clientes del taller."
        actions={
          <Button variant="contained" onClick={openCreateDialog}>
            Nuevo cliente
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {isLoading ? (
        <Panel sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Panel>
      ) : customers.length === 0 ? (
        <Panel>
          <EmptyState
            title="Sin clientes todavía"
            description="Crea tu primer cliente para empezar a registrar vehículos."
            actionLabel="Crear cliente"
            onAction={openCreateDialog}
          />
        </Panel>
      ) : (
        <DataTable headers={['Nombre', 'Email', 'Teléfono', 'Acciones']}>
          {customers.map((customer) => (
            <TableRow key={customer.id} hover>
              <TableCell>{customer.name}</TableCell>
              <TableCell>{customer.email ?? '-'}</TableCell>
              <TableCell>{customer.phone ?? '-'}</TableCell>
              <TableCell align="right">
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button size="small" onClick={() => openEditDialog(customer)}>
                    Editar
                  </Button>
                  <Button
                    size="small"
                    onClick={() => router.push(`/app/customers/${customer.id}`)}
                  >
                    Ver
                  </Button>
                  <Button
                    size="small"
                    onClick={() =>
                      router.push(`/app/customers/${customer.id}/vehicles`)
                    }
                  >
                    Vehículos
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => setCustomerToDelete(customer)}
                  >
                    Eliminar
                  </Button>
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      )}

      <Dialog open={isDialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingCustomer ? 'Editar cliente' : 'Nuevo cliente'}
        </DialogTitle>
        <DialogContent sx={{ mt: 1 }}>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}
          <FormSection>
            <TextField
              label="Nombre"
              value={formState.name}
              onChange={(event) => handleFormChange('name', event.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Email"
              value={formState.email}
              onChange={(event) => handleFormChange('email', event.target.value)}
              fullWidth
            />
            <TextField
              label="Teléfono"
              value={formState.phone}
              onChange={(event) => handleFormChange('phone', event.target.value)}
              fullWidth
            />
            <TextField
              label="Notas"
              value={formState.notes}
              onChange={(event) => handleFormChange('notes', event.target.value)}
              fullWidth
              multiline
              minRows={3}
            />
          </FormSection>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <CircularProgress size={20} /> : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(customerToDelete)}
        title="Eliminar cliente"
        description={
          customerToDelete
            ? `¿Deseas eliminar a ${customerToDelete.name}? Esta acción no se puede deshacer.`
            : undefined
        }
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onClose={() => setCustomerToDelete(null)}
        isLoading={isDeleting}
      />

      <Snackbar
        open={Boolean(snackbar)}
        onClose={() => setSnackbar(null)}
        autoHideDuration={3000}
        message={snackbar ?? ''}
      />
    </Box>
  );
}

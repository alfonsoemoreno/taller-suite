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
  MenuItem,
  Stack,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  CatalogItemCreateSchema,
  CatalogItemUpdateSchema,
  type CatalogItemType,
} from '@taller/shared';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { FormSection } from '../components/ui/FormSection';
import { FormRow } from '../components/ui/FormRow';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { usePageTitle } from '../hooks/usePageTitle';

type CatalogItem = {
  id: string;
  type: CatalogItemType;
  sku?: string | null;
  name: string;
  brand?: string | null;
  unit: string;
  salePriceCents: number;
  costCents: number;
  isActive: boolean;
};

const TYPE_OPTIONS: { value: CatalogItemType; label: string }[] = [
  { value: 'PART', label: 'Repuesto' },
  { value: 'SERVICE', label: 'Servicio' },
];

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(cents / 100);

export function CatalogPage() {
  const { apiFetch } = useAuth();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState({ type: '', active: 'all' });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formState, setFormState] = useState({
    type: 'PART' as CatalogItemType,
    sku: '',
    name: '',
    brand: '',
    unit: 'unidad',
    salePriceCents: '',
    costCents: '',
    isActive: true,
  });
  const [confirmTarget, setConfirmTarget] = useState<CatalogItem | null>(null);

  usePageTitle('Catálogo');

  const loadItems = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<CatalogItem[]>('/catalog');
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando catálogo.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filters.type && item.type !== filters.type) return false;
      if (filters.active === 'active' && !item.isActive) return false;
      if (filters.active === 'inactive' && item.isActive) return false;
      return true;
    });
  }, [filters, items]);

  const openCreateDialog = () => {
    setEditingItem(null);
    setFormState({
      type: 'PART',
      sku: '',
      name: '',
      brand: '',
      unit: 'unidad',
      salePriceCents: '',
      costCents: '',
      isActive: true,
    });
    setFormError(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: CatalogItem) => {
    setEditingItem(item);
    setFormState({
      type: item.type,
      sku: item.sku ?? '',
      name: item.name,
      brand: item.brand ?? '',
      unit: item.unit,
      salePriceCents: String(item.salePriceCents),
      costCents: String(item.costCents),
      isActive: item.isActive,
    });
    setFormError(null);
    setIsDialogOpen(true);
  };

  const closeDialog = () => setIsDialogOpen(false);

  const payload = useMemo(
    () => ({
      type: formState.type,
      sku: formState.sku.trim(),
      name: formState.name.trim(),
      brand: formState.brand.trim(),
      unit: formState.unit.trim(),
      salePriceCents: Number(formState.salePriceCents),
      costCents: Number(formState.costCents),
      isActive: formState.isActive,
    }),
    [formState],
  );

  const handleSave = async () => {
    setFormError(null);
    setIsSaving(true);
    try {
      const schema = editingItem ? CatalogItemUpdateSchema : CatalogItemCreateSchema;
      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? 'Datos inválidos.');
        return;
      }
      if (editingItem) {
        await apiFetch(`/catalog/${editingItem.id}`, {
          method: 'PATCH',
          body: JSON.stringify(parsed.data),
        });
      } else {
        await apiFetch('/catalog', {
          method: 'POST',
          body: JSON.stringify(parsed.data),
        });
      }
      closeDialog();
      await loadItems();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error guardando item.');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDisable = async () => {
    if (!confirmTarget) return;
    try {
      await apiFetch(`/catalog/${confirmTarget.id}`, { method: 'DELETE' });
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desactivando item.');
    } finally {
      setConfirmTarget(null);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Catálogo"
        subtitle="Repuestos y servicios disponibles."
        actions={
          <Button variant="contained" onClick={openCreateDialog}>
            Nuevo ítem
          </Button>
        }
      />

      <Panel sx={{ mb: 2 }}>
        <FormRow>
          <TextField
            select
            label="Tipo"
            value={filters.type}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, type: event.target.value }))
            }
            fullWidth
          >
            <MenuItem value="">Todos</MenuItem>
            {TYPE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Estado"
            value={filters.active}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, active: event.target.value }))
            }
            fullWidth
          >
            <MenuItem value="all">Todos</MenuItem>
            <MenuItem value="active">Activos</MenuItem>
            <MenuItem value="inactive">Inactivos</MenuItem>
          </TextField>
        </FormRow>
      </Panel>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {isLoading ? (
        <Panel sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Panel>
      ) : filteredItems.length === 0 ? (
        <Panel>
          <EmptyState
            title="Sin items"
            description="Crea repuestos o servicios para usarlos en órdenes."
            actionLabel="Nuevo ítem"
            onAction={openCreateDialog}
          />
        </Panel>
      ) : (
        <DataTable headers={['Tipo', 'Nombre', 'Unidad', 'Precio', 'Costo', 'Estado', 'Acciones']}>
          {filteredItems.map((item) => (
            <TableRow key={item.id} hover>
              <TableCell>{TYPE_OPTIONS.find((t) => t.value === item.type)?.label}</TableCell>
              <TableCell>
                <Typography variant="body2">{item.name}</Typography>
                {item.sku && (
                  <Typography variant="caption" color="text.secondary">
                    SKU: {item.sku}
                  </Typography>
                )}
              </TableCell>
              <TableCell>{item.unit}</TableCell>
              <TableCell>{formatCurrency(item.salePriceCents)}</TableCell>
              <TableCell>{formatCurrency(item.costCents)}</TableCell>
              <TableCell>{item.isActive ? 'Activo' : 'Inactivo'}</TableCell>
              <TableCell align="right">
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button size="small" onClick={() => openEditDialog(item)}>
                    Editar
                  </Button>
                  <Button size="small" color="error" onClick={() => setConfirmTarget(item)}>
                    Desactivar
                  </Button>
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      )}

      <Dialog open={isDialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingItem ? 'Editar ítem' : 'Nuevo ítem'}</DialogTitle>
        <DialogContent sx={{ mt: 1 }}>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}
          <FormSection>
            <FormRow>
              <TextField
                select
                label="Tipo"
                value={formState.type}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    type: event.target.value as CatalogItemType,
                  }))
                }
                fullWidth
              >
                {TYPE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="SKU"
                value={formState.sku}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, sku: event.target.value }))
                }
                fullWidth
              />
            </FormRow>
            <TextField
              label="Nombre"
              value={formState.name}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, name: event.target.value }))
              }
              fullWidth
            />
            <FormRow>
              <TextField
                label="Marca"
                value={formState.brand}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, brand: event.target.value }))
                }
                fullWidth
              />
              <TextField
                label="Unidad"
                value={formState.unit}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, unit: event.target.value }))
                }
                fullWidth
              />
            </FormRow>
            <FormRow>
              <TextField
                label="Precio de venta (CLP)"
                type="number"
                value={formState.salePriceCents}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    salePriceCents: event.target.value,
                  }))
                }
                fullWidth
              />
              <TextField
                label="Costo (CLP)"
                type="number"
                value={formState.costCents}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, costCents: event.target.value }))
                }
                fullWidth
              />
            </FormRow>
            <FormRow>
              <TextField
                select
                label="Estado"
                value={formState.isActive ? 'active' : 'inactive'}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    isActive: event.target.value === 'active',
                  }))
                }
                fullWidth
              >
                <MenuItem value="active">Activo</MenuItem>
                <MenuItem value="inactive">Inactivo</MenuItem>
              </TextField>
            </FormRow>
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
        open={Boolean(confirmTarget)}
        title="Desactivar ítem"
        description={
          confirmTarget ? `¿Deseas desactivar ${confirmTarget.name}?` : undefined
        }
        confirmLabel="Desactivar"
        onConfirm={confirmDisable}
        onClose={() => setConfirmTarget(null)}
      />
    </Box>
  );
}

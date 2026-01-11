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
  TableCell,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { InventoryAdjustSchema } from '@taller/shared';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { FormSection } from '../components/ui/FormSection';
import { FormRow } from '../components/ui/FormRow';
import { usePageTitle } from '../hooks/usePageTitle';

type InventoryRow = {
  id: string;
  name: string;
  sku?: string | null;
  unit: string;
  qtyOnHand: number;
  salePriceCents: number;
  costCents: number;
};

type InventoryMovement = {
  id: string;
  type: string;
  qty: number;
  unitCostCents?: number | null;
  referenceType: string;
  referenceId?: string | null;
  createdAt: string;
};

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(cents / 100);

export function InventoryPage() {
  const { apiFetch } = useAuth();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<InventoryRow | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    qty: '',
    unitCostCents: '',
    reason: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  usePageTitle('Inventario');

  const loadInventory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<InventoryRow[]>('/inventory');
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando inventario.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMovements = async (catalogItemId: string) => {
    try {
      const data = await apiFetch<InventoryMovement[]>(
        `/inventory/${catalogItemId}/movements`,
      );
      setMovements(data);
    } catch {
      setMovements([]);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const lowStockIds = useMemo(() => {
    return new Set(rows.filter((row) => row.qtyOnHand < 5).map((row) => row.id));
  }, [rows]);

  const openAdjustDialog = (row: InventoryRow) => {
    setSelected(row);
    setFormState({ qty: '', unitCostCents: '', reason: '' });
    setFormError(null);
    setIsDialogOpen(true);
    loadMovements(row.id);
  };

  const closeDialog = () => setIsDialogOpen(false);

  const handleAdjust = async () => {
    if (!selected) return;
    setFormError(null);
    setIsSaving(true);
    try {
      const payload = {
        catalogItemId: selected.id,
        qty: Number(formState.qty),
        unitCostCents: formState.unitCostCents
          ? Number(formState.unitCostCents)
          : undefined,
        reason: formState.reason.trim(),
      };
      const parsed = InventoryAdjustSchema.safeParse(payload);
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? 'Datos inválidos.');
        return;
      }
      await apiFetch('/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      closeDialog();
      await loadInventory();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error ajustando stock.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Inventario"
        subtitle="Control de stock y movimientos."
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
      ) : rows.length === 0 ? (
        <Panel>
          <EmptyState title="Sin inventario" description="Crea ítems en catálogo para iniciar." />
        </Panel>
      ) : (
        <DataTable headers={['Ítem', 'Stock', 'Precio', 'Costo', 'Acciones']}>
          {rows.map((row) => (
            <TableRow key={row.id} hover>
              <TableCell>
                <Typography variant="body2">{row.name}</Typography>
                {row.sku && (
                  <Typography variant="caption" color="text.secondary">
                    SKU: {row.sku}
                  </Typography>
                )}
                {lowStockIds.has(row.id) && (
                  <Typography variant="caption" color="error" sx={{ display: 'block' }}>
                    Stock bajo
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                {row.qtyOnHand} {row.unit}
              </TableCell>
              <TableCell>{formatCurrency(row.salePriceCents)}</TableCell>
              <TableCell>{formatCurrency(row.costCents)}</TableCell>
              <TableCell align="right">
                <Button size="small" onClick={() => openAdjustDialog(row)}>
                  Ajustar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      )}

      <Dialog open={isDialogOpen} onClose={closeDialog} maxWidth="md" fullWidth>
        <DialogTitle>Movimientos de stock</DialogTitle>
        <DialogContent sx={{ mt: 1 }}>
          {selected && (
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              {selected.name}
            </Typography>
          )}
          <Panel sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Ajuste manual
            </Typography>
            {formError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {formError}
              </Alert>
            )}
            <FormSection>
              <FormRow>
                <TextField
                  label="Cantidad (+/-)"
                  type="number"
                  value={formState.qty}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, qty: event.target.value }))
                  }
                  fullWidth
                />
                <TextField
                  label="Costo unitario (opcional)"
                  type="number"
                  value={formState.unitCostCents}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      unitCostCents: event.target.value,
                    }))
                  }
                  fullWidth
                />
              </FormRow>
              <TextField
                label="Motivo"
                value={formState.reason}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, reason: event.target.value }))
                }
                fullWidth
              />
              <Button variant="contained" onClick={handleAdjust} disabled={isSaving}>
                {isSaving ? <CircularProgress size={20} /> : 'Guardar ajuste'}
              </Button>
            </FormSection>
          </Panel>

          {movements.length === 0 ? (
            <EmptyState title="Sin movimientos" description="Aún no hay movimientos registrados." />
          ) : (
            <DataTable headers={['Fecha', 'Tipo', 'Cantidad', 'Costo', 'Referencia']}>
              {movements.map((move) => (
                <TableRow key={move.id} hover>
                  <TableCell>
                    {new Date(move.createdAt).toLocaleString('es-CL')}
                  </TableCell>
                  <TableCell>{move.type}</TableCell>
                  <TableCell>{move.qty}</TableCell>
                  <TableCell>
                    {move.unitCostCents ? formatCurrency(move.unitCostCents) : '-'}
                  </TableCell>
                  <TableCell>
                    {move.referenceType} {move.referenceId ?? ''}
                  </TableCell>
                </TableRow>
              ))}
            </DataTable>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

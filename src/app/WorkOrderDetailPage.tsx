'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  WorkOrderItemCreateSchema,
  WorkOrderItemUpdateSchema,
  WorkOrderNoteCreateSchema,
  WorkOrderStatusSchema,
  type WorkOrderItemType,
  type WorkOrderStatus,
  PaymentCreateSchema,
  type PaymentMethod,
} from '@taller/shared';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { FormRow } from '../components/ui/FormRow';
import { FormSection } from '../components/ui/FormSection';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
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

type WorkOrderItem = {
  id: string;
  type: WorkOrderItemType;
  catalogItemId?: string | null;
  name: string;
  qty: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

type WorkOrder = {
  id: string;
  status: WorkOrderStatus;
  paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID';
  title?: string | null;
  description?: string | null;
  odometer?: number | null;
  totalCents: number;
  paidTotalCents?: number;
  balanceCents?: number;
  costTotalCents?: number;
  marginCents?: number;
  createdAt: string;
  customer: Customer;
  vehicle?: Vehicle | null;
  items: WorkOrderItem[];
};

type WorkOrderNote = {
  id: string;
  note: string;
  createdAt: string;
};

const STATUS_OPTIONS: { value: WorkOrderStatus; label: string }[] = [
  { value: 'OPEN', label: 'Abierta' },
  { value: 'IN_PROGRESS', label: 'En progreso' },
  { value: 'DONE', label: 'Finalizada' },
  { value: 'CANCELED', label: 'Cancelada' },
];

const ITEM_TYPE_OPTIONS: { value: WorkOrderItemType; label: string }[] = [
  { value: 'LABOR', label: 'Mano de obra' },
  { value: 'PART', label: 'Repuesto' },
];

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
];

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: 'Pendiente',
  PARTIAL: 'Parcial',
  PAID: 'Pagada',
};

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(cents / 100);

export function WorkOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : params.id?.[0];
  const { apiFetch } = useAuth();
  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [notes, setNotes] = useState<WorkOrderNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<WorkOrderStatus>('OPEN');
  const [noteText, setNoteText] = useState('');
  const [isNoteSaving, setIsNoteSaving] = useState(false);

  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amountCents: '',
    method: 'CASH' as PaymentMethod,
    reference: '',
  });
  const [isPaymentSaving, setIsPaymentSaving] = useState(false);

  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkOrderItem | null>(null);
  const [itemForm, setItemForm] = useState({
    type: 'LABOR' as WorkOrderItemType,
    catalogItemId: '',
    name: '',
    qty: '1',
    unitPriceCents: '',
  });
  const [itemError, setItemError] = useState<string | null>(null);
  const [isItemSaving, setIsItemSaving] = useState(false);
  const [catalogItems, setCatalogItems] = useState<
    Array<{ id: string; name: string; salePriceCents: number }>
  >([]);

  usePageTitle(order ? `OT: ${order.customer.name}` : 'Orden de trabajo');

  const loadOrder = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<WorkOrder>(`/work-orders/${id}`);
      setOrder(data);
      setStatus(data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando la orden.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadNotes = async () => {
    if (!id) return;
    try {
      const data = await apiFetch<WorkOrderNote[]>(`/work-orders/${id}/notes`);
      setNotes(data);
    } catch {
      setNotes([]);
    }
  };

  const loadCatalog = async () => {
    try {
      const data = await apiFetch<
        Array<{ id: string; name: string; salePriceCents: number; type: string; isActive: boolean }>
      >('/catalog');
      setCatalogItems(data.filter((item) => item.type === 'PART' && item.isActive));
    } catch {
      setCatalogItems([]);
    }
  };

  useEffect(() => {
    loadOrder();
    loadNotes();
    loadCatalog();
  }, [id]);

  const handleStatusChange = async (value: WorkOrderStatus) => {
    if (!id) return;
    setStatus(value);
    try {
      await apiFetch(`/work-orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: value }),
      });
      await loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error actualizando estado.');
    }
  };

  const openCreateItem = (type: WorkOrderItemType) => {
    setEditingItem(null);
    setItemForm({
      type,
      catalogItemId: '',
      name: '',
      qty: '1',
      unitPriceCents: '',
    });
    setItemError(null);
    setIsItemDialogOpen(true);
  };

  const openEditItem = (item: WorkOrderItem) => {
    setEditingItem(item);
    setItemForm({
      type: item.type,
      catalogItemId: item.catalogItemId ?? '',
      name: item.name,
      qty: String(item.qty),
      unitPriceCents: String(item.unitPriceCents),
    });
    setItemError(null);
    setIsItemDialogOpen(true);
  };

  const closeItemDialog = () => setIsItemDialogOpen(false);

  const itemPayload = useMemo(() => {
    return {
      type: itemForm.type,
      catalogItemId: itemForm.catalogItemId || undefined,
      name: itemForm.name.trim(),
      qty: Number(itemForm.qty),
      unitPriceCents: Number(itemForm.unitPriceCents),
    };
  }, [itemForm]);

  const handleSaveItem = async () => {
    if (!id) return;
    setItemError(null);
    setIsItemSaving(true);
    try {
      const schema = editingItem ? WorkOrderItemUpdateSchema : WorkOrderItemCreateSchema;
      const parsed = schema.safeParse(itemPayload);
      if (!parsed.success) {
        setItemError(parsed.error.issues[0]?.message ?? 'Datos inválidos.');
        return;
      }
      if (editingItem) {
        await apiFetch(`/work-orders/${id}/items/${editingItem.id}`, {
          method: 'PATCH',
          body: JSON.stringify(parsed.data),
        });
      } else {
        await apiFetch(`/work-orders/${id}/items`, {
          method: 'POST',
          body: JSON.stringify(parsed.data),
        });
      }
      closeItemDialog();
      await loadOrder();
    } catch (err) {
      setItemError(err instanceof Error ? err.message : 'Error guardando item.');
    } finally {
      setIsItemSaving(false);
    }
  };

  const handleDeleteItem = async (item: WorkOrderItem) => {
    if (!id) return;
    try {
      await apiFetch(`/work-orders/${id}/items/${item.id}`, { method: 'DELETE' });
      await loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error eliminando item.');
    }
  };

  const handleAddNote = async () => {
    if (!id) return;
    setIsNoteSaving(true);
    try {
      const parsed = WorkOrderNoteCreateSchema.safeParse({ note: noteText.trim() });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? 'Nota inválida.');
        return;
      }
      await apiFetch(`/work-orders/${id}/notes`, {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      setNoteText('');
      await loadNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando nota.');
    } finally {
      setIsNoteSaving(false);
    }
  };

  const openPaymentDialog = () => {
    setPaymentForm({
      amountCents: order?.balanceCents?.toString() ?? '',
      method: 'CASH',
      reference: '',
    });
    setPaymentError(null);
    setIsPaymentDialogOpen(true);
  };

  const closePaymentDialog = () => setIsPaymentDialogOpen(false);

  const handleSavePayment = async () => {
    if (!id) return;
    setPaymentError(null);
    setIsPaymentSaving(true);
    try {
      const parsed = PaymentCreateSchema.safeParse({
        amountCents: Number(paymentForm.amountCents),
        method: paymentForm.method,
        reference: paymentForm.reference.trim(),
      });
      if (!parsed.success) {
        setPaymentError(parsed.error.issues[0]?.message ?? 'Datos inválidos.');
        return;
      }
      await apiFetch(`/work-orders/${id}/payments`, {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      closePaymentDialog();
      await loadOrder();
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Error registrando pago.');
    } finally {
      setIsPaymentSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Panel sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Panel>
    );
  }

  if (error || !order) {
    return <Alert severity="error">{error ?? 'Orden no encontrada.'}</Alert>;
  }

  return (
    <Box>
      <PageHeader
        title={`Orden #${order.id.slice(0, 6)}`}
        subtitle={`${order.customer.name}${order.vehicle ? ` • ${order.vehicle.plate}` : ''}`}
        actions={
          <Stack direction="row" spacing={1}>
            <Button onClick={() => router.push('/app/work-orders')}>Volver</Button>
            <Button
              variant="outlined"
              onClick={() => router.push(`/app/work-orders/${order.id}/print`)}
            >
              Imprimir
            </Button>
          </Stack>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Panel sx={{ mb: 3 }}>
        <FormSection>
          <FormRow>
            <TextField
              select
              label="Estado"
              value={status}
              onChange={(event) => {
                const parsed = WorkOrderStatusSchema.safeParse(event.target.value);
                if (parsed.success) {
                  handleStatusChange(parsed.data);
                }
              }}
              sx={{ minWidth: 220 }}
            >
              {STATUS_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Kilometraje"
              value={order.odometer ?? ''}
              InputProps={{ readOnly: true }}
              sx={{ minWidth: 220 }}
            />
            <TextField
              label="Total"
              value={formatCurrency(order.totalCents)}
              InputProps={{ readOnly: true }}
              sx={{ minWidth: 220 }}
            />
          </FormRow>
          <FormRow>
            <TextField
              label="Pagado"
              value={formatCurrency(order.paidTotalCents ?? 0)}
              InputProps={{ readOnly: true }}
              sx={{ minWidth: 220 }}
            />
            <TextField
              label="Saldo"
              value={formatCurrency(order.balanceCents ?? order.totalCents)}
              InputProps={{ readOnly: true }}
              sx={{ minWidth: 220 }}
            />
            <TextField
              label="Estado de pago"
              value={PAYMENT_STATUS_LABELS[order.paymentStatus ?? 'UNPAID']}
              InputProps={{ readOnly: true }}
              sx={{ minWidth: 220 }}
            />
          </FormRow>
          <FormRow>
            <TextField
              label="Costo estimado"
              value={formatCurrency(order.costTotalCents ?? 0)}
              InputProps={{ readOnly: true }}
              sx={{ minWidth: 220 }}
            />
            <TextField
              label="Margen estimado"
              value={formatCurrency(order.marginCents ?? 0)}
              InputProps={{ readOnly: true }}
              sx={{ minWidth: 220 }}
            />
          </FormRow>
          <Typography variant="subtitle2">Descripción / diagnóstico</Typography>
          <Typography variant="body2" color="text.secondary">
            {order.description || 'Sin descripción'}
          </Typography>
        </FormSection>
      </Panel>

      <Panel sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Pagos
          </Typography>
          <Button size="small" variant="outlined" onClick={openPaymentDialog}>
            Registrar pago
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Total {formatCurrency(order.totalCents)} • Pagado{' '}
          {formatCurrency(order.paidTotalCents ?? 0)} • Saldo{' '}
          {formatCurrency(order.balanceCents ?? order.totalCents)}
        </Typography>
      </Panel>

      <Panel sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Items
          </Typography>
          <Button size="small" onClick={() => openCreateItem('LABOR')}>
            Agregar mano de obra
          </Button>
          <Button size="small" onClick={() => openCreateItem('PART')}>
            Agregar repuesto
          </Button>
        </Stack>

        {order.items.length === 0 ? (
          <EmptyState
            title="Sin items"
            description="Agrega mano de obra o repuestos para calcular el total."
          />
        ) : (
          <DataTable headers={['Tipo', 'Detalle', 'Cantidad', 'Precio', 'Total', 'Acciones']}>
            {order.items.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell>
                  {ITEM_TYPE_OPTIONS.find((t) => t.value === item.type)?.label ?? item.type}
                </TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.qty}</TableCell>
                <TableCell>{formatCurrency(item.unitPriceCents)}</TableCell>
                <TableCell>{formatCurrency(item.lineTotalCents)}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button size="small" onClick={() => openEditItem(item)}>
                      Editar
                    </Button>
                    <Button size="small" color="error" onClick={() => handleDeleteItem(item)}>
                      Eliminar
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
        )}
      </Panel>

      <Panel>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Notas internas
        </Typography>
        <FormSection>
          <TextField
            label="Nueva nota"
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
          <Button variant="contained" onClick={handleAddNote} disabled={isNoteSaving}>
            {isNoteSaving ? <CircularProgress size={20} /> : 'Agregar nota'}
          </Button>
        </FormSection>
        <Box sx={{ mt: 2 }}>
          {notes.length === 0 ? (
            <EmptyState title="Sin notas" description="Aún no hay notas internas." />
          ) : (
            <Stack spacing={1.5}>
              {notes.map((note) => (
                <Panel key={note.id} sx={{ p: 2 }}>
                  <Typography variant="body2">{note.note}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(note.createdAt).toLocaleString('es-CL')}
                  </Typography>
                </Panel>
              ))}
            </Stack>
          )}
        </Box>
      </Panel>

      <Dialog open={isItemDialogOpen} onClose={closeItemDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingItem ? 'Editar item' : 'Nuevo item'}</DialogTitle>
        <DialogContent sx={{ mt: 1 }}>
          {itemError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {itemError}
            </Alert>
          )}
          <FormSection>
            <FormRow>
              <TextField
                select
                label="Tipo"
                value={itemForm.type}
                onChange={(event) =>
                  setItemForm((prev) => ({
                    ...prev,
                    type: event.target.value as WorkOrderItemType,
                    catalogItemId:
                      event.target.value === 'PART' ? prev.catalogItemId : '',
                  }))
                }
                fullWidth
              >
                {ITEM_TYPE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              {itemForm.type === 'PART' && (
                <TextField
                  select
                  label="Repuesto"
                  value={itemForm.catalogItemId}
                  onChange={(event) => {
                    const value = event.target.value;
                    const match = catalogItems.find((item) => item.id === value);
                    setItemForm((prev) => ({
                      ...prev,
                      catalogItemId: value,
                      name: match?.name ?? prev.name,
                      unitPriceCents: match
                        ? String(match.salePriceCents)
                        : prev.unitPriceCents,
                    }));
                  }}
                  fullWidth
                >
                  <MenuItem value="">Selecciona un repuesto</MenuItem>
                  {catalogItems.map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {item.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              <TextField
                label="Detalle"
                value={itemForm.name}
                onChange={(event) =>
                  setItemForm((prev) => ({ ...prev, name: event.target.value }))
                }
                fullWidth
              />
            </FormRow>
            <FormRow>
              <TextField
                label="Cantidad"
                type="number"
                value={itemForm.qty}
                onChange={(event) =>
                  setItemForm((prev) => ({ ...prev, qty: event.target.value }))
                }
                fullWidth
              />
              <TextField
                label="Precio unitario (CLP)"
                type="number"
                value={itemForm.unitPriceCents}
                onChange={(event) =>
                  setItemForm((prev) => ({
                    ...prev,
                    unitPriceCents: event.target.value,
                  }))
                }
                fullWidth
              />
            </FormRow>
          </FormSection>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeItemDialog}>Cancelar</Button>
          <Button variant="contained" onClick={handleSaveItem} disabled={isItemSaving}>
            {isItemSaving ? <CircularProgress size={20} /> : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isPaymentDialogOpen} onClose={closePaymentDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Registrar pago</DialogTitle>
        <DialogContent sx={{ mt: 1 }}>
          {paymentError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {paymentError}
            </Alert>
          )}
          <FormSection>
            <FormRow>
              <TextField
                label="Monto (CLP)"
                type="number"
                value={paymentForm.amountCents}
                onChange={(event) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    amountCents: event.target.value,
                  }))
                }
                fullWidth
              />
              <TextField
                select
                label="Método"
                value={paymentForm.method}
                onChange={(event) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    method: event.target.value as PaymentMethod,
                  }))
                }
                fullWidth
              >
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </FormRow>
            <TextField
              label="Referencia"
              value={paymentForm.reference}
              onChange={(event) =>
                setPaymentForm((prev) => ({
                  ...prev,
                  reference: event.target.value,
                }))
              }
              fullWidth
            />
          </FormSection>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closePaymentDialog}>Cancelar</Button>
          <Button variant="contained" onClick={handleSavePayment} disabled={isPaymentSaving}>
            {isPaymentSaving ? <CircularProgress size={20} /> : 'Guardar pago'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

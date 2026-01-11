import { useEffect, useState } from 'react';
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
  PurchaseCreateSchema,
  PurchaseItemCreateSchema,
  PurchaseUpdateSchema,
} from '@taller/shared';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { FormRow } from '../components/ui/FormRow';
import { FormSection } from '../components/ui/FormSection';
import { usePageTitle } from '../hooks/usePageTitle';

type Supplier = {
  id: string;
  name: string;
};

type CatalogItem = {
  id: string;
  name: string;
  type: 'PART' | 'SERVICE';
};

type PurchaseItem = {
  id: string;
  qty: number;
  unitCostCents: number;
  lineTotalCents: number;
  catalogItem: CatalogItem;
};

type Purchase = {
  id: string;
  status: 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELED';
  totalCents: number;
  createdAt: string;
  supplier: Supplier;
  items?: PurchaseItem[];
};

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'ORDERED', label: 'Ordenada' },
  { value: 'RECEIVED', label: 'Recibida' },
  { value: 'CANCELED', label: 'Cancelada' },
];

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(cents / 100);

export function PurchasesPage() {
  const { apiFetch } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSupplierId, setCreateSupplierId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [isItemOpen, setIsItemOpen] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState({
    catalogItemId: '',
    qty: '1',
    unitCostCents: '',
  });
  const [isItemSaving, setIsItemSaving] = useState(false);

  usePageTitle('Compras');

  const loadPurchases = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Purchase[]>('/purchases');
      setPurchases(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando compras.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSuppliers = async () => {
    try {
      const data = await apiFetch<Supplier[]>('/suppliers');
      setSuppliers(data);
    } catch {
      setSuppliers([]);
    }
  };

  const loadCatalog = async () => {
    try {
      const data = await apiFetch<CatalogItem[]>('/catalog');
      setCatalog(data.filter((item) => item.type === 'PART' && item.id));
    } catch {
      setCatalog([]);
    }
  };

  const loadPurchase = async (id: string) => {
    const data = await apiFetch<Purchase>(`/purchases/${id}`);
    setSelectedPurchase(data);
    setItems(data.items ?? []);
  };

  useEffect(() => {
    loadPurchases();
    loadSuppliers();
    loadCatalog();
  }, []);

  const openCreateDialog = () => {
    setCreateSupplierId('');
    setCreateError(null);
    setIsCreateOpen(true);
  };

  const closeCreateDialog = () => setIsCreateOpen(false);

  const handleCreate = async () => {
    setCreateError(null);
    setIsCreating(true);
    try {
      const parsed = PurchaseCreateSchema.safeParse({ supplierId: createSupplierId });
      if (!parsed.success) {
        setCreateError(parsed.error.issues[0]?.message ?? 'Datos inválidos.');
        return;
      }
      const data = await apiFetch<Purchase>('/purchases', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      closeCreateDialog();
      await loadPurchases();
      await loadPurchase(data.id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error creando compra.');
    } finally {
      setIsCreating(false);
    }
  };

  const openItemDialog = () => {
    setItemError(null);
    setItemForm({ catalogItemId: '', qty: '1', unitCostCents: '' });
    setIsItemOpen(true);
  };

  const closeItemDialog = () => setIsItemOpen(false);

  const handleAddItem = async () => {
    if (!selectedPurchase) return;
    setItemError(null);
    setIsItemSaving(true);
    try {
      const parsed = PurchaseItemCreateSchema.safeParse({
        catalogItemId: itemForm.catalogItemId,
        qty: Number(itemForm.qty),
        unitCostCents: Number(itemForm.unitCostCents),
      });
      if (!parsed.success) {
        setItemError(parsed.error.issues[0]?.message ?? 'Datos inválidos.');
        return;
      }
      await apiFetch(`/purchases/${selectedPurchase.id}/items`, {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      closeItemDialog();
      await loadPurchase(selectedPurchase.id);
      await loadPurchases();
    } catch (err) {
      setItemError(err instanceof Error ? err.message : 'Error agregando item.');
    } finally {
      setIsItemSaving(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!selectedPurchase) return;
    await apiFetch(`/purchases/${selectedPurchase.id}/items/${itemId}`, {
      method: 'DELETE',
    });
    await loadPurchase(selectedPurchase.id);
    await loadPurchases();
  };

  const handleReceive = async () => {
    if (!selectedPurchase) return;
    await apiFetch(`/purchases/${selectedPurchase.id}/receive`, { method: 'POST' });
    await loadPurchase(selectedPurchase.id);
    await loadPurchases();
  };

  const handleStatusChange = async (status: string) => {
    if (!selectedPurchase) return;
    const parsed = PurchaseUpdateSchema.safeParse({ status });
    if (!parsed.success) return;
    await apiFetch(`/purchases/${selectedPurchase.id}`, {
      method: 'PATCH',
      body: JSON.stringify(parsed.data),
    });
    await loadPurchase(selectedPurchase.id);
    await loadPurchases();
  };


  return (
    <Box>
      <PageHeader
        title="Compras"
        subtitle="Gestión de compras a proveedores."
        actions={
          <Button variant="contained" onClick={openCreateDialog}>
            Nueva compra
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
      ) : filteredPurchases.length === 0 ? (
        <Panel>
          <EmptyState
            title="Sin compras"
            description="Registra la primera compra para actualizar stock."
            actionLabel="Nueva compra"
            onAction={openCreateDialog}
          />
        </Panel>
      ) : (
        <DataTable headers={['Fecha', 'Proveedor', 'Estado', 'Total', 'Acciones']}>
          {filteredPurchases.map((purchase) => (
            <TableRow key={purchase.id} hover>
              <TableCell>{new Date(purchase.createdAt).toLocaleDateString('es-CL')}</TableCell>
              <TableCell>{purchase.supplier?.name ?? '-'}</TableCell>
              <TableCell>
                {STATUS_OPTIONS.find((status) => status.value === purchase.status)?.label}
              </TableCell>
              <TableCell>{formatCurrency(purchase.totalCents)}</TableCell>
              <TableCell align="right">
                <Button size="small" onClick={() => loadPurchase(purchase.id)}>
                  Ver
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      )}

      <Dialog open={Boolean(selectedPurchase)} onClose={() => setSelectedPurchase(null)} maxWidth="lg" fullWidth>
        <DialogTitle>Detalle de compra</DialogTitle>
        <DialogContent sx={{ mt: 1 }}>
          {selectedPurchase && (
            <>
              <Panel sx={{ mb: 2 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Proveedor
                    </Typography>
                    <Typography>{selectedPurchase.supplier?.name}</Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Estado
                    </Typography>
                    <TextField
                      select
                      value={selectedPurchase.status}
                      onChange={(event) => handleStatusChange(event.target.value)}
                      fullWidth
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <MenuItem key={status.value} value={status.value}>
                          {status.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Total
                    </Typography>
                    <Typography variant="h6">{formatCurrency(selectedPurchase.totalCents)}</Typography>
                  </Box>
                </Stack>
              </Panel>

              <Panel sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Items
                  </Typography>
                  <Button size="small" onClick={openItemDialog}>
                    Agregar item
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleReceive}
                    disabled={selectedPurchase.status === 'RECEIVED'}
                  >
                    Marcar recibida
                  </Button>
                </Stack>
                {items.length === 0 ? (
                  <EmptyState title="Sin items" description="Agrega repuestos a esta compra." />
                ) : (
                  <DataTable headers={['Ítem', 'Cantidad', 'Costo', 'Total', 'Acciones']}>
                    {items.map((item) => (
                      <TableRow key={item.id} hover>
                        <TableCell>{item.catalogItem?.name}</TableCell>
                        <TableCell>{item.qty}</TableCell>
                        <TableCell>{formatCurrency(item.unitCostCents)}</TableCell>
                        <TableCell>{formatCurrency(item.lineTotalCents)}</TableCell>
                        <TableCell align="right">
                          <Button size="small" color="error" onClick={() => handleRemoveItem(item.id)}>
                            Quitar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </DataTable>
                )}
              </Panel>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSelectedPurchase(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isCreateOpen} onClose={closeCreateDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Nueva compra</DialogTitle>
        <DialogContent sx={{ mt: 1 }}>
          {createError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {createError}
            </Alert>
          )}
          <FormSection>
            <TextField
              select
              label="Proveedor"
              value={createSupplierId}
              onChange={(event) => setCreateSupplierId(event.target.value)}
              fullWidth
            >
              <MenuItem value="">Selecciona un proveedor</MenuItem>
              {suppliers.map((supplier) => (
                <MenuItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </MenuItem>
              ))}
            </TextField>
          </FormSection>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeCreateDialog}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreate} disabled={isCreating}>
            {isCreating ? <CircularProgress size={20} /> : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isItemOpen} onClose={closeItemDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Agregar item</DialogTitle>
        <DialogContent sx={{ mt: 1 }}>
          {itemError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {itemError}
            </Alert>
          )}
          <FormSection>
            <TextField
              select
              label="Repuesto"
              value={itemForm.catalogItemId}
              onChange={(event) =>
                setItemForm((prev) => ({ ...prev, catalogItemId: event.target.value }))
              }
              fullWidth
            >
              <MenuItem value="">Selecciona un repuesto</MenuItem>
              {catalog.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.name}
                </MenuItem>
              ))}
            </TextField>
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
                label="Costo unitario (CLP)"
                type="number"
                value={itemForm.unitCostCents}
                onChange={(event) =>
                  setItemForm((prev) => ({
                    ...prev,
                    unitCostCents: event.target.value,
                  }))
                }
                fullWidth
              />
            </FormRow>
          </FormSection>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeItemDialog}>Cancelar</Button>
          <Button variant="contained" onClick={handleAddItem} disabled={isItemSaving}>
            {isItemSaving ? <CircularProgress size={20} /> : 'Agregar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

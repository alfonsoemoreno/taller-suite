'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  TableCell,
  TableRow,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { EmptyState } from '../components/ui/EmptyState';
import { DataTable } from '../components/ui/DataTable';
import { usePageTitle } from '../hooks/usePageTitle';
import type { WorkOrderStatus } from '@taller/shared';

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

type WorkOrderRow = {
  id: string;
  status: WorkOrderStatus;
  totalCents: number;
  createdAt: string;
  customer: Customer;
  vehicle?: Vehicle | null;
};

const STATUS_OPTIONS: { value: WorkOrderStatus; label: string }[] = [
  { value: 'OPEN', label: 'Abierta' },
  { value: 'IN_PROGRESS', label: 'En progreso' },
  { value: 'DONE', label: 'Finalizada' },
  { value: 'CANCELED', label: 'Cancelada' },
];

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(cents / 100);

export function WorkOrdersListPage() {
  const router = useRouter();
  const { apiFetch } = useAuth();
  const [orders, setOrders] = useState<WorkOrderRow[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [customerFilter, setCustomerFilter] = useState<string>('');

  usePageTitle('Órdenes de trabajo');

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (customerFilter) params.set('customerId', customerFilter);
    return params.toString();
  }, [statusFilter, customerFilter]);

  const loadOrders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<WorkOrderRow[]>(
        `/work-orders${queryString ? `?${queryString}` : ''}`,
      );
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando órdenes.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await apiFetch<Customer[]>('/customers');
      setCustomers(data);
    } catch {
      setCustomers([]);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [queryString]);

  useEffect(() => {
    loadCustomers();
  }, []);

  return (
    <Box>
      <PageHeader
        title="Órdenes de trabajo"
        subtitle="Gestiona el flujo de servicios y reparaciones."
        actions={
          <Button
            variant="contained"
            onClick={() => router.push('/app/work-orders/new')}
          >
            Nueva orden
          </Button>
        }
      />

      <Panel sx={{ mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            select
            label="Estado"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">Todos</MenuItem>
            {STATUS_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Cliente"
            value={customerFilter}
            onChange={(event) => setCustomerFilter(event.target.value)}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">Todos</MenuItem>
            {customers.map((customer) => (
              <MenuItem key={customer.id} value={customer.id}>
                {customer.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
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
      ) : orders.length === 0 ? (
        <Panel>
          <EmptyState
            title="Sin órdenes registradas"
            description="Crea la primera orden para empezar a registrar servicios."
            actionLabel="Nueva orden"
            onAction={() => router.push('/app/work-orders/new')}
          />
        </Panel>
      ) : (
        <DataTable headers={['Fecha', 'Cliente', 'Vehículo', 'Estado', 'Total', 'Acciones']}>
          {orders.map((order) => (
            <TableRow key={order.id} hover>
              <TableCell>
                {new Date(order.createdAt).toLocaleDateString('es-CL')}
              </TableCell>
              <TableCell>{order.customer?.name ?? '-'}</TableCell>
              <TableCell>
                {order.vehicle
                  ? `${order.vehicle.plate} • ${order.vehicle.brand ?? ''} ${order.vehicle.model ?? ''}`.trim()
                  : '-'}
              </TableCell>
              <TableCell>{STATUS_OPTIONS.find((s) => s.value === order.status)?.label ?? order.status}</TableCell>
              <TableCell>{formatCurrency(order.totalCents)}</TableCell>
              <TableCell align="right">
                <Button
                  size="small"
                  onClick={() => router.push(`/app/work-orders/${order.id}`)}
                >
                  Ver
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      )}
    </Box>
  );
}

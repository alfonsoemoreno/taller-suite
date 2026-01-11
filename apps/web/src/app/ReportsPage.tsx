import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Stack,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { FormRow } from '../components/ui/FormRow';
import { usePageTitle } from '../hooks/usePageTitle';
import type { PaymentMethod } from '@taller/shared';
import { DataTable } from '../components/ui/DataTable';

type SummaryResponse = {
  range: { from: string; to: string };
  totals: {
    salesCents: number;
    averageTicketCents: number;
  };
  statusCounts: Array<{ status: string; count: number }>;
  salesByDay: Array<{ date: string; totalCents: number }>;
  salesByMethod: Array<{ method: string; totalCents: number }>;
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Abiertas',
  IN_PROGRESS: 'En progreso',
  DONE: 'Finalizadas',
  CANCELED: 'Canceladas',
};

const METHOD_OPTIONS: Array<{ value: PaymentMethod | ''; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
];

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
};

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(cents / 100);

export function ReportsPage() {
  const { apiFetch, user } = useAuth();
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    method: '' as PaymentMethod | '',
  });

  usePageTitle('Reportes');

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.method) params.set('method', filters.method);
    const query = params.toString();
    return query ? `?${query}` : '';
  }, [filters]);

  const loadSummary = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<SummaryResponse>(`/reports/summary${queryString}`);
      setSummary(data);
      if (!filters.from || !filters.to) {
        setFilters((prev) => ({
          ...prev,
          from: data.range.from,
          to: data.range.to,
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando reportes.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [queryString]);

  if (user?.role === 'STAFF') {
    return <Alert severity="error">No tienes permisos para ver reportes.</Alert>;
  }

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
        title="Reportes"
        subtitle="Resumen de ventas y órdenes."
        actions={
          <Button variant="outlined" onClick={loadSummary}>
            Actualizar
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {summary && (
        <>
          <Panel sx={{ mb: 3 }}>
            <FormRow>
              <TextField
                label="Desde"
                type="date"
                value={filters.from}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, from: event.target.value }))
                }
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Hasta"
                type="date"
                value={filters.to}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, to: event.target.value }))
                }
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                select
                label="Método de pago"
                value={filters.method}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    method: event.target.value as PaymentMethod | '',
                  }))
                }
                fullWidth
              >
                {METHOD_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </FormRow>
          </Panel>

          <Panel sx={{ mb: 3 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <Box sx={{ flex: 1, border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Ventas del período
                </Typography>
                <Typography variant="h5">{formatCurrency(summary.totals.salesCents)}</Typography>
              </Box>
              <Box sx={{ flex: 1, border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Ticket promedio (OT pagadas/DONE)
                </Typography>
                <Typography variant="h5">
                  {formatCurrency(summary.totals.averageTicketCents)}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Órdenes registradas
                </Typography>
                <Typography variant="h5">
                  {summary.statusCounts.reduce((acc, row) => acc + row.count, 0)}
                </Typography>
              </Box>
            </Stack>
          </Panel>

          <Panel sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              Órdenes por estado
            </Typography>
            <DataTable headers={['Estado', 'Cantidad']}>
              {summary.statusCounts.map((row) => (
                <TableRow key={row.status} hover>
                  <TableCell>{STATUS_LABELS[row.status] ?? row.status}</TableCell>
                  <TableCell>{row.count}</TableCell>
                </TableRow>
              ))}
            </DataTable>
          </Panel>

          <Panel sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              Ventas por método
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
              <Box sx={{ flex: 1 }}>
                <PieChart
                  height={220}
                  series={[
                    {
                      data: summary.salesByMethod.map((row, index) => ({
                        id: row.method,
                        value: row.totalCents / 100,
                        label: METHOD_LABELS[row.method] ?? row.method,
                        color: ['#1f4a7a', '#3f3f46', '#64748b'][index % 3],
                      })),
                    },
                  ]}
                  margin={{ left: 10, right: 10, top: 10, bottom: 10 }}
                  slotProps={{
                    legend: {
                      direction: 'column',
                      position: { vertical: 'middle', horizontal: 'right' },
                      itemGap: 8,
                    },
                  }}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <DataTable headers={['Método', 'Total']}>
                  {summary.salesByMethod.map((row) => (
                    <TableRow key={row.method} hover>
                      <TableCell>{METHOD_LABELS[row.method] ?? row.method}</TableCell>
                      <TableCell>{formatCurrency(row.totalCents)}</TableCell>
                    </TableRow>
                  ))}
                </DataTable>
              </Box>
            </Stack>
          </Panel>

          <Panel>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              Ventas por día
            </Typography>
            <BarChart
              height={280}
              xAxis={[
                {
                  scaleType: 'band',
                  data: summary.salesByDay.map((item) => item.date),
                },
              ]}
              series={[
                {
                  data: summary.salesByDay.map((item) => item.totalCents / 100),
                  label: 'Ventas (CLP)',
                  color: '#1f4a7a',
                },
              ]}
              margin={{ left: 60, right: 20, top: 20, bottom: 40 }}
            />
          </Panel>
        </>
      )}
    </Box>
  );
}

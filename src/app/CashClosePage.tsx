'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { CashCloseCreateSchema } from '@/shared';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { FormSection } from '../components/ui/FormSection';
import { usePageTitle } from '../hooks/usePageTitle';

type CashClose = {
  id: string;
  date: string;
  cashInCents: number;
  cardInCents: number;
  transferInCents: number;
  notes?: string | null;
  createdAt: string;
};

type CashTotals = {
  cashInCents: number;
  cardInCents: number;
  transferInCents: number;
};

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(cents / 100);

export function CashClosePage() {
  const { apiFetch } = useAuth();
  const [todayTotals, setTodayTotals] = useState<CashTotals | null>(null);
  const [todayClose, setTodayClose] = useState<CashClose | null>(null);
  const [history, setHistory] = useState<CashClose[]>([]);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  usePageTitle('Caja del día');

  const totals = useMemo(() => {
    return todayTotals ?? { cashInCents: 0, cardInCents: 0, transferInCents: 0 };
  }, [todayTotals]);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{
        date: string;
        close: CashClose | null;
        totals: CashTotals;
      }>('/cash-close/today');
      setTodayTotals(data.totals);
      setTodayClose(data.close);
      const historyData = await apiFetch<CashClose[]>('/cash-close');
      setHistory(historyData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando caja.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCloseDay = async () => {
    setFormError(null);
    setIsSaving(true);
    try {
      const payload = { notes: notes.trim() };
      const parsed = CashCloseCreateSchema.safeParse(payload);
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? 'Datos inválidos.');
        return;
      }
      await apiFetch('/cash-close', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      setNotes('');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error cerrando caja.');
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
        title="Caja del día"
        subtitle="Resumen de ingresos y cierre diario."
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Panel sx={{ mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Totales de hoy
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="Efectivo"
            value={formatCurrency(totals.cashInCents)}
            InputProps={{ readOnly: true }}
            fullWidth
          />
          <TextField
            label="Tarjeta"
            value={formatCurrency(totals.cardInCents)}
            InputProps={{ readOnly: true }}
            fullWidth
          />
          <TextField
            label="Transferencia"
            value={formatCurrency(totals.transferInCents)}
            InputProps={{ readOnly: true }}
            fullWidth
          />
        </Stack>
      </Panel>

      <Panel sx={{ mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Cierre del día
        </Typography>
        {todayClose ? (
          <Typography variant="body2" color="text.secondary">
            Cerrado el {new Date(todayClose.createdAt).toLocaleString('es-CL')}.
          </Typography>
        ) : (
          <FormSection>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField
              label="Notas"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
            <Button variant="contained" onClick={handleCloseDay} disabled={isSaving}>
              {isSaving ? <CircularProgress size={20} /> : 'Cerrar día'}
            </Button>
          </FormSection>
        )}
      </Panel>

      <Panel>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Historial de cierres
        </Typography>
        {history.length === 0 ? (
          <EmptyState title="Sin cierres anteriores" description="Aún no hay cierres registrados." />
        ) : (
          <DataTable headers={['Fecha', 'Efectivo', 'Tarjeta', 'Transferencia', 'Notas']}>
            {history.map((close) => (
              <TableRow key={close.id} hover>
                <TableCell>{close.date}</TableCell>
                <TableCell>{formatCurrency(close.cashInCents)}</TableCell>
                <TableCell>{formatCurrency(close.cardInCents)}</TableCell>
                <TableCell>{formatCurrency(close.transferInCents)}</TableCell>
                <TableCell>{close.notes ?? '-'}</TableCell>
              </TableRow>
            ))}
          </DataTable>
        )}
      </Panel>
    </Box>
  );
}

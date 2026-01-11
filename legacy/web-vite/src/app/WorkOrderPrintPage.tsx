import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  Divider,
  Typography,
} from '@mui/material';
import type { WorkOrderStatus } from '@taller/shared';
import { useAuth } from '../auth/AuthContext';

type Customer = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
};

type Vehicle = {
  id: string;
  plate: string;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
};

type WorkOrderItem = {
  id: string;
  type: 'LABOR' | 'PART';
  name: string;
  qty: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

type WorkOrder = {
  id: string;
  status: WorkOrderStatus;
  title?: string | null;
  description?: string | null;
  odometer?: number | null;
  totalCents: number;
  createdAt: string;
  customer: Customer;
  vehicle?: Vehicle | null;
  items: WorkOrderItem[];
};

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  OPEN: 'Abierta',
  IN_PROGRESS: 'En progreso',
  DONE: 'Finalizada',
  CANCELED: 'Cancelada',
};

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(cents / 100);

export function WorkOrderPrintPage() {
  const { id } = useParams();
  const { apiFetch } = useAuth();
  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const data = await apiFetch<WorkOrder>(`/work-orders/${id}`);
      setOrder(data);
      setIsLoading(false);
      setTimeout(() => window.print(), 200);
    };
    load();
  }, [id]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!order) {
    return (
      <Typography sx={{ p: 2 }}>Orden no encontrada.</Typography>
    );
  }

  return (
    <Box
      sx={{
        bgcolor: '#fff',
        color: '#0f172a',
        p: 4,
        maxWidth: 900,
        margin: '0 auto',
        '@media print': {
          p: 0,
        },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Orden de Trabajo
          </Typography>
          <Typography variant="body2" color="text.secondary">
            #{order.id.slice(0, 6)} • {new Date(order.createdAt).toLocaleDateString('es-CL')}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="body2">Estado</Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {STATUS_LABELS[order.status]}
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Box sx={{ display: 'flex', gap: 4, mb: 3 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Cliente
          </Typography>
          <Typography>{order.customer.name}</Typography>
          {order.customer.email && (
            <Typography variant="body2">{order.customer.email}</Typography>
          )}
          {order.customer.phone && (
            <Typography variant="body2">{order.customer.phone}</Typography>
          )}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Vehículo
          </Typography>
          {order.vehicle ? (
            <>
              <Typography>{order.vehicle.plate}</Typography>
              <Typography variant="body2">
                {order.vehicle.brand ?? ''} {order.vehicle.model ?? ''}{' '}
                {order.vehicle.year ?? ''}
              </Typography>
            </>
          ) : (
            <Typography>Sin vehículo</Typography>
          )}
          {order.odometer && (
            <Typography variant="body2">Km: {order.odometer}</Typography>
          )}
        </Box>
      </Box>

      {order.title && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Título
          </Typography>
          <Typography variant="body2">{order.title}</Typography>
        </Box>
      )}
      {order.description && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Diagnóstico / descripción
          </Typography>
          <Typography variant="body2">{order.description}</Typography>
        </Box>
      )}

      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        Items
      </Typography>
      <Box sx={{ border: '1px solid #e2e8f0' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1.2fr 3fr 1fr 1fr 1fr', p: 1, bgcolor: '#f8fafc' }}>
          <Typography variant="caption">Tipo</Typography>
          <Typography variant="caption">Detalle</Typography>
          <Typography variant="caption">Cantidad</Typography>
          <Typography variant="caption">Precio</Typography>
          <Typography variant="caption">Total</Typography>
        </Box>
        {order.items.map((item) => (
          <Box
            key={item.id}
            sx={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 3fr 1fr 1fr 1fr',
              p: 1,
              borderTop: '1px solid #e2e8f0',
            }}
          >
            <Typography variant="body2">
              {item.type === 'LABOR' ? 'Mano de obra' : 'Repuesto'}
            </Typography>
            <Typography variant="body2">{item.name}</Typography>
            <Typography variant="body2">{item.qty}</Typography>
            <Typography variant="body2">{formatCurrency(item.unitPriceCents)}</Typography>
            <Typography variant="body2">{formatCurrency(item.lineTotalCents)}</Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="subtitle2">Total</Typography>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {formatCurrency(order.totalCents)}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

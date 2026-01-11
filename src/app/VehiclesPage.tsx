'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Snackbar,
  Stack,
  Switch,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  VehicleCreateSchema,
  VehicleUpdateSchema,
  normalizePlate,
} from '@taller/shared';
import { useAuth } from '../auth/AuthContext';
import { PlateScanner } from '../components/PlateScanner';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { DataTable } from '../components/ui/DataTable';
import { usePageTitle } from '../hooks/usePageTitle';
import { FormRow } from '../components/ui/FormRow';
import { FormSection } from '../components/ui/FormSection';

type Vehicle = {
  id: string;
  plate: string;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  fuel?: string | null;
  transmission?: string | null;
  typeVehicle?: string | null;
  doors?: number | null;
  version?: string | null;
  mileage?: number | null;
  vin?: string | null;
  engineNo?: string | null;
  color?: string | null;
};

const emptyForm = {
  plate: '',
  brand: '',
  model: '',
  year: '',
  fuel: '',
  transmission: '',
  typeVehicle: '',
  doors: '',
  version: '',
  mileage: '',
  vin: '',
  engineNo: '',
  color: '',
};

export function VehiclesPage() {
  const params = useParams();
  const customerId =
    typeof params.id === 'string' ? params.id : params.id?.[0];
  const { apiFetch } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formState, setFormState] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [scannerCandidate, setScannerCandidate] = useState<string>('');
  const [scannerConfidence, setScannerConfidence] = useState<number>(0);
  const [scannerConfirmed, setScannerConfirmed] = useState<string>('');
  const [autoLookup, setAutoLookup] = useState(true);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  usePageTitle('Vehículos');

  const loadVehicles = async () => {
    if (!customerId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Vehicle[]>(`/customers/${customerId}/vehicles`);
      setVehicles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando vehiculos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, [customerId]);

  const openCreateDialog = () => {
    setEditingVehicle(null);
    setFormState(emptyForm);
    setFormError(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormState({
      plate: vehicle.plate ?? '',
      brand: vehicle.brand ?? '',
      model: vehicle.model ?? '',
      year: vehicle.year ? String(vehicle.year) : '',
      fuel: vehicle.fuel ?? '',
      transmission: vehicle.transmission ?? '',
      typeVehicle: vehicle.typeVehicle ?? '',
      doors: vehicle.doors ? String(vehicle.doors) : '',
      version: vehicle.version ?? '',
      mileage: vehicle.mileage ? String(vehicle.mileage) : '',
      vin: vehicle.vin ?? '',
      engineNo: vehicle.engineNo ?? '',
      color: vehicle.color ?? '',
    });
    setFormError(null);
    setIsDialogOpen(true);
  };

  const closeDialog = () => setIsDialogOpen(false);
  const closeScanner = () => {
    setIsScannerOpen(false);
    setScannerCandidate('');
    setScannerConfidence(0);
    setScannerConfirmed('');
  };

  const handleFormChange = (field: keyof typeof formState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const payload = useMemo(() => {
    const yearValue = formState.year.trim();
    const doorsValue = formState.doors.trim();
    const mileageValue = formState.mileage.trim();
    const toOptional = (value: string) => value.trim() || undefined;
    return {
      plate: normalizePlate(formState.plate.trim()),
      brand: toOptional(formState.brand),
      model: toOptional(formState.model),
      year: yearValue ? Number(yearValue) : undefined,
      fuel: toOptional(formState.fuel),
      transmission: toOptional(formState.transmission),
      typeVehicle: toOptional(formState.typeVehicle),
      doors: doorsValue ? Number(doorsValue) : undefined,
      version: toOptional(formState.version),
      mileage: mileageValue ? Number(mileageValue) : undefined,
      vin: toOptional(formState.vin),
      engineNo: toOptional(formState.engineNo),
      color: toOptional(formState.color),
    };
  }, [formState]);

  const handleLookup = async (overridePlate?: string) => {
    setFormError(null);
    const plate = normalizePlate(overridePlate ?? formState.plate);
    if (!plate) {
      setFormError('Ingresa una patente primero.');
      return;
    }
    setIsLookupLoading(true);
    try {
      const data = await apiFetch<Partial<Vehicle>>('/vehicles/lookup', {
        method: 'POST',
        body: JSON.stringify({ plate }),
      });
      setFormState((prev) => ({
        ...prev,
        plate,
        brand: data.brand ?? prev.brand,
        model: data.model ?? prev.model,
        year: data.year ? String(data.year) : prev.year,
        fuel: data.fuel ?? prev.fuel,
        transmission: data.transmission ?? prev.transmission,
        typeVehicle: data.typeVehicle ?? prev.typeVehicle,
        doors: data.doors ? String(data.doors) : prev.doors,
        version: data.version ?? prev.version,
        mileage: data.mileage ? String(data.mileage) : prev.mileage,
        vin: data.vin ?? prev.vin,
        engineNo: data.engineNo ?? prev.engineNo,
        color: data.color ?? prev.color,
      }));
      setSnackbar('Datos autocompletados');
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'No se pudo autocompletar.',
      );
    } finally {
      setIsLookupLoading(false);
    }
  };

  const handleSave = async () => {
    if (!customerId) return;
    setFormError(null);
    setIsSaving(true);
    try {
      if (editingVehicle) {
        const parsed = VehicleUpdateSchema.safeParse(payload);
        if (!parsed.success) {
          setFormError(parsed.error.issues[0]?.message ?? 'Datos invalidos.');
          return;
        }
        await apiFetch(`/vehicles/${editingVehicle.id}`, {
          method: 'PATCH',
          body: JSON.stringify(parsed.data),
        });
        setSnackbar('Vehiculo actualizado');
      } else {
        const parsed = VehicleCreateSchema.safeParse(payload);
        if (!parsed.success) {
          setFormError(parsed.error.issues[0]?.message ?? 'Datos invalidos.');
          return;
        }
        await apiFetch(`/customers/${customerId}/vehicles`, {
          method: 'POST',
          body: JSON.stringify(parsed.data),
        });
        setSnackbar('Vehiculo creado');
      }
      closeDialog();
      await loadVehicles();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error guardando.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (vehicle: Vehicle) => {
    setVehicleToDelete(vehicle);
  };

  const confirmDelete = async () => {
    if (!vehicleToDelete) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/vehicles/${vehicleToDelete.id}`, { method: 'DELETE' });
      setSnackbar('Vehiculo eliminado');
      await loadVehicles();
    } catch (err) {
      setSnackbar(err instanceof Error ? err.message : 'Error eliminando.');
    } finally {
      setIsDeleting(false);
      setVehicleToDelete(null);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Vehículos"
        subtitle="Vehículos asociados al cliente seleccionado."
        actions={
          <Button variant="contained" onClick={openCreateDialog}>
            Nuevo vehículo
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
      ) : vehicles.length === 0 ? (
        <Panel>
          <EmptyState
            title="Sin vehículos registrados"
            description="Agrega un vehículo para mantener su historial al día."
            actionLabel="Nuevo vehículo"
            onAction={openCreateDialog}
          />
        </Panel>
      ) : (
        <DataTable headers={['Patente', 'Marca', 'Modelo', 'Año', 'Acciones']}>
          {vehicles.map((vehicle) => (
            <TableRow key={vehicle.id} hover>
              <TableCell>{vehicle.plate}</TableCell>
              <TableCell>{vehicle.brand ?? '-'}</TableCell>
              <TableCell>{vehicle.model ?? '-'}</TableCell>
              <TableCell>{vehicle.year ?? '-'}</TableCell>
              <TableCell align="right">
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button size="small" onClick={() => openEditDialog(vehicle)}>
                    Editar
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => handleDelete(vehicle)}
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
          {editingVehicle ? 'Editar vehiculo' : 'Nuevo vehiculo'}
        </DialogTitle>
        <DialogContent sx={{ mt: 1 }}>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}
          <FormSection>
            <FormRow>
              <TextField
                label="Patente"
                value={formState.plate}
                onChange={(event) => handleFormChange('plate', event.target.value)}
                fullWidth
                required
              />
              <Button
                variant="outlined"
                onClick={() => handleLookup()}
                disabled={isLookupLoading}
                sx={{ minWidth: 160 }}
              >
                {isLookupLoading ? (
                  <CircularProgress size={18} />
                ) : (
                  'Autocompletar'
                )}
              </Button>
            </FormRow>
            <Stack direction="row" spacing={2} alignItems="center">
              <Button variant="text" onClick={() => setIsScannerOpen(true)}>
                Escanear patente
              </Button>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoLookup}
                    onChange={(event) => setAutoLookup(event.target.checked)}
                  />
                }
                label="Autocompletar automáticamente"
              />
            </Stack>
            <FormRow>
              <TextField
                label="Marca"
                value={formState.brand}
                onChange={(event) => handleFormChange('brand', event.target.value)}
                fullWidth
              />
              <TextField
                label="Modelo"
                value={formState.model}
                onChange={(event) => handleFormChange('model', event.target.value)}
                fullWidth
              />
              <TextField
                label="Año"
                value={formState.year}
                onChange={(event) => handleFormChange('year', event.target.value)}
                fullWidth
                type="number"
              />
            </FormRow>
            <FormRow>
              <TextField
                label="Combustible"
                value={formState.fuel}
                onChange={(event) => handleFormChange('fuel', event.target.value)}
                fullWidth
              />
              <TextField
                label="Transmisión"
                value={formState.transmission}
                onChange={(event) =>
                  handleFormChange('transmission', event.target.value)
                }
                fullWidth
              />
              <TextField
                label="Tipo"
                value={formState.typeVehicle}
                onChange={(event) =>
                  handleFormChange('typeVehicle', event.target.value)
                }
                fullWidth
              />
            </FormRow>
            <FormRow>
              <TextField
                label="Puertas"
                value={formState.doors}
                onChange={(event) => handleFormChange('doors', event.target.value)}
                fullWidth
                type="number"
              />
              <TextField
                label="Versión"
                value={formState.version}
                onChange={(event) => handleFormChange('version', event.target.value)}
                fullWidth
              />
              <TextField
                label="Kilometraje"
                value={formState.mileage}
                onChange={(event) => handleFormChange('mileage', event.target.value)}
                fullWidth
                type="number"
              />
            </FormRow>
            <FormRow>
              <TextField
                label="VIN"
                value={formState.vin}
                onChange={(event) => handleFormChange('vin', event.target.value)}
                fullWidth
              />
              <TextField
                label="Motor"
                value={formState.engineNo}
                onChange={(event) => handleFormChange('engineNo', event.target.value)}
                fullWidth
              />
              <TextField
                label="Color"
                value={formState.color}
                onChange={(event) => handleFormChange('color', event.target.value)}
                fullWidth
              />
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

      <Dialog open={isScannerOpen} onClose={closeScanner} maxWidth="sm" fullWidth>
        <DialogTitle>Escanear patente</DialogTitle>
        <DialogContent sx={{ mt: 1 }}>
          <PlateScanner
            autoStart={false}
            onPlateCandidate={(text, score) => {
              setScannerCandidate(text);
              setScannerConfidence(score);
            }}
            onPlateConfirmed={(plate) => {
              setScannerConfirmed(plate);
            }}
            onError={(message) => {
              setFormError(message);
            }}
          />
          {scannerCandidate && (
            <Box
              sx={{
                mt: 2,
                p: 2,
                borderRadius: 2,
                bgcolor: 'grey.100',
              }}
            >
              <Typography variant="subtitle2">Resultado detectado</Typography>
              <Typography variant="body2" color="text.secondary">
                {scannerCandidate} • {Math.round(scannerConfidence)}% confianza
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeScanner}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!scannerConfirmed}
            onClick={async () => {
              setFormState((prev) => ({
                ...prev,
                plate: scannerConfirmed,
              }));
              closeScanner();
              if (autoLookup) {
                await handleLookup(scannerConfirmed);
              }
            }}
          >
            Usar esta patente
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(vehicleToDelete)}
        title="Eliminar vehículo"
        description={
          vehicleToDelete
            ? `¿Deseas eliminar el vehículo ${vehicleToDelete.plate}?`
            : undefined
        }
        confirmLabel="Eliminar"
        onConfirm={confirmDelete}
        onClose={() => setVehicleToDelete(null)}
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

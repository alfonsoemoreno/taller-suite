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
  UserCreateSchema,
  UserUpdateSchema,
  UserResetPasswordSchema,
  type UserRole,
} from '@/shared';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { FormSection } from '../components/ui/FormSection';
import { FormRow } from '../components/ui/FormRow';
import { usePageTitle } from '../hooks/usePageTitle';

type UserRow = {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
};

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'OWNER', label: 'Owner' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'STAFF', label: 'Staff' },
];

export function UsersPage() {
  const { apiFetch, user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formState, setFormState] = useState({
    email: '',
    role: 'STAFF' as UserRole,
    password: '',
  });

  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserRow | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [isResetSaving, setIsResetSaving] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState<UserRow | null>(null);
  const [isConfirmSaving, setIsConfirmSaving] = useState(false);

  usePageTitle('Usuarios');

  const canManageUsers = useMemo(() => {
    return user?.role === 'OWNER' || user?.role === 'ADMIN';
  }, [user?.role]);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<UserRow[]>('/users');
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando usuarios.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openCreateDialog = () => {
    setEditingUser(null);
    setFormState({ email: '', role: 'STAFF', password: '' });
    setFormError(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (target: UserRow) => {
    setEditingUser(target);
    setFormState({ email: target.email, role: target.role, password: '' });
    setFormError(null);
    setIsDialogOpen(true);
  };

  const closeDialog = () => setIsDialogOpen(false);

  const handleSave = async () => {
    setFormError(null);
    setIsSaving(true);
    try {
      if (editingUser) {
        const parsed = UserUpdateSchema.safeParse({
          role: formState.role,
          isActive: editingUser.isActive,
        });
        if (!parsed.success) {
          setFormError(parsed.error.issues[0]?.message ?? 'Datos inválidos.');
          return;
        }
        await apiFetch(`/users/${editingUser.id}`, {
          method: 'PATCH',
          body: JSON.stringify(parsed.data),
        });
      } else {
        const parsed = UserCreateSchema.safeParse(formState);
        if (!parsed.success) {
          setFormError(parsed.error.issues[0]?.message ?? 'Datos inválidos.');
          return;
        }
        await apiFetch('/users', {
          method: 'POST',
          body: JSON.stringify(parsed.data),
        });
      }
      closeDialog();
      await loadUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error guardando usuario.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = (target: UserRow) => {
    setConfirmTarget(target);
  };

  const confirmToggle = async () => {
    if (!confirmTarget) return;
    setIsConfirmSaving(true);
    try {
      await apiFetch(`/users/${confirmTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !confirmTarget.isActive }),
      });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error actualizando usuario.');
    } finally {
      setIsConfirmSaving(false);
      setConfirmTarget(null);
    }
  };

  const openResetDialog = (target: UserRow) => {
    setResetPasswordUser(target);
    setResetPassword('');
    setResetError(null);
  };

  const closeResetDialog = () => setResetPasswordUser(null);

  const handleResetPassword = async () => {
    if (!resetPasswordUser) return;
    setResetError(null);
    setIsResetSaving(true);
    try {
      const parsed = UserResetPasswordSchema.safeParse({ password: resetPassword });
      if (!parsed.success) {
        setResetError(parsed.error.issues[0]?.message ?? 'Password inválida.');
        return;
      }
      await apiFetch(`/users/${resetPasswordUser.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      closeResetDialog();
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Error actualizando password.');
    } finally {
      setIsResetSaving(false);
    }
  };

  if (!canManageUsers) {
    return (
      <Alert severity="error">
        No tienes permisos para ver esta sección.
      </Alert>
    );
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
        title="Usuarios"
        subtitle="Gestiona accesos y roles."
        actions={
          <Button variant="contained" onClick={openCreateDialog}>
            Nuevo usuario
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {users.length === 0 ? (
        <Panel>
          <EmptyState
            title="Sin usuarios"
            description="Crea el primer usuario para administrar el taller."
            actionLabel="Crear usuario"
            onAction={openCreateDialog}
          />
        </Panel>
      ) : (
        <DataTable headers={['Email', 'Rol', 'Estado', 'Acciones']}>
          {users.map((row) => (
            <TableRow key={row.id} hover>
              <TableCell>{row.email}</TableCell>
              <TableCell>{ROLE_OPTIONS.find((r) => r.value === row.role)?.label}</TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {row.isActive ? 'Activo' : 'Inactivo'}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button size="small" onClick={() => openEditDialog(row)}>
                    Editar rol
                  </Button>
                  <Button size="small" onClick={() => openResetDialog(row)}>
                    Reset password
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => handleToggleActive(row)}
                  >
                    {row.isActive ? 'Desactivar' : 'Activar'}
                  </Button>
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      )}

      <Dialog open={isDialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingUser ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
        <DialogContent sx={{ mt: 1 }}>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}
          <FormSection>
            <FormRow>
              <TextField
                label="Email"
                value={formState.email}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, email: event.target.value }))
                }
                fullWidth
                disabled={Boolean(editingUser)}
              />
              <TextField
                select
                label="Rol"
                value={formState.role}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    role: event.target.value as UserRole,
                  }))
                }
                fullWidth
              >
                {ROLE_OPTIONS.map((role) => (
                  <MenuItem key={role.value} value={role.value}>
                    {role.label}
                  </MenuItem>
                ))}
              </TextField>
            </FormRow>
            {!editingUser && (
              <TextField
                label="Password"
                type="password"
                value={formState.password}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, password: event.target.value }))
                }
                fullWidth
              />
            )}
          </FormSection>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <CircularProgress size={20} /> : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(resetPasswordUser)} onClose={closeResetDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Reset password</DialogTitle>
        <DialogContent sx={{ mt: 1 }}>
          {resetError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {resetError}
            </Alert>
          )}
          <FormSection>
            <TextField
              label="Nueva password"
              type="password"
              value={resetPassword}
              onChange={(event) => setResetPassword(event.target.value)}
              fullWidth
            />
          </FormSection>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeResetDialog}>Cancelar</Button>
          <Button variant="contained" onClick={handleResetPassword} disabled={isResetSaving}>
            {isResetSaving ? <CircularProgress size={20} /> : 'Actualizar'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title={confirmTarget?.isActive ? 'Desactivar usuario' : 'Activar usuario'}
        description={
          confirmTarget
            ? `¿Deseas ${confirmTarget.isActive ? 'desactivar' : 'activar'} a ${confirmTarget.email}?`
            : undefined
        }
        confirmLabel={confirmTarget?.isActive ? 'Desactivar' : 'Activar'}
        onConfirm={confirmToggle}
        onClose={() => setConfirmTarget(null)}
        isLoading={isConfirmSaving}
      />
    </Box>
  );
}

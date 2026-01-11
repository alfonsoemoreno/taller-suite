'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
  Container,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import { useAuth } from '../auth/AuthContext';
import { PageTitleProvider, usePageTitleContext } from './PageTitleContext';

const drawerWidth = 240;

type NavItem = {
  label: string;
  to?: string;
  icon: ReactNode;
  disabled?: boolean;
  roles?: Array<'OWNER' | 'ADMIN' | 'STAFF'>;
};

type AppTopBarProps = {
  onMenuToggle: () => void;
};

function AppTopBar({ onMenuToggle }: AppTopBarProps) {
  const { title } = usePageTitleContext();
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const openMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const closeMenu = () => setAnchorEl(null);

  return (
    <AppBar
      position="fixed"
      color="inherit"
      elevation={0}
      sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', minHeight: 60 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <IconButton
            color="inherit"
            onClick={onMenuToggle}
            sx={{ display: { lg: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Stack spacing={0.5}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
          </Stack>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" color="text.secondary">
            {user?.email}
          </Typography>
          <IconButton onClick={openMenu} size="small">
            <Avatar sx={{ width: 32, height: 32 }}>
              {user?.email?.[0]?.toUpperCase() ?? 'U'}
            </Avatar>
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeMenu}>
            <MenuItem disabled>Perfil</MenuItem>
            <Divider />
            <MenuItem
              onClick={() => {
                closeMenu();
                logout();
              }}
            >
              Cerrar sesión
            </MenuItem>
          </Menu>
        </Stack>
      </Toolbar>
      <Divider />
    </AppBar>
  );
}

function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const navItems: NavItem[] = useMemo(
    () => [
      {
        label: 'Clientes',
        to: '/app/customers',
        icon: <PeopleAltOutlinedIcon fontSize="small" />,
      },
      {
        label: 'Vehículos',
        icon: <DirectionsCarOutlinedIcon fontSize="small" />,
        disabled: true,
      },
      {
        label: 'Órdenes',
        to: '/app/work-orders',
        icon: <AssignmentOutlinedIcon fontSize="small" />,
      },
      {
        label: 'Caja',
        to: '/app/cash',
        icon: <AccountBalanceOutlinedIcon fontSize="small" />,
        roles: ['OWNER', 'ADMIN'],
      },
      {
        label: 'Usuarios',
        to: '/app/users',
        icon: <PeopleAltOutlinedIcon fontSize="small" />,
        roles: ['OWNER', 'ADMIN'],
      },
      {
        label: 'Reportes',
        to: '/app/reports',
        icon: <AssignmentOutlinedIcon fontSize="small" />,
        roles: ['OWNER', 'ADMIN'],
      },
      {
        label: 'Catálogo',
        to: '/app/catalog',
        icon: <AssignmentOutlinedIcon fontSize="small" />,
      },
      {
        label: 'Inventario',
        to: '/app/inventory',
        icon: <AssignmentOutlinedIcon fontSize="small" />,
      },
      {
        label: 'Compras',
        to: '/app/purchases',
        icon: <AssignmentOutlinedIcon fontSize="small" />,
      },
    ],
    [],
  );

  const visibleItems = navItems.filter((item) => {
    if (!item.roles) return true;
    if (!user) return false;
    return item.roles.includes(user.role);
  });

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 2.5, py: 2.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Taller Suite
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Panel del taller
        </Typography>
      </Box>
      <Divider />
      <List sx={{ px: 1.5, py: 1.5 }}>
        {visibleItems.map((item) => {
          const selected = item.to
            ? pathname.startsWith(item.to)
            : false;
          return (
            <ListItemButton
              key={item.label}
              component={item.to ? Link : 'div'}
              href={item.to ?? undefined}
              selected={selected}
              disabled={item.disabled}
              sx={{
                borderRadius: '6px',
                mb: 0.5,
                '&.Mui-selected': {
                  bgcolor: 'grey.100',
                  color: 'text.primary',
                },
                '&.Mui-selected .MuiListItemIcon-root': {
                  color: 'text.primary',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>
      <Box sx={{ mt: 'auto', px: 2.5, py: 2 }}>
        <Typography variant="caption" color="text.secondary">
          v0.1 • Taller Suite
        </Typography>
      </Box>
    </Box>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => setMobileOpen((prev) => !prev);

  return (
    <PageTitleProvider>
      <Box sx={{ display: 'flex', bgcolor: 'grey.50', minHeight: '100vh' }}>
        <AppTopBar onMenuToggle={handleDrawerToggle} />

        <Box component="nav" sx={{ width: { lg: drawerWidth }, flexShrink: { lg: 0 } }}>
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true }}
            sx={{
              display: { xs: 'block', lg: 'none' },
              '& .MuiDrawer-paper': { width: drawerWidth },
            }}
          >
            <AppSidebar />
          </Drawer>
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: 'none', lg: 'block' },
              '& .MuiDrawer-paper': {
                width: drawerWidth,
                boxSizing: 'border-box',
              },
            }}
            open
          >
            <AppSidebar />
          </Drawer>
        </Box>

        <Box component="main" sx={{ flexGrow: 1, pt: 9, px: { xs: 2, md: 3 } }}>
          <Container maxWidth="lg">
            {children}
          </Container>
        </Box>
      </Box>
    </PageTitleProvider>
  );
}

'use client';

import { Box, Container, Stack, Typography } from '@mui/material';

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'grey.50',
        display: 'flex',
        alignItems: 'center',
        py: { xs: 6, md: 10 },
      }}
    >
      <Container maxWidth="sm">
        <Stack spacing={1.5} sx={{ mb: 3, textAlign: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Taller Suite
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestión profesional para talleres mecánicos.
          </Typography>
        </Stack>
        {children}
      </Container>
    </Box>
  );
}

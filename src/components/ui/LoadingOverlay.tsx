import { Backdrop, CircularProgress, Typography } from '@mui/material';

type LoadingOverlayProps = {
  open: boolean;
  label?: string;
};

export function LoadingOverlay({ open, label }: LoadingOverlayProps) {
  return (
    <Backdrop
      open={open}
      sx={{
        color: '#fff',
        zIndex: (theme) => theme.zIndex.drawer + 2,
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <CircularProgress color="inherit" />
      {label && <Typography variant="body2">{label}</Typography>}
    </Backdrop>
  );
}

import { Paper, type PaperProps } from '@mui/material';

export function Panel({ sx, ...props }: PaperProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, md: 3 },
        borderRadius: '8px',
        border: '1px solid',
        borderColor: 'divider',
        ...sx,
      }}
      {...props}
    />
  );
}

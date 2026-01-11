import { Stack, type StackProps } from '@mui/material';

export function FormRow({ sx, ...props }: StackProps) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      sx={{ ...sx }}
      {...props}
    />
  );
}

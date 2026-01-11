import { Stack, type StackProps } from '@mui/material';

export function FormSection({ sx, ...props }: StackProps) {
  return (
    <Stack spacing={2} sx={{ ...sx }} {...props} />
  );
}

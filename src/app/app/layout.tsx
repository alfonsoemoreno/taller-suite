'use client';

import { AppLayout } from '../../layouts/AppLayout';
import { ProtectedRoute } from '../../auth/ProtectedRoute';

export default function AppLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

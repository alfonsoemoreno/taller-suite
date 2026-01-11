'use client';

import { AuthLayout } from '../../layouts/AuthLayout';
import { LoginPage } from '../LoginPage';

export default function Login() {
  return (
    <AuthLayout>
      <LoginPage />
    </AuthLayout>
  );
}

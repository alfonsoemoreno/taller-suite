'use client';

import { AccountView } from '@neondatabase/neon-js/auth/react/ui';
import { usePathname } from 'next/navigation';

export default function AccountPage() {
  const path = usePathname();
  const pathname = path?.split('/').filter(Boolean).pop() ?? 'profile';

  return <AccountView pathname={pathname} />;
}

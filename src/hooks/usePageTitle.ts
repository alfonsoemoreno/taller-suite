import { useEffect } from 'react';
import { usePageTitleContext } from '../layouts/PageTitleContext';

export function usePageTitle(title: string) {
  const { setTitle } = usePageTitleContext();

  useEffect(() => {
    setTitle(title);
  }, [setTitle, title]);
}

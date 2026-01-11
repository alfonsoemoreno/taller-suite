import { createContext, useContext, useMemo, useState } from 'react';

type PageTitleContextValue = {
  title: string;
  setTitle: (title: string) => void;
};

const PageTitleContext = createContext<PageTitleContextValue | undefined>(
  undefined,
);

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState('Panel');

  const value = useMemo(() => ({ title, setTitle }), [title]);

  return (
    <PageTitleContext.Provider value={value}>
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitleContext() {
  const context = useContext(PageTitleContext);
  if (!context) {
    throw new Error('usePageTitleContext debe usarse dentro de PageTitleProvider');
  }
  return context;
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DOJO WALK Admin',
  description: 'DOJO WALK operations and pricing administration',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body style={{ margin: 0, background: '#FFFDF9', color: '#263442' }}>{children}</body></html>;
}

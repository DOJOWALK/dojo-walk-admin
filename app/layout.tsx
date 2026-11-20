import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DOJO WALK Admin',
  description: 'DOJO WALK operations and pricing administration',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

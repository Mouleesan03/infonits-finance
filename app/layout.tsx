import type { Metadata, Viewport } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';
import { DeploymentRefresh } from '@/components/deployment-refresh';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  title: 'Infonits Finance',
  description: 'A clear view of your projects, payments and profit.',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const deploymentVersion =
    process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? 'local';
  return (
    <html lang="en" className={poppins.variable}>
      <body>
        <DeploymentRefresh version={deploymentVersion} />
        {children}
      </body>
    </html>
  );
}

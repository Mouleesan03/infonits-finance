import type { Metadata, Viewport } from 'next';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import './globals.css';
import { DeploymentRefresh } from '@/components/deployment-refresh';
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
    <html lang="en">
      <body>
        <DeploymentRefresh version={deploymentVersion} />
        {children}
      </body>
    </html>
  );
}

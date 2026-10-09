import { LocalCloudWorkspace } from '@/components/local-cloud-workspace';
import { configured, serverClient } from '@/lib/supabase/server';

export default async function LocalPage() {
  let email = '';
  if (configured()) {
    const db = await serverClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    email = user?.email ?? '';
  }
  return <LocalCloudWorkspace initialEmail={email} />;
}

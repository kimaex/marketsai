import { createFileRoute } from '@tanstack/react-router';
import { accountData, pageHead } from '@/lib/app-data';
import { Settings } from '@/components/app/Settings';
export const Route = createFileRoute('/_authenticated/settings')({
 loader: ({context}) => context.queryClient.ensureQueryData(accountData),
 head: () => pageHead('Settings', 'Manage your agent wallet and spending permissions.'),
 component: Settings,
});

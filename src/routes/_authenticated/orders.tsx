import { createFileRoute } from '@tanstack/react-router';
import { accountData, pageHead } from '@/lib/app-data';
import { Orders } from '@/components/app/Orders';
export const Route = createFileRoute('/_authenticated/orders')({
 loader: ({context}) => context.queryClient.ensureQueryData(accountData),
 head: () => pageHead('Orders', 'Track purchases, approvals, Celo payments and deliveries.'),
 component: Orders,
});

import { createFileRoute } from '@tanstack/react-router';
import { accountData, pageHead } from '@/lib/app-data';
import { Marketplace } from '@/components/app/Marketplace';
export const Route = createFileRoute('/_authenticated/marketplace')({
 loader: ({context}) => context.queryClient.ensureQueryData(accountData),
 head: () => pageHead('Marketplace', 'Browse live supplier listings and compare landed prices.'),
 component: Marketplace,
});

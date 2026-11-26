import { createFileRoute } from '@tanstack/react-router';
import { accountData, pageHead } from '@/lib/app-data';
import { SupplierPortal } from '@/components/app/SupplierPortal';
export const Route = createFileRoute('/_authenticated/supplier')({
 loader: ({context}) => context.queryClient.ensureQueryData(accountData),
 head: () => pageHead('Supplier', 'Manage your supplier business, products and orders.'),
 component: SupplierPortal,
});

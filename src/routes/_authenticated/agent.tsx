import { createFileRoute } from '@tanstack/react-router';
import { accountData, pageHead } from '@/lib/app-data';
import { AgentChat } from '@/components/app/AgentChat';
export const Route = createFileRoute('/_authenticated/agent')({
 loader: ({context}) => context.queryClient.ensureQueryData(accountData),
 head: () => pageHead('Agent', 'Your private procurement conversation with MarketMate AI.'),
 component: AgentChat,
});

'use client';

import { useAuthContext } from '@novaconnect/data';
import ChatInterface from '@/components/chat/ChatInterface';

export default function ParentChatPage() {
  const { user, profile } = useAuthContext();
  const schoolId = profile?.schoolId || profile?.school_id || (user as any)?.schoolId || (user as any)?.school_id;

  if (!user || !schoolId) {
    return (
      <div className="flex justify-center p-8">
        <div className="h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Messagerie Parents</h1>
        <p className="text-sm text-slate-500">Dialogue direct avec les professeurs de vos enfants et le personnel administratif.</p>
      </div>
      <ChatInterface userId={user.id} role="parent" schoolId={schoolId} />
    </div>
  );
}

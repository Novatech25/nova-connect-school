'use client';

import { useMemo } from 'react';
import { useAuthContext, useCurrentUser } from '@novaconnect/data';
import ChatInterface from '@/components/chat/ChatInterface';

export default function ChatClient() {
  const { user } = useAuthContext();
  const { data: profile } = useCurrentUser();

  const schoolId = useMemo(() => (
    profile?.school_id ||
    (user?.user_metadata as any)?.school_id ||
    (user as any)?.school_id
  ), [profile, user]);

  if (!user || !schoolId) return null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Messagerie (Chat)
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Discutez en temps réel avec les autres membres de l&apos;école.
        </p>
      </div>

      <ChatInterface 
        userId={user.id} 
        role="accountant" 
        schoolId={schoolId} 
      />
    </div>
  );
}

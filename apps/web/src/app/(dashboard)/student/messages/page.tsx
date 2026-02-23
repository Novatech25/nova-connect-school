'use client';

import { useMemo } from 'react';
import { useAuthContext } from '@novaconnect/data';
import { getSupabaseClient } from '@novaconnect/data/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChatBubbleLeftRightIcon,
  DocumentIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ClassMessage {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  sentAt: string;
  createdAt: string;
  attachmentUrl: string | null;
  sentBy: string;
  targetClassId: string | null;
  priority: string;
}

function useClassMessages(userId: string) {
  return useQuery({
    queryKey: ['class_messages', userId],
    queryFn: async (): Promise<ClassMessage[]> => {
      if (!userId) return [];
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'announcement')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return (data || []).map((n: any) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        readAt: n.read_at,
        sentAt: n.sent_at || n.created_at,
        createdAt: n.created_at,
        attachmentUrl: n.data?.attachment_url || null,
        sentBy: n.data?.sent_by || '',
        targetClassId: n.data?.target_class_id || null,
        priority: n.data?.priority || 'normal',
      }));
    },
    enabled: !!userId,
  });
}

function useMarkMessageRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .is('read_at', null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class_messages'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export default function StudentMessagesPage() {
  const { user } = useAuthContext();
  const userId = user?.id || '';

  const { data: messages, isLoading } = useClassMessages(userId);
  const markRead = useMarkMessageRead();

  const unreadCount = useMemo(() => messages?.filter((m) => !m.readAt).length ?? 0, [messages]);

  const handleMarkRead = (id: string, readAt: string | null) => {
    if (!readAt) {
      markRead.mutate(id);
    }
  };

  const priorityColor: Record<string, string> = {
    urgent: 'bg-red-100 text-red-700 border-red-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    normal: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-200">
            <ChatBubbleLeftRightIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Messages</h1>
            <p className="text-sm text-slate-500">Messages et documents de vos professeurs</p>
          </div>
        </div>
        {unreadCount > 0 && (
          <span className="inline-flex items-center rounded-full bg-indigo-600 px-3 py-1 text-sm font-semibold text-white shadow-sm">
            {unreadCount} non lu{unreadCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Liste des messages */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse flex gap-4">
                <div className="h-12 w-12 bg-slate-200 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-full" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : !messages || messages.length === 0 ? (
          <div className="p-16 text-center">
            <ChatBubbleLeftRightIcon className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <p className="text-base font-medium text-slate-400">Aucun message reçu</p>
            <p className="text-sm text-slate-300 mt-1">Vos professeurs n&apos;ont pas encore envoyé de message</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`px-6 py-5 hover:bg-slate-50 transition cursor-pointer ${!msg.readAt ? 'bg-indigo-50/40' : ''}`}
                onClick={() => handleMarkRead(msg.id, msg.readAt)}
              >
                <div className="flex items-start gap-4">
                  {/* Icône / indicateur non-lu */}
                  <div className={`flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-xl ${msg.readAt ? 'bg-slate-100' : 'bg-indigo-100'}`}>
                    <ChatBubbleLeftRightIcon className={`h-5 w-5 ${msg.readAt ? 'text-slate-400' : 'text-indigo-600'}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {!msg.readAt && (
                        <span className="h-2 w-2 rounded-full bg-indigo-500 flex-shrink-0" />
                      )}
                      <h3 className="text-sm font-semibold text-slate-900 truncate">{msg.title}</h3>
                      {msg.priority !== 'normal' && (
                        <span className={`inline-flex text-[10px] font-semibold rounded-full px-2 py-0.5 border ${priorityColor[msg.priority] || priorityColor.normal}`}>
                          {msg.priority === 'urgent' ? 'Urgent' : 'Important'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">{msg.body}</p>

                    {/* Pièce jointe PDF */}
                    {msg.attachmentUrl && (
                      <a
                        href={msg.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-3 inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 transition shadow-sm"
                      >
                        <DocumentIcon className="h-4 w-4 text-indigo-500" />
                        Voir le document PDF
                        <ArrowDownTrayIcon className="h-4 w-4 text-indigo-400" />
                      </a>
                    )}

                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-xs text-slate-400">
                        {formatDistanceToNow(new Date(msg.sentAt), { locale: fr, addSuffix: true })}
                      </span>
                      {msg.readAt && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircleIcon className="h-3.5 w-3.5" />
                          Lu
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

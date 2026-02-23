'use client';

import { useState, useRef, useEffect } from 'react';
import {
  useChatConversations,
  useChatMessages,
  useSendMessage,
  useMarkMessagesAsRead,
  useRealtimeChat,
  useDeleteMessage,
  useClearConversation,
  useBlockUser
} from '@novaconnect/data';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  PaperAirplaneIcon,
  ChatBubbleLeftIcon,
  PlusIcon,
  UserCircleIcon,
  ArrowLeftIcon,
  EllipsisVerticalIcon,
  TrashIcon,
  NoSymbolIcon
} from '@heroicons/react/24/outline';
import NewConversationModal from './NewConversationModal';

interface ChatInterfaceProps {
  userId: string;
  role: string;
  schoolId: string;
}

export default function ChatInterface({ userId, role, schoolId }: ChatInterfaceProps) {
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [isNewConvOpen, setIsNewConvOpen] = useState(false);
  
  // Queries
  const { data: conversations, isLoading: isLoadingConvs } = useChatConversations(userId);
  const { data: messages, isLoading: isLoadingMsgs } = useChatMessages(selectedConvId || '');
  const sendMessage = useSendMessage();
  const markAsRead = useMarkMessagesAsRead();
  const deleteMessage = useDeleteMessage();
  const clearConversation = useClearConversation();
  const blockUser = useBlockUser();

  // Menu States
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);
  
  // Realtime
  useRealtimeChat(selectedConvId || '');

  // Form
  const [content, setContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark messages as read when focusing a conversation
  useEffect(() => {
    if (selectedConvId) {
      markAsRead.mutate(selectedConvId);
    }
  }, [selectedConvId, messages?.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !selectedConvId) return;

    try {
      await sendMessage.mutateAsync({
        conversationId: selectedConvId,
        content: content.trim(),
      });
      setContent('');
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const selectedConversation = conversations?.find((c: any) => c.id === selectedConvId);

  const handleDeleteMessage = async (msgId: string) => {
    if (confirm('Voulez-vous vraiment supprimer ce message ?')) {
      try {
        await deleteMessage.mutateAsync(msgId);
        setMessageMenuId(null);
      } catch (err) {
        console.error('Error deleting message:', err);
      }
    }
  };

  const handleClearHistory = async () => {
    if (!selectedConvId) return;
    if (confirm('Voulez-vous vraiment vider votre historique pour cette conversation ?')) {
      try {
        await clearConversation.mutateAsync(selectedConvId);
        setSelectedConvId(null);
        setIsHeaderMenuOpen(false);
      } catch (err) {
        console.error('Error clearing conversation:', err);
      }
    }
  };

  const handleBlockUser = async (userIdToBlock: string) => {
    if (!selectedConvId) return;
    if (confirm('Voulez-vous vraiment bloquer cet utilisateur ? Il ne pourra plus envoyer de messages ici.')) {
      try {
        await blockUser.mutateAsync({ conversationId: selectedConvId, userId: userIdToBlock });
        setIsHeaderMenuOpen(false);
      } catch (err) {
        console.error('Error blocking user:', err);
      }
    }
  };

  // Format participant names for conversation title
  const getConversationTitle = (conv: any) => {
    if (!conv) return 'Conversation';
    if (conv.title) return conv.title;
    if (!conv.participants) return 'Conversation';
    
    const otherParticipants = conv.participants.filter((p: any) => p.user_id !== userId);
    if (otherParticipants.length === 0) return 'Notes personnelles (Vous)';
    
    return otherParticipants
      .map((p: any) => p.user?.first_name ? `${p.user.first_name} ${p.user.last_name}` : 'Utilisateur')
      .join(', ');
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] md:h-[calc(100vh-8rem)] bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative">
      {/* Sidebar - Conversations List */}
      <div className={`w-full md:w-80 border-r border-slate-200 flex flex-col bg-slate-50/50 absolute md:relative z-20 md:z-auto h-full transition-transform duration-300 ${selectedConvId ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <ChatBubbleLeftIcon className="h-5 w-5 text-indigo-500" />
            Messagerie
          </h2>
          <button
            onClick={() => setIsNewConvOpen(true)}
            className="p-2 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition"
            title="Nouvelle conversation"
          >
            <PlusIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto w-full">
          {isLoadingConvs ? (
            <div className="p-4 space-y-4 w-full">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse flex gap-3 w-full">
                  <div className="h-10 w-10 bg-slate-200 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2 w-full">
                    <div className="h-4 bg-slate-200 rounded w-1/2" />
                    <div className="h-3 bg-slate-100 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : conversations?.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <p className="text-sm">Aucune conversation</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 w-full">
              {conversations?.map((conv: any) => {
                const isActive = conv.id === selectedConvId;
                const title = getConversationTitle(conv);
                const lastMsg = conv.last_message;
                
                // Identify if unread for this user
                const me = conv.participants?.find((p: any) => p.user_id === userId);
                const unread = lastMsg && me && (!me.last_read_at || new Date(lastMsg.sent_at) > new Date(me.last_read_at));

                return (
                  <li key={conv.id} className="w-full">
                    <button
                      onClick={() => setSelectedConvId(conv.id)}
                      className={`w-full text-left p-4 hover:bg-slate-100 transition flex items-start gap-3 ${
                        isActive ? 'bg-indigo-50 hover:bg-indigo-50' : ''
                      }`}
                    >
                      <div className="h-10 w-10 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center overflow-hidden">
                        <UserCircleIcon className="h-8 w-8 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h3 className={`text-sm truncate ${unread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                            {title}
                          </h3>
                          {lastMsg && (
                            <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">
                              {formatDistanceToNow(new Date(lastMsg.sent_at), { locale: fr, addSuffix: false })}
                            </span>
                          )}
                        </div>
                        {lastMsg ? (
                          <p className={`text-xs truncate ${unread ? 'font-semibold text-indigo-600' : 'text-slate-500'}`}>
                            {lastMsg.sender_id === userId ? 'Vous: ' : ''}{lastMsg.content}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400 italic">Nouvelle conversation</p>
                        )}
                      </div>
                      {unread && <div className="h-2 w-2 rounded-full bg-indigo-500 flex-shrink-0 mt-1.5" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col bg-[url('/img/chat-bg.png')] bg-repeat bg-slate-50/50 w-full h-full absolute md:relative z-10 md:z-auto transition-transform duration-300 ${!selectedConvId ? 'translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
        {selectedConvId ? (
          <>
            {/* Header */}
            <div className="h-16 px-4 md:px-6 border-b border-slate-200 bg-white flex items-center justify-between shadow-sm z-10">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedConvId(null)}
                  className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full transition"
                >
                  <ArrowLeftIcon className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                    <UserCircleIcon className="h-6 w-6 text-slate-400" />
                  </div>
                  <h3 className="text-base md:text-lg font-semibold text-slate-800 truncate max-w-[200px] md:max-w-md">
                    {getConversationTitle(selectedConversation)}
                  </h3>
                </div>
              </div>
              <div className="relative">
                <button 
                  onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
                  className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition"
                >
                  <EllipsisVerticalIcon className="h-5 w-5" />
                </button>

                {isHeaderMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsHeaderMenuOpen(false)} 
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-100 z-20 py-1 flex flex-col">
                      <button
                        onClick={handleClearHistory}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <TrashIcon className="h-4 w-4" />
                        Vider l'historique
                      </button>
                      
                      {role === 'admin' && selectedConversation?.participants?.map((p: any) => (
                        p.user_id !== userId && (
                          <button
                            key={p.user_id}
                            onClick={() => handleBlockUser(p.user_id)}
                            className="w-full text-left px-4 py-2 text-sm text-amber-600 hover:bg-amber-50 flex items-center gap-2"
                          >
                            <NoSymbolIcon className="h-4 w-4" />
                            Bloquer {p.user?.first_name}
                          </button>
                        )
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {isLoadingMsgs ? (
                <div className="flex justify-center py-4">
                  <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages?.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  Envoyez un message pour commencer
                </div>
              ) : (
                messages?.slice().reverse().map((msg: any) => {
                  const isMe = msg.sender_id === userId;
                  
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group relative`}>
                      <div className={`flex flex-col max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                        {!isMe && (
                          <span className="text-xs text-slate-500 ml-2 mb-1">
                            {msg.sender?.first_name} {msg.sender?.last_name}
                          </span>
                        )}
                        <div className="flex items-center gap-2">
                          {isMe && (
                            <div className="relative">
                              <button 
                                onClick={() => setMessageMenuId(messageMenuId === msg.id ? null : msg.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
                              >
                                <EllipsisVerticalIcon className="h-4 w-4" />
                              </button>
                              
                              {messageMenuId === msg.id && (
                                <>
                                  <div className="fixed inset-0 z-10" onClick={() => setMessageMenuId(null)} />
                                  <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-lg border border-slate-100 z-20 overflow-hidden">
                                    <button
                                      onClick={() => handleDeleteMessage(msg.id)}
                                      className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                      <TrashIcon className="h-3 w-3" />
                                      Supprimer
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                          <div
                            className={`px-4 py-2.5 rounded-2xl ${
                              isMe
                                ? 'bg-indigo-600 text-white rounded-br-none'
                                : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'
                            }`}
                          >
                            <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400 px-1">
                          {format(new Date(msg.sent_at), 'HH:mm')}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <div className="p-3 md:p-4 bg-white border-t border-slate-200">
              <form onSubmit={handleSend} className="flex gap-2 md:gap-3">
                <input
                  type="text"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Écrivez votre message..."
                  className="flex-1 bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-full px-4 text-sm md:text-base md:px-5 py-2.5 md:py-3 transition outline-none"
                />
                <button
                  type="submit"
                  disabled={!content.trim() || sendMessage.isPending}
                  className="h-10 w-10 md:h-11 md:w-11 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-100 transition disabled:opacity-50 flex-shrink-0"
                >
                  <PaperAirplaneIcon className="h-4 w-4 md:h-5 md:w-5 -ml-0.5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="hidden md:flex flex-1 flex-col items-center justify-center text-slate-400">
            <ChatBubbleLeftIcon className="h-16 w-16 mb-4 text-slate-200" />
            <p>Sélectionnez une conversation ou créez-en une nouvelle</p>
          </div>
        )}
      </div>

      {isNewConvOpen && (
        <NewConversationModal
          userId={userId}
          schoolId={schoolId}
          onClose={() => setIsNewConvOpen(false)}
          onSuccess={(newConvId: string) => {
            setIsNewConvOpen(false);
            setSelectedConvId(newConvId);
          }}
        />
      )}
    </div>
  );
}

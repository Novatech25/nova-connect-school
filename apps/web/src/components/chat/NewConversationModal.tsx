'use client';

import { useState, useMemo } from 'react';
import { useUsers, useCreateConversation } from '@novaconnect/data';
import { XMarkIcon, MagnifyingGlassIcon, UserCircleIcon } from '@heroicons/react/24/outline';

interface NewConversationModalProps {
  userId: string;
  schoolId: string;
  onClose: () => void;
  onSuccess: (conversationId: string) => void;
}

export default function NewConversationModal({
  userId,
  schoolId,
  onClose,
  onSuccess,
}: NewConversationModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: users, isLoading } = useUsers(schoolId);
  const createConversation = useCreateConversation();

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    const lowerQuery = searchQuery.toLowerCase();
    
    // Filtre de base : exclure soi-même
    let list = (users as any[]).filter(u => u.id !== userId);

    // Contraintes métier :
    // - Étudiant : admin ou prof
    // - Parent : admin ou prof (plus tard filtrer par les profs de leurs enfants)
    // - Prof : admin, élèves, parents
    // - Admin : tout le monde
    // Pour l'instant on limite juste aux utilisateurs actifs
    list = list.filter(u => u.isActive !== false);

    if (lowerQuery) {
      list = list.filter(u => 
        (u.first_name?.toLowerCase().includes(lowerQuery) || '') || 
        (u.last_name?.toLowerCase().includes(lowerQuery) || '') ||
        (u.firstName?.toLowerCase().includes(lowerQuery) || '') || 
        (u.lastName?.toLowerCase().includes(lowerQuery) || '') ||
        (u.email?.toLowerCase().includes(lowerQuery) || '') ||
        (u.phone?.toLowerCase().includes(lowerQuery) || '')
      );
    }
    return list.slice(0, 50); // limiter l'affichage
  }, [users, searchQuery, userId]);

  const handleCreate = async (targetUser: any) => {
    try {
      const type = 'one_to_one';
      const title = ''; // Auto-généré par le nom des participants
      
      const conv = await createConversation.mutateAsync({
        schoolId: schoolId,
        conversationType: type as any,
        title,
        participantIds: [userId, targetUser.id],
      });
      
      onSuccess(conv.id);
    } catch (err) {
      console.error('Failed to create conversation', err);
      alert('Impossible de démarrer la conversation.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-semibold text-slate-800">Nouvelle discussion</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher une personne..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition text-sm text-slate-700 placeholder:text-slate-400"
              autoFocus
            />
          </div>
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center p-8 text-slate-400 text-sm">
              Aucun utilisateur trouvé
            </div>
          ) : (
            <ul className="space-y-1">
              {filteredUsers.map(user => (
                <li key={user.id}>
                  <button
                    onClick={() => handleCreate(user)}
                    disabled={createConversation.isPending}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition text-left disabled:opacity-50"
                  >
                    <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {(user.avatarUrl || user.avatar_url) ? (
                         <img src={user.avatarUrl || user.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <UserCircleIcon className="h-8 w-8 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">
                        {user.first_name || user.firstName} {user.last_name || user.lastName}
                      </h4>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{user.email}</p>
                      {user.phone && <p className="text-[10px] text-slate-400 truncate">{user.phone}</p>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

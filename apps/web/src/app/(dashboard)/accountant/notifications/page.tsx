'use client';

import { useMemo } from 'react';
import {
  useAuthContext,
  useBroadcastHistory,
  useBroadcastStats,
} from '@novaconnect/data';
import {
  BellIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  EnvelopeIcon,
  UsersIcon,
  EyeIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AccountantNotificationsPage() {
  const { user, profile } = useAuthContext();
  const accountantId = user?.id || '';
  const schoolId = profile?.schoolId || (user as any)?.schoolId || '';

  const { data: stats, isLoading: isLoadingStats } = useBroadcastStats(schoolId);
  const { data: history, isLoading: isLoadingHistory } = useBroadcastHistory(schoolId, 100);

  // Filtrer l'historique pour ce comptable uniquement
  const myMessages = useMemo(() => {
    if (!history) return [];
    return (history as any[]).filter((h: any) => h.sentBy === accountantId);
  }, [history, accountantId]);

  // Statistiques calculées à partir de l'historique du comptable
  const myStats = useMemo(() => {
    const total = myMessages.length;
    const totalRecipients = myMessages.reduce((sum: number, m: any) => sum + (m.recipientCount || 0), 0);
    const totalRead = myMessages.reduce((sum: number, m: any) => sum + (m.readCount || 0), 0);
    const readRate = totalRecipients > 0 ? Math.round((totalRead / totalRecipients) * 100) : 0;

    // Messages ce mois-ci
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const thisMonth = myMessages.filter((m: any) => new Date(m.sentAt) >= startOfMonth).length;

    // Par type de cible
    const byTarget: Record<string, number> = {};
    myMessages.forEach((m: any) => {
      const t = m.targetType || 'all';
      byTarget[t] = (byTarget[t] || 0) + 1;
    });

    return { total, totalRecipients, totalRead, readRate, thisMonth, byTarget };
  }, [myMessages]);

  const targetLabels: Record<string, string> = {
    all: 'Toute l\'école',
    class: 'Classe spécifique',
    students: 'Étudiants',
    parents: 'Parents',
    teachers: 'Enseignants',
    individual: 'Individuel',
  };

  const isLoading = isLoadingStats || isLoadingHistory;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-200">
          <BellIcon className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Mes Notifications</h1>
          <p className="text-sm text-slate-500">Statistiques détaillées de vos communications</p>
        </div>
      </div>

      {/* Cartes de Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Messages */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Messages envoyés</p>
              {isLoading ? (
                <div className="mt-2 h-8 w-16 animate-pulse rounded bg-slate-200" />
              ) : (
                <p className="mt-1 text-3xl font-bold text-slate-900">{myStats.total}</p>
              )}
            </div>
            <div className="rounded-xl bg-blue-50 p-3">
              <MegaphoneIcon className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">{myStats.thisMonth} ce mois-ci</p>
        </div>

        {/* Total Destinataires */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Destinataires touchés</p>
              {isLoading ? (
                <div className="mt-2 h-8 w-16 animate-pulse rounded bg-slate-200" />
              ) : (
                <p className="mt-1 text-3xl font-bold text-slate-900">{myStats.totalRecipients}</p>
              )}
            </div>
            <div className="rounded-xl bg-green-50 p-3">
              <UsersIcon className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">Notifications individuelles générées</p>
        </div>

        {/* Total Lus */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Messages lus</p>
              {isLoading ? (
                <div className="mt-2 h-8 w-16 animate-pulse rounded bg-slate-200" />
              ) : (
                <p className="mt-1 text-3xl font-bold text-emerald-600">{myStats.totalRead}</p>
              )}
            </div>
            <div className="rounded-xl bg-emerald-50 p-3">
              <EyeIcon className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">sur {myStats.totalRecipients} envoyés</p>
        </div>

        {/* Taux de lecture */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Taux de lecture</p>
              {isLoading ? (
                <div className="mt-2 h-8 w-16 animate-pulse rounded bg-slate-200" />
              ) : (
                <p className="mt-1 text-3xl font-bold text-orange-600">{myStats.readRate}%</p>
              )}
            </div>
            <div className="rounded-xl bg-orange-50 p-3">
              <ChartBarIcon className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          {/* Mini barre de progression */}
          <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-500"
              style={{ width: `${myStats.readRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Répartition par cible */}
      {Object.keys(myStats.byTarget).length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-4">
            <EnvelopeIcon className="h-5 w-5 text-slate-400" />
            Répartition par cible
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(myStats.byTarget).map(([target, count]) => (
              <div key={target} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
                <p className="text-2xl font-bold text-slate-900">{count}</p>
                <p className="text-xs text-slate-500 mt-1">{targetLabels[target] || target}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats globales de l'école */}
      {stats && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-4">
            <ChartBarIcon className="h-5 w-5 text-slate-400" />
            Statistiques globales de l'école
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.totalBroadcasts}</p>
              <p className="text-xs text-slate-500 mt-1">Diffusions totales</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.totalSent}</p>
              <p className="text-xs text-slate-500 mt-1">Notifications envoyées</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600">{stats.totalRead}</p>
              <p className="text-xs text-slate-500 mt-1">Notifications lues</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{stats.sentThisMonth}</p>
              <p className="text-xs text-slate-500 mt-1">Diffusions ce mois</p>
            </div>
          </div>
        </div>
      )}

      {/* Historique détaillé */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <ClockIcon className="h-5 w-5 text-slate-400" />
            Historique de vos envois
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Détail de chaque message envoyé</p>
        </div>

        {isLoadingHistory ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex gap-4 items-center">
                <div className="h-10 w-10 bg-slate-200 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-1/2" />
                  <div className="h-3 bg-slate-100 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : myMessages.length === 0 ? (
          <div className="p-12 text-center">
            <BellIcon className="h-12 w-12 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Aucun message envoyé pour le moment</p>
            <p className="text-xs text-slate-300 mt-1">Envoyez des notifications depuis la page Messages</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {myMessages.map((msg: any) => {
              const readRate = msg.recipientCount > 0 ? Math.round((msg.readCount / msg.recipientCount) * 100) : 0;
              return (
                <div key={msg.id} className="px-6 py-5 hover:bg-slate-50 transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-slate-900 truncate">{msg.title}</h4>
                        <span className={`flex-shrink-0 inline-flex text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                          msg.targetType === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {targetLabels[msg.targetType] || msg.targetType}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2">{msg.body}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-slate-400">
                        {msg.sentAt ? format(new Date(msg.sentAt), 'dd MMM yyyy HH:mm', { locale: fr }) : '—'}
                      </p>
                      <p className="text-[10px] text-slate-300 mt-0.5">
                        {msg.sentAt ? formatDistanceToNow(new Date(msg.sentAt), { locale: fr, addSuffix: true }) : ''}
                      </p>
                    </div>
                  </div>

                  {/* Barre de stats */}
                  <div className="mt-3 flex items-center gap-4">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <UsersIcon className="h-3.5 w-3.5" />
                      {msg.recipientCount} destinataire{msg.recipientCount > 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-emerald-600 flex items-center gap-1">
                      <CheckCircleIcon className="h-3.5 w-3.5" />
                      {msg.readCount} lu{msg.readCount > 1 ? 's' : ''}
                    </span>
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-xs font-medium text-slate-600">{readRate}%</span>
                      <div className="h-1.5 w-24 rounded-full bg-slate-100">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ${
                            readRate >= 75 ? 'bg-emerald-500' : readRate >= 40 ? 'bg-orange-400' : 'bg-red-400'
                          }`}
                          style={{ width: `${readRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

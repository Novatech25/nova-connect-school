'use client';

import { useState, useMemo } from 'react';
import { useAuthContext } from '@novaconnect/data';
import {
  useBroadcastHistory,
  useBroadcastStats,
  useRecipientsList,
  useMessagingClasses,
  useSendBroadcast,
} from '@novaconnect/data';
import type { BroadcastTargetType, BroadcastChannel } from '@novaconnect/data';
import { useToast } from '@/hooks/use-toast';
import {
  MegaphoneIcon,
  PaperAirplaneIcon,
  UsersIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  BellIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  AcademicCapIcon,
  UserGroupIcon,
  FunnelIcon,
  ChatBubbleLeftRightIcon,
  EyeIcon,
  GlobeAmericasIcon,
  HomeModernIcon,
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const TARGET_OPTIONS: { value: BroadcastTargetType; label: string; icon: typeof UsersIcon; description: string }[] = [
  { value: 'all', label: 'Tout le monde', icon: GlobeAmericasIcon, description: 'Professeurs, étudiants et parents' },
  { value: 'teachers', label: 'Professeurs', icon: AcademicCapIcon, description: 'Tous les enseignants de l\'école' },
  { value: 'students', label: 'Étudiants', icon: UserGroupIcon, description: 'Tous les élèves actifs' },
  { value: 'parents', label: 'Parents', icon: HomeModernIcon, description: 'Tous les parents d\'élèves' },
  { value: 'class', label: 'Par classe', icon: FunnelIcon, description: 'Étudiants d\'une classe spécifique' },
  { value: 'individual', label: 'Individuel', icon: UsersIcon, description: 'Sélection manuelle' },
];

const CHANNEL_OPTIONS: { value: BroadcastChannel; label: string; icon: typeof BellIcon; color: string }[] = [
  { value: 'in_app', label: 'Notification', icon: BellIcon, color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { value: 'email', label: 'Email', icon: EnvelopeIcon, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'sms', label: 'SMS', icon: DevicePhoneMobileIcon, color: 'bg-amber-100 text-amber-700 border-amber-200' },
];

const PRIORITY_OPTIONS = [
  { value: 'normal', label: 'Normale', color: 'bg-slate-100 text-slate-700' },
  { value: 'high', label: 'Haute', color: 'bg-orange-100 text-orange-700' },
  { value: 'urgent', label: 'Urgente', color: 'bg-red-100 text-red-700' },
] as const;

export default function MessagingPage() {
  const { user, profile } = useAuthContext();
  const schoolId = profile?.schoolId || user?.schoolId || '';
  const userId = user?.id || '';
  const { toast } = useToast();

  // ── Form State ──────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState<BroadcastTargetType>('all');
  const [targetClassId, setTargetClassId] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [channels, setChannels] = useState<BroadcastChannel[]>(['in_app']);
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [recipientSearch, setRecipientSearch] = useState('');

  // ── Data Hooks ──────────────────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = useBroadcastStats(schoolId);
  const { data: history, isLoading: historyLoading } = useBroadcastHistory(schoolId, 20);
  const { data: classes } = useMessagingClasses(schoolId);
  const { data: recipients } = useRecipientsList(
    schoolId,
    targetType === 'individual' ? 'all' : targetType,
    targetType === 'class' ? targetClassId : undefined
  );
  const sendBroadcast = useSendBroadcast();

  // ── Derived ─────────────────────────────────────────────────────────────
  const filteredRecipients = useMemo(() => {
    if (!recipients || !recipientSearch) return recipients || [];
    const q = recipientSearch.toLowerCase();
    return recipients.filter((r) =>
      r.label.toLowerCase().includes(q) || r.role.toLowerCase().includes(q) || (r.className || '').toLowerCase().includes(q)
    );
  }, [recipients, recipientSearch]);

  const readRate = stats && stats.totalSent > 0
    ? Math.round((stats.totalRead / stats.totalSent) * 100)
    : 0;

  // ── Handlers ────────────────────────────────────────────────────────────
  const toggleChannel = (ch: BroadcastChannel) => {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const toggleRecipient = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const canSend =
    title.trim().length >= 3 &&
    body.trim().length >= 5 &&
    channels.length > 0 &&
    (targetType !== 'class' || targetClassId) &&
    (targetType !== 'individual' || selectedUserIds.length > 0);

  const handleSend = async () => {
    if (!canSend) return;

    try {
      const result = await sendBroadcast.mutateAsync({
        schoolId,
        title: title.trim(),
        body: body.trim(),
        targetType,
        targetClassId: targetType === 'class' ? targetClassId : undefined,
        targetUserIds: targetType === 'individual' ? selectedUserIds : undefined,
        channels,
        priority,
        sentBy: userId,
      });

      toast({
        title: 'Message envoyé !',
        description: `${result.recipientCount} destinataire${result.recipientCount > 1 ? 's' : ''} atteint${result.recipientCount > 1 ? 's' : ''}.`,
        className: 'bg-emerald-600 text-white',
      });

      // Reset form
      setTitle('');
      setBody('');
      setSelectedUserIds([]);
      setTargetClassId('');
      setRecipientSearch('');
    } catch (error: any) {
      toast({
        title: 'Erreur d\'envoi',
        description: error.message || 'Une erreur est survenue.',
        variant: 'destructive',
      });
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-200">
            <MegaphoneIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Diffusion &amp; Messages</h1>
            <p className="text-sm text-slate-500">Envoyez des messages ciblés à vos professeurs et étudiants</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          icon={ChatBubbleLeftRightIcon}
          label="Messages ce mois"
          value={stats?.sentThisMonth || 0}
          subtitle="Ce mois"
          color="indigo"
          loading={statsLoading}
        />
        <KpiCard
          icon={EyeIcon}
          label="Taux de lecture"
          value={`${readRate}%`}
          subtitle="Notifications lues"
          color="emerald"
          loading={statsLoading}
        />
        <KpiCard
          icon={UserGroupIcon}
          label="Destinataires atteints"
          value={stats?.totalRecipients || 0}
          subtitle="Total atteints"
          color="blue"
          loading={statsLoading}
        />
        <KpiCard
          icon={PaperAirplaneIcon}
          label="Total messages"
          value={stats?.totalBroadcasts || 0}
          subtitle="Historique complet"
          color="purple"
          loading={statsLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Compose Card ─────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <PaperAirplaneIcon className="h-5 w-5 text-indigo-500" />
                Nouveau message
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">Composez et envoyez un message à votre audience</p>
            </div>

            <div className="p-6 space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Titre du message</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex : Réunion parents-professeurs le 25 février"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition outline-none"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Contenu du message</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  placeholder="Rédigez le contenu de votre message ici..."
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition outline-none resize-none"
                />
                <p className="mt-1 text-xs text-slate-400">{body.length} / 1000 caractères</p>
              </div>

              {/* Target Audience */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Audience cible</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {TARGET_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const active = targetType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setTargetType(opt.value);
                          setSelectedUserIds([]);
                          setTargetClassId('');
                        }}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 text-xs font-medium transition-all ${
                          active
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className={`h-5 w-5 ${active ? 'text-indigo-500' : 'text-slate-400'}`} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Class selector */}
              {targetType === 'class' && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Sélectionner la classe</label>
                  <select
                    value={targetClassId}
                    onChange={(e) => setTargetClassId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition outline-none"
                  >
                    <option value="">-- Choisir une classe --</option>
                    {(classes || []).map((cls: any) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} {cls.grade ? `(${cls.grade})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Individual selector */}
              {targetType === 'individual' && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-3">
                  <label className="block text-sm font-medium text-slate-700">Sélectionner les destinataires</label>
                  <input
                    type="text"
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    placeholder="Rechercher un nom..."
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition outline-none"
                  />
                  {selectedUserIds.length > 0 && (
                    <p className="text-xs text-indigo-600 font-medium">{selectedUserIds.length} sélectionné{selectedUserIds.length > 1 ? 's' : ''}</p>
                  )}
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                    {filteredRecipients.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-slate-400 text-center">Aucun résultat</p>
                    ) : (
                      filteredRecipients.slice(0, 50).map((r) => (
                        <label
                          key={r.id}
                          className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition"
                        >
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(r.id)}
                            onChange={() => toggleRecipient(r.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{r.label}</p>
                            <p className="text-xs text-slate-400">
                              {r.role === 'teacher' ? 'Professeur' : 'Étudiant'}
                              {r.className ? ` · ${r.className}` : ''}
                            </p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Channels */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Canaux d&apos;envoi</label>
                <div className="flex flex-wrap gap-2">
                  {CHANNEL_OPTIONS.map((ch) => {
                    const Icon = ch.icon;
                    const active = channels.includes(ch.value);
                    return (
                      <button
                        key={ch.value}
                        type="button"
                        onClick={() => toggleChannel(ch.value)}
                        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                          active
                            ? ch.color + ' shadow-sm'
                            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {ch.label}
                        {active && (
                          <span className="ml-1 text-xs">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {channels.length === 0 && (
                  <p className="mt-1 text-xs text-red-500">Sélectionnez au moins un canal</p>
                )}
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Priorité</label>
                <div className="flex gap-2">
                  {PRIORITY_OPTIONS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPriority(p.value)}
                      className={`rounded-full px-4 py-2 text-sm font-medium border transition-all ${
                        priority === p.value
                          ? p.color + ' border-current shadow-sm'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Send Button */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-400">
                  {targetType === 'all' && 'Envoi à tous les professeurs et étudiants'}
                  {targetType === 'teachers' && 'Envoi à tous les professeurs'}
                  {targetType === 'students' && 'Envoi à tous les étudiants'}
                  {targetType === 'class' && (targetClassId ? 'Envoi aux étudiants de la classe sélectionnée' : 'Sélectionnez une classe')}
                  {targetType === 'individual' && `${selectedUserIds.length} destinataire${selectedUserIds.length !== 1 ? 's' : ''} sélectionné${selectedUserIds.length !== 1 ? 's' : ''}`}
                </p>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canSend || sendBroadcast.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendBroadcast.isPending ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <PaperAirplaneIcon className="h-4 w-4" />
                      Envoyer le message
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── History Card ─────────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <ClockIcon className="h-5 w-5 text-slate-400" />
                Historique
              </h2>
            </div>

            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {historyLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : !history || history.length === 0 ? (
                <div className="p-8 text-center">
                  <MegaphoneIcon className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">Aucun message envoyé</p>
                  <p className="text-xs text-slate-300 mt-1">Vos diffusions apparaîtront ici</p>
                </div>
              ) : (
                history.map((msg) => (
                  <div key={msg.id} className="px-5 py-4 hover:bg-slate-50 transition">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-800 line-clamp-1">{msg.title}</h4>
                      <TargetBadge type={msg.targetType} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{msg.body}</p>
                    <div className="flex items-center gap-3 mt-2.5">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <UsersIcon className="h-3 w-3" />
                        {msg.recipientCount}
                      </span>
                      <span className="text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircleIcon className="h-3 w-3" />
                        {msg.readCount} lu{msg.readCount > 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-slate-400 ml-auto">
                        {formatDistanceToNow(new Date(msg.sentAt), { locale: fr, addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex gap-1 mt-2">
                      {msg.channels.map((ch) => (
                        <ChannelBadge key={ch} channel={ch} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color,
  loading,
}: {
  icon: typeof ChartBarIcon;
  label: string;
  value: string | number;
  subtitle: string;
  color: string;
  loading: boolean;
}) {
  const colors: Record<string, string> = {
    indigo: 'from-indigo-500 to-indigo-600',
    emerald: 'from-emerald-500 to-emerald-600',
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
      <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${colors[color] || colors.indigo} shadow-md`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div>
        {loading ? (
          <div className="animate-pulse h-7 bg-slate-200 rounded w-16 mb-1" />
        ) : (
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        )}
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-[10px] text-slate-400">{subtitle}</p>
      </div>
    </div>
  );
}

function TargetBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string } | undefined> = {
    all: { label: 'Tous', cls: 'bg-slate-100 text-slate-600' },
    teachers: { label: 'Profs', cls: 'bg-blue-100 text-blue-700' },
    students: { label: 'Élèves', cls: 'bg-emerald-100 text-emerald-700' },
    class: { label: 'Classe', cls: 'bg-purple-100 text-purple-700' },
    individual: { label: 'Individuel', cls: 'bg-amber-100 text-amber-700' },
  };
  const info = map[type] ?? map.all!;
  return (
    <span className={`inline-flex text-[10px] font-semibold rounded-full px-2 py-0.5 ${info.cls}`}>
      {info.label}
    </span>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  const map: Record<string, { label: string; cls: string } | undefined> = {
    in_app: { label: 'App', cls: 'bg-indigo-50 text-indigo-600' },
    email: { label: 'Email', cls: 'bg-emerald-50 text-emerald-600' },
    sms: { label: 'SMS', cls: 'bg-amber-50 text-amber-600' },
  };
  const info = map[channel] ?? { label: channel, cls: 'bg-slate-50 text-slate-500' };
  return (
    <span className={`inline-flex text-[10px] font-medium rounded-md px-1.5 py-0.5 ${info.cls}`}>
      {info.label}
    </span>
  );
}

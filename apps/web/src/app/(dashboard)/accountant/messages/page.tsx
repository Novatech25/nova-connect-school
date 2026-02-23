'use client';

import { useState, useMemo, useRef } from 'react';
import {
  useAuthContext,
  useClasses,
  useSendBroadcast,
  useBroadcastHistory,
  useCurrentAcademicYear,
} from '@novaconnect/data';
import { getSupabaseClient } from '@novaconnect/data/client';
import { useToast } from '@/hooks/use-toast';
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  ClockIcon,
  DocumentIcon,
  XMarkIcon,
  CheckCircleIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AccountantMessagesPage() {
  const { user, profile } = useAuthContext();
  const accountantId = user?.id || '';
  const schoolId = profile?.schoolId || (user as any)?.schoolId || '';
  const { toast } = useToast();

  // --- Form State ---
  const [targetType, setTargetType] = useState<'all' | 'class'>('all');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Data Hooks ---
  const { data: academicYear } = useCurrentAcademicYear(schoolId);
  // Récupérer toutes les classes de l'école pour le comptable
  const { data: schoolClasses, isLoading: isLoadingClasses } = useClasses(
    schoolId,
    academicYear?.id
  );
  const { data: history, isLoading: isLoadingHistory } = useBroadcastHistory(schoolId, 50);
  const sendBroadcast = useSendBroadcast();

  // Mettre en forme la liste des classes
  const classesList = useMemo(() => {
    if (!schoolClasses) return [];
    return [...(schoolClasses as any[])].sort((a, b) => a.name.localeCompare(b.name));
  }, [schoolClasses]);

  // Filtrer l'historique pour ce comptable
  const myHistory = useMemo(() => {
    if (!history) return [];
    return (history as any[]).filter((h: any) => {
      const sentBy = h.sentBy;
      return sentBy === accountantId && (h.messageType === 'accountant_message' || h.messageType === 'financial');
    });
  }, [history, accountantId]);

  const canSend =
    (targetType === 'all' || (targetType === 'class' && selectedClassId.length > 0)) &&
    title.trim().length >= 3 &&
    body.trim().length >= 5 &&
    !sendBroadcast.isPending &&
    !isUploading;

  // --- Upload PDF ---
  const uploadPdf = async (file: File): Promise<string | null> => {
    try {
      const supabase = getSupabaseClient();
      const fileName = `${accountantId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { data, error } = await supabase.storage
        .from('school-documents') // Utilisation du bucket documents école global
        .upload(fileName, file, { contentType: 'application/pdf', upsert: false });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('school-documents').getPublicUrl(data.path);
      return urlData.publicUrl;
    } catch (err: any) {
      toast({ title: 'Erreur upload', description: err.message, variant: 'destructive' });
      return null;
    }
  };

  // --- Send ---
  const handleSend = async () => {
    if (!canSend) return;
    setIsUploading(true);
    let attachmentUrl: string | undefined;

    try {
      // 1. Upload PDF si présent
      if (pdfFile) {
        const url = await uploadPdf(pdfFile);
        if (!url) { setIsUploading(false); return; }
        attachmentUrl = url;
      }

      // 2. Envoyer via broadcast
      const result = await sendBroadcast.mutateAsync({
        schoolId,
        title: title.trim(),
        body: body.trim(),
        targetType,
        targetClassId: targetType === 'class' ? selectedClassId : undefined,
        channels: ['in_app', 'email'], // Les comptables n'ont pas forcément accès au push par défaut dans le broadcast, utilisons in_app + email
        priority: 'high',
        sentBy: accountantId,
        attachmentUrl,
        messageType: 'announcement',
      });

      toast({
        title: 'Message de Comptabilité envoyé !',
        description: `${result.recipientCount} destinataire${result.recipientCount > 1 ? 's' : ''} notifié${result.recipientCount > 1 ? 's' : ''}.`,
        className: 'bg-emerald-600 text-white',
      });

      // Reset form
      setTitle('');
      setBody('');
      setPdfFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      toast({ title: "Erreur d'envoi", description: err.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-200">
          <ChatBubbleLeftRightIcon className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Communication Comptable</h1>
          <p className="text-sm text-slate-500">Diffusez des circulaires, rappels et bilans financiers.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Compose ──────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <PaperAirplaneIcon className="h-5 w-5 text-orange-500" />
                Nouveau message de diffusion
              </h2>
            </div>

            <div className="p-6 space-y-5">
              {/* Type de Cible */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Ciblage de l'envoi
                </label>
                <div className="flex gap-4">
                  <label className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 p-4 cursor-pointer hover:bg-slate-50 transition">
                    <input
                      type="radio"
                      name="targetType"
                      value="all"
                      checked={targetType === 'all'}
                      onChange={() => setTargetType('all')}
                      className="h-4 w-4 border-gray-300 text-orange-600 focus:ring-orange-600"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-900">À toute l'école</span>
                      <span className="text-xs text-slate-500">Avis généraux (rentrée, fermeture...)</span>
                    </div>
                  </label>
                  <label className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 p-4 cursor-pointer hover:bg-slate-50 transition">
                    <input
                      type="radio"
                      name="targetType"
                      value="class"
                      checked={targetType === 'class'}
                      onChange={() => setTargetType('class')}
                      className="h-4 w-4 border-gray-300 text-orange-600 focus:ring-orange-600"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-900">À une classe unique</span>
                      <span className="text-xs text-slate-500">Ex: Sortie pédagogique, Frais spécifiques</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Sélecteur de Classe conditionnel */}
              {targetType === 'class' && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Sélectionnez la classe
                  </label>
                  {isLoadingClasses ? (
                    <div className="h-12 bg-slate-100 animate-pulse rounded-xl" />
                  ) : (
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition outline-none"
                    >
                      <option value="">-- Choisir une classe --</option>
                      {classesList.map((cls) => (
                         <option key={cls.id} value={cls.id}>{cls.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Titre */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Objet de la communication
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  placeholder="Ex : Nouvelle note concernant les tenues de sport"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition outline-none"
                />
              </div>

              {/* Contenu */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Contenu du message
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  placeholder="Rédigez votre message ici..."
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition outline-none resize-none"
                />
                <p className="mt-1 text-xs text-slate-400">{body.length} / 2000 caractères</p>
              </div>

              {/* Pièce jointe PDF */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Document Administratif (PDF)
                </label>
                {pdfFile ? (
                  <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
                    <DocumentIcon className="h-5 w-5 text-orange-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-orange-900 truncate">{pdfFile.name}</p>
                      <p className="text-xs text-orange-500">{(pdfFile.size / 1024).toFixed(0)} Ko</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setPdfFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="flex-shrink-0 text-orange-400 hover:text-red-500 transition"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 transition w-full"
                  >
                    <PaperClipIcon className="h-5 w-5" />
                    Joindre un pdf (Circulaire, Grille Tarifaire...)
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 20 * 1024 * 1024) {
                        toast({ title: 'Fichier trop grand', description: 'Maximum 20 Mo', variant: 'destructive' });
                        return;
                      }
                      setPdfFile(file);
                    }
                  }}
                />
              </div>

              {/* Send button */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-400">
                  {targetType === 'all' ? 'Envoi massif à tous les parents/élèves' : 'Envoi aux élèves de la classe sélectionnée'}
                </p>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canSend}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-200 hover:from-orange-700 hover:to-amber-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading || sendBroadcast.isPending ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Envoi...
                    </>
                  ) : (
                    <>
                      <PaperAirplaneIcon className="h-4 w-4" />
                      Distribuer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Historique ────────────────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <ClockIcon className="h-5 w-5 text-slate-400" />
                Vos derniers messages
              </h2>
            </div>

            <div className="divide-y divide-slate-100 max-h-[550px] overflow-y-auto">
              {isLoadingHistory ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : myHistory.length === 0 ? (
                <div className="p-8 text-center">
                  <ChatBubbleLeftRightIcon className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">Aucun message envoyé</p>
                  <p className="text-xs text-slate-300 mt-1">L'historique des diffusions apparaîtra ici</p>
                </div>
              ) : (
                myHistory.map((msg: any) => (
                  <div key={msg.id} className="px-5 py-4 hover:bg-slate-50 transition">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-slate-800 line-clamp-1">{msg.title}</h4>
                      <span className={`flex-shrink-0 inline-flex text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                        msg.targetType === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {msg.targetType === 'all' ? 'Général' : 'Classe'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2">{msg.body}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <UsersIcon className="h-3 w-3" />
                        {msg.recipientCount} destinataire(s)
                      </span>
                      <span className="text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircleIcon className="h-3 w-3" />
                        {msg.readCount} lu(s)
                      </span>
                      <span className="text-xs text-slate-400 ml-auto">
                        {formatDistanceToNow(new Date(msg.sentAt), { locale: fr, addSuffix: true })}
                      </span>
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

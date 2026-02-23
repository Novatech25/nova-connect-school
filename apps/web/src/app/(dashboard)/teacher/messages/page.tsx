'use client';

import { useState, useMemo, useRef } from 'react';
import {
  useAuthContext,
  useTeacherAssignmentsByTeacher,
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

export default function TeacherMessagesPage() {
  const { user, profile } = useAuthContext();
  const teacherId = user?.id || '';
  const schoolId = profile?.schoolId || (user as any)?.schoolId || '';
  const { toast } = useToast();

  // --- Form State ---
  const [selectedClassId, setSelectedClassId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Data Hooks ---
  const { data: academicYear } = useCurrentAcademicYear(schoolId);
  const { data: assignments, isLoading: isLoadingAssignments } = useTeacherAssignmentsByTeacher(
    teacherId,
    academicYear?.id
  );
  const { data: history, isLoading: isLoadingHistory } = useBroadcastHistory(schoolId, 50);
  const sendBroadcast = useSendBroadcast();

  // Extraire les classes uniques depuis les assignments
  const myClasses = useMemo(() => {
    if (!assignments) return [];
    const seen = new Set<string>();
    const classes: { id: string; name: string }[] = [];
    (assignments as any[]).forEach((a: any) => {
      const cls = a.class || a.classes;
      if (cls?.id && !seen.has(cls.id)) {
        seen.add(cls.id);
        classes.push({ id: cls.id, name: cls.name });
      }
    });
    return classes.sort((a, b) => a.name.localeCompare(b.name));
  }, [assignments]);

  // Filtrer l'historique pour ce professeur uniquement
  const myHistory = useMemo(() => {
    if (!history) return [];
    return (history as any[]).filter((h: any) => {
      const sentBy = h.sentBy;
      return sentBy === teacherId;
    });
  }, [history, teacherId]);

  const canSend =
    selectedClassId.length > 0 &&
    title.trim().length >= 3 &&
    body.trim().length >= 5 &&
    !sendBroadcast.isPending &&
    !isUploading;

  // --- Upload PDF ---
  const uploadPdf = async (file: File): Promise<string | null> => {
    try {
      const supabase = getSupabaseClient();
      const fileName = `${teacherId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { data, error } = await supabase.storage
        .from('class-documents')
        .upload(fileName, file, { contentType: 'application/pdf', upsert: false });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('class-documents').getPublicUrl(data.path);
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
        targetType: 'class',
        targetClassId: selectedClassId,
        channels: ['in_app'],
        priority: 'normal',
        sentBy: teacherId,
        attachmentUrl,
        messageType: 'class_message',
      });

      toast({
        title: 'Message envoyé !',
        description: `${result.recipientCount} élève${result.recipientCount > 1 ? 's' : ''} notifié${result.recipientCount > 1 ? 's' : ''}.`,
        className: 'bg-emerald-600 text-white',
      });

      // Reset form
      setTitle('');
      setBody('');
      setPdfFile(null);
      setSelectedClassId('');
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
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-200">
          <ChatBubbleLeftRightIcon className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Messages aux classes</h1>
          <p className="text-sm text-slate-500">Envoyez des messages et documents à vos classes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Compose ──────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <PaperAirplaneIcon className="h-5 w-5 text-indigo-500" />
                Nouveau message
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">Composez un message pour une classe</p>
            </div>

            <div className="p-6 space-y-5">
              {/* Classe */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Classe destinataire
                </label>
                {isLoadingAssignments ? (
                  <div className="h-12 bg-slate-100 animate-pulse rounded-xl" />
                ) : myClasses.length === 0 ? (
                  <p className="text-sm text-slate-400 italic py-3 px-4 bg-slate-50 rounded-xl border border-slate-200">
                    Aucune classe assignée. Contactez l'administrateur.
                  </p>
                ) : (
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition outline-none"
                  >
                    <option value="">-- Choisir une classe --</option>
                    {myClasses.map((cls) => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Titre */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Titre du message
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  placeholder="Ex : Devoir de mathématiques pour vendredi"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition outline-none"
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
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition outline-none resize-none"
                />
                <p className="mt-1 text-xs text-slate-400">{body.length} / 2000 caractères</p>
              </div>

              {/* Pièce jointe PDF */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Document PDF (optionnel)
                </label>
                {pdfFile ? (
                  <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                    <DocumentIcon className="h-5 w-5 text-indigo-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-indigo-900 truncate">{pdfFile.name}</p>
                      <p className="text-xs text-indigo-500">{(pdfFile.size / 1024).toFixed(0)} Ko</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setPdfFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="flex-shrink-0 text-indigo-400 hover:text-red-500 transition"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition w-full"
                  >
                    <PaperClipIcon className="h-5 w-5" />
                    Joindre un fichier PDF (devoir, interrogation…)
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
                  {selectedClassId
                    ? `Envoi aux élèves de la classe sélectionnée`
                    : 'Sélectionnez une classe'}
                </p>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canSend}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading || sendBroadcast.isPending ? (
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
                      Envoyer
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
                Historique
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
                  <p className="text-xs text-slate-300 mt-1">Vos messages apparaîtront ici</p>
                </div>
              ) : (
                myHistory.map((msg: any) => (
                  <div key={msg.id} className="px-5 py-4 hover:bg-slate-50 transition">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-slate-800 line-clamp-1">{msg.title}</h4>
                      <span className="flex-shrink-0 inline-flex text-[10px] font-semibold rounded-full px-2 py-0.5 bg-purple-100 text-purple-700">
                        Classe
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2">{msg.body}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <UsersIcon className="h-3 w-3" />
                        {msg.recipientCount} élève{msg.recipientCount > 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircleIcon className="h-3 w-3" />
                        {msg.readCount} lu{msg.readCount > 1 ? 's' : ''}
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

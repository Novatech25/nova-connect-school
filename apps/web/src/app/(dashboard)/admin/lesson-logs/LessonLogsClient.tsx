'use client';

import { useState, useMemo } from 'react';
import {
  useAuthContext,
  useLessonLogs,
  useValidateLessonLog,
  useRejectLessonLog,
  useUsers,
  useAcademicYears,
  useSchool,
} from '@novaconnect/data';
import { getSupabaseClient } from '@novaconnect/data/client';
import { useQueryClient } from '@tanstack/react-query';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  CheckCircle,
  XCircle,
  Clock,
  BookOpen,
  Filter,
  Search,
  AlertTriangle,
  PlusCircle,
  X,
  RotateCcw,
  Trash2,
  Coins,
  Eye,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { downloadLessonLogsPdf } from './exportLessonLogsPdf';

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  pending_validation: 'En attente',
  validated: 'Validé',
  rejected: 'Rejeté',
};

const statusStyles: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_validation: 'bg-yellow-100 text-yellow-800',
  validated: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
};

const formatDate = (value?: string | null) => {
  if (!value) return '--';
  return new Date(value).toLocaleDateString('fr-FR');
};

const formatDuration = (minutes?: number | null) => {
  if (!minutes) return '--';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? m.toString().padStart(2, '0') : ''}` : `${m}min`;
};

/* ----------------------------------------------- */
/* Formulaire de création de séance (pour admin)   */
/* ----------------------------------------------- */
function CreateSessionForm({
  schoolId,
  teachers,
  onClose,
  onSuccess,
}: {
  schoolId: string;
  teachers: any[];
  onClose: () => void;
  onSuccess: (status: string) => void;
}) {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    teacherId: '',
    classId: '',
    subjectId: '',
    sessionDate: new Date().toISOString().split('T')[0],
    durationMinutes: 60,
    theme: '',
    content: '',
    homework: '',
    autoValidate: true,
  });

  // Classes and subjects fetched dynamically once a teacher is selected
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  const handleTeacherChange = async (teacherId: string) => {
    setForm((prev) => ({ ...prev, teacherId, classId: '', subjectId: '' }));
    if (!teacherId) { setClasses([]); setSubjects([]); return; }

    setLoadingRelated(true);
    const supabase = getSupabaseClient();

    // Fetch teacher's assigned classes via teacher_assignments
    const { data: assignments } = await supabase
      .from('teacher_assignments')
      .select('class:classes(id, name), subject:subjects(id, name)')
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId);

    const uniqueClasses: any[] = [];
    const uniqueSubjects: any[] = [];
    const seenC = new Set<string>();
    const seenS = new Set<string>();

    assignments?.forEach((a: any) => {
      if (a.class && !seenC.has(a.class.id)) { seenC.add(a.class.id); uniqueClasses.push(a.class); }
      if (a.subject && !seenS.has(a.subject.id)) { seenS.add(a.subject.id); uniqueSubjects.push(a.subject); }
    });

    setClasses(uniqueClasses);
    setSubjects(uniqueSubjects);
    setLoadingRelated(false);
  };

  const handleSubmit = async () => {
    if (!form.teacherId || !form.classId || !form.subjectId || !form.theme || !form.content) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (form.content.length < 10) {
      setError('Le contenu doit comporter au moins 10 caractéres.');
      return;
    }

    setSaving(true);
    setError('');
    const supabase = getSupabaseClient();

    try {
      // Insert directly (admin bypass: no GPS, no plannedSessionId required)
      const { error: insertError } = await supabase
        .from('lesson_logs')
        .insert({
          school_id: schoolId,
          teacher_id: form.teacherId,
          class_id: form.classId,
          subject_id: form.subjectId,
          session_date: form.sessionDate,
          duration_minutes: form.durationMinutes,
          theme: form.theme,
          content: form.content,
          homework: form.homework || null,
          status: form.autoValidate ? 'validated' : 'pending_validation',
          validated_at: form.autoValidate ? new Date().toISOString() : null,
          validated_by: form.autoValidate ? user?.id : null,
          // GPS defaults (0,0 = admin bypass)
          latitude: 0,
          longitude: 0,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Invalidate lesson-logs queries so the table refreshes
      queryClient.invalidateQueries({ queryKey: ['lesson-logs'] });
      onSuccess(form.autoValidate ? 'validated' : 'pending_validation');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la création.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Créer une séance</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pour un enseignant sans accés numérique é la séance sera créée en votre nom.
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-2 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Enseignant */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Enseignant <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              options={teachers.map((t: any) => ({
                value: t.id,
                label: `${t.first_name || t.firstName || ''} ${t.last_name || t.lastName || ''} é ${t.email || ''}`.trim(),
              }))}
              value={form.teacherId}
              onValueChange={handleTeacherChange}
              placeholder="Sélectionner un enseignant..."
              searchPlaceholder="Rechercher par nom ou email..."
            />
          </div>

          {/* Classe */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Classe <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              options={classes.map((c: any) => ({ value: c.id, label: c.name }))}
              value={form.classId}
              onValueChange={(val) => setForm((p) => ({ ...p, classId: val }))}
              placeholder={loadingRelated ? 'Chargement...' : classes.length === 0 ? 'Aucune classe assignée' : 'Sélectionner...'}
              searchPlaceholder="Rechercher une classe..."
            />
          </div>

          {/* Matière */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Matière <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              options={subjects.map((s: any) => ({ value: s.id, label: s.name }))}
              value={form.subjectId}
              onValueChange={(val) => setForm((p) => ({ ...p, subjectId: val }))}
              placeholder={loadingRelated ? 'Chargement...' : subjects.length === 0 ? 'Aucune matiére assignée' : 'Sélectionner...'}
              searchPlaceholder="Rechercher une matiére..."
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date de la séance <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.sessionDate}
              onChange={(e) => setForm((p) => ({ ...p, sessionDate: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Durée */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Durée (minutes) <span className="text-red-500">*</span>
            </label>
            <select
              value={form.durationMinutes}
              onChange={(e) => setForm((p) => ({ ...p, durationMinutes: Number(e.target.value) }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {[30, 45, 60, 90, 120, 150, 180].map((m) => (
                <option key={m} value={m}>{m} minutes ({(m / 60).toFixed(1).replace('.0', '')}h{m % 60 !== 0 ? (m % 60) + 'min' : ''})</option>
              ))}
            </select>
          </div>

          {/* Théme */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Théme / Titre du cours <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.theme}
              onChange={(e) => setForm((p) => ({ ...p, theme: e.target.value }))}
              placeholder="Ex: Les équations du premier degré"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Contenu */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contenu du cours <span className="text-red-500">*</span>
              <span className="text-gray-400 font-normal ml-1">(min. 10 caractéres)</span>
            </label>
            <textarea
              rows={3}
              value={form.content}
              onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
              placeholder="Décrivez ce qui a été enseigné..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Devoir */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Devoir donné <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <input
              type="text"
              value={form.homework}
              onChange={(e) => setForm((p) => ({ ...p, homework: e.target.value }))}
              placeholder="Ex: Exercices 5 é 10 page 42"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Auto-valider */}
          <div className="sm:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.autoValidate}
                onChange={(e) => setForm((p) => ({ ...p, autoValidate: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-green-600"
              />
              <span className="text-sm text-gray-700">
                <span className="font-medium">Valider immédiatement</span>
                <span className="text-gray-400 ml-1">é les heures seront directement comptabilisées dans la paie</span>
              </span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Création...' : form.autoValidate ? 'Créer et valider' : 'Créer (en attente)'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------- */
/* Formulaire de modification du Taux Horaire      */
/* ----------------------------------------------- */
function EditHourlyRateModal({
  log,
  onClose,
  onSuccess,
}: {
  log: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [assignment, setAssignment] = useState<any>(null);
  const [hourlyRate, setHourlyRate] = useState<number | ''>('');

  useMemo(() => {
    const fetchAssignment = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data, error: fetchErr } = await supabase
          .from('teacher_assignments')
          .select('*')
          .eq('school_id', log.school_id || log.schoolId)
          .eq('teacher_id', log.teacher_id || log.teacherId)
          .eq('class_id', log.class_id || log.classId)
          .eq('subject_id', log.subject_id || log.subjectId)
          .limit(1)
          .single();

        if (fetchErr && fetchErr.code !== 'PGRST116') {
          throw fetchErr;
        }

        if (data) {
          setAssignment(data);
          setHourlyRate(data.hourly_rate ?? '');
        } else {
          setError("Aucune assignation trouvée pour ce professeur, classe et matière.");
        }
      } catch (err: any) {
        setError(err?.message || "Erreur de chargement.");
      } finally {
        setLoading(false);
      }
    };
    fetchAssignment();
  }, [log]);

  const handleSave = async () => {
    if (!assignment) return;
    setSaving(true);
    setError('');
    try {
      const supabase = getSupabaseClient();
      const rateToSave = hourlyRate === '' ? null : Number(hourlyRate);
      
      const { error: saveErr } = await supabase
        .from('teacher_assignments')
        .update({ hourly_rate: rateToSave })
        .eq('id', assignment.id);
        
      if (saveErr) throw saveErr;
      
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-600" />
            Taux Horaire
          </h2>
          <button onClick={onClose} className="rounded-md p-2 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            <strong>Enseignant :</strong> {log.teacher?.firstName || log.teacher?.first_name} {log.teacher?.lastName || log.teacher?.last_name}
          </p>
          <p className="text-sm text-gray-600 mb-2">
            <strong>Classe :</strong> {log.class?.name}
          </p>
          <p className="text-sm text-gray-600">
            <strong>Matière :</strong> {log.subject?.name}
          </p>
        </div>

        {loading ? (
          <div className="py-4 text-center text-sm text-gray-500">Chargement...</div>
        ) : error ? (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tarif horaire (au forfait si vide)
              </label>
              <input
                type="number"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Ex: 5000"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={onClose}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------- */
/* Modal de Détails complets de la séance          */
/* ----------------------------------------------- */
function LessonLogDetailsModal({ log, onClose }: { log: any; onClose: () => void }) {
  if (!log) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 border-b pb-4">
          <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-blue-600" />
            Détails du cahier de textes
          </h2>
          <button onClick={onClose} className="rounded-md p-2 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Info Générales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg">
            <div>
              <p className="text-xs text-gray-500 font-medium">Enseignant</p>
              <p className="text-sm font-semibold text-slate-900">
                {log.teacher?.firstName || log.teacher?.first_name} {log.teacher?.lastName || log.teacher?.last_name}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Date & Durée</p>
              <p className="text-sm font-semibold text-slate-900 flex items-center gap-1">
                {formatDate(log.sessionDate || log.session_date)} <span className="text-gray-400">•</span> {formatDuration(log.durationMinutes || log.duration_minutes)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Classe</p>
              <p className="text-sm font-semibold text-slate-900">{log.class?.name || '--'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Matière</p>
              <p className="text-sm font-semibold text-slate-900">{log.subject?.name || '--'}</p>
            </div>
          </div>

          {/* Contenu de la séance */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-2 border-b pb-1">Thème / Titre</h3>
            <p className="text-sm text-slate-700 bg-white border rounded-md p-3">
              {log.theme || <span className="italic text-gray-400">Non renseigné</span>}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-2 border-b pb-1">Contenu détaillé</h3>
            <div className="text-sm text-slate-700 bg-white border rounded-md p-3 whitespace-pre-wrap min-h-[80px]">
              {log.content || <span className="italic text-gray-400">Non renseigné</span>}
            </div>
          </div>

          {log.homework && (
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-2 border-b pb-1">Devoir donné</h3>
              <p className="text-sm text-slate-700 bg-orange-50 border border-orange-100 rounded-md p-3">
                {log.homework}
              </p>
            </div>
          )}

          {/* Statut & GPS (optionnel) */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase text-gray-500">Statut :</span>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[log.status] || 'bg-gray-100 text-gray-700'}`}>
                {statusLabels[log.status] || log.status}
              </span>
            </div>
            {(log.latitude && log.longitude && log.latitude !== 0 && log.longitude !== 0) && (
              <div className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full flex items-center gap-1">
                <span>📍 Pointé par GPS</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-100 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- */
/* Composant principal             */
/* ------------------------------- */
export default function LessonLogsClient() {
  const { user, profile } = useAuthContext();
  const schoolId =
    profile?.school?.id ||
    profile?.school_id ||
    user?.schoolId ||
    (user as any)?.school_id ||
    '';

  const { school } = useSchool(schoolId);

  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Nouveaux filtres
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [teacherFilter, setTeacherFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [confirmValidateId, setConfirmValidateId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editRateLog, setEditRateLog] = useState<any | null>(null);
  const [selectedLogDetails, setSelectedLogDetails] = useState<any | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);

  const { data: logs = [], isLoading } = useLessonLogs(schoolId, {
    status: statusFilter !== 'all' ? (statusFilter as any) : undefined,
  });

  // Fetch teachers for the creation form
  const { data: teachers = [] } = useUsers(schoolId, 'teacher');
  
  // Nouveau : récupérer les années scolaires configurées
  const { data: academicYears = [] } = useAcademicYears(schoolId);

  const validate = useValidateLessonLog();
  const reject = useRejectLessonLog();

  const uniqueYears = useMemo(() => {
    const years = new Map<string, { id: string; name: string }>();
    (logs as any[]).forEach((log: any) => {
      const dateStr = log.sessionDate || log.session_date;
      if (!dateStr) return;
      const logDate = new Date(dateStr);
      
      let foundYear = false;
      for (const ay of (academicYears as any[])) {
        if (ay.startDate && ay.endDate) {
          const start = new Date(ay.startDate);
          const end = new Date(ay.endDate);
          if (logDate >= start && logDate <= end) {
            years.set(ay.id, { id: ay.id, name: ay.name });
            foundYear = true;
            break;
          }
        }
      }
      
      // Fallback si la date ne correspond à aucune année configurée
      if (!foundYear) {
         const y = logDate.getFullYear();
         const fallback = logDate.getMonth() < 7 ? `${y - 1}-${y}` : `${y}-${y + 1}`;
         years.set(fallback, { id: fallback, name: fallback });
      }
    });
    return Array.from(years.values()).sort((a, b) => b.name.localeCompare(a.name));
  }, [logs, academicYears]);

  const uniqueTeachers = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    (logs as any[]).forEach((log: any) => {
      if (log.teacher || log.teacher_id) {
        const id = log.teacher?.id || log.teacher_id;
        if (!map.has(id) && log.teacher) {
          map.set(id, {
            id,
            name: `${log.teacher.firstName || log.teacher.first_name || ''} ${log.teacher.lastName || log.teacher.last_name || ''}`.trim()
          });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [logs]);

  const uniqueClasses = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    (logs as any[]).forEach((log: any) => {
      if (log.class || log.class_id) {
        const tId = log.teacher?.id || log.teacher_id;
        if (teacherFilter !== 'all' && tId !== teacherFilter) return;
        
        const id = log.class?.id || log.class_id;
        if (!map.has(id) && log.class) {
          map.set(id, { id, name: log.class.name });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [logs, teacherFilter]);

  const uniqueSubjects = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    (logs as any[]).forEach((log: any) => {
      if (log.subject || log.subject_id) {
        const tId = log.teacher?.id || log.teacher_id;
        if (teacherFilter !== 'all' && tId !== teacherFilter) return;
        
        const cId = log.class?.id || log.class_id;
        if (classFilter !== 'all' && cId !== classFilter) return;
        
        const id = log.subject?.id || log.subject_id;
        if (!map.has(id) && log.subject) {
          map.set(id, { id, name: log.subject.name });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [logs, teacherFilter, classFilter]);

  const filteredLogs = useMemo(() => {
    return (logs as any[]).filter((log: any) => {
      // Filtre année scolaire
      if (yearFilter !== 'all') {
        if (!log.sessionDate && !log.session_date) return false;
        const d = new Date(log.sessionDate || log.session_date);
        
        let matchedYearId = null;
        for (const ay of (academicYears as any[])) {
          if (ay.startDate && ay.endDate) {
            const start = new Date(ay.startDate);
            const end = new Date(ay.endDate);
            if (d >= start && d <= end) {
              matchedYearId = ay.id;
              break;
            }
          }
        }
        
        if (!matchedYearId) {
          const y = d.getFullYear();
          matchedYearId = d.getMonth() < 7 ? `${y - 1}-${y}` : `${y}-${y + 1}`;
        }
        
        if (matchedYearId !== yearFilter) return false;
      }

      // Filtre professeur
      const tId = log.teacher?.id || log.teacher_id;
      if (teacherFilter !== 'all' && tId !== teacherFilter) return false;

      // Filtre classe
      const cId = log.class?.id || log.class_id;
      if (classFilter !== 'all' && cId !== classFilter) return false;

      // Filtre matière
      const sId = log.subject?.id || log.subject_id;
      if (subjectFilter !== 'all' && sId !== subjectFilter) return false;

      // Filtre texte existant
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const teacherName = `${log.teacher?.firstName || log.teacher?.first_name || ''} ${log.teacher?.lastName || log.teacher?.last_name || ''}`.toLowerCase();
      const subjectName = (log.subject?.name || '').toLowerCase();
      const clsName = (log.class?.name || '').toLowerCase();
      return teacherName.includes(q) || subjectName.includes(q) || clsName.includes(q);
    });
  }, [logs, searchQuery, yearFilter, teacherFilter, classFilter, subjectFilter]);

  // Handlers pour les cases à cocher
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = filteredLogs.map((l: any) => l.id);
      setSelectedLogIds(new Set(allIds));
    } else {
      setSelectedLogIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedLogIds);
    if (checked) newSet.add(id);
    else newSet.delete(id);
    setSelectedLogIds(newSet);
  };

  // Réinitialiser les filtres dépendants si les parents changent
  useMemo(() => {
    if (teacherFilter !== 'all') {
      const clsExists = uniqueClasses.some(c => c.id === classFilter);
      if (!clsExists && classFilter !== 'all') setClassFilter('all');
      
      const subjExists = uniqueSubjects.some(s => s.id === subjectFilter);
      if (!subjExists && subjectFilter !== 'all') setSubjectFilter('all');
    }
  }, [teacherFilter, uniqueClasses, uniqueSubjects, classFilter, subjectFilter]);

  const pendingCount = (logs as any[]).filter((l: any) => l.status === 'pending_validation').length;

  const handleValidate = async (id: string) => {
    try {
      await validate.mutateAsync({ id, validatedBy: user?.id || '' } as any);
      setConfirmValidateId(null);
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la validation.');
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim() || rejectReason.trim().length < 10) {
      toast.error('Le motif doit comporter au moins 10 caractéres.');
      return;
    }
    try {
      await reject.mutateAsync({ id, rejectionReason: rejectReason } as any);
      setRejectingId(null);
      setRejectReason('');
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors du rejet.');
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      setIsActionPending(true);
      const sb = getSupabaseClient();
      const { error } = await sb
        .from('lesson_logs')
        .update({ status: 'pending_validation', validated_at: null, validated_by: null })
        .eq('id', id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['lesson-logs'] });
      setConfirmRevokeId(null);
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la révocation.');
    } finally {
      setIsActionPending(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setIsActionPending(true);
      const sb = getSupabaseClient();
      const { error } = await sb
        .from('lesson_logs')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['lesson-logs'] });
      setConfirmDeleteId(null);
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la suppression.');
    } finally {
      setIsActionPending(false);
    }
  };


  if (!schoolId) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Impossible de charger les informations de l&apos;école.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Validation des séances</h1>
          <p className="mt-1 text-sm text-slate-500">
            Validez les cahiers de texte soumis par les enseignants. Seules les séances{' '}
            <span className="font-semibold text-green-700">validées</span>{' '}
            comptent dans la paie.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-1.5 text-sm font-medium text-yellow-800">
              <AlertTriangle className="h-4 w-4" />
              {pendingCount} en attente
            </div>
          )}
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <PlusCircle className="h-4 w-4" />
            Créer une séance
          </button>
        </div>
      </div>

      {/* Alerte pédagogique */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          <strong>Important :</strong> Les heures ne sont comptabilisées dans la paie que si le statut de la séance est{' '}
          <span className="font-semibold text-green-700">Validé</span>.
          Utilisez le bouton <strong>Créer une séance</strong> pour saisir les cours des enseignants
          sans accés numérique, puis validez-les directement.
        </p>
      </div>

      {/* Filtres */}
      <div className="flex flex-col gap-4 rounded-lg bg-white p-4 shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher enseignant, matière, classe..."
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Tous les statuts</option>
              <option value="pending_validation">En attente</option>
              <option value="validated">Validés</option>
              <option value="rejected">Rejetés</option>
              <option value="draft">Brouillons</option>
            </select>
          </div>
        </div>
        
        {/* Nouveaux Filtres: Année, Professeur, Classe, Matière avec SearchableSelect */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Année Scolaire</label>
            <SearchableSelect
              value={yearFilter}
              onValueChange={(val) => setYearFilter(val || 'all')}
              options={uniqueYears.map(year => ({ value: year.id, label: year.name }))}
              placeholder="Toutes les années"
              searchPlaceholder="Rechercher une année..."
              allLabel="Toutes les années"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Professeur</label>
            <SearchableSelect
              value={teacherFilter}
              onValueChange={(val) => {
                setTeacherFilter(val || 'all');
                setClassFilter('all');
                setSubjectFilter('all');
              }}
              options={uniqueTeachers.map(t => ({ value: t.id, label: t.name }))}
              placeholder="Tous les professeurs"
              searchPlaceholder="Rechercher un professeur..."
              allLabel="Tous les professeurs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Classe</label>
            <SearchableSelect
              value={classFilter}
              onValueChange={(val) => setClassFilter(val || 'all')}
              options={uniqueClasses.map(c => ({ value: c.id, label: c.name }))}
              placeholder="Toutes les classes"
              searchPlaceholder="Rechercher une classe..."
              allLabel="Toutes les classes"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Matière</label>
            <SearchableSelect
              value={subjectFilter}
              onValueChange={(val) => setSubjectFilter(val || 'all')}
              options={uniqueSubjects.map(s => ({ value: s.id, label: s.name }))}
              placeholder="Toutes les matières"
              searchPlaceholder="Rechercher une matière..."
              allLabel="Toutes les matières"
            />
          </div>
        </div>
      </div>

      {/* Action / Export PDF pour la sélection */}
      {selectedLogIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-blue-50 border border-blue-200 p-3 shadow-sm">
          <span className="text-sm font-medium text-blue-800">
            {selectedLogIds.size} séance{selectedLogIds.size > 1 ? 's' : ''} sélectionnée{selectedLogIds.size > 1 ? 's' : ''}
          </span>
          <button
            onClick={() => {
              const exportLogs = (logs as any[]).filter((l: any) => selectedLogIds.has(l.id));
              // On passe l'objet school complet (inclut l'adresse et les contacts si configurés)
              downloadLessonLogsPdf(exportLogs, school || profile?.school || { name: 'Établissement' });
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
          >
            <Download className="h-4 w-4" />
            Télécharger le rapport PDF
          </button>
        </div>
      )}

      {/* Tableau */}
      <div className="rounded-lg bg-white shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-12 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={filteredLogs.length > 0 && selectedLogIds.size === filteredLogs.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Enseignant</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Classe / Matière</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Durée</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">Chargement...</td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                    <BookOpen className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                    Aucune séance trouvée.
                  </td>
                </tr>
              ) : (
                (filteredLogs as any[]).map((log: any) => (
                  <tr key={log.id} className={`hover:bg-slate-50 ${selectedLogIds.has(log.id) ? 'bg-blue-50/40' : ''}`}>
                    <td className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedLogIds.has(log.id)}
                        onChange={(e) => handleSelectOne(log.id, e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="font-medium">
                        {log.teacher?.firstName || log.teacher?.first_name}{' '}
                        {log.teacher?.lastName || log.teacher?.last_name}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-2">
                        {log.teacher?.email}
                        <button
                          onClick={() => setEditRateLog(log)}
                          className="text-amber-600 hover:text-amber-800 transition-colors"
                          title="Modifier le taux horaire de cette matière"
                        >
                          <Coins className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div className="font-medium">{log.class?.name || '--'}</div>
                      <div className="text-xs text-gray-400">{log.subject?.name || '--'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatDate(log.sessionDate || log.session_date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                        {formatDuration(log.durationMinutes || log.duration_minutes)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[log.status] || 'bg-gray-100 text-gray-700'}`}>
                        {statusLabels[log.status] || log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2 flex-wrap pb-1">
                        <button
                          onClick={() => setSelectedLogDetails(log)}
                          title="Voir les détails complets"
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 bg-white"
                        >
                          <Eye className="h-3.5 w-3.5" /> Détails
                        </button>
                      </div>
                      {/* Admin actions per status */}
                      {(log.status === 'pending_validation' || log.status === 'draft') && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => setConfirmValidateId(log.id)}
                            className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                          >
                            <CheckCircle className="h-3.5 w-3.5" /> Valider
                          </button>
                          <button
                            onClick={() => { setRejectingId(log.id); setRejectReason(''); }}
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            <XCircle className="h-3.5 w-3.5" /> Rejeter
                          </button>
                          {log.status === 'draft' && (
                            <button
                              onClick={() => setConfirmDeleteId(log.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Supprimer
                            </button>
                          )}
                        </div>
                      )}
                      {log.status === 'validated' && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-green-600 font-medium">? Validé</span>
                          <button
                            onClick={() => setConfirmRevokeId(log.id)}
                            title="Révoquer la validation"
                            className="inline-flex items-center gap-1 rounded-md border border-orange-200 px-2 py-1 text-xs font-medium text-orange-600 hover:bg-orange-50"
                          >
                            <RotateCcw className="h-3 w-3" /> Révoquer
                          </button>
                        </div>
                      )}
                      {log.status === 'rejected' && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-500 font-medium">? Rejeté</span>
                          <button
                            onClick={() => setConfirmDeleteId(log.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50"
                          >
                            <Trash2 className="h-3 w-3" /> Supprimer
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal confirmation validation */}
      {confirmValidateId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <h2 className="text-lg font-semibold text-slate-900">Confirmer la validation</h2>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Cette séance sera marquée comme <strong className="text-green-700">Validée</strong>.
              Ses heures seront comptabilisées dans la paie de l&apos;enseignant.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmValidateId(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Annuler
              </button>
              <button
                onClick={() => handleValidate(confirmValidateId)}
                disabled={validate.isPending}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {validate.isPending ? 'Validation...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal rejet */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <XCircle className="h-6 w-6 text-red-600" />
              <h2 className="text-lg font-semibold text-slate-900">Rejeter la séance</h2>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motif du rejet * <span className="text-gray-400 font-normal">(min. 10 caractéres)</span></label>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Expliquez pourquoi cette séance est rejetée..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setRejectingId(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Annuler
              </button>
              <button
                onClick={() => handleReject(rejectingId)}
                disabled={reject.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {reject.isPending ? 'Rejet...' : 'Rejeter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal révocation */}
      {confirmRevokeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <RotateCcw className="h-6 w-6 text-orange-600" />
              <h2 className="text-lg font-semibold text-slate-900">Révoquer la validation</h2>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Cette séance repassera en statut <strong className="text-orange-700">En attente</strong> et devra étre validée de nouveau.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmRevokeId(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Annuler
              </button>
              <button
                onClick={() => handleRevoke(confirmRevokeId)}
                disabled={isActionPending}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {isActionPending ? 'Révocation...' : 'Révoquer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal suppression */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <Trash2 className="h-6 w-6 text-gray-700" />
              <h2 className="text-lg font-semibold text-slate-900">Supprimer la séance</h2>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Voulez-vous vraiment supprimer définitivement ce journal de cours ? Cette action est irréversible.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Annuler
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={isActionPending}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {isActionPending ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal création séance */}
      {showCreateForm && (
        <CreateSessionForm
          schoolId={schoolId}
          teachers={teachers as any[]}
          onClose={() => setShowCreateForm(false)}
          onSuccess={(status) => {
            setShowCreateForm(false);
            // Switch filter to show the newly created session
            setStatusFilter(status);
          }}
        />
      )}

      {/* Modal Modifier Taux Horaire */}
      {editRateLog && (
        <EditHourlyRateModal
          log={editRateLog}
          onClose={() => setEditRateLog(null)}
          onSuccess={() => toast.success('Le taux horaire a été mis à jour avec succès. Il sera appliqué au prochain calcul de paie.')}
        />
      )}

      {/* Modal Détails du cahier de textes */}
      {selectedLogDetails && (
        <LessonLogDetailsModal
          log={selectedLogDetails}
          onClose={() => setSelectedLogDetails(null)}
        />
      )}
    </div>
  );
}

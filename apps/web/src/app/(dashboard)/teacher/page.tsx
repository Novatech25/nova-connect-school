'use client';

import { useMemo } from 'react';
import { useAuthContext, useTeacherAssignmentsByTeacher, useScheduleSlotsByTeacher, useTeacherGrades, useSchool } from '@novaconnect/data';

/**
 * Dashboard Professeur
 *
 * Ce dashboard :
 * - Affiche les classes assignées
 * - Affiche l'EDT du jour
 * - Affiche des liens vers présence, notes, cahier de texte
 */
export default function TeacherDashboard() {
  const { user, profile } = useAuthContext();
  const teacherId = user?.id || '';
  const schoolId = profile?.school_id || profile?.school?.id || (user?.user_metadata as any)?.school_id || '';

  const { school } = useSchool(schoolId);

  const userName =
    (profile?.first_name && profile?.last_name)
      ? `${profile.first_name} ${profile.last_name}`.trim()
      : (profile?.firstName && profile?.lastName)
      ? `${profile.firstName} ${profile.lastName}`.trim()
      : user?.user_metadata?.firstName
      ? `${user.user_metadata.firstName || ''} ${user.user_metadata.lastName || ''}`.trim()
      : user?.email?.split('@')[0] || 'Enseignant';

  const schoolName = school?.name || profile?.school?.name || '';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  // --- Données réelles depuis Supabase ---

  // 1. Classes et élèves : on récupère les assignments de l'enseignant
  const { data: assignments, isLoading: isLoadingAssignments } = useTeacherAssignmentsByTeacher(teacherId);

  // Nombre de classes uniques
  const uniqueClassCount = useMemo(() => {
    if (!assignments) return 0;
    const classIds = new Set((assignments as any[]).map((a: any) => a.class?.id).filter(Boolean));
    return classIds.size;
  }, [assignments]);

  // Nombre total d'élèves (depuis student_count de chaque classe unique)
  const totalStudentCount = useMemo(() => {
    if (!assignments) return 0;
    const seenClassIds = new Set<string>();
    let count = 0;
    (assignments as any[]).forEach((a: any) => {
      const cls = a.class;
      if (cls?.id && !seenClassIds.has(cls.id)) {
        seenClassIds.add(cls.id);
        // student_count peut être dans la classe si sélectionné, sinon on fait avec capacity
        count += cls.student_count ?? cls.capacity ?? 0;
      }
    });
    return count;
  }, [assignments]);

  // 2. Cours aujourd'hui : récupérer les slots de l'enseignant et filtrer par jour de semaine
  const { data: allSlots, isLoading: isLoadingSlots } = useScheduleSlotsByTeacher(teacherId);

  const todayCourseCount = useMemo(() => {
    if (!allSlots) return 0;
    // Day of week: 0=Sunday, 1=Monday, ..., 6=Saturday
    // Supabase stocke probablement: 'monday', 'tuesday', etc.
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = dayNames[new Date().getDay()];
    return (allSlots as any[]).filter((slot: any) => {
      const dow = slot.dayOfWeek || slot.day_of_week || '';
      return dow.toLowerCase() === todayName;
    }).length;
  }, [allSlots]);

  // 3. Notes à saisir : notes en statut 'draft' de l'enseignant
  const { data: draftGrades, isLoading: isLoadingGrades } = useTeacherGrades(teacherId, { status: 'draft' });
  const draftGradeCount = draftGrades?.length ?? 0;

  const isLoading = isLoadingAssignments || isLoadingSlots || isLoadingGrades;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-600 uppercase tracking-widest">
              {getGreeting()}
            </p>
            <h1 className="mt-1 text-2xl md:text-3xl font-bold text-slate-900">
              {userName} 👋
            </h1>
            {schoolName && (
              <p className="mt-2 text-slate-500 text-sm">
                {schoolName}
              </p>
            )}
          </div>
          <div className="hidden sm:flex flex-col items-end text-right">
            <span className="text-xs text-slate-400">Rôle</span>
            <span className="text-sm font-semibold text-slate-700 mt-0.5">Enseignant</span>
            <span className="mt-2 text-xs text-slate-400">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Classes assignées */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Mes classes</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {isLoadingAssignments ? (
                  <span className="inline-block h-8 w-12 bg-gray-200 animate-pulse rounded" />
                ) : (
                  uniqueClassCount
                )}
              </p>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
        </div>

        {/* Élèves */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Élèves</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {isLoadingAssignments ? (
                  <span className="inline-block h-8 w-12 bg-gray-200 animate-pulse rounded" />
                ) : totalStudentCount > 0 ? (
                  totalStudentCount
                ) : (
                  <span className="text-gray-400 text-xl">-</span>
                )}
              </p>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Cours aujourd'hui */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Cours aujourd'hui</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {isLoadingSlots ? (
                  <span className="inline-block h-8 w-12 bg-gray-200 animate-pulse rounded" />
                ) : (
                  todayCourseCount
                )}
              </p>
            </div>
            <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Notes à saisir */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Notes à saisir</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {isLoadingGrades ? (
                  <span className="inline-block h-8 w-12 bg-gray-200 animate-pulse rounded" />
                ) : (
                  draftGradeCount
                )}
              </p>
            </div>
            <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Liens rapides */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Actions rapides</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <a
            href="/teacher/classes"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-900">Mes classes</p>
              <p className="text-sm text-gray-500">Voir mes classes</p>
            </div>
          </a>

          <a
            href="/teacher/attendance"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-900">Présences</p>
              <p className="text-sm text-gray-500">Appel des élèves</p>
            </div>
          </a>

          <a
            href="/teacher/grades"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-900">Notes</p>
              <p className="text-sm text-gray-500">Saisir les notes</p>
            </div>
          </a>

          <a
            href="/teacher/homework"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="h-10 w-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-900">Cahier de texte</p>
              <p className="text-sm text-gray-500">Devoirs et leçons</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}

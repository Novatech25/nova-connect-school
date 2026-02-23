'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  useAuth, 
  useAttendanceSessions, 
  useValidateAttendanceSession, 
  useAttendanceRecords,
  useClasses,
  useUsers
} from '@novaconnect/data';
import { AttendanceStatusBadge } from './components/AttendanceStatusBadge';
import type { AttendanceSession } from '@core/schemas/attendance';

export default function AttendanceAdminPage() {
  const { user } = useAuth();
  const schoolId = user?.schoolId || '';
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedSession, setSelectedSession] = useState<AttendanceSession | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Data fetching for filters
  const { data: classes } = useClasses(schoolId);
  const { data: teachers } = useUsers(schoolId, 'teacher');

  const validateSession = useValidateAttendanceSession();
  const { data: sessions, isLoading, refetch } = useAttendanceSessions(
    schoolId,
    {
      startDate: selectedDate,
      endDate: selectedDate,
      ...(selectedClass && { classId: selectedClass }),
      ...(selectedTeacher && { teacherId: selectedTeacher }),
      ...(selectedStatus && { status: selectedStatus as any }),
    }
  );

  const { data: records } = useAttendanceRecords(selectedSession?.id || '');

  const handleValidate = async (sessionId: string) => {
    try {
      await validateSession.mutateAsync({ id: sessionId });
      await refetch();
      alert('Session validée avec succès');
    } catch (error) {
      console.error('Error validating session:', error);
      alert('Erreur lors de la validation');
    }
  };

  const handleViewDetails = (session: AttendanceSession) => {
    setSelectedSession(session);
    setShowDetailModal(true);
  };

  const stats = {
    total: sessions?.length || 0,
    draft: sessions?.filter((s) => s.status === 'draft').length || 0,
    submitted: sessions?.filter((s) => s.status === 'submitted').length || 0,
    validated: sessions?.filter((s) => s.status === 'validated').length || 0,
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Gestion de la Présence</h1>
        <p className="text-gray-600 mt-2">Valider et consulter les feuilles de présence</p>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Classe
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Toutes les classes</option>
              {classes?.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Professeur
            </label>
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les professeurs</option>
              {teachers?.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.firstName} {teacher.lastName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Statut
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les statuts</option>
              <option value="draft">Brouillon</option>
              <option value="submitted">Soumis</option>
              <option value="validated">Validé</option>
            </select>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Sessions</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-2xl font-bold text-yellow-600">{stats.draft}</div>
          <div className="text-sm text-gray-600">Brouillons</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-2xl font-bold text-blue-600">{stats.submitted}</div>
          <div className="text-sm text-gray-600">À valider</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-2xl font-bold text-green-600">{stats.validated}</div>
          <div className="text-sm text-gray-600">Validées</div>
        </div>
      </div>

      {/* Tableau des sessions */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Heure
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Classe
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Matière
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Professeur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    Chargement...
                  </td>
                </tr>
              ) : sessions && sessions.length > 0 ? (
                sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(session.sessionDate).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {session.plannedSession?.startTime} - {session.plannedSession?.endTime}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {session.class?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {session.plannedSession?.subjectName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {session.teacher?.firstName} {session.teacher?.lastName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <AttendanceStatusBadge status={session.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleViewDetails(session)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Voir détails
                      </button>
                      {session.status === 'submitted' && (
                        <button
                          onClick={() => handleValidate(session.id)}
                          className="text-green-600 hover:text-green-900"
                          disabled={validateSession.isPending}
                        >
                          Valider
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    Aucune session trouvée
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de détail */}
      {showDetailModal && selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Détails de la présence</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedSession.class?.name} - {selectedSession.plannedSession?.subjectName}
                  </p>
                  <p className="text-sm text-gray-600">
                    {new Date(selectedSession.sessionDate).toLocaleDateString('fr-FR')} • {selectedSession.plannedSession?.startTime} - {selectedSession.plannedSession?.endTime}
                  </p>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Liste des élèves</h3>
              {records && records.length > 0 ? (
                <div className="space-y-2">
                  {records.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <div className="font-medium text-gray-900">
                          {record.student?.firstName} {record.student?.lastName}
                        </div>
                        {record.comment && (
                          <div className="text-sm text-gray-600 mt-1">{record.comment}</div>
                        )}
                      </div>
                      <AttendanceStatusBadge status={record.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">Aucun enregistrement trouvé</p>
              )}

              {selectedSession.notes && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Notes du professeur</h4>
                  <p className="text-sm text-blue-800">{selectedSession.notes}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t bg-gray-50 flex justify-end space-x-3">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Fermer
              </button>
              {selectedSession.status === 'submitted' && (
                <button
                  onClick={() => {
                    handleValidate(selectedSession.id);
                    setShowDetailModal(false);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  disabled={validateSession.isPending}
                >
                  Valider
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

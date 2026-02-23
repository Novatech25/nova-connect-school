'use client';

import { useState } from 'react';
import { useAuth, useAttendanceStats, useAttendanceByStudent } from '@novaconnect/data';
import type { AttendanceStats, StudentAttendanceSummary } from '@core/schemas/attendance';

export default function AttendanceReportsPage() {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedClass, setSelectedClass] = useState<string>('');

  const { data: stats, isLoading: statsLoading } = useAttendanceStats(user?.schoolId || '', {
    startDate,
    endDate,
    ...(selectedClass && { classId: selectedClass }),
  });

  const { data: studentSummaries, isLoading: studentsLoading } = useAttendanceByStudent(
    user?.schoolId || '',
    {
      startDate,
      endDate,
      ...(selectedClass && { classId: selectedClass }),
    }
  );

  const handleExportCSV = () => {
    if (!studentSummaries || studentSummaries.length === 0) return;

    const headers = ['Élève', 'Total Sessions', 'Présents', 'Absents', 'Retards', 'Excusés', 'Taux de présence', 'Absences injustifiées'];
    const rows = studentSummaries.map((s) => [
      s.studentName,
      s.totalSessions.toString(),
      s.present.toString(),
      s.absent.toString(),
      s.late.toString(),
      s.excused.toString(),
      `${s.attendanceRate}%`,
      s.unjustifiedAbsences.toString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `presence_${startDate}_${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Rapports de Présence</h1>
        <p className="text-gray-600 mt-2">Analyse et export des données de présence</p>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date de début
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date de fin
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
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
              {/* Options à remplir dynamiquement */}
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleExportCSV}
            disabled={!studentSummaries || studentSummaries.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Exporter en CSV
          </button>
        </div>
      </div>

      {/* Statistiques globales */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-3xl font-bold text-gray-900">
            {statsLoading ? '-' : stats?.total || 0}
          </div>
          <div className="text-sm text-gray-600 mt-2">Total Enregistrements</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-3xl font-bold text-green-600">
            {statsLoading ? '-' : stats?.present || 0}
          </div>
          <div className="text-sm text-gray-600 mt-2">Présents</div>
          <div className="text-xs text-gray-500 mt-1">
            {stats ? Math.round((stats.present / stats.total) * 100) : 0}%
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-3xl font-bold text-red-600">
            {statsLoading ? '-' : stats?.absent || 0}
          </div>
          <div className="text-sm text-gray-600 mt-2">Absents</div>
          <div className="text-xs text-gray-500 mt-1">
            {stats ? Math.round((stats.absent / stats.total) * 100) : 0}%
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-3xl font-bold text-yellow-600">
            {statsLoading ? '-' : stats?.late || 0}
          </div>
          <div className="text-sm text-gray-600 mt-2">Retards</div>
          <div className="text-xs text-gray-500 mt-1">
            {stats ? Math.round((stats.late / stats.total) * 100) : 0}%
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-3xl font-bold text-blue-600">
            {statsLoading ? '-' : stats?.attendanceRate || 0}%
          </div>
          <div className="text-sm text-gray-600 mt-2">Taux de présence</div>
        </div>
      </div>

      {/* Graphique d'évolution */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Évolution de la présence</h2>
        {/* Intégration avec un composant de graphique existant */}
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
          <p className="text-gray-500">Graphique à implémenter avec les composants charts existants</p>
        </div>
      </div>

      {/* Tableau détaillé par élève */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Détail par élève</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Élève
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Sessions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Présents
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Absents
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Retards
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Excusés
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Taux de présence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Absences injustifiées
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {studentsLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    Chargement...
                  </td>
                </tr>
              ) : studentSummaries && studentSummaries.length > 0 ? (
                studentSummaries
                  .sort((a, b) => a.attendanceRate - b.attendanceRate)
                  .map((summary) => (
                    <tr
                      key={summary.studentId}
                      className={`hover:bg-gray-50 ${
                        summary.attendanceRate < 80 ? 'bg-red-50' :
                        summary.attendanceRate < 90 ? 'bg-yellow-50' :
                        ''
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {summary.studentName}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {summary.totalSessions}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                        {summary.present}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                        {summary.absent}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600 font-medium">
                        {summary.late}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                        {summary.excused}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div
                              className={`h-2 rounded-full ${
                                summary.attendanceRate >= 90 ? 'bg-green-500' :
                                summary.attendanceRate >= 80 ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${summary.attendanceRate}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {summary.attendanceRate}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {summary.unjustifiedAbsences}
                      </td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    Aucune donnée trouvée pour la période sélectionnée
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Légende */}
      <div className="mt-6 bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-50 rounded border border-green-200" />
            <span className="text-gray-600">Taux ≥ 90% (Excellent)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-50 rounded border border-yellow-200" />
            <span className="text-gray-600">Taux 80-89% (Attention)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-50 rounded border border-red-200" />
            <span className="text-gray-600">Taux &lt; 80% (Critique)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

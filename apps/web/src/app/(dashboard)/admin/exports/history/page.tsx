'use client';

import { useState } from 'react';
import { useAuth, useLicenses, useExportPolling, exportJobQueries, downloadExport, type ExportJob } from '@novaconnect/data';
import { useQuery } from '@tanstack/react-query';
import { ExportStatusBadge } from '../page';

export default function ExportHistoryPage() {
  const { user } = useAuth();
  const schoolId = user?.schoolId || '';

  // Premium check
  const { data: license } = useLicenses(schoolId);
  const hasPremium = license?.license_type === 'premium' || license?.license_type === 'enterprise';
  const moduleEnabled = license?.enabled_modules?.includes('api_export');

  // Filters
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [resourceFilter, setResourceFilter] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<ExportJob | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Query jobs
  const { data: jobsData, isLoading, refetch } = useQuery(
    exportJobQueries.getAll(schoolId, page, 20)
  );

  // Poll for active jobs
  const activeJobs = jobsData?.data?.filter(job =>
    job.status === 'pending' || job.status === 'processing'
  ) || [];

  useExportPolling(activeJobs.map(job => job.id), {
    refetchInterval: 3000,
    enabled: activeJobs.length > 0
  });

  // Filter jobs
  const filteredJobs = jobsData?.data?.filter(job => {
    if (statusFilter && job.status !== statusFilter) return false;
    if (typeFilter && job.export_type !== typeFilter) return false;
    if (resourceFilter && job.resource_type !== resourceFilter) return false;
    return true;
  }) || [];

  // Handlers
  const handleDownload = async (job: ExportJob) => {
    if (!job.file_path) {
      alert('Fichier non disponible');
      return;
    }

    setDownloadingId(job.id);
    try {
      const result = await downloadExport(job.id);
      if (result.downloadUrl) {
        window.open(result.downloadUrl, '_blank');
      }
    } catch (error: any) {
      alert(`Erreur de téléchargement: ${error.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleViewDetails = (job: ExportJob) => {
    setSelectedJob(job);
    setShowDetailModal(true);
  };

  const handleReRun = async (job: ExportJob) => {
    if (!confirm('Voulez-vous relancer cet export ?')) return;

    try {
      // This would call a re-run mutation/hook
      alert('Fonctionnalité de relancement bientôt disponible');
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    }
  };

  // Premium gating
  if (!hasPremium || !moduleEnabled) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h1 className="text-2xl font-bold text-yellow-900 mb-2">Fonctionnalité Premium</h1>
          <p className="text-yellow-800">
            Le module d'export avancé nécessite une licence Premium ou Enterprise.
            Contactez votre administrateur pour activer cette fonctionnalité.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Historique des Exports</h1>
        <p className="text-gray-600 mt-2">Consultez et téléchargez vos exports</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Statut
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="processing">En cours</option>
              <option value="completed">Terminé</option>
              <option value="failed">Échoué</option>
              <option value="expired">Expiré</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type d'export
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les types</option>
              <option value="excel">Excel</option>
              <option value="pdf">PDF</option>
              <option value="csv">CSV</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ressource
            </label>
            <select
              value={resourceFilter}
              onChange={(e) => setResourceFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Toutes les ressources</option>
              <option value="bulletins">Bulletins</option>
              <option value="students">Élèves</option>
              <option value="attendance">Présences</option>
              <option value="payments">Paiements</option>
              <option value="payroll">Paie</option>
              <option value="grades">Notes</option>
              <option value="schedules">Emplois du temps</option>
              <option value="lesson_logs">Cahiers de texte</option>
              <option value="student_cards">Fiches élèves</option>
              <option value="exam_results">Résultats d'examens</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setStatusFilter('');
                setTypeFilter('');
                setResourceFilter('');
                setPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Réinitialiser les filtres
            </button>
          </div>
        </div>
      </div>

      {/* Active Jobs Alert */}
      {activeJobs.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">
                {activeJobs.length} export(s) en cours de traitement
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Actualisation automatique toutes les 3 secondes
              </p>
            </div>
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        </div>
      )}

      {/* Jobs Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ressource
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lignes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Taille
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
              ) : filteredJobs.length > 0 ? (
                filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(job.created_at).toLocaleDateString('fr-FR')}{' '}
                      {new Date(job.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {job.export_type.toUpperCase()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {job.resource_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {job.row_count || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {job.file_size_bytes
                        ? `${(job.file_size_bytes / 1024).toFixed(2)} KB`
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <ExportStatusBadge status={job.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleViewDetails(job)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Détails
                      </button>
                      {job.status === 'completed' && job.file_path && (
                        <button
                          onClick={() => handleDownload(job)}
                          disabled={downloadingId === job.id}
                          className="text-green-600 hover:text-green-900 disabled:opacity-50"
                        >
                          {downloadingId === job.id ? 'Téléchargement...' : 'Télécharger'}
                        </button>
                      )}
                      {job.status === 'failed' && (
                        <button
                          onClick={() => handleReRun(job)}
                          className="text-orange-600 hover:text-orange-900"
                        >
                          Relancer
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    Aucun export trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {jobsData && jobsData.totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-4 border-t flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Affichage de {(page - 1) * 20 + 1} à {Math.min(page * 20, jobsData.total)} sur {jobsData.total} exports
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100 disabled:opacity-50"
              >
                Précédent
              </button>
              <span className="px-3 py-1 text-sm">
                Page {page} / {jobsData.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(jobsData.totalPages, p + 1))}
                disabled={page === jobsData.totalPages}
                className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100 disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Détails de l'Export</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    ID: {selectedJob.id}
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

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500">Statut</label>
                  <div className="mt-1">
                    <ExportStatusBadge status={selectedJob.status} />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500">Type</label>
                  <div className="mt-1 text-sm text-gray-900">
                    {selectedJob.export_type.toUpperCase()}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500">Ressource</label>
                  <div className="mt-1 text-sm text-gray-900">
                    {selectedJob.resource_type}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500">Lignes</label>
                  <div className="mt-1 text-sm text-gray-900">
                    {selectedJob.row_count || '-'}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500">Taille du fichier</label>
                  <div className="mt-1 text-sm text-gray-900">
                    {selectedJob.file_size_bytes
                      ? `${(selectedJob.file_size_bytes / 1024).toFixed(2)} KB`
                      : '-'}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500">Créé le</label>
                  <div className="mt-1 text-sm text-gray-900">
                    {new Date(selectedJob.created_at).toLocaleString('fr-FR')}
                  </div>
                </div>

                {selectedJob.started_at && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">Démarré le</label>
                    <div className="mt-1 text-sm text-gray-900">
                      {new Date(selectedJob.started_at).toLocaleString('fr-FR')}
                    </div>
                  </div>
                )}

                {selectedJob.completed_at && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">Terminé le</label>
                    <div className="mt-1 text-sm text-gray-900">
                      {new Date(selectedJob.completed_at).toLocaleString('fr-FR')}
                    </div>
                  </div>
                )}
              </div>

              {selectedJob.error_message && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <label className="text-xs font-medium text-red-900">Erreur</label>
                  <p className="mt-1 text-sm text-red-800">{selectedJob.error_message}</p>
                </div>
              )}

              {selectedJob.filters && Object.keys(selectedJob.filters).length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500">Filtres appliqués</label>
                  <pre className="mt-1 text-xs bg-gray-50 p-3 rounded overflow-x-auto">
                    {JSON.stringify(selectedJob.filters, null, 2)}
                  </pre>
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
              {selectedJob.status === 'completed' && selectedJob.file_path && (
                <button
                  onClick={() => {
                    handleDownload(selectedJob);
                    setShowDetailModal(false);
                  }}
                  disabled={downloadingId === selectedJob.id}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {downloadingId === selectedJob.id ? 'Téléchargement...' : 'Télécharger'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

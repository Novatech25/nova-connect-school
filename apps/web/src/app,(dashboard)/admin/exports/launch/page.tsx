'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useLicenses, exportTemplateQueries, launchExport, type ExportTemplate, type ExportFilters } from '@novaconnect/data';
import { useQuery, useMutation } from '@tanstack/react-query';

export default function LaunchExportPage() {
  const { user } = useAuth();
  const router = useRouter();
  const schoolId = user?.schoolId || '';

  // Premium check
  const { data: license } = useLicenses(schoolId);
  const hasPremium = license?.license_type === 'premium' || license?.license_type === 'enterprise';
  const moduleEnabled = license?.enabled_modules?.includes('api_export');

  // Form state
  const [useTemplate, setUseTemplate] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [exportType, setExportType] = useState<'excel' | 'pdf' | 'csv'>('excel');
  const [resourceType, setResourceType] = useState<ExportTemplate['resource_type']>('students');
  const [filters, setFilters] = useState<ExportFilters>({});
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);

  // Queries
  const { data: templates, isLoading: templatesLoading } = useQuery(
    exportTemplateQueries.getAll(schoolId)
  );

  const { data: resourceTemplates } = useQuery(
    exportTemplateQueries.getByResourceType(schoolId, resourceType)
  );

  // Mutation
  const launchMutation = useMutation({
    mutationFn: launchExport,
    onSuccess: (result) => {
      alert(`Export lancé avec succès! Job ID: ${result.jobId}`);
      router.push('/admin/exports/history');
    },
    onError: (error: any) => {
      alert(`Erreur: ${error.message}`);
    }
  });

  // Handlers
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates?.find(t => t.id === templateId);
    if (template) {
      setExportType(template.export_type);
      setResourceType(template.resource_type);
      setFilters(template.filters || {});
    }
  };

  const handleResourceTypeChange = (type: ExportTemplate['resource_type']) => {
    setResourceType(type);
    setSelectedTemplateId('');
    setFilters({});
    setShowPreview(false);
  };

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();

    const request = useTemplate && selectedTemplateId
      ? {
          templateId: selectedTemplateId,
          filters
        }
      : {
          exportType,
          resourceType,
          templateConfig: {
            columns: [] // Will use default columns
          },
          filters
        };

    await launchMutation.mutateAsync(request as any);
  };

  const handlePreview = () => {
    // Mock preview data
    setPreviewData([
      { id: 1, name: 'Exemple 1', value: 'Donnée 1' },
      { id: 2, name: 'Exemple 2', value: 'Donnée 2' },
    ]);
    setShowPreview(true);
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
        <h1 className="text-3xl font-bold text-gray-900">Lancer un Export</h1>
        <p className="text-gray-600 mt-2">Créez et lancez un nouvel export</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Form */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <form onSubmit={handleLaunch} className="space-y-6">
            {/* Template Selection */}
            <div>
              <div className="flex items-center mb-4">
                <input
                  type="radio"
                  id="useTemplate"
                  checked={useTemplate}
                  onChange={() => setUseTemplate(true)}
                  className="mr-2"
                />
                <label htmlFor="useTemplate" className="text-sm font-medium text-gray-700">
                  Utiliser un template existant
                </label>
              </div>

              <input
                type="radio"
                id="useCustom"
                checked={!useTemplate}
                onChange={() => setUseTemplate(false)}
                className="mr-2"
              />
              <label htmlFor="useCustom" className="text-sm font-medium text-gray-700">
                Configuration personnalisée
              </label>
            </div>

            {useTemplate ? (
              /* Template Mode */
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template *
                </label>
                {templatesLoading ? (
                  <div className="text-sm text-gray-500">Chargement des templates...</div>
                ) : templates && templates.length > 0 ? (
                  <select
                    required
                    value={selectedTemplateId}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner un template</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} ({template.export_type.toUpperCase()} - {template.resource_type})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm text-gray-500">
                    Aucun template disponible.{' '}
                    <button
                      type="button"
                      onClick={() => router.push('/admin/exports/templates')}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Créer un template
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Custom Configuration Mode */
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type d'export *
                  </label>
                  <select
                    required
                    value={exportType}
                    onChange={(e) => setExportType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="excel">Excel (XLSX)</option>
                    <option value="pdf">PDF</option>
                    <option value="csv">CSV</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type de ressource *
                  </label>
                  <select
                    required
                    value={resourceType}
                    onChange={(e) => handleResourceTypeChange(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
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

                {resourceTemplates && resourceTemplates.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      <strong>Suggestion:</strong> Il existe {resourceTemplates.length} template(s) pour cette ressource.
                      Passez en mode "Template" pour les utiliser.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Filters */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Filtres</h3>
              <p className="text-sm text-gray-600 mb-4">
                Les filtres avancés seront disponibles dans une version ultérieure.
                Pour l'instant, l'export utilisera les données par défaut.
              </p>

              {/* Example filter for class (would be dynamic based on resource type) */}
              {resourceType === 'students' && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Classe (optionnel)
                  </label>
                  <select
                    value={filters.classId || ''}
                    onChange={(e) => setFilters({ ...filters, classId: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Toutes les classes</option>
                    {/* Options would be loaded dynamically */}
                  </select>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={handlePreview}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Aperçu
              </button>
              <button
                type="submit"
                disabled={launchMutation.isPending}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {launchMutation.isPending ? 'Lancement...' : 'Lancer l\'Export'}
              </button>
            </div>
          </form>
        </div>

        {/* Preview Panel */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Aperçu</h2>

          {!showPreview ? (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="mt-2 text-sm text-gray-600">
                Cliquez sur "Aperçu" pour voir un échantillon des données
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Ceci est un aperçu limité. L'export complet contiendra toutes les données correspondant à vos critères.
                </p>
              </div>

              {previewData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {Object.keys(previewData[0]).map((key) => (
                          <th key={key} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {previewData.map((row, idx) => (
                        <tr key={idx}>
                          {Object.values(row).map((value, cellIdx) => (
                            <td key={cellIdx} className="px-3 py-2 text-gray-900">
                              {String(value)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-600">Aucune donnée disponible pour l'aperçu</p>
              )}

              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700">
                <p><strong>Type d'export:</strong> {exportType.toUpperCase()}</p>
                <p><strong>Ressource:</strong> {resourceType}</p>
                <p><strong>Mode:</strong> {useTemplate ? 'Template' : 'Personnalisé'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

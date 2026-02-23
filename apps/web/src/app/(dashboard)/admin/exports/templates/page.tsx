'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useLicenses } from '@novaconnect/data';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  exportTemplateQueries,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  type ExportTemplate
} from '@novaconnect/data';
import { ExportStatusBadge } from '../page';
import type { ExportColumn, ExportFilters } from '@core/types';

export default function ExportTemplatesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const schoolId = user?.schoolId || '';

  // Premium check
  const { data: license } = useLicenses(schoolId);
  const hasPremium = license?.license_type === 'premium' || license?.license_type === 'enterprise';
  const moduleEnabled = license?.enabled_modules?.includes('api_export');

  // State
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ExportTemplate | null>(null);
  const [viewMode, setViewMode] = useState<'create' | 'edit' | 'duplicate' | 'view'>('create');

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [exportType, setExportType] = useState<'excel' | 'pdf' | 'csv'>('excel');
  const [resourceType, setResourceType] = useState<ExportTemplate['resource_type']>('students');
  const [columns, setColumns] = useState<ExportColumn[]>([]);
  const [filters, setFilters] = useState<ExportFilters>({});
  const [isActive, setIsActive] = useState(true);

  // Queries
  const { data: templates, isLoading } = useQuery(exportTemplateQueries.getAll(schoolId));

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: Omit<ExportTemplate, 'id' | 'created_at' | 'updated_at' | 'school_id'>) => {
      return await createTemplate(schoolId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export_templates'] });
      setIsOpen(false);
      resetForm();
      alert('Template créé avec succès');
    },
    onError: (error: any) => {
      alert(`Erreur: ${error.message}`);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ExportTemplate> }) => {
      return await updateTemplate(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export_templates'] });
      setIsOpen(false);
      resetForm();
      alert('Template mis à jour avec succès');
    },
    onError: (error: any) => {
      alert(`Erreur: ${error.message}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await deleteTemplate(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export_templates'] });
      alert('Template supprimé avec succès');
    },
    onError: (error: any) => {
      alert(`Erreur: ${error.message}`);
    }
  });

  // Handlers
  const handleCreate = () => {
    setViewMode('create');
    resetForm();
    setIsOpen(true);
  };

  const handleEdit = (template: ExportTemplate) => {
    setViewMode('edit');
    setSelectedTemplate(template);
    setName(template.name);
    setDescription(template.description || '');
    setExportType(template.export_type);
    setResourceType(template.resource_type);
    setColumns(template.template_config?.columns || []);
    setFilters(template.filters || {});
    setIsActive(template.is_active);
    setIsOpen(true);
  };

  const handleDuplicate = (template: ExportTemplate) => {
    setViewMode('duplicate');
    setSelectedTemplate(template);
    setName(`${template.name} (copie)`);
    setDescription(template.description || '');
    setExportType(template.export_type);
    setResourceType(template.resource_type);
    setColumns(template.template_config?.columns || []);
    setFilters(template.filters || {});
    setIsActive(false);
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce template ?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const templateData = {
      name,
      description,
      export_type: exportType,
      resource_type: resourceType,
      template_config: { columns },
      filters,
      is_active: isActive,
      created_by: user?.id || ''
    };

    if (viewMode === 'create' || viewMode === 'duplicate') {
      await createMutation.mutateAsync(templateData);
    } else if (viewMode === 'edit' && selectedTemplate) {
      await updateMutation.mutateAsync({
        id: selectedTemplate.id,
        updates: templateData
      });
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setExportType('excel');
    setResourceType('students');
    setColumns([]);
    setFilters({});
    setIsActive(true);
    setSelectedTemplate(null);
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
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Templates d'Export</h1>
          <p className="text-gray-600 mt-2">Gérez vos modèles d'export personnalisés</p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + Nouveau Template
        </button>
      </div>

      {/* Templates Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ressource
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Colonnes
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
              ) : templates && templates.length > 0 ? (
                templates.map((template) => (
                  <tr key={template.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {template.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {template.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {template.export_type.toUpperCase()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {template.resource_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {template.template_config?.columns?.length || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        template.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {template.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleEdit(template)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDuplicate(template)}
                        className="text-purple-600 hover:text-purple-900"
                      >
                        Dupliquer
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    Aucun template trouvé. Créez votre premier template pour commencer.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {viewMode === 'create' ? 'Nouveau Template' :
                     viewMode === 'duplicate' ? 'Dupliquer Template' :
                     'Modifier Template'}
                  </h2>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom du template *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Liste des élèves - Classe 6A"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Description du template..."
                  />
                </div>

                {/* Export Type */}
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

                {/* Resource Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type de ressource *
                  </label>
                  <select
                    required
                    value={resourceType}
                    onChange={(e) => setResourceType(e.target.value as any)}
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

                {/* Active */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="mr-2"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                    Template actif
                  </label>
                </div>

                {/* Note about columns configuration */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> La configuration des colonnes et des filtres sera disponible dans une version ultérieure.
                    Pour l'instant, les templates utilisent la configuration par défaut.
                  </p>
                </div>
              </div>

              <div className="p-6 border-t bg-gray-50 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Enregistrement...'
                    : viewMode === 'create' ? 'Créer' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

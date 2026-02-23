'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useLicenses, scheduledExportQueries, exportTemplateQueries, createScheduledExport, updateScheduledExport, deleteScheduledExport, toggleScheduledExport, type ScheduledExport, type ExportTemplate } from '@novaconnect/data';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ScheduledExportsPage() {
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
  const [selectedScheduled, setSelectedScheduled] = useState<ScheduledExport | null>(null);
  const [viewMode, setViewMode] = useState<'create' | 'edit'>('create');

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [cronType, setCronType] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily');
  const [cronExpression, setCronExpression] = useState('0 8 * * *');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Queries
  const { data: scheduledExports, isLoading } = useQuery(scheduledExportQueries.getAll(schoolId));
  const { data: templates } = useQuery(exportTemplateQueries.getAll(schoolId));

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: Omit<ScheduledExport, 'id' | 'created_at' | 'updated_at' | 'school_id'>) => {
      return await createScheduledExport(schoolId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled_exports'] });
      setIsOpen(false);
      resetForm();
      alert('Export planifié créé avec succès');
    },
    onError: (error: any) => {
      alert(`Erreur: ${error.message}`);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ScheduledExport> }) => {
      return await updateScheduledExport(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled_exports'] });
      setIsOpen(false);
      resetForm();
      alert('Export planifié mis à jour avec succès');
    },
    onError: (error: any) => {
      alert(`Erreur: ${error.message}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await deleteScheduledExport(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled_exports'] });
      alert('Export planifié supprimé avec succès');
    },
    onError: (error: any) => {
      alert(`Erreur: ${error.message}`);
    }
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await toggleScheduledExport(id, isActive);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled_exports'] });
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

  const handleEdit = (scheduled: ScheduledExport) => {
    setViewMode('edit');
    setSelectedScheduled(scheduled);
    setName(scheduled.name);
    setDescription(scheduled.description || '');
    setTemplateId(scheduled.template_id);
    setCronExpression(scheduled.cron_expression);
    setRecipients(scheduled.recipients || []);
    setIsActive(scheduled.is_active);
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cet export planifié ?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    await toggleMutation.mutateAsync({ id, isActive: !currentStatus });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const scheduledData = {
      name,
      description,
      template_id: templateId,
      cron_expression: cronExpression,
      recipients,
      filters: {}, // Would be configured based on template
      is_active: isActive,
      created_by: user?.id || ''
    };

    if (viewMode === 'create') {
      await createMutation.mutateAsync(scheduledData);
    } else if (viewMode === 'edit' && selectedScheduled) {
      await updateMutation.mutateAsync({
        id: selectedScheduled.id,
        updates: scheduledData
      });
    }
  };

  const handleAddRecipient = () => {
    if (recipientInput && !recipients.includes(recipientInput)) {
      setRecipients([...recipients, recipientInput]);
      setRecipientInput('');
    }
  };

  const handleRemoveRecipient = (email: string) => {
    setRecipients(recipients.filter(r => r !== email));
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setTemplateId('');
    setCronType('daily');
    setCronExpression('0 8 * * *');
    setRecipients([]);
    setRecipientInput('');
    setIsActive(true);
    setSelectedScheduled(null);
  };

  const getNextRunDate = (scheduled: ScheduledExport) => {
    if (!scheduled.next_run_at) return '-';
    return format(new Date(scheduled.next_run_at), 'Pp', { locale: fr });
  };

  const getCronDescription = (cronExpr: string) => {
    // Simple description generator for common cron patterns
    if (cronExpr === '0 8 * * *') return 'Tous les jours à 08h00';
    if (cronExpr === '0 8 * * 1') return 'Tous les lundis à 08h00';
    if (cronExpr === '0 8 1 * *') return 'Le 1er de chaque mois à 08h00';
    return cronExpr;
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
          <h1 className="text-3xl font-bold text-gray-900">Exports Planifiés</h1>
          <p className="text-gray-600 mt-2">Automatisez vos exports récurrents</p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + Nouvel Export Planifié
        </button>
      </div>

      {/* Scheduled Exports Table */}
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
                  Fréquence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prochain run
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Destinataires
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
              ) : scheduledExports && scheduledExports.length > 0 ? (
                scheduledExports.map((scheduled) => (
                  <tr key={scheduled.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {scheduled.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {scheduled.description || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {getCronDescription(scheduled.cron_expression)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getNextRunDate(scheduled)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {scheduled.recipients?.length || 0} destinataire(s)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggle(scheduled.id, scheduled.is_active)}
                        className={`px-2 py-1 text-xs rounded-full ${
                          scheduled.is_active
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {scheduled.is_active ? 'Actif' : 'Inactif'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleEdit(scheduled)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(scheduled.id)}
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
                    Aucun export planifié trouvé. Créez votre premier export planifié pour commencer.
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
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {viewMode === 'create' ? 'Nouvel Export Planifié' : 'Modifier Export Planifié'}
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
                    Nom *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Rapport hebdomadaire des paiements"
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
                    placeholder="Description de l'export planifié..."
                  />
                </div>

                {/* Template */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template *
                  </label>
                  <select
                    required
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner un template</option>
                    {templates?.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} ({template.export_type.toUpperCase()} - {template.resource_type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cron Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fréquence *
                  </label>
                  <select
                    required
                    value={cronType}
                    onChange={(e) => {
                      setCronType(e.target.value as any);
                      // Set default cron expressions
                      const type = e.target.value;
                      if (type === 'daily') setCronExpression('0 8 * * *');
                      else if (type === 'weekly') setCronExpression('0 8 * * 1');
                      else if (type === 'monthly') setCronExpression('0 8 1 * *');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="daily">Quotidien</option>
                    <option value="weekly">Hebdomadaire</option>
                    <option value="monthly">Mensuel</option>
                    <option value="custom">Personnalisé (cron)</option>
                  </select>
                </div>

                {cronType === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Expression Cron *
                    </label>
                    <input
                      type="text"
                      required
                      value={cronExpression}
                      onChange={(e) => setCronExpression(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      placeholder="0 8 * * *"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Format: minute heure jour mois jour_semaine
                    </p>
                  </div>
                )}

                {/* Recipients */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Destinataires des emails
                  </label>
                  <div className="flex space-x-2 mb-2">
                    <input
                      type="email"
                      value={recipientInput}
                      onChange={(e) => setRecipientInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddRecipient())}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="email@exemple.com"
                    />
                    <button
                      type="button"
                      onClick={handleAddRecipient}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    >
                      Ajouter
                    </button>
                  </div>
                  {recipients.length > 0 && (
                    <div className="space-y-1">
                      {recipients.map((email) => (
                        <div
                          key={email}
                          className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded text-sm"
                        >
                          <span>{email}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRecipient(email)}
                            className="text-red-600 hover:text-red-900"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
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
                    Export planifié actif
                  </label>
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

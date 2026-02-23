import { useState } from 'react';
import { useMobileMoneyProviders, useCreateMobileMoneyProvider, useUpdateMobileMoneyProvider, useTestProvider } from '@novaconnect/data';
import { Plus, Edit, Trash2, TestTube, CheckCircle, XCircle, Loader2 } from 'lucide-react';

/**
 * Mobile Money Providers Configuration Tab
 *
 * Allows school admins to configure Mobile Money providers
 */
export default function MobileMoneyProvidersTab() {
  const { data: providers, isLoading, refetch } = useMobileMoneyProviders('');
  const createMutation = useCreateMobileMoneyProvider();
  const updateMutation = useUpdateMobileMoneyProvider();
  const testMutation = useTestProvider();

  const [showForm, setShowForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<any>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ [key: string]: any }>({});

  const [formData, setFormData] = useState({
    provider_code: 'orange',
    provider_name: '',
    api_endpoint: '',
    api_key: '',
    api_secret: '',
    webhook_secret: '',
    transaction_fee_percent: 0,
    transaction_fee_fixed: 0,
    min_amount: 100,
    max_amount: 1000000,
    is_test_mode: true,
    is_active: true
  });

  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync(formData as any);
      setShowForm(false);
      setFormData({
        provider_code: 'orange',
        provider_name: '',
        api_endpoint: '',
        api_key: '',
        api_secret: '',
        webhook_secret: '',
        transaction_fee_percent: 0,
        transaction_fee_fixed: 0,
        min_amount: 100,
        max_amount: 1000000,
        is_test_mode: true,
        is_active: true
      });
      refetch();
    } catch (error: any) {
      alert('Erreur lors de la création: ' + error.message);
    }
  };

  const handleUpdate = async () => {
    if (!editingProvider) return;

    try {
      await updateMutation.mutateAsync({
        id: editingProvider.id,
        ...formData
      });
      setShowForm(false);
      setEditingProvider(null);
      refetch();
    } catch (error: any) {
      alert('Erreur lors de la mise à jour: ' + error.message);
    }
  };

  const handleEdit = (provider: any) => {
    setEditingProvider(provider);
    setFormData({
      provider_code: provider.provider_code,
      provider_name: provider.provider_name,
      api_endpoint: provider.api_endpoint || '',
      api_key: '',
      api_secret: '',
      webhook_secret: provider.webhook_secret || '',
      transaction_fee_percent: provider.transaction_fee_percent,
      transaction_fee_fixed: provider.transaction_fee_fixed,
      min_amount: provider.min_amount,
      max_amount: provider.max_amount,
      is_test_mode: provider.is_test_mode,
      is_active: provider.is_active
    });
    setShowForm(true);
  };

  const handleTest = async (providerId: string) => {
    setTestingProvider(providerId);
    try {
      const result = await testMutation.mutateAsync(providerId);
      setTestResult({ ...testResult, [providerId]: result });
    } catch (error: any) {
      setTestResult({
        ...testResult,
        [providerId]: { success: false, error: error.message }
      });
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSubmit = () => {
    if (editingProvider) {
      handleUpdate();
    } else {
      handleCreate();
    }
  };

  const getProviderBadge = (code: string) => {
    const colors: { [key: string]: string } = {
      orange: 'bg-orange-100 text-orange-800',
      moov: 'bg-yellow-100 text-yellow-800',
      mtn: 'bg-yellow-100 text-yellow-800',
      wave: 'bg-blue-100 text-blue-800'
    };
    return colors[code] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Fournisseurs Mobile Money</h3>
          <p className="mt-1 text-sm text-gray-500">
            Configurez les fournisseurs de paiement Mobile Money
          </p>
        </div>
        <button
          onClick={() => {
            setEditingProvider(null);
            setShowForm(true);
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un fournisseur
        </button>
      </div>

      {/* Providers List */}
      <div className="bg-white shadow rounded-lg">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : providers && providers.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {providers.map((provider: any) => (
              <div key={provider.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h4 className="text-lg font-medium text-gray-900">
                        {provider.provider_name}
                      </h4>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getProviderBadge(provider.provider_code)}`}>
                        {provider.provider_code.toUpperCase()}
                      </span>
                      {provider.is_active ? (
                        <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">
                          Actif
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-800">
                          Inactif
                        </span>
                      )}
                      {provider.is_test_mode && (
                        <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                          Mode Test
                        </span>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Frais de transaction</p>
                        <p className="font-medium text-gray-900">
                          {provider.transaction_fee_percent}% + {provider.transaction_fee_fixed} FCFA
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Limites</p>
                        <p className="font-medium text-gray-900">
                          {Math.round(provider.min_amount).toLocaleString('fr-FR')} - {Math.round(provider.max_amount).toLocaleString('fr-FR')} FCFA
                        </p>
                      </div>
                    </div>

                    {/* Test Result */}
                    {testResult[provider.id] && (
                      <div className={`mt-4 p-3 rounded-lg ${
                        testResult[provider.id].success ?
                           'bg-green-50 border border-green-200'
                          : 'bg-red-50 border border-red-200'
                      }`}>
                        <div className="flex items-center">
                          {testResult[provider.id].success ? (
                            <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600 mr-2" />
                          )}
                          <span className="text-sm font-medium">
                            {testResult[provider.id].success ?
                               'Connexion réussie'
                              : testResult[provider.id].error || 'Échec de la connexion'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleTest(provider.id)}
                      disabled={testingProvider === provider.id}
                      className="p-2 text-gray-400 hover:text-gray-600"
                      title="Tester la connexion"
                    >
                      {testingProvider === provider.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <TestTube className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleEdit(provider)}
                      className="p-2 text-gray-400 hover:text-blue-600"
                      title="Modifier"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            Aucun fournisseur configuré. Cliquez sur "Ajouter un fournisseur" pour commencer.
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingProvider ? 'Modifier le fournisseur' : 'Ajouter un fournisseur'}
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fournisseur *
                    </label>
                    <select
                      value={formData.provider_code}
                      onChange={(e) => setFormData({ ...formData, provider_code: e.target.value })}
                      disabled={!!editingProvider}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    >
                      <option value="orange">Orange Money</option>
                      <option value="moov">Moov Money</option>
                      <option value="mtn">MTN Mobile Money</option>
                      <option value="wave">Wave</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nom d'affichage *
                    </label>
                    <input
                      type="text"
                      value={formData.provider_name}
                      onChange={(e) => setFormData({ ...formData, provider_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Ex: Orange Money CI"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Endpoint *
                  </label>
                  <input
                    type="url"
                    value={formData.api_endpoint}
                    onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="https://api.orange.com"
                  />
                </div>

                {!editingProvider && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        API Key *
                      </label>
                      <input
                        type="password"
                        value={formData.api_key}
                        onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        API Secret *
                      </label>
                      <input
                        type="password"
                        value={formData.api_secret}
                        onChange={(e) => setFormData({ ...formData, api_secret: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Webhook Secret
                  </label>
                  <input
                    type="password"
                    value={formData.webhook_secret}
                    onChange={(e) => setFormData({ ...formData, webhook_secret: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Secret pour vérifier les webhooks"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Frais (%) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.transaction_fee_percent}
                      onChange={(e) => setFormData({ ...formData, transaction_fee_percent: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Frais fixe (FCFA) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.transaction_fee_fixed}
                      onChange={(e) => setFormData({ ...formData, transaction_fee_fixed: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mode Test
                    </label>
                    <div className="mt-2">
                      <label className="inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.is_test_mode}
                          onChange={(e) => setFormData({ ...formData, is_test_mode: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                        />
                        <span className="ml-2 text-sm text-gray-600">Activer</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Montant minimum (FCFA) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.min_amount}
                      onChange={(e) => setFormData({ ...formData, min_amount: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Montant maximum (FCFA) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.max_amount}
                      onChange={(e) => setFormData({ ...formData, max_amount: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingProvider(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

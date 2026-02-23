'use client';

import { useState } from 'react';
import { useAuth, useLicenses, exportApiTokenQueries, createApiToken, revokeApiToken, type ExportApiToken } from '@novaconnect/data';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ApiTokensPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const schoolId = user?.schoolId || '';

  // Premium check
  const { data: license } = useLicenses(schoolId);
  const hasPremium = license?.license_type === 'premium' || license?.license_type === 'enterprise';
  const moduleEnabled = license?.enabled_modules?.includes('api_export');

  // State
  const [isOpen, setIsOpen] = useState(false);
  const [showNewToken, setShowNewToken] = useState(false);
  const [newToken, setNewToken] = useState('');
  const [copied, setCopied] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [rateLimit, setRateLimit] = useState(100);
  const [expiresAt, setExpiresAt] = useState('');

  // Query
  const { data: tokens, isLoading } = useQuery(exportApiTokenQueries.getAll(schoolId));

  // Mutations
  const createMutation = useMutation({
    mutationFn: createApiToken,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['export_api_tokens'] });
      setNewToken(result.token);
      setShowNewToken(true);
      setIsOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      alert(`Erreur: ${error.message}`);
    }
  });

  const revokeMutation = useMutation({
    mutationFn: revokeApiToken,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export_api_tokens'] });
      alert('Jeton révoqué avec succès');
    },
    onError: (error: any) => {
      alert(`Erreur: ${error.message}`);
    }
  });

  // Handlers
  const handleCreate = () => {
    resetForm();
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const tokenData = {
      name,
      description,
      permissions,
      rate_limit_per_hour: rateLimit,
      expires_at: expiresAt || undefined
    };

    await createMutation.mutateAsync(tokenData);
  };

  const handleRevoke = async (tokenId: string) => {
    if (confirm('Êtes-vous sûr de vouloir révoquer ce jeton ? Cette action est irréversible.')) {
      await revokeMutation.mutateAsync(tokenId);
    }
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(newToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDismissNewToken = () => {
    setShowNewToken(false);
    setNewToken('');
    setCopied(false);
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setPermissions([]);
    setRateLimit(100);
    setExpiresAt('');
  };

  const maskToken = (token: ExportApiToken) => {
    // Token would have been hashed, but we can show a pattern
    return `nova_export_...${token.id.slice(0, 8)}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'Pp', { locale: fr });
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
      {/* New Token Display Modal */}
      {showNewToken && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6">
              <div className="flex items-start mb-4">
                <svg
                  className="h-6 w-6 text-green-600 mr-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Jeton créé avec succès</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Copiez ce jeton maintenant. Vous ne pourrez plus le voir après avoir fermé cette fenêtre.
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <label className="text-xs font-medium text-gray-500 block mb-2">
                  Jeton d'API
                </label>
                <div className="flex items-center space-x-2">
                  <code className="flex-1 text-sm bg-white px-3 py-2 rounded border select-all">
                    {newToken}
                  </code>
                  <button
                    onClick={handleCopyToken}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    {copied ? 'Copié!' : 'Copier'}
                  </button>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> Stockez ce jeton de manière sécurisée. Ne le partagez pas et ne le commitez pas dans le code.
                </p>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex justify-end">
              <button
                onClick={handleDismissNewToken}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                J'ai copié le jeton
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Jetons d'API</h1>
          <p className="text-gray-600 mt-2">Gérez les jetons d'accès pour l'API d'export</p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + Nouveau Jeton
        </button>
      </div>

      {/* Security Warning */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <svg
            className="h-5 w-5 text-red-600 mr-3 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-red-900">Sécurité importante</h3>
            <p className="text-sm text-red-800 mt-1">
              Les jetons d'API donnent un accès complet à vos données d'export. Ne les partagez jamais, ne les commitez pas dans votre code,
              et révoquez-les s'ils sont compromis. Traitez-les comme des mots de passe.
            </p>
          </div>
        </div>
      </div>

      {/* Tokens Table */}
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
                  Permissions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Limite (heures)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dernier usage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilisations
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
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    Chargement...
                  </td>
                </tr>
              ) : tokens && tokens.length > 0 ? (
                tokens.map((token) => (
                  <tr key={token.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {token.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {token.description || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {token.permissions?.length || 0} permission(s)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {token.rate_limit_per_hour || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(token.last_used_at || null)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {token.usage_count || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {token.revoked_at ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                          Révoqué
                        </span>
                      ) : token.expires_at && new Date(token.expires_at) < new Date() ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                          Expiré
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                          Actif
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {!token.revoked_at && (
                        <button
                          onClick={() => handleRevoke(token.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Révoquer
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    Aucun jeton créé. Créez votre premier jeton d'API pour commencer.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Token Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Nouveau Jeton d'API</h2>
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
                    Nom du jeton *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Intégration ERP"
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
                    placeholder="Description de l'utilisation prévue..."
                  />
                </div>

                {/* Rate Limit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Limite de requêtes par heure
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={rateLimit}
                    onChange={(e) => setRateLimit(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Nombre maximal de requêtes autorisées par heure (défaut: 100)
                  </p>
                </div>

                {/* Expiration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date d'expiration (optionnel)
                  </label>
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Laissez vide pour un jeton sans expiration
                  </p>
                </div>

                {/* Security Note */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Après la création, vous ne pourrez voir le jeton qu'une seule fois.
                    Assurez-vous de le copier et de le stocker en sécurité.
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
                  disabled={createMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Création...' : 'Créer le Jeton'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

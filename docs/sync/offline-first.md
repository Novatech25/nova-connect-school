# Architecture Offline-First

## Vue d'ensemble

NovaConnect utilise une architecture offline-first, permettant à l'application de fonctionner sans connexion internet et de synchroniser automatiquement les données lorsque la connectivité est rétablie. Cela assure la fiabilité dans les zones avec une connexion internet instable et offre une meilleure expérience utilisateur.

## Principes d'Architecture

1. **Local-First** : Toutes les données sont stockées localement en premier
2. **Synchronisation en Arrière-Plan** : La synchronisation se produit en arrière-plan
3. **Résolution de Conflits** : Gestion automatique et manuelle des conflits
4. **UI Optimiste** : L'interface se met à jour immédiatement sans attendre le serveur
5. **Amélioration Progressive** : Les fonctionnalités principales fonctionnent hors ligne

## Composants

### 1. Couche de Stockage

La couche de stockage fournit une interface unifiée pour différents backends de stockage :

```typescript
// packages/sync/src/storage/types.ts
export interface StorageAdapter {
  init(): Promise<void>;
  get<T>(key: string, storeName?: string): Promise<T | null>;
  set<T>(key: string, value: T, storeName?: string): Promise<void>;
  remove(key: string, storeName?: string): Promise<void>;
  clear(storeName?: string): Promise<void>;
  keys(storeName?: string): Promise<string[]>;
  getAll<T>(storeName?: string): Promise<T[]>;
}
```

#### Stockage Web (IndexedDB)

```typescript
// packages/sync/src/storage/indexed-db.ts
export class IndexedDBStorage implements StorageAdapter {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('NovaConnect', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Créer les magasins
        db.createObjectStore('queue', { keyPath: 'id' });
        db.createObjectStore('sync_metadata', { keyPath: 'key' });
        db.createObjectStore('sync_data', { keyPath: 'id' });
        db.createObjectStore('conflict_cache', { keyPath: 'id' });
      };
    });
  }

  async get<T>(key: string, storeName: string = 'queue'): Promise<T | null> {
    // Implémentation...
  }

  // ... autres méthodes
}
```

#### Stockage Mobile (AsyncStorage)

```typescript
// packages/sync/src/storage/async-storage.ts
export class AsyncStorageAdapter implements StorageAdapter {
  async init(): Promise<void> {
    // AsyncStorage ne nécessite pas d'initialisation
  }

  async get<T>(key: string, storeName: string = 'queue'): Promise<T | null> {
    const fullKey = `${storeName}_${key}`;
    const value = await AsyncStorage.getItem(fullKey);
    return value ? JSON.parse(value) : null;
  }

  async set<T>(key: string, value: T, storeName: string = 'queue'): Promise<void> {
    const fullKey = `${storeName}_${key}`;
    await AsyncStorage.setItem(fullKey, JSON.stringify(value));
  }

  // ... autres méthodes
}
```

### 2. File Hors Ligne

La file hors ligne stocke les opérations qui doivent être synchronisées :

```typescript
// packages/sync/src/queue/OfflineQueue.ts
export class OfflineQueue {
  private storage: StorageAdapter;
  private initialized: boolean = false;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.storage.init();
    this.initialized = true;
  }

  async add<T>(operation: OfflineOperation<T>): Promise<void> {
    await this.ensureInitialized();
    await this.storage.set(operation.id, operation, 'queue');
  }

  async getUnsynced(): Promise<OfflineOperation[]> {
    await this.ensureInitialized();
    const operations = await this.storage.getAll<OfflineOperation>('queue');
    return operations.filter(op => op.status === 'pending');
  }

  async markSynced(operationId: string): Promise<void> {
    await this.ensureInitialized();
    const operation = await this.storage.get<OfflineOperation>(operationId, 'queue');
    if (operation) {
      operation.status = 'synced';
      operation.syncedAt = new Date().toISOString();
      await this.storage.set(operationId, operation, 'queue');
    }
  }

  async remove(operationId: string): Promise<void> {
    await this.ensureInitialized();
    await this.storage.remove(operationId, 'queue');
  }
}
```

### 3. Moteur de Synchronisation

Le moteur de synchronisation gère la synchronisation avec le serveur :

```typescript
// packages/sync/src/SyncEngine.ts
export class SyncEngine {
  private queue: OfflineQueue;
  private apiClient: ApiClient;
  private conflictResolver: ConflictResolver;
  private syncInProgress: boolean = false;

  constructor(queue: OfflineQueue, apiClient: ApiClient) {
    this.queue = queue;
    this.apiClient = apiClient;
    this.conflictResolver = new ConflictResolver();
  }

  async push(): Promise<SyncResult> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    this.syncInProgress = true;

    try {
      const operations = await this.queue.getUnsynced();
      const results: SyncOperationResult[] = [];

      for (const operation of operations) {
        try {
          const result = await this.syncOperation(operation);
          results.push(result);

          if (result.success) {
            await this.queue.markSynced(operation.id);
          }
        } catch (error) {
          results.push({
            operationId: operation.id,
            success: false,
            error: error.message,
          });
        }
      }

      return {
        total: operations.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        operations: results,
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  async pull(): Promise<void> {
    const lastSync = await this.getLastSyncTimestamp();
    const changes = await this.apiClient.getChanges(lastSync);

    for (const change of changes) {
      await this.applyChange(change);
    }

    await this.updateLastSyncTimestamp();
  }
}
```

## Modèles d'Utilisation

### Création d'Accès aux Données Hors Ligne

```typescript
// packages/data/src/queries/students.ts
export const studentQueries = {
  async get(studentId: string): Promise<Student> {
    // Essayer le stockage local d'abord
    const localStudent = await storage.get<Student>(`student_${studentId}`);
    if (localStudent) {
      return localStudent;
    }

    // Récupérer depuis le serveur
    const remoteStudent = await apiClient.get(`/students/${studentId}`);

    // Mettre en cache localement
    await storage.set(`student_${studentId}`, remoteStudent);

    return remoteStudent;
  },

  async create(data: CreateStudentInput): Promise<Student> {
    // Créer un ID optimiste
    const tempId = `temp_${Date.now()}`;

    // Créer l'étudiant localement
    const newStudent: Student = {
      id: tempId,
      ...data,
      createdAt: new Date().toISOString(),
      synced: false,
    };

    await storage.set(`student_${tempId}`, newStudent);

    // Ajouter à la file de synchronisation
    await queue.add({
      id: generateId(),
      type: 'create',
      resource: 'students',
      data: newStudent,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    // Déclencher la synchronisation en arrière-plan
    syncEngine.push();

    return newStudent;
  },

  async update(studentId: string, data: UpdateStudentInput): Promise<Student> {
    // Obtenir l'étudiant actuel
    const student = await this.get(studentId);

    // Mettre à jour de manière optimiste
    const updatedStudent = { ...student, ...data, synced: false };
    await storage.set(`student_${studentId}`, updatedStudent);

    // Ajouter à la file de synchronisation
    await queue.add({
      id: generateId(),
      type: 'update',
      resource: 'students',
      resourceId: studentId,
      data,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    return updatedStudent;
  },
};
```

### Intégration React

```typescript
// apps/web/src/hooks/useOfflineMutation.ts
export function useOfflineMutation<T, D>(
  mutationFn: (data: D) => Promise<T>,
  options: UseMutationOptions<T, Error, D> = {}
) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return useMutation<T, Error, D>(mutationFn, {
    ...options,
    onMutate: async (variables) => {
      // Annuler les requêtes en cours
      await queryClient.cancelQueries(options.mutationKey);

      // Capturer la valeur précédente
      const snapshot = queryClient.getQueryData<T>(options.mutationKey as any);

      // Mettre à jour le cache de manière optimiste
      if (options.onMutate) {
        await options.onMutate(variables);
      }

      return { snapshot };
    },
    onError: (error, variables, context) => {
      // Annuler en cas d'erreur
      if (context?.snapshot) {
        queryClient.setQueryData(options.mutationKey as any, context.snapshot);
      }

      if (options.onError) {
        options.onError(error, variables, context);
      }
    },
    onSuccess: (data, variables, context) => {
      // Synchroniser avec le serveur lorsque en ligne
      if (isOnline) {
        syncEngine.push();
      }

      if (options.onSuccess) {
        options.onSuccess(data, variables, context);
      }
    },
  });
}
```

## Stratégies de Synchronisation

### 1. Synchronisation en Temps Réel

Synchroniser immédiatement après toute opération lors de la connexion :

```typescript
import { useEffect } from 'react';

export function useRealTimeSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Déclencher la synchronisation lors de la reconnexion
      syncEngine.push();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
```

### 2. Synchronisation Périodique

Synchroniser à intervalles réguliers lors de la connexion :

```typescript
import { useEffect, useRef } from 'react';

export function usePeriodicSync(interval: number = 60000) { // 1 minute
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const sync = () => {
      if (navigator.onLine) {
        syncEngine.push();
        syncEngine.pull();
      }
    };

    // Synchronisation initiale
    sync();

    // Synchronisation périodique
    intervalRef.current = setInterval(sync, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [interval]);
}
```

### 3. Synchronisation Manuelle

Permettre aux utilisateurs de déclencher la synchronisation manuellement :

```typescript
export function useManualSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const sync = async () => {
    if (!navigator.onLine) {
      throw new Error('Device is offline');
    }

    setIsSyncing(true);

    try {
      await syncEngine.push();
      await syncEngine.pull();
      setLastSync(new Date());
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  return { sync, isSyncing, lastSync };
}
```

## Modèles d'Interface Utilisateur

### Indicateur Hors Ligne

Afficher le statut de connexion aux utilisateurs :

```typescript
export function OfflineIndicator() {
  const isOnline = useRealTimeSync();

  return (
    <div className={`fixed bottom-4 right-4 px-4 py-2 rounded-lg ${
      isOnline ? 'bg-green-500' : 'bg-red-500'
    } text-white`}>
      {isOnline ? 'En ligne' : 'Hors ligne - Les changements seront synchronisés lors de la connexion'}
    </div>
  );
}
```

### Mises à Jour Optimistes

Mettre à jour l'interface immédiatement, annuler en cas d'erreur :

```typescript
export function useUpdateStudent() {
  const queryClient = useQueryClient();

  return useMutation(
    ({ studentId, data }: { studentId: string; data: UpdateStudentInput }) =>
      studentQueries.update(studentId, data),
    {
      onMutate: async ({ studentId, data }) => {
        // Annuler les requêtes en cours
        await queryClient.cancelQueries(['student', studentId]);

        // Capturer la valeur précédente
        const previousStudent = queryClient.getQueryData(['student', studentId]);

        // Mettre à jour de manière optimiste
        queryClient.setQueryData(['student', studentId], (old: any) => ({
          ...old,
          ...data,
        }));

        return { previousStudent };
      },
      onError: (error, variables, context) => {
        // Annuler
        if (context?.previousStudent) {
          queryClient.setQueryData(
            ['student', variables.studentId],
            context.previousStudent
          );
        }
      },
      onSuccess: (data, variables) => {
        // Rafraîchir pour assurer la cohérence
        queryClient.invalidateQueries(['student', variables.studentId]);
      },
    }
  );
}
```

### Affichage du Statut de Synchronisation

Afficher la progression de la synchronisation aux utilisateurs :

```typescript
export function SyncStatus() {
  const { sync, isSyncing, lastSync } = useManualSync();
  const pendingOps = usePendingOperations();

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={sync}
        disabled={isSyncing || !navigator.onLine}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        {isSyncing ? 'Synchronisation...' : 'Synchroniser maintenant'}
      </button>

      {pendingOps > 0 && (
        <span className="text-sm text-gray-600">
          {pendingOps} changements en attente de synchronisation
        </span>
      )}

      {lastSync && (
        <span className="text-sm text-gray-500">
          Dernière synchro : {format(lastSync, 'HH:mm:ss')}
        </span>
      )}
    </div>
  );
}
```

## Tests

### Tester les Fonctionnalités Hors Ligne

```typescript
describe('Opérations Étudiant Hors Ligne', () => {
  it('devrait créer un étudiant hors ligne et synchroniser lors de la connexion', async () => {
    // Passer hors ligne
    mockOffline(true);

    // Créer un étudiant
    const student = await studentQueries.create({
      firstName: 'John',
      lastName: 'Doe',
      gradeId: 'grade-123',
    });

    expect(student.synced).toBe(false);

    // Vérifier dans la file
    const queue = await storage.getAll<OfflineOperation>('queue');
    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe('create');

    // Passer en ligne
    mockOffline(false);

    // Déclencher la synchronisation
    await syncEngine.push();

    // Vérifier la synchronisation
    const syncedStudent = await apiClient.get(`/students/${student.id}`);
    expect(syncedStudent.firstName).toBe('John');
  });
});
```

## Optimisation des Performances

### Opérations par Lot

Regrouper plusieurs opérations ensemble :

```typescript
export class SyncEngine {
  private operationBatch: OfflineOperation[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  async addToBatch(operation: OfflineOperation) {
    this.operationBatch.push(operation);

    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushBatch();
      }, 1000); // Lot pendant 1 seconde
    }
  }

  async flushBatch() {
    if (this.operationBatch.length === 0) return;

    const operations = [...this.operationBatch];
    this.operationBatch = [];

    // Envoyer le lot au serveur
    await this.apiClient.syncBatch(operations);
  }
}
```

### Compression

Comprimer les charges utiles volumineuses avant synchronisation :

```typescript
import pako from 'pako';

export class CompressedSyncEngine extends SyncEngine {
  async push(): Promise<SyncResult> {
    const operations = await this.queue.getUnsynced();

    // Compresser les opérations
    const compressed = pako.gzip(JSON.stringify(operations));

    // Envoyer les données compressées
    const result = await this.apiClient.syncCompressed(compressed);

    return result;
  }
}
```

## Meilleures Pratiques

1. **Gestion du Cache**
   - Implémenter des limites de taille de cache
   - Utiliser l'éviction LRU pour les anciennes données
   - Effacer les données sensibles lors de la déconnexion

2. **Prévention des Conflits**
   - Utiliser des UUID pour toutes les entités
   - Inclure des horodatages dans toutes les opérations
   - Implémenter la transformation opérationnelle

3. **Gestion des Erreurs**
   - Réessayer les opérations échouées avec backoff exponentiel
   - Journaliser les échecs de synchronisation pour le débogage
   - Fournir un retour utilisateur sur les problèmes de synchronisation

4. **Sécurité**
   - Chiffrer les données sensibles au repos
   - Valider les données avant synchronisation
   - Utiliser HTTPS pour toutes les opérations de synchronisation

5. **Tests**
   - Tester scénarios hors ligne minutieusement
   - Simuler les pannes réseau
   - Vérifier la logique de résolution des conflits

## Dépannage

### Échecs de Synchronisation

**Symptôme** : Les opérations ne se synchronisent pas

**Solutions** :
1. Vérifier la connectivité réseau
2. Vérifier les identifiants API
3. Consulter les journaux de synchronisation
4. Vider la file de synchronisation et réessayer

### Incohérences de Données

**Symptôme** : Les données locales et distantes diffèrent

**Solutions** :
1. Utiliser `syncEngine.pull()` pour rafraîchir
2. Vider le cache local et resynchroniser
3. Résoudre manuellement les conflits

### Problèmes de Performance

**Symptôme** : Synchronisation lente ou interface lag

**Solutions** :
1. Implémenter le traitement par lots
2. Utiliser Web Workers pour le traitement
3. Optimiser les requêtes de stockage
4. Compresser les charges utiles

## Ressources

- **Résolution de Conflits** : [conflict-resolution.md](./conflict-resolution.md)
- **Documentation API** : [../api/rest-api.md](../api/rest-api.md)
- **Docs Architecture** : [../architecture/data-flow.md](../architecture/data-flow.md)

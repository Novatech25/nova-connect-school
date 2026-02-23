# Résolution de Conflits

## Vue d'ensemble

Dans les systèmes offline-first, les conflits surviennent lorsque les mêmes données sont modifiées sur plusieurs appareils hors ligne, entraînant des incohérences lors de la synchronisation. NovaConnect implémente une stratégie complète de résolution de conflits pour gérer ces scénarios.

## Types de Conflits

### 1. Même Champ Modifié (Update-Update)

Le client et le serveur modifient le même champ :

```typescript
// Le client change grade.score de 85 à 90
Client: { id: 'grade-123', score: 90, syncedAt: '2024-10-15T10:00:00Z' }

// Le serveur change grade.score de 85 à 88
Serveur: { id: 'grade-123', score: 88, updatedAt: '2024-10-15T10:05:00Z' }

// Conflit : Quel score doit être appliqué ?
```

### 2. Même Ressource Supprimée (Update-Delete)

Le client met à jour pendant que le serveur supprime (ou vice versa) :

```typescript
// Le client met à jour l'étudiant
Client: { id: 'student-456', name: 'John Doe', syncedAt: '...' }

// Le serveur supprime l'étudiant
Serveur: { id: 'student-456', deletedAt: '2024-10-15T10:00:00Z' }

// Conflit : La mise à jour doit-elle être appliquée ou la suppression prime ?
```

### 3. Création avec Même ID

Deux clients créent des ressources avec le même ID :

```typescript
// Le client A crée un étudiant
Client A: { id: 'temp-123', name: 'John', createdAt: '...' }

// Le client B crée un étudiant avec le même ID (collision)
Client B: { id: 'temp-123', name: 'Jane', createdAt: '...' }

// Conflit : Les deux clients pensent posséder l'ID
```

## Stratégies de Résolution de Conflits

### 1. Dernier-Écriture-Gagne (LWW)

Utiliser l'horodatage pour déterminer le gagnant :

```typescript
// packages/sync/src/resolution/last-write-wins.ts
export class LastWriteWinsResolver implements ConflictResolver {
  resolve(local: any, remote: any): ConflictResolution {
    const localTime = new Date(local.syncedAt || local.createdAt);
    const remoteTime = new Date(remote.updatedAt || remote.createdAt);

    if (remoteTime > localTime) {
      return {
        strategy: 'remote',
        data: remote,
        reason: 'Remote is newer',
      };
    } else if (localTime > remoteTime) {
      return {
        strategy: 'local',
        data: local,
        reason: 'Local is newer',
      };
    } else {
      // Les horodatages sont égaux, préférer remote
      return {
        strategy: 'remote',
        data: remote,
        reason: 'Timestamps equal, preferring remote',
      };
    }
  }
}
```

**Avantages** : Simple, déterministe, aucune intervention utilisateur nécessaire
**Inconvénients** : Peut perdre des données si les deux changements sont valides

### 2. Fusion au Niveau Champ

Fusionner les champs non conflictuels, appliquer une stratégie aux champs conflictuels :

```typescript
export class FieldLevelMergeResolver implements ConflictResolver {
  resolve(local: any, remote: any): ConflictResolution {
    const merged: any = { ...remote };
    const conflicts: Conflict[] = [];

    for (const field in local) {
      if (local[field] !== remote[field]) {
        if (field === 'updatedAt' || field === 'syncedAt') {
          continue; // Ignorer les métadonnées
        }

        // Vérifier si le champ a été modifié des deux côtés
        if (this.isModifiedInBoth(local, remote, field)) {
          // Utiliser la stratégie (ex: dernier-écrit-gagne)
          const winner = this.resolveField(local, remote, field);
          merged[field] = winner.value;
          conflicts.push({
            field,
            localValue: local[field],
            remoteValue: remote[field],
            resolvedValue: winner.value,
            strategy: winner.strategy,
          });
        } else {
          // Un seul côté a modifié, utiliser cette valeur
          merged[field] = local[field];
        }
      }
    }

    return {
      strategy: 'merge',
      data: merged,
      conflicts,
    };
  }

  private isModifiedInBoth(local: any, remote: any, field: string): boolean {
    // Les deux côtés ont des valeurs différentes
    return local[field] !== remote[field] &&
           // Et aucun n'est la valeur originale
           local[field] !== remote._original?.[field] &&
           remote[field] !== local._original?.[field];
  }

  private resolveField(local: any, remote: any, field: string): {
    value: any;
    strategy: string;
  } {
    // Utiliser dernier-écriture-gagne pour le champ
    const localTime = new Date(local.syncedAt);
    const remoteTime = new Date(remote.updatedAt);

    if (remoteTime > localTime) {
      return { value: remote[field], strategy: 'last-write-wins-remote' };
    } else {
      return { value: local[field], strategy: 'last-write-wins-local' };
    }
  }
}
```

**Avantages** : Préserve plus de données, réduit les conflits
**Inconvénients** : Plus complexe, peut créer un état invalide

### 3. Résolution Manuelle

Exiger que l'utilisateur choisisse entre les versions :

```typescript
export class ManualResolver implements ConflictResolver {
  async resolve(local: any, remote: any): Promise<ConflictResolution> {
    // Stocker le conflit pour résolution manuelle
    await this.storeConflict({
      id: generateId(),
      resourceType: local.resourceType || 'unknown',
      resourceId: local.id,
      local,
      remote,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    return {
      strategy: 'manual',
      data: remote, // Utiliser remote comme solution provisoire
      requiresManualResolution: true,
    };
  }
}
```

**Avantages** : L'utilisateur a un contrôle total
**Inconvénients** : Interrompt le workflow, nécessite l'attention de l'utilisateur

### 4. Résolution Sémantique

Utiliser une logique spécifique au domaine pour résoudre les conflits :

```typescript
export class SemanticResolver implements ConflictResolver {
  resolve(local: any, remote: any): ConflictResolution {
    // Gérer des cas spécifiques basés sur le type de ressource
    switch (local.resourceType) {
      case 'grades':
        return this.resolveGrade(local, remote);

      case 'attendance':
        return this.resolveAttendance(local, remote);

      case 'payments':
        return this.resolvePayment(local, remote);

      default:
        return this.defaultResolution(local, remote);
    }
  }

  private resolveGrade(local: any, remote: any): ConflictResolution {
    // Pour les notes, préférer la mise à jour de l'enseignant à celle de l'admin
    if (local.updatedBy === local.teacherId && remote.updatedBy !== remote.teacherId) {
      return {
        strategy: 'semantic',
        data: local,
        reason: 'Teacher update takes precedence',
      };
    }

    // Pour les scores, préférer la valeur la plus élevée (favorable à l'étudiant)
    if (local.score && remote.score && local.score !== remote.score) {
      return {
        strategy: 'semantic',
        data: {
          ...remote,
          score: Math.max(local.score, remote.score),
        },
        reason: 'Prefer higher grade for student',
      };
    }

    return this.defaultResolution(local, remote);
  }

  private resolveAttendance(local: any, remote: any): ConflictResolution {
    // Pour la présence, préférer "absent" à "présent" (conservateur)
    if (local.status === 'absent' || remote.status === 'absent') {
      return {
        strategy: 'semantic',
        data: {
          ...remote,
          status: 'absent',
        },
        reason: 'Prefer absent to ensure accuracy',
      };
    }

    return this.defaultResolution(local, remote);
  }

  private resolvePayment(local: any, remote: any): ConflictResolution {
    // Pour les paiements, additionner les montants (ne pas perdre les enregistrements)
    if (local.amount && remote.amount) {
      return {
        strategy: 'semantic',
        data: {
          ...remote,
          amount: local.amount + remote.amount,
        },
        reason: 'Combine payment amounts',
      };
    }

    return this.defaultResolution(local, remote);
  }

  private defaultResolution(local: any, remote: any): ConflictResolution {
    // Revenir à dernier-écriture-gagne
    return new LastWriteWinsResolver().resolve(local, remote);
  }
}
```

**Avantages** : Conscient du domaine, optimal pour des cas d'usage spécifiques
**Inconvénients** : Complexe, nécessite des connaissances du domaine

## Détection des Conflits

### Détecter les Conflits

```typescript
export class ConflictDetector {
  async detect(local: any, remote: any): Promise<Conflict | null> {
    // Vérifier la discordance de version
    if (local.version && remote.version && local.version !== remote.version) {
      return {
        type: 'version-mismatch',
        local,
        remote,
      };
    }

    // Vérifier la discordance d'horodatage de mise à jour
    const localTime = new Date(local.syncedAt || local.createdAt);
    const remoteTime = new Date(remote.updatedAt || remote.createdAt);

    // Si les deux ont été modifiés après la dernière synchro
    if (localTime > remoteTime && remoteTime > localTime) {
      return {
        type: 'concurrent-update',
        local,
        remote,
      };
    }

    // Vérifier les conflits au niveau des champs
    const fieldConflicts = this.detectFieldConflicts(local, remote);
    if (fieldConflicts.length > 0) {
      return {
        type: 'field-conflict',
        local,
        remote,
        fields: fieldConflicts,
      };
    }

    return null;
  }

  private detectFieldConflicts(local: any, remote: any): string[] {
    const conflicts: string[] = [];

    for (const field in local) {
      if (
        local[field] !== remote[field] &&
        !this.isMetadataField(field) &&
        this.isModifiedInBoth(local, remote, field)
      ) {
        conflicts.push(field);
      }
    }

    return conflicts;
  }

  private isMetadataField(field: string): boolean {
    return ['syncedAt', 'updatedAt', 'createdAt', 'synced'].includes(field);
  }

  private isModifiedInBoth(local: any, remote: any, field: string): boolean {
    // Implémentation...
    return false;
  }
}
```

## Flux de Résolution des Conflits

```typescript
export class ConflictManager {
  private detector: ConflictDetector;
  private resolver: ConflictResolver;

  async resolveConflict(local: any, remote: any): Promise<ConflictResolution> {
    // Détecter le conflit
    const conflict = await this.detector.detect(local, remote);

    if (!conflict) {
      // Aucun conflit, utiliser remote
      return {
        strategy: 'none',
        data: remote,
      };
    }

    // Journaliser le conflit
    await this.logConflict(conflict);

    // Résoudre basé sur le type
    const resolution = await this.resolver.resolve(local, remote);

    // Appliquer la résolution
    await this.applyResolution(resolution);

    // Notifier l'utilisateur si nécessaire
    if (resolution.requiresManualResolution) {
      await this.notifyUser(conflict);
    }

    return resolution;
  }

  private async logConflict(conflict: Conflict): Promise<void> {
    await storage.set(`conflict_${conflict.id}`, conflict, 'conflict_cache');
  }

  private async applyResolution(resolution: ConflictResolution): Promise<void> {
    // Mettre à jour le stockage local
    await storage.set(
      `resource_${resolution.data.id}`,
      resolution.data
    );

    // Journaliser la résolution
    await apiClient.logResolution({
      resolutionId: generateId(),
      strategy: resolution.strategy,
      data: resolution.data,
      timestamp: new Date().toISOString(),
    });
  }

  private async notifyUser(conflict: Conflict): Promise<void> {
    // Afficher une notification à l'utilisateur
    notificationService.show({
      title: 'Sync Conflict',
      message: 'Please resolve sync conflict in settings',
      type: 'warning',
      action: {
        label: 'Resolve',
        handler: () => this.openResolutionDialog(conflict),
      },
    });
  }

  private async openResolutionDialog(conflict: Conflict): Promise<void> {
    // Ouvrir l'interface de résolution des conflits
    dialog.open({
      component: ConflictResolutionDialog,
      props: { conflict },
    });
  }
}
```

## Interface Utilisateur pour Résolution Manuelle

```typescript
// apps/web/src/components/conflict/ConflictResolutionDialog.tsx
export function ConflictResolutionDialog({ conflict }: { conflict: Conflict }) {
  const [selectedVersion, setSelectedVersion] = useState<'local' | 'remote' | 'merge'>('remote');
  const [fieldResolutions, setFieldResolutions] = useState<Record<string, 'local' | 'remote'>>({});
  const { resolveConflict } = useConflictResolution();

  const handleResolve = async () => {
    const resolution = buildResolution(conflict, selectedVersion, fieldResolutions);
    await resolveConflict(resolution);
    dialog.close();
  };

  return (
    <div className="conflict-resolution-dialog">
      <h2>Résoudre le Conflit de Synchronisation</h2>

      <div className="conflict-info">
        <p>Ressource : {conflict.resourceType} (ID : {conflict.resourceId})</p>
        <p>Type de Conflit : {conflict.type}</p>
      </div>

      <div className="versions-comparison">
        <div className="version local">
          <h3>Votre Version</h3>
          <DataViewer data={conflict.local} />
        </div>

        <div className="version remote">
          <h3>Version du Serveur</h3>
          <DataViewer data={conflict.remote} />
        </div>
      </div>

      {conflict.type === 'field-conflict' && (
        <div className="field-resolution">
          <h3>Résoudre les Champs Individuellement</h3>
          {conflict.fields.map(field => (
            <div key={field} className="field-choice">
              <label>{field}</label>
              <select
                value={fieldResolutions[field] || 'remote'}
                onChange={(e) => setFieldResolutions({
                  ...fieldResolutions,
                  [field]: e.target.value as 'local' | 'remote'
                })}
              >
                <option value="local">Utiliser la vôtre</option>
                <option value="remote">Utiliser celle du serveur</option>
              </select>
              <div className="values">
                <span>Vôtre : {JSON.stringify(conflict.local[field])}</span>
                <span>Serveur : {JSON.stringify(conflict.remote[field])}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="resolution-actions">
        <button onClick={() => setSelectedVersion('local')}>
          Utiliser Votre Version
        </button>
        <button onClick={() => setSelectedVersion('remote')}>
          Utiliser la Version du Serveur
        </button>
        <button onClick={handleResolve}>
          Appliquer la Résolution
        </button>
      </div>
    </div>
  );
}
```

## Meilleures Pratiques

### 1. Prévenir les Conflits si Possible

```typescript
// Utiliser le verrouillage optimiste
export async function updateGrade(gradeId: string, data: UpdateGradeInput) {
  // Obtenir la note actuelle avec version
  const current = await storage.get<Grade>(`grade_${gradeId}`);

  // Vérifier la version avant mise à jour
  if (data.version !== current.version) {
    throw new ConflictError('Version mismatch', current, data);
  }

  // Mettre à jour avec nouvelle version
  const updated = {
    ...current,
    ...data,
    version: current.version + 1,
    syncedAt: new Date().toISOString(),
  };

  await storage.set(`grade_${gradeId}`, updated);

  return updated;
}
```

### 2. Utiliser la Transformation Opérationnelle

Pour l'édition collaborative :

```typescript
export class OperationalTransformation {
  transform(operation1: Operation, operation2: Operation): Operation {
    // Transformer operation1 contre operation2
    if (operation1.type === 'insert' && operation2.type === 'insert') {
      if (operation1.position < operation2.position) {
        return operation1;
      } else {
        return {
          ...operation1,
          position: operation1.position + operation2.text.length,
        };
      }
    }

    // Gérer les autres cas...
    return operation1;
  }
}
```

### 3. Implémenter les Métriques de Résolution de Conflits

```typescript
export class ConflictMetrics {
  private metrics: Map<string, number> = new Map();

  recordConflict(type: string): void {
    const current = this.metrics.get(type) || 0;
    this.metrics.set(type, current + 1);
  }

  getReport(): ConflictReport {
    return {
      total: Array.from(this.metrics.values()).reduce((a, b) => a + b, 0),
      byType: Object.fromEntries(this.metrics),
    };
  }

  getConflictsByResourceType(): Record<string, number> {
    // Implémentation...
    return {};
  }
}
```

### 4. Fournir un Retour Utilisateur Clair

```typescript
export function ConflictNotification({ conflict }: { conflict: Conflict }) {
  return (
    <div className="conflict-notification">
      <AlertIcon />
      <div>
        <h4>Conflit de Synchronisation Détecté</h4>
        <p>
          {conflict.resourceType} "{conflict.resourceId}" a des changements conflictuels.
        </p>
        <button onClick={() => openResolutionDialog(conflict)}>
          Résoudre Maintenant
        </button>
        <button onClick={() => resolveLater(conflict)}>
          Résoudre Plus Tard
        </button>
      </div>
    </div>
  );
}
```

## Tests de Résolution de Conflits

```typescript
describe('Résolution de Conflits', () => {
  it('devrait résoudre un conflit dernier-écriture-gagne', async () => {
    const local = { id: 'grade-123', score: 90, syncedAt: '2024-10-15T10:00:00Z' };
    const remote = { id: 'grade-123', score: 88, updatedAt: '2024-10-15T10:05:00Z' };

    const resolver = new LastWriteWinsResolver();
    const resolution = resolver.resolve(local, remote);

    expect(resolution.strategy).toBe('remote');
    expect(resolution.data.score).toBe(88);
  });

  it('devrait fusionner les champs non conflictuels', async () => {
    const local = {
      id: 'student-456',
      name: 'John Doe',
      phone: '123-456-7890',
      syncedAt: '2024-10-15T10:00:00Z'
    };

    const remote = {
      id: 'student-456',
      name: 'John Smith',
      email: 'john@example.com',
      updatedAt: '2024-10-15T10:05:00Z'
    };

    const resolver = new FieldLevelMergeResolver();
    const resolution = resolver.resolve(local, remote);

    expect(resolution.strategy).toBe('merge');
    expect(resolution.data.name).toBe('John Smith'); // Remote gagne (plus récent)
    expect(resolution.data.phone).toBe('123-456-7890'); // Local (pas modifié sur remote)
    expect(resolution.data.email).toBe('john@example.com'); // Remote (pas sur local)
  });

  it('devrait appliquer la résolution sémantique pour les notes', async () => {
    const local = {
      resourceType: 'grades',
      score: 85,
      teacherId: 'teacher-123',
      updatedBy: 'teacher-123',
      syncedAt: '2024-10-15T10:00:00Z'
    };

    const remote = {
      resourceType: 'grades',
      score: 88,
      teacherId: 'teacher-123',
      updatedBy: 'admin-456',
      updatedAt: '2024-10-15T10:05:00Z'
    };

    const resolver = new SemanticResolver();
    const resolution = resolver.resolve(local, remote);

    expect(resolution.strategy).toBe('semantic');
    expect(resolution.data.score).toBe(85); // La version de l'enseignant gagne
  });
});
```

## Dépannage

### Problème : Trop de Conflits

**Causes** :
- Forte contention sur les ressources
- Longues périodes hors ligne
- Plusieurs utilisateurs modifiant les mêmes données

**Solutions** :
1. Implémenter la fusion au niveau des champs
2. Utiliser la résolution sémantique
3. Ajouter le verrouillage optimiste
4. Réduire l'intervalle de synchronisation hors ligne

### Problème : Conflits Non Détectés

**Causes** :
- Suivi de version manquant
- Comparaison d'horodatage incorrecte
- Métadonnées non synchronisées

**Solutions** :
1. Ajouter un champ version à toutes les entités
2. Utiliser NTP pour des horodatages précis
3. Inclure toutes les métadonnées dans la synchronisation

### Problème : Les Résolutions Créent un État Invalide

**Causes** :
- La fusion au niveau des champs brise les contraintes
- La résolution sémantique a des bugs
- Validation manquante

**Solutions** :
1. Valider les données fusionnées
2. Utiliser des transactions pour les mises à jour atomiques
3. Ajouter des tests complets

## Ressources

- **Architecture Offline-First** : [offline-first.md](./offline-first.md)
- **Moteur de Synchro** : [../architecture/data-flow.md](../architecture/data-flow.md)
- **Guide de Tests** : [../testing.md](../testing.md)

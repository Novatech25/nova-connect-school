# Runbook de Réponse aux Incidents

## Vue d'ensemble

Ce runbook fournit des procédures étape par étape pour répondre aux incidents de sécurité, aux pannes de service et aux violations de données dans NovaConnect.

## Catégories d'Incidents

### Niveaux de Gravité

| Gravité | Description | Temps de Réponse | Exemple |
|----------|-------------|------------------|---------|
| **P1 - Critique** | Panne complète du service ou violation de données | Immédiat | Base de données supprimée, tous les utilisateurs verrouillés |
| **P2 - Élevé** | Fonctionnalité majeure indisponible ou problème de sécurité | 1 heure | Traitement des paiements en panne, tentative d'accès non autorisé |
| **P3 - Moyen** | Dégradation partielle du service | 4 heures | Performances lentes, certaines fonctionnalités en échec |
| **P4 - Faible** | Problème mineur avec solution de contournement disponible | 1 jour ouvrable | Faute de frappe dans l'interface, bug non critique |

## Équipe de Réponse aux Incidents

### Rôles et Responsabilités

| Rôle | Responsabilités Principales | Escalade |
|------|-----------------------------|----------|
| **Commandant d'Incident** | Coordination globale, prise de décision | CTO |
| **Lead Technique** | Investigation technique, résolution | Engineering Manager |
| **Lead Communication** | Communication interne/externe | Directeur Marketing |
| **Conseiller Juridique** | Conseil juridique, conformité réglementaire | CEO |
| **Support Client** | Communication utilisateurs, gestion des tickets | Support Manager |

## Procédure de Réponse aux Incidents

### Phase 1 : Détection et Identification (0-15 minutes)

#### 1.1 Détecter l'Incident
- **Alertes de Surveillance** : PagerDuty, Sentry, DataDog
- **Rapports Utilisateurs** : Tickets de support, e-mail, réseaux sociaux
- **Systèmes Automatisés** : Échecs des contrôles de santé, pics des taux d'erreur

**Actions** :
1. Accuser réception de l'alerte immédiatement
2. Évaluer la portée et la gravité initiales
3. Attribuer un niveau de gravité (P1-P4)
4. Notifier lquipe de réponse aux incidents

#### 1.2 Identifier le Type

**Incidents de Sécurité** :
- Tentative d'accès non autorisé
- Violation de données confirmée/soupçonnée
- Malware/ransomware détecté
- Attaque DDoS en cours

**Pannes de Service** :
- Service complètement indisponible
- Fonctionnalité majeure en panne
- Dégradation des performances
- Problèmes de connectivité à la base de données

**Incidents de Données** :
- Corruption de données
- Suppression accidentelle de données
- Problèmes d'intégrité des données
- Échec de sauvegarde

#### 1.3 Évaluation Initiale

**Informations à Recueillir** :
- Quand l'incident a-t-il commencé ?
- Quels systèmes/services sont affectés ?
- Combien d'utilisateurs sont impactés ?
- Une activité suspecte a-t-elle été détectée ?
- Changements/déploiements récents ?

**Commandes** :
```bash
# Vérifier le statut du système
curl https://api.novaconnect.com/api/health

# Vérifier les taux d'erreur dans Sentry
# Naviguer vers le tableau de bord Sentry

# Vérifier les déploiements récents
vercel ls

# Vérifier la connectivité de la base de données
psql $DATABASE_URL -c "SELECT 1;"
```

### Phase 2 : Confinement (15-60 minutes)

#### 2.1 Actions Immédiates

**Pour les Incidents de Sécurité** :
1. **Si attaque active** : Bloquer l'IP de l'attaquant
   ```bash
   # Via le tableau de bord Vercel/Cloudflare
   # Ajouter l'IP à la liste de blocage
   ```

2. **Si violation confirmée** : Faire une rotation des identifiants
   ```bash
   # Faire une rotation des mots de passe de la base de données
   # Faire une rotation des clés API
   # Réinitialiser les mots de passe des utilisateurs affectés
   ```

3. **Si malware détecté** : Isoler les systèmes affectés
   ```bash
   # Désactiver les services affectés
   # Déconnecter du réseau si nécessaire
   ```

**Pour les Pannes de Service** :
1. **Si le déploiement a causé le problème** : Annuler immédiatement
   ```bash
   ./scripts/rollback.sh web production
   ```

2. **Si problème de base de données** : Passer en mode lecture seule ou utiliser une sauvegarde
   ```bash
   # Activer le mode lecture seule
   # Ou promouvoir le réplica de lecture
   ```

3. **Si épuisement des ressources** : Augmenter la capacité
   ```bash
   # Mettre à l'échelle via le tableau de bord Vercel/Supabase
   ```

#### 2.2 Documenter les Actions

Créer un journal d'incident :
```markdown
# Journal d'Incident - [Date]

## Chronologie
- [Heure 1] : Incident détecté
- [Heure 2] : Confinement commencé
- [Heure 3] : Actions entreprises
- [Heure 4] : Statut actuel

## Actions Entreprises
1. [Action 1]
2. [Action 2]
3. [Action 3]

## Preuves
- [Journaux]
- [Captures d'écran]
- [Métriques]
```

### Phase 3 : Éradication (1-4 heures)

#### 3.1 Analyse de la Cause Racine

**Questions à Répondre** :
- Quelle était la cause racine ?
- Comment l'incident s'est-il produit ?
- Quelles vulnérabilités ont été exploitées ?
- Quels processus ont échoué ?

**Étapes d'Investigation** :
1. Réviser les journaux (Sentry, Supabase, Vercel)
2. Vérifier les changements de code récents
3. Réviser les journaux d'accès pour les anomalies
4. Interroger les membres de l'équipe concernés
5. Reproduire le problème en staging si possible

**Outils** :
```bash
# Voir les erreurs récentes
sentry-cli projects list

# Vérifier les journaux de la base de données
supabase db logs --limit 100

# Voir l'historique des déploiements
vercel ls

# Vérifier l'historique git
git log --oneline -20
```

#### 3.2 Développer un Plan de Résolution

**Composants du Plan** :
- Cause racine identifiée
- Étapes de résolution documentées
- Stratégie de test définie
- Plan d'annulation préparé
- Critères de validation spécifiés

### Phase 4 : Rétablissement (4-24 heures)

#### 4.1 Implémenter la Correction

**Liste de Vérification Pré-Déploiement** :
- [ ] Correction testée dans l'environnement de staging
- [ ] Plan d'annulation documenté
- [ ] Surveillance renforcée
- [ ] Équipe notifiée du déploiement
- [ ] Fenêtre de maintenance annoncée (si nécessaire)

**Déploiement** :
```bash
# Appliquer la correction
git checkout fix-branch
pnpm test
pnpm build

# Déployer en production
./scripts/deploy-web.sh
```

#### 4.2 Valider le Rétablissement

**Étapes de Validation** :
1. Les contrôles de santé réussissent
2. Les taux d'erreur reviennent à la normale
3. Les problèmes signalés par les utilisateurs sont résolus
4. La surveillance ne montre aucune anomalie
5. Les métriques de performance sont acceptables

**Commandes de Validation** :
```bash
# Contrôle de santé
curl https://api.novaconnect.com/api/health

# Vérifier les taux d'erreur
# Réviser le tableau de bord Sentry

# Test de charge
# Exécuter les flux utilisateurs critiques

# Performance des requêtes de base de données
psql $DATABASE_URL -c "EXPLAIN ANALYZE [slow query];"
```

### Phase 5 : Activités Post-Incident (1-7 jours)

#### 5.1 Rapport Post-Mortem

**Modèle** :
```markdown
# Post-Mortem : [Titre de l'Incident]

## Résumé Exécutif
- Qu'est-ce qui s'est passé ?
- Aperçu de l'impact
- Statut de la résolution

## Chronologie
| Heure | Événement | Durée |
|------|-----------|--------|

## Analyse de la Cause Racine
- Cause primaire
- Facteurs contributifs
- Ce qui n'a pas fonctionné

## Résolution
- Ce qui a corrigé le problème
- Combien de temps cela a pris
- Problèmes restants

## Évaluation de l'Impact
- Utilisateurs affectés
- Données affectées
- Impact financier
- Impact sur la réputation

## Éléments d'Action
- [ ] Mesures préventives
- [ ] Améliorations de processus
- [ ] Améliorations d'outils
- [ ] Besoins de formation

## Leçons Apprises
- Ce qui s'est bien passé
- Ce qui ne s'est pas bien passé
- Ce qui doit être amélioré
```

#### 5.2 Éléments d'Action

**Mesures Préventives** :
- Implémenter la surveillance automatisée
- Ajouter des tests automatisés
- Améliorer la gestion des erreurs
- Renforcer les contrôles de sécurité

**Améliorations de Processus** :
- Mettre à jour les runbooks
- Améliorer la documentation
- Effectuer des formations
- Affiner les procédures

#### 5.3 Communication

**Communication Interne** :
- Équipe d'ingénierie notifiée
- Direction informée
- Équipe de support mise à jour
- Post-mortem générale

**Communication Externe** (si nécessaire) :
- Page de statut mise à jour
- Notification aux clients envoyée
- Communication publique préparée
- Notification réglementaire (si requise)

## Scénarios d'Incidents Spécifiques

### Scénario 1 : Échec de Connexion à la Base de Données

**Symptômes** :
- L'API renvoie des erreurs 500
- "Database connection failed" dans les journaux
- Tous les utilisateurs incapables d'accéder aux données

**Actions Immédiates** :
1. Vérifier la page de statut Supabase
2. Vérifier les identifiants de la base de données
3. Tester la connectivité depuis la machine locale
4. Vérifier les paramètres du pool de connexions

**Commandes de Résolution** :
```bash
# Vérifier le statut de la base de données
psql $DATABASE_URL -c "SELECT version();"

# Vérifier les connexions actives
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Redémarrer le pool de connexions si nécessaire
# Via le tableau de bord Supabase
```

### Scénario 2 : Tentative d'Accès Non Autorisé

**Symptômes** :
- Plusieurs tentatives de connexion échouées
- Activité API inhabituelle
- Accès à des données non autorisées

**Actions Immédiates** :
1. Bloquer les adresses IP suspectes
2. Activer la surveillance renforcée
3. Réviser les journaux d'accès récents
4. Notifier l'équipe de sécurité

**Commandes** :
```sql
-- Vérifier les modèles d'accès inhabituels
SELECT user_id, COUNT(*), ip_address
FROM audit_logs
WHERE timestamp >= NOW() - INTERVAL '1 hour'
GROUP BY user_id, ip_address
HAVING COUNT(*) > 100;

-- Bloquer l'IP via le pare-feu
# Via le tableau de bord Vercel/Cloudflare
```

### Scénario 3 : Échec de Déploiement

**Symptômes** :
- Nouveau déploiement causant des erreurs
- Utilisateurs signalant des fonctionnalités brisées
- Augmentation du taux d'erreur dans Sentry

**Actions Immédiates** :
1. Annuler le déploiement
2. Investiguer la cause racine
3. Corriger en staging
4. Redéployer quand prêt

**Commandes** :
```bash
# Annulation
./scripts/rollback.sh web production

# Vérifier les journaux de déploiement
vercel logs

# Tester localement
pnpm build
pnpm test
```

### Scénario 4 : Violation de Données

**Symptômes** :
- Preuve d'exfiltration de données
- Accès non autorisé aux données
- Message de ransomware

**Actions Immédiates** :
1. **ISOLER** : Déconnecter les systèmes affectés
2. **ÉVALUER** : Déterminer la portée de la violation
3. **NOTIFIER** : Alerter la direction juridique et la hiérarchie
4. **DOCUMENTER** : Préserver les preuves
5. **RAPPORTER** : Notifier les autorités (si requis)

**Exigences Légales** :
- GDPR : Notifier dans les 72 heures
- Lois des États américains : Variable par état (certaines immédiates)
- Spécifiques à l'industrie : Suivre les exigences du secteur

### Scénario 5 : Traitement des Paiements en Panne

**Symptômes** :
- Utilisateurs incapables d'effectuer des paiements
- Erreurs de l'API de paiement
- Échecs de transactions

**Actions Immédiates** :
1. Vérifier le statut de la passerelle de paiement
2. Réviser les changements de code récents
3. Basculer vers une méthode de paiement de secours (si disponible)
4. Communiquer avec les utilisateurs

**Commandes** :
```bash
# Tester la passerelle de paiement
curl -X POST https://api.payment-provider.com/test

# Vérifier les journaux de paiement
# Via le tableau de bord du fournisseur de paiement

# Activer le mode de maintenance si nécessaire
```

## Modèles de Communication

### Notification Interne - Initiale

```
🚨 INCIDENT DÉCLARÉ

Gravité : P[1-4]
Description : [Brève description]
Impact : [Systèmes/utilisateurs affectés]
Commandant d'Incident : [Nom]
Statut : [Investigation/Confinement/Rétablissement]

Canal #incident-response créé
```

### Mise à Jour Interne - Progression

```
📊 MISE À JOUR D'INCIDENT

Incident : [Nom]
Durée : [X heures]
Statut : [Confinement/Éradication/Rétablissement]

Progression :
- [Ce qui a été fait]
- [Ce qui est actuellement en cours]
- [Prochaines étapes]

ETA : [Si connu]
```

### Notification Externe - Indisponibilité

```
⚠️ INTERRUPTION DE SERVICE

Nous rencontrons actuellement [type de problème].
Notre équipe travaille à le résoudre.

Mises à jour : https://status.novaconnect.com
Nous nous excusons pour le désagrément.
```

### Notification Externe - Violation de Sécurité

```
🔒 AVIS DE SÉCURITÉ

Nous avons récemment découvert [type d'incident].
[Ce qui s'est passé]
[Quelles données affectées]
[Ce que nous faisons]
[Ce que vous devez faire]

Pour plus d'informations : [lien]
```

## Surveillance et Métriques

### Métriques Clés à Suivre

**Pendant l'Incident** :
- Temps Moyen de Détection (MTTD)
- Temps Moyen de Réponse (MTTR)
- Temps Moyen de Résolution (MTTR)
- Nombre d'utilisateurs affectés
- % de disponibilité du système pendant l'incident

**Post-Incident** :
- Taux de récurrence
- Temps pour implémenter les mesures préventives
- Satisfaction de l'équipe avec la réponse
- Satisfaction client

### Amélioration Continue

**Questions de Révision** :
1. Aurions-nous pu détecter cela plus tôt ?
2. Notre réponse était-elle efficace ?
3. Avions-nous les bons outils ?
4. La communication était-elle efficace ?
5. Que pouvons-nous automatiser ?

## Matrice d'Escalade

| Temps | Gravité P1 | Gravité P2 | Gravité P3 |
|------|-----------|-----------|-----------|
| 0 min | Commandant d'Incident | Lead Technique | Lead Technique |
| 15 min | CTO | Engineering Manager | Engineering Manager |
| 30 min | CEO | CTO | CTO |
| 1 heure | Conseil d'administration (si critique) | VP Ingénierie | VP Ingénierie |
| 24 heures | Communication publique (si nécessaire) | Communication clients | Mise à jour de statut |

## Formation et Exercices

### Exercices Réguliers
- **Trimestriel** : Exercices sur table
- **Semestriel** : Simulation complète d'incident
- **Annuel** : Exercice d'incident majeur

### Scénarios d'Exercice
1. Panne complète du service
2. Simulation de violation de données
3. Réponse à une attaque DDoS
4. Réponse au ransomware
5. Reprise après sinistre naturel

## Ressources

### Outils de Réponse aux Incidents
- **Communication** : Slack, PagerDuty
- **Surveillance** : Sentry, DataDog, Supabase Logs
- **Documentation** : Notion, Confluence
- **Suivi de Projet** : Jira, Linear
- **Page de Statut** : status.novaconnect.com

### Contacts d'Urgence
- **Commandant d'Incident** : [Nom, Téléphone, E-mail]
- **Lead Technique** : [Nom, Téléphone, E-mail]
- **Conseiller Juridique** : [Nom, Téléphone, E-mail]
- **RP/Médias** : [Nom, Téléphone, E-mail]
- **Équipe Dirigeante** : [Noms, Téléphone, E-mail]

### Ressources Externes
- **Support Supabase** : https://supabase.com/support
- **Support Vercel** : https://vercel.com/support
- **Support Expo** : https://expo.dev/support
- **Support Sentry** : https://sentry.io/support/

## Dernière Mise à Jour

- Date : 2024-10-15
- Version : 1.0
- Dernier Exercice : [Date]
- Prochain Exercice : [Date]

## Annexes

### Annexe A : Modèle de Journal d'Incident

### Annexe B : Modèle de Post-Mortem

### Annexe C : Plan de Communication

### Annexe D : Contacts d'Urgence des Fournisseurs

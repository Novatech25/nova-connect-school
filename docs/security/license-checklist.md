# Liste de Vérification de Conformité des Licences

## Vue d'Ensemble

Cette liste de vérification assure que NovaConnect se conforme à toutes les licences de logiciels open-source et gère correctement la propriété intellectuelle.

## Politique de Licences

### Exigences Générales de Licence
- [ ] Politique de licences documentée et communiquée à tous développeurs
- [ ] Liste des licences open-source approuvées maintenue
- [ ] Liste des licences interdites maintenue (ex: GPL, AGPL)
- [ ] Processus de révision licence intégré dans workflow développement
- [ ] Conseiller juridique consulté sur questions de licences
- [ ] Formation conformité licences fournie aux développeurs

### Licences Approuvées

| Licence | Utilisation Possible | Restrictions | Notes |
|---------|---------------------|--------------|-------|
| MIT | ✅ | Aucune | Préférée pour bibliothèques |
| Apache 2.0 | ✅ | Aucune | Préférée pour bibliothèques |
| BSD 2-Clause | ✅ | Aucune | Acceptable |
| BSD 3-Clause | ✅ | Aucune | Acceptable |
| ISC | ✅ | Aucune | Acceptable |
| CC0 | ✅ | Aucune | Domaine public |
| MPL 2.0 | ⚠️ | Niveau fichier | Révision requise |
| LGPL | ⚠️ | Liaison dynamique uniquement | Révision requise |
| GPL | ❌ | Interdite | Virale - éviter |
| AGPL | ❌ | Interdite | Virale - éviter |
| SSPL | ❌ | Interdite | Source disponible uniquement |

## Gestion des Dépendances

### Gestion des Paquets
- [ ] Toutes dépendances déclarées dans fichiers package.json
- [ ] Informations licence capturées pour chaque dépendance
- [ ] Arbre des dépendances documenté
- [ ] Dépendances transitives révisées
- [ ] Aucune version non épinglée (^ ou ~) en production
- [ ] Fichiers verrou commités (package-lock.json, pnpm-lock.yaml)

### Vérification Automatisée des Licences
- [ ] Outil vérification licences configuré (ex: License Checker, FOSSA)
- [ ] Analyse automatisée licences dans pipeline CI/CD
- [ ] Échec build si licence interdite détectée
- [ ] Rapports licences générés automatiquement
- [ ] Exceptions licences documentées et approuvées

### Processus de Mise à Jour des Dépendances
- [ ] Mises à jour sécurité appliquées immédiatement indépendamment de la licence
- [ ] Mises à jour non-sécurité révisées pour changements de licence
- [ ] Changements de licence communiqués au juridique
- [ ] Mises à jour dépendances testées minutieusement
- [ ] Plan rollback en place pour mises à jour problématiques

## Propriété Intellectuelle

### Propriété du Code
- [ ] Tous contributeurs signent CLA (Contributor License Agreement)
- [ ] Accords PI employés en place
- [ ] Accords PI entrepreneurs en place
- [ ] Propriété code clairement définie
- [ ] Aucune information confidentielle d'employeurs précédents incluse
- [ ] Création code originale vérifiée

### Code Tiers
- [ ] Code tiers correctement attribué
- [ ] Licences code tiers compatibles avec notre licence
- [ ] Code copié documenté dans fichiers source
- [ ] Code tiers pas modifié sans comprendre impact licence
- [ ] Œuvres dérivées se conforment à licence originale

### Code Propriétaire
- [ ] Code propriétaire clairement identifié
- [ ] Code propriétaire pas distribué avec composants open-source
- [ ] Code propriétaire correctement protégé (secrets commerciaux)
- [ ] Accords de confidentialité en place pour code propriétaire

## Documentation des Licences

### Fichier NOTICE
- [ ] Fichier NOTICE créé dans racine projet
- [ ] Tous composants tiers listés
- [ ] Avis copyright inclus
- [ ] Informations licence incluses
- [ ] Attributions fournies où requis
- [ ] Fichier NOTICE inclus dans toutes distributions

### Fichier Licence
- [ ] Fichier LICENSE créé dans racine projet
- [ ] Licence projet principal clairement indiquée
- [ ] Licence comprend avis copyright
- [ ] Licence comprend octroi permission
- [ ] Licence comprend exonération garantie
- [ ] Licence comprend limitation responsabilité

### En-têtes de Fichiers Source
- [ ] En-tête licence dans fichiers source où requis
- [ ] Année copyright à jour
- [ ] Propriétaire copyright exact
- [ ] Type licence clairement indiqué
- [ ] Identifiant SPDX utilisé (ex: `SPDX-License-Identifier: MIT`)

## Attribution Tiers

### Application Web
- [ ] Page attributions tiers créée (/about/licenses)
- [ ] Toutes dépendances listées avec licences
- [ ] Textes licences liés ou affichés
- [ ] Attributions incluses dans pied de page
- [ ] Licences incluses dans builds production

### Application Mobile
- [ ] Écran licences implémenté (Paramètres > Licences)
- [ ] Toutes dépendances listées avec licences
- [ ] Textes licences affichés
- [ ] Attributions incluses dans paramètres application
- [ ] Licences incluses dans soumission store

### Passerelle API
- [ ] Informations licence dans documentation API
- [ ] Bibliothèques tiers documentées
- [ ] Attribution dans en-têtes réponse API si requis

## Workflow Conformité Licences

### Ajout de Nouvelles Dépendances
1. [ ] Vérifier si dépendance nécessaire
2. [ ] Identifier licence de dépendance
3. [ ] Vérifier licence sur liste approuvée
4. [ ] Si non approuvée, demander exception au juridique
5. [ ] Ajouter à package.json
6. [ ] Exécuter vérificateur licences
7. [ ] Documenter dépendance dans wiki interne
8. [ ] Mettre à jour fichier NOTICE si requis
9. [ ] Soumettre PR pour revue code
10. [ ] Revue code inclut vérification licence

### Suppression de Dépendances
- [ ] Vérifier si dépendance encore utilisée
- [ ] Supprimer de package.json
- [ ] Exécuter vérificateur licences
- [ ] Mettre à jour fichier NOTICE
- [ ] Tester minutieusement après suppression

### Mise à Jour des Dépendances
- [ ] Vérifier si nouvelle version a licence différente
- [ ] Réviser changements licence
- [ ] Mettre à jour documentation si nécessaire
- [ ] Tester minutieusement après mise à jour

## Considérations Spécifiques de Licence

### Licence MIT
- [ ] Avis copyright inclus
- [ ] Avis permission inclus
- [ ] Exonération incluse
- [ ] Aucune restriction supplémentaire ajoutée

### Licence Apache 2.0
- [ ] Avis copyright inclus
- [ ] Fichier LICENSE inclus
- [ ] Fichier NOTICE maintenu pour attributions requises
- [ ] Indiquer changements si modification fichiers
- [ ] Aucune restriction supplémentaire ajoutée

### Licences BSD
- [ ] Avis copyright inclus
- [ ] Texte licence inclus
- [ ] Exonération incluse
- [ ] Aucune utilisation approbation dans marketing

### MPL 2.0
- [ ] Fichiers source pour code couvert MPL séparés
- [ ] Modifications aux fichiers MPL marquées
- [ ] Licence MPL incluse avec fichiers MPL
- [ ] Aucune restriction supplémentaire sur fichiers MPL

## Gestion des Vulnérabilités

### Analyse des Vulnérabilités
- [ ] Analyse automatisée vulnérabilités dans CI/CD
- [ ] Surveillance vulnérabilités dépendances (Dependabot, Snyk)
- [ ] Avis sécurité surveillés
- [ ] Plan réponse vulnérabilités en place
- [ ] Vulnérabilités critiques corrigées dans les 72 heures
- [ ] Vulnérabilités élevées corrigées dans les 30 jours

### Violations de Licences
- [ ] Processus de gestion violations licences
- [ ] Conseiller juridique notifié des violations potentielles
- [ ] Plan remédiation documenté
- [ ] Violations résolues rapidement
- [ ] Leçons apprises documentées

## Documentation et Dossiers

### Dossiers des Dépendances
- [ ] Liste complète dépendances maintenue
- [ ] Informations licence pour chaque dépendance
- [ ] Informations version pour chaque dépendance
- [ ] URL source pour chaque dépendance
- [ ] Date ajout pour chaque dépendance
- [ ] Finalité chaque dépendance documentée

### Dossiers des Exceptions
- [ ] Exceptions licences documentées
- [ ] Raison exception documentée
- [ ] Approbation juridique documentée
- [ ] Date expiration exceptions (si applicable)
- [ ] Révision régulière des exceptions

### Dossiers de Formation
- [ ] Formation développeurs sur licences complétée
- [ ] Dossiers formation maintenus
- [ ] Intégration nouveaux développeurs inclut formation licences

## Licence Commerciale

### Double Licence
- [ ] Conditions licence commerciale documentées
- [ ] Licence open-source clairement distinguée de commerciale
- [ ] Chemin mise à niveau licence documenté
- [ ] Gestion clients licence commerciale

### Modèles de Licence
- [ ] Limitations niveau gratuit documentées
- [ ] Fonctionnalités niveau payant documentées
- [ ] Options licence entreprise documentées
- [ ] Mécanisme application licence documenté
- [ ] Surveillance conformité licences

## Conformité Export

### Contrôle des Exportations
- [ ] Classification export révisée (ECCN)
- [ ] Conformité export chiffrement vérifiée
- [ ] Dépistage parties refusées effectué
- [ ] Restrictions spécifiques par pays révisées
- [ ] Documentation conformité export maintenue

### Résidence des Données
- [ ] Exigences résidence données identifiées
- [ ] Lois localisation données respectées
- [ ] Conformité transfert données transfrontalier vérifiée

## Audit et Conformité

### Audits Internes
- [ ] Audits trimestriels conformité licences
- [ ] Audit inventaire dépendances
- [ ] Audit exactitude fichiers licence
- [ ] Audit complétude fichier NOTICE
- [ ] Audit complétude page attributions

### Audits Externes
- [ ] Audit tiers licences effectué annuellement
- [ ] Révision conseiller juridique conformité licences
- [ ] Couverture assurance pour violation PI
- [ ] Dispositions indemnisation dans accords fournisseurs

## Outils et Automatisation

### Outils Gestion Licences
- [ ] Outil vérification licences configuré
- [ ] Analyse automatique licences dans CI/CD
- [ ] Automatisation mise à jour dépendances (Dependabot)
- [ ] Génération SBOM (Software Bill of Materials)
- [ ] Tableau de bord conformité licences

### Intégration CI/CD
- [ ] Étape vérification licence dans pipeline build
- [ ] Échec build sur violations licences
- [ ] Rapports licences générés avec chaque build
- [ ] Exceptions licences révisées dans processus PR

## Bibliothèques Tiers Courantes

| Bibliothèque | Version | Licence | Finalité | ID SPDX |
|--------------|---------|---------|----------|---------|
| React | 18.x | MIT | Framework UI | MIT |
| Next.js | 14.x | MIT | Framework React | MIT |
| Supabase JS | 2.x | MIT | Client Base de Données | MIT |
| Expo | 50.x | MIT | Framework Mobile | MIT |
| Sentry | 7.x | MIT | Suivi Erreurs | MIT |
| Jest | 29.x | MIT | Tests | MIT |
| TypeScript | 5.x | Apache-2.0 | Langage | Apache-2.0 |
| Tailwind CSS | 3.x | MIT | Styles | MIT |
| Zod | 3.x | MIT | Validation | MIT |
| TanStack Query | 5.x | MIT | Récupération Données | MIT |
| Zustand | 4.x | MIT | Gestion État | MIT |

*(Ajouter toutes dépendances projet à ce tableau)*

## Ressources

- **Liste Licences SPDX** : https://spdx.org/licenses/
- **Choose a License** : https://choosealicense.com/
- **TLDRLegal** : https://www.tldrlegal.com/
- **FOSSA** : https://fossa.com/
- **Snyk License Checker** : https://snyk.io/
- **OSS Insight** : https://ossinsight.io/

## Dernière Mise à Jour

- Date : 2024-10-15
- Version : 1.0
- Révisé Par : [Nom], Conseiller Juridique
- Prochaine Révision : 2025-01-15

## Validation

- [ ] Responsable Ingénierie : ________________ Date : ______
- [ ] Conseiller Juridique : ________________ Date : ______
- [ ] CTO : ________________ Date : ______

# Liste de Vérification de Conformité GDPR

## Vue d'Ensemble

Cette liste de vérification assure la conformité de NovaConnect avec le Règlement Général sur la Protection des Données (GDPR) pour le traitement des données personnelles des résidents de l'UE.

## Principes de Traitement des Données

### Légalité, Équité et Transparence
- [ ] Base légale identifiée pour le traitement (consentement, contrat, obligation légale, intérêts vitaux, tâche publique, intérêts légitimes)
- [ ] La politique de confidentialité explique clairement quelles données sont collectées et pourquoi
- [ ] Notice de confidentialité fournie à toutes les personnes concernées
- [ ] Pratiques de traitement des données transparentes documentées

### Limitation de la Finalité
- [ ] Données collectées uniquement pour des finalités spécifiées, explicites et légitimes
- [ ] Données pas traitées ultérieurement de manière incompatible avec ces finalités
- [ ] Finalité de la collecte de données documentée pour chaque type de données

### Minimisation des Données
- [ ] Seules les données nécessaires pour la finalité déclarée sont collectées
- [ ] Périodes de rétention des données définies et appliquées
- [ ] Données inutiles supprimées ou anonymisées

### Exactitude
- [ ] Données personnelles exactes et maintenues à jour
- [ ] Données inexactes effacées ou corrigées sans délai
- [ ] Les personnes concernées peuvent mettre à jour leurs informations

### Limitation du Stockage
- [ ] Données conservées pas plus longtemps que nécessaire
- [ ] Périodes de rétention documentées (voir section Calendrier de Rétention)
- [ ] Processus de suppression automatique mis en œuvre
- [ ] Données archivées après expiration de la période de rétention

### Intégrité et Confidentialité
- [ ] Mesures techniques et organisationnelles en place pour la sécurité
- [ ] Contrôle d'accès mis en œuvre (voir Liste de Vérification RLS)
- [ ] Chiffrement des données au repos (chiffrement Supabase)
- [ ] Chiffrement des données en transit (HTTPS/TLS 1.3)
- [ ] Audits de sécurité réguliers effectués
- [ ] Formation du personnel à la protection des données complétée

## Droits des Personnes Concernées

### Droit d'Être Informé (Article 13 & 14)
- [ ] Notice de confidentialité fournie au moment de la collecte
- [ ] La notice comprend :
  - [ ] Identité et coordonnées du responsable du traitement
  - [ ] Finalité et base légale du traitement
  - [ ] Intérêts légitimes (si applicable)
  - [ ] Destinataires des données personnelles
  - [ ] Transfert de données vers des pays tiers (si applicable)
  - [ ] Période de rétention ou critères
  - [ ] Droits des personnes concernées
  - [ ] Droit de retirer le consentement
  - [ ] Droit de déposer une plainte auprès de l'autorité de contrôle
  - [ ] Si la fourniture de données est statutaire ou contractuelle
  - [ ] Décision automatisée (si applicable)

### Droit d'Accès (Article 15)
- [ ] Les personnes concernées peuvent demander une copie de leurs données personnelles
- [ ] Demande d'accès implémentée dans le portail utilisateur (`/settings/privacy`)
- [ ] Réponse fournie dans les 30 jours
- [ ] Copie des données fournie dans un format électronique couramment utilisé
- [ ] Informations sur :
  - [ ] Finalité du traitement
  - [ ] Catégories de données personnelles
  - [ ] Destinataires des données
  - [ ] Période de rétention
  - [ ] Droit à rectification, effacement, restriction
  - [ ] Droit de déposer une plainte

### Droit de Rectification (Article 16)
- [ ] Les personnes concernées peuvent corriger les données inexactes
- [ ] Les personnes concernées peuvent compléter les données incomplètes
- [ ] Rectification implémentée dans le portail utilisateur
- [ ] Modifications traitées dans les 30 jours

### Droit à l'Effacement (Droit à l'Oubli) (Article 17)
- [ ] Les personnes concernées peuvent demander la suppression lorsque :
  - [ ] Les données ne sont plus nécessaires pour la finalité déclarée
  - [ ] Le consentement est retiré et aucune autre base légale
  - [ ] La personne concernée s'oppose au traitement et aucun motif impérieux
  - [ ] Données traitées illicitement
  - [ ] Effacement requis par obligation légale
- [ ] Effacement implémenté dans le portail utilisateur (`/settings/privacy/delete-account`)
- [ ] Processus de suppression complété dans les 30 jours
- [ ] Exceptions documentées :
  - [ ] Liberté d'expression et d'information
  - [ ] Obligation légale d'effectuer le traitement
  - [ ] Intérêt public dans le domaine de la santé publique
  - [ ] Fins d'archivage dans l'intérêt public
  - [ ] Revendications légales
- [ ] Trace d'audit maintenue pour les suppressions

### Droit de Limiter le Traitement (Article 18)
- [ ] Les personnes concernées peuvent limiter le traitement lorsque :
  - [ ] Exactitude contestée pour une période permettant vérification
  - [ ] Traitement illicite mais personne concernée s'oppose à l'effacement
  - [ ] Responsable n'a plus besoin des données mais personne en a besoin pour revendications légales
  - [ ] Opposition au traitement en attente de vérification
- [ ] Processus de demande de restriction implémenté
- [ ] Données restreintes clairement marquées

### Droit à la Portabilité des Données (Article 20)
- [ ] Les personnes concernées peuvent recevoir les données personnelles dans un format structuré, couramment utilisé
- [ ] Les personnes concernées peuvent transmettre les données à un autre responsable
- [ ] Portabilité implémentée dans le portail utilisateur (`/settings/privacy/export-data`)
- [ ] Export fourni au format JSON/CSV
- [ ] Transfert direct de données vers un autre responsable supporté lorsque techniquement possible

### Droit d'Opposition (Article 21)
- [ ] Les personnes concernées peuvent s'opposer au traitement basé sur des intérêts légitimes
- [ ] Les personnes concernées peuvent s'opposer au traitement pour le marketing direct
- [ ] Processus d'opposition implémenté
- [ ] Opposition honorée à moins que le responsable ne démontre des motifs impérieux

### Droits Liés à la Décision Automatisée et au Profilage (Article 22)
- [ ] Les personnes concernées ne sont pas soumises à une décision purement automatisée produisant des effets juridiques
- [ ] Les personnes concernées peuvent exprimer leur point de vue
- [ ] Les personnes concernées peuvent contester la décision
- [ ] Intervention humaine disponible pour les décisions importantes

## Données à Caractère Personnel Spécial (Article 9)

Les données à caractère personnel spécial comprennent :
- Origine raciale ou ethnique
- Opinions politiques
- Croyances religieuses ou philosophiques
- Appartenance syndicale
- Données génétiques
- Données biométriques (à des fins d'identification)
- Données de santé
- Vie sexuelle ou orientation sexuelle

Exigences :
- [ ] Consentement explicite obtenu pour le traitement des données à caractère spécial
- [ ] Informations médicales traitées avec sécurité supplémentaire
- [ ] Minimisation des données strictement appliquée
- [ ] Consentement séparé pour chaque catégorie spéciale
- [ ] Les personnes concernées peuvent retirer le consentement à tout moment
- [ ] Données à caractère spécial stockées dans des champs chiffrés

## Base Légale du Traitement

Documenter la base légale pour chaque activité de traitement :

| Type de Données | Base Légale | Justification | Documenté |
|----------------|-------------|---------------|------------|
| Profil Élève | Contrat | Exécution du contrat éducatif | ✅ |
| Contact Tuteur | Contrat | Nécessaire pour la sécurité et communication de l'élève | ✅ |
| Dossiers Académiques | Obligation Légale | Requis par les autorités éducatives | ✅ |
| Présences | Obligation Légale | Requis par les réglementations éducatives | ✅ |
| Notes | Intérêts Légitimes | Évaluation et rapport éducatif | ✅ |
| Informations de Santé | Consentement Explicite | Urgences médicales et soins | ✅ |
| Données de Paiement | Contrat | Paiement des frais de scolarité | ✅ |
| Identifiants de Connexion | Intérêts Légitimes | Sécurité et accès au système | ✅ |
| Données Comportementales | Consentement | Analytique d'apprentissage et amélioration | ✅ |

## Analyse d'Impact sur la Protection des Données (DPIA)

Une DPIA est requise lorsque le traitement est susceptible de présenter un risque élevé pour les personnes. Compléter la DPIA pour :

- [ ] Évaluation systématique et extensive d'aspects personnels (profilage)
- [ ] Traitement à grande échelle de données à caractère spécial
- [ ] Surveillance à grande échelle de zones publiques
- [ ] Traitement des données des élèves pour l'analytique comportementale

Liste de vérification DPIA :
- [ ] Description systématique du traitement
- [ ] Évaluation de la nécessité et de la proportionnalité
- [ ] Risques pour les droits et libertés des personnes concernées
- [ ] Mesures pour traiter les risques (sécurité, garanties, mécanismes)
- [ ] Consultation avec l'autorité de contrôle (si risque élevé persiste)

## Gestion des Violations de Données

### Détection des Violations
- [ ] Systèmes automatisés de détection des violations en place
- [ ] Formation du staff pour identifier les violations
- [ ] Mécanismes de signalement pour les violations suspectées

### Notification des Violations
- [ ] Violations signalées à l'autorité de contrôle dans les 72 heures
- [ ] La notification comprend :
  - [ ] Nature de la violation
  - [ ] Catégories et nombre approximatif de personnes concernées
  - [ ] Catégories et nombre approximatif d'enregistrements de données personnelles concernés
  - [ ] Conséquences probables
  - [ ] Mesures prises ou proposées pour traiter la violation
- [ ] Violations à haut risque communiquées aux personnes concernées sans délai injustifié
- [ ] La communication de violation comprend :
  - [ ] Nature de la violation
  - [ ] Nom et contact du DPO
  - [ ] Conséquences probables
  - [ ] Mesures prises pour traiter la violation

### Plan de Réponse aux Violations
- [ ] Équipe d'intervention aux incidents identifiée
- [ ] Procédures de réponse documentées
- [ ] Modèles de communication préparés
- [ ] Conseiller juridique identifié
- [ ] Procédures de réponse testées annuellement

## Protection des Données par la Conception et par Défaut

### Par la Conception
- [ ] Protection des données intégrée dans le cycle de développement
- [ ] Évaluations d'impact sur la confidentialité menées pour les nouvelles fonctionnalités
- [ ] Exigences de protection des données dans les spécifications de conception
- [ ] Technologies améliorant la confidentialité utilisées lorsque possible

### Par Défaut
- [ ] Seules les données nécessaires pour la finalité spécifique sont traitées
- [ ] Données personnelles pas automatiquement accessibles à un nombre illimité de personnes
- [ ] Données personnelles pas automatiquement utilisées pour des finalités secondaires
- [ ] Politiques RLS appliquent un accès minimal (voir Liste de Vérification RLS)
- [ ] Anonymisation des données utilisée lorsque l'identification n'est pas requise

## Transferts Internationaux de Données

En cas de transfert de données hors UE/EEE :
- [ ] Décision d'adéquation vérifiée pour le pays de destination
- [ ] Clauses Contractuelles Types (SCCs) utilisées si aucune décision d'adéquation
- [ ] Règles Internes d'Entreprise (BCRs) en place pour les transferts intra-groupe
- [ ] Personnes concernées informées des transferts internationaux
- [ ] Garanties appropriées vérifiées
- [ ] Droits des personnes concernées applicables et recours juridiques disponibles

## Gestion des Sous-Traitants

Lors de l'utilisation de sous-traitants (ex: Supabase, Vercel, Sentry) :
- [ ] Accord de sous-traitance en place
- [ ] Sous-traitant agit uniquement sur instructions du responsable
- [ ] Sous-traitant fournit des garanties suffisantes pour la conformité GDPR
- [ ] Sous-traitant assiste pour les droits des personnes concernées
- [ ] Sous-traitant assiste pour les mesures de sécurité
- [ ] Sous-traitant assiste pour la notification de violation
- [ ] Sous-traitant peut utiliser sous-sous-traitant uniquement avec autorisation
- [ ] Sous-traitant retourne ou supprime toutes données personnelles après fin du contrat
- [ ] Sous-traitant permet les audits par le responsable ou l'auditeur

## Délégué à la Protection des Données (DPO)

- [ ] DPO nommé (requis pour :
  - [ ] Autorités publiques
  - [ ] Activités principales impliquent une surveillance régulière et systématique à grande échelle
  - [ ] Activités principales impliquent un traitement à grande échelle de données spéciales)
- [ ] Coordonnées DPO fournies : privacy@novaconnect.com
- [ ] DPO rend compte au plus haut niveau de direction
- [ ] Tâches du DPO :
  - [ ] Informer et conseiller le responsable/sous-traitant sur les obligations GDPR
  - [ ] Surveiller la conformité au GDPR
  - [ ] Conseiller sur la DPIA et surveiller la performance
  - [ ] Coopérer avec l'autorité de contrôle
  - [ ] Agir comme point de contact pour l'autorité de contrôle
- [ ] DPO fourni avec ressources pour accomplir les tâches
- [ ] DPO pas instruit d'ignorer le GDPR

## Formation du Personnel

- [ ] Tout le personnel formé à la conformité GDPR
- [ ] Dossiers de formation maintenus
- [ ] Formation de rappel régulière fournie (annuellement)
- [ ] Formation spécifique au rôle fournie :
  - [ ] Développeurs (confidentialité par la conception, protection des données)
  - [ ] Personnel support (accès aux données, droits des personnes concernées)
  - [ ] Direction (gouvernance, responsabilité)
- [ ] Efficacité de la formation évaluée

## Documentation et Dossiers

### Dossiers des Activités de Traitement (Article 30)
Maintenir un dossier pour chaque activité de traitement contenant :
- [ ] Nom et contact du responsable et du DPO
- [ ] Finalité du traitement
- [ ] Catégories de personnes concernées et de données personnelles
- [ ] Catégories de destinataires
- [ ] Transferts internationaux
- [ ] Délais pour l'effacement
- [ ] Mesures de sécurité

### Liste de Vérification de Documentation
- [ ] Politique de confidentialité maintenue et à jour
- [ ] Politique de cookies maintenue
- [ ] Politique de rétention des données documentée
- [ ] Plan de réponse aux violations de données documenté
- [ ] Documentation DPIA maintenue
- [ ] Accords de sous-traitant maintenus
- [ ] Procédures de demande des personnes concernées documentées
- [ ] Dossiers de formation du personnel maintenus
- [ ] Journaux d'audit maintenus (voir documentation Audit Logs)

## Calendrier de Rétention des Données

| Catégorie de Données | Période de Rétention | Base Légale | Méthode d'Élimination |
|----------------------|----------------------|-------------|----------------------|
| Dossiers Académiques Élèves | 10 ans après obtention diplôme | Requis légal | Suppression sécurisée |
| Dossiers Financiers | 7 ans après transaction | Loi fiscale | Suppression sécurisée |
| Dossiers de Présences | 3 ans après départ élève | Requis légal | Suppression sécurisée |
| Journaux de Communication | 2 ans | Besoin opérationnel | Suppression sécurisée |
| Journaux Système | 6 mois | Sécurité | Suppression sécurisée |
| Comptes Utilisateurs | Immédiatement sur demande | Droit à l'effacement | Suppression sécurisée |
| Données de Sauvegarde | 35 jours (défaut Supabase) | Besoin opérationnel | Automatique |
| Journaux d'Audit | 7 ans | Conformité | Suppression sécurisée |

## Gestion du Consentement

### Exigences de Consentement
- [ ] Consentement donné librement, spécifique, éclairé et sans ambiguïté
- [ ] Action affirmative claire (pas de cases pré-cochées)
- [ ] Consentement granulaire pour différentes finalités de traitement
- [ ] Consentement séparé des autres conditions
- [ ] Droit de retirer le consentement aussi facilement qu'il a été donné
- [ ] Retrait du consentement honoré immédiatement

### Mécanismes de Consentement
- [ ] Bannière de consentement cookies implémentée
- [ ] Cases à cocher de consentement pour le traitement des données
- [ ] Opt-in pour marketing email (pas opt-out)
- [ ] Système de suivi et gestion du consentement
- [ ] Dossiers de consentement maintenus (qui, quand, quoi, comment)

### Politique de Cookies
- [ ] Politique de cookies publiée
- [ ] Catégories de cookies documentées (nécessaires, préférences, statistiques, marketing)
- [ ] Cookies tiers listés
- [ ] Bannière de consentement cookies fonctionnelle
- [ ] Paramètres cookies accessibles
- [ ] Consentement peut être retiré

## Données des Enfants (Article 8)

Protection spéciale pour les enfants de moins de 16 ans (ou âge inférieur selon loi de l'État membre) :
- [ ] Consentement parental obtenu pour le traitement des données de l'enfant
- [ ] Données de l'enfant traitées uniquement si enfant a âge minimum (16 ou inférieur)
- [ ] Politique de confidentialité dans langue compréhensible pour enfants
- [ ] Aucun profilage comportemental des enfants
- [ ] Aucun marketing direct aux enfants sans consentement parental

## Tests et Conformité

- [ ] Audit annuel de conformité GDPR effectué
- [ ] Tests d'intrusion incluent aspects protection des données
- [ ] Droits des personnes concernées testés régulièrement
- [ ] Procédures de réponse aux violations testées
- [ ] Conformité des sous-traitants tiers vérifiée
- [ ] Adéquation des transferts internationaux de données révisée
- [ ] DPIA mise à jour lors de changements de traitement

## Ressources

- **Texte GDPR** : https://gdpr-info.eu/
- **Guide UK ICO** : https://ico.org.uk/for-organisations/guide-to-data-protection/
- **Conseil Européen Protection des Données** : https://edpb.europa.eu/
- **Contact DPO** : privacy@novaconnect.com
- **Autorité de Contrôle** : CNIL (France) ou DPA nationale

## Dernière Mise à Jour

- Date : 2024-10-15
- Version : 1.0
- Révisé Par : [Nom], Délégué à la Protection des Données
- Prochaine Révision : 2025-10-15

## Validation

- [ ] Délégué à la Protection des Données : ________________ Date : ______
- [ ] CEO : ________________ Date : ______
- [ ] Conseiller Juridique : ________________ Date : ______

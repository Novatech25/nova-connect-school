# Guide d'utilisation - Paiements Mobile Money

## Table des matières

1. [Pour les Parents/Élèves](#pour-les-parentsélèves)
   - [Comment payer via Mobile Money](#comment-payer-via-mobile-money)
   - [Providers supportés](#providers-supportés)
   - [Frais et limites](#frais-et-limites)
   - [Que faire en cas d'échec](#que-faire-en-cas-déchec)
   - [FAQ](#faq-parents)

2. [Pour les Comptables](#pour-les-comptables)
   - [Suivi des transactions](#suivi-des-transactions)
   - [Rapprochement manuel](#rapprochement-manuel)
   - [Exports et reporting](#exports-et-reporting)
   - [Gestion des échecs](#gestion-des-échecs)

3. [Pour les Administrateurs](#pour-les-administrateurs)
   - [Configuration des providers](#configuration-des-providers)
   - [Test des credentials](#test-des-credentials)
   - [Activation du module premium](#activation-du-module-premium)
   - [Sécurité et bonnes pratiques](#sécurité-et-bonnes-pratiques)

---

## Pour les Parents/Élèves

### Comment payer via Mobile Money

Le système NovaConnect accepte les paiements Mobile Money pour les frais scolaires. Voici comment effectuer un paiement :

#### Étape 1 : Sélectionner le provider

1. Connectez-vous à l'application ou au portail web
2. Allez dans la section "Paiements"
3. Cliquez sur "Payer avec Mobile Money"
4. Sélectionnez votre provider (Orange Money, Moov Money, MTN, Wave)

#### Étape 2 : Choisir les dettes à payer

1. Consultez la liste des frais en attente
2. Cochez les dettes que vous souhaitez régler
3. Le montant total est calculé automatiquement

#### Étape 3 : Entrer votre numéro

1. Entrez le numéro de téléphone associé à votre compte Mobile Money
2. Le format doit être : `+225 07 00 00 00 00` (avec l'indicatif pays)

#### Étape 4 : Confirmer et payer

1. Vérifiez le récapitulatif (montant + frais)
2. Cliquez sur "Payer maintenant"
3. Suivez les instructions qui s'affichent

#### Étape 5 : Confirmation

- Le système vérifie le statut automatiquement
- Vous recevrez une notification de confirmation
- Un reçu est généré automatiquement

### Providers supportés

| Provider | Pays supportés | Frais | Temps de confirmation |
|----------|----------------|-------|----------------------|
| **Orange Money** | CI, SN, ML, BF, NE | Selon configuration | ~2-5 minutes |
| **Moov Money** | BJ, TG, CI, BF | Selon configuration | ~2-5 minutes |
| **MTN Mobile Money** | Plusieurs pays | Selon configuration | ~2-5 minutes |
| **Wave** | SN, CI, BF, ML | Selon configuration | ~1-3 minutes |

### Frais et limites

Les frais de transaction sont définis par l'établissement scolaire et peuvent inclure :
- Un pourcentage du montant (ex: 1%)
- Un frais fixe (ex: 50 FCFA)
- Les deux combinés

Les limites de transaction :
- **Minimum** : généralement 100 FCFA
- **Maximum** : généralement 500 000 FCFA (varie selon le provider)

### Que faire en cas d'échec

Si votre paiement échoue :

1. **Vérifiez votre solde** : Assurez-vous d'avoir suffisamment de fonds
2. **Vérifiez le numéro** : Le format doit être correct avec l'indicatif pays
3. **Patientez** : Parfois, le traitement prend plus de temps que prévu
4. **Contactez le support** : Si le problème persiste, contactez la comptabilité de l'école

Si une transaction échoue, vous pouvez la réessayer depuis l'historique des paiements.

### FAQ Parents

**Q : Combien de temps prend la confirmation ?**
R : Généralement 2-5 minutes, mais peut prendre jusqu'à 15 minutes en cas de retard du provider.

**Q : Puis-je annuler un paiement ?**
R : Les paiements confirmés ne peuvent pas être annulés. Pour un remboursement, contactez l'administration de l'école.

**Q : Je n'ai pas reçu de notification, que faire ?**
R : Vérifiez votre historique de paiements dans l'application. Si le paiement apparaît comme "réussi", le reçu est disponible.

**Q : Le paiement est resté "en cours" depuis longtemps ?**
R : Patientez jusqu'à 15 minutes. Si le statut ne change pas, contactez la comptabilité.

---

## Pour les Comptables

### Suivi des transactions

Le dashboard comptable permet de suivre toutes les transactions Mobile Money :

#### Statistiques en temps réel

- **Total des transactions** : Nombre et montant
- **Taux de succès** : Pourcentage de paiements réussis
- **Transactions en attente** : Paiements en cours de traitement
- **Transactions échouées** : Échecs à analyser

#### Filtres disponibles

- Par date (période personnalisable)
- Par provider (Orange, Moov, MTN, Wave)
- Par statut (initié, en cours, succès, échec)
- Par élève
- Par montant

#### Tableau des transactions

Chaque transaction affiche :
- Date et heure
- Référence interne et ID externe
- Élève concerné
- Provider utilisé
- Montant
- Statut actuel
- Actions disponibles

### Rapprochement manuel

Le système effectue un rapprochement automatique, mais certains cas nécessitent une intervention manuelle :

#### Quand le rapprochement manuel est nécessaire

1. **Aucune dette associée** : Le paiement a été reçu mais ne correspond à aucune dette
2. **Montant partiel** : Le paiement ne couvre pas la totalité d'une dette
3. **Élève inconnu** : Le numéro de téléphone ne correspond à aucun élève

#### Comment effectuer un rapprochement manuel

1. Allez dans "Transactions" > "En attente de rapprochement"
2. Sélectionnez la transaction
3. Cliquez sur "Rapprocher manuellement"
4. Sélectionnez la dette appropriée dans la liste
5. Ajoutez des notes si nécessaire
6. Confirmez

Le système crée automatiquement l'enregistrement de paiement et met à jour la dette.

### Exports et reporting

#### Exporter les transactions

1. Appliquez vos filtres (date, provider, statut, etc.)
2. Cliquez sur "Exporter"
3. Choisissez le format (CSV ou Excel)
4. Le fichier inclut toutes les colonnes du tableau

Les données exportées incluent :
- Référence de transaction
- Date et heure
- Élève (nom et ID)
- Provider
- Montant
- Statut
- Numéro de reçu

#### Rapports disponibles

- **Journal des paiements** : Toutes les transactions sur une période
- **Rapprochements** : Transactions rapprochées automatiquement vs manuellement
- **Échecs** : Analyse des transactions échouées avec codes d'erreur
- **Provider analytics** : Performance par provider (taux de succès, volume)

### Gestion des échecs

#### Analyser les échecs

Pour chaque transaction échouée, consultez :
- **Code d'erreur** : Code spécifique du provider
- **Message d'erreur** : Description détaillée
- **Métadonnées** : Informations de diagnostic

#### Actions possibles

1. **Réessayer** : Relancer la transaction (max 3 tentatives)
2. **Contacter l'élève/parent** : Demander de vérifier les informations
3. **Contacter le provider** : En cas de problème technique avéré
4. **Archiver** : Pour les échecs définitifs

#### Retry automatique

Le système réessaie automatiquement les transactions échouées :
- Toutes les heures
- Pour les transactions < 24h
- Maximum 3 tentatives

---

## Pour les Administrateurs

### Configuration des providers

#### Prérequis

- Licence Premium ou Enterprise activée
- Module "mobile_money" activé dans les paramètres de l'école
- Compte avec rôle "school_admin"

#### Étapes de configuration

1. Allez dans "Paramètres" > "Mobile Money"
2. Cliquez sur "Ajouter un provider"

3. Remplissez le formulaire :
   - **Provider** : Sélectionnez dans la liste (Orange, Moov, MTN, Wave)
   - **Nom personnalisé** : Nom affiché aux utilisateurs (ex: "Orange Money CI")
   - **Endpoint API** : URL de l'API du provider
   - **Clé API** : Votre clé API fournie par le provider
   - **Secret API** : Votre secret API (optionnel selon le provider)
   - **ID Marchand** : Votre merchant ID
   - **Mode test** : Cochez pour utiliser l'environnement sandbox
   - **Frais** : Définissez les frais applicables aux parents
     - Pourcentage (ex: 1.5)
     - Fixe (ex: 100 FCFA)
   - **Limites** : Définissez les min/max
   - **Pays supportés** : Sélectionnez les pays

4. Cliquez sur "Tester la connexion" pour valider
5. Si le test réussit, cliquez sur "Enregistrer"

#### Modifier un provider

- Cliquez sur le provider dans la liste
- Modifiez les champs nécessaires
- Testez à nouveau si vous modifiez les credentials
- Enregistrez

#### Activer/Désactiver un provider

- Utilisez le bouton "Activer/Désactiver"
- Un provider désactivé n'apparaît plus pour les utilisateurs

### Test des credentials

#### Pourquoi tester ?

- Valider que l'API est accessible
- Vérifier que les credentials sont corrects
- S'assurer que la connexion fonctionne

#### Comment tester ?

1. Lors de la création/modification d'un provider
2. Cliquez sur "Tester la connexion"
3. Le système envoie une requête à l'API du provider
4. Résultat :
   - ✅ **Connexion réussie** : L'API est accessible et les credentials sont valides
   - ❌ **Échec** : Vérifiez l'URL et les credentials

#### Erreurs courantes

- **401/403** : Clé API ou secret incorrect
- **Timeout** : Endpoint inaccessible ou firewall bloque la connexion
- **404** : URL de l'API incorrecte

### Activation du module premium

#### Vérifier votre licence

1. Allez dans "Paramètres" > "Abonnement"
2. Vérifiez que vous avez une licence **Premium** ou **Enterprise**
3. Vérifiez que la licence est active et non expirée

#### Activer le module

1. Allez dans "Paramètres" > "Modules"
2. Trouvez "Mobile Money"
3. Activez le module
4. Sauvegardez

Si le module n'apparaît pas, votre licence ne supporte pas Mobile Money. Contactez le support NovaConnect pour upgrade.

### Sécurité et bonnes pratiques

#### Sécurité des credentials

- **Ne jamais partager** vos clés API
- **Utilisez des clés différentes** pour test et production
- **Renouvelez régulièrement** vos clés (tous les 3-6 mois)
- **Surveillez** l'utilisation via les dashboards des providers

#### Mode test vs Production

- Commencez toujours en **mode test** pour valider la configuration
- N'activez le **mode production** qu'après validation complète
- Testez avec de petits montants (100-500 FCFA)

#### Monitoring et alertes

Configurez des alertes pour :
- Taux d'échec élevé (> 10%)
- Provider inaccessible
- Transactions en attente depuis > 10 minutes

#### Sauvegardes et logs

- Le système conserve tous les logs de transactions
- Exportez régulièrement les rapports pour vos archives
- Conservez les reçus générés

#### Bonnes pratiques

1. **Testez régulièrement** les connections providers (mensuel)
2. **Surveillez** les taux de succès par provider
3. **Formez** les comptables au rapprochement manuel
4. **Communiquez** avec les parents sur l'utilisation de Mobile Money
5. **Ayez un plan de secours** en cas d'indisponibilité d'un provider

---

## Support et Contact

Pour toute question ou problème :

- **Documentation technique** : https://docs.novaconnect.com
- **Support client** : support@novaconnect.com
- **Téléphone** : +225 27 00 00 00 00

---

## Glossaire

- **Provider** : Opérateur Mobile Money (Orange, Moov, etc.)
- **Transaction** : Un paiement Mobile Money
- **Rapprochement** : L'action d'associer un paiement à une dette
- **Webhook** : Notification automatique du provider
- **Référence** : Identifiant unique de transaction
- **USSD** : Code de raccourci pour accéder au service Mobile Money (*144#, etc.)

---

**Version du document** : 1.0
**Dernière mise à jour** : 2025-02-03

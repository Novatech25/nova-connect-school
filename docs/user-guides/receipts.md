# Guide d'utilisation - Reçus de paiement

## Vue d'ensemble

NovaConnect génère automatiquement des reçus standards pour tous les paiements (scolarité et salaires) avec numérotation séquentielle, QR de vérification anti-fraude, et support multi-formats d'impression.

## Types de reçus

### Reçu de paiement scolarité
- Numéro unique : `SCH-YYYY-0000001`
- Contient : informations école, élève, paiement, situation financière
- QR de vérification valide 30 jours

### Reçu de salaire professeur
- Numéro unique : `SAL-YYYY-0000001`
- Contient : informations école, professeur, période, détails calcul
- QR de vérification valide 30 jours

## Formats d'impression

### A4 Standard (210x297mm)
- Format classique pour imprimantes bureautiques
- Inclut logo, signature, QR code
- Mise en page complète

### Thermal 80mm
- Format ticket pour imprimantes thermiques 80mm
- Mise en page compacte
- QR code inclus

### Thermal 58mm
- Format ticket pour imprimantes thermiques 58mm
- Mise en page ultra-compacte
- Sans QR code (espace limité)

## Configuration (Admin)

1. Accéder à **Paramètres > Profils d'impression**
2. Créer un nouveau profil :
   - Nom du profil
   - Type (A4/Thermal 80/Thermal 58)
   - Marges et polices (optionnel)
   - Définir comme profil par défaut
3. Sauvegarder

## Génération de reçu

### Pour un paiement étudiant

1. Accéder à **Comptabilité > Paiements**
2. Cliquer sur "Générer reçu" sur un paiement
3. Sélectionner le profil d'impression (optionnel)
4. Cocher "Envoyer automatiquement" si désiré
5. Choisir les canaux d'envoi (Email, WhatsApp)
6. Cliquer sur "Générer"

### Pour un salaire professeur

1. Accéder à **Comptabilité > Paie**
2. Sélectionner une période de paie
3. Cliquer sur "Générer fiche" sur une entrée
4. Sélectionner les options d'envoi si nécessaire
5. Cliquer sur "Générer"

## Vérification de reçu

Chaque reçu contient un QR code sécurisé qui permet de :
- Vérifier l'authenticité du reçu
- Consulter les informations clés
- Prévenir la fraude

Pour vérifier un reçu :
1. Scanner le QR code avec un smartphone
2. Accéder à la page de vérification
3. Confirmer les informations affichées

## Téléchargement et partage

### Depuis l'interface web
1. Accéder à l'historique des paiements ou des fiches de paie
2. Cliquer sur le reçu souhaité
3. Cliquer sur "Télécharger" ou "Partager"

### Depuis l'application mobile
1. Ouvrir la section "Mes reçus"
2. Sélectionner le reçu
3. Utiliser les boutons "Télécharger" ou "Partager"

## Numérotation séquentielle

Les numéros de reçu sont générés automatiquement avec le format :
- `PREFIX-ANNÉE-NUMÉRO_SÉQUENTIEL`

Exemples :
- `SCH-2026-0000001` : Premier reçu de paiement de l'année 2026
- `SAL-2026-0000042` : 42ème fiche de paie de l'année 2026

La numérotation est :
- Unique par école
- Séquentielle sans gaps
- Réinitialisée chaque année
- Atomique (pas de doublons possibles)

## Support hors-ligne (Gateway LAN)

En mode hors-ligne (Gateway LAN) :
1. Les reçus sont générés localement
2. Numérotation séquentielle locale
3. Synchronisation automatique when online
4. Upload des PDFs au cloud ultérieurement

## Sécurité et anti-fraude

### Tokens de vérification
- Signés avec HMAC-SHA256
- Validité 30 jours
- Uniques par reçu
- Inaltérables

### RLS Policies
- Isolement multi-tenant
- Accès restreint par rôle
- Audit trail complet

## Bonnes pratiques

1. **Toujours vérifier** l'authenticité d'un reçu avant d'accepter un paiement
2. **Conserver une copie** des reçus importants
3. **Utiliser le QR code** pour une vérification rapide
4. **Configurer les profils** d'impression selon votre matériel
5. **Activer l'envoi automatique** pour les parents/enseignants

## Dépannage

### Le reçu ne se génère pas
- Vérifier que le paiement est validé
- Vérifier les permissions de l'utilisateur
- Consulter les logs Edge Functions

### Le QR code ne fonctionne pas
- Vérifier que le token n'est pas expiré (30 jours)
- S'assurer que l'URL est complète
- Tester avec un autre lecteur QR

### L'impression est incorrecte
- Ajuster les marges dans le profil d'impression
- Vérifier le format papier correspond au profil
- Tester avec différents navigateurs

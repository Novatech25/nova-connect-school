# Manuel d'Administration : Gestion des Emplois du Temps

Ce document décrit le fonctionnement et l'utilisation de l'interface de gestion des emplois du temps pour les administrateurs d'école.

## Accès

- **URL** : `/admin/schedule`
- **Permissions requises** : Administrateur d'école, Superviseur, ou Personnel autorisé.

## Fonctionnalités Principales

### 1. Création d'un Emploi du Temps

1. Cliquez sur le bouton **"Créer un EDT"** en haut à droite.
2. Remplissez le formulaire :
   - **Nom** : Nom de l'emploi du temps (ex: "EDT Semestre 1").
   - **Description** : Informations complémentaires (optionnel).
   - **Année scolaire** : Sélectionnez l'année académique concernée.
3. Cliquez sur "Créer".
4. L'emploi du temps est créé en statut **Brouillon (v1)**.

### 2. Gestion des Créneaux

Pour modifier les créneaux, cliquez sur **"Voir / Éditer"** ou sur l'icône "Œil" dans la liste.

- **Ajouter un cours** : Cliquez sur une case vide du calendrier.
- **Modifier un cours** : Cliquez sur un cours existant.
- **Déplacer un cours** : Glisser-déposer (Drag & Drop) est supporté.
- **Supprimer un cours** : Cliquez sur le cours puis sur "Supprimer".

### 3. Duplication

Vous pouvez dupliquer un emploi du temps existant (pour créer une variante ou préparer le semestre suivant).

1. Dans la liste des emplois du temps, cliquez sur le menu "..." à droite.
2. Sélectionnez **"Dupliquer"**.
3. Une copie exacte est créée avec le suffixe "(copie)".

### 4. Renommer / Modifier

1. Dans la liste, cliquez sur le menu "..." puis **"Renommer"**.
2. Ou dans la page de détail, cliquez sur l'icône "Crayon" à côté du titre.
3. Modifiez le nom ou la description.

### 5. Publication

La publication génère les séances réelles dans le calendrier de l'école.

1. Assurez-vous qu'il n'y a pas de conflits majeurs (affichés en rouge).
2. Cliquez sur le bouton **"Publier"**.
3. Choisissez si vous souhaitez notifier les utilisateurs.
4. Le système va :
   - Figer la version actuelle.
   - Incrémenter le numéro de version (v1 -> v2).
   - Générer les séances pour toute l'année scolaire (ou la période restante).
   - Mettre à jour le statut en "Publié".

**Note** : Si vous republiez un emploi du temps, seules les séances futures (à partir de demain) seront mises à jour pour ne pas perturber l'historique ou les présences déjà saisies.

## Résolution des Problèmes

### Conflits
Le système détecte automatiquement :
- Les professeurs assignés à deux cours en même temps.
- Les salles utilisées deux fois en même temps.
- Les classes ayant deux cours en même temps.

Les conflits sont affichés avec un badge rouge "Conflit". Vous devez les résoudre (en déplaçant ou supprimant un cours) avant de publier pour garantir la cohérence.

### Erreurs Techniques
Si une erreur survient (ex: "Publication failed"), un message détaillé s'affiche.
- **DB Error** : Problème de base de données (permissions, contraintes).
- **Edge Error** : Problème lors de la génération des séances.

Contactez le support technique avec le message d'erreur si le problème persiste.

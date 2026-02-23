# 📚 Guide Administrateur - Attribution Automatique des Salles

> **Version 2.0** - Système multi-école automatique

---

## 🎯 Vue d'ensemble

Ce système attribue **automatiquement** les salles aux cours et envoie des rappels aux professeurs et étudiants. 

**En résumé :** Vous créez l'emploi du temps, le système gère tout le reste !

---

## ✅ Prérequis (À configurer avant)

Avant d'utiliser l'attribution automatique, assurez-vous d'avoir créé :

### 1. Les Salles
```
Menu : Ressources → Salles
```
- Nom de la salle
- Capacité (nombre d'étudiants)
- Équipements (projecteur, PC, etc.)
- Localisation (bâtiment, étage)

### 2. Les Classes
```
Menu : Classes → Nouvelle classe
```
- Nom de la classe
- Niveau scolaire
- Liste des étudiants inscrits

### 3. Les Professeurs
```
Menu : Utilisateurs → Professeurs
```
- Profil complet (nom, email, téléphone)
- Matières enseignées
- Disponibilités

### 4. Les Matières
```
Menu : Académique → Matières
```
- Nom de la matière
- Code
- Équipements requis (optionnel)

---

## 🚀 Activation du Module

### Étape 1 : Activer la fonctionnalité
```
Paramètres → Attribution des salles → Activer le module
```

**Option recommandée pour démarrer :**
- ✅ Module activé
- ⬜ Auto-publication (désactivé au début)
- ✅ Notifications activées

> 💡 **Conseil :** Laissez "Auto-publication" désactivée au début pour vérifier manuellement les attributions avant publication.

---

## 📅 Création de l'Emploi du Temps

### Étape 2 : Créer les cours
```
Menu : Planning → Emploi du temps → Nouveau cours
```

**Informations requises pour chaque cours :**
| Champ | Description |
|-------|-------------|
| **Classe** | Quelle classe suit ce cours ? |
| **Matière** | Quelle matière est enseignée ? |
| **Professeur** | Qui enseigne ? |
| **Jour** | Lundi, Mardi, etc. |
| **Heure début** | Ex: 08:00 |
| **Heure fin** | Ex: 10:00 |

> ⚠️ **Important :** Ne remplissez PAS le champ "Salle" - le système l'attribuera automatiquement !

---

## 🔄 Le Workflow Automatique

Une fois vos cours créés, le système fonctionne seul :

```
18h00 (tous les jours)
    ↓
Système analyse les cours de DEMAIN
    ↓
Attribution intelligente des salles
    ↓
Création des notifications
    ↓
Si auto-publication = ON → Publié immédiatement
Si auto-publication = OFF → En attente de validation
```

### Notifications automatiques envoyées :

| Timing | Destinataires | Message |
|--------|---------------|---------|
| **1h avant** (T-60) | Professeur + Étudiants | "⏰ Cours dans 1h - Salle B12" |
| **15min avant** (T-15) | Professeur + Étudiants | "🔔 Cours imminent - Salle B12" |

---

## 📋 Validation Manuelle (Recommandé au début)

Si vous avez désactivé l'auto-publication :

### Consulter les attributions proposées
```
Menu : Planning → Attributions de salles
```

**Vous verrez :**
- La salle attribuée
- Le professeur
- La classe
- L'heure
- Le statut (Brouillon / Publié)

### Actions possibles :
| Action | Icône | Description |
|--------|-------|-------------|
| ✅ Publier | Coche verte | Confirmer l'attribution |
| ✏️ Modifier | Crayon | Changer manuellement la salle |
| ❌ Annuler | Croix | Supprimer l'attribution |

---

## ⚙️ Paramètres Avancés

### Configuration par école
```
Paramètres → Attribution des salles → Configuration
```

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| **Module activé** | ON/OFF | Active/désactive complètement |
| **Auto-publication** | ON/OFF | Publie sans validation manuelle |
| **Notifications** | ON/OFF | Envoie les rappels T-60/T-15 |
| **Respect équipements** | ON | Vérifie les besoins (projecteur, etc.) |
| **Minimiser déplacements** | ON | Réduit les déplacements des profs |

---

## 🔍 Monitoring & Vérifications

### Voir les attributions du jour
```sql
-- Dans Supabase SQL Editor
SELECT 
    ra.session_date,
    ra.status,
    r.name as salle,
    t.first_name || ' ' || t.last_name as professeur,
    c.name as classe,
    s.name as matiere
FROM room_assignments ra
JOIN rooms r ON ra.room_id = r.id
JOIN teachers t ON ra.teacher_id = t.id
JOIN classes c ON ra.class_id = c.id
JOIN subjects s ON ra.subject_id = s.id
WHERE ra.session_date = CURRENT_DATE + INTERVAL '1 day'
ORDER BY ra.created_at DESC;
```

### Vérifier les notifications envoyées
```
Menu : Notifications → Historique
```

---

## ❓ FAQ - Questions Fréquentes

### Q1 : Une salle est attribuée mais je veux la changer
```
Menu : Planning → Attributions → Modifier
```
Sélectionnez une autre salle disponible à ce créneau.

### Q2 : Le système n'a pas trouvé de salle
**Causes possibles :**
- ❌ Aucune salle disponible à ce créneau
- ❌ Capacité insuffisante
- ❌ Équipement manquant

**Solution :** Créez plus de salles ou ajustez les horaires.

### Q3 : Les notifications ne partent pas
**Vérifications :**
1. Le statut est-il "Publié" ? (pas "Brouillon")
2. Les notifications sont-elles activées dans les paramètres ?
3. Les utilisateurs ont-ils des emails/téléphones valides ?

### Q4 : Je veux désactiver pour une seule école
```sql
-- Désactiver pour une école spécifique
UPDATE schools 
SET settings = jsonb_set(
    settings, 
    '{roomAssignment,enabled}', 
    'false'
)
WHERE name = 'Nom de l''école';
```

### Q5 : Quand se fait le calcul ?
- **Heure :** 18h00 tous les jours
- **Planning :** Cours du lendemain
- **Fréquence :** Quotidienne automatique

---

## 🛠️ Dépannage

### Problème : "Aucune attribution créée"

**Checklist :**
- [ ] Le module est-il activé dans les paramètres ?
- [ ] Des cours sont-ils programmés pour demain ?
- [ ] Les salles ont-elles été créées ?
- [ ] Les professeurs sont-ils associés aux cours ?

### Problème : "Conflit de salle"

Le système évite automatiquement les conflits. Si un conflit persiste :
1. Vérifiez les horaires des cours
2. Assurez-vous d'avoir assez de salles
3. Vérifiez les créneaux surchargés

### Problème : Notification non reçue

**Vérifier :**
1. L'attribution est publiée (pas en brouillon)
2. L'utilisateur a une adresse email valide
3. Les notifications sont activées
4. L'heure actuelle est bien dans la fenêtre T-60 ou T-15

---

## 📊 Bonnes Pratiques

### ✅ À faire
- [ ] Créer toutes les salles avant les emplois du temps
- [ ] Vérifier les attributions pendant les premiers jours
- [ ] Activer l'auto-publication après validation du système
- [ ] Former les professeurs à consulter les notifications

### ❌ À éviter
- [ ] Attribuer manuellement les salles (laissez le système faire !)
- [ ] Créer des cours sans professeur assigné
- [ ] Ignorer les notifications d'erreur
- [ ] Désactiver les notifications (les profs ne seront pas prévenus)

---

## 🎓 Formation Rapide (5 minutes)

### Pour les nouveaux admins :

1. **Jour 1 :** Créer 3-4 salles de test
2. **Jour 2 :** Créer un emploi du temps avec 2-3 cours
3. **Jour 3 :** Vérifier les attributions à 18h05
4. **Jour 4 :** Publier les attributions manuellement
5. **Jour 5 :** Activer l'auto-publication si satisfait

---

## 📞 Support

En cas de problème persistant :

1. Consulter les logs GitHub Actions :
   ```
   https://github.com/[ORG]/[REPO]/actions
   ```

2. Vérifier les fonctions RPC dans Supabase :
   ```
   Database → Functions
   ```

3. Contacter le support technique avec :
   - Capture d'écran du problème
   - ID de l'école
   - Date/heure du problème

---

## 📝 Récapitulatif Visuel

```
┌─────────────────────────────────────────────────────────┐
│           WORKFLOW ADMINISTRATEUR                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. CRÉER                                               │
│     ├─ Salles (nom, capacité, équipements)             │
│     ├─ Classes (avec étudiants)                        │
│     ├─ Professeurs (avec matières)                     │
│     └─ Matières                                        │
│                                                         │
│  2. ACTIVER                                             │
│     └─ Paramètres → Attribution des salles → ON        │
│                                                         │
│  3. PLANIFIER                                           │
│     └─ Créer les emplois du temps (sans salle)         │
│                                                         │
│  4. LAISSER FAIRE (18h00)                              │
│     ├─ Système attribue les salles                     │
│     ├─ Crée les notifications                          │
│     └─ Envoie les rappels automatiquement              │
│                                                         │
│  5. CONSULTER (optionnel)                              │
│     └─ Vérifier les attributions si besoin             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

**Document créé le :** Février 2026  
**Version :** 2.0 - Multi-école  
**Dernière mise à jour :** Support GitHub Actions Cron

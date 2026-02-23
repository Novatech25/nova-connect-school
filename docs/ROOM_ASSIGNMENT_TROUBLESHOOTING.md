# 🔧 Dépannage - Attribution des Salles

## Problèmes courants et solutions

---

## ❌ "Aucune attribution créée"

### Vérifier les prérequis
```sql
-- Vérifier si des cours existent pour demain
SELECT COUNT(*) FROM schedule_slots ss
JOIN planned_sessions ps ON ps.schedule_id = ss.schedule_id
WHERE ps.session_date = CURRENT_DATE + INTERVAL '1 day';
```
**Résultat attendu :** > 0

### Vérifier les salles
```sql
-- Vérifier si des salles existent
SELECT COUNT(*) FROM rooms WHERE status = 'active';
```
**Résultat attendu :** > 0

### Vérifier le paramètre school
```sql
-- Vérifier si roomAssignment est activé
SELECT settings->'roomAssignment'->>'enabled' 
FROM schools WHERE id = 'VOTRE_SCHOOL_ID';
```
**Résultat attendu :** `true` ou `NULL` (NULL = activé par défaut)

---

## ❌ "Conflit de salle détecté"

### Cause
Deux cours sont programmés au même créneau avec la même salle.

### Solution
1. Vérifier les emplois du temps
2. Déplacer un des cours à un autre créneau
3. Ou ajouter plus de salles

---

## ❌ "Notifications non envoyées"

### Checklist
- [ ] L'attribution a le statut **"published"** (pas "draft")
- [ ] Les notifications sont activées dans les paramètres
- [ ] Les utilisateurs ont des emails valides
- [ ] Le GitHub Actions est actif : https://github.com/[REPO]/actions

### Vérifier les logs GitHub Actions
```bash
# Lancer manuellement pour tester
gh workflow run room-assignment-cron.yml --repo [OWNER]/[REPO]
```

---

## ❌ "Le workflow GitHub ne s'exécute pas"

### Vérifications
1. Le fichier existe : `.github/workflows/room-assignment-cron.yml`
2. GitHub Actions est activé dans Settings → Actions
3. Les secrets sont configurés :
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

### Test manuel
```powershell
# Exécuter depuis PowerShell
& "C:\Program Files\GitHub CLI\gh.exe" workflow run room-assignment-cron.yml `
  --repo Novatech25/automatisation-school-emploi
```

---

## ❌ "Erreur CORS / 401 sur les appels API"

### Cause probable
Le token Supabase est invalide ou expiré.

### Solution
1. Récupérer une nouvelle clé anon depuis Supabase Dashboard
2. Mettre à jour le secret GitHub :
   ```
   Settings → Secrets → SUPABASE_ANON_KEY
   ```

---

## 📊 Vérifications SQL rapides

### Voir les dernières attributions
```sql
SELECT 
    ra.id,
    ra.session_date,
    ra.status,
    r.name as room,
    c.name as class,
    ra.created_at
FROM room_assignments ra
JOIN rooms r ON ra.room_id = r.id
JOIN classes c ON ra.class_id = c.id
ORDER BY ra.created_at DESC
LIMIT 10;
```

### Voir les notifications en attente
```sql
SELECT 
    n.id,
    n.type,
    n.title,
    n.status,
    n.created_at
FROM notifications n
WHERE n.type = 'room_assignment_reminder'
ORDER BY n.created_at DESC
LIMIT 10;
```

### Voir les écoles avec room assignment activé
```sql
SELECT 
    id,
    name,
    settings->'roomAssignment' as config
FROM schools
WHERE COALESCE(
    (settings->'roomAssignment'->>'enabled')::BOOLEAN, 
    TRUE
) = TRUE;
```

---

## 🆘 Contacter le support

Si le problème persiste, fournir :

1. **ID de l'école** (UUID)
2. **Date/heure** du problème
3. **Capture d'écran** de l'erreur
4. **Logs GitHub Actions** (lien vers l'exécution)
5. **Résultat** des requêtes SQL ci-dessus

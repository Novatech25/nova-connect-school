# NovaConnect Gateway - Système de Licence

## 🔒 Mode Production

Les licences de production ont toutes les sécurités activées :

- ✅ **Vérification fingerprint matériel** (anti-copie)
- ✅ **Validation Supabase Cloud** (révocation à distance)
- ✅ **Mode offline** (7 jours sans internet)
- ✅ **Expiration automatique**

### Activation Production
```bash
bun run activate --license=PROD-XXXX-XXXX-XXXX-XXXX --school=votre-ecole-id
```

## 🧪 Mode Test (Développement)

Les licences commençant par `NOVA-TEST` bypassent les vérifications :

- ❌ Pas de vérification matériel
- ❌ Pas de validation cloud
- ✅ Idéal pour Docker/local dev

### Exemple
```bash
License: NOVA-TEST-2026-DEMO
School: test-school-001
```

## ⚠️ Sécurité

**NE JAMAIS** utiliser une licence `NOVA-TEST` en production !
Elles sont conçues uniquement pour le développement/testing.

Les licences de production contredisent des vérifications de sécurité rigoureuses pour protéger votre application contre :
- La copie illégale
- L'utilisation non autorisée
- La modification du fingerprint matériel

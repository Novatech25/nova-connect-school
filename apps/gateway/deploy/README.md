# 🚀 Déploiement Rapide - NovaConnect Gateway

Guide rapide pour déployer NovaConnect Gateway en production.

---

## 🎯 Déploiement en 5 minutes

### Option A: Avec Docker (Recommandé)

```bash
# 1. Installer Docker
curl -fsSL https://get.docker.com | sudo sh

# 2. Configurer
cp .env.example .env
nano .env  # Éditer SCHOOL_ID, SUPABASE_URL, etc.

# 3. Démarrer
docker-compose up -d

# 4. Activer la licence
docker-compose exec gateway bun run activate --license=XXXX --school=YYYY

# 5. Vérifier
curl http://localhost:3001/health
```

### Option B: Sans Docker

```bash
# 1. Exécuter le script d'installation
sudo bash deploy/scripts/install.sh

# 2. Configurer
cd /var/www/novaconnect-gateway
sudo -u gateway cp .env.example .env
sudo -u gateway nano .env

# 3. Installer les dépendances
sudo -u gateway bun install

# 4. Activer la licence
sudo -u gateway bun run activate --license=XXXX --school=YYYY

# 5. Démarrer
sudo -u gateway pm2 start deploy/ecosystem.config.cjs --env production
sudo -u gateway pm2 save
```

---

## 🔐 Configuration HTTPS (Production)

```bash
# 1. Installer et configurer Nginx
sudo cp deploy/nginx/novaconnect-gateway.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/novaconnect-gateway /etc/nginx/sites-enabled/

# 2. Modifier le domaine dans la configuration
sudo nano /etc/nginx/sites-available/novaconnect-gateway

# 3. Configurer SSL avec Let's Encrypt
sudo bash deploy/nginx/setup-ssl.sh votre-domaine.com admin@domaine.com
```

---

## 📊 Monitoring

```bash
# Health check
bash deploy/scripts/health-check.sh

# Monitoring en temps réel
bash deploy/scripts/monitor.sh

# Logs
tail -f /var/www/novaconnect-gateway/logs/gateway.log
```

---

## 💾 Backup

```bash
# Backup manuel
bash deploy/scripts/backup.sh

# Restauration
bash deploy/scripts/restore.sh /path/to/backup.tar.gz
```

---

## 🛠️ Commandes Utiles

### Docker

```bash
docker-compose logs -f gateway      # Voir les logs
docker-compose restart gateway      # Redémarrer
docker-compose ps                   # Statut
docker-compose down                 # Arrêter
```

### PM2

```bash
pm2 status                          # Statut
pm2 logs novaconnect-gateway        # Logs
pm2 restart novaconnect-gateway     # Redémarrer
pm2 stop novaconnect-gateway        # Arrêter
```

### Systemd

```bash
sudo systemctl status novaconnect-gateway  # Statut
sudo systemctl restart novaconnect-gateway # Redémarrer
sudo systemctl stop novaconnect-gateway    # Arrêter
journalctl -u novaconnect-gateway -f      # Logs
```

---

## 🔧 Dépannage

### Gateway ne démarre pas

```bash
# Vérifier les logs
pm2 logs novaconnect-gateway --lines 50

# Vérifier la configuration
cat .env

# Vérifier les permissions
ls -la data/
```

### Erreur de licence

```bash
# Réactiver
bun run activate --license=XXXX --school=YYYY
```

### Sync ne fonctionne pas

```bash
# Vérifier le statut
curl http://localhost:3001/api/sync/status

# Déclencher une sync manuelle
curl -X POST http://localhost:3001/api/sync/trigger
```

---

## 📚 Documentation Complète

Pour plus de détails, consultez [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## ✅ Checklist

- [ ] Gateway installé
- [ ] Licence activée
- [ ] Health check OK
- [ ] HTTPS configuré
- [ ] Backup en place
- [ ] Monitoring actif

---

**🎉 Déploiement terminé !**

Accédez à l'interface admin: http://localhost:3001/admin

# ==============================================
# NovaConnect Gateway - Production Dockerfile
# Multi-stage build pour optimiser la taille
# ==============================================

# Étape 1: Build stage
FROM node:22-bullseye AS builder

WORKDIR /app

# Installer Bun
RUN npm install -g bun

# Copier les fichiers de dépendances
COPY package.json bun.lock* ./

# Installer les dépendances
RUN bun install --frozen-lockfile

# Copier le code source
COPY . .

# Créer le répertoire de données
RUN mkdir -p /app/data

# Étape 2: Production stage
FROM node:22-bullseye-slim

# Métadonnées
LABEL maintainer="NovaConnect <tech@novaconnect.com>"
LABEL description="NovaConnect Gateway LAN - Offline service for critical operations"
LABEL version="1.0.0"

# Créer utilisateur non-root pour la sécurité
RUN groupadd -r gateway && \
    useradd -r -g gateway -s /bin/false gateway

# Installer les dépendances système nécessaires
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
        sqlite3 \
        && rm -rf /var/lib/apt/lists/*

# Installer Bun globalement
RUN npm install -g bun

# Créer les répertoires nécessaires
ENV GATEWAY_HOME=/app
ENV DATA_DIR=/app/data
ENV LOG_DIR=/app/logs

RUN mkdir -p ${GATEWAY_HOME} ${DATA_DIR} ${LOG_DIR} && \
    chown -R gateway:gateway ${GATEWAY_HOME} ${DATA_DIR} ${LOG_DIR}

# Se déplacer dans le répertoire de travail
WORKDIR ${GATEWAY_HOME}

# Copier les fichiers depuis le builder
COPY --from=builder --chown=gateway:gateway /app/node_modules ./node_modules
COPY --from=builder --chown=gateway:gateway /app/package.json ./
COPY --from=builder --chown=gateway:gateway /app/src ./src
COPY --from=builder --chown=gateway:gateway /app/scripts ./scripts
COPY --from=builder --chown=gateway:gateway /app/tsconfig.json ./

# Changer l'utilisateur
USER gateway

# Exposer le port
EXPOSE 3001

# Variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_PATH=/app/data

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Démarrer le serveur
CMD ["bun", "run", "start"]

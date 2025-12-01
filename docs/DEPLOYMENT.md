# 🚀 MarketMind Production Deployment Guide

Complete guide for deploying MarketMind backend to production with Docker, PostgreSQL, and monitoring.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Docker Deployment](#docker-deployment)
- [Database Setup](#database-setup)
- [Security Configuration](#security-configuration)
- [Monitoring & Logging](#monitoring--logging)
- [Scaling Guide](#scaling-guide)
- [Troubleshooting](#troubleshooting)
- [Backup & Recovery](#backup--recovery)

---

## Prerequisites

### System Requirements

- **OS**: Ubuntu 22.04 LTS / Debian 12 / RHEL 8+ (recommended)
- **CPU**: 2+ cores (4+ cores for production)
- **RAM**: 4GB minimum (8GB+ recommended)
- **Storage**: 50GB SSD (100GB+ for production)
- **Network**: Static IP or domain name

### Software Requirements

```bash
# Docker & Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Verify installation
docker --version  # Should be 24.0+
docker-compose --version  # Should be 2.20+
```

---

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/nathanssantos/marketmind.git
cd marketmind
git checkout main  # Or specific release tag
```

### 2. Configure Environment Variables

```bash
# Copy example environment file
cp apps/backend/.env.example apps/backend/.env

# Edit with production values
nano apps/backend/.env
```

**Required Environment Variables:**

```bash
# Environment
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
LOG_LEVEL=info

# Database (PostgreSQL 17 + TimescaleDB)
DATABASE_URL=postgresql://marketmind:STRONG_PASSWORD_HERE@postgres:5432/marketmind
DATABASE_NAME=marketmind
DATABASE_USER=marketmind
DATABASE_PASSWORD=STRONG_PASSWORD_HERE

# Redis (optional but recommended for caching)
REDIS_URL=redis://:STRONG_PASSWORD_HERE@redis:6379
REDIS_PASSWORD=STRONG_PASSWORD_HERE

# Security (CRITICAL - Generate secure keys!)
ENCRYPTION_KEY=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 64)

# CORS (Update with your frontend URL)
CORS_ORIGIN=https://app.marketmind.com

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000

# Monitoring (optional)
ENABLE_METRICS=true
METRICS_PORT=9090
```

### 3. Generate Secure Keys

```bash
# Generate encryption key (32 bytes = 64 hex characters)
openssl rand -hex 32

# Generate session secret (64 bytes = 128 hex characters)
openssl rand -hex 64

# Copy these to .env file
```

---

## Docker Deployment

### 1. Build & Start Services

```bash
# Build and start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f backend
```

### 2. Verify Services

```bash
# Check backend health
curl http://localhost:3001/health

# Expected response:
# {"status":"ok","timestamp":"2025-11-30T...","version":"0.31.0"}

# Check readiness
curl http://localhost:3001/ready

# Check PostgreSQL
docker exec marketmind-postgres pg_isready -U marketmind

# Check Redis
docker exec marketmind-redis redis-cli ping
```

### 3. Run Database Migrations

```bash
# Enter backend container
docker exec -it marketmind-backend sh

# Run migrations
pnpm --filter @marketmind/backend db:migrate

# Exit container
exit
```

---

## Database Setup

### PostgreSQL + TimescaleDB Configuration

**Recommended Settings** (for 8GB RAM server):

```bash
# Connect to database
docker exec -it marketmind-postgres psql -U marketmind -d marketmind

-- Optimize for time-series data
ALTER SYSTEM SET shared_buffers = '2GB';
ALTER SYSTEM SET effective_cache_size = '6GB';
ALTER SYSTEM SET work_mem = '64MB';
ALTER SYSTEM SET maintenance_work_mem = '512MB';
ALTER SYSTEM SET max_wal_size = '4GB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET random_page_cost = 1.1;

-- Restart PostgreSQL
\q
docker-compose restart postgres
```

### Create Hypertables (Time-Series Optimization)

```sql
-- Convert klines table to hypertable
SELECT create_hypertable('klines', 'open_time', 
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- Add retention policy (keep 1 year of data)
SELECT add_retention_policy('klines', INTERVAL '1 year');

-- Create continuous aggregates for analytics
CREATE MATERIALIZED VIEW klines_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', open_time) AS bucket,
  symbol,
  first(open, open_time) AS open,
  max(high) AS high,
  min(low) AS low,
  last(close, open_time) AS close,
  sum(volume) AS volume
FROM klines
GROUP BY bucket, symbol;
```

---

## Security Configuration

### 1. Firewall Setup (UFW)

```bash
# Enable firewall
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow backend API (if direct access needed)
sudo ufw allow 3001/tcp

# Allow PostgreSQL (only if external access needed - NOT recommended)
# sudo ufw allow from TRUSTED_IP to any port 5432

# Check status
sudo ufw status
```

### 2. SSL/TLS with Let's Encrypt (Nginx Reverse Proxy)

```bash
# Install Nginx
sudo apt install nginx certbot python3-certbot-nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/marketmind
```

**Nginx Configuration:**

```nginx
server {
    listen 80;
    server_name api.marketmind.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name api.marketmind.com;
    
    ssl_certificate /etc/letsencrypt/live/api.marketmind.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.marketmind.com/privkey.pem;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req zone=api_limit burst=20 nodelay;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

```bash
# Enable site and obtain certificate
sudo ln -s /etc/nginx/sites-available/marketmind /etc/nginx/sites-enabled/
sudo certbot --nginx -d api.marketmind.com
sudo systemctl restart nginx
```

---

## Monitoring & Logging

### 1. View Logs

```bash
# Backend logs
docker-compose logs -f backend

# PostgreSQL logs
docker-compose logs -f postgres

# All services
docker-compose logs -f

# Filter by time
docker-compose logs --since 1h backend
```

### 2. Log Rotation

Create `/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "10"
  }
}
```

```bash
sudo systemctl restart docker
```

### 3. Performance Monitoring

```bash
# Container stats
docker stats

# Database performance
docker exec marketmind-postgres psql -U marketmind -d marketmind -c "
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

# Active connections
docker exec marketmind-postgres psql -U marketmind -d marketmind -c "
SELECT count(*) FROM pg_stat_activity;
"
```

---

## Scaling Guide

### Horizontal Scaling (Load Balancing)

1. **Multiple Backend Instances:**

```yaml
# docker-compose.yml
services:
  backend-1:
    build: ./apps/backend
    # ... config ...

  backend-2:
    build: ./apps/backend
    # ... config ...

  nginx-lb:
    image: nginx:alpine
    volumes:
      - ./nginx-lb.conf:/etc/nginx/nginx.conf
    ports:
      - "80:80"
    depends_on:
      - backend-1
      - backend-2
```

2. **Redis for Session Sharing:**

```typescript
// Enable Redis session store in backend
import RedisStore from 'connect-redis';
import { createClient } from 'redis';

const redisClient = createClient({ url: env.REDIS_URL });
await redisClient.connect();

fastify.register(session, {
  store: new RedisStore({ client: redisClient }),
  // ... other options
});
```

### Vertical Scaling (Resource Limits)

Update `docker-compose.yml`:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G
        reservations:
          cpus: '2'
          memory: 4G
```

---

## Troubleshooting

### Common Issues

**1. Backend won't start:**

```bash
# Check logs
docker-compose logs backend

# Verify environment variables
docker exec marketmind-backend env | grep -E "DATABASE|PORT|NODE"

# Test database connection
docker exec marketmind-backend node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => console.log('✅ Connected')).catch(console.error);
"
```

**2. Database connection errors:**

```bash
# Check PostgreSQL status
docker exec marketmind-postgres pg_isready

# Verify credentials
docker exec marketmind-postgres psql -U marketmind -d marketmind -c "SELECT 1;"

# Check network
docker network inspect marketmind_marketmind
```

**3. High memory usage:**

```bash
# Analyze memory
docker stats --no-stream

# PostgreSQL memory tuning
docker exec marketmind-postgres psql -U marketmind -d marketmind -c "
SELECT name, setting, unit FROM pg_settings 
WHERE name IN ('shared_buffers', 'work_mem', 'effective_cache_size');
"
```

**4. Slow queries:**

```bash
# Enable query logging
docker exec marketmind-postgres psql -U marketmind -d marketmind -c "
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1s
SELECT pg_reload_conf();
"

# View slow queries
docker exec marketmind-postgres psql -U marketmind -d marketmind -c "
SELECT query, calls, total_exec_time, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
"
```

---

## Backup & Recovery

### Automated Backups

Create `/usr/local/bin/marketmind-backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/marketmind"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# PostgreSQL backup
docker exec marketmind-postgres pg_dump -U marketmind marketmind | \
  gzip > $BACKUP_DIR/marketmind_${DATE}.sql.gz

# Cleanup old backups (keep 30 days)
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR/marketmind_${DATE}.sql.gz"
```

```bash
chmod +x /usr/local/bin/marketmind-backup.sh

# Add to cron (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/marketmind-backup.sh") | crontab -
```

### Restore from Backup

```bash
# Stop services
docker-compose stop backend

# Restore database
gunzip -c /var/backups/marketmind/marketmind_20251130_020000.sql.gz | \
  docker exec -i marketmind-postgres psql -U marketmind -d marketmind

# Restart services
docker-compose start backend
```

---

## Production Checklist

- [ ] Environment variables configured (`.env`)
- [ ] Secure keys generated (`ENCRYPTION_KEY`, `SESSION_SECRET`)
- [ ] Database migrations applied
- [ ] SSL/TLS certificate installed
- [ ] Firewall configured
- [ ] Nginx reverse proxy configured
- [ ] Log rotation enabled
- [ ] Backup cron job scheduled
- [ ] Monitoring alerts configured
- [ ] Rate limiting tested
- [ ] Health checks passing (`/health`, `/ready`)
- [ ] WebSocket connection tested
- [ ] Load testing completed

---

## Support

- **Documentation**: [https://github.com/nathanssantos/marketmind/docs](https://github.com/nathanssantos/marketmind/docs)
- **Issues**: [https://github.com/nathanssantos/marketmind/issues](https://github.com/nathanssantos/marketmind/issues)
- **Discord**: [MarketMind Community](#)

**Version**: 0.31.0  
**Last Updated**: November 30, 2025

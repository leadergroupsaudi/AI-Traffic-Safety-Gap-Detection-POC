# Rollback Guide — AI Traffic Safety

## Strategy

Because all runtime data (findings.csv, snapshots, uploads) lives in **host bind-mounted directories**, rolling back only replaces the container images — your data is untouched.

---

## Before Any Deployment — Tag the Current Images

```bash
docker tag ai-traffic-safety-backend:latest  ai-traffic-safety-backend:stable
docker tag ai-traffic-safety-frontend:latest ai-traffic-safety-frontend:stable
```

Always do this before a `docker compose build` so you have a known-good fallback.

---

## Rollback Procedure

### Step 1 — Stop Running Containers

```bash
docker compose down
```

### Step 2 — Restore Previous Images

```bash
docker tag ai-traffic-safety-backend:stable  ai-traffic-safety-backend:latest
docker tag ai-traffic-safety-frontend:stable ai-traffic-safety-frontend:latest
```

### Step 3 — Restart

```bash
docker compose up -d
```

### Step 4 — Verify

```bash
docker compose ps
curl http://localhost:8000/health
curl -I http://localhost:5173
```

---

## Rollback from Air-Gap Archive

If you exported images before the upgrade:

```bash
docker compose down
gunzip -c ai-traffic-safety-previous.tar.gz | docker load
docker compose up -d
```

---

## Data Rollback

If `findings.csv` or other data was corrupted during an upgrade:

```bash
# Stop containers
docker compose down

# Restore from backup
cp backup/findings.csv data/exports/findings.csv

# Restart
docker compose up -d
```

Recommended: keep daily backups of `data/exports/findings.csv` via a cron job:

```bash
# /etc/cron.daily/backup-findings
cp /opt/ai-traffic-safety/data/exports/findings.csv \
   /opt/backups/findings-$(date +%Y%m%d).csv
```

---

## Emergency: Wipe and Redeploy

Only use this if the application state is completely corrupt and you want a clean slate.

```bash
docker compose down
rm -f data/exports/findings.csv
# Restore findings.csv from a known-good backup
cp backup/findings.csv data/exports/findings.csv
docker compose up -d
```

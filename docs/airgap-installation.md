# Air-Gap Installation Guide — AI Traffic Safety

Use this guide to deploy on an isolated VM with no internet access.

## On the Internet-Connected Build Machine

### Step 1 — Build Images

```bash
cd /path/to/ai-traffic-safety
docker compose build
```

### Step 2 — Export Images to a Single Archive

```bash
docker save ai-traffic-safety-backend:latest ai-traffic-safety-frontend:latest \
  | gzip > ai-traffic-safety.tar.gz
```

### Step 3 — Package Deployment Bundle

```bash
mkdir airgap-bundle
cp ai-traffic-safety.tar.gz airgap-bundle/
cp docker-compose.yml         airgap-bundle/
cp .env.example               airgap-bundle/
cp -r docs/                   airgap-bundle/
cp -r data/exports/           airgap-bundle/   # include seed data
cp -r rules/                  airgap-bundle/
cp -r snapshots/              airgap-bundle/

tar -czf airgap-bundle.tar.gz airgap-bundle/
```

Transfer `airgap-bundle.tar.gz` to the air-gapped VM via USB, SFTP, or secure courier.

---

## On the Air-Gapped VM

### Prerequisites

- Docker 24.x installed (offline package or pre-installed)
- Docker Compose plugin installed

### Step 1 — Extract Bundle

```bash
tar -xzf airgap-bundle.tar.gz
cd airgap-bundle
```

### Step 2 — Load Docker Images

```bash
gunzip -c ai-traffic-safety.tar.gz | docker load
```

Verify images loaded:
```bash
docker images | grep ai-traffic-safety
```

Expected output:
```
ai-traffic-safety-backend    latest    <id>   ...
ai-traffic-safety-frontend   latest    <id>   ...
```

### Step 3 — Create Environment File

```bash
cp .env.example .env
# Edit .env — if OpenAI is not reachable, leave OPENAI_API_KEY blank
# The application gracefully skips AI recommendations if key is absent
nano .env
```

### Step 4 — Restore Data Directories

```bash
mkdir -p data/exports data/raw snapshots media/uploads
cp data/exports/findings.csv data/exports/    # if included in bundle
```

### Step 5 — Start Services

```bash
docker compose up -d
```

### Step 6 — Validate

```bash
# Health checks
curl http://localhost:8000/health
curl -I http://localhost:5173

# Container status
docker compose ps
```

### Step 7 — Configure Host Nginx

See `docs/deployment-guide.md` Step 6 for Nginx configuration.

---

## Updating in Air-Gap Environment

1. Build new images on the internet-connected machine
2. Re-export: `docker save ... | gzip > ai-traffic-safety-v2.tar.gz`
3. Transfer to air-gapped VM
4. Load: `gunzip -c ai-traffic-safety-v2.tar.gz | docker load`
5. Restart: `docker compose up -d`

Data is preserved because it lives in bind-mounted host directories, not inside the images.

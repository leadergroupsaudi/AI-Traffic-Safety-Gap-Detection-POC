# Deployment Guide — AI Traffic Safety

## Architecture

```
Host VM
├── Nginx (host-managed)
│     ├── proxy_pass http://127.0.0.1:5173  → Frontend container
│     └── proxy_pass http://127.0.0.1:8000  → Backend container
│
└── Docker Compose
      ├── ai-traffic-frontend  (nginx:alpine, port 8080 → host 5173)
      └── ai-traffic-backend   (python:3.12-slim, port 8000)
```

## Prerequisites

| Tool | Minimum version |
|---|---|
| Docker | 24.x |
| Docker Compose | 2.x (`docker compose` plugin) |
| Git | any |

## Step 1 — Clone / Transfer the Project

```bash
git clone <repo-url> /opt/ai-traffic-safety
cd /opt/ai-traffic-safety
```

## Step 2 — Create the Environment File

```bash
cp .env.example .env
nano .env          # fill in OPENAI_API_KEY
```

## Step 3 — Build Images

```bash
docker compose build
```

Expected output: two images built successfully
```
✓ ai-traffic-safety-backend:latest
✓ ai-traffic-safety-frontend:latest
```

## Step 4 — Start Services

```bash
docker compose up -d
```

## Step 5 — Verify Health

```bash
# Container status
docker compose ps

# Backend health
curl http://localhost:8000/health

# Frontend health
curl -I http://localhost:5173
```

Both containers must show `(healthy)` status within 60 seconds.

## Step 6 — Configure Host Nginx

Add the following to your Nginx server block:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        proxy_pass         http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection keep-alive;
        proxy_set_header   Host       $host;
    }

    # Backend API (optional direct access)
    location /api/ {
        proxy_pass         http://127.0.0.1:8000;
        proxy_set_header   Host             $host;
        proxy_set_header   X-Real-IP        $remote_addr;
        proxy_set_header   X-Forwarded-For  $proxy_add_x_forwarded_for;
    }
}
```

```bash
nginx -t && systemctl reload nginx
```

## Step 7 — Stopping

```bash
docker compose down          # stop and remove containers (data preserved)
docker compose down -v       # also remove named volumes (destructive)
```

## Port Reference

| Container | Internal Port | Host Port |
|---|---|---|
| Frontend (nginx) | 8080 | 5173 |
| Backend (FastAPI) | 8000 | 8000 |

## Data Volumes (Bind Mounts)

All runtime data is bind-mounted from the host — no data is lost on container restart:

| Host Path | Container Path | Purpose |
|---|---|---|
| `./data/exports/` | `/app/data/exports/` | findings.csv |
| `./data/raw/` | `/app/data/raw/` | tracking Excel files |
| `./snapshots/` | `/app/snapshots/` | annotated JPEG snapshots |
| `./media/` | `/app/media/` | uploaded videos |
| `./rules/` | `/app/rules/` | YAML rules (read-only) |

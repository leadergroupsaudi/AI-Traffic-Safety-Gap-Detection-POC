# Troubleshooting Guide — AI Traffic Safety

## Quick Health Check Commands

```bash
docker compose ps                          # container state + health
docker compose logs backend --tail=50     # backend logs
docker compose logs frontend --tail=50    # frontend logs
curl http://localhost:8000/health          # backend API health
curl -I http://localhost:5173              # frontend HTTP check
```

---

## Common Issues

### 1. Container stuck in `starting` health status

**Cause:** Application is still initialising within `start_period` (30 s).

**Fix:** Wait up to 60 seconds. If it stays `unhealthy`:
```bash
docker compose logs backend --tail=100
```

---

### 2. Backend returns `500` on `/api/findings`

**Cause:** `data/exports/findings.csv` is missing or has wrong permissions.

**Fix:**
```bash
ls -la data/exports/
# If missing:
touch data/exports/findings.csv
docker compose restart backend
```

---

### 3. Frontend shows blank page / white screen

**Cause:** JS bundle failed to load, or API requests to `/api/` are blocked.

**Check browser console for errors, then:**
```bash
docker compose logs frontend --tail=50
# Confirm nginx started correctly
docker exec ai-traffic-frontend nginx -t
```

---

### 4. `Port 8000 already in use`

**Cause:** An old `uvicorn` process is running on the host.

**Fix:**
```bash
sudo lsof -i :8000
sudo kill <PID>
docker compose up -d
```

---

### 5. `Port 5173 already in use`

**Cause:** Vite dev server is still running on the host from a tmux session.

**Fix:**
```bash
sudo lsof -i :5173
sudo kill <PID>
docker compose up -d
```

---

### 6. Container exits immediately with `exit code 1`

**Cause:** Python import error or missing file.

**Fix:**
```bash
docker compose logs backend
# Look for: ModuleNotFoundError / FileNotFoundError
```

If a Python package is missing, rebuild:
```bash
docker compose build backend --no-cache
docker compose up -d backend
```

---

### 7. Rules YAML not loading — Rules Matrix shows empty

**Cause:** `./rules/` bind-mount is not accessible or YAML is malformed.

**Fix:**
```bash
docker exec ai-traffic-backend ls /app/rules/
# Should list: saudi_traffic_rules.yaml

# Test YAML is valid:
docker exec ai-traffic-backend python -c "import yaml; yaml.safe_load(open('rules/saudi_traffic_rules.yaml'))"
```

---

### 8. OpenAI / AI recommendations not working

**Cause:** `OPENAI_API_KEY` not set or invalid.

**Fix:**
```bash
# Check .env
cat .env | grep OPENAI

# Test from inside container
docker exec ai-traffic-backend env | grep OPENAI
```

The application will skip AI recommendations gracefully if the key is absent — this is non-fatal.

---

### 9. Vulnerability scan findings (trivy)

Run a scan:
```bash
trivy image ai-traffic-safety-backend:latest
trivy image ai-traffic-safety-frontend:latest
```

To fix HIGH/CRITICAL findings, update base image pins in Dockerfiles:
- `docker/backend/Dockerfile` → update `FROM python:3.12.X-slim`
- `docker/frontend/Dockerfile` → update `FROM nginx:1.XX-alpine`

Then rebuild:
```bash
docker compose build --no-cache
```

---

### 10. Nginx (host) cannot reach containers

**Cause:** Firewall blocking loopback or containers on wrong interface.

**Fix:**
```bash
# Confirm containers are listening on host ports
ss -tlnp | grep -E '5173|8000'

# Test directly
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:5173

# Check iptables / ufw
sudo ufw status
```

---

## Log Locations

| What | Command |
|---|---|
| Backend logs | `docker compose logs backend` |
| Frontend (nginx) logs | `docker compose logs frontend` |
| Docker daemon logs | `journalctl -u docker` |

---

## Useful Docker Commands

```bash
# Rebuild a single service
docker compose build backend --no-cache

# Restart a single service
docker compose restart backend

# Open a shell inside a container
docker exec -it ai-traffic-backend bash

# Check who the process runs as (should NOT be root)
docker exec ai-traffic-backend whoami

# Inspect environment variables
docker exec ai-traffic-backend env

# Check disk usage
docker system df
```

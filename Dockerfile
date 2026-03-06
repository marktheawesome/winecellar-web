# ============================================================
# Stage 1: Build React frontend
# ============================================================
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ============================================================
# Stage 2: Production image — Nginx + Python/Uvicorn
# ============================================================
FROM python:3.11-slim

# Install nginx and supervisor
RUN apt-get update && \
    apt-get install -y --no-install-recommends nginx supervisor && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# ---------- Python backend ----------
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./

# ---------- Frontend static files ----------
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html

# ---------- Nginx config ----------
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -f /etc/nginx/sites-enabled/default

# ---------- Supervisor config ----------
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 80

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]

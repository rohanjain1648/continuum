# ---- Stage 1: build the frontend (Vite + React + React Three Fiber) ----
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: the backend, serving the built frontend ----
FROM python:3.12-slim
WORKDIR /app

# Cognee/embedding deps sometimes need a compiler for native wheels.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ ./backend/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

WORKDIR /app/backend
# run.py reads PORT from the environment (defaults to 8000) — Render injects
# its own PORT at runtime, so don't hardcode EXPOSE/CMD to a fixed port here.
EXPOSE 8000
CMD ["python", "run.py"]

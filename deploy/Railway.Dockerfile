FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ARG VITE_MAPBOX_TOKEN=""
ENV VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN VITE_API_URL=/api
RUN npm run build

FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    DEMO_DATA_PATH=/data/demo.json UPLOADS_DIR=/data/uploads \
    FRONTEND_DIST=/app/frontend/dist
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/app backend/app
COPY backend/fixtures backend/fixtures
COPY --from=frontend /app/frontend/dist frontend/dist
COPY deploy/railway-start.sh /app/start.sh
RUN chmod +x /app/start.sh
EXPOSE 8080
CMD ["/app/start.sh"]

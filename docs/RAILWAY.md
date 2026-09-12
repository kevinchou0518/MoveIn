# Railway deployment

This deployment runs the built React frontend and FastAPI together as **one Railway service**. Attach **one Volume at `/data`**. Railway provides the public HTTPS URL; the app serves `/api`, `/uploads`, and frontend routes on the same origin.

## 1. Put the deployment files on GitHub

The repository must contain `deploy/Railway.Dockerfile`, `deploy/railway-start.sh`, `.dockerignore`, and `backend/app/web.py` before Railway can build this version. Root Directory stays `/` (repository root). The root `Dockerfile` and `compose.vultr.yaml` belong to the alternative Vultr setup; explicitly select the Railway Dockerfile below.

## 2. Create the Railway service

1. Sign in at [Railway](https://railway.com/) using GitHub.
2. Create a project and add a service from the `kevinchou0518/MoveIn` GitHub repository. Select `main`.
3. Add the service variables below, then apply/deploy the changes. If an automatic deployment started before configuration, cancel it and deploy after configuring the Dockerfile and volume.

Railway can [build from a custom Dockerfile](https://docs.railway.com/builds/dockerfiles) using `RAILWAY_DOCKERFILE_PATH`. Add values under the service's **Variables** tab; its [Raw Editor](https://docs.railway.com/variables) accepts environment-file syntax.

```dotenv
RAILWAY_DOCKERFILE_PATH=deploy/Railway.Dockerfile
PORT=8080
MONGODB_DB=movein
GROK_MODEL=grok-4.6
GROK_IMAGE_MODEL=grok-imagine-image-2.0
```

Add privately from your local `.env`:

| Variable | Value |
| --- | --- |
| `GROK_API_KEY` | Existing server API key |
| `MAPBOX_ACCESS_TOKEN` | Existing server Mapbox token |
| `VITE_MAPBOX_TOKEN` | Public browser Mapbox token; rebuild when changed |
| `MONGODB_URI` | Existing Atlas connection string, or omit for persistent local demo data |
| `GROK_RESEARCH_MODEL` | Optional override; otherwise uses `GROK_MODEL` |

Do not set `VITE_API_URL` to a backend hostname: this image builds it as `/api`. Do not copy secret API keys into `VITE_` variables. `DEMO_DATA_PATH=/data/demo.json`, `UPLOADS_DIR=/data/uploads`, and the frontend path are already set by the image.

## 3. Attach storage before the first real deployment

Add a Volume to the service, with **Mount Path `/data`**. See [Railway Volumes](https://docs.railway.com/volumes). The container initializes files at runtime because volumes are mounted at deployment, not build time.

- `/data/uploads`: normalized demo photos, user uploads, generated room images.
- `/data/demo.json`: listings/orders/profiles when `MONGODB_URI` is absent.
- Atlas stores metadata, not photo bytes: keep this Volume even with Atlas.

Keep one replica and the default start command. The startup script uses one Uvicorn worker and Railway's `PORT` variable. A volume-backed deployment can have brief downtime during redeploys. Configure volume backups in Railway.

## 4. Deploy and generate a URL

Under service settings:

- **Root Directory:** `/`
- **Start Command:** leave empty (Docker CMD runs the included script).
- **Healthcheck Path:** `/api/health`
- **Healthcheck Timeout:** `300` seconds.
- **Replicas:** `1`

Deploy. In **Settings → Networking → Public Networking**, generate a Railway domain and use target port **8080**. A purchased domain is not required. See [public networking](https://docs.railway.com/networking/public-networking) and [healthchecks](https://docs.railway.com/deployments/healthchecks).

Add the Railway domain to the public Mapbox token's permitted URLs. If Atlas is enabled, ensure its Network Access rules permit the deployment's outbound traffic. Railway outbound addresses can differ from your local computer; consult [Railway outbound networking](https://docs.railway.com/networking/outbound-networking) before configuring an IP allowlist.

## 5. Verify

Open these on the generated domain:

- `/api/health`: reports the selected storage/provider configuration.
- `/buyer` and `/account`: UI loads directly and after refresh.
- `/uploads/demo/chair-04.jpg`: demo photo loads.
- Select another user and confirm their profile address appears in the buyer flow.
- Analyze a photo, publish an item, reserve/cancel a bundle, and verify the data/photo remain after a redeploy.

The first deployment seeds fresh demo data. Local `backend/data/persona-demo.json`, uploads, and demo recording files are not automatically transferred. Do not switch from local JSON to Atlas expecting old JSON records to appear there; migrate them explicitly if needed.

## Troubleshooting

- **Caddy starts / hostname `backend` cannot resolve:** Railway selected the Vultr Dockerfile. Set `RAILWAY_DOCKERFILE_PATH=deploy/Railway.Dockerfile` and redeploy.
- **502 / healthcheck failure:** check deploy logs, port 8080, `/api/health`, and Atlas connectivity.
- **Address search / AI fails:** check server variables; map display also needs the public build-time token.
- **Photos disappear after redeploy:** confirm the Volume is mounted at `/data`, not a build directory.

Local validation covers API startup under the deployment wrapper, frontend-route fallback, real API responses, missing-file errors, and both photo URL forms. A full Docker build and hosted smoke test are still required; Docker is not installed on the authoring machine.

# Deploy MoveIn on Vultr

Use an Ubuntu 24.04 LTS Cloud Compute instance with Docker Engine and the Compose plugin. A 2-vCPU / 4-GB machine is a reasonable starting point for this demo and on-server builds; actual capacity depends on concurrent bundle searches. AI runs through external APIs, so no GPU is required.

[Vultr Docker setup](https://docs.vultr.com/how-to-install-docker-on-ubuntu-24-04) · [Docker Ubuntu installation](https://docs.docker.com/engine/install/ubuntu/)

## Prepare the server

Allow SSH from your own IP and public TCP 80/443 in the Vultr firewall. The API is internal to the Compose network; do not open 8000 or 5173. Install Git and Docker, then clone the repository using an authorized SSH key if it is private:

```sh
git clone git@github.com:kevinchou0518/MoveIn.git
cd MoveIn
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
```

Fill in `deploy/.env` privately on the server. Server keys stay in the backend environment. Only `VITE_MAPBOX_TOKEN` is embedded in the public frontend bundle; configure its allowed production URL in Mapbox. Do not copy secret keys to variables starting with `VITE_`.

Use `SITE_ADDRESS=:80` for initial HTTP access through the server IP. For HTTPS, point your domain's A record at the server (and only add AAAA if IPv6 is configured), set `SITE_ADDRESS=your-real-domain`, and recreate the web container. Caddy handles domain certificates and renewals with its persistent `/data` volume. See [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https).

## Start and verify

Run from the repository root:

```sh
docker compose --env-file deploy/.env -f compose.vultr.yaml config --quiet
docker compose --env-file deploy/.env -f compose.vultr.yaml up -d --build
docker compose --env-file deploy/.env -f compose.vultr.yaml ps
curl --fail http://127.0.0.1/api/health
```

The local curl example assumes `SITE_ADDRESS=:80`. Once HTTPS is enabled, request `https://your-real-domain/api/health` instead.

Check `/buyer`, `/account`, and refreshing an order URL directly. Verify `/api/me`, `/uploads/demo/chair-04.jpg`, address search, AI autofill, photo upload, a demo reservation, and cancellation. Refreshing a client route must return the app; missing upload URLs must return backend errors rather than the frontend HTML.

[Caddy strips `/api` before proxying](https://caddyserver.com/docs/caddyfile/directives/handle_path). Photo paths are preserved, and [SPA fallback](https://caddyserver.com/docs/caddyfile/directives/try_files) applies only to frontend routes. The browser uses one origin, so no development Vite server or extra CORS configuration is needed. Compose [waits for backend health](https://docs.docker.com/compose/how-tos/startup-order/) before starting the web service.

## Data and existing demo records

With an empty `MONGODB_URI`, the first startup creates seven users and demo inventory. `movein_demo_data` stores JSON; `movein_uploads` stores demo photos, uploaded furniture, and AI room images. Container rebuilds preserve both volumes. Use one backend worker and one backend replica in local mode.

For Atlas, use a separate deployment database if you want to keep local testing independent. Add the Vultr server IP to Atlas Network Access, then set `MONGODB_URI` and `MONGODB_DB`. Atlas must support transactions. Images still live in the uploads volume; MongoDB alone does not back them up.

Deploying does not automatically copy `backend/data/persona-demo.json` or local uploads. To migrate those exact records, stop the local app for a consistent backup, then copy BOTH the JSON and uploads to the stopped server backend volumes. Preserve ownership for UID 10001. Do not overwrite an existing deployment's records without a backup. Retain the original local copies until verification completes.

Back up the data and uploads volumes together while the backend is stopped (or use Atlas backups plus an uploads backup). Do not use `docker compose down -v` unless intentionally deleting persistent data. Normal updates:

```sh
git pull --ff-only
docker compose --env-file deploy/.env -f compose.vultr.yaml up -d --build
docker compose --env-file deploy/.env -f compose.vultr.yaml logs --tail=100 backend web
```

This is a public demo with selectable personas, not secure user authentication. Visitors can operate the demo accounts and invoke enabled paid AI services.

## Validation status

Deployment configuration is prepared. The authoring machine has no Docker installation, so container builds, Caddy startup, server connectivity, and HTTPS must still be verified on the target server. No Vultr resources have been purchased or changed.

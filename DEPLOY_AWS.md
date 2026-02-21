# Deploy Visual Auth Gateway on AWS (EC2 + Nginx + systemd)

This guide deploys the app on a single EC2 instance and fronts it with Nginx + TLS.

## 1) Provision infrastructure

- Launch an EC2 Ubuntu 24.04 (or 22.04) instance.
- Attach an Elastic IP (recommended).
- Security Group inbound:
  - `22` from your admin IP
  - `80` from `0.0.0.0/0`
  - `443` from `0.0.0.0/0`
- (Optional) Attach an EBS volume for persistent DB at `/var/lib/visual-auth-gateway`.

## 2) DNS

Create DNS records:
- `auth.example.com` -> EC2 Elastic IP
- `bank.example.com` -> EC2 Elastic IP

## 3) Install runtime

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## 4) Deploy app

```bash
sudo mkdir -p /opt/visual-auth-gateway
sudo chown "$USER":"$USER" /opt/visual-auth-gateway
cd /opt/visual-auth-gateway

git clone <your-repo-url> .
npm ci
```

Create env file:

```bash
cp .env.example .env
nano .env
```

Minimum required `.env` values:
- `SESSION_SECRET` (strong random)
- `PUBLIC_SAAS_ORIGIN=https://auth.example.com`
- `PUBLIC_BANK_ORIGIN=https://bank.example.com`
- `ALLOWED_CORS_ORIGINS=https://auth.example.com,https://bank.example.com`
- `ALLOWED_RETURN_ORIGINS=https://bank.example.com`
- `RP_ID=auth.example.com`
- `EXPECTED_ORIGIN=https://auth.example.com`
- `ALLOWED_RP_IDS=auth.example.com`
- `DATABASE_PATH=/var/lib/visual-auth-gateway/visualauth.db`
- `TRUST_PROXY=true`
- `SESSION_SECURE_COOKIES=true`
- `SESSION_SAME_SITE=none`

Prepare DB directory:

```bash
sudo mkdir -p /var/lib/visual-auth-gateway
sudo chown -R "$USER":"$USER" /var/lib/visual-auth-gateway
```

## 5) systemd service

Create `/etc/systemd/system/visual-auth-gateway.service`:

```ini
[Unit]
Description=Visual Auth Gateway
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/visual-auth-gateway
EnvironmentFile=/opt/visual-auth-gateway/.env
ExecStart=/usr/bin/node /opt/visual-auth-gateway/server/server.js
Restart=always
RestartSec=5
User=ubuntu
Group=ubuntu

[Install]
WantedBy=multi-user.target
```

Enable/start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable visual-auth-gateway
sudo systemctl start visual-auth-gateway
sudo systemctl status visual-auth-gateway
```

## 6) Nginx reverse proxy

Create `/etc/nginx/sites-available/visual-auth-gateway`:

```nginx
server {
  listen 80;
  server_name auth.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  listen 80;
  server_name bank.example.com;

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/visual-auth-gateway /etc/nginx/sites-enabled/visual-auth-gateway
sudo nginx -t
sudo systemctl reload nginx
```

## 7) TLS certificates

```bash
sudo certbot --nginx -d auth.example.com -d bank.example.com
```

After certbot, verify HTTPS endpoints:
- `https://auth.example.com/api/health`
- `https://bank.example.com/api/health`

## 8) Verify app

```bash
curl -fsSL https://auth.example.com/api/health
curl -fsSL https://bank.example.com/api/health
npm test
```

Also verify WebAuthn on a real browser over HTTPS (required).

## 9) Operations

- Logs: `sudo journalctl -u visual-auth-gateway -f`
- Restart: `sudo systemctl restart visual-auth-gateway`
- Deploy update:
  1. `git pull`
  2. `npm ci`
  3. `sudo systemctl restart visual-auth-gateway`

## Notes

- This project uses SQLite. For HA/multi-instance, move to RDS (PostgreSQL/MySQL).
- Keep `SESSION_SECRET` private and rotate periodically.
- If you use ALB or CloudFront in front of EC2, keep `TRUST_PROXY=true`.

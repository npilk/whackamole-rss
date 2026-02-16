# Whackamole RSS - Self-Hosting Guide

## Docker Deployment

This app is containerized and ready for deployment behind a reverse proxy.

### Initial Setup

1. **Install dependencies**
```npm install```

2. **Build and start the container**:
   ```bash
   docker-compose up -d --build
   ```

The app will be available at `http://localhost:3424`.

### Nginx Configuration

To serve behind Nginx reverse proxy, add this to your configuration:

```nginx
server {
    listen 80;
    server_name rss.yourdomain.com;  # Change to your domain

    location / {
        proxy_pass http://localhost:3424;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Manual Commands

- **View logs**: `docker-compose logs -f`
- **Restart**: `docker-compose restart`
- **Stop**: `docker-compose down`
- **Update and rebuild**: `docker-compose up -d --build`

### Port Configuration

The app runs on port 2999 inside the container, mapped to port 3424 on the host by default. To change the external port, edit the `ports` section in `docker-compose.yml`:

```yaml
ports:
  - "YOUR_PORT:2999"
```

### Environment Variables

Set in `docker-compose.yml`:
- `NODE_ENV=production`
- `PORT=2999` (internal port)

### Health Check

The container includes a health check that verifies the app is responding on port 2999.

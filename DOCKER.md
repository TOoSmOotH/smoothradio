# SmoothRadio

AI-Powered Music Streaming Server

## Building Docker Images

Build all images:
```bash
docker-compose build
```

Build specific service:
```bash
docker-compose build api
docker-compose build worker
docker-compose build admin-ui
```

## Docker Compose Commands

Start services:
```bash
docker-compose up -d
```

View logs:
```bash
docker-compose logs -f
```

Stop services:
```bash
docker-compose down
```

Stop and remove volumes:
```bash
docker-compose down -v
```

## Environment Configuration

Create a `.env` file:
```env
SECRET_STORE_KEY=your-secure-encryption-key-here
```

## Database Migrations

```bash
docker-compose exec db psql -U user -d music_server
```

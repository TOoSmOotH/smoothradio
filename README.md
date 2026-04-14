# SmoothRadio - AI-Powered Music Streaming Server

A containerized TypeScript monorepo designed to handle TBs of MP3 data, utilizing AI for music categorization and discovery.

## Architecture

### Infrastructure
- **Runtime**: TypeScript / Node.js
- **Database**: PostgreSQL (Metadata, Users, History)
- **Queue/Cache**: Valkey (via BullMQ)
- **AI Layer**: Provider-agnostic LLM interface (vLLM, OpenAI, etc.)
- **Deployment**: Docker Compose

### Packages
- `@smoothradio/shared` - Shared types and utilities
- `@smoothradio/crypto` - AES-256-GCM Secret Store for API keys
- `@smoothradio/database` - Database schema and ORMs
- `apps/api` - Express.js API server
- `apps/worker` - Background worker with BullMQ
- `apps/admin-ui` - React admin dashboard

## Getting Started

### Prerequisites
- Docker and Docker Compose
- Node.js 20+ (for local development)
- pnpm (`npm install -g pnpm`)

### Development

1. Start infrastructure services:
```bash
docker-compose up -d db valkey
```

2. Install dependencies:
```bash
pnpm install
```

3. Run development servers:
```bash
pnpm dev
```

This will start:
- API server on `http://localhost:3000`
- Worker (if configured)
- Admin UI on `http://localhost:3001`

### Build

```bash
pnpm build
```

### Deployment

```bash
docker-compose up -d
```

## Project Status

### Phase 1: Core Infrastructure ✅
- [x] Docker environment setup (PostgreSQL, Valkey)
- [x] TypeScript monorepo initialization
- [x] AES-256-GCM Secret Store for API keys
- [x] Initial Database Schema deployment

### Phase 2: The Ingestion Pipeline
- [x] Recursive MP3 Scanner service
- [x] Provider-agnostic AI Layer (`LLMProvider` interface)
- [x] AI Categorization logic (Genre + Decade mapping)
- [x] Valkey-backed async task queue (BullMQ)

### Phase 3: User & Streaming Experience
- [ ] JWT-based Authentication system
- [ ] HTTP Range-request streaming server for MP3s
- [ ] User listening event tracking

### Phase 4: Admin & Intelligence
- [ ] Admin Dashboard (Monitoring, Scan/AI controls, Model config)
- [ ] AI-driven Discovery Engine for artist recommendations
- [ ] AI-curated Playlist API

### Phase 5: Final Polish
- [ ] Performance optimization for TB-scale metadata
- [ ] Security audit (Key encryption & JWT)

## Environment Variables

### API
- `POST /scan`
  - Body: `{ "path": "/music", "recursive": true, "maxDepth": 4, "includeHidden": false, "fileExtensions": ["mp3"] }`
  - `path` or `rootPath` required unless `MUSIC_LIBRARY_PATH` is set
- `GET /tracks?limit=50&offset=0`
  - Returns a paginated list of rows from the `tracks` table
- `DATABASE_URL` - PostgreSQL connection string (default: `postgres://user:password@localhost:5432/music_server`)
- `VALKEY_URL` - Valkey connection string (default: `redis://localhost:6379`)
- `MUSIC_LIBRARY_PATH` - Default directory for `/scan` when request body omits `path`
- `SECRET_STORE_KEY` - Encryption key for secret store (default: `default-secret-key`)
- `PORT` - API server port (default: `3000`)
- `SCAN_JOB_ATTEMPTS` - Scan job retry count in BullMQ (default: `3`)
- `SCAN_JOB_BACKOFF_MS` - Scan job exponential backoff minimum ms (default: `2000`)

### Worker
- Same as API plus job queue configuration
- `AI_JOB_ATTEMPTS` - AI categorization retry count in BullMQ (default: `3`)
- `AI_JOB_BACKOFF_MS` - AI job exponential backoff minimum ms (default: `5000`)
- `LLM_PROVIDER` - Provider type (`ollama`, `openai`, `anthropic`, or `vllm`)
- `LLM_ENDPOINT` - Provider endpoint URL (default: `http://localhost:11434`)
- `LLM_MODEL_NAME` - Model name (default: `llama3`)
- `LLM_TEMPERATURE` - Inference temperature
- `LLM_MAX_TOKENS` - Max completion token budget

### Admin UI
- `VITE_API_URL` - API endpoint URL

## License

MIT

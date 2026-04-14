# Project Plan: AI-Powered Streaming Server

## Architecture Overview
A containerized TypeScript monorepo designed to handle TBs of MP3 data, utilizing AI for music categorization and discovery.

### Infrastructure
- **Runtime**: TypeScript / Node.js
- **Database**: PostgreSQL (Metadata, Users, History)
- **Queue/Cache**: Valkey (via BullMQ)
- **AI Layer**: Provider-agnostic LLM interface (vLLM, OpenAI, etc.)
- **Deployment**: Docker Compose

## Implementation Roadmap

### Phase 1: Core Infrastructure ✅
- [x] Docker environment setup (PostgreSQL, Valkey)
- [x] TypeScript monorepo initialization
- [x] AES-256-GCM Secret Store for API keys
- [x] Initial Database Schema deployment

### Phase 2: The Ingestion Pipeline ✅
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

## Testing Strategy

### Unit Tests (Jest)
- **Shared Package** (`apps/shared`)
  - MP3 ID3 tag parser tests
  - LLM provider interface tests (OpenAI, Anthropic, Ollama, vLLM)
  - SecretStore encryption/decryption tests
  - Queue job type definitions

- **Database Package** (`apps/database`)
  - Schema validation tests
  - Repository pattern tests
  - Query builder tests

- **Crypto Package** (`apps/crypto`)
  - AES-256-GCM encryption tests
  - Key derivation tests
  - Invalid input handling

- **API Package** (`apps/api`)
  - Route handler tests
  - Middleware tests
  - Controller tests

- **Worker Package** (`apps/worker`)
  - Scanner tests
  - AI categorization tests

### Integration Tests
- **Database Integration**
  - PostgreSQL connection tests
  - Table CRUD operations
  - Schema migrations

- **Queue Integration**
  - BullMQ job enqueue/dequeue
  - Worker processing
  - Failed job retry logic

- **API Integration**
  - Full request/response cycle
  - Authentication flow
  - Error handling

### E2E Tests (Playwright)
- **Admin UI Tests** (`apps/admin-ui`)
  - Dashboard navigation
  - Scan job monitoring
  - AI model configuration
  - Artist recommendations display

- **API E2E Tests**
  - GET `/health` endpoint
  - GET `/` endpoint
  - POST authentication flow
  - Artist search and recommendations

### Testing Tools
```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@vitest/ui": "^1.0.0",
    "@playwright/test": "^1.40.0",
    "@types/jest": "^29.0.0",
    "jest": "^29.0.0"
  }
}
```

### Test Commands
```bash
# Run unit tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run E2E tests
pnpm test:e2e

# Run Playwright tests
pnpm test:playwright

# Run tests in watch mode
pnpm test:watch
```

### CI/CD Pipeline
- [ ] Run `pnpm build` on every commit
- [ ] Run `pnpm lint` and `pnpm typecheck`
- [ ] Execute unit tests
- [ ] Execute Playwright E2E tests
- [ ] Coverage threshold checks

# TraceOpsAPI — Developer-Focused API Gateway & Analytics Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-red.svg)](https://redis.io/)
[![Tests](https://img.shields.io/badge/Vitest-72%20Passing-brightgreen.svg)](https://vitest.dev/)

**TraceOpsAPI** is a high-performance, self-hosted API Gateway and Real-Time Telemetry Platform designed for engineering teams that need centralized reverse proxying, robust API security, distributed rate limiting, and live traffic observability without the operational complexity of Kubernetes or distributed service meshes.

---

## 1. High-Level Architecture: The Modular Monolith

TraceOpsAPI is architected as a **Modular Monolith** with a strict architectural boundary between the **Data Plane** (high-throughput, sub-millisecond reverse proxy runtime) and the **Control Plane** (management APIs and analytical aggregation engine).

```
[ Client Applications ]                     [ Developer / Admin Browser ]
         │ (Traffic via Gateway)                         │ (Management & Metrics)
         ▼                                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TRACEOPSAPI MONOLITH                                                        │
│                                                                             │
│  ┌───────────────────────────────┐     ┌─────────────────────────────────┐  │
│  │ DATA PLANE (Reverse Proxy)    │     │ CONTROL PLANE (Management API)  │  │
│  │                               │     │                                 │  │
│  │ 1. Telemetry Hook (res.finish)│     │ 1. Service Config (CRUD)        │  │
│  │ 2. Route/Service Matcher      │     │ 2. API Key Management (Issue/   │  │
│  │ 3. API Key Authenticator      │     │    Revoke/Hash)                 │  │
│  │ 4. Redis Rate Limiter (ZSET)  │     │ 3. Analytics Aggregation Engine │  │
│  │ 5. Safe Reverse Proxy Client  │     │ 4. Dashboard JWT Auth           │  │
│  │    (RFC 7230 Header Filter)   │     └────────────────┬────────────────┘  │
│  └──────────────┬────────────────┘                      │                   │
│                 │                                       │                   │
│                 ▼                                       ▼                   │
│  ┌───────────────────────────────┐     ┌─────────────────────────────────┐  │
│  │ Redis (In-Memory)             │     │ PostgreSQL (Prisma ORM)         │  │
│  │ - Atomic Lua Sliding Window   │     │ - Services, Hashed API Keys     │  │
│  │ - Key prefix active cache     │     │ - Request Logs & Telemetry      │  │
│  └───────────────────────────────┘     └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
[ Upstream Backend Services (api.stripe.com, internal microservices, etc.) ]
```

---

## 2. Gateway Request Lifecycle

When a client application sends an HTTP request through `http://localhost:4000/gateway/:serviceSlug/*`:

```
Client Request
      │
      ▼
1. Telemetry Interceptor ────── Hooks onto res.on("finish") to record telemetry asynchronously
      │                         (Zero latency added to the client response path)
      ▼
2. Route Matcher ────────────── Resolves service by slug; verifies isActive and HTTP method whitelist
      │
      ▼
3. Authenticator ────────────── Extracts x-api-key or Bearer token; queries by indexed prefix
      │                         and verifies hash in constant time via crypto.timingSafeEqual()
      ▼
4. Distributed Rate Limiter ─── Evaluates atomic sliding window in Redis via Lua script;
      │                         injects RateLimit-* headers; rejects with HTTP 429 if breached
      ▼
5. Header Sanitizer ─────────── Strips RFC 7230 hop-by-hop headers and sensitive gateway credentials;
      │                         injects proxy transparency headers (X-Forwarded-*, Request ID)
      ▼
6. Upstream Forwarder ───────── Dispatches request to upstream destination; handles timeouts (HTTP 504),
      │                         connection refusals (HTTP 502), and transparent status propagation
      ▼
7. Client Response & Async Log ─ Streams upstream response to client; res.finish triggers non-blocking
                                PostgreSQL insert into request_logs
```

---

## 3. Core Engineering Features & Security Mitigations

### 🛡️ Server-Side Request Forgery (SSRF) Defense Engine
Allowing users to register upstream URLs exposes applications to SSRF attacks targeting internal networks or cloud metadata endpoints (`http://169.254.169.254`).
* **Multi-Homed DNS Validation**: A naive hostname check can be bypassed by an attacker pointing `attacker.com` to `127.0.0.1`. TraceOpsAPI resolves **all** underlying DNS `A` and `AAAA` records via `dns.lookup(hostname, { all: true })`.
* **Prohibited IP Spaces**: Automatically rejects RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback (`127.0.0.0/8`, `::1`), link-local metadata (`169.254.0.0/16`), and carrier-grade NAT (`100.64.0.0/10`).
* **Protocol & Credential Restrictions**: Rejects embedded credentials (`http://user:pass@host`) and non-HTTP(S) schemes (`file://`, `ftp://`, `gopher://`).

### 🔑 Cryptographic API Key Architecture
* **Token Format**: `tr_live_<8_hex_prefix>_<48_hex_secret>` (192 bits of cryptographic entropy generated via `crypto.randomBytes`).
* **Zero Plaintext Storage**: Raw secrets exist in memory **only** at the instant of creation. The database stores only `keyPrefix` and a one-way `keyHash` (SHA-256).
* **Indexed $O(1)$ Lookup**: The 8-character prefix allows instant database lookup without full-table scans.
* **Timing Attack Prevention**: Hash comparisons execute in constant time using `crypto.timingSafeEqual()`, thwarting microsecond-level side-channel attacks.

### ⏱️ Atomic Redis Sliding Window Rate Limiting
* **The 2x Boundary Burst Problem**: Fixed-window rate limiters can be exploited by sending 60 requests at second 59 and 60 requests at second 60, resulting in 120 requests in 2 seconds.
* **Our Solution**: TraceOpsAPI utilizes an atomic Lua script running on Redis Sorted Sets (`ZSET`):
  1. `ZREMRANGEBYSCORE key -inf (now - windowMs)` removes expired records.
  2. `ZCARD key` counts requests in the rolling window.
  3. If within quota, `ZADD key now uniqueMember` adds the request atomically.
  4. If exceeded, returns exact `resetSeconds` until the oldest request expires.
* **Fail-Open Resilience**: If Redis crashes or suffers network latency, the gateway logs a warning and fails open, preventing a cache glitch from taking down production APIs.

### 📊 Asynchronous Telemetry & Real Analytics
* **Zero Latency Penalty**: Implements the Express `res.on("finish")` pattern. Request telemetry is written to PostgreSQL **after** response bytes have already been sent to the client.
* **Relational Indexing**: Leverages compound B-Tree index `@@index([serviceId, timestamp])` for fast index range scans across millions of log rows.
* **Analytics Aggregations**: Computes total throughput, success rate, error rate, average latency (ms), status code breakdowns, and time-series histograms across `1h`, `24h`, `7d`, and `30d`.

---

## 4. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Data Plane & Backend** | Node.js (v20+), Express, TypeScript (Strict), Axios, Zod |
| **Database & ORM** | PostgreSQL 16, Prisma ORM |
| **Cache & Rate Limiter** | Redis 7, IORedis, Atomic Lua Scripts |
| **Frontend Dashboard** | Next.js 14 (App Router), React 18, TypeScript, Lucide Icons, Vanilla CSS |
| **Testing** | Vitest (v1.6), Supertest, In-Process Ephemeral Mock Upstream |

---

## 5. Getting Started & Local Setup

### Prerequisites
* [Node.js](https://nodejs.org/) v20+ and `npm`
* [Docker Desktop](https://www.docker.com/) (for PostgreSQL and Redis)

### Step 1: Clone Repository
```bash
git clone https://github.com/Flames004/traceops-api.git
cd traceops-api
```

### Step 2: Start PostgreSQL & Redis Containers
```bash
docker compose up -d
```
* PostgreSQL runs on `localhost:5432` (`traceops_user` / `traceops_password` / `traceops_db`)
* Redis runs on `localhost:6379`

### Step 3: Configure Backend & Run Migrations
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```
The backend API and Gateway will boot on `http://localhost:4000`.

### Step 4: Start Next.js Frontend Dashboard
In a separate terminal window:
```bash
cd frontend
npm install
npm run dev
```
Open **`http://localhost:3000`** in your browser.

---

## 6. Testing & Quality Assurance

TraceOpsAPI includes a comprehensive test suite covering SSRF defense, constant-time token verification, reverse proxy forwarding, mock upstream timeouts, rate limiting boundaries, and analytics queries:

```bash
cd backend
npm test
```

### Test Results
```
 ✓ src/lib/apiKey.test.ts  (7 tests)
 ✓ src/lib/ssrf.test.ts  (13 tests)
 ✓ src/rate-limiting/slidingWindow.test.ts  (4 tests)
 ✓ src/modules/auth/auth.test.ts  (7 tests)
 ✓ src/modules/services/service.test.ts  (8 tests)
 ✓ src/modules/keys/key.test.ts  (11 tests)
 ✓ src/gateway/gateway.test.ts  (13 tests)
 ✓ src/gateway/telemetry.test.ts  (3 tests)
 ✓ src/modules/analytics/analytics.test.ts  (4 tests)
 ✓ src/app.test.ts  (2 tests)

 Test Files  10 passed (10)
      Tests  72 passed (72)
```

---

## 7. API Reference (Control Plane & Data Plane)

### Data Plane (Gateway Reverse Proxy)
```http
ALL /gateway/:serviceSlug/*
```
* **Headers**: `x-api-key: tr_live_...` or `Authorization: Bearer tr_live_...`
* **Response Headers**:
  * `X-Gateway-Request-Id`: Unique UUID tracing this request
  * `X-Gateway-Latency-Ms`: Gateway transit round-trip latency
  * `RateLimit-Limit`: Maximum requests permitted in window
  * `RateLimit-Remaining`: Remaining request quota
  * `RateLimit-Reset`: Seconds until window resets
  * `Retry-After`: Seconds to wait (returned with HTTP 429)

### Control Plane Management Endpoints

| Endpoint | Method | Description | Auth Required |
| :--- | :---: | :--- | :---: |
| `/api/v1/auth/register` | `POST` | Register dashboard admin account | No |
| `/api/v1/auth/login` | `POST` | Sign in to dashboard & receive JWT | No |
| `/api/v1/auth/me` | `GET` | Get authenticated user profile | Bearer JWT |
| `/api/v1/services` | `GET` | List user's registered upstream services | Bearer JWT |
| `/api/v1/services` | `POST` | Register new upstream service (SSRF checked) | Bearer JWT |
| `/api/v1/services/:id/toggle` | `PATCH` | Enable or disable a service kill-switch | Bearer JWT |
| `/api/v1/services/:id/keys` | `GET` | List masked API keys for service | Bearer JWT |
| `/api/v1/services/:id/keys` | `POST` | Provision API key (returns raw secret once) | Bearer JWT |
| `/api/v1/services/:id/keys/:keyId/revoke` | `PATCH` | Revoke active API key immediately | Bearer JWT |
| `/api/v1/analytics/overview` | `GET` | Get aggregated telemetry metrics & chart data | Bearer JWT |
| `/api/v1/analytics/logs` | `GET` | Paginated search of request audit logs | Bearer JWT |
| `/health` | `GET` | Liveness / readiness health check | No |

---

## 8. License

MIT License. Built for production-grade API gateway deployments and technical interview portfolio presentations.

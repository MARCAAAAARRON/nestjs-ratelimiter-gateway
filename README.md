# NestJS Distributed Rate Limiter & API Gateway

A rate-limiting API gateway built with NestJS and Redis. It sits in front of any backend service, enforces per-API-key request limits using two interchangeable algorithms (fixed window and token bucket), and proxies allowed requests through to the real backend — all backed by atomic, race-condition-free Redis operations.

**Live demo:** https://nestjs-ratelimiter-gateway-production.up.railway.app
**Repo:** https://github.com/MARCAAAAARRON/nestjs-ratelimiter-gateway

```bash
curl -H "x-api-key: demo" https://nestjs-ratelimiter-gateway-production.up.railway.app/gateway/ping
```

---

## The problem

Every API that's shared across multiple clients eventually needs to answer: *what happens when one client sends too many requests?* Without an answer, a single misbehaving client (or a genuine traffic spike) can degrade service for everyone else. A rate limiter solves this — but a *correct* one has to handle a handful of genuinely hard problems: what happens when your app runs as multiple instances behind a load balancer? What happens if two requests hit at the exact same microsecond? What do you actually tell the client when you reject them?

This project builds a rate limiter that answers all three, in front of a real (if minimal) reverse proxy — the same architecture pattern used by API gateways at companies with more than one backend service.

## Architecture

```
                           ┌────────────────────────────┐
Incoming Request ───────►  │   NestJS Gateway           │
(x-api-key header)         │                            │
                           │  1. RatelimiterGuard       │
                           │     - extract API key      │
                           │     - check Redis (atomic) │◄──► Redis
                           │     - allow or 429         │      (count:*, config:*,
                           │                            |       bucket:* keys)
                           │  2. If allowed, proxy      |
                           |     request                │
                           │     via HttpService        │
                           └──────────────┬─────────────┘
                                          │
                                          ▼
                                 Backend Service
                                 (any HTTP API)

Observability: /metrics (Prometheus) ──► Prometheus ──► Grafana dashboard
```

**Stack:** NestJS · Redis (ioredis) · Lua scripting · Prometheus · Grafana · Docker · Railway

**Core NestJS building blocks used:**
- **Module** — isolates rate-limiting logic from the rest of the app
- **Controller** — exposes `/gateway/ping`, `/gateway/admin/keys`, `/gateway/proxy/*`
- **Service** — implements both rate-limiting algorithms against Redis
- **Guard** — runs before every gated route, decides allow/reject
- **Pipe** — validates admin config input via `class-validator` DTOs

## The hardest decisions

### 1. Atomic Redis operations instead of GET-then-SET

The naive way to rate-limit with Redis is `INCR` then `EXPIRE` as two separate calls. That has a real race condition: if the process crashes between the two calls, a key can be left with a count but no expiry — meaning that API key would be rate-limited forever, with no way to reset. It's a small window, but it's exactly the kind of bug that only shows up under real production load.

The fix is a Lua script (`incr-and-expire.lua`) that does both operations atomically on Redis's side — Redis guarantees no other command can interleave with a running script. This also became the same technique used to implement the token bucket algorithm's more complex refill math (`token-bucket.lua`), since that needs to read, calculate, and write in one atomic step.

### 2. 429 + Retry-After, not 403

Early on this project returned `403 Forbidden` for rate-limited requests — which is semantically wrong. `403` means "you don't have permission, period." `429 Too Many Requests` means "you're allowed, just slow down," and it comes with a `Retry-After` header telling the client exactly how many seconds to wait. Real HTTP clients look for this specifically to decide whether to back off and retry automatically. Getting this right required a custom exception class and a dedicated exception filter, since Nest's default exception handling doesn't attach custom headers out of the box.

### 3. Fixed window vs. token bucket

Fixed window (hard reset every N seconds) is simple but has a boundary problem: a client can send a full burst right at the edge of two windows and get nearly double the intended rate. Token bucket avoids this by refilling gradually and continuously instead of resetting all at once — at the cost of needing more complex state (token count *and* last-refill time) and a heavier Lua script to compute the refill atomically. Both are implemented here and selectable per-request via an `x-algorithm` header, so the trade-off is something you can actually observe rather than just read about.

### 4. A production bug: silent `NaN` from a stray environment variable character

During deployment, `RATE_LIMIT_MAX_REQUESTS` was accidentally set to `"5/"` instead of `"5"` in Railway's environment variables. Since env vars are always strings, and `count <= max` was comparing a real number against `Number("5/")` — which is `NaN` — every single comparison silently evaluated to `false`, rejecting *every* request regardless of count. Nothing crashed; it just silently broke. This is now on the "what I'd improve" list below — the fix in the moment was correcting the variable, but the more robust fix is explicit `parseInt()`/validation on any numeric config value rather than trusting `ConfigService.get<number>()`'s generic to actually enforce a real number type.

## What I'd change at 10x scale

- **Explicit numeric config validation** at startup (fail fast on bad config, rather than silently degrading — directly motivated by the bug above)
- **Redis Cluster** instead of a single instance, since a single Redis node becomes both a bottleneck and a single point of failure once request volume grows
- **A real health check** on the `depends_on` relationship in Docker Compose — currently it only waits for the container to start, not for Redis to actually be ready to accept connections
- **Sliding window log** as a third algorithm, to compare against both fixed window and token bucket with real precision/recall-style data on burst handling
- **Structured JSON logs** shipped to a real log aggregator (see the log-aggregation-pipeline pattern), instead of console-based Nest logs, for real production searchability

## Running it locally

```bash
git clone https://github.com/MARCAAAAARRON/nestjs-ratelimiter-gateway.git
cd nestjs-ratelimiter-gateway
docker-compose up --build
```

This starts the gateway, Redis, and a mock backend together. Then:

```bash
curl -H "x-api-key: test" http://localhost:3000/gateway/ping
curl -H "x-api-key: test" http://localhost:3000/gateway/proxy/hello
```

## Running the tests

```bash
npm test
```

Unit tests cover the core rate-limiting logic (fixed window allow/reject, per-key config overrides, retry-after TTL conversion) with a mocked Redis client, so they run without any external dependencies.

## Observability

The gateway exposes Prometheus-format metrics at `/metrics`, including custom counters (`rate_limit_allowed_total`, `rate_limit_rejected_total`) labeled by API key and algorithm. A Grafana dashboard built on top of these shows allowed/rejected request counts and rejection rate over time.

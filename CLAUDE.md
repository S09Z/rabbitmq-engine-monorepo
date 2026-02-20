# CLAUDE.md

> This document defines mandatory architectural, runtime, and security rules for this repository.  
> All generated code MUST comply with this contract.

---

## 1. SYSTEM CONTRACT (MANDATORY)

This file is a binding system contract.

- All generated code MUST comply with this document.
- If a user request conflicts with this contract, the contract takes precedence.
- No exceptions unless explicitly approved in this file.
- Violations are not allowed.

Claude MUST read this file before:
- Generating code
- Refactoring
- Adding dependencies
- Modifying architecture
- Introducing new infrastructure

---

## 2. SECURITY CONTRACT (STRICT)

Claude is NOT allowed to:

- Access `.env` files
- Access `.env.*`
- Access secret keys
- Access certificates
- Access local database dumps
- Access `node_modules`
- Access compiled artifacts (`dist/`, `build/`)
- Inspect lockfiles for secrets
- Infer secrets from environment variables

If such files appear in context, they MUST be ignored.

These files are outside the reasoning boundary.

---

## 3. CONTEXT RULES

Claude MUST ignore:

- `node_modules/`
- `dist/`
- `build/`
- `coverage/`
- `.env`
- `.env.*`
- `*.pem`
- `*.key`
- `*.crt`
- `*.log`
- generated files
- database dumps
- Docker volumes

Only source code and relevant configuration should be analyzed.

---

## 4. PROJECT OVERVIEW

This repository implements a high-performance, production-ready job processing system using:

- Bun runtime (NOT Node.js)
- TypeScript (strict mode)
- Elysia (HTTP API framework)
- RabbitMQ (message broker)
- Postgres or Redis (job status tracking)
- Docker & Docker Compose
- Clean Architecture (Domain-driven inspired)

System goals:

- Horizontally scalable
- Reliable
- Observable
- Cleanly structured
- Production-ready

---

## 5. RUNTIME & TOOLING RULES (STRICT)

This project uses **Bun exclusively**.

### Always Use

- `bun`
- `bun run`
- `bun test`
- `bun install`
- `bun build`
- `Bun.sql`
- `Bun.redis`
- `Bun.serve`
- Native WebSocket

### Never Use

- `node`
- `express`
- `dotenv`
- `pg`
- `ioredis`
- `ws`
- `better-sqlite3`
- Node.js-specific APIs

Do NOT introduce Node.js runtime dependencies.

------------------------------------------------------------------------

## 6. ARCHITECTURE PRINCIPLES

This system follows Clean Architecture with strict layer separation.

### Layer Structure
apps/ api/ → HTTP Producer (Elysia) worker/ → Consumer service

packages/ domain/ → Entities, business rules application/→ Use cases
infra/ → RabbitMQ, DB, external adapters shared/ → Logger, config,
shared types

------------------------------------------------------------------------

### 6.1 Domain Layer

Rules:

- No framework imports
- No RabbitMQ imports
- No database imports
- No Bun-specific APIs

Contains:

- Entities
- Value Objects
- Domain Services
- Business Rules

Must remain pure and framework-independent.

------------------------------------------------------------------------

### 6.2 Application Layer

- Implements use cases
- Orchestrates domain via interfaces (ports)
- No transport logic
- No framework logic


------------------------------------------------------------------------

### 6.3 Infrastructure Layer

Implements:

- RabbitMQ client
- Database repositories
- Redis
- Logging
- Configuration

No business rules allowed here.

------------------------------------------------------------------------

### 6.4 Apps Layer

- HTTP API
- Worker bootstrap
- Dependency wiring

No domain logic allowed here.

------------------------------------------------------------------------

## 7. RABBITMQ DESIGN

### Exchange

`job.exchange` (topic)

### Queues

- `job.queue`
- `job.retry.queue`
- `job.dlq`

------------------------------------------------------------------------

## 8. DLQ + RETRY PATTERN (Kafka-style)

Message Flow:

1. API publishes to `job.exchange`
2. Worker consumes from `job.queue`
3. On failure:
   - Increment `x-retry-count`
   - Send to `job.retry.queue`
4. Retry queue uses TTL
5. After TTL → message returns to main queue
6. If retry limit exceeded → send to `job.dlq`

Headers used:

x-retry-count

Retry Strategy:

- Prefer exponential backoff
- Avoid infinite retry loops
- Cap retry attempts

------------------------------------------------------------------------

# 🧯 Graceful Shutdown (MANDATORY)

Worker must:

1.  Listen to `SIGINT` and `SIGTERM`
2.  Stop consuming new messages
3.  Wait for in-flight jobs to finish
4.  Close RabbitMQ channel
5.  Close DB connections
6.  Exit cleanly

Never hard-exit the process.

------------------------------------------------------------------------

## 9. IDEMPOTENCY REQUIREMENT (CRITICAL)

Workers MUST be idempotent.

RabbitMQ guarantees **at-least-once delivery**.

Therefore:

- A job may be delivered more than once.
- Processing must not create duplicate side effects.
- Use unique job IDs for safety.

------------------------------------------------------------------------

## 10. GRACEFUL SHUTDOWN (MANDATORY)

Worker must:

1. Listen to `SIGINT` and `SIGTERM`
2. Stop consuming new messages
3. Wait for in-flight jobs to finish
4. Close RabbitMQ channel
5. Close DB connections
6. Exit cleanly

Never force-exit the process.

------------------------------------------------------------------------

## 11. JOB STATUS TRACKING

Every job must have a status:

```ts
enum JobStatus {
  PENDING,
  PROCESSING,
  RETRYING,
  SUCCESS,
  FAILED,
  DEAD_LETTER
}

Status must be updated:

-   On publish
-   On processing start
-   On retry
-   On success
-   On DLQ

Storage options:

-   Postgres (preferred for durability)
-   Redis (acceptable for speed)

```

------------------------------------------------------------------------

## 12. HORIZONTAL SCALING STRATEGY

Workers are:

-   Stateless
-   Idempotent
-   Safe to scale

Scaling example:

docker compose up --scale worker=4

Requirements:

-   Use RabbitMQ competing consumer model
-   Configure prefetch properly
-   Ensure job idempotency
-   Never rely on in-memory state

------------------------------------------------------------------------

## 13. API LAYER RESPONSIBILITIES

API must:

-   Validate input
-   Create job record
-   Publish message
-   Return jobId

API must NOT:

-   Contain business logic
-   Contain RabbitMQ logic directly
-   Contain domain rules

------------------------------------------------------------------------

## 14. TESTING RULES

Use:

bun test

Test:

-   Domain logic
-   Use cases
-   Retry logic
-   Message handler logic (mocked infra)

Avoid integration-heavy tests unless necessary.

------------------------------------------------------------------------

## 15. DOCKER SERVICES

Services:

-   api
-   worker
-   rabbitmq
-   postgres (optional)
-   redis (optional)

RabbitMQ management UI:

http://localhost:15672

------------------------------------------------------------------------

## 16. PERFORMANCE PRINCIPLES

-   One RabbitMQ connection per service
-   Use channel prefetch tuning
-   Avoid large payloads
-   Prefer job ID references over heavy objects
-   Keep domain pure
-   Avoid blocking operations
-   Use structured JSON logging

------------------------------------------------------------------------

## 17. ANTI-PATTERNS (FORBIDDEN)

-   Mixing domain with infrastructure
-   Hardcoding configuration
-   Skipping graceful shutdown
-   Using Node.js APIs
-   Storing state in memory for workers
-   Infinite retry loops

------------------------------------------------------------------------

## 18. FINAL OBJECTIVE

Build a:

-   Clean
-   Observable
-   Horizontally scalable
-   High-performance
-   Reliable job processing system
-   Using Bun + TypeScript + RabbitMQ
-   Following Clean Architecture principles

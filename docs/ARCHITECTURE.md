# QueuePro — Architecture Overview

## System Overview

A government queue management system built on Node.js / Express / MongoDB with real-time Socket.io support. Citizens take queue tokens online, officers serve them in order, and admins monitor everything via a live dashboard.

---

## Folder Structure

```
queuepro-backend/
├── config/           ← Central config (DB, auth, cache, queue limits)
├── controllers/      ← HTTP handlers (req/res only, no business logic)
├── services/         ← Business logic (queueService, adminService, authService)
├── models/           ← Mongoose schemas (Token, User, ActivityLog, Settings)
├── routes/           ← Express routes (auth, admin, queue, pages)
├── middleware/       ← auth, rbac, logger, errorHandler, requestId
├── utils/            ← Reusable helpers (cache, serviceConfig, validation, response)
├── views/            ← EJS templates (dashboard, profile, pages)
├── jobs/             ← Scheduled tasks (tokenCleanup)
├── public/           ← Static assets (CSS, JS, images)
└── docs/             ← This file
```

---

## Token Lifecycle

```
citizen creates token
       │
       ▼
   [pending]  ──► citizen cancels ──► [cancelled]
       │
       ▼ officer clicks "Serve Next"
   [serving]
       │
       ▼ officer clicks "Mark Complete"
   [completed]
```

- `position` is assigned at creation based on pending count.
- `estimatedWaitTime` is calculated via `serviceConfig.calculateEstimatedWaitTime`.
- `actualWaitTime` is set on completion (startedAt → completedAt delta).

---

## Admin Logic

- Hardcoded admin: `admin_001` / `mahek` / `mahek2013`.
- All DB user queries use `mongoose.Types.ObjectId.isValid()` check before filtering.
- `adminService.getUsers('admin_001')` → uses `User.find({})` (no `findById` crash).
- Analytics are cached for 30 seconds to reduce DB load during polling.

---

## Real-Time Events (Socket.io)

| Event            | Emitted When             | Listener Room          |
|------------------|--------------------------|------------------------|
| `queue_update`   | After any queue change   | `queue_broadcast`      |
| `token_created`  | After new token saved    | `queue_broadcast`      |
| `token_completed`| After token completed    | `queue_broadcast`      |
| `turn_notification` | Position 1 or ≤ 3   | `token_{id}` room      |

Frontend joins `queue_broadcast` on load. Individual citizens join `token_{tokenId}` for personal notifications.

---

## Smart Queue Intelligence (New)

`services/queueIntelligenceService.js` provides:
- `getTokenPosition(tokenId, userId)` — live position + ETA for a citizen.
- `getQueueSnapshot()` — crowd level, throughput, and wait estimate for public display.

Results are cached for 10 seconds (in-process TTL, no Redis required).

**New API endpoints:**
- `GET /api/queue/my-position` — citizen's live position (authenticated)
- `GET /api/queue/stats` — public queue snapshot (no auth required)

---

## Caching Strategy

All caching uses `utils/cache.js` — a lightweight in-process TTL store.

| Cache Key             | TTL   | Used By                        |
|-----------------------|-------|--------------------------------|
| `admin_analytics`     | 30s   | `adminService.getAnalytics()`  |
| `queue_snapshot`      | 10s   | `queueIntelligenceService`     |
| `queue_public_snapshot` | 10s | `queueIntelligenceService`   |

Cache is automatically swept every 60 seconds. On server restart, cache resets (acceptable for short TTLs).

---

## Security

- JWT-based API auth (`verifyToken`) + session-based page auth (`ensureAuthenticated`).
- RBAC via `checkRole` and `ensureRole` middleware.
- Rate limiting: 100 req/15min on `/api/*` (skipped in development).
- Helmet enabled (CSP disabled for EJS compatibility).
- `admin_001` BSON guard: avoids `findById` with non-ObjectId string.

---

## Environment Variables

| Variable       | Purpose                         | Default                        |
|----------------|---------------------------------|--------------------------------|
| `PORT`         | Server port                     | 5000                           |
| `MONGODB_URI`  | MongoDB connection string        | `mongodb://127.0.0.1:27017/queuepro` |
| `JWT_SECRET`   | JWT signing key                 | `queuepro_secret_2024`         |
| `SESSION_SECRET` | Session key                  | `queuepro_session_secret_2024` |
| `NODE_ENV`     | `development` or `production`   | `development`                  |

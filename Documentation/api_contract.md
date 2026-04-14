# API contract

## Conventions

Base path:

```http
/api/v1
```

Deployment shape:

- The web app and API surface are intended to be deployed on Vercel
- Android and web clients both call the same hosted API base URL

Auth:

```http
Authorization: Bearer <supabase_access_token>
```

All endpoints except health require a valid Supabase JWT. The backend verifies the JWT locally using Supabase JWKS.

Response envelope:

```json
{
  "data": {},
  "error": null
}
```

Error envelope:

```json
{
  "data": null,
  "error": {
    "code": "string_code",
    "message": "Human-readable message",
    "details": {}
  }
}
```

Date format:
- API request/response dates are ISO `YYYY-MM-DD`
- timestamps are ISO 8601 UTC

Enums:
- `category`: `buy | do | remember | blocker`
- `assignee`: `Zac | Lauryl | Someone`
- `status`: `active | completed | deleted`
- `captureSource`: `android_widget_text | android_widget_voice | android_app_manual | web_manual`

Task object:

```json
{
  "id": "ef8b69f8-c14d-4a90-bc83-cdb83edebd08",
  "familyId": "8f7c91f2-6e6c-4e63-81ef-0f5810a03e1e",
  "details": "Renew tabs",
  "category": "do",
  "assignee": "Zac",
  "status": "active",
  "deadlineDate": "2026-04-20",
  "scheduledDate": null,
  "urls": [],
  "createdAt": "2026-04-03T10:15:22.123Z",
  "createdByUserId": "4f8c55d4-6f4c-4db3-a0a7-4f0e8b86c1c4",
  "updatedAt": "2026-04-03T10:15:22.123Z",
  "completedAt": null,
  "deletedAt": null
}
```

Notes:
- `source` values provided during capture or manual creation are request metadata and do not need to be returned on every task response
- status transitions must keep `completedAt` and `deletedAt` consistent with the persisted task state

---

## 1. Health

### GET `/health`

Used for uptime checks.

Response:

```json
{
  "data": {
    "status": "ok"
  },
  "error": null
}
```

---

## 2. Current user bootstrap

### GET `/me`

Returns the authenticated user, their family, and app-specific profile data needed by clients.

Response:

```json
{
  "data": {
    "user": {
      "id": "4f8c55d4-6f4c-4db3-a0a7-4f0e8b86c1c4",
      "email": "zaccohn@gmail.com",
      "displayName": "Zac",
      "assigneeKey": "Zac",
      "familyId": "8f7c91f2-6e6c-4e63-81ef-0f5810a03e1e",
      "familyName": "Cohnobi"
    }
  },
  "error": null
}
```

Possible errors:
- `unauthorized`
- `profile_not_found`

---

## 3. Text capture

### POST `/captures/text`

Creates exactly one task from one text input.

Request:

```json
{
  "input": "renew tabs by April 20",
  "source": "android_widget_text"
}
```

Server behavior:
1. authenticate user
2. send text to OpenAI
3. expect exactly one structured task object
4. validate
5. insert task
6. return created task
7. return created task

Success response:

```json
{
  "data": {
    "task": {
      "id": "ef8b69f8-c14d-4a90-bc83-cdb83edebd08",
      "familyId": "8f7c91f2-6e6c-4e63-81ef-0f5810a03e1e",
      "details": "Renew tabs",
      "category": "do",
      "assignee": "Zac",
      "status": "active",
      "deadlineDate": "2026-04-20",
      "scheduledDate": null,
      "urls": [],
      "createdAt": "2026-04-03T10:15:22.123Z",
      "createdByUserId": "4f8c55d4-6f4c-4db3-a0a7-4f0e8b86c1c4",
      "updatedAt": "2026-04-03T10:15:22.123Z",
      "completedAt": null,
      "deletedAt": null
    }
  },
  "error": null
}
```

Failure response:

```json
{
  "data": null,
  "error": {
    "code": "task_creation_failed",
    "message": "Failed to create task",
    "details": {
      "reason": "invalid_openai_payload"
    }
  }
}
```

Notes:
- on failure, no task is created
- backend should return a structured failure that clients can surface directly

---

## 4. Voice capture

### POST `/captures/voice`

Multipart upload. Creates exactly one task from one audio recording.

Request:
- `Content-Type: multipart/form-data`

Fields:
- `audio`: binary file
- `source`: `android_widget_voice`
- `mimeType`: optional, e.g. `audio/m4a`

Example semantic payload:

```text
audio=<file>
source=android_widget_voice
mimeType=audio/m4a
```

Server behavior:
1. authenticate user
2. stream/upload audio to OpenAI
3. receive structured JSON
4. validate
5. insert task
6. delete/discard audio after processing
7. return created task
8. return created task

Success response is identical to text capture.

Failure response is identical to text capture.

---

## 5. List tasks

### GET `/tasks`

Primary listing endpoint. Clients use query params rather than separate endpoints for each view.

Query params:
- `view`: `backlog | archived`
- `includePartner`: `true | false` default `false`
- `archivedType`: `completed | deleted | all` only relevant for `view=archived`
- `category`: optional enum
- `assignee`: optional enum or comma-separated values
- `hasDeadline`: optional `true | false`
- `hasScheduledDate`: optional `true | false`
- `status`: optional, generally not needed unless admin/debug
- `sort`: optional override
- `order`: `asc | desc`
- `limit`: integer
- `cursor`: opaque pagination cursor, optional
- `search`: optional free text search over task details

View semantics:
- `backlog` returns active tasks
- `archived` returns completed and deleted tasks, optionally narrowed by `archivedType`
- “today”, “upcoming”, and “late” are frontend-derived slices based on each active task’s `scheduledDate` and `deadlineDate`

Examples:

```http
GET /api/v1/tasks?view=today
GET /api/v1/tasks?view=backlog&includePartner=true
GET /api/v1/tasks?view=archived&archivedType=completed
GET /api/v1/tasks?view=upcoming&category=buy
GET /api/v1/tasks?view=backlog&search=summer%20camp
```

Response:

```json
{
  "data": {
    "items": [
      {
        "id": "ef8b69f8-c14d-4a90-bc83-cdb83edebd08",
        "familyId": "8f7c91f2-6e6c-4e63-81ef-0f5810a03e1e",
        "details": "Renew tabs",
        "category": "do",
        "assignee": "Zac",
        "status": "active",
        "deadlineDate": "2026-04-20",
        "scheduledDate": null,
        "urls": [],
        "createdAt": "2026-04-03T10:15:22.123Z",
        "createdByUserId": "4f8c55d4-6f4c-4db3-a0a7-4f0e8b86c1c4",
        "updatedAt": "2026-04-03T10:15:22.123Z",
        "completedAt": null,
        "deletedAt": null
      }
    ],
    "nextCursor": null
  },
  "error": null
}
```

---

## 7. Create task manually

### POST `/tasks`

Creates a task without going through AI capture. This is required for normal web task management and Android manual entry flows.

Request:

```json
{
  "details": "Book summer camp",
  "category": "do",
  "assignee": "Someone",
  "deadlineDate": "2026-05-01",
  "scheduledDate": null,
  "urls": [
    "https://camp.example.com"
  ],
  "source": "web_manual"
}
```

Response:

```json
{
  "data": {
    "task": {
      "id": "ef8b69f8-c14d-4a90-bc83-cdb83edebd08",
      "familyId": "8f7c91f2-6e6c-4e63-81ef-0f5810a03e1e",
      "details": "Book summer camp",
      "category": "do",
      "assignee": "Someone",
      "status": "active",
      "deadlineDate": "2026-05-01",
      "scheduledDate": null,
      "urls": [
        "https://camp.example.com"
      ],
      "createdAt": "2026-04-03T10:15:22.123Z",
      "createdByUserId": "4f8c55d4-6f4c-4db3-a0a7-4f0e8b86c1c4",
      "updatedAt": "2026-04-03T10:15:22.123Z",
      "completedAt": null,
      "deletedAt": null
    }
  },
  "error": null
}
```

Possible errors:
- `validation_failed`

---

## 8. Update task

### PATCH `/tasks/:taskId`

Updates mutable task fields while the task remains within the authenticated family scope.

Request:

```json
{
  "details": "Book summer camp before prices go up",
  "assignee": "Lauryl",
  "deadlineDate": "2026-05-03",
  "scheduledDate": "2026-04-25",
  "urls": [
    "https://camp.example.com"
  ]
}
```

Response:

```json
{
  "data": {
    "task": {
      "id": "ef8b69f8-c14d-4a90-bc83-cdb83edebd08",
      "familyId": "8f7c91f2-6e6c-4e63-81ef-0f5810a03e1e",
      "details": "Book summer camp before prices go up",
      "category": "do",
      "assignee": "Lauryl",
      "status": "active",
      "deadlineDate": "2026-05-03",
      "scheduledDate": "2026-04-25",
      "urls": [
        "https://camp.example.com"
      ],
      "createdAt": "2026-04-03T10:15:22.123Z",
      "createdByUserId": "4f8c55d4-6f4c-4db3-a0a7-4f0e8b86c1c4",
      "updatedAt": "2026-04-04T08:00:00.000Z",
      "completedAt": null,
      "deletedAt": null
    }
  },
  "error": null
}
```

Possible errors:
- `task_not_found`
- `validation_failed`

---

## 9. Complete task

### POST `/tasks/:taskId/complete`

Marks a task as completed.

Response:

```json
{
  "data": {
    "task": {
      "id": "ef8b69f8-c14d-4a90-bc83-cdb83edebd08",
      "status": "completed",
      "completedAt": "2026-04-04T08:00:00.000Z",
      "deletedAt": null
    }
  },
  "error": null
}
```

---

## 10. Reopen task

### POST `/tasks/:taskId/reopen`

Moves a completed or deleted task back to active state.

Response:

```json
{
  "data": {
    "task": {
      "id": "ef8b69f8-c14d-4a90-bc83-cdb83edebd08",
      "status": "active",
      "completedAt": null,
      "deletedAt": null
    }
  },
  "error": null
}
```

---

## 11. Delete task

### POST `/tasks/:taskId/delete`

Soft-deletes a task so it appears in archived views.

Response:

```json
{
  "data": {
    "task": {
      "id": "ef8b69f8-c14d-4a90-bc83-cdb83edebd08",
      "status": "deleted",
      "completedAt": null,
      "deletedAt": "2026-04-04T08:00:00.000Z"
    }
  },
  "error": null
}
```

---

## 12. Restore deleted task

### POST `/tasks/:taskId/restore`

Restores a deleted task to active state.

Response:

```json
{
  "data": {
    "task": {
      "id": "ef8b69f8-c14d-4a90-bc83-cdb83edebd08",
      "status": "active",
      "completedAt": null,
      "deletedAt": null
    }
  },
  "error": null
}
```

---

## 13. Integration notes

- The web app needs manual create and update endpoints; otherwise "task management" cannot be implemented cleanly
- The schema must persist devices for push token registration and notification targeting
- Active, completed, and deleted views must stay aligned with the task status fields and timestamp rules

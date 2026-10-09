# API Specification

## Base URL
```
http://localhost:5000/api
```

---

## Authentication Endpoints

### POST /auth/register

**Purpose**: Create a new user account and issue JWT token.

| Aspect | Value |
|--------|-------|
| **Method** | POST |
| **Path** | `/api/auth/register` |
| **Auth** | None (public) |
| **Middleware** | registerValidation |

**Request Body**:
```json
{
  "name": "string (required, non-empty)",
  "email": "string (required, valid email format)",
  "password": "string (required, min 6 characters)"
}
```

**Success Response (201 Created)**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "60d5ec49c1234567890abcd1",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

**Error Responses**:
- **400 Bad Request** (validation error):
  ```json
  {
    "success": false,
    "message": "Validation error",
    "errors": [
      { "msg": "Invalid email", "param": "email" },
      { "msg": "Password must be at least 6 characters", "param": "password" }
    ]
  }
  ```
- **400 Bad Request** (email already exists):
  ```json
  {
    "success": false,
    "message": "User already exists"
  }
  ```
- **500 Server Error**:
  ```json
  {
    "success": false,
    "message": "Server Error"
  }
  ```

**Notes**:
- Role is always hardcoded to 'user' on registration; cannot be set by client.
- Password is hashed via bcrypt in the User model pre-save hook.
- Token expires after 30 days (configurable in .env via JWT_EXPIRE).
- Email is stored in lowercase.

---

### POST /auth/login

**Purpose**: Authenticate user with email and password; return JWT token.

| Aspect | Value |
|--------|-------|
| **Method** | POST |
| **Path** | `/api/auth/login` |
| **Auth** | None (public) |
| **Middleware** | loginValidation |

**Request Body**:
```json
{
  "email": "string (required, valid email format)",
  "password": "string (required, non-empty)"
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "60d5ec49c1234567890abcd1",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

**Error Responses**:
- **400 Bad Request** (validation error):
  ```json
  {
    "success": false,
    "message": "Validation error",
    "errors": [
      { "msg": "Invalid email", "param": "email" }
    ]
  }
  ```
- **401 Unauthorized** (invalid credentials):
  ```json
  {
    "success": false,
    "message": "Invalid credentials"
  }
  ```
- **500 Server Error**:
  ```json
  {
    "success": false,
    "message": "Server Error"
  }
  ```

**Notes**:
- Email and password are checked case-insensitively for email (lowercase before query).
- If email not found or password does not match, returns the same 401 message (no email enumeration).
- Token is valid for 30 days from issue.

---

### GET /auth/me

**Purpose**: Retrieve authenticated user's profile (requires valid JWT token).

| Aspect | Value |
|--------|-------|
| **Method** | GET |
| **Path** | `/api/auth/me` |
| **Auth** | Required (Bearer token in Authorization header) |
| **Middleware** | auth |

**Request Headers**:
```
Authorization: Bearer <token>
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "user": {
    "id": "60d5ec49c1234567890abcd1",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

**Error Responses**:
- **401 Unauthorized** (missing or invalid token):
  ```json
  {
    "success": false,
    "message": "Not authorized to access this route"
  }
  ```
- **500 Server Error**:
  ```json
  {
    "success": false,
    "message": "Server Error"
  }
  ```

**Notes**:
- Token is extracted from `Authorization: Bearer <token>` header.
- If token is expired or malformed, returns 401.
- Password is never included in response (excluded by schema).

---

## Posts Endpoints

### GET /posts

**Purpose**: List all posts with filtering, sorting, pagination; compute hasVoted for authenticated users.

| Aspect | Value |
|--------|-------|
| **Method** | GET |
| **Path** | `/api/posts` |
| **Auth** | Optional (Bearer token for hasVoted) |
| **Middleware** | authOptional |

**Query Parameters**:
- `sort` (string, optional): 'top' (by votes, desc) or 'newest' (by date, desc); default 'newest'
- `category` (string, optional): 'feature', 'bug', or 'improvement'; if set, filters to that category
- `status` (string, optional): 'open', 'planned', 'in-progress', or 'shipped'; if set, filters to that status
- `search` (string, optional): search term; matches against title and description (case-insensitive regex)
- `page` (number, optional): page number; default 1
- `limit` (number, optional): posts per page; default 6, max 50

**Success Response (200 OK)**:
```json
{
  "success": true,
  "posts": [
    {
      "_id": "60d5ec49c1234567890abcd1",
      "title": "Add dark mode",
      "description": "Users should be able to toggle dark mode in settings.",
      "category": "feature",
      "status": "open",
      "author": {
        "_id": "60d5ec49c1234567890abc00",
        "name": "Jane Smith"
      },
      "voteCount": 42,
      "hasVoted": true,
      "createdAt": "2024-06-15T10:30:00.000Z",
      "updatedAt": "2024-06-15T10:30:00.000Z"
    }
  ],
  "page": 1,
  "pages": 5,
  "total": 28
}
```

**Error Responses**:
- **400 Bad Request** (invalid sort/category/status):
  ```json
  {
    "success": false,
    "message": "Invalid sort value. Must be \"top\" or \"newest\"."
  }
  ```
- **500 Server Error**:
  ```json
  {
    "success": false,
    "message": "Server Error"
  }
  ```

**Notes**:
- `hasVoted` is `false` for unauthenticated requests.
- Author object includes only `_id` and `name`; email is never populated.
- Posts are populated with author info; unauthenticated users do not receive author email.
- If `search` is provided along with `category` and `status`, all filters are ANDed together.
- Maximum limit is capped at 50 for performance; if client requests limit > 50, it is set to 50.

---

### GET /posts/:id

**Purpose**: Retrieve a single post by ID; compute hasVoted for authenticated users.

| Aspect | Value |
|--------|-------|
| **Method** | GET |
| **Path** | `/api/posts/:id` |
| **Auth** | Optional (Bearer token for hasVoted) |
| **Middleware** | authOptional |

**Path Parameters**:
- `id` (ObjectId): Post ID

**Success Response (200 OK)**:
```json
{
  "success": true,
  "post": {
    "_id": "60d5ec49c1234567890abcd1",
    "title": "Add dark mode",
    "description": "Users should be able to toggle dark mode in settings.",
    "category": "feature",
    "status": "open",
    "author": {
      "_id": "60d5ec49c1234567890abc00",
      "name": "Jane Smith"
    },
    "voteCount": 42,
    "hasVoted": false,
    "adminReply": null,
    "createdAt": "2024-06-15T10:30:00.000Z",
    "updatedAt": "2024-06-15T10:30:00.000Z"
  }
}
```

**Error Responses**:
- **404 Not Found** (post does not exist):
  ```json
  {
    "success": false,
    "message": "Post not found"
  }
  ```
- **500 Server Error**:
  ```json
  {
    "success": false,
    "message": "Server Error"
  }
  ```

**Notes**:
- `hasVoted` is `false` for unauthenticated requests.
- `adminReply` is `null` if not set by admin.
- Author includes only `_id` and `name`.

---

### POST /posts

**Purpose**: Create a new post (authenticated users only).

| Aspect | Value |
|--------|-------|
| **Method** | POST |
| **Path** | `/api/posts` |
| **Auth** | Required (Bearer token) |
| **Middleware** | auth, postValidation |

**Request Body**:
```json
{
  "title": "string (required, 3-100 characters)",
  "description": "string (required, 10-1000 characters)",
  "category": "string (required, enum: feature|bug|improvement)"
}
```

**Success Response (201 Created)**:
```json
{
  "success": true,
  "post": {
    "_id": "60d5ec49c1234567890abcd2",
    "title": "Add dark mode",
    "description": "Users should be able to toggle dark mode in settings.",
    "category": "feature",
    "status": "open",
    "author": {
      "_id": "60d5ec49c1234567890abc00",
      "name": "Jane Smith"
    },
    "voteCount": 0,
    "adminReply": null,
    "createdAt": "2024-06-15T10:30:00.000Z",
    "updatedAt": "2024-06-15T10:30:00.000Z"
  }
}
```

**Error Responses**:
- **400 Bad Request** (validation error):
  ```json
  {
    "success": false,
    "message": "Validation error",
    "errors": [
      { "msg": "Title must be between 3 and 100 characters", "param": "title" },
      { "msg": "Invalid category", "param": "category" }
    ]
  }
  ```
- **401 Unauthorized** (not logged in):
  ```json
  {
    "success": false,
    "message": "Not authorized to access this route"
  }
  ```
- **500 Server Error**:
  ```json
  {
    "success": false,
    "message": "Server Error"
  }
  ```

**Notes**:
- Status is always set to 'open' on creation; not provided by client.
- Author is set to the authenticated user's ID.
- VoteCount is initialized to 0.
- AdminReply is null initially.

---

### PUT /posts/:id

**Purpose**: Update a post (author only).

| Aspect | Value |
|--------|-------|
| **Method** | PUT |
| **Path** | `/api/posts/:id` |
| **Auth** | Required (Bearer token) |
| **Middleware** | auth, postValidation |

**Path Parameters**:
- `id` (ObjectId): Post ID

**Request Body**:
```json
{
  "title": "string (required, 3-100 characters)",
  "description": "string (required, 10-1000 characters)",
  "category": "string (required, enum: feature|bug|improvement)"
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "post": {
    "_id": "60d5ec49c1234567890abcd1",
    "title": "Add dark mode and light mode",
    "description": "Users should be able to toggle between dark and light mode in settings.",
    "category": "feature",
    "status": "open",
    "author": {
      "_id": "60d5ec49c1234567890abc00",
      "name": "Jane Smith"
    },
    "voteCount": 42,
    "adminReply": null,
    "createdAt": "2024-06-15T10:30:00.000Z",
    "updatedAt": "2024-06-15T11:45:00.000Z"
  }
}
```

**Error Responses**:
- **400 Bad Request** (validation error):
  ```json
  {
    "success": false,
    "message": "Validation error",
    "errors": [{ "msg": "Title must be between 3 and 100 characters", "param": "title" }]
  }
  ```
- **401 Unauthorized** (not logged in):
  ```json
  {
    "success": false,
    "message": "Not authorized to access this route"
  }
  ```
- **403 Forbidden** (not the author):
  ```json
  {
    "success": false,
    "message": "Not authorized to update this post"
  }
  ```
- **404 Not Found** (post does not exist):
  ```json
  {
    "success": false,
    "message": "Post not found"
  }
  ```
- **500 Server Error**:
  ```json
  {
    "success": false,
    "message": "Server Error"
  }
  ```

**Notes**:
- Only the author of the post can update it.
- Only title, description, and category can be updated; status, voteCount, and adminReply are immutable via this endpoint.
- VoteCount and adminReply are not affected by this endpoint.
- updatedAt is automatically updated by MongoDB.

---

### DELETE /posts/:id

**Purpose**: Delete a post (author or admin only); also deletes all associated votes.

| Aspect | Value |
|--------|-------|
| **Method** | DELETE |
| **Path** | `/api/posts/:id` |
| **Auth** | Required (Bearer token) |
| **Middleware** | auth |

**Path Parameters**:
- `id` (ObjectId): Post ID

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Post deleted"
}
```

**Error Responses**:
- **401 Unauthorized** (not logged in):
  ```json
  {
    "success": false,
    "message": "Not authorized to access this route"
  }
  ```
- **403 Forbidden** (not author or admin):
  ```json
  {
    "success": false,
    "message": "Not authorized to delete this post"
  }
  ```
- **404 Not Found** (post does not exist):
  ```json
  {
    "success": false,
    "message": "Post not found"
  }
  ```
- **500 Server Error**:
  ```json
  {
    "success": false,
    "message": "Server Error"
  }
  ```

**Notes**:
- Author or admin can delete a post.
- Deleting a post also deletes all Vote documents associated with it (via `Vote.deleteMany({ post: postId })`).
- No response body content is returned beyond the success message.

---

### PATCH /posts/:id/status

**Purpose**: Update post status and admin reply (admin only).

| Aspect | Value |
|--------|-------|
| **Method** | PATCH |
| **Path** | `/api/posts/:id/status` |
| **Auth** | Required (Bearer token) |
| **Middleware** | auth, adminOnly, statusValidation |

**Path Parameters**:
- `id` (ObjectId): Post ID

**Request Body**:
```json
{
  "status": "string (required, enum: open|planned|in-progress|shipped)",
  "adminReply": "string (optional, max 500 characters)"
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "post": {
    "_id": "60d5ec49c1234567890abcd1",
    "title": "Add dark mode",
    "description": "Users should be able to toggle dark mode in settings.",
    "category": "feature",
    "status": "planned",
    "author": {
      "_id": "60d5ec49c1234567890abc00",
      "name": "Jane Smith"
    },
    "voteCount": 42,
    "adminReply": "Great idea! We're planning to implement this in Q3.",
    "createdAt": "2024-06-15T10:30:00.000Z",
    "updatedAt": "2024-06-15T12:00:00.000Z"
  }
}
```

**Error Responses**:
- **400 Bad Request** (validation error):
  ```json
  {
    "success": false,
    "message": "Validation error",
    "errors": [
      { "msg": "Invalid status", "param": "status" },
      { "msg": "AdminReply must not exceed 500 characters", "param": "adminReply" }
    ]
  }
  ```
- **401 Unauthorized** (not logged in):
  ```json
  {
    "success": false,
    "message": "Not authorized to access this route"
  }
  ```
- **403 Forbidden** (not admin):
  ```json
  {
    "success": false,
    "message": "Admin access required"
  }
  ```
- **404 Not Found** (post does not exist):
  ```json
  {
    "success": false,
    "message": "Post not found"
  }
  ```
- **500 Server Error**:
  ```json
  {
    "success": false,
    "message": "Server Error"
  }
  ```

**Notes**:
- Only admins can update status and adminReply.
- Both `status` and `adminReply` are optional in the request, but at least one should be provided.
- Status values: 'open', 'planned', 'in-progress', 'shipped'.
- AdminReply can be set to an empty string to clear it; if not provided, it is not modified.
- updatedAt is automatically updated by MongoDB.

---

## Voting Endpoints

### POST /posts/:id/vote

**Purpose**: Toggle vote on a post (add if not voted, remove if voted).

| Aspect | Value |
|--------|-------|
| **Method** | POST |
| **Path** | `/api/posts/:id/vote` |
| **Auth** | Required (Bearer token) |
| **Middleware** | auth |

**Path Parameters**:
- `id` (ObjectId): Post ID

**Request Body**: None (empty body)

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Vote added",
  "voted": true,
  "voteCount": 43
}
```

Or (if removing vote):
```json
{
  "success": true,
  "message": "Vote removed",
  "voted": false,
  "voteCount": 41
}
```

**Error Responses**:
- **401 Unauthorized** (not logged in):
  ```json
  {
    "success": false,
    "message": "Not authorized to access this route"
  }
  ```
- **404 Not Found** (post does not exist):
  ```json
  {
    "success": false,
    "message": "Post not found"
  }
  ```
- **500 Server Error**:
  ```json
  {
    "success": false,
    "message": "Server Error"
  }
  ```

**Notes**:
- This is an idempotent toggle: calling it twice returns to the initial state.
- First call adds a vote, increments voteCount, returns `voted: true`.
- Second call removes the vote, decrements voteCount, returns `voted: false`.
- If a race condition causes a duplicate key error (11000), the endpoint returns the current post state without changing voteCount (graceful degradation).
- The response includes the updated voteCount after the operation.
- Client can use optimistic updates: immediately toggle UI state, then sync with server response.

---

## Roadmap Endpoints

### GET /roadmap

**Purpose**: Retrieve posts grouped by status (Planned, In Progress, Shipped); used to display the product roadmap.

| Aspect | Value |
|--------|-------|
| **Method** | GET |
| **Path** | `/api/roadmap` |
| **Auth** | None (public) |
| **Middleware** | None |

**Success Response (200 OK)**:
```json
{
  "success": true,
  "roadmap": {
    "planned": [
      {
        "_id": "60d5ec49c1234567890abcd1",
        "title": "Add dark mode",
        "description": "Users should be able to toggle dark mode in settings.",
        "category": "feature",
        "status": "planned",
        "author": {
          "_id": "60d5ec49c1234567890abc00",
          "name": "Jane Smith"
        },
        "voteCount": 42,
        "adminReply": "Great idea! We're planning to implement this in Q3.",
        "createdAt": "2024-06-15T10:30:00.000Z",
        "updatedAt": "2024-06-15T12:00:00.000Z"
      }
    ],
    "inProgress": [
      {
        "_id": "60d5ec49c1234567890abcd2",
        "title": "Improve search",
        "description": "Speed up the search feature.",
        "category": "improvement",
        "status": "in-progress",
        "author": {
          "_id": "60d5ec49c1234567890abc00",
          "name": "Jane Smith"
        },
        "voteCount": 18,
        "adminReply": null,
        "createdAt": "2024-06-10T09:00:00.000Z",
        "updatedAt": "2024-06-15T14:00:00.000Z"
      }
    ],
    "shipped": [
      {
        "_id": "60d5ec49c1234567890abcd3",
        "title": "Fix login bug",
        "description": "Users unable to login with special characters in password.",
        "category": "bug",
        "status": "shipped",
        "author": {
          "_id": "60d5ec49c1234567890abc00",
          "name": "Jane Smith"
        },
        "voteCount": 5,
        "adminReply": "Fixed in v2.1.0",
        "createdAt": "2024-06-01T08:00:00.000Z",
        "updatedAt": "2024-06-15T16:00:00.000Z"
      }
    ]
  }
}
```

**Error Responses**:
- **500 Server Error**:
  ```json
  {
    "success": false,
    "message": "Server Error"
  }
  ```

**Notes**:
- Posts with status 'open' are NOT included in the roadmap (only 'planned', 'in-progress', 'shipped').
- Posts within each status are sorted by createdAt in descending order (newest first).
- Author includes only `_id` and `name`; email is never populated.
- `hasVoted` is NOT computed for roadmap posts (not included in response) since roadmap is public and vote buttons are typically read-only.
- If a status category has no posts, the array is still present but empty.

---

## Error Handling Summary

| HTTP Status | Scenario | Typical Response |
|------------|----------|------------------|
| 200 OK | Successful request (GET, POST, PUT, PATCH, DELETE) | `{ success: true, ... }` |
| 201 Created | Resource created (POST) | `{ success: true, post: {...} }` |
| 400 Bad Request | Invalid input, validation failed | `{ success: false, message: "...", errors: [...] }` |
| 401 Unauthorized | Missing or invalid JWT token | `{ success: false, message: "Not authorized..." }` |
| 403 Forbidden | Authenticated but insufficient permissions (e.g., not author, not admin) | `{ success: false, message: "Not authorized to..." }` |
| 404 Not Found | Resource does not exist | `{ success: false, message: "... not found" }` |
| 500 Server Error | Unexpected server error | `{ success: false, message: "Server Error" }` |

All error responses include a `success: false` field and a descriptive `message`. Validation errors additionally include an `errors` array with per-field details.

---

## Authentication Header Format

For all protected endpoints, include:
```
Authorization: Bearer <jwt_token>
```

Example:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2MGQ1ZWM0OWMxMjM0NTY3ODkwYWJjZDEiLCJyb2xlIjoidXNlciIsImlhdCI6MTYyNTAxMjM0MCwiZXhwIjoxNjI3NjA0MzQwfQ.5mMyxKk8KI5KW4N_yZ5cQ7k8L9P0R2S3T4U5V6W7X8Y
```

---

## Pagination

Offset-based pagination is used for the `/posts` list endpoint.

**Parameters**:
- `page` (query): Page number; default 1
- `limit` (query): Posts per page; default 6, max 50

**Response**:
```json
{
  "success": true,
  "posts": [...],
  "page": 1,
  "pages": 5,
  "total": 28
}
```

**Calculation**:
- `skip = (page - 1) * limit`
- `pages = Math.ceil(total / limit)`

Example: Retrieve posts 11-20 on a page size of 10:
```
GET /api/posts?page=2&limit=10
```

---

## Validation Rules

All validation is performed server-side using express-validator.

| Field | Rules | Example Valid Input |
|-------|-------|-------------------|
| `name` | Required, non-empty | "John Doe" |
| `email` | Required, valid email format | "john@example.com" |
| `password` | Required, min 6 characters | "MyPassword123" |
| `title` | Required, 3-100 characters, trimmed | "Add dark mode" |
| `description` | Required, 10-1000 characters | "Users should be able to toggle dark mode in settings." |
| `category` | Required, enum: feature \| bug \| improvement | "feature" |
| `status` | Required, enum: open \| planned \| in-progress \| shipped | "planned" |
| `sort` | Optional, enum: top \| newest | "top" |
| `search` | Optional, string (special chars escaped) | "dark mode" |

---

## Rate Limiting (Future Consideration)

Currently, no rate limiting is implemented. For production, consider adding:
- 100 requests per minute per IP for public endpoints
- 50 requests per minute per user for authenticated endpoints
- 10 requests per minute for voting (to prevent vote spam)

Implementation: Use `express-rate-limit` middleware with Redis backend.

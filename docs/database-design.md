# Database Design

## Entity-Relationship Diagram

```mermaid
erDiagram
    USER ||--o{ POST : creates
    USER ||--o{ VOTE : casts
    POST ||--o{ VOTE : receives
    POST ||--o{ ROADMAP : appears_in

    USER {
        ObjectId _id PK
        string name
        string email UK
        string password
        enum role
        date createdAt
    }

    POST {
        ObjectId _id PK
        string title
        string description
        enum category
        enum status
        ObjectId author FK
        number voteCount
        string adminReply
        date createdAt
        date updatedAt
    }

    VOTE {
        ObjectId _id PK
        ObjectId user FK
        ObjectId post FK
        date createdAt
        UQ "user, post"
    }

    ROADMAP {
        string status
        array planned
        array inProgress
        array shipped
    }
```

---

## Collections Schema

### `users` Collection

| Field | Type | Constraints | Description |
|-------|------|-----------|-------------|
| `_id` | ObjectId | Primary Key | MongoDB auto-generated ID |
| `name` | String | Required, non-empty | User's display name |
| `email` | String | Required, Unique, Lowercase | User's email address; unique at DB level via index |
| `password` | String | Required, minlength: 6, select: false | Bcrypt-hashed password; not included in queries by default |
| `role` | String (Enum) | Enum: ['user', 'admin'], default: 'user' | User role; hardcoded to 'user' on registration, only updatable via admin direct DB access |
| `createdAt` | Date | Auto-populated | User creation timestamp |

**Indexes**:
- `email: 1` (unique index) — Speeds up login queries and enforces email uniqueness

**Design Notes**:
- Password is marked `select: false` in the schema, so it's excluded from all queries by default. Auth middleware must explicitly `.select('+password')` when comparing.
- Email is lowercased before storage for case-insensitive login.
- `createdAt` is auto-populated; there is no `updatedAt` for users (profiles are not editable).

---

### `posts` Collection

| Field | Type | Constraints | Description |
|-------|------|-----------|-------------|
| `_id` | ObjectId | Primary Key | MongoDB auto-generated ID |
| `title` | String | Required, trim | Post title; user-provided, max 100 chars enforced by validation |
| `description` | String | Required | Post description/details; max 1000 chars enforced by validation |
| `category` | String (Enum) | Enum: ['feature', 'bug', 'improvement'], required | Feedback type; controls filtering on FeedbackBoard |
| `status` | String (Enum) | Enum: ['open', 'planned', 'in-progress', 'shipped'], default: 'open' | Admin-managed state; controls appearance on Roadmap (only 'planned', 'in-progress', 'shipped' shown) |
| `author` | ObjectId | Required, FK to users | References the User who created the post; used for authorization (author can edit/delete) |
| `voteCount` | Number | Default: 0 | Denormalized vote count; incremented/decremented by vote toggle; not directly editable |
| `adminReply` | String | Optional, max 500 chars | Admin comment; visible to all users; only updatable by admin via PATCH |
| `createdAt` | Date | Auto-populated | Post creation timestamp; used for sorting "newest" |
| `updatedAt` | Date | Auto-populated | Post last modification timestamp; managed by MongoDB timestamps option |

**Indexes**:
- `status: 1` — Filters posts by status ('open', 'planned', etc.) on both FeedbackBoard and Roadmap queries
- `category: 1` — Filters posts by category (feature, bug, improvement)
- `voteCount: -1, createdAt: -1` — Composite index for "Top" sort (most votes, then newest); MongoDB can satisfy the query in index order
- `createdAt: -1` — Sorts posts by newest date; used when sort='newest'
- `author: 1` (implicit) — Implicit foreign key index for populate queries and author authorization checks

**Design Notes**:
- `status` defaults to 'open' on creation; only admins can change it.
- `voteCount` is denormalized: it is NOT computed on-the-fly with a `$lookup` or `$size` aggregation. Instead, it's maintained via the `$inc` operator in the vote toggle controller. This trades eventual consistency risk for query performance (no expensive aggregation pipeline needed for sorting by popularity).
- `adminReply` is a simple string, not a structured object with reply ID, timestamp, or author. This is acceptable for MVP; if replies need threading or multiple responses, convert to an array of reply objects.

---

### `votes` Collection

| Field | Type | Constraints | Description |
|-------|------|-----------|-------------|
| `_id` | ObjectId | Primary Key | MongoDB auto-generated ID |
| `user` | ObjectId | Required, FK to users | References the User who voted |
| `post` | ObjectId | Required, FK to posts | References the Post being voted on |
| `createdAt` | Date | Auto-populated | Vote creation timestamp; used to sort votes by recency (not currently exposed in API) |
| `(user, post)` | Compound Index | Unique | Compound unique index on user + post; prevents duplicate votes from same user on same post |

**Indexes**:
- `{ user: 1, post: 1 }` (unique index) — Enforces uniqueness: one vote per (user, post) pair; MongoDB returns error code 11000 on duplicate, which vote controller handles gracefully by fetching current post state
- `user: 1` (implicit from compound index) — Used in "hasVoted" query to find all votes by a user for a set of posts
- `post: 1` (implicit from compound index) — Used in vote toggle to check if a vote exists and in delete to clean up votes when a post is deleted

**Design Notes**:
- The unique compound index is the primary mechanism preventing duplicate votes. No application-level duplicate checking is needed; the DB enforces it.
- When a duplicate vote attempt occurs (race condition), MongoDB returns error code 11000 (`MongoError: E11000 duplicate key error`). The vote controller catches this and returns the current post state instead of failing, providing graceful degradation.
- `createdAt` is auto-populated but not currently used in the API. It could enable features like "vote history" or "sort by vote date" in future versions.

---

## Query Patterns

### Authentication Queries

**Login**:
```javascript
db.users.findOne({ email: email_from_request }).select('+password')
```
- Uses index on `email` for fast lookup
- Password is included via `.select('+password')` to perform bcrypt comparison

**Session Validation (getMe)**:
```javascript
db.users.findById(userId) // password excluded by default
```
- Uses primary key `_id` for O(1) lookup

---

### Post Queries

**List with Filters**:
```javascript
db.posts.find({
  category: req.query.category,
  status: req.query.status,
  $or: [
    { title: /regex/i },
    { description: /regex/i }
  ]
}).sort({ voteCount: -1, createdAt: -1 }).skip(skip).limit(limit).populate('author', 'name')
```
- Uses indexes on `category`, `status`, and composite `(voteCount, createdAt)` for efficient filtering and sorting
- Regex search is not indexed; future optimization: MongoDB text index

**Single Post**:
```javascript
db.posts.findById(postId).populate('author', 'name')
```
- Primary key lookup O(1)

**Roadmap**:
```javascript
db.posts.find({ status: { $in: ['planned', 'in-progress', 'shipped'] } })
  .sort({ createdAt: -1 }).populate('author', 'name')
```
- Uses index on `status`

---

### Vote Queries

**Toggle Vote**:
```javascript
db.votes.findOneAndDelete({ user: userId, post: postId })
```
- Uses compound unique index `(user, post)` for fast lookup/delete

**Check if Voted** (hasVoted):
```javascript
db.votes.find({
  user: userId,
  post: { $in: [postId1, postId2, ..., postId6] }
})
```
- Uses compound index `(user, post)` to find all votes by user for up to 6 posts in a single query
- Converts result to Set for O(1) lookup when attaching `hasVoted` to each post

**Clean Up Votes on Post Delete**:
```javascript
db.votes.deleteMany({ post: postId })
```
- Uses index on `post` to find and delete all votes for that post

---

## Constraints & Data Integrity

| Collection | Field | Type | Enforcement |
|-----------|-------|------|-------------|
| users | _id | Unique | MongoDB primary key |
| users | email | Unique | Index with `unique: true` |
| users | role | Enum | Mongoose schema enum; validation on save |
| posts | _id | Unique | MongoDB primary key |
| posts | category | Enum | Mongoose schema enum; validation on save |
| posts | status | Enum | Mongoose schema enum; validation on save |
| posts | author | Not Null | Mongoose required field |
| votes | _id | Unique | MongoDB primary key |
| votes | (user, post) | Unique | Compound unique index |
| votes | user | Not Null | Mongoose required field |
| votes | post | Not Null | Mongoose required field |

**Referential Integrity Notes**:
- MongoDB does not enforce foreign key constraints natively (no CASCADE DELETE by default).
- Application code handles referential integrity:
  - When a User is deleted: Admin should manually delete their posts and votes (not exposed in current API).
  - When a Post is deleted: Application code calls `Vote.deleteMany({ post: postId })` before deleting the post to prevent orphaned votes.

---

## Performance Considerations

### Index Maintenance

- **Total indexes**: ~5 (default _id, email unique, status, category, composite voteCount+createdAt)
- **Storage overhead**: ~5-10% of total data size
- **Write amplification**: Minimal; indexes are updated on every insert/update/delete (MongoDB handles internally)

### Query Performance (Estimated)

| Operation | Complexity | Estimated Time (1000 posts) |
|-----------|-----------|---------------------------|
| Get posts with filters + sort | O(n log n) with index | 50-100ms |
| Get single post by ID | O(1) | <1ms |
| Check hasVoted (6 posts) | O(1) | <1ms |
| Toggle vote (find + delete + $inc) | O(1) | 1-5ms |
| Roadmap query | O(n) filtered, O(m log m) sorted | 20-50ms |

### Bottlenecks & Scaling Strategy

- **Regex search**: Currently O(n) on full text scan. At 100k+ posts, replace with MongoDB text index: `db.posts.createIndex({ title: "text", description: "text" })` and use `db.posts.find({ $text: { $search: term } })`
- **Vote count aggregation**: Currently avoided via denormalization. If vote churn is high (thousands per second), consider caching voteCount in Redis with a background job to sync back to MongoDB.
- **Pagination**: Offset-based pagination is O(skip + limit). At page 1000+ on large datasets, cursor-based pagination becomes necessary. Implement with: `db.posts.find({ _id: { $gt: lastPostId } }).limit(limit)`.

---

## Backup & Recovery

**Recommended Setup** (for production):
- MongoDB Atlas continuous backup (default: daily snapshots + continuous restore points)
- Point-in-time restore window: 7 days
- Additional application-level backup: Export User, Post, Vote collections weekly to S3

**Disaster Recovery Procedure**:
1. Identify point in time to restore (e.g., 2 hours ago)
2. Create a new MongoDB cluster from snapshot
3. Restore from new cluster, validate data integrity
4. Update backend connection string to new cluster
5. Run smoke tests (login, create post, vote)
6. If successful, archive old cluster; if not, investigate before trying again

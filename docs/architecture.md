# Architecture Documentation

## System Context & Container View

```mermaid
graph TB
    User["👤 User<br/>(Browser)"]

    subgraph SPA["Single Page Application"]
        UI["React Vite App<br/>(Port 5173)"]
    end

    subgraph Server["API Server"]
        Express["Express.js<br/>(Port 5000)"]
    end

    subgraph DB["Data Layer"]
        MongoDB["MongoDB Atlas"]
    end

    User -->|HTTP/HTTPS| UI
    UI -->|REST API| Express
    Express -->|Query/Update| MongoDB
```

## Layered Server Architecture

```mermaid
graph TB
    subgraph HTTP["HTTP Layer"]
        Router["Routes<br/>auth, posts, votes"]
    end

    subgraph Middleware["Middleware Stack"]
        AuthMW["auth.js<br/>(verify JWT)"]
        AuthOptMW["authOptional.js<br/>(JWT if present)"]
        AdminMW["adminOnly.js<br/>(role check)"]
        ValidateMW["validate.js<br/>(Zod schemas)"]
        ErrorMW["errorHandler.js<br/>(centralized errors)"]
    end

    subgraph Business["Business Logic"]
        AuthCtrl["authController<br/>(register, login, getMe)"]
        PostCtrl["postController<br/>(CRUD, search, filter, sort)"]
        VoteCtrl["voteController<br/>(toggle with duplicate handling)"]
    end

    subgraph Data["Data Access"]
        UserModel["User Model"]
        PostModel["Post Model"]
        VoteModel["Vote Model"]
    end

    subgraph Utils["Utilities"]
        JWTUtil["JWT signing/verification"]
        BcryptUtil["Password hashing"]
        ErrorClass["AppError class"]
        AsyncHandler["asyncHandler wrapper"]
    end

    subgraph External["External"]
        MongoAtlas["MongoDB Atlas"]
    end

    Router -->|apply middleware| Middleware
    Router -->|dispatch| AuthCtrl
    Router -->|dispatch| PostCtrl
    Router -->|dispatch| VoteCtrl
    AuthCtrl -->|query/create| UserModel
    PostCtrl -->|query/create| PostModel
    VoteCtrl -->|query/create| VoteModel
    UserModel -->|persisted in| MongoAtlas
    PostModel -->|persisted in| MongoAtlas
    VoteModel -->|persisted in| MongoAtlas
    AuthCtrl -->|use| JWTUtil
    AuthCtrl -->|use| BcryptUtil
    AuthCtrl -->|throw| ErrorClass
```

## Frontend Component Tree

```mermaid
graph TB
    App["<App/>"]

    subgraph Layout["Layout & Navigation"]
        Navbar["<Navbar/>"]
    end

    subgraph Pages["Page Components"]
        FB["<FeedbackBoard/>"]
        PD["<PostDetail/>"]
        CP["<CreatePost/>"]
        EP["<EditPost/>"]
        RM["<Roadmap/>"]
        Login["<Login/>"]
        Reg["<Register/>"]
    end

    subgraph Shared["Reusable Components"]
        CC["<CategoryTag/>"]
        SB["<StatusBadge/>"]
        VB["<VoteButton/>"]
        PC["<PostCard/>"]
        SB2["<SearchBar/>"]
        FB2["<FilterBar/>"]
        Pag["<Pagination/>"]
        LS["<LoadingSpinner/>"]
        EM["<ErrorMessage/>"]
    end

    subgraph Context["Context & Hooks"]
        AC["<AuthContext/>"]
        UA["useAuth()"]
    end

    App --> Navbar
    App --> FB
    App --> PD
    App --> CP
    App --> EP
    App --> RM
    App --> Login
    App --> Reg

    FB --> SB2
    FB --> FB2
    FB --> PC
    FB --> Pag
    FB --> LS
    FB --> EM

    PD --> CC
    PD --> SB
    PD --> VB
    PD --> EM

    PC --> CC
    PC --> SB
    PC --> VB

    CP --> LS
    CP --> EM
    EP --> LS
    CP --> EM

    RM --> PC

    Navbar --> UA
    CP --> UA
    Login --> UA
    Reg --> UA

    AC -->|provides| UA
```

## Sequence Diagram: Register & Login with JWT

```mermaid
sequenceDiagram
    participant U as User
    participant R as React SPA
    participant A as Express API
    participant D as MongoDB

    Note over U,D: Registration Flow
    U->>R: Fill name, email, password
    R->>A: POST /api/auth/register
    A->>D: Check if email exists
    D-->>A: Not found ✓
    A->>A: Hash password with bcrypt
    A->>D: Create User (role='user')
    D-->>A: User created
    A->>A: Sign JWT { userId, role }
    A-->>R: 201 { token, user }
    R->>R: localStorage.setItem('token', token)
    R->>R: Set AuthContext.user & token
    R->>U: Redirect to /

    Note over U,D: Login Flow
    U->>R: Fill email, password
    R->>A: POST /api/auth/login
    A->>D: Find User by email
    D-->>A: User with email
    A->>A: Compare password (bcrypt)
    A->>A: Sign JWT { userId, role }
    A-->>R: 200 { token, user }
    R->>R: localStorage.setItem('token', token)
    R->>R: Set AuthContext.user & token
    R->>A: GET /api/auth/me (Authorization: Bearer token)
    A->>A: Verify JWT
    A->>D: Find User by userId
    D-->>A: User data
    A-->>R: 200 { user }
    R->>U: Redirect to /

    Note over U,D: On Every Request (Axios Interceptor)
    R->>R: Request interceptor
    R->>R: Attach Authorization: Bearer token
    R->>A: Send request with header
    A->>A: Verify JWT in auth middleware
    alt Token valid
        A-->>R: Process request
    else Token expired
        A-->>R: 401 Unauthorized
        R->>R: Response interceptor
        R->>R: localStorage.removeItem('token')
        R->>R: Navigate to /login
    end
```

## Sequence Diagram: Vote Toggle with Duplicate-Key Handling

```mermaid
sequenceDiagram
    participant U as User
    participant R as React SPA
    participant A as Express API
    participant D as MongoDB

    Note over U,D: First Vote (Add)
    U->>R: Click vote button
    R->>R: Optimistic update: voted=true, count++
    R->>A: POST /api/posts/:id/vote
    A->>D: findOneAndDelete Vote (user, post)
    D-->>A: null (no vote exists)
    A->>D: Vote.create({ user, post })
    D-->>A: Vote created ✓
    A->>D: Post.findByIdAndUpdate $inc voteCount: 1
    D-->>A: Updated Post
    A-->>R: 200 { voted: true, voteCount }
    R->>R: Sync with server response

    Note over U,D: Remove Vote
    U->>R: Click vote button again
    R->>R: Optimistic: voted=false, count--
    R->>A: POST /api/posts/:id/vote (same endpoint)
    A->>D: findOneAndDelete Vote (user, post)
    D-->>A: Vote deleted ✓
    A->>D: Post.findByIdAndUpdate $inc voteCount: -1
    D-->>A: Updated Post
    A-->>R: 200 { voted: false, voteCount }
    R->>R: Sync with server

    Note over U,D: Concurrent Vote Attempt (Race Condition)
    U->>R: User A clicks vote
    R->>R: Optimistic: voted=true
    U->>R: User A clicks vote again (very fast, before response)
    R->>R: Second click: optimistic: voted=false (reverted)

    par Request 1
        R->>A: POST /api/posts/:id/vote (remove)
        A->>D: findOneAndDelete (no vote, return null)
        A->>D: Vote.create (success)
        A->>D: $inc voteCount: 1
        A-->>R: 200 { voted: true, voteCount: N+1 }
    and Request 2
        R->>A: POST /api/posts/:id/vote (add)
        A->>D: findOneAndDelete (finds the vote, deletes it)
        A->>D: Vote.create (fails with 11000 duplicate key error)
        A->>A: Catch duplicate key, fetch current Post state
        A-->>R: 200 { voted: true, voteCount: N+1 }
    end

    R->>R: Both responses return voted=true, count=N+1
    R->>R: Final state consistent with server ✓
```

## Sequence Diagram: List Posts with hasVoted Computation

```mermaid
sequenceDiagram
    participant U as User
    participant R as React SPA
    participant A as Express API
    participant D as MongoDB

    Note over U,D: Unauthenticated (authOptional)
    U->>R: Visit /
    R->>A: GET /api/posts?limit=6&page=1
    A->>A: authOptional: no token → req.user = undefined
    A->>D: Post.find(filter).populate('author', 'name')...limit(6)
    D-->>A: Array of 6 posts
    A->>A: Create empty votedPostIds Set
    A-->>R: 200 { posts: [...], page, pages, total, hasVoted: false for all }
    R->>U: Display posts, vote buttons unlocked but click prompts login

    Note over U,D: Authenticated User
    U->>R: Login successful, visit /
    R->>R: localStorage has token
    R->>A: GET /api/posts?limit=6&page=1
    R->>A: (Axios interceptor adds Authorization: Bearer token)
    A->>A: auth/authOptional middleware: verify JWT → req.user = { _id, name, email, role }
    A->>D: Post.find(filter).populate('author', 'name')...limit(6)
    D-->>A: Array of 6 posts (e.g., post IDs [p1, p2, p3, p4, p5, p6])
    A->>D: Vote.find({ user: userId, post: { $in: [p1..p6] } })
    D-->>A: Votes user has (e.g., [vote for p2, vote for p5])
    A->>A: Create Set of voted post IDs: { p2, p5 }
    A->>A: forEach post: post.hasVoted = votedPostIds.has(post._id)
    A-->>R: 200 { posts: [{..., hasVoted: false}, {..., hasVoted: true}, {...}], ... }
    R->>R: Render posts, highlight vote buttons for p2, p5
    U->>U: All vote states are correct ✓
```

## State Diagram: Post Status Flow

```mermaid
stateDiagram-v2
    [*] --> open

    open --> planned: Admin updates status
    open --> [*]: Deleted

    planned --> in_progress: Admin updates status
    planned --> [*]: Deleted

    in_progress --> shipped: Admin updates status
    in_progress --> [*]: Deleted

    shipped --> [*]: Deleted

    note right of open
        Initial state when post is created.
        Visible on FeedbackBoard.
        Not shown on Roadmap.
    end note

    note right of planned
        Admin has acknowledged the request.
        Shown in Roadmap "Planned" column.
    end note

    note right of in_progress
        Feature is being built.
        Shown in Roadmap "In Progress" column.
    end note

    note right of shipped
        Feature is released.
        Shown in Roadmap "Shipped" column.
        Can still receive admin replies.
    end note
```

---

## Architecture Decisions

### 1. Separate Votes Collection vs. Array in Post

**Decision**: Separate `Vote` collection with compound unique index on `(user, post)`.

**Trade-offs**:
- **Pros**: Enables efficient "hasVoted" queries (single Vote lookup); scales well as post vote counts grow; no array size limits; simplifies concurrent vote operations
- **Cons**: Slightly higher latency for vote toggle (two operations: delete/create Vote, then $inc Post); additional collection to manage

**Rationale**: A FeedbackBoard expects thousands of votes over time. Storing votes as an array in Post would cause the document to grow indefinitely, degrading query performance and risking MongoDB's 16MB document limit. A separate collection with a compound index is the standard denormalization pattern for such scenarios.

### 2. Denormalized voteCount

**Decision**: Store `voteCount` as a denormalized field on Post, updated via `$inc` operator.

**Trade-offs**:
- **Pros**: Fast aggregation on FeedbackBoard (sorting by top is O(1) per document); avoids expensive `$size` or `$lookup` aggregation pipelines
- **Cons**: Potential for count drift if vote operations fail mid-transaction (though race condition handling mitigates this)

**Rationale**: The FeedbackBoard needs to sort and display posts by popularity without running an aggregation pipeline. Denormalization trades a small risk of eventual consistency for responsive UI performance.

### 3. JWT in localStorage vs. httpOnly Cookie

**Decision**: JWT stored in `localStorage`, attached to `Authorization: Bearer` header manually.

**Trade-offs**:
- **Pros**: Works seamlessly with CORS from separate frontend domain; CSRF attacks impossible (CORS controls same-origin requests); visible to frontend for client-side logic
- **Cons**: Vulnerable to XSS (malicious script in page can steal token); developers must manually attach headers; logout is client-side only

**Rationale**: This is a full-stack MERN app with separate frontend and backend domains (5173 vs. 5000). httpOnly cookies fail with CORS for cross-domain requests. localStorage + explicit header attachment is simpler to manage in this architecture. XSS risk is mitigated by input validation and avoiding dynamic HTML injection.

### 4. Offset Pagination vs. Cursor-Based

**Decision**: Offset-based pagination (page number + limit).

**Trade-offs**:
- **Pros**: Simple to implement; intuitive for users (page 1, 2, 3); easy to hardcode canonical URLs
- **Cons**: Skips can become expensive at high page numbers (though limit capped at 50); not suitable for real-time data where documents shift during pagination

**Rationale**: FeedbackBoard is not a high-frequency real-time feed. Offset pagination is sufficient for typical usage and simpler for UX. If this scales to 1M+ posts, cursor-based pagination should be reconsidered.

### 5. Regex Search vs. Text Index

**Decision**: Regex search on title and description fields.

**Trade-offs**:
- **Pros**: Works immediately without index setup; flexible for partial matches; case-insensitive with `$options: 'i'`
- **Cons**: Slower for large datasets (must scan all documents); not ideal for full-text search (doesn't understand word boundaries natively); regex escaping required to prevent injection

**Rationale**: Current dataset is expected to be under 10k posts. Regex search is acceptable for this scale. As data grows, creating a MongoDB text index (`db.posts.createIndex({ title: "text", description: "text" })`) would replace this without schema changes.

---

## Scaling and Future Work

### Phase 1: Current (MVP)
- Single backend instance
- MongoDB Atlas shared cluster
- In-memory session state
- Offset pagination

### Phase 2: Performance (Caching & Indexing)
- Redis for session caching and vote rate-limiting
- Text indexes on `title` and `description` for full-text search
- Composite indexes: `{ category: 1, status: 1, createdAt: -1 }` for filtered queries
- CDN for static assets
- Backend load balancing (nginx reverse proxy)

### Phase 3: Real-Time (WebSockets)
- Socket.io for live vote updates
- Push notifications when admin replies to user posts
- Real-time roadmap sync (multiple users viewing simultaneously)

### Phase 4: Analytics & Admin Dashboard
- Aggregation pipelines to compute trends (votes over time, top categories)
- Admin dashboard with charts: posts per category, vote distribution, user engagement
- Email digests for admins with weekly summary

### Phase 5: Advanced Features
- Image uploads (S3 or CloudFlare)
- Email notifications (SendGrid)
- Categories managed by admins (currently hardcoded)
- Tags/labels for posts (enable cross-category filtering)
- User profiles with post history
- Duplicate detection (similar posts flagged during creation)

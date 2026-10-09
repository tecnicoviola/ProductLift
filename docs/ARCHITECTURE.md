# ProductLift: Architecture and UML Design

This document describes how ProductLift is designed: the system architecture, use cases, data model, class structure, key interaction flows and the post status lifecycle. All diagrams are written in [Mermaid](https://mermaid.js.org/), so GitHub renders them directly in this file.

## Contents

1. [System architecture](#1-system-architecture)
2. [Use case diagram](#2-use-case-diagram)
3. [Data model (ER diagram)](#3-data-model-er-diagram)
4. [Backend class diagram](#4-backend-class-diagram)
5. [Sequence diagrams](#5-sequence-diagrams)
6. [Post status lifecycle](#6-post-status-lifecycle)
7. [Frontend structure](#7-frontend-structure)
8. [Planned deployment](#8-planned-deployment)
9. [Key design decisions](#9-key-design-decisions)

---

## 1. System architecture

ProductLift is a three-tier application: a React single-page app talks to a REST API built with Express, which stores data in MongoDB. The backend is layered so that each part has one job.

```mermaid
flowchart LR
  subgraph Client["Client: React + TypeScript + Vite"]
    UI["Pages: Landing, Auth, Board, Roadmap, Admin"]
    STATE["Auth state and JWT kept on the client"]
    API["API client: fetch with Bearer token"]
    UI --> STATE
    UI --> API
  end

  subgraph Server["Server: Node.js + Express + TypeScript"]
    MW["Global middleware: helmet, CORS, JSON body limit, rate limit on login and register"]
    RT["Routes: /api/auth, /api/posts, /api/roadmap, /api/health"]
    GUARD["Route middleware: auth, authOptional, adminOnly, validateBody with zod"]
    CTRL["Controllers: translate HTTP to service calls"]
    SVC["Services: auth, post, vote business logic"]
    MOD["Mongoose models: User, Post, Vote"]
    ERR["notFound and errorHandler: one consistent error format"]
    MW --> RT --> GUARD --> CTRL --> SVC --> MOD
    CTRL -.-> ERR
  end

  DB[("MongoDB")]

  API -- "HTTP JSON REST" --> MW
  MOD --> DB
```

### Layer responsibilities

| Layer | Responsibility |
| --- | --- |
| Routes | Declare endpoints and attach middleware. No logic. |
| Middleware | Authentication, role check, input validation, error handling. |
| Controllers | Read the request, call a service, send the response. |
| Services | Business rules: who may edit a post, how a vote toggles, how the roadmap is grouped. |
| Models | Schema, indexes and persistence through Mongoose. |

`app.ts` builds the Express app and `server.ts` starts it, so the app can be tested without opening a port.

---

## 2. Use case diagram

Three kinds of actors use the system. An admin can do everything a registered user can, and a registered user can do everything a visitor can.

```mermaid
flowchart LR
  V(["Visitor"])
  U(["Registered user"])
  A(["Admin"])

  subgraph System["ProductLift"]
    UC1["View landing page and roadmap"]
    UC2["Browse, search and filter ideas"]
    UC3["Register or log in"]
    UC4["Submit an idea"]
    UC5["Vote or remove a vote"]
    UC6["Edit or delete own idea"]
    UC7["Update idea status"]
    UC8["Write or remove an admin reply"]
    UC9["Delete any idea"]
    UC10["View admin dashboard counts"]
  end

  V --> UC1 & UC2 & UC3
  U --> UC4 & UC5 & UC6
  A --> UC7 & UC8 & UC9 & UC10
  U -.->|"can also do everything a visitor can"| V
  A -.->|"can also do everything a user can"| U
```

Reading ideas and the roadmap is public at the API level. Everything that changes data requires a valid token, and status changes, admin replies and deleting other people's ideas require the admin role.

---

## 3. Data model (ER diagram)

Three MongoDB collections. `Vote` is its own collection so a unique index can guarantee one vote per user per post.

```mermaid
erDiagram
  USER ||--o{ POST : "authors"
  USER ||--o{ VOTE : "casts"
  POST ||--o{ VOTE : "receives"

  USER {
    ObjectId _id PK
    string name
    string email UK
    string password "bcrypt hash, never returned by default"
    string role "user or admin"
    date createdAt
  }

  POST {
    ObjectId _id PK
    string title
    string description
    string category "feature, improvement or bug"
    string status "open, planned, in-progress or shipped"
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
  }
```

**Indexes and constraints**

- `User.email` is unique and stored in lower case.
- `Vote` has a unique compound index on `(user, post)`. This is what prevents duplicate votes, even if two requests arrive at the same moment.
- `Post.voteCount` is a stored counter so that sorting by top voted does not need an aggregation.

---

## 4. Backend class diagram

The domain models and the services that operate on them.

```mermaid
classDiagram
  direction LR

  class User {
    +ObjectId _id
    +String name
    +String email
    -String password
    +UserRole role
    +Date createdAt
    +comparePassword(candidate) Promise~boolean~
  }

  class Post {
    +ObjectId _id
    +String title
    +String description
    +PostCategory category
    +PostStatus status
    +ObjectId author
    +Number voteCount
    +String adminReply
    +Date createdAt
    +Date updatedAt
  }

  class Vote {
    +ObjectId _id
    +ObjectId user
    +ObjectId post
    +Date createdAt
  }

  class UserRole {
    <<enumeration>>
    user
    admin
  }

  class PostCategory {
    <<enumeration>>
    feature
    improvement
    bug
  }

  class PostStatus {
    <<enumeration>>
    open
    planned
    in-progress
    shipped
  }

  class AuthService {
    +registerUser(input) AuthResult
    +loginUser(input) AuthResult
  }

  class PostService {
    +listPosts(query, userId) PostPage
    +getPostById(id, userId) PostView
    +createPost(input, authorId) PostView
    +updatePost(id, input, userId) PostView
    +deletePost(id, user) void
    +updatePostStatus(id, input, userId) PostView
    +getRoadmap() Roadmap
  }

  class VoteService {
    +toggleVote(postId, userId) VoteResult
  }

  class AppError {
    +Number statusCode
    +String message
    +String[] errors
  }

  User "1" --> "0..*" Post : authors
  User "1" --> "0..*" Vote : casts
  Post "1" --> "0..*" Vote : receives
  User --> UserRole
  Post --> PostCategory
  Post --> PostStatus

  AuthService ..> User : creates and reads
  PostService ..> Post : reads and writes
  PostService ..> Vote : reads for hasVoted
  VoteService ..> Vote : creates and deletes
  VoteService ..> Post : updates voteCount
  AuthService ..> AppError : throws
  PostService ..> AppError : throws
  VoteService ..> AppError : throws
```

---

## 5. Sequence diagrams

### 5.1 Login

The same message is returned for an unknown email and a wrong password, so the endpoint cannot be used to find out which emails are registered.

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant C as React app
  participant R as Express route
  participant Z as validateBody (zod)
  participant S as auth.service
  participant DB as MongoDB

  U->>C: Enter email and password
  C->>R: POST /api/auth/login
  R->>Z: Validate request body
  alt Invalid input
    Z-->>C: 400 Validation Error with messages
  else Valid input
    Z->>S: loginUser(input)
    S->>DB: Find user by email, include password hash
    DB-->>S: User or nothing
    S->>S: bcrypt compare with stored hash
    alt Wrong email or password
      S-->>C: 401 Invalid credentials
    else Correct
      S->>S: Sign JWT with userId and role
      S-->>C: 200 token and user
      C->>C: Store token and update auth state
    end
  end
```

### 5.2 Vote toggle

Votes are stored as documents first. The counter only changes after a vote has really been created or deleted, so the two cannot drift apart.

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant C as React app
  participant A as auth middleware
  participant VS as vote.service
  participant DB as MongoDB

  U->>C: Click vote button
  C->>C: Optimistic update of the count
  C->>A: POST /api/posts/:id/vote with Bearer token
  alt Missing, invalid or expired token
    A-->>C: 401
    C->>C: Roll back the optimistic update
  else Valid token
    A->>VS: toggleVote(postId, userId)
    VS->>DB: Delete existing vote for user and post
    alt A vote existed
      VS->>DB: Decrease voteCount by 1
      VS-->>C: voted false and new voteCount
    else No vote existed
      VS->>DB: Create vote, unique index on user and post
      alt Duplicate key because of a race
        VS-->>C: voted true and current voteCount, no change
      else Created
        VS->>DB: Increase voteCount by 1
        VS-->>C: voted true and new voteCount
      end
    end
  end
```

### 5.3 Admin updates status and replies

```mermaid
sequenceDiagram
  autonumber
  actor AD as Admin
  participant C as React app
  participant A as auth middleware
  participant O as adminOnly middleware
  participant Z as validateBody (zod)
  participant PS as post.service
  participant DB as MongoDB

  AD->>C: Choose new status and write a reply
  C->>A: PATCH /api/posts/:id/status with Bearer token
  A->>A: Verify JWT and load the user
  A->>O: Pass the request
  alt Role is not admin
    O-->>C: 403 Admin access required
  else Role is admin
    O->>Z: Validate status and adminReply
    alt Invalid status or reply too long
      Z-->>C: 400 Validation Error
    else Valid
      Z->>PS: updatePostStatus(id, input, userId)
      PS->>DB: Find post by id
      alt Post not found
        PS-->>C: 404 Post not found
      else Found
        PS->>DB: Save status and adminReply
        PS-->>C: 200 updated post
        C->>C: Refresh dashboard and counts
      end
    end
  end
```

---

## 6. Post status lifecycle

A post starts as Open. The normal path moves forward through Planned and In progress to Shipped. The API accepts any valid status from an admin, so an idea can also be moved back, for example if work is paused.

```mermaid
stateDiagram-v2
  state "In progress" as InProgress

  [*] --> Open: User submits an idea
  Open --> Planned: Admin accepts the idea
  Planned --> InProgress: Work starts
  InProgress --> Shipped: Released
  Planned --> Open: Admin moves it back
  InProgress --> Planned: Work paused
  Shipped --> [*]
```

Only Planned, In progress and Shipped ideas appear on the public roadmap. Open ideas stay on the feedback board only.

---

## 7. Frontend structure

A page-level view of the React app. Component names inside each page are described by what the user sees.

```mermaid
flowchart TD
  ROUTER["React Router"]

  subgraph Public["Public pages"]
    LAND["Landing page with product preview"]
    AUTH["Auth page: Log in and Register tabs"]
  end

  subgraph Protected["Pages for logged-in users"]
    BOARD["Feedback board: category filters, idea cards, vote button, admin reply shown on card"]
    MODAL["Submit idea modal: title, description, category"]
    ROAD["Roadmap: Planned, In progress, Shipped columns with counts"]
  end

  subgraph AdminOnly["Admin-only page"]
    DASH["Admin dashboard: status counts, status dropdown, reply box"]
  end

  THEME["Theme toggle: light and dark"]
  CLIENTAPI["API client: base URL, token header, error handling"]

  ROUTER --> LAND
  ROUTER --> AUTH
  ROUTER --> BOARD
  ROUTER --> ROAD
  ROUTER --> DASH
  BOARD --> MODAL
  THEME -.-> ROUTER
  BOARD --> CLIENTAPI
  ROAD --> CLIENTAPI
  DASH --> CLIENTAPI
  AUTH --> CLIENTAPI
  MODAL --> CLIENTAPI
```

The frontend hides pages the user may not open, but the real protection is on the server: every restricted endpoint checks the token and role again.

---

## 8. Planned deployment

This is the intended production setup. It is not deployed yet.

```mermaid
flowchart LR
  USER["Browser"] --> FE["Frontend on Vercel or Netlify: static React build"]
  FE -- "HTTPS REST with CLIENT_URL allowed by CORS" --> BE["Backend on Render or Railway: Node and Express"]
  BE -- "MONGO_URI" --> ATLAS[("MongoDB Atlas")]
```

Secrets (`MONGO_URI`, `JWT_SECRET`) live in the hosting provider's environment settings, never in the repository.

---

## 9. Key design decisions

| Decision | Reason |
| --- | --- |
| Layered backend (routes, controllers, services, models) | Keeps HTTP handling separate from business rules, so logic can be changed and tested on its own. |
| Separate `Vote` collection with a unique `(user, post)` index | The database itself guarantees one vote per user, even under concurrent requests. |
| Stored `voteCount` on `Post` | Sorting by top voted stays a simple indexed query. |
| zod validation in middleware | Bad input is rejected early, and unknown fields such as a `role` sent to `/register` are dropped. |
| Role set on the server | Nobody can make themselves an admin through the API. |
| `authOptional` on public reads | Anonymous visitors can browse, and logged-in users also get `hasVoted` without a second request. |
| One query for `hasVoted` per page of posts | Avoids the N+1 query problem. |
| Central `errorHandler` and `AppError` | Every error has the same JSON shape: `{ success: false, message, errors? }`. |
| Same error for unknown email and wrong password | Prevents discovering which emails are registered. |
| `helmet`, CORS allow-list and login rate limiting | Basic hardening against common web attacks and password guessing. |

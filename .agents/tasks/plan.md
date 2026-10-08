# FeedbackBoard MERN Stack Implementation Plan

This plan details the complete implementation of FeedbackBoard, a feedback and roadmap management application built with MongoDB, Express, React (Vite), and Node.js.

## Overview

The application allows users to submit feature requests, upvote them, and enables admins to manage post status through a visual roadmap. Key features include JWT authentication, vote toggling with optimistic UI, advanced filtering/sorting, and admin-only status management.

---

## FEAT-001: Backend Infrastructure & Authentication

**Purpose**: Set up the Express server, MongoDB models, JWT authentication system, middleware, and seed data.

### Files to Create

#### 1. Server Configuration & Dependencies

- **server/package.json**
  - Dependencies: express, mongoose, bcryptjs, jsonwebtoken, dotenv, express-validator, cors
  - DevDependencies: nodemon
  - Scripts: start, dev, seed

- **server/.env.example**
  - PORT=5000
  - MONGO_URI=mongodb://localhost:27017/feedbackboard
  - JWT_SECRET=yoursecretkey
  - JWT_EXPIRE=30d

- **server/config/db.js**
  - MongoDB connection function using mongoose.connect
  - Error handling with process.exit on failure

#### 2. Mongoose Models

- **server/models/User.js**
  - Schema: name (required), email (unique, lowercase, required), password (required, min 6), role (enum: user/admin, default: user), createdAt (default: Date.now)
  - Pre-save hook: hash password with bcrypt if modified (bcrypt.genSalt(10), bcrypt.hash)
  - Method: comparePassword(candidatePassword) - returns bcrypt.compare result
  - **Note**: Email uniqueness enforced at DB level

- **server/models/Post.js**
  - Schema: title (required, trim), description (required), category (enum: feature/bug/improvement, required), status (enum: open/planned/in-progress/shipped, default: open), author (ref: User, required), voteCount (Number, default: 0), adminReply (String, optional), timestamps: true
  - Indexes: status, category, createdAt for query performance
  - **Note**: voteCount updated via $inc in vote controller, not directly manipulated

- **server/models/Vote.js**
  - Schema: user (ref: User, required), post (ref: Post, required), createdAt (default: Date.now)
  - Compound unique index: `schema.index({ user: 1, post: 1 }, { unique: true })`
  - **Note**: Unique index prevents duplicate votes, error code 11000 handled in controller

#### 3. Middleware

- **server/middleware/auth.js**
  - Extract token from `req.headers.authorization` (Bearer <token>)
  - Verify with jwt.verify(token, JWT_SECRET)
  - Decode to get userId, fetch user from DB (exclude password)
  - Attach user to req.user
  - Handle TokenExpiredError and JsonWebTokenError with 401
  - Export second middleware `authOptional`: same logic but doesn't return 401 if no token (for getPosts hasVoted computation)

- **server/middleware/adminOnly.js**
  - Check `req.user.role === 'admin'`
  - If not, return 403: { success: false, message: 'Admin access required' }

- **server/middleware/errorHandler.js**
  - Centralized error handler (err, req, res, next)
  - Log error.stack to console
  - Handle mongoose ValidationError: extract messages into errors array
  - Handle duplicate key error (code 11000): friendly message about duplicate
  - Handle CastError: "Resource not found"
  - Default: { success: false, message: err.message || 'Server Error', errors?: [...] }
  - Must be last middleware in server.js

- **server/middleware/validate.js**
  - Use express-validator to define validation rules:
    - registerValidation: [body('name').notEmpty(), body('email').isEmail(), body('password').isLength({ min: 6 })]
    - loginValidation: [body('email').isEmail(), body('password').notEmpty()]
    - postValidation: [body('title').isLength({ min: 3, max: 100 }), body('description').isLength({ min: 10, max: 1000 }), body('category').isIn(['feature', 'bug', 'improvement'])]
    - statusValidation: [body('status').isIn(['open', 'planned', 'in-progress', 'shipped']), body('adminReply').optional().isLength({ max: 500 })]
  - Export middleware function: check validationResult, if errors return 400 with errors array

#### 4. Controllers & Routes

- **server/controllers/authController.js**
  - **register**: Validate input, check if email exists, create User with role='user' (hardcoded), hash password via pre-save hook, sign JWT with payload { userId: user._id, role: user.role }, return { success: true, token, user: { exclude password } }
  - **login**: Validate input, find user by email (include password for comparison), call user.comparePassword, if valid sign JWT, return token + user
  - **getMe**: Return req.user (populated by auth middleware, password already excluded)

- **server/routes/authRoutes.js**
  - POST /register (registerValidation middleware)
  - POST /login (loginValidation middleware)
  - GET /me (auth middleware)

- **server/server.js**
  - Load dotenv.config()
  - Import express, cors, connectDB, authRoutes, errorHandler
  - Initialize app, use cors(), express.json()
  - Mount routes: app.use('/api/auth', authRoutes)
  - Use errorHandler as last middleware
  - connectDB().then(() => app.listen(PORT))

#### 5. Seed Script

- **server/utils/seed.js**
  - Load dotenv, connect to MongoDB
  - Clear collections: User.deleteMany(), Post.deleteMany(), Vote.deleteMany()
  - Create admin user: { name: 'Admin User', email: 'admin@feedbackboard.com', password: 'Admin123!', role: 'admin' }
  - Create 8-10 sample posts with varied categories (feature, bug, improvement), statuses (open, planned, in-progress, shipped), titles, descriptions, all authored by admin, voteCount: random 0-10
  - Log success message, process.exit(0)
  - **Note**: Password hashing happens via User model pre-save hook

### Verification

1. `cd server && npm install` - installs dependencies
2. Copy `.env.example` to `.env`, fill in MONGO_URI if not using default
3. Start MongoDB (mongod or Atlas)
4. `npm run seed` - populates database
5. `npm run dev` - starts server on port 5000
6. Test with curl/Postman:
   - POST /api/auth/register { name, email, password } → returns token, user.role='user'
   - POST /api/auth/login { email, password } → returns token
   - GET /api/auth/me (with Authorization: Bearer <token>) → returns user
   - GET /api/auth/me (no token) → 401

---

## FEAT-002: Posts & Voting API

**Purpose**: Implement all post CRUD operations, voting toggle logic with optimistic support, and roadmap grouping endpoint.

### Files to Create/Modify

#### 1. Post Controller

- **server/controllers/postController.js**

  - **getPosts**: 
    - Parse query params: sort (top|newest, default newest), category, status, search, page (default 1), limit (default 10)
    - Build query object: if category, add to filter; if status, add to filter; if search, use `{ $or: [{ title: { $regex: search, $options: 'i' }}, { description: { $regex: search, $options: 'i' }}]}`
    - Sort: if sort='top' then { voteCount: -1 }, else { createdAt: -1 }
    - Paginate: skip = (page-1)*limit
    - Execute query with .populate('author', 'name email')
    - **hasVoted computation**: If req.user exists (authOptional middleware attached user), for each post check `Vote.findOne({ user: req.user._id, post: post._id })`, set post.hasVoted = !!vote
    - Return { success: true, posts, page, pages: Math.ceil(total/limit), total }
    - **Note**: Use lean() for performance, manually attach hasVoted field

  - **getPost**:
    - Find by ID with .populate('author', 'name email')
    - If req.user, compute hasVoted (same logic)
    - Return { success: true, post } or 404

  - **createPost**:
    - Extract title, description, category from req.body
    - Create post: { ...req.body, author: req.user._id, status: 'open', voteCount: 0 }
    - Return 201 { success: true, post }

  - **updatePost**:
    - Find post by ID
    - Check post.author.toString() === req.user._id.toString(), else 403
    - Update only title, description, category (not status, voteCount, author, adminReply)
    - Return { success: true, post }

  - **deletePost**:
    - Find post by ID
    - Check post.author.toString() === req.user._id.toString() OR req.user.role === 'admin', else 403
    - Delete all votes: `Vote.deleteMany({ post: postId })`
    - Delete post
    - Return 200 { success: true, message: 'Post deleted' }

  - **updateStatus** (admin only):
    - Find post by ID
    - Update status, optionally adminReply from req.body
    - Return { success: true, post }

  - **getRoadmap**:
    - Query posts where status in ['planned', 'in-progress', 'shipped']
    - .populate('author', 'name').sort({ createdAt: -1 })
    - Group into object: { planned: [], inProgress: [], shipped: [] }
    - Return { success: true, roadmap: { planned, inProgress, shipped } }

#### 2. Vote Controller

- **server/controllers/voteController.js**

  - **toggleVote**:
    - Extract postId from req.params.id, userId from req.user._id
    - Check post exists (Post.findById), if not 404
    - Try to find existing vote: `Vote.findOne({ user: userId, post: postId })`
    - **If vote exists**:
      - Delete vote: `vote.deleteOne()`
      - Decrement count: `Post.findByIdAndUpdate(postId, { $inc: { voteCount: -1 } }, { new: true })`
      - Return { success: true, message: 'Vote removed', voted: false, voteCount: post.voteCount }
    - **If vote does not exist**:
      - Create vote: `Vote.create({ user: userId, post: postId })` wrapped in try-catch
      - If duplicate key error (code 11000): fetch current post state, return current voted state (edge case: concurrent requests)
      - Increment count: `Post.findByIdAndUpdate(postId, { $inc: { voteCount: 1 } }, { new: true })`
      - Return { success: true, message: 'Vote added', voted: true, voteCount: post.voteCount }
    - **Note**: This toggle pattern handles race conditions gracefully with duplicate key error handling

#### 3. Routes

- **server/routes/postRoutes.js**
  - GET / (use authOptional middleware for hasVoted)
  - GET /roadmap (public)
  - GET /:id (use authOptional)
  - POST / (auth, postValidation)
  - PUT /:id (auth, postValidation)
  - DELETE /:id (auth)
  - PATCH /:id/status (auth, adminOnly, statusValidation)
  - POST /:id/vote (auth)

- **server/server.js** (modify)
  - Add: `app.use('/api/posts', postRoutes)`

### Verification

1. Start server: `npm run dev`
2. Test GET /api/posts - returns paginated posts
3. Test GET /api/posts?sort=top - ordered by voteCount desc
4. Test GET /api/posts?category=feature&status=open - filtered correctly
5. Test GET /api/posts?search=test - searches title and description
6. Login as user, get token
7. Test POST /api/posts with token - creates post with author = userId
8. Test PUT /api/posts/:id - updates own post, 403 for others' posts
9. Test DELETE /api/posts/:id - deletes own post and its votes
10. Login as admin, get token
11. Test PATCH /api/posts/:id/status with admin token - updates status and adminReply
12. Test same with regular user token - 403
13. Test POST /api/posts/:id/vote - adds vote, increments count, returns voted: true
14. Test POST /api/posts/:id/vote again - removes vote, decrements count, returns voted: false
15. Test GET /api/posts with valid token - hasVoted is true for voted posts
16. Test GET /api/roadmap - returns posts grouped by status

---

## FEAT-003: Client Infrastructure & Authentication

**Purpose**: Set up React app with Vite, Tailwind CSS, React Router, Axios with JWT interceptors, AuthContext, and authentication pages.

### Files to Create

#### 1. Client Setup

- **client/package.json**
  - Dependencies: react, react-dom, react-router-dom, axios
  - DevDependencies: vite, @vitejs/plugin-react, tailwindcss, postcss, autoprefixer
  - Scripts: dev, build, preview

- **client/.env.example**
  - VITE_API_URL=http://localhost:5000

- **client/vite.config.js**
  - Import @vitejs/plugin-react
  - Export config with plugins: [react()], server: { port: 5173 }

- **client/index.html**
  - Standard HTML5 template with `<div id="root"></div>` and `<script type="module" src="/src/main.jsx"></script>`

- **client/tailwind.config.js**
  - content: ['./index.html', './src/**/*.{js,jsx}']
  - theme: extend with custom colors for status badges and category tags if needed
  - plugins: []

- **client/postcss.config.js**
  - Export { plugins: { tailwindcss: {}, autoprefixer: {} } }

- **client/src/index.css**
  - Tailwind directives: @tailwind base; @tailwind components; @tailwind utilities;
  - Custom styles: button classes (.btn, .btn-primary, .btn-secondary), form input styles, card styles, badge styles, responsive utilities

#### 2. API Configuration

- **client/src/api/axios.js**
  - Create axios instance: `axios.create({ baseURL: import.meta.env.VITE_API_URL })`
  - **Request interceptor**: `config.headers.Authorization = Bearer ${localStorage.getItem('token')}` if token exists
  - **Response interceptor**: catch 401 errors, clear localStorage token, redirect to /login (using window.location.href to avoid circular imports)
  - Export instance as default
  - **Note**: This centralizes JWT attachment and automatic logout on auth failure

#### 3. Auth Context

- **client/src/context/AuthContext.jsx**
  - State: user (null or user object), token (null or string), loading (boolean)
  - **useEffect on mount**: Check localStorage for token, if exists call GET /api/auth/me to validate, if valid set user, if invalid clear token
  - **login(token, user)**: Save token to localStorage, set user and token state
  - **register(token, user)**: Same as login
  - **logout()**: Remove token from localStorage, clear user and token state, redirect to /login
  - Export AuthProvider (wraps children with context) and useAuth hook (useContext shortcut)
  - **Note**: Token validation on mount ensures user stays logged in across refreshes

#### 4. Route Protection

- **client/src/components/ProtectedRoute.jsx**
  - Use useAuth to get user
  - If loading, return LoadingSpinner
  - If !user, return `<Navigate to="/login" />`
  - Else return `<Outlet />` (for nested routes) or children

- **client/src/components/AdminRoute.jsx**
  - Use useAuth to get user
  - If loading, return LoadingSpinner
  - If !user or user.role !== 'admin', return `<Navigate to="/" />`
  - Else return `<Outlet />` or children

#### 5. Auth Pages

- **client/src/pages/Register.jsx**
  - Form: name (text), email (email), password (password)
  - State: formData, loading, error
  - onSubmit: POST /api/auth/register via axios, on success call register(token, user) from AuthContext, navigate to '/'
  - Show error message if API fails
  - Link to /login for existing users
  - Style with Tailwind: centered form, styled inputs, primary button

- **client/src/pages/Login.jsx**
  - Form: email, password
  - State: formData, loading, error
  - onSubmit: POST /api/auth/login, on success call login(token, user), navigate to '/'
  - Show error message if API fails
  - Link to /register for new users
  - Style with Tailwind

#### 6. Layout Components

- **client/src/components/Navbar.jsx**
  - Use useAuth to get user
  - Always show: App name/logo (link to /), Roadmap link
  - If authenticated: Create Post link (/posts/create), Logout button (calls logout())
  - If not authenticated: Login, Register links
  - If user.role === 'admin', optionally show admin badge
  - Responsive: hamburger menu on mobile, full menu on desktop
  - Style with Tailwind

- **client/src/components/LoadingSpinner.jsx**
  - Centered div with spinning icon (Tailwind animate-spin)
  - Reusable across app

- **client/src/components/ErrorMessage.jsx**
  - Props: message, onDismiss (optional)
  - Styled alert box with red background, white text, dismiss button
  - Reusable for API errors

#### 7. App Structure

- **client/src/App.jsx**
  - Wrap in BrowserRouter and AuthProvider
  - Define Routes:
    - / → FeedbackBoard (public)
    - /login → Login
    - /register → Register
    - /roadmap → Roadmap (public)
    - /posts/create → CreatePost (protected)
    - /posts/:id → PostDetail (public)
    - /posts/:id/edit → EditPost (protected)
  - Render Navbar outside Routes (always visible)
  - Use ProtectedRoute for auth-required routes

- **client/src/main.jsx**
  - Import React, ReactDOM, App, index.css
  - `ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)`

### Verification

1. `cd client && npm install`
2. Copy `.env.example` to `.env` with VITE_API_URL=http://localhost:5000
3. Ensure backend is running
4. `npm run dev` - starts on port 5173
5. Open http://localhost:5173 - see navbar with login/register links
6. Click Register, fill form, submit - should create account and redirect to home, token in localStorage
7. Refresh page - should remain logged in (AuthContext validates token)
8. Click Logout - should clear token and show login/register links
9. Click Login, authenticate - should login and redirect
10. Try to visit /posts/create without login - should redirect to /login
11. Login as admin, verify admin badge shows
12. Manually corrupt token in localStorage, visit protected route - should redirect to /login

---

## FEAT-004: Feedback Board UI

**Purpose**: Build the main FeedbackBoard page with posts, voting, search, filters, pagination; PostDetail with admin controls; CreatePost and EditPost pages; all reusable components.

### Files to Create

#### 1. Reusable Components

- **client/src/components/CategoryTag.jsx**
  - Props: category ('feature' | 'bug' | 'improvement')
  - Render styled span with color: blue for feature, red for bug, yellow for improvement
  - Tailwind classes, small rounded badge

- **client/src/components/StatusBadge.jsx**
  - Props: status ('open' | 'planned' | 'in-progress' | 'shipped')
  - Render styled span with color: gray for open, blue for planned, yellow for in-progress, green for shipped
  - Tailwind classes, small rounded badge

- **client/src/components/VoteButton.jsx**
  - Props: postId, initialVoteCount, initialHasVoted, onVoteChange (callback with newVoteCount, newHasVoted)
  - Local state: voteCount (init from prop), hasVoted (init from prop), loading (boolean)
  - **onClick handler**:
    - Save previous state (for rollback)
    - Optimistically update: toggle hasVoted, increment/decrement voteCount
    - Set loading true
    - Call POST /api/posts/:postId/vote via axios
    - **On success**: call onVoteChange(response.data.voteCount, response.data.voted), sync local state with server response
    - **On error**: rollback local state to previous values, show error toast/message
    - Set loading false
  - Render: button with up arrow icon, vote count display, highlight if hasVoted (bg color change), disabled during loading
  - **Note**: Optimistic UI provides instant feedback, rollback on error prevents desync

- **client/src/components/PostCard.jsx**
  - Props: post (object), onVoteChange (callback)
  - Render card with:
    - CategoryTag with post.category
    - StatusBadge with post.status
    - Title as link to /posts/:id
    - Truncated description (max 150 chars)
    - Author name, timestamp (formatted)
    - VoteButton (pass postId, voteCount, hasVoted, onVoteChange)
  - Style with Tailwind: card with shadow, hover effect, responsive padding

- **client/src/components/SearchBar.jsx**
  - Props: value, onChange, onSubmit
  - Controlled input (text)
  - Form with onSubmit handler (calls props.onSubmit, prevents default)
  - Search button or Enter key submits
  - Style with Tailwind: input with border, search icon

- **client/src/components/FilterBar.jsx**
  - Props: selectedCategory, selectedStatus, onCategoryChange, onStatusChange
  - Two dropdowns or button groups:
    - Category: All, Feature, Bug, Improvement
    - Status: All, Open, Planned, In Progress, Shipped
  - Style with Tailwind: horizontal layout on desktop, stacked on mobile

- **client/src/components/Pagination.jsx**
  - Props: currentPage, totalPages, onPageChange
  - Render Previous button, page numbers (show max 5, with ellipsis if more), Next button
  - Disable Previous on page 1, disable Next on last page
  - Style with Tailwind: button group, active page highlighted

#### 2. Main Pages

- **client/src/pages/FeedbackBoard.jsx**
  - State: posts (array), loading, error, searchQuery, selectedCategory (''), selectedStatus (''), sortBy ('newest'), currentPage (1), totalPages (1)
  - **useEffect**: Fetch GET /api/posts with query params (sort, category, status, search, page, limit=10) whenever filters, search, sort, or page change
  - **onVoteChange handler**: Update the voted post in local posts array (find by id, update voteCount and hasVoted) without refetching - optimistic update persisted
  - Render:
    - SearchBar (value=searchQuery, onChange, onSubmit)
    - FilterBar (selectedCategory, selectedStatus, onChange handlers)
    - Sort toggle buttons (Top / Newest) - active button highlighted
    - LoadingSpinner if loading
    - ErrorMessage if error
    - Empty state if posts.length === 0 ("No posts found")
    - posts.map(post => PostCard with key, post, onVoteChange)
    - Pagination (currentPage, totalPages, onPageChange)
  - Style with Tailwind: container max-w, grid for posts (1 col mobile, 2 col tablet, 3 col desktop)

- **client/src/pages/PostDetail.jsx**
  - Use useParams to get postId
  - State: post, loading, error, statusFormData (for admin), saving
  - **useEffect**: Fetch GET /api/posts/:id on mount
  - **onVoteChange handler**: Update local post state (voteCount, hasVoted)
  - **onStatusChange handler** (admin only): PATCH /api/posts/:id/status with status and adminReply, on success update local post state
  - Render:
    - LoadingSpinner if loading
    - ErrorMessage if error
    - Full post display: title, CategoryTag, StatusBadge, description (full text), author name, timestamp, VoteButton
    - If post.adminReply exists: styled box with "Admin Reply:" heading and reply text
    - **If current user is admin**: form with status dropdown (all 4 statuses), textarea for adminReply, Save button (calls onStatusChange)
    - **If current user is post author**: Edit button (navigate to /posts/:id/edit), Delete button (confirm, call DELETE /api/posts/:id, navigate to /)
  - Style with Tailwind: centered container, card layout

- **client/src/pages/CreatePost.jsx**
  - Protected route (wrapped in ProtectedRoute in App.jsx)
  - State: formData (title, description, category), loading, error
  - Form with: title input, description textarea, category dropdown (feature/bug/improvement)
  - **onSubmit**: POST /api/posts via axios, on success navigate to /posts/:newPostId or /
  - Show loading state and validation errors
  - Style with Tailwind: form layout, labeled inputs

- **client/src/pages/EditPost.jsx**
  - Protected route
  - Use useParams to get postId
  - State: formData, loading, error, post
  - **useEffect**: Fetch post, check if req.user is author (if not, redirect to / or show error)
  - Prepopulate form with post data
  - **onSubmit**: PUT /api/posts/:id, on success navigate to /posts/:id
  - Style with Tailwind: same as CreatePost

#### 3. App Routes Update

- **client/src/App.jsx** (modify)
  - Add routes for FeedbackBoard (/), PostDetail (/posts/:id), CreatePost (/posts/create with ProtectedRoute), EditPost (/posts/:id/edit with ProtectedRoute)

### Verification

1. Ensure backend and frontend running
2. Open http://localhost:5173 - FeedbackBoard displays with sample posts
3. Test search: type keyword, submit - posts filter
4. Test category filter: select Feature - only feature posts show
5. Test status filter: select Open - only open posts show
6. Test sort: click Top - posts order by voteCount desc; click Newest - order by date
7. Test pagination: click Next - loads next page
8. Test voting: click vote button - count increments, button highlights
9. Vote again - count decrements, button unhighlights
10. Stop backend, try to vote - error message shows, UI rolls back
11. Restart backend, vote - works again
12. Click post card - navigate to PostDetail
13. On PostDetail: see full post, vote button works
14. Login as admin, view post - see status dropdown and adminReply textarea
15. Change status to 'planned', add reply, save - post updates
16. Refresh page - status and reply persist
17. Login as post author, view post - see Edit and Delete buttons
18. Click Edit - navigate to EditPost with prepopulated form
19. Update title, save - redirects to PostDetail with new title
20. Click Delete, confirm - deletes post, redirects to home
21. Click Create Post in navbar - navigate to CreatePost
22. Fill form, submit - creates post, redirects to detail or home
23. Resize browser to mobile - verify responsive layout (filters stack, posts single column, navbar hamburger menu)

---

## FEAT-005: Roadmap & Documentation

**Purpose**: Complete the Roadmap visualization page, perform full integration testing, write comprehensive README, and final polish.

### Files to Create/Modify

#### 1. Roadmap Page

- **client/src/pages/Roadmap.jsx**
  - State: roadmap ({ planned: [], inProgress: [], shipped: [] }), loading, error
  - **useEffect**: Fetch GET /api/roadmap on mount
  - Render three-column layout:
    - Column 1: "Planned" heading, map roadmap.planned to PostCard (simplified: no vote button or read-only count)
    - Column 2: "In Progress" heading, map roadmap.inProgress
    - Column 3: "Shipped" heading, map roadmap.shipped
  - **Responsive**: Desktop: 3 columns side-by-side (grid or flex), Mobile: stacked vertically
  - Style with Tailwind: each column has distinct background color (light blue, yellow, green), padding, min-height to prevent collapse when empty
  - Empty state for each column: "No posts in this stage"

- **client/src/App.jsx** (modify)
  - Add route /roadmap → Roadmap (public)

#### 2. Documentation

- **README.md** (project root)
  - **Title**: FeedbackBoard
  - **Description**: A feedback and roadmap board built with the MERN stack. Users can submit feature requests, upvote them, and admins can manage post status through a visual roadmap.
  - **Features**:
    - User registration and authentication (JWT)
    - Create, edit, delete feedback posts
    - Upvote posts with optimistic UI and rollback on error
    - Search and filter posts by category, status
    - Sort by top (most votes) or newest
    - Admin-only status management with replies
    - Roadmap visualization (Planned, In Progress, Shipped)
    - Responsive design for mobile, tablet, desktop
  - **Tech Stack**:
    - Backend: Node.js, Express, MongoDB, Mongoose, JWT, bcrypt
    - Frontend: React, Vite, React Router, Axios, Tailwind CSS
  - **Prerequisites**: Node.js 14+, MongoDB 4+
  - **Installation**:
    1. Clone repository
    2. Install server dependencies: `cd server && npm install`
    3. Install client dependencies: `cd client && npm install`
    4. Setup environment variables:
       - Copy `server/.env.example` to `server/.env` and fill in values
       - Copy `client/.env.example` to `client/.env` with VITE_API_URL
  - **Database Setup**:
    - Start MongoDB locally (mongod) or use MongoDB Atlas
    - Seed database: `cd server && npm run seed`
  - **Running the Application**:
    - Start backend: `cd server && npm run dev` (runs on port 5000)
    - Start frontend: `cd client && npm run dev` (runs on port 5173)
    - Open http://localhost:5173 in browser
  - **Default Admin Account**:
    - Email: admin@feedbackboard.com
    - Password: Admin123!
  - **Project Structure**:
    - /server: backend code (config, models, controllers, routes, middleware, utils)
    - /client: frontend code (src/components, pages, context, api, hooks)
  - **API Endpoints Summary**:
    - POST /api/auth/register - register user
    - POST /api/auth/login - login user
    - GET /api/auth/me - get current user
    - GET /api/posts - get all posts (with filters)
    - GET /api/posts/:id - get single post
    - POST /api/posts - create post (auth)
    - PUT /api/posts/:id - update post (auth, author only)
    - DELETE /api/posts/:id - delete post (auth, author or admin)
    - PATCH /api/posts/:id/status - update status (admin only)
    - POST /api/posts/:id/vote - toggle vote (auth)
    - GET /api/roadmap - get roadmap data
  - **Future Enhancements** (optional):
    - Real-time updates with Socket.io
    - Email notifications
    - Image uploads for posts
    - Analytics dashboard for admins
  - **AI Development Experience**: [Placeholder section - describe the experience of building this with AI assistance, challenges faced, and learnings]

#### 3. Integration Testing

Perform comprehensive end-to-end testing:

1. **Fresh start**: Drop database collections, run seed script, start backend, start frontend
2. **User journey**: 
   - Register new user → verify user created with role 'user'
   - Login → verify token saved, user state populated
   - Browse posts → verify all posts display with vote counts
   - Search posts → verify filtering works
   - Filter by category → verify correct posts show
   - Sort by Top → verify order by votes
   - Paginate → verify page navigation
   - Vote on post → verify optimistic update, count increments, button highlights
   - Vote again → verify count decrements
   - Create post → verify post created, appears in list
   - Edit own post → verify update works
   - Try to edit another user's post → verify 403 error or redirect
   - Delete own post → verify post deleted, votes deleted
   - Logout → verify token cleared
3. **Admin journey**:
   - Login as admin@feedbackboard.com / Admin123!
   - View post detail → verify status dropdown and adminReply textarea visible
   - Change status to 'planned', add reply → verify update
   - Verify post appears in Planned column on roadmap
   - Change status to 'in-progress' → verify moves to In Progress column
   - Change to 'shipped' → verify moves to Shipped column
   - Delete another user's post → verify allowed
4. **Edge cases**:
   - Invalid token: corrupt localStorage token, visit protected route → verify redirect to login
   - Unauthorized actions: try to edit another user's post → verify 403
   - Validation errors: submit forms with invalid data → verify error messages
   - Vote during network failure: stop backend, try to vote → verify error and rollback
5. **Responsive design**: Resize browser to mobile, tablet, desktop breakpoints → verify layout adapts

#### 4. Bug Fixes & Polish

- Address any issues found during integration testing
- Remove console.logs used for debugging
- Add comments to non-obvious logic:
  - Vote toggle with duplicate key error handling in voteController.js
  - hasVoted computation in postController.js
  - Optimistic voting with rollback in VoteButton.jsx
  - AuthContext token validation on mount
- Ensure all error messages are user-friendly
- Verify all loading states work correctly
- Check for console errors or warnings (fix them)
- Ensure all forms have validation feedback
- Verify vote count accuracy after multiple toggles
- Confirm JWT persistence across page refreshes
- Test navigation between all pages
- Ensure admin controls only visible to admins
- Verify post author controls only visible to authors

#### 5. Final Verification

Run through all acceptance criteria from previous FEATs:

**Backend**:
- All endpoints return correct status codes (200, 201, 400, 401, 403, 404, 500)
- Error format is consistent: { success: false, message, errors? }
- Auth middleware verifies JWT, returns 401 for invalid
- Admin middleware returns 403 for non-admins
- Input validation returns 400 with errors array
- Vote toggle handles duplicate key error gracefully
- hasVoted computed correctly for authenticated users
- Roadmap groups posts correctly by status

**Frontend**:
- All pages render without errors
- All components styled with Tailwind
- Auth flow works: register, login, logout, persistence
- Protected routes redirect to login when not authenticated
- Admin routes redirect when not admin
- Optimistic voting works with rollback on error
- Search, filter, sort, pagination work correctly
- Admin controls conditional on role
- Post author controls conditional on ownership
- Responsive design works on mobile, tablet, desktop
- No console errors or warnings

### Verification

1. Drop database collections or use fresh DB
2. Run `cd server && npm run seed`
3. Start backend: `cd server && npm run dev`
4. Start frontend: `cd client && npm run dev`
5. Open http://localhost:5173/roadmap - see three columns with posts from seed data
6. Navigate to home - see posts with vote buttons
7. Test complete user flow (register → login → create → vote → edit → delete → logout)
8. Test admin flow (login as admin → change status → verify roadmap)
9. Test edge cases (invalid token, unauthorized actions, validation errors, network failure)
10. Test responsive design (resize browser)
11. Check browser console for errors - should be none
12. Check terminal for backend errors - should be none except validation failures
13. Read README.md - follow setup instructions on fresh checkout to verify completeness
14. Verify all original requirements implemented and working

---

## Summary

This plan decomposes the FeedbackBoard application into 5 major features:

1. **Backend Infrastructure & Auth** - Server setup, models, JWT auth, middleware, seed data
2. **Posts & Voting API** - CRUD endpoints, vote toggle logic, roadmap endpoint
3. **Client Infrastructure & Auth** - React setup, routing, Axios, AuthContext, auth pages
4. **Feedback Board UI** - Main board with posts, voting, filters, post detail, create/edit pages
5. **Roadmap & Documentation** - Roadmap visualization, integration testing, README, final polish

Each feature is independently verifiable and builds upon the previous ones. The implementation follows best practices: JWT authentication, optimistic UI with rollback, proper error handling, responsive design, and beginner-readable code.

**Key implementation notes**:
- Vote toggle uses $inc for atomic updates and handles duplicate key errors from compound unique index
- hasVoted computed in getPosts by checking Vote collection for authenticated users
- Optimistic voting in VoteButton with rollback on failure
- AuthContext validates token on mount for seamless refresh persistence
- Admin controls conditionally rendered based on user.role
- Centralized error handling with consistent JSON format
- Protected routes and admin routes properly redirect
- Search uses case-insensitive regex, filters build mongoose query, sort and pagination supported

The final application will be production-ready with proper authentication, authorization, data validation, error handling, and a polished user experience.

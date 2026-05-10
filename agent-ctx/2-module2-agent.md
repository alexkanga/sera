---
Task ID: 2
Agent: Module 2 Agent
Task: Create Directions CRUD API routes

Work Log:
- Read worklog.md to understand project context (Module 1 verified, Neon PostgreSQL, RBAC system)
- Read existing Users API routes to understand patterns and conventions
- Read Prisma schema to understand Direction model: id, code, name, description, headUserId, isActive, deletedAt, createdAt, updatedAt
- Read permissions.ts to understand auth/permission helpers
- Created /api/directions/route.ts with GET and POST handlers
- Created /api/directions/[id]/route.ts with GET, PUT, and PATCH handlers
- Ran lint check — no errors
- Dev server running successfully

Files Created:
1. /home/z/my-project/src/app/api/directions/route.ts
   - GET /api/directions: List directions with org:read permission, filters (search, status, includeUnits), pagination, default active only
   - POST /api/directions: Create direction with org:create permission, Zod validation, unique code check, audit log

2. /home/z/my-project/src/app/api/directions/[id]/route.ts
   - GET /api/directions/[id]: Get single direction with headUser and units, org:read permission
   - PUT /api/directions/[id]: Update direction with org:update permission, Zod validation, unique code check, cannot update archived, audit log with oldValue/newValue
   - PATCH /api/directions/[id]: Archive/Restore with org:archive permission, action: "archive"|"restore", audit log

Patterns Followed (from existing Users API):
- Same imports: NextRequest, NextResponse, db, getCurrentUser, userHasPermission, zod
- Same auth pattern: check currentUser, then userHasPermission
- Same error response format: { error: "message" } with appropriate status codes
- Same pagination format: { data, pagination: { page, limit, total, totalPages } }
- Same audit log format: userId, action, entity, entityId, oldValue, newValue, details
- Same archive/restore pattern: PATCH with action field, soft delete via deletedAt + isActive
- Same Zod validation and error handling
- French error messages throughout

---
Task ID: 3
Agent: Module 2 Agent
Task: Create Units CRUD API routes

Work Log:
- Read worklog.md to understand project context (Module 1 already complete with Users/Roles/Permissions/Audit APIs)
- Studied existing Users API routes at /api/users/route.ts and /api/users/[id]/route.ts for patterns
- Reviewed Prisma schema for Unit model (id, code, name, description, directionId, headUserId, isActive, deletedAt, createdAt, updatedAt)
- Reviewed permissions.ts for getCurrentUser/userHasPermission patterns
- Created /api/units/route.ts with GET (list with filters) and POST (create with validation)
- Created /api/units/[id]/route.ts with GET (detail), PUT (update), PATCH (archive/restore)
- Ran lint check — no errors ✅

Patterns followed:
- Same import structure: NextRequest/NextResponse, db, getCurrentUser/userHasPermission, zod
- Same error response format: { error: string } with appropriate status codes
- Same pagination: page/limit with total/totalPages
- Same audit log: userId, action, entity, entityId, oldValue, newValue, details
- Same archive pattern: PATCH with { action: "archive" | "restore" }, soft delete via deletedAt + isActive
- Same Zod validation and error handling
- Same permission prefix pattern: org:read, org:create, org:update, org:archive
- Same French error messages consistent with the rest of the app

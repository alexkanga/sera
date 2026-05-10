# Task: Audit Logs Section Component

## Summary
Created the complete `audit-logs-section.tsx` component for the AAEA Pilotage 360 application.

## What was built
- **File**: `/home/z/my-project/src/components/sections/audit-logs-section.tsx`
- **Component**: `AuditLogsSection`

## Features implemented

### Header
- Title: "Journal d'audit"
- Description: "Traçabilité de toutes les actions sensibles dans l'application"

### Stats Row
- Total entries count
- Current page / total pages
- Active entity filter display
- Active action filter display

### Filters Row
- Entity dropdown (User, Role, Permission, Activity, Direction, Unit, StrategicAxis, AcbfDomain, AcbfDeliverable, Setting)
- Action dropdown (CREATE, UPDATE, ARCHIVE, RESTORE, DELETE, LOGIN, LOGOUT, LOCK, UNLOCK, PASSWORD_CHANGE, ROLE_ASSIGN, ROLE_REMOVE, PERMISSION_CHANGE)
- User text search filter
- Start date picker (with clear button)
- End date picker (with clear button)
- "Réinitialiser les filtres" button (shows only when filters active)

### Table
- Fetches from `/api/audit-logs` with all applicable query params
- Columns: Date/Heure, Utilisateur, Action, Entité, ID Entité, Détails
- Action badges with color coding:
  - CREATE → emerald/green
  - UPDATE → teal
  - ARCHIVE → amber/orange
  - RESTORE → emerald
  - DELETE → red
  - LOGIN → emerald
  - LOGOUT → slate
  - LOCK → red
  - UNLOCK → emerald
  - PASSWORD_CHANGE → amber
  - ROLE_ASSIGN → teal
  - ROLE_REMOVE → amber
  - PERMISSION_CHANGE → teal
- Date format: dd/MM/yyyy HH:mm
- Collapsible details section for UPDATE actions showing "Ancien → Nouveau" (oldValue → newValue) with color-coded code blocks
- Smart pagination with ellipsis for many pages

### Permission Check
- Uses `useSession` from next-auth/react
- Checks for `audit:read`, `audit:*`, or `admin:*` permissions
- Shows "Accès refusé" message with red icon if no permission

### States handled
- Loading: Skeleton placeholders
- Error: Error message with retry button
- Empty: Context-aware message (different for filtered vs no data)
- Toast notifications via sonner

## Lint: ✅ Passes cleanly
## TypeScript: No errors from component (errors are from node_modules only)

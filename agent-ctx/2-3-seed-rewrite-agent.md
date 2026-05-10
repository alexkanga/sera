# Task 2-3: Seed Rewrite Agent

## Task
Rewrite `prisma/seed.ts` to read data from the Excel file at `upload/20260506 PTA_Master_AAEA_2026.xlsx` instead of using hardcoded data.

## What Was Done

### Analysis Phase
- Read the existing `prisma/seed.ts` (455 lines, hardcoded data)
- Read the Prisma schema (all models: User, Role, Permission, Direction, Unit, StrategicAxis, AcbfDomain, AcbfDeliverable, Activity, etc.)
- Inspected the Excel file structure: 37 sheets total, 5 key data sheets
- Verified column names, data formats, unique values for each sheet

### Implementation Phase
Completely rewrote `prisma/seed.ts` with:

1. **Imports**: Added `import * as XLSX from 'xlsx'` and `import path from 'path'`

2. **Helper Functions** (8 new functions):
   - `removeAccents()` — normalizes strings for email generation
   - `generateEmail()` — "François Olivier Gosso" → "f.gosso@aaea.org"
   - `mapRole()` — position-based role mapping (DIRECTEUR, MEAL, RESPONSABLE, LECTEUR)
   - `mapDirectionCode()` — department → direction code mapping
   - `mapAcbfDomainCode()` — "ACBF-01" → "ACBF1"
   - `mapAxeCode()` — "AXE 1" → "AXE1"
   - `parseProgressRate()` — handles "0", "50%", etc.
   - `parseExcelDate()` — handles both string and Excel serial date numbers
   - `findUserByValidatorName()` — matches validator names to user positions

3. **Data Flow** (9 sections):
   - Section 0: Read Excel file (new)
   - Section 1: Hardcoded permissions (preserved)
   - Section 2: Hardcoded roles (preserved)
   - Section 3: Directions from Equipe AAEA sheet (was hardcoded)
   - Section 4: Strategic axes from Axes strategiques sheet (was hardcoded)
   - Section 5: ACBF domains + deliverables from Referentiel ACBF sheet (was hardcoded)
   - Section 6: Team members from Equipe AAEA sheet (was hardcoded)
   - Section 7: Super admin (preserved)
   - Section 8: Fantomas account (preserved)
   - Section 9: **275 activities from PTA consolide AAEA sheet (NEW)**

4. **Activity Field Mapping**:
   - `N°` → activityCode
   - `Code PTA` → responsibleId (via ptaCode lookup)
   - `Activité PTA concrète` → title
   - `Nature de l'activité` → nature
   - `Axe stratégique principal` → primaryAxisId
   - `Axe(s) secondaire(s)` → secondaryAxisId (first one)
   - `Domaine ACBF` → acbfDomainId (by name match)
   - `Livrable ACBF associé` → acbfDeliverableId (by name match)
   - `Objectif annuel` + `Bloc / objectif fonctionnel` → annualObjective
   - `Tâches détaillées` → detailedTasks
   - `Livrable attendu` → expectedDeliverable
   - `Validateur` → validatorId (by position/name match)
   - `Contributeur(s)` + `Lien ACBF` + `Commentaires` → comments
   - Date fields parsed with Excel serial date support
   - All activities start with validationStatus = "Brouillon"

5. **Idempotent Pattern**: Uses findUnique + create throughout (can run seed multiple times)

### Verification
- `bun run lint` — ✅ No errors
- Dev server running without errors — ✅
- Excel file read successfully (28 members, 5 axes, 72 deliverables, 275 activities confirmed)

## Key Decisions
- Used `import * as XLSX` instead of default import (module compatibility)
- Used Array.from() for Map iterations (TypeScript compatibility)
- Direction mapping uses ptaCode-based lookup table instead of DB query for better performance
- Partial name matching fallback for ACBF domain/deliverable lookups
- Validator matching uses a hardcoded position map with fallback to partial matching

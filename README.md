# Fellowship Operations Admin Portal — Deployment Guide (v1.0.6)

This repository contains the administrative portal and internal operations system for the **Sankara Academy of Vision Fellowship Program**.

---

## 🛠️ Step-by-Step Server Update Instructions

To deploy this release (v1.0.6) on the production server without disrupting existing databases or data records, follow this exact sequence:

### 1. File Sync / Extraction
1. Extract the uploaded codebase zip file into the main application directory on the server, overwriting the existing folder structure.
2. Ensure you preserve your production `.env` files (both in the backend root and the frontend if applicable).

### 2. Dependency Installation
Run the package installation from the root directory:
```bash
pnpm install
```
*(or `npm install` / `yarn install` depending on your global package manager)*

### 3. Safe Database Schema Synchronization
There is **only one** database change in this release: the addition of the new **`doctor_panel_status`** table in `panels.ts`.

To apply this change safely **WITHOUT touching or losing any existing tables or data**:
1. Navigate to the database package folder on the server:
   ```bash
   cd lib/db
   ```
2. Run the safe drizzle-push command:
   ```bash
   pnpm run push
   ```
   *Drizzle ORM will analyze the diff, identify that `doctor_panel_status` is a new table, and safely create it without affecting any other candidate, exam, user, or payment records.*

### 4. Build Client Applications
1. Recompile the production frontend build:
   ```bash
   pnpm --filter @workspace/fellowship-exam run build
   ```
   *(or from `artifacts/fellowship-exam` run `npm run build`)*
2. Compile any backend servers if you use typescript transpilation there.

### 5. Server Restart
Restart the server process (e.g., using `pm2`):
```bash
pm2 restart all
```

---

## 📋 Database Schema Changes in v1.0.6

This release adds the following table to track active doctor engagement states:

```sql
CREATE TABLE "doctor_panel_status" (
  "id" SERIAL PRIMARY KEY,
  "doctor_id" INTEGER NOT NULL UNIQUE REFERENCES "users"("id"),
  "is_engaged" BOOLEAN NOT NULL DEFAULT false,
  "engaged_since" TIMESTAMP WITH TIME ZONE,
  "current_candidate_id" INTEGER REFERENCES "candidates"("id"),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

---

## 💎 Features & Visual Polish in v1.0.6

1. **Antigravity-Style Stardust Login**:
   * Removed overcrowded Vanta.js net lines.
   * Minimalist drifting cosmic particles floating behind card.
   * Fixed 100% full screen visibility with zero scrollbars.
2. **Attribution & Footer Updates**:
   * Bottom Footer updated to: `Sri Kanchi Kamakoti Medical Trust, Sankara Eye Hospitals, India` and `Developed by Information Systems, Sankara Eye Hospital`.
3. **Double Application Merging & Postgres Bracket Parsing**:
   * Brackets `{}` and JSON formatting are automatically cleaned.
   * Centers and specialty associations displayed correctly in reviews.
4. **Auto-JPEG Passports & QR redirectional Gates**:
   * Auto-conversion of broken PNG transparency to base64 JPEGs.
   * LOR 1 & 2 secure authentication redirection portals.
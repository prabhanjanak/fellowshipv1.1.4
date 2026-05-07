# Database Implementation & Migration Guide

This document provides a comprehensive, step-by-step guide for implementing, managing, and migrating the Fellowship Exam System database. It is intended for senior developers and system administrators.

## 1. Architecture Overview

The application uses **PostgreSQL** as the primary database, with **Drizzle ORM** for schema definition, type safety, and migrations.

- **Dialect:** PostgreSQL
- **ORM:** Drizzle ORM
- **Driver:** `node-postgres` (pg)
- **Schema Location:** `lib/db/src/schema/*.ts`
- **Connection Logic:** `lib/db/src/index.ts`

---

## 2. Local Development Setup

### Prerequisites
- PostgreSQL 14+ installed locally.
- `pnpm` installed.

### Step-by-Step Implementation
1. **Provision Database:**
   Create a new database named `sankara_fellowship` (or as preferred).
   ```sql
   CREATE DATABASE sankara_fellowship;
   ```

2. **Environment Variables:**
   Update your `.env` file in the root directory with the local connection string:
   ```env
   DATABASE_URL=postgresql://<user>:<password>@localhost:5432/sankara_fellowship
   ```

3. **Install Dependencies:**
   ```bash
   pnpm install
   ```

4. **Generate & Push Schema:**
   Drizzle allows you to "push" changes directly for rapid development:
   ```bash
   pnpm --filter @workspace/db drizzle-kit push
   ```

---

## 3. Database Schema Reference

The database is divided into logical modules:
- **`users.ts`**: Admin and coordinator accounts.
- **`candidates.ts`**: Applicant profile data.
- **`application-forms.ts`**: Fellowship application submissions.
- **`exams.ts` & `units.ts`**: Exam scheduling and organizational structure.
- **`payment-settings.ts`**: Razorpay configurations.

You can find the full TypeScript definitions in: `lib/db/src/schema/`

---

## 4. Migrating Local Data to Server (Production)

To push your local database state (including data) to the server, follow these steps:

### Method A: Using the Automated Script (Recommended)

We have provided a PowerShell script to automate the `pg_dump` and `pg_restore` process.

1. **Location:** `scripts/push_local_to_server.ps1`
2. **Configuration:** Open the script and edit the `$Remote...` variables with the server's credentials.
3. **Execution:**
   ```powershell
   .\scripts\push_local_to_server.ps1
   ```

### Method B: Manual CLI Commands

If you prefer manual control:

1. **Dump Local Data:**
   ```bash
   pg_dump -h localhost -U postgres -d fellowship_db -Fc -f local_backup.dump
   ```

2. **Restore to Server:**
   ```bash
   pg_restore -h <SERVER_IP> -U <SERVER_USER> -d <SERVER_DB_NAME> --clean --no-owner --no-acl local_backup.dump
   ```

---

## 5. Server Side Configuration

Once the database is pushed, ensure the server's `.env` is updated:

1. **SSH into Server.**
2. **Update `.env`:**
   ```env
   DATABASE_URL=postgresql://<server_user>:<server_password>@localhost:5432/<server_db_name>
   ```
3. **Restart API Server:**
   ```bash
   pm2 restart fellowship-api
   ```

---

## 6. Maintenance & Backups

### Nightly Backups (Server)
Add a cron job to the server to perform daily backups:
```bash
crontab -e
# Add this line for 2 AM daily backup
0 2 * * * pg_dump -U sankara -d sankara_fellowship -Fc -f /var/backups/db_$(date +\%F).dump
```

---

## Troubleshooting
- **Connection Refused:** Ensure PostgreSQL is configured to allow remote connections (`pg_hba.conf`) if restoring from a remote machine.
- **Drizzle Sync:** If the schema seems out of sync, run `pnpm --filter @workspace/db drizzle-kit check` to verify consistency.

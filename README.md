# Sankara Academy of Vision: Fellowship Examination & Admission Portal (v1.0.1)

A professional, end-to-end web platform designed to completely digitize and manage the lifecycle of Fellowship programs at the **Sankara Academy of Vision**.

---

## 🌟 Complete Project Overview
This platform consolidates all admission operations into a unified portal:
- **Public Candidate Portal**: Allows candidates to sign up, securely pay the application fee via Razorpay, fill out comprehensive multi-step forms, and take proctored online entrance exams.
- **Dynamic Form Builder**: A built-in drag-and-drop form engine (similar to Google Forms) supporting Checkboxes, Dropdowns, Radio buttons, File uploads, and custom data validations.
- **Real-Time Interview Queue (TV Portal)**: A secure, live-updating digital display board (`/tv`) intended for waiting halls. It directs candidates to available interview panels dynamically. Protected by a 6-character admin-generated access code.
- **Smart Seat Allocation**: An intelligent allocation algorithm that maps candidates to their preferred hospital units based on their final merit ranking and category.
- **Automated Communication**: A built-in SMTP mailer that automatically fires personalized emails for registration, interview call letters, and final admission offers.
- **Administrative PDF Exporting**: Advanced data-table exports allowing coordinators to download a pixel-perfect, printer-friendly PDF dossier of any candidate.

## 🛠️ Technology Stack
- **Frontend**: React (Vite), TailwindCSS, Lucide Icons, Recharts (for Analytics).
- **Backend**: Node.js (Express), TypeScript.
- **Database**: PostgreSQL structured with Drizzle ORM.
- **State Management**: React Query (TanStack) & Context API.
- **Mobile**: Expo React Native mobile shell (included in `/sankara-mobile-app`).

---

## 📦 Project Directory Structure
- `/artifacts/fellowship-exam`: The main frontend React (Vite) application.
- `/artifacts/api-server`: The backend Express API service.
- `/lib/db`: Shared database schema and Drizzle configurations.
- `/sankara-mobile-app`: Expo React Native mobile wrapper.

---

## ⚙️ Environment Variables (.env)
The environment variables must be created securely on your server. **Do not overwrite existing production variables!** Note: SMTP settings are *no longer* required in the `.env` as they are now configured directly from the admin dashboard.

**Backend (`artifacts/api-server/.env`):**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/fellowship_db
PORT=3002
# (SMTP settings have been migrated to the Admin UI)
```

**Frontend (`artifacts/fellowship-exam/.env`):**
```env
VITE_API_URL=https://your-server.com/api
```

---

## 🔧 Admin Post-Deployment Configuration
After deploying, the Super Admin must log into the portal to configure the following dynamic settings:
1. **Email/SMTP Configuration**: Navigate to **Email Settings** in the sidebar. Input the Gmail/SMTP credentials here to instantly activate system-wide automated emails.
2. **TV Dashboard Security**: Navigate to the **Dashboard** and click **TV Access Code**. Use this code to authorize public waiting hall screens.
3. **Razorpay Payments**: Configure the API Key and Secret directly in the **Payments** tab.

---

## 🔄 Deployment & Update Process (In-Place Update)

**CRITICAL SAFEGUARD**: The update process must be executed **WITHOUT** destroying or recreating existing application data. Do not alter users, applications, or candidate data. The server deployment acts as a safe, rolling update.

Follow these instructions to safely deploy updates on the live server:

### Step 1: Secure Data Backup
Before pulling updates, ensure you have backed up the PostgreSQL database and the `uploads/` directory.
```bash
pg_dump -U postgres -d fellowship_db > fellowship_db_backup_pre_update.sql
tar -czvf uploads_backup.tar.gz artifacts/api-server/uploads
```

### Step 2: Pull Latest Code
Navigate to the root directory of the application and pull the latest changes from the `v1.0.1` branch or `main`.
```bash
git pull origin main
```

### Step 3: Install & Update Dependencies
Navigate to both the backend and frontend folders and run NPM installs.
```bash
# Update backend
cd artifacts/api-server
npm install

# Update frontend
cd ../fellowship-exam
npm install
```

### Step 4: Run Safe Database Migrations
Drizzle ORM automatically handles "If Not Exists" schema setups. You can safely restart the Node server which has an auto-migration script bundled at startup (in `index.ts`). **Never run hard resets** (`npm run db:push` / `db:reset`) on the live DB.

### Step 5: Build the Frontend
Re-bundle the frontend React code for production serving.
```bash
cd artifacts/fellowship-exam
npm run build
```

### Step 6: Restart Process Managers
If using PM2, restart the services to load the updated Javascript code into memory.
```bash
pm2 restart fellowship-api
pm2 restart fellowship-frontend
```

### Step 7: Verify Application Status
1. Navigate to your live URL.
2. Confirm the frontend loads correctly.
3. Verify the new UI changes (Form Builder, PDF exports, TV Access Code).

### Step 8: Rollback Protocol (If Required)
If an update causes issues, revert the codebase using Git and restore the database from the backup generated in Step 1.
```bash
git checkout HEAD~1
pm2 restart all
# If database was corrupted (rare):
psql -U postgres -d fellowship_db -f fellowship_db_backup_pre_update.sql
```
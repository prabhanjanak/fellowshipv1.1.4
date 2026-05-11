# Fellowship Examination & Admission Portal (v1.0.1)

A professional, end-to-end management system for Fellowship programs, specifically tailored for the **Sankara Academy of Vision**.

## 🚀 Newly Added Features & Modules (v1.0.1)
- **Advanced Dynamic Form Builder:** Build application forms visually with Dropdowns, Checkboxes, Paragraphs, Radio buttons, and native options.
- **Enhanced Application PDF Exports:** Administrative dashboard now supports exporting pixel-perfect Application PDFs seamlessly.
- **Smart Auto-Allocate:** Automatic seat allocation logic based on merit, exam performance, and center preferences.
- **Secure Waiting Hall TV Portal:** The `/tv` interview display board is now secured behind a 6-character access code which can be managed directly in the dashboard by super admins.
- **Sankara Mobile App Shell:** Initial React Native (Expo) boilerplate wrapper generated in the repository for mobile portal testing.
- **Integrated Email SMTP Templates:** Pre-configured environment placeholders to directly tie SMTP keys to node-mailer.

## 📦 Project Structure
- `/artifacts/fellowship-exam`: The main frontend React (Vite) application.
- `/artifacts/api-server`: The backend Express API service.
- `/lib/db`: Shared database schema and Drizzle configurations.
- `/sankara-mobile-app`: Expo React Native mobile wrapper.

## ⚙️ Environment Variables (.env)
The environment variables must be created securely on your server. **Do not overwrite existing variables!**

**`artifacts/api-server/.env`:**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/fellowship_db
PORT=3002
```

**`artifacts/fellowship-exam/.env`:**
```env
VITE_API_URL=https://your-server.com/api
```

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
3. Test a backend route (like `/api/health` or loading candidates).
4. Verify the new UI changes (Form Builder, PDF exports, TV Access Code).

### Step 8: Rollback Protocol (If Required)
If an update causes issues, revert the codebase using Git and restore the database from the backup generated in Step 1.
```bash
git checkout HEAD~1
pm2 restart all
# If database was corrupted (rare):
psql -U postgres -d fellowship_db -f fellowship_db_backup_pre_update.sql
```

## 📧 Email & SMTP Settings
The application features a built-in UI for managing email credentials.
- Log in to the application as a `super_admin` or `program_admin`.
- Navigate to **Email Settings** from the sidebar.
- Enter your SMTP details (Host, Port, User, App Password, etc.).
- Save and test the connection right from the dashboard! No need to reboot the server or modify `.env` files.

## 📺 Waiting Hall TV Display Security
The live interview queue can be accessed at the `/tv` route.
- It requires an active **6-character Access Code**.
- Generate and view this code inside the Admin Dashboard by clicking the "TV Access Code" button.
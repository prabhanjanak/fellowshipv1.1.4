import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Correct bcrypt hash for Saravanan@2026 — used to normalise both dev and prod
const SARAVANAN_PASSWORD_HASH = "$2b$10$tzKB/Dj.bn.MPCUj5GJQz.V6.ijFrypzqkwSjMW458ni7dCAx0MuS";

async function runStartupFixes() {
  // Migration: add new columns if they don't exist
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS designation TEXT`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_seed TEXT`);

  // Migration: create seat_matrix_entries table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS seat_matrix_entries (
      id SERIAL PRIMARY KEY,
      speciality TEXT NOT NULL,
      unit_name TEXT NOT NULL,
      total_seats INTEGER NOT NULL DEFAULT 0,
      allocated_seats INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Migration: add program_id column to seat_matrix_entries
  await db.execute(sql`ALTER TABLE seat_matrix_entries ADD COLUMN IF NOT EXISTS program_id INTEGER REFERENCES programs(id)`);
  await db.execute(sql`ALTER TABLE seat_matrix_entries DROP CONSTRAINT IF EXISTS seat_matrix_entries_speciality_unit_name_key`);
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seat_matrix_entries_prog_spec_unit_key') THEN
        ALTER TABLE seat_matrix_entries ADD CONSTRAINT seat_matrix_entries_prog_spec_unit_key UNIQUE (program_id, speciality, unit_name);
      END IF;
    END $$
  `);
  await db.execute(sql`
    UPDATE seat_matrix_entries SET program_id = (SELECT id FROM programs ORDER BY id LIMIT 1) WHERE program_id IS NULL
  `);

  // Migration: create payment_settings table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payment_settings (
      id SERIAL PRIMARY KEY,
      program_id INTEGER,
      razorpay_key_id TEXT,
      razorpay_key_secret TEXT,
      amount INTEGER NOT NULL DEFAULT 275000,
      currency TEXT NOT NULL DEFAULT 'INR',
      description TEXT NOT NULL DEFAULT 'Fellowship Application Fee',
      mode TEXT NOT NULL DEFAULT 'test',
      upi_id TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Migration: add upi_id column if missing (for existing tables)
  await db.execute(sql`ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS upi_id TEXT`);

  // Migration: custom fields on application_forms
  await db.execute(sql`ALTER TABLE application_forms ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '[]'::jsonb`);

  // Migration: custom answers on application_submissions
  await db.execute(sql`ALTER TABLE application_submissions ADD COLUMN IF NOT EXISTS custom_answers JSONB DEFAULT '{}'::jsonb`);

  // Migration: google_forms_config on application_forms
  await db.execute(sql`ALTER TABLE application_forms ADD COLUMN IF NOT EXISTS google_forms_config JSONB DEFAULT NULL`);

  // Migration: source column on application_submissions ('internal' | 'google_forms')
  await db.execute(sql`ALTER TABLE application_submissions ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'internal'`);

  // Migration: ready_for_review flag on application_submissions
  await db.execute(sql`ALTER TABLE application_submissions ADD COLUMN IF NOT EXISTS ready_for_review BOOLEAN NOT NULL DEFAULT FALSE`);

  // Migration: google_forms_response_id for deduplication
  await db.execute(sql`ALTER TABLE application_submissions ADD COLUMN IF NOT EXISTS google_forms_response_id TEXT`);

  // Migration: google_sheets_config on application_forms
  await db.execute(sql`ALTER TABLE application_forms ADD COLUMN IF NOT EXISTS google_sheets_config JSONB DEFAULT NULL`);

  // Migration: google_sheets_row_id for deduplication
  await db.execute(sql`ALTER TABLE application_submissions ADD COLUMN IF NOT EXISTS google_sheets_row_id TEXT`);

  // Migration: add display_operator role to enum (must run outside transaction - best-effort)
  try { await db.execute(sql`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'display_operator'`); } catch (_) { /* already exists */ }

  // Migration: interview_panels table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS interview_panels (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      room_number TEXT NOT NULL,
      program_id INTEGER REFERENCES programs(id),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Migration: interview_panel_members table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS interview_panel_members (
      id SERIAL PRIMARY KEY,
      panel_id INTEGER NOT NULL REFERENCES interview_panels(id) ON DELETE CASCADE,
      doctor_id INTEGER NOT NULL REFERENCES users(id),
      is_main BOOLEAN NOT NULL DEFAULT FALSE,
      UNIQUE(panel_id, doctor_id)
    )
  `);

  // Migration: panel_queue table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS panel_queue (
      id SERIAL PRIMARY KEY,
      panel_id INTEGER NOT NULL REFERENCES interview_panels(id) ON DELETE CASCADE,
      candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
      queue_position INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'waiting',
      called_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(panel_id, candidate_id)
    )
  `);

  // Fix 1: correct old placeholder email → canonical super admin email + password
  const [oldEmail] = await db.select().from(usersTable).where(eq(usersTable.email, "admin@sankaraeye.com"));
  if (oldEmail) {
    await db.update(usersTable)
      .set({ email: "saravanan@sankaraeye.com", passwordHash: SARAVANAN_PASSWORD_HASH })
      .where(eq(usersTable.id, oldEmail.id));
    logger.info("Corrected super admin email + password (admin@ → saravanan@)");
  }

  // Fix 2: ensure password hash is correct even if email was already updated
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, "saravanan@sankaraeye.com"));
  if (existing && existing.passwordHash !== SARAVANAN_PASSWORD_HASH) {
    await db.update(usersTable)
      .set({ passwordHash: SARAVANAN_PASSWORD_HASH })
      .where(eq(usersTable.id, existing.id));
    logger.info("Corrected super admin password hash for saravanan@sankaraeye.com");
  }

  // Migration: add sections_config to application_forms
  await db.execute(sql`ALTER TABLE application_forms ADD COLUMN IF NOT EXISTS sections_config JSONB DEFAULT '[]'::jsonb`);

  const DEFAULT_SECTIONS = [
    {
      id: "instructions",
      title: "Key Instructions",
      description: "Please read the following instructions carefully before proceeding.",
      enabled: true,
      fields: [
        { id: "intro_text", type: "info", label: "Instructions", defaultValue: "1. Candidates can now apply for multiple Sub-specialties in a single application form.\n2. Kindly carry your basic and post-graduate educational certificates, current valid medical registration license and passport - size photograph\n3. Selection process for the fellowship involves a written test (MCQ pattern) and an interview\n4. Application fee of Rs.2750/- can be paid only through online transfer...\n5. The age limit of the applicant to apply for the fellowships is 35 years..." }
      ]
    },
    {
      id: "subspecialty",
      title: "Subspecialty Selection",
      description: "Select the option(s) for which you are applying. You can select more than one.",
      enabled: true,
      fields: [
        { id: "specialization", type: "checkbox_group", label: "Subspecialties", required: true, options: ["Cornea", "Glaucoma", "IOL", "Oculoplasty", "Pediatric Ophthalmology", "Phaco Refractive", "Medical Retina", "Vitreo Retina"], isStandard: true, mapping: "specialization" }
      ]
    },
    {
      id: "units",
      title: "Speciality : Units (Select the preferences)",
      description: "Choose the preferred center for each fellowship.",
      enabled: true,
      fields: [
        { id: "unit_cornea", type: "select", label: "Cornea Preferred Center", options: ["Bangalore", "Coimbatore", "Guntur", "Jaipur", "Shimoga", "Not Applicable"], visibleIf: { field: "specialization", contains: "Cornea" } },
        { id: "unit_glaucoma", type: "select", label: "Glaucoma Preferred Center", options: ["Bangalore", "Coimbatore", "Guntur", "Shimoga", "Not Applicable"], visibleIf: { field: "specialization", contains: "Glaucoma" } },
        { id: "unit_iol", type: "select", label: "IOL Preferred Center", options: ["Anand", "Bangalore", "Guntur", "Hyderabad", "Indore", "Jaipur", "Kanpur", "Krishnankoil", "Ludhiana", "Panvel", "Shimoga", "Varanasi", "Not Applicable"], visibleIf: { field: "specialization", contains: "IOL" } },
        { id: "unit_medical_retina", type: "select", label: "Medical Retina Preferred Center", options: ["Bangalore", "Coimbatore", "Guntur", "Jaipur", "Shimoga", "Not Applicable"], visibleIf: { field: "specialization", contains: "Medical Retina" } },
        { id: "unit_oculoplasty", type: "select", label: "Oculoplasty Preferred Center", options: ["Bangalore", "Coimbatore", "Guntur", "Not Applicable"], visibleIf: { field: "specialization", contains: "Oculoplasty" } },
        { id: "unit_pediatric", type: "select", label: "Pediatric Preferred Center", options: ["Bangalore", "Coimbatore", "Guntur", "Shimoga", "Not Applicable"], visibleIf: { field: "specialization", contains: "Pediatric Ophthalmology" } },
        { id: "unit_phaco", type: "select", label: "Phaco Refractive Preferred Center", options: ["Bangalore", "Not Applicable"], visibleIf: { field: "specialization", contains: "Phaco Refractive" } },
        { id: "unit_vitreo_retina", type: "select", label: "Vitreo Retina Preferred Center", options: ["Bangalore", "Coimbatore", "Guntur", "Shimoga", "Not Applicable"], visibleIf: { field: "specialization", contains: "Vitreo Retina" } },
        { id: "referralSource", type: "select", label: "Where did you hear about this Fellowship?", required: true, options: ["Sankara Website", "Word of Mouth", "Referred by any Faculty or exiting trainee at Sankara", "IJO Advertisement", "Social Media Platforms (Instagram/Facebook/Whatsapp/LinkedIn)"], isStandard: true, mapping: "referralSource" }
      ]
    },
    {
      id: "referral_info",
      title: "Referral Information",
      description: "Details of the person who referred you.",
      enabled: true,
      fields: [
        { id: "referredByName", type: "text", label: "Name of referred Faculty/Existing Trainee", isStandard: true, mapping: "referredByName" }
      ]
    },
    {
      id: "social_media",
      title: "Social Media",
      description: "Specify the media source if applicable.",
      enabled: true,
      fields: [
        { id: "mediaSource", type: "text", label: "Media Source", isStandard: true, mapping: "mediaSource" }
      ]
    },
    {
      id: "personal_details",
      title: "Let us know you better",
      description: "Basic information to identify you.",
      enabled: true,
      fields: [
        { id: "fullName", type: "text", label: "Name in Full", required: true, isStandard: true, mapping: "fullName" },
        { id: "permanentAddress", type: "textarea", label: "Permanent Address", required: true, isStandard: true, mapping: "permanentAddress" },
        { id: "mailingAddress", type: "textarea", label: "Preferred Mailing Address (or N/A)", required: true, isStandard: true, mapping: "mailingAddress" },
        { id: "phone", type: "phone", label: "Mobile Number (10 digits)", required: true, isStandard: true, mapping: "phone" },
        { id: "email", type: "text", label: "E-mail ID", required: true, isStandard: true, mapping: "email" },
        { id: "dateOfBirth", type: "date", label: "Date of Birth", required: true, isStandard: true, mapping: "dateOfBirth" },
        { id: "maritalStatus", type: "radio", label: "Marital Status", options: ["Married", "Unmarried"], required: true, isStandard: true, mapping: "maritalStatus" },
        { id: "spouseDetails", type: "text", label: "If Married, Spouse Details (Name & Profession)", isStandard: true, mapping: "spouseDetails" }
      ]
    },
    {
      id: "previous_entrance",
      title: "Previous Entrance",
      description: "Did you appear for the entrance earlier?",
      enabled: true,
      fields: [
        { id: "prev_appeared", type: "radio", label: "Appeared Earlier?", options: ["Yes", "No"] },
        { id: "previousApplicationMonthYear", type: "text", label: "If Yes, Month & Year", isStandard: true, mapping: "previousApplicationMonthYear", visibleIf: { field: "prev_appeared", equals: "Yes" } }
      ]
    },
    {
      id: "medical_history",
      title: "Medical History",
      description: "Declare any ailments.",
      enabled: true,
      fields: [
        { id: "medicalConditions", type: "checkbox_group", label: "Ailments / Medications", options: ["Asthma", "Hypertension", "Diabetes", "Skin Allergy", "Hearing Impairment", "Tuberculosis", "Post Covid", "None of the Above"], isStandard: true, mapping: "medicalConditions" }
      ]
    },
    {
      id: "educational_qual",
      title: "Educational Qualifications",
      description: "Undergraduate and Postgraduate details.",
      enabled: true,
      fields: [
        { id: "medicalCollege", type: "text", label: "Medical College Qualified From", required: true, isStandard: true, mapping: "medicalCollege" },
        { id: "university", type: "text", label: "University (MBBS Awarded)", required: true, isStandard: true, mapping: "university" },
        { id: "qualification_matrix", type: "qualification_matrix", label: "Postgraduate Qualifications", isStandard: true, mapping: "qualificationMatrix" },
        { id: "do_details", type: "text", label: "If DO: College, University & Year", isStandard: true, mapping: "doDetails", visibleIf: { field: "qualification_matrix", key: "DO (Diploma Ophthlmology)", equals: "Yes" } },
        { id: "ms_md_details", type: "text", label: "If MS: College, University & Year", isStandard: true, mapping: "msMdDetails", visibleIf: { field: "qualification_matrix", key: "MS/MD ( Masters in Ophthalmology)", equals: "Yes" } },
        { id: "dnb_details", type: "text", label: "If DNB: Institution & Year", isStandard: true, mapping: "dnbDetails", visibleIf: { field: "qualification_matrix", key: "DNB", equals: "Yes" } },
        { id: "otherTraining", type: "text", label: "Any Other Training / Certification", isStandard: true, mapping: "otherTraining" },
        { id: "medicalCouncilNumber", type: "text", label: "Medical Council Registration Number", required: true, isStandard: true, mapping: "medicalCouncilNumber" }
      ]
    },
    {
      id: "clinical_exp",
      title: "Clinical Experience",
      description: "Document your diagnostic and surgical experience.",
      enabled: true,
      fields: [
        { id: "diagnostic_skills", type: "skills_table", label: "Diagnostic Skills", options: ["Beginner", "Intermittent", "Expert"], rows: ["Slit Lamp", "Fundus Exam +90D", "Indirect Ophthalmoscopy", "Applanation Tonometry", "Gonioscopy", "Biometry (Keratometry, A Scan)", "Ultrasound B Scan", "Corneal Topgraphy", "Specular Microscopy", "Visual Fields (HFA)", "Fundus Flourescien Angiography (FFA)", "Ocular Coherence Tomography (OCT)", "Yag Capsulotomy /Iridotomy", "Argon LASER", "Hess Charting"], isStandard: true, mapping: "diagnosticSkills" },
        { id: "surgery_experience", type: "surgery_table", label: "Surgical Experience", rows: ["ECCE", "SICS", "PHACO", "TRABECULECTOMY", "RETINA LASERS", "DCR"], isStandard: true, mapping: "surgicalExperience" },
        { id: "totalSurgeries", type: "number", label: "Total No. of Surgeries performed till date (Confirmation)", required: true, isStandard: true, mapping: "totalSurgeries" }
      ]
    },
    {
      id: "publications",
      title: "Publications & Presentation",
      description: "Academic presentations & publications.",
      enabled: true,
      fields: [
        { id: "publications", type: "textarea", label: "Journal Publications", required: true, isStandard: true, mapping: "publications" },
        { id: "presentations", type: "textarea", label: "Conference Presentations", required: true, isStandard: true, mapping: "presentations" }
      ]
    },
    {
      id: "lor",
      title: "LETTER OF RECOMMENDATION (LOR)",
      description: "Upload two LORs from the last 6 months (PDF).",
      enabled: true,
      fields: [
        { id: "lor1Url", type: "file", label: "LOR 1 PDF", required: true, isStandard: true, mapping: "lor1Url" },
        { id: "lor1RefName", type: "text", label: "Name & Designation of Reference 1", required: true, isStandard: true, mapping: "lor1RefName" },
        { id: "lor1RefContact", type: "text", label: "Contact number of Reference 1", required: true, isStandard: true, mapping: "lor1RefContact" },
        { id: "lor1RefEmail", type: "text", label: "Email ID of Reference 1", required: true, isStandard: true, mapping: "lor1RefEmail" },
        { id: "lor2Url", type: "file", label: "LOR 2 PDF", required: true, isStandard: true, mapping: "lor2Url" },
        { id: "lor2RefName", type: "text", label: "Name & Designation of Reference 2", required: true, isStandard: true, mapping: "lor2RefName" },
        { id: "lor2RefContact", type: "text", label: "Contact number of Reference 2", required: true, isStandard: true, mapping: "lor2RefContact" },
        { id: "lor2RefEmail", type: "text", label: "Email ID of Reference 2", required: true, isStandard: true, mapping: "lor2RefEmail" }
      ]
    },
    {
      id: "final",
      title: "Declaration & Payment",
      description: "Final information and documents.",
      enabled: true,
      fields: [
        { id: "photoUrl", type: "file", label: "Passport Size Photograph", required: true, isStandard: true, mapping: "photoUrl" },
        { id: "declarationAccepted", type: "checkbox", label: "I hereby declare that the information provided is true to the best of my knowledge.", required: true, isStandard: true, mapping: "declarationAccepted" }
      ]
    }
  ];

  const DEFAULT_SECTIONS_JSON = JSON.stringify(DEFAULT_SECTIONS);

  // Aggressively update the July 2026 fellowship form to use the latest multi-specialty config
  await db.execute(sql`
    UPDATE application_forms 
    SET sections_config = ${DEFAULT_SECTIONS_JSON}::jsonb
    WHERE title LIKE '%July 2026%' OR sections_config IS NULL OR sections_config = '[]'::jsonb
  `);
  logger.info("Synchronized fellowship form configurations with multi-specialty support");
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  runStartupFixes().catch((e) => logger.error({ err: e }, "Startup fixes failed"));
});

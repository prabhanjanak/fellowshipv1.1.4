import { Router } from "express";
import { 
  db, usersTable, candidatesTable, applicationFormsTable, programsTable, 
  applicationSubmissionsTable, batchesTable, batchCandidatesTable, 
  seatMatrixEntriesTable, globalSettingsTable, examsTable, questionsTable,
  interviewPanelsTable, interviewPanelMembersTable, unitsTable
} from "@workspace/db";
import { eq, sql, ilike } from "drizzle-orm";
import { logger } from "../lib/logger";
import { requireAuth, requireRole } from "../middleware/auth";
import { comparePassword, hashPassword } from "../lib/auth";
import { DEFAULT_SECTIONS } from "../lib/default-sections";

const router = Router();

async function runSeed() {
  const hp = await hashPassword("admin123");

  // 1. Create Units
  const unitNames = ["Bengaluru", "Coimbatore", "Chennai", "Ludhiana", "Jaipur"];
  const units = [];
  for (const name of unitNames) {
    const [u] = await db.insert(unitsTable).values({
      name, city: name, location: `${name} Main Road`, isMock: true
    }).returning();
    units.push(u);
  }

  // 2. Create Staff Users (10 Doctors + others)
  const doctors = [
    { name: "Dr. Arun Kumar", email: "arun@sankara.com", unitId: units[0].id },
    { name: "Dr. Meena Iyer", email: "meena@sankara.com", unitId: units[1].id },
    { name: "Dr. Rajesh Shah", email: "rajesh@sankara.com", unitId: units[2].id },
    { name: "Dr. Sneha Pillai", email: "sneha_p@sankara.com", unitId: units[0].id },
    { name: "Dr. Vikram Seth", email: "vikram_s@sankara.com", unitId: units[3].id },
    { name: "Dr. Anjali Menon", email: "anjali_m@sankara.com", unitId: units[1].id },
    { name: "Dr. Karthik S", email: "karthik@sankara.com", unitId: units[2].id },
    { name: "Dr. Pooja Hegde", email: "pooja@sankara.com", unitId: units[0].id },
    { name: "Dr. Sunil Gavaskar", email: "sunil@sankara.com", unitId: units[3].id },
    { name: "Dr. Mary Kom", email: "mary@sankara.com", unitId: units[4].id },
  ];

  const doctorUsers = [];
  for (const d of doctors) {
    const [u] = await db.insert(usersTable).values({
      fullName: d.name,
      email: d.email,
      passwordHash: hp,
      role: "doctor",
      unitId: d.unitId ?? null,
      isMock: true,
    }).returning();
    doctorUsers.push(u);
  }

  const otherStaff = [
    { name: "Suresh ExamCoord", email: "suresh@sankara.com", role: "central_exam_coordinator" },
    { name: "Latha ProgramAdmin", email: "latha@sankara.com", role: "program_admin" },
    { name: "Unit Admin BLR", email: "blr@sankara.com", role: "unit_coordinator", unitId: units[0].id },
  ];

  for (const s of otherStaff) {
    await db.insert(usersTable).values({
      fullName: s.name,
      email: s.email,
      passwordHash: hp,
      role: s.role as any,
      unitId: s.unitId ?? null,
      isMock: true,
    });
  }

  // 3. Create Programs & Forms
  const [program] = await db.insert(programsTable).values({
    name: "Fellowship Program July 2026 (Mock)",
    code: `MOCK-${Date.now()}`,
    academicYear: "2026",
    description: "MOCK: Advanced surgical fellowship in various ophthalmology specialities.",
    isMock: true,
  }).returning();

  const [form] = await db.insert(applicationFormsTable).values({
    programId: program.id,
    title: "July 2026 Admissions Form (Mock)",
    token: `MOCK-FORM-${Date.now()}`,
    deadline: new Date("2026-06-30"),
    isActive: true,
  }).returning();

  // 4. Create Seat Matrix
  const specs = ["Vitreo Retina", "Medical Retina", "Cornea", "Glaucoma", "Oculoplasty", "Paediatric"];
  for (const spec of specs) {
    for (const unit of units) {
      await db.insert(seatMatrixEntriesTable).values({
        programId: program.id,
        speciality: spec,
        unitName: unit.name,
        totalSeats: Math.floor(Math.random() * 3) + 1,
      });
    }
  }

  // 5. Create Exams & Questions
  const [exam] = await db.insert(examsTable).values({
    title: "July 2026 Entrance MCQ (Mock)",
    kind: "mcq",
    programId: program.id,
    durationMinutes: 60,
    totalQuestions: 5,
    active: true,
    isMock: true,
  }).returning();

  for (let i = 1; i <= 5; i++) {
    await db.insert(questionsTable).values({
      examId: exam.id,
      text: `Question ${i}: Which of the following is related to eye anatomy?`,
      choices: ["Retina", "Liver", "Heart", "Lungs"],
      correctIndex: 0,
    });
  }

  // 6. Create Interview Panels
  const panelNames = ["Panel A (Retina)", "Panel B (Cornea)", "Panel C (General)"];
  const rooms = ["Room 101", "Room 102", "Conference Room 1"];
  const panels = [];
  for (let i = 0; i < 3; i++) {
    const [p] = await db.insert(interviewPanelsTable).values({
      name: panelNames[i],
      roomNumber: rooms[i],
      programId: program.id,
      isActive: true,
      isMock: true,
    }).returning();
    panels.push(p);

    for (let j = 0; j < 2; j++) {
      await db.insert(interviewPanelMembersTable).values({
        panelId: p.id,
        doctorId: doctorUsers[(i * 2 + j) % doctorUsers.length].id,
        isMain: j === 0
      });
    }
  }

  // 7. Create Candidates & Submissions
  const candidates = [
    "Rahul Sharma", "Priya Patel", "Amit Singh", "Sneha Reddy", "Vikram Malhotra",
    "Anjali Gupta", "Siddharth Jain", "Kavita Rao", "Vikash Verma", "Deepika P",
    "Ranveer Singh", "Alia Bhatt", "Varun Dhawan", "Kriti Sanon", "Ayushmann K"
  ];

  const [batch] = await db.insert(batchesTable).values({
    programId: program.id,
    name: "Main Entrance Batch (Mock)",
    date: new Date("2026-07-01"),
    timing: "10:00 AM",
    isMock: true,
  }).returning();

  for (let i = 0; i < candidates.length; i++) {
    const name = candidates[i];
    const email = `${name.toLowerCase().replace(/\s/g, '.')}@test.com`;
    const [cand] = await db.insert(candidatesTable).values({
      fullName: name,
      email,
      candidateCode: `C-26-${100 + i}`,
      status: "approved",
      isMock: true,
    }).returning();

    await db.insert(applicationSubmissionsTable).values({
      formId: form.id,
      status: "approved",
      fullName: name,
      email,
      specialization: specs[i % specs.length],
      centerPreference: JSON.stringify({ [specs[i % specs.length]]: units[i % units.length].name }),
      submittedAt: new Date(),
      isMock: true,
    });

    await db.insert(batchCandidatesTable).values({
      batchId: batch.id,
      candidateId: cand.id,
      status: "assigned",
    });

    if (i < 9) {
      const panelIdx = i % panels.length;
      await db.execute(sql`
        INSERT INTO panel_queue (panel_id, candidate_id, queue_position, status)
        VALUES (${panels[panelIdx].id}, ${cand.id}, ${Math.floor(i/3) + 1}, 'waiting')
      `);
    }
  }
}

// Get mock mode status
router.get("/debug/mock-mode", requireAuth, async (req, res) => {
  const [setting] = await db.select().from(globalSettingsTable).where(eq(globalSettingsTable.key, "mock_mode"));
  res.json({ enabled: setting?.value === "true" });
});

router.post("/debug/toggle-mock", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const [setting] = await db.select().from(globalSettingsTable).where(eq(globalSettingsTable.key, "mock_mode"));
    const currentlyEnabled = setting?.value === "true";
    const newState = !currentlyEnabled;

    if (newState) {
      // If enabling, check if we need to seed
      const [existingMock] = await db.select().from(programsTable).where(eq(programsTable.isMock, true)).limit(1);
      if (!existingMock) {
        await runSeed();
      }
    }

    await db.update(globalSettingsTable).set({ value: newState.toString(), updatedAt: new Date() }).where(eq(globalSettingsTable.key, "mock_mode"));
    res.json({ enabled: newState, message: `Mock Mode ${newState ? 'Enabled (Live data hidden)' : 'Disabled (Live data restored)'}.` });
  } catch (error) {
    logger.error({ error }, "Toggle mock failed");
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post("/debug/seed", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    logger.info("Manual seed requested");
    await runSeed();
    await db.update(globalSettingsTable).set({ value: "true", updatedAt: new Date() }).where(eq(globalSettingsTable.key, "mock_mode"));
    res.json({ message: "Successfully seeded mock data." });
  } catch (error) {
    logger.error({ error }, "Seed failed");
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post("/debug/init-july-2026", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    // 1. Create Program
    const [program] = await db.insert(programsTable).values({
      name: "Fellowship Program July 2026",
      code: "FP-JULY-2026",
      academicYear: "2026",
      description: "Advanced surgical fellowship in various ophthalmology sub-specialities for the July 2026 cycle.",
      isMock: false
    }).returning();

    // 2. Create Application Form
    const [form] = await db.insert(applicationFormsTable).values({
      programId: program.id,
      title: "July 2026 Admissions Application Form",
      token: "JULY2026",
      deadline: new Date("2026-06-15"),
      isActive: true,
      sectionsConfig: JSON.stringify(DEFAULT_SECTIONS)
    }).returning();

    // 3. Populate Seat Matrix (Live)
    const liveUnits = await db.select().from(unitsTable).where(eq(unitsTable.isMock, false));
    const subspecialties = ["Cornea", "Glaucoma", "IOL", "Oculoplasty", "Pediatric Ophthalmology", "Phaco Refractive", "Medical Retina", "Vitreo Retina"];

    if (liveUnits.length === 0) {
       const defaultUnits = ["Bangalore", "Coimbatore", "Guntur", "Jaipur", "Shimoga", "Ludhiana", "Panvel", "Chennai"];
       for (const name of defaultUnits) {
         await db.insert(unitsTable).values({ name, city: name, isMock: false });
       }
    }

    const updatedLiveUnits = await db.select().from(unitsTable).where(eq(unitsTable.isMock, false));
    for (const spec of subspecialties) {
      for (const unit of updatedLiveUnits) {
        await db.insert(seatMatrixEntriesTable).values({
          programId: program.id,
          speciality: spec,
          unitName: unit.name,
          totalSeats: 2 
        });
      }
    }

    res.json({ message: "July 2026 Live Environment Initialized Successfully." });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post("/debug/reset-database", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const { password } = req.body as { password?: string };
    if (!password) return res.status(400).json({ error: "Password required" });

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
    if (!user || !(await comparePassword(password, user.passwordHash))) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // This wipes EVERYTHING (Legacy behavior preserved for safety)
    await db.delete(interviewPanelMembersTable);
    await db.delete(interviewPanelsTable);
    await db.delete(questionsTable);
    await db.delete(examsTable);
    await db.delete(batchCandidatesTable);
    await db.delete(batchesTable);
    await db.delete(applicationSubmissionsTable);
    await db.delete(candidatesTable);
    await db.delete(applicationFormsTable);
    await db.delete(seatMatrixEntriesTable);
    await db.delete(programsTable);
    await db.delete(usersTable).where(sql`role != 'super_admin'`);

    await db.update(globalSettingsTable).set({ value: "false", updatedAt: new Date() }).where(eq(globalSettingsTable.key, "mock_mode"));

    res.json({ message: "Database completely reset. All data wiped." });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;

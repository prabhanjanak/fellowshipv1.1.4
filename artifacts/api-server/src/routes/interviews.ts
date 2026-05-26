import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, doctorAssignmentsTable, interviewScoresTable, candidatesTable, unitsTable, usersTable, applicationsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middleware/auth";

const router: Router = Router();

// Doctor: get my assigned candidates
router.get("/interviews/assignments", requireAuth, requireRole("doctor"), async (req, res) => {
  const userId = req.user!.userId;

  // 1. Identify active panel and its speciality
  const panelQuery = await db.execute(sql`
    SELECT ip.speciality_id, s.name as speciality_name, ip.name as panel_name
    FROM interview_panel_members ipm
    JOIN interview_panels ip ON ip.id = ipm.panel_id
    LEFT JOIN specialities s ON s.id = ip.speciality_id
    WHERE ipm.doctor_id = ${userId} AND ip.is_active = TRUE
    LIMIT 1
  `);
  const activePanel = panelQuery.rows[0] as { speciality_id: number | null; speciality_name: string | null; panel_name: string } | undefined;
  if (!activePanel) {
    res.json([]);
    return;
  }
  const specialityId = activePanel.speciality_id;

  const assigns = await db.select().from(doctorAssignmentsTable).where(
    and(
      eq(doctorAssignmentsTable.doctorId, userId),
      specialityId ? eq(doctorAssignmentsTable.specialityId, specialityId) : sql`speciality_id IS NULL`
    )
  );
  const candidates = await db.select().from(candidatesTable);
  const units = await db.select().from(unitsTable);
  const scores = await db.select().from(interviewScoresTable).where(
    and(
      eq(interviewScoresTable.doctorId, userId),
      specialityId ? eq(interviewScoresTable.specialityId, specialityId) : sql`speciality_id IS NULL`
    )
  );
  res.json(assigns.map((a) => {
    const c = candidates.find((x) => x.id === a.candidateId);
    const unit = c?.unitId ? units.find((u) => u.id === c.unitId) : null;
    const sc = scores.find((s) => s.candidateId === a.candidateId && (specialityId ? s.specialityId === specialityId : s.specialityId === null));
    return {
      id: a.id,
      candidateId: a.candidateId,
      candidateName: c?.fullName ?? "",
      candidateCode: c?.candidateCode ?? "",
      specialityId,
      specialityName: activePanel.speciality_name ?? activePanel.panel_name,
      unitName: unit?.name ?? null,
      scheduledAt: a.scheduledAt?.toISOString() ?? null,
      status: sc ? "completed" : a.status,
      existingScore: sc ? { id: sc.id, score: sc.score, remarks: sc.remarks, submittedAt: sc.submittedAt.toISOString() } : null,
    };
  }));
});

// Admin: get all interview scores with candidate/doctor names
router.get("/interviews/scores", requireAuth, requireRole("super_admin", "program_admin", "central_exam_coordinator"), async (req, res) => {
  const scores = await db.select().from(interviewScoresTable);
  const candidates = await db.select().from(candidatesTable);
  const users = await db.select().from(usersTable);
  
  // Also get batches to find total marks
  const { db: workspaceDb, batchesTable } = await import("@workspace/db");
  const batches = await db.select().from(batchesTable);

  res.json(scores.map((s) => {
    const cand = candidates.find((c) => c.id === s.candidateId);
    const doc = users.find((u) => u.id === s.doctorId);
    
    // Find batch for this candidate to get total marks
    // (This is an approximation based on the program)
    const batch = batches[0] ?? null; // Use first available batch for total marks

    return {
      id: s.id,
      candidateId: s.candidateId,
      candidateName: cand?.fullName ?? `#${s.candidateId}`,
      candidateCode: cand?.candidateCode ?? "",
      doctorId: s.doctorId,
      doctorName: doc?.fullName ?? `#${s.doctorId}`,
      score: s.score,
      totalMarks: batch?.interviewTotalMarks ?? 100,
      remarks: s.remarks,
      submittedAt: s.submittedAt.toISOString(),
    };
  }));
});

// Admin: get all doctor assignments (for management panel)
router.get("/interviews/doctor-assignments", requireAuth, requireRole("super_admin", "program_admin", "central_exam_coordinator"), async (req, res) => {
  const assigns = await db.select().from(doctorAssignmentsTable);
  const candidates = await db.select().from(candidatesTable);
  const users = await db.select().from(usersTable);
  const units = await db.select().from(unitsTable);
  const scores = await db.select().from(interviewScoresTable);

  const doctors = users.filter((u) => u.role === "doctor");

  res.json(doctors.map((d) => {
    const unit = d.unitId ? units.find((u) => u.id === d.unitId) : null;
    const myAssigns = assigns.filter((a) => a.doctorId === d.id);
    return {
      doctorId: d.id,
      doctorName: d.fullName,
      doctorEmail: d.email,
      unitId: d.unitId,
      unitName: unit?.name ?? null,
      assignments: myAssigns.map((a) => {
        const c = candidates.find((x) => x.id === a.candidateId);
        const sc = scores.find((s) => s.doctorId === d.id && s.candidateId === a.candidateId);
        return {
          id: a.id,
          candidateId: a.candidateId,
          candidateName: c?.fullName ?? "",
          candidateCode: c?.candidateCode ?? "",
          scheduledAt: a.scheduledAt?.toISOString() ?? null,
          status: sc ? "completed" : a.status,
          score: sc?.score ?? null,
        };
      }),
    };
  }));
});

// Admin: assign candidate to doctor
router.post("/interviews/assign", requireAuth, requireRole("super_admin", "program_admin", "central_exam_coordinator"), async (req, res) => {
  const { doctorId, candidateId, scheduledAt } = req.body as { doctorId: number; candidateId: number; scheduledAt?: string };
  if (!doctorId || !candidateId) {
    res.status(400).json({ error: "doctorId and candidateId required" });
    return;
  }
  const [d] = await db.select().from(usersTable).where(eq(usersTable.id, doctorId));
  if (!d || d.role !== "doctor") { res.status(404).json({ error: "Doctor not found" }); return; }
  const [c] = await db.select().from(candidatesTable).where(eq(candidatesTable.id, candidateId));
  if (!c) { res.status(404).json({ error: "Candidate not found" }); return; }

  // Resolve specialityId from the doctor's active panel if not provided in request body
  let specialityId = (req.body as any).specialityId;
  if (!specialityId) {
    const panelQuery = await db.execute(sql`
      SELECT ip.speciality_id
      FROM interview_panel_members ipm
      JOIN interview_panels ip ON ip.id = ipm.panel_id
      WHERE ipm.doctor_id = ${doctorId} AND ip.is_active = TRUE
      LIMIT 1
    `);
    specialityId = (panelQuery.rows[0] as { speciality_id: number | null } | undefined)?.speciality_id;
  }

  const existing = await db.select().from(doctorAssignmentsTable).where(
    and(
      eq(doctorAssignmentsTable.doctorId, doctorId),
      eq(doctorAssignmentsTable.candidateId, candidateId),
      specialityId ? eq(doctorAssignmentsTable.specialityId, specialityId) : sql`speciality_id IS NULL`
    ),
  );

  let row;
  if (existing.length > 0) {
    [row] = await db.update(doctorAssignmentsTable)
      .set({ scheduledAt: scheduledAt ? new Date(scheduledAt) : null })
      .where(eq(doctorAssignmentsTable.id, existing[0]!.id))
      .returning();
  } else {
    [row] = await db.insert(doctorAssignmentsTable).values({
      doctorId, candidateId, status: "pending", specialityId,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    }).returning();
  }
  if (!row) { res.status(500).json({ error: "Failed" }); return; }
  res.json({ id: row.id, doctorId, candidateId, status: row.status, specialityId });
});

// Admin: remove candidate from doctor
router.delete("/interviews/assign/:assignmentId", requireAuth, requireRole("super_admin", "program_admin", "central_exam_coordinator"), async (req, res) => {
  const id = Number(req.params["assignmentId"]);
  await db.delete(doctorAssignmentsTable).where(eq(doctorAssignmentsTable.id, id));
  res.json({ success: true });
});

// Doctor: submit score
router.post("/interviews/scores", requireAuth, requireRole("doctor"), async (req, res) => {
  const userId = req.user!.userId;
  const { candidateId, score, remarks } = req.body as { candidateId: number; score: number; remarks?: string };
  if (!candidateId || score == null) { res.status(400).json({ error: "Missing fields" }); return; }

  // 1. Identify active panel and its speciality
  const panelQuery = await db.execute(sql`
    SELECT ip.speciality_id, ip.id as panel_id
    FROM interview_panel_members ipm
    JOIN interview_panels ip ON ip.id = ipm.panel_id
    WHERE ipm.doctor_id = ${userId} AND ip.is_active = TRUE
    LIMIT 1
  `);
  const activePanel = panelQuery.rows[0] as { speciality_id: number | null; panel_id: number } | undefined;
  if (!activePanel) {
    return res.status(403).json({ error: "Access denied. Doctor is not currently active in any panel." });
  }
  const specialityId = activePanel.speciality_id;

  const existing = await db.select().from(interviewScoresTable).where(
    and(
      eq(interviewScoresTable.candidateId, candidateId),
      eq(interviewScoresTable.doctorId, userId),
      specialityId ? eq(interviewScoresTable.specialityId, specialityId) : sql`speciality_id IS NULL`
    ),
  );
  let row;
  if (existing.length > 0) {
    [row] = await db.update(interviewScoresTable).set({ score, remarks: remarks ?? null, submittedAt: new Date() })
      .where(eq(interviewScoresTable.id, existing[0]!.id)).returning();
  } else {
    [row] = await db.insert(interviewScoresTable).values({ candidateId, doctorId: userId, specialityId, score, remarks: remarks ?? null }).returning();
  }
  if (!row) { res.status(500).json({ error: "Failed" }); return; }

  // Update applicationsTable status for this specialization
  if (specialityId) {
    await db.update(applicationsTable).set({ status: "interviewed" })
      .where(and(
        eq(applicationsTable.candidateId, candidateId),
        eq(applicationsTable.specialityId, specialityId)
      ));
  }

  // If all specializations are completed, update candidatesTable status
  const pendingApps = await db.select().from(applicationsTable).where(
    and(
      eq(applicationsTable.candidateId, candidateId),
      eq(applicationsTable.status, "approved")
    )
  );
  if (pendingApps.length === 0) {
    await db.update(candidatesTable).set({ status: "interview_completed" }).where(eq(candidatesTable.id, candidateId));
  }

  // Update doctor assignments strictly for this specialization
  await db.update(doctorAssignmentsTable).set({ status: "completed" })
    .where(and(
      eq(doctorAssignmentsTable.doctorId, userId),
      eq(doctorAssignmentsTable.candidateId, candidateId),
      specialityId ? eq(doctorAssignmentsTable.specialityId, specialityId) : sql`speciality_id IS NULL`
    ));

  // Mark in panel queue as done
  await db.execute(sql`
    UPDATE panel_queue SET status = 'completed'
    WHERE panel_id = ${activePanel.panel_id} AND candidate_id = ${candidateId}
  `);

  // Release doctor status from being engaged with this candidate
  await db.execute(sql`
    UPDATE doctor_panel_status SET is_engaged = FALSE, current_candidate_id = NULL, updated_at = NOW()
    WHERE doctor_id = ${userId}
  `);

  res.json({ id: row.id, candidateId: row.candidateId, doctorId: row.doctorId, score: row.score, remarks: row.remarks, submittedAt: row.submittedAt.toISOString() });
});

export default router;

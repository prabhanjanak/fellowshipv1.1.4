import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import {
  db,
  candidatesTable,
  programsTable,
  specialitiesTable,
  examAttemptsTable,
  examsTable,
  interviewScoresTable,
  allocationsTable,
  usersTable,
  unitsTable,
} from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router: Router = Router();

router.get("/dashboard/summary", requireAuth, async (req, res) => {
  const callerRole = req.user!.role;
  const callerId = req.user!.userId;

  // For unit_coordinator: scope to their unit
  let effectiveUnitId: number | null = null;
  if (callerRole === "unit_coordinator") {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, callerId));
    effectiveUnitId = u?.unitId ?? null;
  }

  let candidates = await db.select().from(candidatesTable).where(eq(candidatesTable.isMock, (req as any).isMockMode));
  if (effectiveUnitId != null) {
    candidates = candidates.filter((c) => c.unitId === effectiveUnitId);
  }

  const programs = await db.select().from(programsTable).where(eq(programsTable.isMock, (req as any).isMockMode));
  const units = await db.select().from(unitsTable);
  const specs = await db.select().from(specialitiesTable);
  const totalSeats = specs.reduce((s, x) => s + x.seats, 0);
  const allocs = await db.select().from(allocationsTable);
  const allocated = allocs.filter((a) => a.status === "SELECTED").length;
  const waitlisted = candidates.filter((c) => c.status === "waitlisted").length;
  const pending = candidates.filter((c) => c.status === "pending").length;
  const attempts = await db.select().from(examAttemptsTable); // Filtering by candidate will handle this
  const activeExams = (await db.select().from(examsTable).where(eq(examsTable.isMock, (req as any).isMockMode))).filter((e) => e.active).length;
  const interviews = await db.select().from(interviewScoresTable);

  const statusBreakdown = new Map<string, number>();
  for (const c of candidates) statusBreakdown.set(c.status, (statusBreakdown.get(c.status) ?? 0) + 1);

  res.json({
    candidates: candidates.length,
    programs: programs.length,
    units: units.length,
    specialities: specs.length,
    totalSeats,
    activeExams,
    attemptsCompleted: attempts.filter((a) => a.submittedAt != null).length,
    interviewsCompleted: interviews.length,
    allocated,
    waitlisted,
    pendingReview: pending,
    statusBreakdown: Array.from(statusBreakdown.entries()).map(([status, count]) => ({ status, count })),
  });
});

router.get("/dashboard/recent-activity", requireAuth, async (req: any, res) => {
  const isMock = req.isMockMode;
  const candidates = await db.select().from(candidatesTable).where(eq(candidatesTable.isMock, isMock)).orderBy(desc(candidatesTable.createdAt)).limit(5);
  const attempts = await db.select().from(examAttemptsTable).orderBy(desc(examAttemptsTable.startedAt)).limit(5);
  const exams = await db.select().from(examsTable).where(eq(examsTable.isMock, isMock));
  const interviews = await db.select().from(interviewScoresTable).orderBy(desc(interviewScoresTable.submittedAt)).limit(5);
  const users = await db.select().from(usersTable);
  const allCandidates = await db.select().from(candidatesTable).where(eq(candidatesTable.isMock, isMock));

  type Item = { id: string; kind: string; title: string; subtitle: string | null; at: string };
  const items: Item[] = [];

  for (const c of candidates) {
    items.push({ id: `cand-${c.id}`, kind: "registration", title: `${c.fullName} registered`, subtitle: c.candidateCode, at: c.createdAt.toISOString() });
  }
  for (const a of attempts) {
    const cand = allCandidates.find((c) => c.id === a.candidateId);
    const e = exams.find((x) => x.id === a.examId);
    items.push({
      id: `att-${a.id}`,
      kind: a.submittedAt ? "exam_submitted" : "exam_started",
      title: `${cand?.fullName ?? "Candidate"} ${a.submittedAt ? "submitted" : "started"} ${e?.title ?? "an exam"}`,
      subtitle: a.submittedAt ? `Score: ${a.score?.toFixed(1) ?? "—"} / ${a.maxScore?.toFixed(1) ?? "—"}` : null,
      at: (a.submittedAt ?? a.startedAt).toISOString(),
    });
  }
  for (const iv of interviews) {
    const cand = allCandidates.find((c) => c.id === iv.candidateId);
    const doc = users.find((u) => u.id === iv.doctorId);
    items.push({
      id: `int-${iv.id}`,
      kind: "interview_scored",
      title: `${doc?.fullName ?? "Doctor"} scored ${cand?.fullName ?? "candidate"}`,
      subtitle: `Score: ${iv.score.toFixed(1)}`,
      at: iv.submittedAt.toISOString(),
    });
  }
  items.sort((a, b) => (a.at < b.at ? 1 : -1));
  res.json(items.slice(0, 12));
});

export default router;

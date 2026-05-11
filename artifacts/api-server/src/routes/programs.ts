import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, programsTable, specialitiesTable, candidatesTable, allocationsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middleware/auth";

const router: Router = Router();

async function programSummary(p: { id: number; name: string; code: string; description: string | null; academicYear: string }) {
  const specs = await db.select().from(specialitiesTable).where(eq(specialitiesTable.programId, p.id));
  const totalSeats = specs.reduce((sum, s) => sum + s.seats, 0);
  const allocs = await db.select().from(allocationsTable).where(eq(allocationsTable.programId, p.id));
  const candidates = await db.select().from(candidatesTable);
  return {
    id: p.id,
    name: p.name,
    code: p.code,
    description: p.description,
    academicYear: p.academicYear,
    offerLetterTemplateId: p.offerLetterTemplateId,
    totalSeats,
    specialityCount: specs.length,
    candidateCount: candidates.length,
    _allocs: allocs.length,
  };
}

router.get("/programs", requireAuth, async (_req, res) => {
  const programs = await db.select().from(programsTable);
  const out = await Promise.all(programs.map(programSummary));
  res.json(out.map(({ _allocs: _a, ...rest }) => rest));
});

router.post("/programs", requireAuth, requireRole("super_admin", "program_admin"), async (req, res) => {
  const { name, code, description, academicYear, offerLetterTemplateId } = req.body as {
    name: string;
    code: string;
    description?: string;
    academicYear: string;
    offerLetterTemplateId?: string;
  };
  if (!name || !code || !academicYear) {
    res.status(400).json({ error: "Missing fields" });
    return;
  }
  const [p] = await db.insert(programsTable).values({
    name,
    code,
    description: description ?? null,
    academicYear,
    offerLetterTemplateId: offerLetterTemplateId ?? null,
  }).returning();
  if (!p) { res.status(500).json({ error: "Failed" }); return; }
  res.json({
    id: p.id,
    name: p.name,
    code: p.code,
    description: p.description,
    academicYear: p.academicYear,
    offerLetterTemplateId: p.offerLetterTemplateId,
    totalSeats: 0,
    specialityCount: 0,
    candidateCount: 0,
  });
});

router.patch("/programs/:programId", requireAuth, requireRole("super_admin", "program_admin"), async (req, res) => {
  const id = Number(req.params.programId);
  const data = req.body;
  const [updated] = await db.update(programsTable).set(data).where(eq(programsTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(await programSummary(updated));
});

router.get("/programs/:programId", requireAuth, async (req, res) => {
  const programId = Number(req.params["programId"]);
  const [p] = await db.select().from(programsTable).where(eq(programsTable.id, programId));
  if (!p) { res.status(404).json({ error: "Not found" }); return; }
  const specs = await db.select().from(specialitiesTable).where(eq(specialitiesTable.programId, programId));
  const allocs = await db.select().from(allocationsTable).where(eq(allocationsTable.programId, programId));
  const filledBySpec = new Map<number, number>();
  for (const a of allocs) {
    if (a.status === "SELECTED" && a.specialityId != null) {
      filledBySpec.set(a.specialityId, (filledBySpec.get(a.specialityId) ?? 0) + 1);
    }
  }
  const totalSeats = specs.reduce((s, x) => s + x.seats, 0);
  const candidates = await db.select().from(candidatesTable);
  res.json({
    id: p.id,
    name: p.name,
    code: p.code,
    description: p.description,
    academicYear: p.academicYear,
    offerLetterTemplateId: p.offerLetterTemplateId,
    totalSeats,
    specialityCount: specs.length,
    candidateCount: candidates.length,
    specialities: specs.map((s) => ({
      id: s.id,
      programId: s.programId,
      name: s.name,
      code: s.code,
      seats: s.seats,
      filledSeats: filledBySpec.get(s.id) ?? 0,
    })),
  });
});

router.delete("/programs/:programId", requireAuth, requireRole("super_admin", "program_admin"), async (req, res) => {
  const programId = Number(req.params["programId"]);
  await db.delete(programsTable).where(eq(programsTable.id, programId));
  res.json({ success: true });
});

export default router;

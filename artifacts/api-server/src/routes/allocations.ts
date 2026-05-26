import { Router } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  allocationsTable,
  candidatesTable,
  programsTable,
  specialitiesTable,
  unitsTable,
  seatMatrixEntriesTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { computeScoresForProgram } from "../lib/scoring";
import { generateAllocationLetter } from "../lib/pdf";

const router: Router = Router();

async function listAllocations(programId?: number) {
  let allocs = await db.select().from(allocationsTable);
  if (programId) allocs = allocs.filter((a) => a.programId === programId);
  const candidates = await db.select().from(candidatesTable);
  const programs = await db.select().from(programsTable);
  const specs = await db.select().from(specialitiesTable);
  const units = await db.select().from(unitsTable);
  return allocs.map((a) => {
    const c = candidates.find((x) => x.id === a.candidateId);
    const p = programs.find((x) => x.id === a.programId);
    const s = a.specialityId ? specs.find((x) => x.id === a.specialityId) : null;
    const u = a.unitId ? units.find((x) => x.id === a.unitId) : null;
    return {
      id: a.id,
      candidateId: a.candidateId,
      candidateName: c?.fullName ?? "",
      candidateCode: c?.candidateCode ?? "",
      specialityId: a.specialityId,
      specialityName: s?.name ?? null,
      programName: p?.name ?? "",
      unitId: a.unitId,
      unitName: u?.name ?? null,
      status: a.status,
      rank: a.rank,
      totalScore: a.totalScore,
      allocatedAt: a.allocatedAt.toISOString(),
    };
  });
}

// GET /allocations
router.get("/allocations", requireAuth, async (req, res) => {
  const programId = req.query["programId"] ? Number(req.query["programId"]) : undefined;
  res.json(await listAllocations(programId));
});

// GET /allocations/summary
router.get("/allocations/summary", requireAuth, async (req, res) => {
  const programId = req.query["programId"] ? Number(req.query["programId"]) : null;
  if (!programId) { res.status(400).json({ error: "programId required" }); return; }

  try {
    const entries = await db.select().from(seatMatrixEntriesTable).where(eq(seatMatrixEntriesTable.programId, programId));
    const allocs = await db.select().from(allocationsTable).where(eq(allocationsTable.programId, programId));
    const candidates = await db.select().from(candidatesTable);

    let totalSeats = 0;
    let filledSeats = 0;
    for (const e of entries) {
      totalSeats += e.totalSeats;
      filledSeats += e.allocatedSeats;
    }

    const waitingList = allocs
      .filter((a) => a.status === "WAITLISTED")
      .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999))
      .map((a) => {
        const c = candidates.find((x) => x.id === a.candidateId);
        return {
          id: a.id,
          candidateName: c?.fullName ?? "",
          candidateCode: c?.candidateCode ?? "",
          rank: a.rank,
          totalScore: a.totalScore,
        };
      });

    res.json({
      totalSeats,
      filledSeats,
      vacantSeats: totalSeats - filledSeats,
      waitingList,
      occupancy: entries.map((e) => ({
        id: e.id,
        speciality: e.speciality,
        unitName: e.unitName,
        totalSeats: e.totalSeats,
        allocatedSeats: e.allocatedSeats,
        vacantSeats: e.totalSeats - e.allocatedSeats,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// POST /allocations/run
router.post("/allocations/run", requireAuth, requireRole("super_admin", "program_admin", "central_exam_coordinator"), async (req, res) => {
  const { programId } = req.body as { programId: number };
  if (!programId) { res.status(400).json({ error: "programId required" }); return; }

  try {
    const specs = await db.select().from(specialitiesTable).where(eq(specialitiesTable.programId, programId));
    const allUnits = await db.select().from(unitsTable);
    const unitMap = new Map<string, number>(allUnits.map(u => [u.name.toLowerCase().trim(), u.id]));

    // Compute NEET merit list
    const ranked = await computeScoresForProgram(programId);

    // Clear previous allocations and reset seat matrix counts
    await db.delete(allocationsTable).where(eq(allocationsTable.programId, programId));
    await db.update(seatMatrixEntriesTable)
      .set({ allocatedSeats: 0 })
      .where(eq(seatMatrixEntriesTable.programId, programId));

    const seatEntries = await db.select().from(seatMatrixEntriesTable).where(eq(seatMatrixEntriesTable.programId, programId));

    let selected = 0;
    let waitlisted = 0;
    let rejected = 0;

    // Sequentially allocate based on rank, speciality preferences, and location lists
    for (let i = 0; i < ranked.length; i++) {
      const r = ranked[i]!;
      let allocated = false;

      for (const specId of r.preferenceSpecIds) {
        if (allocated) break;
        const spec = specs.find(s => s.id === specId);
        if (!spec) continue;

        const preferredLocs = r.preferredLocations[specId] || [];
        for (const locName of preferredLocs) {
          const entry = seatEntries.find(
            e => e.speciality.toLowerCase().trim() === spec.name.toLowerCase().trim() &&
                 e.unitName.toLowerCase().trim() === locName.toLowerCase().trim()
          );

          if (entry && entry.allocatedSeats < entry.totalSeats) {
            entry.allocatedSeats += 1;
            
            await db.update(seatMatrixEntriesTable)
              .set({ allocatedSeats: entry.allocatedSeats })
              .where(eq(seatMatrixEntriesTable.id, entry.id));

            const unitId = unitMap.get(locName.toLowerCase().trim()) || null;
            await db.insert(allocationsTable).values({
              candidateId: r.candidateId,
              programId,
              specialityId: specId,
              unitId,
              status: "Provisionally Allocated",
              rank: i + 1,
              totalScore: r.totalScore,
            });

            await db.update(candidatesTable)
              .set({ status: "allocated" })
              .where(eq(candidatesTable.id, r.candidateId));

            allocated = true;
            selected++;
            break;
          }
        }
      }

      if (!allocated) {
        await db.insert(allocationsTable).values({
          candidateId: r.candidateId,
          programId,
          specialityId: null,
          unitId: null,
          status: "WAITLISTED",
          rank: i + 1,
          totalScore: r.totalScore,
        });

        await db.update(candidatesTable)
          .set({ status: "waitlisted" })
          .where(eq(candidatesTable.id, r.candidateId));

        waitlisted++;
      }
    }

    res.json({ success: true, selected, waitlisted, rejected });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// GET /allocations/me
router.get("/allocations/me", requireAuth, requireRole("student"), async (req, res) => {
  const [c] = await db.select().from(candidatesTable).where(eq(candidatesTable.userId, req.user!.userId));
  if (!c) { res.status(404).json({ error: "Candidate not found" }); return; }
  const [a] = await db.select().from(allocationsTable).where(eq(allocationsTable.candidateId, c.id));
  if (!a) { res.status(404).json({ error: "No allocation yet" }); return; }
  const all = await listAllocations();
  const out = all.find((x) => x.id === a.id);
  if (!out) { res.status(404).json({ error: "Not found" }); return; }
  res.json(out);
});

// POST /allocations/action - Freeze, Float, Withdraw
router.post("/allocations/action", requireAuth, requireRole("student"), async (req, res) => {
  try {
    const { action } = req.body as { action: string };
    if (!action) { res.status(400).json({ error: "action is required" }); return; }

    const [candidate] = await db.select().from(candidatesTable).where(eq(candidatesTable.userId, req.user!.userId));
    if (!candidate) { res.status(404).json({ error: "Candidate not found" }); return; }

    const [allocation] = await db.select().from(allocationsTable).where(eq(allocationsTable.candidateId, candidate.id));
    if (!allocation) { res.status(404).json({ error: "No allocation found" }); return; }

    let targetStatus = "";
    if (action.toLowerCase() === "freeze" || action === "Accepted") {
      targetStatus = "Accepted";
    } else if (action.toLowerCase() === "float" || action === "Upgraded") {
      targetStatus = "Upgraded";
    } else if (action.toLowerCase() === "withdraw" || action === "Withdrawn") {
      targetStatus = "Withdrawn";
    } else {
      res.status(400).json({ error: "Invalid action" });
      return;
    }

    // Vacate seat if candidate withdraws
    if (targetStatus === "Withdrawn" && allocation.status !== "Withdrawn") {
      if (allocation.specialityId && allocation.unitId) {
        const [spec] = await db.select().from(specialitiesTable).where(eq(specialitiesTable.id, allocation.specialityId));
        const [unit] = await db.select().from(unitsTable).where(eq(unitsTable.id, allocation.unitId));

        if (spec && unit) {
          const [entry] = await db.select().from(seatMatrixEntriesTable).where(
            and(
              eq(seatMatrixEntriesTable.programId, allocation.programId),
              eq(seatMatrixEntriesTable.speciality, spec.name),
              eq(seatMatrixEntriesTable.unitName, unit.name)
            )
          );
          if (entry) {
            await db.update(seatMatrixEntriesTable)
              .set({ allocatedSeats: Math.max(0, entry.allocatedSeats - 1) })
              .where(eq(seatMatrixEntriesTable.id, entry.id));
          }
        }
      }
    }

    await db.update(allocationsTable)
      .set({ status: targetStatus })
      .where(eq(allocationsTable.id, allocation.id));

    await db.update(candidatesTable)
      .set({ status: targetStatus === "Withdrawn" ? "rejected" : "allocated" })
      .where(eq(candidatesTable.id, candidate.id));

    res.json({ success: true, status: targetStatus });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// POST /allocations/:allocationId/override
router.post("/allocations/:allocationId/override", requireAuth, requireRole("super_admin", "program_admin", "central_exam_coordinator"), async (req, res) => {
  const id = Number(req.params["allocationId"]);
  const { specialityId, status } = req.body as { specialityId?: number | null; status: string };
  const [a] = await db.update(allocationsTable).set({
    specialityId: specialityId ?? null,
    status,
  }).where(eq(allocationsTable.id, id)).returning();
  if (!a) { res.status(404).json({ error: "Not found" }); return; }
  await db.update(candidatesTable).set({
    status: status === "SELECTED" ? "allocated" : status === "WAITLISTED" ? "waitlisted" : "rejected",
  }).where(eq(candidatesTable.id, a.candidateId));

  // If status changed away from SELECTED/Accepted, promote highest-ranked WAITLISTED candidate
  if (status !== "SELECTED" && status !== "Accepted" && a.specialityId == null) {
    const allocs = await db.select().from(allocationsTable).where(eq(allocationsTable.programId, a.programId));
    const wl = allocs.filter((x) => x.status === "WAITLISTED").sort((x, y) => (x.rank ?? 9999) - (y.rank ?? 9999))[0];
    const specs = await db.select().from(specialitiesTable).where(eq(specialitiesTable.programId, a.programId));
    if (wl) {
      const filledBySpec = new Map<number, number>();
      for (const x of allocs) {
        if ((x.status === "SELECTED" || x.status === "Accepted") && x.specialityId != null) {
          filledBySpec.set(x.specialityId, (filledBySpec.get(x.specialityId) ?? 0) + 1);
        }
      }
      const openSpec = specs.find((s) => (filledBySpec.get(s.id) ?? 0) < s.seats);
      if (openSpec) {
        await db.update(allocationsTable).set({
          status: "SELECTED",
          specialityId: openSpec.id,
        }).where(eq(allocationsTable.id, wl.id));
        await db.update(candidatesTable).set({ status: "allocated" }).where(eq(candidatesTable.id, wl.candidateId));
      }
    }
  }

  const all = await listAllocations();
  const out = all.find((x) => x.id === id);
  res.json(out);
});

// GET /allocations/:allocationId/letter
router.get("/allocations/:allocationId/letter", requireAuth, async (req, res) => {
  const id = Number(req.params["allocationId"]);
  const [a] = await db.select().from(allocationsTable).where(eq(allocationsTable.id, id));
  if (!a) { res.status(404).json({ error: "Not found" }); return; }
  const [c] = await db.select().from(candidatesTable).where(eq(candidatesTable.id, a.candidateId));
  const [p] = await db.select().from(programsTable).where(eq(programsTable.id, a.programId));
  const spec = a.specialityId ? (await db.select().from(specialitiesTable).where(eq(specialitiesTable.id, a.specialityId)))[0] : null;
  const unit = a.unitId ? (await db.select().from(unitsTable).where(eq(unitsTable.id, a.unitId)))[0] : null;
  if (!c || !p) { res.status(404).json({ error: "Missing data" }); return; }
  const data = {
    candidateName: c.fullName,
    candidateCode: c.candidateCode,
    programName: p.name,
    specialityName: spec?.name ?? "—",
    unitName: unit?.name ?? "—",
    unitCity: unit?.city ?? "—",
    allocatedAt: a.allocatedAt.toISOString(),
    status: a.status,
  };
  const pdfBase64 = await generateAllocationLetter(data);
  const pdfBuffer = Buffer.from(pdfBase64, "base64");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="allocation-letter-${id}.pdf"`);
  res.send(pdfBuffer);
});

export default router;

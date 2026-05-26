import { Router } from "express";
import { eq } from "drizzle-orm";
import { 
  db, 
  specialitiesTable, 
  candidatesTable, 
  unitsTable, 
  globalSettingsTable,
  allocationsTable
} from "@workspace/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { computeScoresForProgram, getSpecialitySegment } from "../lib/scoring";
import * as XLSX from "xlsx";

const router: Router = Router();

// GET /rankings/weights — get current dynamic weights config
router.get(
  "/rankings/weights",
  requireAuth,
  async (req, res) => {
    try {
      const [setting] = await db.select().from(globalSettingsTable).where(eq(globalSettingsTable.key, "merit_weights"));
      if (setting) {
        res.json(JSON.parse(setting.value));
      } else {
        // Return default weights
        res.json({ mcq: 60, psychometric: 10, interview: 30 });
      }
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  }
);

// POST /rankings/weights — save dynamic weights config
router.post(
  "/rankings/weights",
  requireAuth,
  requireRole("super_admin", "program_admin", "central_exam_coordinator"),
  async (req, res) => {
    try {
      const { mcq, psychometric, interview } = req.body as { mcq: number; psychometric: number; interview: number };
      
      if (mcq === undefined || psychometric === undefined || interview === undefined) {
        res.status(400).json({ error: "mcq, psychometric, and interview weightages are required" });
        return;
      }

      const sum = Number(mcq) + Number(psychometric) + Number(interview);
      if (Math.abs(sum - 100) > 0.01) {
        res.status(400).json({ error: "Weightages must sum to exactly 100%" });
        return;
      }

      const valueStr = JSON.stringify({ mcq, psychometric, interview });
      const [existing] = await db.select().from(globalSettingsTable).where(eq(globalSettingsTable.key, "merit_weights"));

      if (existing) {
        await db.update(globalSettingsTable)
          .set({ value: valueStr, updatedAt: new Date() })
          .where(eq(globalSettingsTable.id, existing.id));
      } else {
        await db.insert(globalSettingsTable)
          .values({ key: "merit_weights", value: valueStr });
      }

      res.json({ success: true, weights: { mcq, psychometric, interview } });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  }
);

// GET /rankings — get ranked candidates list
router.get(
  "/rankings",
  requireAuth,
  requireRole("super_admin", "program_admin", "central_exam_coordinator"),
  async (req, res) => {
    const programId = Number(req.query["programId"]);
    if (!programId) { res.status(400).json({ error: "programId required" }); return; }

    try {
      const specFilter = req.query["specialityId"] ? Number(req.query["specialityId"]) : undefined;
      const segmentFilter = req.query["segment"] ? String(req.query["segment"]) : undefined;

      const scores = await computeScoresForProgram(programId);
      const specs = await db.select().from(specialitiesTable).where(eq(specialitiesTable.programId, programId));
      const candidates = await db.select().from(candidatesTable);
      const units = await db.select().from(unitsTable);
      const allocations = await db.select().from(allocationsTable).where(eq(allocationsTable.programId, programId));

      let filteredScores = scores;

      // Filter by speciality if requested
      if (specFilter) {
        filteredScores = filteredScores.filter(s => s.specialityScores[specFilter] !== undefined);
      }

      // Filter by segment if requested
      if (segmentFilter) {
        filteredScores = filteredScores.filter(s => {
          return s.preferenceSpecIds.some(id => {
            const spec = specs.find(sp => sp.id === id);
            return spec ? getSpecialitySegment(spec.name) === segmentFilter : false;
          });
        });
      }

      res.json(filteredScores.map((s) => {
        const topSpecId = specFilter || s.preferenceSpecIds[0];
        const topSpec = topSpecId ? specs.find((x) => x.id === topSpecId) : null;
        
        // Find allocation
        const alloc = allocations.find(a => a.candidateId === s.candidateId && (specFilter ? a.specialityId === specFilter : true));
        const unit = alloc?.unitId ? units.find((u) => u.id === alloc.unitId) : null;
        const cand = candidates.find((c) => c.id === s.candidateId);

        return {
          candidateId: s.candidateId,
          candidateCode: s.candidateCode,
          fullName: s.fullName,
          mcqScore: s.mcqScore,
          psychometricScore: s.psychometricScore,
          interviewScore: specFilter ? (s.specialityInterviewScores[specFilter] ?? 0) : s.interviewScore,
          totalScore: specFilter ? (s.specialityScores[specFilter] ?? 0) : s.totalScore,
          rank: specFilter ? (s.specialityRanks[specFilter] ?? 999) : s.overallRank,
          specialityRank: topSpecId ? (s.specialityRanks[topSpecId] ?? null) : null,
          segmentRank: topSpec ? (s.segmentRanks[getSpecialitySegment(topSpec.name)] ?? null) : null,
          topPreference: topSpec?.name ?? null,
          unitName: unit?.name ?? null,
          status: alloc?.status ?? cand?.status ?? "pending",
          preferredLocations: topSpecId ? (s.preferredLocations[topSpecId] ?? []) : [],
          phone: cand?.phone ?? "",
          email: cand?.email ?? "",
        };
      }));
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  }
);

// GET /rankings/export — Export separate rank sheets per specialization as Excel workbook
router.get(
  "/rankings/export",
  requireAuth,
  requireRole("super_admin", "program_admin", "central_exam_coordinator"),
  async (req, res) => {
    const programId = Number(req.query["programId"]);
    if (!programId) { res.status(400).json({ error: "programId required" }); return; }

    try {
      const scores = await computeScoresForProgram(programId);
      const specs = await db.select().from(specialitiesTable).where(eq(specialitiesTable.programId, programId));
      const candidates = await db.select().from(candidatesTable);
      const units = await db.select().from(unitsTable);
      const allocations = await db.select().from(allocationsTable).where(eq(allocationsTable.programId, programId));

      const wb = XLSX.utils.book_new();

      // Create a master / overall rank worksheet
      const masterRows = scores.map((s, idx) => {
        const topSpecId = s.preferenceSpecIds[0];
        const topSpec = topSpecId ? specs.find((x) => x.id === topSpecId) : null;
        const alloc = allocations.find(a => a.candidateId === s.candidateId);
        const unit = alloc?.unitId ? units.find((u) => u.id === alloc.unitId) : null;
        const cand = candidates.find((c) => c.id === s.candidateId);

        return {
          "Rank": idx + 1,
          "Candidate Name": s.fullName,
          "Hall Ticket ID": s.candidateCode,
          "Mobile Number": cand?.phone ?? "",
          "Email ID": cand?.email ?? "",
          "MCQ Marks": Number(s.mcqScore.toFixed(1)),
          "Psychometric Marks": Number(s.psychometricScore.toFixed(1)),
          "Interview Marks": Number(s.interviewScore.toFixed(1)),
          "Final Merit Score": Number(s.totalScore.toFixed(2)),
          "Category": cand?.qualification ?? "General",
          "Preferred Locations": topSpecId ? (s.preferredLocations[topSpecId] ?? []).join(", ") : "None",
          "Allocation Status": alloc ? `${alloc.status} - ${unit?.name || "No Center"}` : "Not Allocated"
        };
      });

      const wsMaster = XLSX.utils.json_to_sheet(masterRows);
      wsMaster["!cols"] = masterRows[0] ? Object.keys(masterRows[0]).map(() => ({ wch: 22 })) : [];
      XLSX.utils.book_append_sheet(wb, wsMaster, "Overall Merit Rankings");

      // Generate separate rank sheets for each specialization
      for (const spec of specs) {
        const specCandidates = scores.filter(s => s.specialityScores[spec.id] !== undefined);
        
        // Sort by specialty rank
        specCandidates.sort((a, b) => (a.specialityRanks[spec.id] ?? 999) - (b.specialityRanks[spec.id] ?? 999));

        const specRows = specCandidates.map(s => {
          const rank = s.specialityRanks[spec.id] ?? 999;
          const score = s.specialityScores[spec.id] ?? 0;
          const intScore = s.specialityInterviewScores[spec.id] ?? 0;
          const alloc = allocations.find(a => a.candidateId === s.candidateId && a.specialityId === spec.id);
          const unit = alloc?.unitId ? units.find((u) => u.id === alloc.unitId) : null;
          const cand = candidates.find((c) => c.id === s.candidateId);

          return {
            "Rank": rank,
            "Candidate Name": s.fullName,
            "Hall Ticket ID": s.candidateCode,
            "Mobile Number": cand?.phone ?? "",
            "Email ID": cand?.email ?? "",
            "MCQ Marks": Number(s.mcqScore.toFixed(1)),
            "Psychometric Marks": Number(s.psychometricScore.toFixed(1)),
            "Interview Marks": Number(intScore.toFixed(1)),
            "Final Merit Score": Number(score.toFixed(2)),
            "Category": cand?.qualification ?? "General",
            "Preferred Locations": (s.preferredLocations[spec.id] ?? []).join(", "),
            "Allocation Status": alloc ? `${alloc.status} - ${unit?.name || "No Center"}` : "Not Allocated"
          };
        });

        // Limit sheet name to maximum 31 characters as required by excel
        const sheetName = spec.name.substring(0, 30);
        const wsSpec = XLSX.utils.json_to_sheet(specRows);
        wsSpec["!cols"] = specRows[0] ? Object.keys(specRows[0]).map(() => ({ wch: 22 })) : [];
        XLSX.utils.book_append_sheet(wb, wsSpec, sheetName);
      }

      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      const date = new Date().toISOString().split("T")[0];
      res.setHeader("Content-Disposition", `attachment; filename=SAV_Merit_Rank_Sheets_${date}.xlsx`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.send(buf);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  }
);

export default router;


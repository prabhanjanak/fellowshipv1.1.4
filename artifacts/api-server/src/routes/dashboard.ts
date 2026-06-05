import { Router } from "express";
import { desc, eq, sql } from "drizzle-orm";
import {
  readDb,
  candidatesTable,
  programsTable,
  specialitiesTable,
  examAttemptsTable,
  examsTable,
  interviewScoresTable,
  usersTable,
  unitsTable,
  applicationSubmissionsTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { parseSpecializationString } from "../lib/utils";

const router: Router = Router();

router.get("/dashboard/summary", requireAuth, async (req: any, res) => {
  const callerRole = req.user!.role;
  const callerId = req.user!.userId;
  const isMock = req.isMockMode || false;

  // 1. Fetch all submissions
  const allSubmissions = await readDb.select().from(applicationSubmissionsTable).where(eq(applicationSubmissionsTable.isMock, isMock));
  
  // Overall metric definitions:
  // Non-draft submissions are formal applications
  const submissions = allSubmissions.filter(s => !s.saveAsDraft);
  
  // Unique applicants (by email)
  const uniqueEmails = new Set(submissions.map(s => s.email.toLowerCase().trim()));
  const totalApplicants = uniqueEmails.size;
  
  // Total applications (each selected speciality is an independent application)
  let totalApplications = 0;
  let totalRetinaApplications = 0;
  let totalAnteriorApplications = 0;
  
  let vrsCount = 0;
  let mrCount = 0;
  let corneaCount = 0;
  let cataractCount = 0;
  let glaucomaCount = 0;
  let pediatricCount = 0;
  let orbitCount = 0;

  // Unique applicants per segment
  const retinaApplicants = new Set<string>();
  const anteriorApplicants = new Set<string>();

  // Today's applications & applicants
  const todayStr = new Date().toDateString();
  let todayTotalApplications = 0;
  const todayApplicants = new Set<string>();
  let todayRetinaApplications = 0;
  let todayAnteriorApplications = 0;

  let todayVrsCount = 0;
  let todayMrCount = 0;
  let todayCorneaCount = 0;
  let todayCataractCount = 0;
  let todayGlaucomaCount = 0;
  let todayPediatricCount = 0;
  let todayOrbitCount = 0;

  for (const s of submissions) {
    const email = s.email.toLowerCase().trim();
    const isSubmittedToday = s.submittedAt && new Date(s.submittedAt).toDateString() === todayStr;
    
    if (isSubmittedToday) {
      todayApplicants.add(email);
    }
    
    const specs = parseSpecializationString(s.specialization);
    for (const spec of specs) {
      totalApplications++;
      if (isSubmittedToday) {
        todayTotalApplications++;
      }
      
      const specLower = spec.toLowerCase();
      // Segmentation
      if (specLower.includes("vitreo retina") || specLower.includes("vitreoretinal")) {
        vrsCount++;
        totalRetinaApplications++;
        retinaApplicants.add(email);
        if (isSubmittedToday) {
          todayVrsCount++;
          todayRetinaApplications++;
        }
      } else if (specLower.includes("medical retina")) {
        mrCount++;
        totalRetinaApplications++;
        retinaApplicants.add(email);
        if (isSubmittedToday) {
          todayMrCount++;
          todayRetinaApplications++;
        }
      } else if (specLower.includes("cornea")) {
        corneaCount++;
        totalAnteriorApplications++;
        anteriorApplicants.add(email);
        if (isSubmittedToday) {
          todayCorneaCount++;
          todayAnteriorApplications++;
        }
      } else if (specLower.includes("cataract") || specLower.includes("refractive") || specLower.includes("phaco") || specLower.includes("iol")) {
        cataractCount++;
        totalAnteriorApplications++;
        anteriorApplicants.add(email);
        if (isSubmittedToday) {
          todayCataractCount++;
          todayAnteriorApplications++;
        }
      } else if (specLower.includes("glaucoma")) {
        glaucomaCount++;
        totalAnteriorApplications++;
        anteriorApplicants.add(email);
        if (isSubmittedToday) {
          todayGlaucomaCount++;
          todayAnteriorApplications++;
        }
      } else if (specLower.includes("pediatric") || specLower.includes("po")) {
        pediatricCount++;
        totalAnteriorApplications++;
        anteriorApplicants.add(email);
        if (isSubmittedToday) {
          todayPediatricCount++;
          todayAnteriorApplications++;
        }
      } else if (specLower.includes("orbit") || specLower.includes("oculoplast") || specLower.includes("op")) {
        orbitCount++;
        totalAnteriorApplications++;
        anteriorApplicants.add(email);
        if (isSubmittedToday) {
          todayOrbitCount++;
          todayAnteriorApplications++;
        }
      } else {
        // Fallback to Anterior segment
        cataractCount++;
        totalAnteriorApplications++;
        anteriorApplicants.add(email);
        if (isSubmittedToday) {
          todayCataractCount++;
          todayAnteriorApplications++;
        }
      }
    }
  }

  const currentDate = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  res.json({
    overall: {
      totalApplications,
      totalApplicants,
      totalApplicationsTillDate: totalApplications,
      currentDate
    },
    segmentWise: {
      retina: {
        totalApplications: totalRetinaApplications,
        totalApplicants: retinaApplicants.size,
        vitreoRetinaCount: vrsCount,
        medicalRetinaCount: mrCount
      },
      anterior: {
        totalApplications: totalAnteriorApplications,
        totalApplicants: anteriorApplicants.size,
        corneaCount,
        cataractCount,
        glaucomaCount,
        pediatricCount,
        orbitCount
      }
    },
    today: {
      overall: {
        totalApplications: todayTotalApplications,
        totalApplicants: todayApplicants.size
      },
      segmentWise: {
        retina: todayRetinaApplications,
        anterior: todayAnteriorApplications
      },
      specializationWise: {
        vitreoRetina: todayVrsCount,
        medicalRetina: todayMrCount,
        cornea: todayCorneaCount,
        cataract: todayCataractCount,
        glaucoma: todayGlaucomaCount,
        pediatric: todayPediatricCount,
        orbit: todayOrbitCount
      }
    }
  });
});

router.get("/dashboard/recent-activity", requireAuth, async (req: any, res) => {
  const isMock = req.isMockMode;
  const candidates = await readDb.select().from(candidatesTable).where(eq(candidatesTable.isMock, isMock)).orderBy(desc(candidatesTable.createdAt)).limit(5);
  const attempts = await readDb.select().from(examAttemptsTable).orderBy(desc(examAttemptsTable.startedAt)).limit(5);
  const exams = await readDb.select().from(examsTable).where(eq(examsTable.isMock, isMock));
  const interviews = await readDb.select().from(interviewScoresTable).orderBy(desc(interviewScoresTable.submittedAt)).limit(5);
  const users = await readDb.select().from(usersTable);
  const allCandidates = await readDb.select().from(candidatesTable).where(eq(candidatesTable.isMock, isMock));

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

// Doctor: Get personal session statistics (read-only dashboard)
router.get("/dashboard/doctor-stats", requireAuth, requireRole("doctor"), async (req: any, res) => {
  const doctorId = req.user!.userId;

  // 1. Find the doctor's active panel and speciality
  const panelQuery = await readDb.execute(sql`
    SELECT ip.id as panel_id, ip.name as panel_name, ip.speciality_id,
           s.name as speciality_name
    FROM interview_panel_members ipm
    JOIN interview_panels ip ON ip.id = ipm.panel_id
    LEFT JOIN specialities s ON s.id = ip.speciality_id
    WHERE ipm.doctor_id = ${doctorId} AND ip.is_active = TRUE
    LIMIT 1
  `);
  const activePanel = panelQuery.rows[0] as {
    panel_id: number;
    panel_name: string;
    speciality_id: number | null;
    speciality_name: string | null;
  } | undefined;

  // 2. Total assigned to this doctor (via panel queue if panel exists, else assignments table)
  let totalAssigned = 0;
  let totalCompleted = 0;
  let remaining = 0;
  let avgInterviewMinutes: number | null = null;
  let panelName: string | null = null;
  let specialityName: string | null = null;

  if (activePanel) {
    panelName = activePanel.panel_name;
    specialityName = activePanel.speciality_name;

    const queueCountQuery = await readDb.execute(sql`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count
      FROM panel_queue
      WHERE panel_id = ${activePanel.panel_id}
    `);
    const row = queueCountQuery.rows[0] as { total: string; completed_count: string } | undefined;
    totalAssigned = Number(row?.total ?? 0);
    totalCompleted = Number(row?.completed_count ?? 0);
    remaining = totalAssigned - totalCompleted;
  } else {
    // Fallback: use doctor_assignments table
    const assignRows = await readDb.execute(sql`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN da.status = 'completed' THEN 1 ELSE 0 END) as done
      FROM doctor_assignments da
      WHERE da.doctor_id = ${doctorId}
    `);
    const row = assignRows.rows[0] as { total: string; done: string } | undefined;
    totalAssigned = Number(row?.total ?? 0);
    totalCompleted = Number(row?.done ?? 0);
    remaining = totalAssigned - totalCompleted;
  }

  // 3. Avg interview duration from interview_scores for this doctor
  const avgQuery = await readDb.execute(sql`
    SELECT AVG(EXTRACT(EPOCH FROM (submitted_at - created_at)) / 60) as avg_minutes
    FROM interview_scores
    WHERE doctor_id = ${doctorId}
  `);
  const avgRow = avgQuery.rows[0] as { avg_minutes: string | null } | undefined;
  if (avgRow?.avg_minutes) {
    avgInterviewMinutes = Math.round(Number(avgRow.avg_minutes) * 10) / 10;
  }

  // 4. Recent scored candidates (last 5)
  const recentScores = await readDb.execute(sql`
    SELECT ist.id, ist.candidate_id, ist.score, ist.submitted_at,
           c.full_name as candidate_name, c.candidate_code
    FROM interview_scores ist
    JOIN candidates c ON c.id = ist.candidate_id
    WHERE ist.doctor_id = ${doctorId}
    ORDER BY ist.submitted_at DESC
    LIMIT 5
  `);

  res.json({
    panelName,
    specialityName,
    totalAssigned,
    totalCompleted,
    remaining,
    avgInterviewMinutes,
    recentlyScoredCandidates: recentScores.rows.map((r: any) => ({
      id: Number(r.id),
      candidateId: Number(r.candidate_id),
      candidateName: String(r.candidate_name ?? ""),
      candidateCode: String(r.candidate_code ?? ""),
      score: Number(r.score),
      scoredAt: r.submitted_at ? new Date(r.submitted_at as string).toISOString() : null,
    })),
  });
});

export default router;

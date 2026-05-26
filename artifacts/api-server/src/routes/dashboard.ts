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
  applicationSubmissionsTable,
} from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { parseSpecializationString } from "../lib/utils";

const router: Router = Router();

router.get("/dashboard/summary", requireAuth, async (req: any, res) => {
  const callerRole = req.user!.role;
  const callerId = req.user!.userId;
  const isMock = req.isMockMode || false;

  // 1. Fetch all submissions
  const allSubmissions = await db.select().from(applicationSubmissionsTable).where(eq(applicationSubmissionsTable.isMock, isMock));
  
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

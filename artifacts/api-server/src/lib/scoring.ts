import { 
  db, 
  candidatesTable, 
  candidatePreferencesTable, 
  examAttemptsTable, 
  examsTable, 
  interviewScoresTable, 
  specialitiesTable, 
  globalSettingsTable,
  applicationSubmissionsTable,
  batchesTable,
  batchCandidatesTable
} from "@workspace/db";
import { eq } from "drizzle-orm";

export type CandidateScore = {
  candidateId: number;
  candidateCode: string;
  fullName: string;
  mcqScore: number;
  psychometricScore: number;
  interviewScore: number; // Candidate's highest average interview score
  totalScore: number;     // Candidate's highest aggregate merit score
  preferenceSpecIds: number[];
  overallRank: number;
  specialityRanks: Record<number, number>; // specialityId -> rank
  specialityScores: Record<number, number>; // specialityId -> score
  specialityInterviewScores: Record<number, number>; // specialityId -> average interview score
  segmentRanks: Record<string, number>; // segmentName -> rank
  preferredLocations: Record<number, string[]>; // specialityId -> ordered locations
  appliedAt: string;
};

// Map speciality to segment
export function getSpecialitySegment(specName: string): "Retina" | "Anterior" {
  const lower = specName.toLowerCase();
  if (lower.includes("retina") || lower.includes("vitreo")) {
    return "Retina";
  }
  return "Anterior";
}

export async function computeScoresForProgram(programId: number): Promise<CandidateScore[]> {
  const candidates = await db.select().from(candidatesTable);
  const exams = await db.select().from(examsTable);
  const attempts = await db.select().from(examAttemptsTable);
  const interviews = await db.select().from(interviewScoresTable);
  const prefs = await db.select().from(candidatePreferencesTable);
  const specs = await db.select().from(specialitiesTable).where(eq(specialitiesTable.programId, programId));
  const submissions = await db.select().from(applicationSubmissionsTable);
  const batches = await db.select().from(batchesTable);
  const batchCandidates = await db.select().from(batchCandidatesTable);
  const programSpecIds = new Set(specs.map((s) => s.id));

  // 1. Retrieve dynamic weight configurations from global settings
  let wMcq = 50;
  let wPsy = 10;
  let wInt = 50;
  try {
    const [setting] = await db.select().from(globalSettingsTable).where(eq(globalSettingsTable.key, "merit_weights"));
    if (setting) {
      const parsed = JSON.parse(setting.value);
      if (parsed.mcq !== undefined) wMcq = Number(parsed.mcq);
      if (parsed.psychometric !== undefined) wPsy = Number(parsed.psychometric);
      if (parsed.interview !== undefined) wInt = Number(parsed.interview);
    }
  } catch (e) {
    console.error("Failed to load merit weights, using default 50/10/50 weights config", e);
  }

  const result: CandidateScore[] = [];

  const { sql } = await import("drizzle-orm");
  const panelQuery = await db.execute(sql`
    SELECT ip.id, ip.name, ip.room_number, ip.speciality_id, ip.is_mind_matter, ipm.doctor_id
    FROM interview_panels ip
    LEFT JOIN interview_panel_members ipm ON ip.id = ipm.panel_id
  `);
  const allPanels = panelQuery.rows as Array<Record<string, any>>;

  const isMindMatterScore = (s: { doctorId: number; specialityId: number | null }) => {
    return allPanels.some(p => 
      p.speciality_id === s.specialityId && 
      p.doctor_id === s.doctorId && 
      p.is_mind_matter === true
    );
  };

  // 2. Compute Candidate Scores & specialty-specific values
  for (const c of candidates) {
    const candPrefs = prefs
      .filter((p) => p.candidateId === c.id && programSpecIds.has(p.specialityId))
      .sort((a, b) => a.preferenceOrder - b.preferenceOrder);
    if (candPrefs.length === 0) continue;

    // MCQ & Psychometric Exam Averages
    const candAttempts = attempts.filter((a) => a.candidateId === c.id && a.submittedAt != null);
    const mcqs = candAttempts.filter((a) => exams.find((e) => e.id === a.examId)?.kind === "mcq");
    const psychos = candAttempts.filter((a) => exams.find((e) => e.id === a.examId)?.kind?.startsWith("psychometric"));

    const mcqScore = mcqs.length > 0 ? mcqs.reduce((s, a) => s + (a.score ?? 0), 0) / mcqs.length : (Number(c.mcqScore) || 0);

    // Compute candidate-wide Mind Matter score based on direct psychometric score or doctor Mind Matter panel entries
    const mmInterviews = interviews.filter((i) => i.candidateId === c.id && isMindMatterScore(i));
    const avgMindMatter = mmInterviews.length > 0
      ? mmInterviews.reduce((s, i) => s + i.score, 0) / mmInterviews.length
      : null;

    const psychoScore = avgMindMatter !== null
      ? avgMindMatter
      : (psychos.length > 0 ? psychos.reduce((s, a) => s + (a.score ?? 0), 0) / psychos.length : (Number(c.psychometricScore) || 0));

    // Dynamic Batch and Max Marks Lookup
    const bc = batchCandidates.find(x => x.candidateId === c.id);
    const batch = bc ? batches.find(b => b.id === bc.batchId) : null;

    const mcqMax = batch?.mcqTotalMarks || 50;
    const psychoMax = batch?.psychometricTotalMarks || 50;
    const interviewMax = batch?.interviewTotalMarks || 100;

    // Scale scores dynamically
    const scaledMcq = mcqMax > 0 ? (mcqScore * wMcq) / mcqMax : mcqScore;
    
    // Scale psychometric/Mind Matter score: if it came from Mind Matter panel (avgMindMatter is out of 10), it is already scaled.
    // Otherwise scale it dynamically out of psychoMax.
    const scaledPsycho = avgMindMatter !== null
      ? psychoScore
      : (psychoMax > 0 ? (psychoScore * wPsy) / psychoMax : psychoScore);

    // Handle multiple submissions by selecting the LATEST submission by submittedAt
    const candidateSubmissions = submissions
      .filter(s => s.email?.toLowerCase() === c.email?.toLowerCase() || s.candidateId === c.id)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    const sub = candidateSubmissions[0];

    const appliedAt = sub?.submittedAt ? sub.submittedAt.toISOString() : (c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString());

    // Parse location preferences from submission centerPreference
    const preferredLocations: Record<number, string[]> = {};
    let parsedCp: Record<string, any> = {};
    if (sub?.centerPreference) {
      try {
        parsedCp = JSON.parse(sub.centerPreference);
      } catch {}
    }

    const specialityScores: Record<number, number> = {};
    const specialityInterviewScores: Record<number, number> = {};

    let maxTotalScore = 0;
    let maxInterviewScore = 0;

    for (const p of candPrefs) {
      const spec = specs.find(s => s.id === p.specialityId);
      if (!spec) continue;

      // Extract locations array for this specialty preference cleanly
      let locations: string[] = [];
      let rawLocVal: any = null;

      if (parsedCp && parsedCp[spec.name]) {
        rawLocVal = parsedCp[spec.name];
      } else if (sub?.centerPreference) {
        try {
          const directParsed = JSON.parse(sub.centerPreference);
          if (directParsed && typeof directParsed === "object" && !Array.isArray(directParsed)) {
            rawLocVal = directParsed[spec.name];
          } else {
            rawLocVal = sub.centerPreference;
          }
        } catch {
          rawLocVal = sub.centerPreference;
        }
      }

      if (!rawLocVal) {
        const customUnitKey = `unit_${spec.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
        rawLocVal = sub?.customAnswers?.[customUnitKey];
      }

      if (rawLocVal) {
        if (Array.isArray(rawLocVal)) {
          locations = rawLocVal;
        } else if (typeof rawLocVal === "string") {
          locations = rawLocVal.split(",").map(l => l.trim()).filter(Boolean);
        } else {
          locations = [String(rawLocVal)];
        }
      }
      
      // Filter out any empty, null, or "Not Applicable" choices
      preferredLocations[p.specialityId] = locations
        .map(l => l.trim())
        .filter(l => l && l.toLowerCase() !== "not applicable" && l.toLowerCase() !== "none");

      // Average interview VIVA scores across all panel doctors independently (excluding Mind Matter)
      const specInterviews = interviews.filter((i) => i.candidateId === c.id && i.specialityId === p.specialityId && !isMindMatterScore(i));
      const avgInterview = specInterviews.length > 0 
        ? specInterviews.reduce((s, i) => s + i.score, 0) / specInterviews.length 
        : 0;

      // Scale Interview (VIVA) score
      const scaledInterview = interviewMax > 0 ? (avgInterview * wInt) / interviewMax : avgInterview;

      // Sum scaled scores to get final total score (out of 110)
      const specTotalScore = scaledMcq + scaledPsycho + scaledInterview;

      specialityScores[p.specialityId] = specTotalScore;
      specialityInterviewScores[p.specialityId] = scaledInterview;

      if (specTotalScore > maxTotalScore) maxTotalScore = specTotalScore;
      if (scaledInterview > maxInterviewScore) maxInterviewScore = scaledInterview;
    }

    result.push({
      candidateId: c.id,
      candidateCode: c.candidateCode,
      fullName: c.fullName,
      mcqScore: scaledMcq,
      psychometricScore: scaledPsycho,
      interviewScore: maxInterviewScore,
      totalScore: maxTotalScore,
      preferenceSpecIds: candPrefs.map((p) => p.specialityId),
      overallRank: 0,
      specialityRanks: {},
      specialityScores,
      specialityInterviewScores,
      segmentRanks: {},
      preferredLocations,
      appliedAt,
    });
  }

  // 3. Compute Ranks
  // A. Overall Rank - Sorted by Best aggregate totalScore, MCQ, then Interview, then AppliedAt
  result.sort((a, b) => {
    if (Math.abs(b.totalScore - a.totalScore) > 0.001) return b.totalScore - a.totalScore;
    if (Math.abs(b.mcqScore - a.mcqScore) > 0.001) return b.mcqScore - a.mcqScore;
    if (Math.abs(b.interviewScore - a.interviewScore) > 0.001) return b.interviewScore - a.interviewScore;
    return new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime();
  });
  result.forEach((c, idx) => {
    c.overallRank = idx + 1;
  });

  // B. Speciality-wise Rank - Independent ranks for each specialty candidate applied to
  for (const spec of specs) {
    const specCandidates = result.filter(c => c.specialityScores[spec.id] !== undefined);
    specCandidates.sort((a, b) => {
      const scoreA = a.specialityScores[spec.id]!;
      const scoreB = b.specialityScores[spec.id]!;
      const intA = a.specialityInterviewScores[spec.id]!;
      const intB = b.specialityInterviewScores[spec.id]!;
      if (Math.abs(scoreB - scoreA) > 0.001) return scoreB - scoreA;
      if (Math.abs(b.mcqScore - a.mcqScore) > 0.001) return b.mcqScore - a.mcqScore;
      if (Math.abs(intB - intA) > 0.001) return intB - intA;
      return new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime();
    });
    specCandidates.forEach((c, index) => {
      c.specialityRanks[spec.id] = index + 1;
    });
  }

  // C. Segment-wise Rank - Independent rankings for Retina vs Anterior Segments
  const segments = ["Retina", "Anterior"] as const;
  for (const seg of segments) {
    const segCandidates = result.filter(c => {
      return c.preferenceSpecIds.some(specId => {
        const spec = specs.find(s => s.id === specId);
        return spec ? getSpecialitySegment(spec.name) === seg : false;
      });
    });
    segCandidates.sort((a, b) => {
      // Find candidate's best specialty score in this segment
      const getBestSegScore = (cand: CandidateScore) => {
        let max = 0;
        cand.preferenceSpecIds.forEach(id => {
          const spec = specs.find(s => s.id === id);
          if (spec && getSpecialitySegment(spec.name) === seg) {
            const sc = cand.specialityScores[id] ?? 0;
            if (sc > max) max = sc;
          }
        });
        return max;
      };
      const scoreA = getBestSegScore(a);
      const scoreB = getBestSegScore(b);
      if (Math.abs(scoreB - scoreA) > 0.001) return scoreB - scoreA;
      if (Math.abs(b.mcqScore - a.mcqScore) > 0.001) return b.mcqScore - a.mcqScore;
      if (Math.abs(b.interviewScore - a.interviewScore) > 0.001) return b.interviewScore - a.interviewScore;
      return new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime();
    });
    segCandidates.forEach((c, index) => {
      c.segmentRanks[seg] = index + 1;
    });
  }

  return result;
}


import { 
  db, 
  candidatesTable, 
  candidatePreferencesTable, 
  examAttemptsTable, 
  examsTable, 
  interviewScoresTable, 
  specialitiesTable, 
  globalSettingsTable,
  applicationSubmissionsTable
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
  const programSpecIds = new Set(specs.map((s) => s.id));

  // 1. Retrieve dynamic weight configurations from global settings
  let wMcq = 0.60;
  let wPsy = 0.10;
  let wInt = 0.30;
  try {
    const [setting] = await db.select().from(globalSettingsTable).where(eq(globalSettingsTable.key, "merit_weights"));
    if (setting) {
      const parsed = JSON.parse(setting.value);
      if (parsed.mcq !== undefined) wMcq = Number(parsed.mcq) / 100;
      if (parsed.psychometric !== undefined) wPsy = Number(parsed.psychometric) / 100;
      if (parsed.interview !== undefined) wInt = Number(parsed.interview) / 100;
    }
  } catch (e) {
    console.error("Failed to load merit weights, using default 60/10/30 weights config", e);
  }

  const result: CandidateScore[] = [];

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
    const psychoScore = psychos.length > 0 ? psychos.reduce((s, a) => s + (a.score ?? 0), 0) / psychos.length : (Number(c.psychometricScore) || 0);

    const sub = submissions.find(s => s.email === c.email || s.candidateId === c.id);
    const appliedAt = sub?.submittedAt ? sub.submittedAt.toISOString() : (c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString());

    // Parse location preferences from submission centerPreference
    const preferredLocations: Record<number, string[]> = {};
    let parsedCp: Record<string, string[]> = {};
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

      // Extract locations array for this specialty preference
      let locations: string[] = [];
      if (parsedCp[spec.name]) {
        locations = Array.isArray(parsedCp[spec.name]) ? parsedCp[spec.name]! : [String(parsedCp[spec.name])];
      } else {
        // Find custom_answers like unit_cornea preferences
        const customUnitKey = `unit_${spec.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
        const answerVal = sub?.customAnswers?.[customUnitKey];
        if (answerVal) {
          locations = Array.isArray(answerVal) ? answerVal : [String(answerVal)];
        }
      }
      preferredLocations[p.specialityId] = locations.map(l => l.trim());

      // Average interview scores across all panel doctors independently
      const specInterviews = interviews.filter((i) => i.candidateId === c.id && i.specialityId === p.specialityId);
      const avgInterview = specInterviews.length > 0 
        ? specInterviews.reduce((s, i) => s + i.score, 0) / specInterviews.length 
        : 0;

      // Weighted aggregate score calculation
      const specTotalScore = (mcqScore * wMcq) + (psychoScore * wPsy) + (avgInterview * wInt);

      specialityScores[p.specialityId] = specTotalScore;
      specialityInterviewScores[p.specialityId] = avgInterview;

      if (specTotalScore > maxTotalScore) maxTotalScore = specTotalScore;
      if (avgInterview > maxInterviewScore) maxInterviewScore = avgInterview;
    }

    result.push({
      candidateId: c.id,
      candidateCode: c.candidateCode,
      fullName: c.fullName,
      mcqScore,
      psychometricScore: psychoScore,
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


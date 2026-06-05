import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Users, BookOpen, Award, ClipboardList, Clock, Loader2,
  MonitorPlay, KeyRound, RefreshCw, Eye, EyeOff,
  ChevronRight, ShieldCheck, Activity, EyeIcon,
  Sparkles, TrendingUp, BarChart3, Zap, Target, Globe2,
  Trash2, ShieldAlert, CheckCircle2, AlertTriangle, PlayCircle, HelpCircle
} from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { fmtDate } from "../lib/dateUtils";

interface DashboardSummaryData {
  overall: {
    totalApplications: number;
    totalApplicants: number;
    totalApplicationsTillDate: number;
    currentDate: string;
  };
  segmentWise: {
    retina: {
      totalApplications: number;
      totalApplicants: number;
      vitreoRetinaCount: number;
      medicalRetinaCount: number;
    };
    anterior: {
      totalApplications: number;
      totalApplicants: number;
      corneaCount: number;
      cataractCount: number;
      glaucomaCount: number;
      pediatricCount: number;
      orbitCount: number;
    };
  };
  today: {
    overall: { totalApplications: number; totalApplicants: number; };
    segmentWise: { retina: number; anterior: number; };
    specializationWise: {
      vitreoRetina: number; medicalRetina: number; cornea: number;
      cataract: number; glaucoma: number; pediatric: number; orbit: number;
    };
  };
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-250 dark:bg-amber-950/40 dark:text-amber-400",
  approved: "bg-emerald-100 text-emerald-700 border-emerald-250 dark:bg-emerald-950/40 dark:text-emerald-400",
  rejected: "bg-rose-100 text-rose-700 border-rose-250 dark:bg-rose-950/40 dark:text-rose-400",
  interview_completed: "bg-indigo-100 text-indigo-700 border-indigo-250 dark:bg-indigo-950/40 dark:text-indigo-400",
  waitlisted: "bg-violet-100 text-violet-700 border-violet-250 dark:bg-violet-950/40 dark:text-violet-400",
  allocated: "bg-teal-100 text-teal-700 border-teal-250 dark:bg-teal-950/40 dark:text-teal-400",
};

const parseDeviceAgent = (ua: string | null | undefined) => {
  if (!ua) return { type: "Unknown", name: "Unknown Device" };

  // Handle parsed app device info (e.g. "iOS Mobile (App)", "Android Mobile (App)")
  if (ua.includes(" (App)")) {
    const type = ua.includes("Tablet") || ua.includes("iPad") ? "Tablet" : "Mobile";
    return { type, name: ua };
  }

  const u = ua.toLowerCase();
  let type = "Desktop";
  let name = "Unknown Device";

  if (u.includes("ipad") || (u.includes("macintosh") && navigator.maxTouchPoints > 1)) {
    type = "Tablet";
    name = "iPad";
  } else if (u.includes("iphone") || u.includes("ipod")) {
    type = "Mobile";
    name = "iPhone";
  } else if (u.includes("android")) {
    type = u.includes("mobile") ? "Mobile" : "Tablet";
    // Try to extract Android device name/model
    const match = ua.match(/\(([^)]+)\)/);
    if (match && match[1]) {
      const parts = match[1].split(";");
      const devicePart = parts.find(p => p.includes("Build/") || (!p.includes("Android") && !p.includes("Linux") && !p.includes("wv")));
      if (devicePart) {
        name = devicePart.split("Build/")[0].trim();
      } else {
        name = parts[parts.length - 1].trim();
      }
    } else {
      name = "Android Device";
    }
  } else if (u.includes("windows phone")) {
    type = "Mobile";
    name = "Windows Phone";
  } else if (u.includes("windows")) {
    type = "Desktop";
    name = "Windows PC";
  } else if (u.includes("macintosh") || u.includes("mac os")) {
    type = "Desktop";
    name = "Mac PC";
  } else if (u.includes("linux")) {
    type = "Desktop";
    name = "Linux PC";
  }

  return { type, name };
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const role = user?.role ?? "";
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [timeoutMinutes, setTimeoutMinutes] = useState("30");
  const [activeTab, setActiveTab] = useState<number | null>(null);
  const [dashboardTab, setDashboardTab] = useState<"candidates" | "sessions">("candidates");
  const [systemIp, setSystemIp] = useState("");

  useEffect(() => {
    fetch("/api/system-ip")
      .then((r) => r.json())
      .then((data) => {
        if (data && data.ip) {
          setSystemIp(data.ip);
        }
      })
      .catch((err) => console.warn("Failed to fetch system IP:", err));
  }, []);

  const { data: summary, refetch: refetchSummary, isFetching } = useQuery<DashboardSummaryData>({
    queryKey: ["dashboard-summary"],
    queryFn: () => api.get<DashboardSummaryData>("/dashboard/summary"),
    refetchInterval: 120000,
    retry: false,
  });

  const { data: activeSessions = [], refetch: refetchSessions } = useQuery<any[]>({
    queryKey: ["active-sessions"],
    queryFn: () => api.get<any[]>("/auth/sessions"),
    enabled: !["student"].includes(role),
    refetchInterval: 5000,
  });

  const { data: timeoutSetting, refetch: refetchTimeout } = useQuery<any>({
    queryKey: ["session-timeout"],
    queryFn: () => api.get<any>("/global-settings/session_inactivity_timeout"),
    enabled: !["student"].includes(role),
  });

  useEffect(() => {
    if (timeoutSetting?.value) {
      setTimeoutMinutes(timeoutSetting.value);
    }
  }, [timeoutSetting]);

  const saveTimeoutMutation = useMutation({
    mutationFn: (value: string) => api.patch(`/global-settings/session_inactivity_timeout`, { value }),
    onSuccess: () => {
      toast({ title: "Inactivity timeout updated" });
      refetchTimeout();
    },
    onError: (e: any) => toast({ title: "Failed to update timeout", description: e.message, variant: "destructive" }),
  });

  const terminateSessionMutation = useMutation({
    mutationFn: (sessionId: number) => api.post("/auth/sessions/terminate", { sessionId }),
    onSuccess: () => {
      toast({ title: "User session terminated successfully" });
      refetchSessions();
    },
    onError: (e: any) => toast({ title: "Failed to terminate session", description: e.message, variant: "destructive" }),
  });

  const [tvCodeOpen, setTvCodeOpen] = useState(false);
  const [tvCode, setTvCode] = useState("");
  const [generatingTv, setGeneratingTv] = useState(false);
  const [showTvCode, setShowTvCode] = useState(false);

  const loadTvCode = async () => {
    try {
      const res = await api.get<{ code: string }>("/tv-access/code");
      setTvCode(res.code);
    } catch (e) { console.error("Failed to load TV access code", e); }
  };

  const generateTvCode = async () => {
    setGeneratingTv(true);
    try {
      const res = await api.post<{ code: string }>("/tv-access/code/generate", {});
      setTvCode(res.code);
      toast({ title: "New TV Access Code generated successfully" });
    } catch {
      toast({ title: "Failed to generate code", variant: "destructive" });
    } finally { setGeneratingTv(false); }
  };

  const { data: candidates = [] } = useQuery<any[]>({
    queryKey: ["candidates"],
    queryFn: () => api.get<any[]>("/candidates"),
    enabled: !["student"].includes(role),
    refetchInterval: 5000,
  });

  const { data: specialities = [] } = useQuery<any[]>({
    queryKey: ["specialities"],
    queryFn: () => api.get<any[]>("/specialities"),
    enabled: !["student"].includes(role),
  });

  useEffect(() => {
    if (specialities.length > 0 && !activeTab) {
      setActiveTab(specialities[0].id);
    }
  }, [specialities, activeTab]);

  // ── Student view ──────────────────────────────────────────────────────────
  if (role === "student") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 p-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-orange-600 to-amber-500 p-8 text-white shadow-2xl mb-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
          <div className="relative z-10">
            <p className="text-orange-100 text-sm font-bold uppercase tracking-widest mb-1">Candidate Portal</p>
            <h1 className="text-3xl font-black tracking-tight">Welcome, {user?.fullName}</h1>
            <p className="text-orange-100 text-sm mt-1">Fellowship Admission Dashboard</p>
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { icon: <BookOpen className="h-5 w-5" />, label: "Assigned Test", sub: "Access scheduled MCQ exams & psychometry", color: "amber", path: "/exams" },
            { icon: <ClipboardList className="h-5 w-5" />, label: "My Scores", sub: "Track finished attempt metrics and grades", color: "sky", path: "/results" },
            { icon: <Award className="h-5 w-5" />, label: "Allocation Status", sub: "Awaiting interview completions", color: "teal", path: null },
          ].map(({ icon, label, sub, color, path }) => (
            <div
              key={label}
              onClick={() => path && navigate(path)}
              className={`bg-white border border-${color}-100 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer hover:-translate-y-1`}
            >
              <div className={`w-11 h-11 rounded-xl bg-${color}-50 text-${color}-600 flex items-center justify-center mb-4 border border-${color}-100`}>{icon}</div>
              <h4 className="text-xl font-black text-slate-900">{label}</h4>
              <p className="text-sm text-slate-500 mt-1">{sub}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalApps = summary?.overall?.totalApplications ?? 0;
  const totalApplicants = summary?.overall?.totalApplicants ?? 0;
  const todayApps = summary?.today?.overall?.totalApplications ?? 0;
  const retinaTotal = summary?.segmentWise?.retina?.totalApplications ?? 0;
  const anteriorTotal = summary?.segmentWise?.anterior?.totalApplications ?? 0;

  // Station lists to display in candidate matrix
  const matrixStations = ["Mind Mapping", ...specialities.map(s => s.name)];

  return (
    <div className="min-h-screen bg-white p-4 md:p-8 space-y-8 animate-in fade-in duration-500">

      {/* ── HERO HEADER ─────────────────────────────────────────────────── */}
      {/* ── HERO HEADER ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-orange-50/20 p-6 md:p-10 shadow-lg">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-100/30 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-100/20 rounded-full -ml-16 -mb-16 blur-2xl" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-orange-50/80 rounded-full px-4 py-1.5 border border-orange-100">
                <ShieldCheck className="h-3.5 w-3.5 text-orange-600" />
                <span className="text-[10px] font-bold text-orange-800 uppercase tracking-widest">Secure Master Terminal {systemIp ? `(${systemIp})` : ""}</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-100 rounded-full px-4 py-1.5 border border-slate-250">
                <Clock className="h-3.5 w-3.5 text-slate-500 animate-spin" style={{ animationDuration: '8s' }} />
                <span className="text-[10px] font-bold text-slate-655 uppercase tracking-widest">
                  {summary?.overall?.currentDate ? fmtDate(summary.overall.currentDate) : "Loading..."}
                </span>
              </div>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 leading-tight">
              Sankara Academy of Vision
            </h1>
            <h2 className="text-xl md:text-2xl font-black text-orange-600 tracking-tight mt-1 uppercase">
              Phase 2 Master Command Center
            </h2>
            <p className="text-xs md:text-sm font-semibold text-slate-550 max-w-2xl leading-relaxed">
              Real-time candidate tracking, session monitoring & smart panel suggestions.
            </p>
            <div className="pt-1.5">
              <span className="text-xs font-bold text-slate-500 bg-slate-100/70 border border-slate-200 px-3 py-1 rounded-full uppercase tracking-wider">
                Active User: <span className="text-slate-800 font-black">{user?.fullName}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchSummary();
                refetchSessions();
              }}
              disabled={isFetching}
              className="h-11 px-5 w-full sm:w-auto rounded-xl bg-white border-slate-250 text-slate-700 hover:bg-slate-50 font-bold text-xs uppercase tracking-wider gap-2 shadow-sm"
            >
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sync Live Data
            </Button>
            {(role === "super_admin" || role === "program_admin") && (
              <Button
                onClick={() => { setTvCodeOpen(true); setShowTvCode(false); loadTvCode(); }}
                className="h-11 px-5 w-full sm:w-auto rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider gap-2 shadow-md border-none"
              >
                <MonitorPlay className="h-4 w-4" />
                Live TV Access
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── COHORT COUNTERS Pulse Bar ───────────────────────────────────────── */}
      <div className="bg-white rounded-3xl shadow-lg border border-orange-100 p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <h3 className="font-extrabold text-sm text-slate-800">Live Interview Progress Summary</h3>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-0.5">Live status metrics</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { val: candidates.length, label: "Total Candidates", col: "text-slate-900 bg-slate-50 border-slate-100" },
            { val: candidates.filter(c => c.status === "pending").length, label: "Waiting", col: "text-amber-600 bg-amber-50 border-amber-100" },
            { val: candidates.filter(c => c.status === "approved").length, label: "Approved / Active", col: "text-blue-600 bg-blue-50 border-blue-100" },
            { val: candidates.filter(c => c.psychometricScore).length, label: "Mind Map Finished", col: "text-indigo-600 bg-indigo-50 border-indigo-100" },
            { val: candidates.filter(c => c.status === "interview_completed").length, label: "Fully Completed", col: "text-emerald-600 bg-emerald-50 border-emerald-100" },
          ].map(({ val, label, col }) => (
            <div key={label} className={`rounded-2xl p-4 border text-center ${col} shadow-sm`}>
              <div className="text-2xl font-black">{val}</div>
              <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1 leading-tight">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TOP-LEVEL DASHBOARD NAVIGATION TABS ───────────────────────────── */}
      <div className="flex border-b border-slate-200 gap-6 mt-4">
        <button
          onClick={() => setDashboardTab("candidates")}
          className={`pb-3 font-extrabold text-sm transition-all border-b-2 px-2 relative ${
            dashboardTab === "candidates"
              ? "border-orange-500 text-slate-900 font-black"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Candidate Specialty Matrix
          </span>
        </button>
        {(role === "super_admin" || role === "program_admin") && (
          <button
            onClick={() => setDashboardTab("sessions")}
            className={`pb-3 font-extrabold text-sm transition-all border-b-2 px-2 relative ${
              dashboardTab === "sessions"
                ? "border-orange-500 text-slate-900 font-black"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <span className="flex items-center gap-2">
              <Globe2 className="h-4 w-4" />
              Active Logins & Sessions
              <Badge className="bg-orange-100 text-orange-600 rounded-full px-1.5 py-0.5 text-[10px] border-none font-bold">
                {activeSessions.length}
              </Badge>
            </span>
          </button>
        )}
      </div>

      {dashboardTab === "candidates" ? (
        /* ── CANDIDATE PROGRESS SUB TABS (SPECIALTIES) ───────────────────────── */
        <div className="bg-white rounded-[32px] shadow-lg border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 bg-white text-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-black text-lg tracking-tight flex items-center gap-2 text-slate-900">
                <ClipboardList className="h-5 w-5 text-orange-600" />
                Candidate Specialty Matrix
              </h3>
              <p className="text-xs text-slate-550 mt-1">
                Select a specialty tab below to view candidates and track their specific queue status, pre-interview scores, and smart next-station suggestion.
              </p>
            </div>
            <Badge className="bg-orange-500 text-white font-bold h-7 px-3 text-[10px] uppercase border-none rounded-full shrink-0">
              {candidates.length} Registered
            </Badge>
          </div>

          {/* Tab Controls */}
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex flex-wrap gap-2">
            {specialities.map((s) => {
              const count = candidates.filter((c) => 
                c.applications?.some((app: any) => app.specialityId === s.id)
              ).length;
              const isActive = activeTab === s.id;
              return (
                <Button
                  key={s.id}
                  variant={isActive ? "default" : "outline"}
                  onClick={() => setActiveTab(s.id)}
                  className={`h-10 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 gap-2 shrink-0 ${
                    isActive
                      ? "bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20"
                      : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"
                  }`}
                >
                  {s.name}
                  <Badge className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${isActive ? 'bg-white text-orange-600' : 'bg-slate-100 text-slate-655'}`}>
                    {count}
                  </Badge>
                </Button>
              );
            })}
          </div>

          {/* Candidate List for Active Specialty */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left px-6 py-3.5 font-black text-[10px] text-slate-500 uppercase tracking-widest w-64">Candidate Name & Code</th>
                  <th className="text-left px-4 py-3.5 font-black text-[10px] text-slate-500 uppercase tracking-widest">Hall Ticket Number</th>
                  <th className="text-center px-4 py-3.5 font-black text-[10px] text-slate-500 uppercase tracking-widest">MCQ Marks</th>
                  <th className="text-center px-4 py-3.5 font-black text-[10px] text-slate-500 uppercase tracking-widest">Mind Map Marks</th>
                  <th className="text-center px-4 py-3.5 font-black text-[10px] text-slate-500 uppercase tracking-widest">Interview Status</th>
                  <th className="text-left px-5 py-3.5 font-black text-[10px] text-slate-500 uppercase tracking-widest w-72">Smart Next Station Suggestion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(() => {
                  const filteredCandidates = candidates.filter((c) => 
                    c.applications?.some((app: any) => app.specialityId === activeTab)
                  );

                  if (filteredCandidates.length === 0) {
                    return (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-400 font-bold italic">
                          No candidates have applied for this specialty
                        </td>
                      </tr>
                    );
                  }

                  return filteredCandidates.map((c) => {
                    const app = c.applications?.find((a: any) => a.specialityId === activeTab);
                    if (!app) return null;

                    const mmDone = c.psychometricScore !== null && c.psychometricScore !== undefined && String(c.psychometricScore).trim() !== "";
                    const mmScoreVal = mmDone ? parseFloat(c.psychometricScore) : null;

                    const mcqDone = c.mcqScore !== null && c.mcqScore !== undefined && String(c.mcqScore).trim() !== "";
                    const mcqScoreVal = mcqDone ? parseFloat(c.mcqScore) : null;

                    // Suggest next stations
                    const pendingStations: string[] = [];
                    if (!mmDone) pendingStations.push("Mind Mapping Panel");
                    
                    c.applications?.forEach((a: any) => {
                      if (a.status !== "completed") {
                        const sp = specialities.find(s => s.id === a.specialityId);
                        if (sp) pendingStations.push(`${sp.name} Panel`);
                      }
                    });

                    // Application status badge styling
                    let statusBadge = (
                      <Badge variant="outline" className="text-amber-600 border-amber-250 bg-amber-50 text-[10px] font-extrabold uppercase rounded px-2.5 py-1">
                        Pending
                      </Badge>
                    );

                    if (app.status === "completed") {
                      statusBadge = (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-250 text-[10px] font-extrabold uppercase rounded px-2.5 py-1">
                          Completed
                        </Badge>
                      );
                    } else if (app.status === "in_progress") {
                      statusBadge = (
                        <Badge className="bg-orange-100 text-orange-700 border-orange-250 text-[10px] font-extrabold uppercase rounded px-2.5 py-1 animate-pulse">
                          Interviewing
                        </Badge>
                      );
                    } else if (app.status === "called") {
                      statusBadge = (
                        <Badge className="bg-blue-100 text-blue-700 border-blue-250 text-[10px] font-extrabold uppercase rounded px-2.5 py-1">
                          Called
                        </Badge>
                      );
                    } else if (app.status === "hold") {
                      statusBadge = (
                        <Badge className="bg-violet-100 text-violet-700 border-violet-250 text-[10px] font-extrabold uppercase rounded px-2.5 py-1">
                          Hold
                        </Badge>
                      );
                    } else if (app.status === "absent") {
                      statusBadge = (
                        <Badge className="bg-rose-100 text-rose-700 border-rose-250 text-[10px] font-extrabold uppercase rounded px-2.5 py-1">
                          Absent
                        </Badge>
                      );
                    }

                    return (
                      <tr key={c.id} className="hover:bg-orange-50/20 last:border-none transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-extrabold text-sm text-slate-900">{c.fullName}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono mt-0.5">{c.candidateCode}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 font-mono font-bold text-xs text-slate-700">
                          {app.hallTicketNumber || "—"}
                        </td>
                        <td className="px-4 py-4 text-center font-mono font-bold text-sm text-slate-800">
                          {mcqDone ? mcqScoreVal : "—"}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {mmDone ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-extrabold uppercase rounded px-2 py-0.5 h-6">
                              Completed ({mmScoreVal})
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-400 border-slate-200 bg-slate-50 text-[10px] font-extrabold uppercase rounded px-2 py-0.5 h-6">
                              Pending
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {statusBadge}
                        </td>
                        <td className="px-5 py-4 text-left">
                          {pendingStations.length === 0 ? (
                            <span className="text-emerald-600 font-extrabold text-xs flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4" /> Fully Interview Completed
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {pendingStations.map((station, idx) => (
                                <Badge key={station} variant="secondary" className={`text-[9px] font-extrabold uppercase px-2 h-5 rounded border ${idx === 0 ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-slate-50 border-slate-200 text-slate-655'}`}>
                                  {idx === 0 ? "👉 " : ""}{station}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── ACTIVE LOGIN USER SESSIONS MONITOR TAB ─────────────────────────── */
        <div className="bg-white rounded-[32px] shadow-lg border border-slate-200 overflow-hidden">
          <div className="px-8 py-5 border-b border-slate-200 bg-white text-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100">
                <Globe2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Active User Logins ({activeSessions.length})</h3>
                <p className="text-[10px] text-slate-500 font-bold">Autodetects and terminates active doctor or admin sessions</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchSessions()}
              className="h-8 text-[10px] bg-white border border-slate-200 text-slate-700 font-extrabold uppercase rounded-lg hover:bg-slate-50 shadow-sm"
            >
              Refresh Sessions
            </Button>
          </div>

          {activeSessions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm font-bold flex flex-col items-center justify-center gap-2 bg-slate-50/50">
              <ShieldAlert className="h-8 w-8 text-slate-350" />
              No active logged-in sessions detected
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left px-6 py-3.5 font-black text-[10px] text-slate-500 uppercase tracking-widest">User Info</th>
                    <th className="text-left px-4 py-3.5 font-black text-[10px] text-slate-500 uppercase tracking-widest">IP Address</th>
                    <th className="text-left px-4 py-3.5 font-black text-[10px] text-slate-500 uppercase tracking-widest">Device Type & Name</th>
                    <th className="text-left px-4 py-3.5 font-black text-[10px] text-slate-500 uppercase tracking-widest">Last Active</th>
                    <th className="text-right px-6 py-3.5 font-black text-[10px] text-slate-500 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeSessions.map((sess) => {
                    const parsedAgent = parseDeviceAgent(sess.deviceInfo);
                    return (
                      <tr key={sess.id} className="hover:bg-orange-50/10">
                        <td className="px-6 py-3.5">
                          <p className="font-extrabold text-sm text-slate-900">{sess.userName}</p>
                          <p className="text-xs text-muted-foreground">{sess.userEmail}</p>
                          <Badge variant="outline" className="text-[9px] uppercase tracking-wider h-5 mt-1 border-indigo-200 text-indigo-700 bg-indigo-50 font-bold">
                            {sess.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-slate-655">{sess.ipAddress || "N/A"}</td>
                        <td className="px-4 py-3.5">
                          <div className="space-y-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {parsedAgent.type}
                            </span>
                            <p className="text-xs font-bold text-slate-850">
                              {parsedAgent.name}
                            </p>
                            <p className="text-[9px] font-semibold text-slate-400 max-w-[200px] truncate" title={sess.deviceInfo}>
                              {sess.deviceInfo || "Raw agent unavailable"}
                            </p>
                          </div>
                        </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 font-mono">
                        {new Date(sess.lastActivityAt).toLocaleTimeString("en-IN")}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={terminateSessionMutation.isPending}
                          onClick={() => {
                            if (window.confirm(`Force logout user "${sess.userName}"? This will invalidate their active session.`)) {
                              terminateSessionMutation.mutate(sess.id);
                            }
                          }}
                          className="h-8 px-3 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl font-bold text-xs uppercase border border-rose-100 flex items-center gap-1.5 ml-auto"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Close Session
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── THIRD SECTION: CONFIG & DOCK CONTROLS ───────────────────────────── */}
      {(role === "super_admin" || role === "program_admin") && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Dynamic Timeout Config */}
          <div className="bg-white rounded-3xl shadow-lg border border-orange-100 p-6 space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-orange-500" />
              Session Inactivity Setting
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Define the session inactivity limit. Inactive users are automatically logged out after this duration.
            </p>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                max={1440}
                value={timeoutMinutes}
                onChange={(e) => setTimeoutMinutes(e.target.value)}
                placeholder="Minutes..."
                className="h-10 rounded-xl border-slate-200 focus:ring-orange-500 text-sm font-bold font-mono"
              />
              <Button
                disabled={!timeoutMinutes || saveTimeoutMutation.isPending}
                onClick={() => saveTimeoutMutation.mutate(timeoutMinutes)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold h-10 px-4 rounded-xl text-xs uppercase"
              >
                Apply
              </Button>
            </div>
          </div>

          {/* Export Card */}
          <div className="relative overflow-hidden rounded-3xl shadow-xl bg-gradient-to-br from-orange-600 to-amber-500">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="relative z-10 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-[9px] font-bold text-orange-100 uppercase tracking-[0.25em]">Appraisal Engine</p>
                  <h4 className="text-lg font-black text-white tracking-tight">Cycle Appraisal Excel</h4>
                </div>
              </div>
              <p className="text-xs text-orange-100 leading-relaxed">
                Download structured spreadsheets containing candidate ranking, specialization matrices, and evaluators.
              </p>
              <button
                onClick={async () => {
                  try {
                    const blob = await api.getBlob("/reports/cycle-report");
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.setAttribute("download", `SAV_Cycle_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.URL.revokeObjectURL(url);
                    toast({ title: "Cycle Report Downloaded", description: "Successfully downloaded SAV_Cycle_Report.xlsx" });
                  } catch {
                    toast({ title: "Download Failed", description: "Could not generate cycle report", variant: "destructive" });
                  }
                }}
                className="w-full h-11 bg-white text-orange-600 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-orange-50 transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Download Cycle Report
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ── TV Access Code Dialog ───────────────────────────────────────── */}
      <Dialog open={tvCodeOpen} onOpenChange={setTvCodeOpen}>
        <DialogContent className="sm:max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 text-xl font-black">
              <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                <KeyRound className="h-4 w-4" />
              </div>
              Live TV Portal Access
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-sm">
              Use this code to pair public queue screens to the dashboard stream safely.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-6 space-y-4">
            <div className="relative">
              <Input
                readOnly
                value={showTvCode ? tvCode : "••••••"}
                className="w-52 h-16 text-center text-3xl font-black tracking-[0.3em] bg-slate-50 border-slate-200 text-slate-900 rounded-2xl focus:ring-orange-500"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-3 h-10 w-10 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl"
                onClick={() => setShowTvCode(!showTvCode)}
              >
                {showTvCode ? <EyeOff className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </Button>
            </div>
            <p className="text-[10px] text-slate-400 text-center max-w-xs leading-relaxed uppercase tracking-wider font-bold">
              Pairs live wait screens for candidate queue displays
            </p>
          </div>
          <DialogFooter className="sm:justify-between border-t border-slate-100 pt-4">
            <Button variant="ghost" onClick={() => setTvCodeOpen(false)} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl">Close</Button>
            <Button onClick={generateTvCode} disabled={generatingTv} className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl h-10 px-5 gap-2 shadow-lg">
              {generatingTv ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Users, BookOpen, Award, ClipboardList, Clock, Loader2,
  MonitorPlay, KeyRound, RefreshCw, Eye, EyeOff,
  ChevronRight, ShieldCheck, Activity, EyeIcon,
  Sparkles, TrendingUp, BarChart3, Zap, Target, Globe2
} from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { useState } from "react";
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
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-100 text-rose-700 border-rose-200",
  interview_completed: "bg-sky-100 text-sky-700 border-sky-200",
  waitlisted: "bg-violet-100 text-violet-700 border-violet-200",
  allocated: "bg-teal-100 text-teal-700 border-teal-200",
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const role = user?.role ?? "";
  const [, navigate] = useLocation();

  const { data: summary, refetch: refetchSummary, isFetching } = useQuery<DashboardSummaryData>({
    queryKey: ["dashboard-summary"],
    queryFn: () => api.get<DashboardSummaryData>("/dashboard/summary"),
    refetchInterval: 120000,
    retry: false,
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

  const { data: candidates } = useQuery({
    queryKey: ["candidates"],
    queryFn: () => api.get<{ id: number; fullName: string; status: string; candidateCode: string }[]>("/candidates"),
    enabled: !["student"].includes(role),
    retry: false,
  });

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

  const canSeeCandidates = ["super_admin", "program_admin", "central_exam_coordinator", "unit_coordinator"].includes(role);
  const totalApps = summary?.overall?.totalApplications ?? 0;
  const totalApplicants = summary?.overall?.totalApplicants ?? 0;
  const todayApps = summary?.today?.overall?.totalApplications ?? 0;
  const retinaTotal = summary?.segmentWise?.retina?.totalApplications ?? 0;
  const anteriorTotal = summary?.segmentWise?.anterior?.totalApplications ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50/60 p-8 space-y-8">

      {/* ── HERO HEADER ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[40px] shadow-2xl">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-orange-600 to-amber-500" />
        {/* Decorative orbs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-400/20 rounded-full -ml-16 -mb-16 blur-2xl" />
        {/* Animated grid */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />

        <div className="relative z-10 p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md rounded-full px-4 py-1.5 border border-white/30">
                <ShieldCheck className="h-3.5 w-3.5 text-white" />
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">Secure Coordinator Terminal</span>
              </div>
              <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md rounded-full px-4 py-1.5 border border-white/30">
                <Clock className="h-3.5 w-3.5 text-amber-200 animate-spin" style={{ animationDuration: '8s' }} />
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">
                  {summary?.overall?.currentDate ? fmtDate(summary.overall.currentDate) : "Loading..."}
                </span>
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
              Welcome back,{" "}
              <span className="text-amber-200">{user?.fullName}</span>
            </h1>
            <p className="text-orange-100 text-sm max-w-xl leading-relaxed">
              Sankara Academy of Vision — Fellowship Examination Command Center. Real-time tracking, automated evaluations & merit ranking.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchSummary()}
              disabled={isFetching}
              className="h-11 px-5 rounded-xl bg-white/20 border-white/30 text-white hover:bg-white/30 backdrop-blur-md font-bold text-xs uppercase tracking-wider gap-2"
            >
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sync Live Stats
            </Button>
            {(role === "super_admin" || role === "program_admin") && (
              <Button
                onClick={() => { setTvCodeOpen(true); setShowTvCode(false); loadTvCode(); }}
                className="h-11 px-5 rounded-xl bg-white text-orange-600 hover:bg-orange-50 font-bold text-xs uppercase tracking-wider gap-2 shadow-lg"
              >
                <MonitorPlay className="h-4 w-4" />
                Live TV Access
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── TODAY PULSE BAR ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-[28px] shadow-lg border border-orange-100 p-6 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
        <div className="absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b from-orange-500 to-amber-400 rounded-l-[28px]" />
        <div className="flex items-center gap-4 ml-4">
          <div className="relative">
            <span className="absolute inline-flex h-4 w-4 rounded-full bg-orange-400 opacity-70 animate-ping" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-orange-500" />
          </div>
          <div>
            <div className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Today's Live Performance</div>
            <h4 className="text-base font-black text-slate-900">Real-time stats — auto-refreshing every 2 min</h4>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 md:gap-10 w-full md:w-auto">
          {[
            { val: todayApps, label: "Today's Apps", color: "text-orange-600" },
            { val: summary?.today?.segmentWise?.retina ?? 0, label: "Retina Today", color: "text-violet-600" },
            { val: summary?.today?.segmentWise?.anterior ?? 0, label: "Anterior Today", color: "text-emerald-600" },
            { val: summary?.today?.overall?.totalApplicants ?? 0, label: "Today's Students", color: "text-amber-600" },
          ].map(({ val, label, color }) => (
            <div key={label} className="text-center">
              <div className={`text-2xl font-black ${color}`}>{val}</div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN STATS CARDS ────────────────────────────────────────────── */}
      <div className="grid gap-5 sm:grid-cols-3">
        {[
          {
            icon: <Users className="h-6 w-6" />,
            value: totalApplicants,
            label: "Unique Applicants",
            sublabel: "Registered candidates",
            badge: "Merit Cohort",
            gradient: "from-orange-500 to-amber-400",
            bg: "bg-orange-50",
            text: "text-orange-600",
            border: "border-orange-100",
          },
          {
            icon: <ClipboardList className="h-6 w-6" />,
            value: totalApps,
            label: "Total Applications",
            sublabel: "Across all specializations",
            badge: "All Nodes",
            gradient: "from-violet-500 to-purple-400",
            bg: "bg-violet-50",
            text: "text-violet-600",
            border: "border-violet-100",
          },
          {
            icon: <Activity className="h-6 w-6" />,
            value: "8",
            label: "Specializations",
            sublabel: "Active program streams",
            badge: "Live",
            gradient: "from-emerald-500 to-teal-400",
            bg: "bg-emerald-50",
            text: "text-emerald-600",
            border: "border-emerald-100",
          },
        ].map(({ icon, value, label, sublabel, badge, gradient, bg, text, border }) => (
          <div key={label} className={`bg-white rounded-3xl p-7 shadow-lg border ${border} hover:shadow-xl transition-all hover:-translate-y-0.5 group overflow-hidden relative`}>
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${gradient} opacity-5 rounded-full -mr-10 -mt-10 blur-xl`} />
            <div className="flex items-start justify-between mb-5">
              <div className={`w-12 h-12 rounded-2xl ${bg} ${text} flex items-center justify-center border ${border} shadow-sm`}>
                {icon}
              </div>
              <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 ${bg} ${text} rounded-full border ${border}`}>
                {badge}
              </span>
            </div>
            <div>
              <div className={`text-4xl font-black ${text} tracking-tight`}>{value}</div>
              <p className="text-sm font-bold text-slate-900 mt-1">{label}</p>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">{sublabel}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── SEGMENT CARDS ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* RETINA SEGMENT */}
        <div className="bg-white rounded-3xl shadow-lg border border-violet-100 overflow-hidden">
          {/* Top gradient band */}
          <div className="h-2 bg-gradient-to-r from-violet-500 to-indigo-500" />
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-100">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">RETINA SEGMENT</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vitreoretinal & Medical Retina</p>
                </div>
              </div>
              <span className="text-xl font-black text-violet-600 bg-violet-50 rounded-2xl px-4 py-2 border border-violet-100">
                {retinaTotal}
              </span>
            </div>
            <div className="space-y-3">
              {[
                { name: "Vitreoretinal Surgery", val: summary?.segmentWise?.retina?.vitreoRetinaCount ?? 0, color: "bg-violet-500", bgLight: "bg-violet-50", textCol: "text-violet-700", max: Math.max(retinaTotal, 1) },
                { name: "Medical Retina", val: summary?.segmentWise?.retina?.medicalRetinaCount ?? 0, color: "bg-indigo-500", bgLight: "bg-indigo-50", textCol: "text-indigo-700", max: Math.max(retinaTotal, 1) },
              ].map(({ name, val, color, bgLight, textCol, max }) => (
                <div key={name} className={`${bgLight} rounded-2xl p-4 border border-slate-100`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-700">{name}</span>
                    <span className={`text-sm font-black ${textCol}`}>{val}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${color} rounded-full transition-all duration-700`}
                      style={{ width: `${Math.max(5, (val / max) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t border-slate-100 flex justify-between text-xs text-slate-400 font-medium">
              <span>Unique candidates</span>
              <span className="font-bold text-slate-700">{summary?.segmentWise?.retina?.totalApplicants ?? 0}</span>
            </div>
          </div>
        </div>

        {/* ANTERIOR SEGMENT */}
        <div className="bg-white rounded-3xl shadow-lg border border-emerald-100 overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">ANTERIOR SEGMENT</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cornea, IOL, Glaucoma, Pediatric, Orbit</p>
                </div>
              </div>
              <span className="text-xl font-black text-emerald-600 bg-emerald-50 rounded-2xl px-4 py-2 border border-emerald-100">
                {anteriorTotal}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: "Cornea", val: summary?.segmentWise?.anterior?.corneaCount ?? 0, color: "text-sky-600", bg: "bg-sky-50 border-sky-100", bar: "bg-sky-500" },
                { name: "IOL / Cataract / Phaco", val: summary?.segmentWise?.anterior?.cataractCount ?? 0, color: "text-teal-600", bg: "bg-teal-50 border-teal-100", bar: "bg-teal-500" },
                { name: "Glaucoma", val: summary?.segmentWise?.anterior?.glaucomaCount ?? 0, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100", bar: "bg-emerald-500" },
                { name: "Pediatric Ophthalmology", val: summary?.segmentWise?.anterior?.pediatricCount ?? 0, color: "text-amber-600", bg: "bg-amber-50 border-amber-100", bar: "bg-amber-500" },
              ].map(({ name, val, color, bg, bar }) => (
                <div key={name} className={`${bg} border rounded-xl p-3.5`}>
                  <div className={`text-lg font-black ${color}`}>{val}</div>
                  <div className="text-[10px] text-slate-600 font-bold mt-0.5 leading-tight">{name}</div>
                  <div className="h-1 bg-white/80 rounded-full mt-2 overflow-hidden">
                    <div className={`h-full ${bar} rounded-full`} style={{ width: `${Math.max(8, (val / Math.max(anteriorTotal, 1)) * 100)}%` }} />
                  </div>
                </div>
              ))}
              <div className="col-span-2 bg-rose-50 border border-rose-100 rounded-xl p-3.5 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700">Oculoplasty / Orbit</span>
                <span className="text-lg font-black text-rose-600">{summary?.segmentWise?.anterior?.orbitCount ?? 0}</span>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-slate-100 flex justify-between text-xs text-slate-400 font-medium">
              <span>Unique candidates</span>
              <span className="font-bold text-slate-700">{summary?.segmentWise?.anterior?.totalApplicants ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── CANDIDATE FEED + EXPORT ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* Candidate Feed */}
        {candidates && candidates.length > 0 && (
          <div className="xl:col-span-8 bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Live Candidate Feed</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Latest enrolled candidates</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/candidates")}
                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 text-[10px] font-black uppercase tracking-widest rounded-xl gap-1"
              >
                View All <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
            <div className="divide-y divide-slate-50">
              {candidates.slice(0, 6).map((c, i) => (
                <div
                  key={c.id}
                  className="group flex items-center justify-between px-8 py-4 hover:bg-orange-50/50 transition-all cursor-pointer"
                  onClick={() => navigate("/candidates")}
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-11 w-11 rounded-2xl flex items-center justify-center font-black text-base shadow-sm transition-all group-hover:scale-105 ${
                      i % 4 === 0 ? 'bg-orange-100 text-orange-700' :
                      i % 4 === 1 ? 'bg-violet-100 text-violet-700' :
                      i % 4 === 2 ? 'bg-emerald-100 text-emerald-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {c.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 group-hover:text-orange-600 transition-colors">{c.fullName}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">{c.candidateCode}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge className={`rounded-full px-3 h-6 font-bold uppercase text-[9px] tracking-wider border ${statusColors[c.status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                      {(c.status || "pending").replace(/_/g, " ")}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-orange-500 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
            {candidates.length > 6 && (
              <div className="px-8 py-4 border-t border-slate-100 text-center">
                <Button variant="ghost" size="sm" onClick={() => navigate("/candidates")} className="text-orange-600 hover:bg-orange-50 font-bold text-xs">
                  +{candidates.length - 6} more candidates →
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Export / Cycle Panel */}
        <div className="xl:col-span-4 space-y-4">
          {/* Export Card */}
          <div className="relative overflow-hidden rounded-3xl shadow-xl" style={{ background: 'linear-gradient(135deg, #ea580c 0%, #f97316 40%, #f59e0b 100%)' }}>
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="relative z-10 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-orange-100 uppercase tracking-[0.25em]">Merit Appraisal Engine</p>
                  <h4 className="text-xl font-black text-white tracking-tight">Analytics Export</h4>
                </div>
              </div>
              <p className="text-xs text-orange-100 leading-relaxed mb-6">
                Download Excel spreadsheets with comprehensive statistics, bar charts, and specialization breakdowns.
              </p>
              <div className="mb-4">
                <div className="flex justify-between text-[9px] font-bold text-white/70 uppercase tracking-widest mb-1.5">
                  <span>Data Completeness</span>
                  <span>{Math.min(100, Math.round((totalApps / Math.max(totalApplicants, 1)) * 40 + 60))}%</span>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full shadow-sm transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.round((totalApps / Math.max(totalApplicants, 1)) * 40 + 60))}%` }}
                  />
                </div>
              </div>
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
                className="w-full h-12 bg-white text-orange-600 font-black text-sm uppercase tracking-widest rounded-xl hover:bg-orange-50 transition-all shadow-lg flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0"
              >
                <RefreshCw className="h-4 w-4" />
                Export Cycle Report
              </button>
            </div>
          </div>

          {/* Quick Navigation */}
          <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Globe2 className="h-3 w-3" /> Quick Navigation
            </h4>
            <div className="space-y-2">
              {[
                { label: "Candidate Registry", icon: <Users className="h-4 w-4" />, path: "/candidates", color: "orange" },
                { label: "Interview Panels", icon: <ClipboardList className="h-4 w-4" />, path: "/interviews", color: "violet" },
                { label: "Merit Results", icon: <TrendingUp className="h-4 w-4" />, path: "/results", color: "emerald" },
                { label: "Application Forms", icon: <BookOpen className="h-4 w-4" />, path: "/application-forms", color: "amber" },
              ].map(({ label, icon, path, color }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl bg-${color}-50 hover:bg-${color}-100 border border-${color}-100 transition-all group`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`text-${color}-600`}>{icon}</div>
                    <span className={`text-sm font-bold text-${color}-700`}>{label}</span>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-${color}-400 group-hover:translate-x-0.5 transition-transform`} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

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

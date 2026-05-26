import { useState, useEffect } from "react";
import { fmtDate, fmtTime } from "../lib/dateUtils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import {
  Stethoscope, UserPlus, Trash2, Star, Activity, RadioTower,
  LayoutGrid, Plus, Settings, Users, ArrowRight, CheckCircle2,
  Clock, DoorOpen, UserCheck, X, FileText, Loader2,
} from "lucide-react";
import { useToast } from "../hooks/use-toast";

interface DoctorRow {
  doctorId: number; doctorName: string; doctorEmail: string;
  unitId: number | null; unitName: string | null;
  assignments: { id: number; candidateId: number; candidateName: string; candidateCode: string; scheduledAt: string | null; status: string; score: number | null; }[];
}

interface Candidate { id: number; candidateCode: string; fullName: string; status: string; }

interface ScoreEntry {
  id: number; candidateId: number; candidateName: string; candidateCode: string;
  doctorId: number; doctorName: string; score: number; remarks: string | null; submittedAt: string; totalMarks?: number;
}

interface DoctorAssignment {
  id: number; candidateId: number; candidateCode: string; candidateName: string;
  status: string; scheduledAt: string | null;
  existingScore: { id: number; score: number; remarks: string | null; submittedAt: string } | null;
  batchId?: number;
  specialityId?: number | null;
  specialityName?: string;
}

interface PanelEntry {
  doctorId: number; doctorName: string; doctorEmail: string;
  unitId: number | null; unitName: string | null;
  isEngaged: boolean; engagedSince: string | null;
  currentCandidateId: number | null; currentCandidateName: string | null; currentCandidateCode: string | null;
  updatedAt: string;
}

interface PanelMember { doctorId: number; doctorName: string; doctorEmail: string; isMain: boolean; }
interface Panel {
  id: number; name: string; roomNumber: string; programId: number | null;
  specialityId?: number | null;
  isActive: boolean; createdAt: string; members: PanelMember[];
}

interface QueueEntry {
  id: number; panelId: number; candidateId: number; candidateName: string; candidateCode: string;
  queuePosition: number; status: string; calledAt: string | null; createdAt: string;
}

interface DoctorUser { id: number; fullName: string; email: string; role: string; }

export default function InterviewsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isCEC = user?.role === "central_exam_coordinator";
  const isAdmin = user?.role === "super_admin" || user?.role === "program_admin";
  const isDoctor = user?.role === "doctor";

  if (isDoctor) return <DoctorView toast={toast} qc={qc} />;
  if (isCEC || isAdmin) return <AdminView toast={toast} qc={qc} isCEC={isCEC} />;
  return null;
}

/* ─── Doctor View ─── */
function DoctorView({ toast, qc }: { toast: ReturnType<typeof import("../hooks/use-toast").useToast>["toast"]; qc: ReturnType<typeof useQueryClient> }) {
  const [scoreOpen, setScoreOpen] = useState<DoctorAssignment | null>(null);
  const [score, setScore] = useState("");
  const [remarks, setRemarks] = useState("");

  const { data: assignments = [] } = useQuery<DoctorAssignment[]>({
    queryKey: ["doctor-assignments"],
    queryFn: () => api.get<DoctorAssignment[]>("/interviews/assignments"),
  });

  const { data: myStatus } = useQuery<{
    isEngaged: boolean; currentCandidateId: number | null;
    currentCandidateName: string | null; currentCandidateCode: string | null;
    panelName: string | null; roomNumber: string | null;
    specialityId: number | null; specialityName: string | null;
  }>({
    queryKey: ["panel-my-status"],
    queryFn: () => api.get("/panel/my-status"),
    refetchInterval: 5000,
  });

  const toggleStatus = useMutation({
    mutationFn: (body: { isEngaged: boolean; candidateId?: number | null }) => api.patch("/panel/status", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["panel-my-status"] }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const submitScore = useMutation({
    mutationFn: ({ candidateId, score, remarks }: { candidateId: number; score: number; remarks: string }) =>
      api.post("/interviews/scores", { candidateId, score, remarks }),
    onSuccess: () => { toast({ title: "Score submitted" }); qc.invalidateQueries({ queryKey: ["doctor-assignments"] }); setScoreOpen(null); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isEngaged = myStatus?.isEngaged ?? false;

  return (
    <div className="p-6 space-y-6">
      <Card className={`border-2 ${isEngaged ? "border-red-400 bg-red-50/50 dark:bg-red-950/20" : "border-green-400 bg-green-50/50 dark:bg-green-950/20"}`}>
        <CardContent className="flex items-center justify-between py-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full animate-pulse ${isEngaged ? "bg-red-500" : "bg-green-500"}`} />
            <div>
              <p className={`font-semibold ${isEngaged ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
                {isEngaged ? "Engaged — Interview in Progress" : "Free — Available"}
              </p>
              {myStatus?.panelName && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Panel: <strong>{myStatus.panelName}</strong> · Room {myStatus.roomNumber}
                  {myStatus.specialityName && (
                    <span className="ml-1 text-primary font-medium">({myStatus.specialityName})</span>
                  )}
                </p>
              )}
              {isEngaged && myStatus?.currentCandidateName && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Candidate: <strong>{myStatus.currentCandidateName}</strong> ({myStatus.currentCandidateCode})
                </p>
              )}
            </div>
          </div>
          <Button
            variant={isEngaged ? "destructive" : "default"} size="sm" className="gap-2"
            disabled={toggleStatus.isPending}
            onClick={() => toggleStatus.mutate({ isEngaged: !isEngaged, candidateId: isEngaged ? null : undefined })}
          >
            <RadioTower className="h-4 w-4" />
            {isEngaged ? "Mark as Free" : "Mark as Engaged"}
          </Button>
        </CardContent>
      </Card>

      <div>
        <h1 className="text-2xl font-bold">My Interview Assignments</h1>
        {myStatus?.specialityName && (
          <p className="text-sm font-semibold text-primary mt-1">Specialization Panel: {myStatus.specialityName}</p>
        )}
        <p className="text-muted-foreground text-sm mt-1">{assignments.length} candidates assigned</p>
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-16">
          <Stethoscope className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No candidates assigned yet</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Candidate</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Code</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Scheduled</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">
                        <div>
                          {a.candidateName}
                          {a.specialityName && (
                            <span className="block text-[10px] text-muted-foreground">{a.specialityName}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{a.candidateCode}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {a.scheduledAt ? new Date(a.scheduledAt).toLocaleString("en-IN") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={a.status === "completed" ? "default" : "secondary"} className="text-[10px]">
                          {a.existingScore ? `Score: ${a.existingScore.score}` : a.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="outline" size="sm" onClick={() => { setScoreOpen(a); setScore(a.existingScore?.score?.toString() ?? ""); setRemarks(a.existingScore?.remarks ?? ""); }}>
                          {a.existingScore ? "Edit Score" : "Submit Score"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!scoreOpen} onOpenChange={() => setScoreOpen(null)}>
        <DialogContent className="max-w-5xl w-[90vw] p-0 rounded-3xl overflow-hidden border-none bg-white shadow-2xl">
          <DialogHeader className="bg-slate-900 text-white p-6 shrink-0 border-b border-white/5 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-black uppercase tracking-widest text-white flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-indigo-400" />
                Clinical Evaluation Station — {scoreOpen?.candidateName}
              </DialogTitle>
              {scoreOpen?.specialityName && (
                <Badge variant="outline" className="mt-2 text-[10px] font-black uppercase text-indigo-200 border-indigo-500/30 bg-indigo-500/10 h-6 px-3">
                  Specialization: {scoreOpen.specialityName}
                </Badge>
              )}
            </div>
          </DialogHeader>

          {scoreOpen && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-0 h-[70vh]">
              {/* Left Column: Comprehensive Printable Form with LOR */}
              <div className="md:col-span-3 border-r bg-slate-50 flex flex-col p-4 space-y-3">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5 text-slate-400" />
                    Applicant Dossier & Reference LOR Files
                  </span>
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border-slate-200 h-5">
                    Code: {scoreOpen.candidateCode}
                  </Badge>
                </div>
                <div className="flex-1 border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-sm relative">
                  <iframe 
                    src={`/api/print-application/${scoreOpen.candidateId}?token=${localStorage.getItem("fellowship_token")}`} 
                    className="w-full h-full border-none" 
                    title="Comprehensive Application Print View"
                  />
                </div>
              </div>

              {/* Right Column: Score entry and lock protocols */}
              <div className="md:col-span-2 p-6 flex flex-col justify-between bg-white h-full">
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Evaluation Matrix</h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      Total scoring range: 0 – {scoreOpen.batchId ? "Defined by Batch" : "100 Marks"}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Assigned Clinical Mark</Label>
                      <Input 
                        type="number" 
                        min={0} 
                        max={100}
                        value={score} 
                        onChange={(e) => setScore(e.target.value)} 
                        placeholder="Enter score..." 
                        className="h-12 border-2 rounded-xl focus:ring-indigo-500 font-bold font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Assessment Remarks</Label>
                      <textarea 
                        value={remarks} 
                        onChange={(e) => setRemarks(e.target.value)} 
                        placeholder="Clinical assessment observations, skills proficiency, panel consensus notes..." 
                        className="w-full min-h-[140px] p-3 text-sm font-semibold border-2 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 border-input bg-background"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex flex-col gap-2 shrink-0">
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setScoreOpen(null)} 
                      className="rounded-xl h-12 text-xs font-bold uppercase tracking-wider flex-1"
                    >
                      Cancel
                    </Button>
                    <Button 
                      disabled={!score || submitScore.isPending} 
                      onClick={() => scoreOpen && submitScore.mutate({ candidateId: scoreOpen.candidateId, score: Number(score), remarks })}
                      className="rounded-xl h-12 bg-slate-900 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider flex-1 gap-1.5 shadow-lg active:scale-95 transition-all"
                    >
                      {submitScore.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4 text-emerald-400" />}
                      Commit & Lock
                    </Button>
                  </div>
                  <p className="text-[9px] font-bold text-center text-slate-400 uppercase tracking-widest mt-1">
                    * Evaluation lock synchronizes marks to counseling queue atomically
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Admin / CEC View ─── */
function AdminView({ toast, qc, isCEC }: { toast: ReturnType<typeof import("../hooks/use-toast").useToast>["toast"]; qc: ReturnType<typeof useQueryClient>; isCEC: boolean }) {
  const [activeTab, setActiveTab] = useState<"panels" | "live" | "panel" | "scores">("panels");
  const [assignDoctorId, setAssignDoctorId] = useState<number | null>(null);
  const [assignCandidateId, setAssignCandidateId] = useState("");
  const [assignScheduled, setAssignScheduled] = useState("");
  const [candidateSearch, setCandidateSearch] = useState("");

  const { data: livePanel = [], isLoading: liveLoading } = useQuery<PanelEntry[]>({
    queryKey: ["panel-live"],
    queryFn: () => api.get<PanelEntry[]>("/panel/live"),
    refetchInterval: activeTab === "live" ? 4000 : false,
  });

  const { data: doctors = [], isLoading: doctorsLoading } = useQuery<DoctorRow[]>({
    queryKey: ["doctor-assignments-admin"],
    queryFn: () => api.get<DoctorRow[]>("/interviews/doctor-assignments"),
  });

  const { data: scores = [] } = useQuery<ScoreEntry[]>({
    queryKey: ["interview-scores"],
    queryFn: () => api.get<ScoreEntry[]>("/interviews/scores"),
  });

  const { data: candidates = [] } = useQuery<Candidate[]>({
    queryKey: ["candidates"],
    queryFn: () => api.get<Candidate[]>("/candidates"),
  });

  const assignMutation = useMutation({
    mutationFn: (body: { doctorId: number; candidateId: number; scheduledAt?: string }) =>
      api.post("/interviews/assign", body),
    onSuccess: () => {
      toast({ title: "Candidate assigned" });
      qc.invalidateQueries({ queryKey: ["doctor-assignments-admin"] });
      setAssignDoctorId(null); setAssignCandidateId(""); setAssignScheduled("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/interviews/assign/${id}`),
    onSuccess: () => { toast({ title: "Assignment removed" }); qc.invalidateQueries({ queryKey: ["doctor-assignments-admin"] }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filteredCandidates = candidates.filter((c) =>
    !candidateSearch || c.fullName.toLowerCase().includes(candidateSearch.toLowerCase()) || c.candidateCode.toLowerCase().includes(candidateSearch.toLowerCase())
  );

  const engagedCount = livePanel.filter((d) => d.isEngaged).length;
  const freeCount = livePanel.filter((d) => !d.isEngaged).length;
  const _ = isCEC; // suppress unused warning

  const tabs = [
    { key: "panels" as const, label: "Interview Panels", icon: LayoutGrid },
    { key: "live" as const, label: "Live Status", icon: Activity },
    { key: "panel" as const, label: "Assignments", icon: Stethoscope },
    { key: "scores" as const, label: `Scores (${scores.length})`, icon: Star },
  ];

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-black p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-600 via-amber-600 to-orange-500 p-8 text-white shadow-2xl">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/10 to-transparent blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-orange-100 text-sm font-medium">
              <Stethoscope className="h-4 w-4" />
              <span>Assessment Cycle</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight">Interviews & Panels</h1>
            <p className="text-orange-100/80 max-w-md">Orchestrate interview panels, monitor live session progress, and review faculty assessments.</p>
          </div>
          <div className="flex flex-wrap gap-2 bg-black/10 p-1.5 rounded-2xl backdrop-blur-md">
            {tabs.map((t) => (
              <Button 
                key={t.key} 
                variant={activeTab === t.key ? "default" : "ghost"} 
                size="sm" 
                onClick={() => setActiveTab(t.key)}
                className={`h-10 px-4 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all border-none ${activeTab === t.key ? 'bg-white text-orange-600 shadow-lg' : 'text-orange-50 hover:bg-white/10 hover:text-white'}`}
              >
                <t.icon className="h-4 w-4 mr-2" />{t.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* ── INTERVIEW PANELS ── */}
      {activeTab === "panels" && (
        <PanelsTab toast={toast} qc={qc} candidates={candidates} />
      )}

      {/* ── LIVE STATUS ── */}
      {activeTab === "live" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
              <CardContent className="flex items-center gap-3 py-4">
                <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center"><div className="h-3 w-3 rounded-full bg-green-500" /></div>
                <div><p className="text-2xl font-bold text-green-700 dark:text-green-400">{freeCount}</p><p className="text-xs text-green-600 dark:text-green-500">Doctors Free</p></div>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
              <CardContent className="flex items-center gap-3 py-4">
                <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center"><div className="h-3 w-3 rounded-full animate-pulse bg-red-500" /></div>
                <div><p className="text-2xl font-bold text-red-700 dark:text-red-400">{engagedCount}</p><p className="text-xs text-red-600 dark:text-red-500">Interviews in Progress</p></div>
              </CardContent>
            </Card>
          </div>
          {liveLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading panel…</div>
          ) : livePanel.length === 0 ? (
            <div className="text-center py-16"><Activity className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" /><p className="text-muted-foreground">No panel doctors configured</p></div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {livePanel.map((d) => (
                <Card key={d.doctorId} className={`border-2 transition-all duration-500 ${d.isEngaged ? "border-red-300 bg-red-50/60 dark:bg-red-950/20 dark:border-red-700" : "border-green-300 bg-green-50/60 dark:bg-green-950/20 dark:border-green-700"}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{d.doctorName}</p>
                        {d.unitName && <p className="text-[11px] text-muted-foreground">{d.unitName}</p>}
                      </div>
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${d.isEngaged ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"}`}>
                        <div className={`h-2 w-2 rounded-full ${d.isEngaged ? "bg-red-500 animate-pulse" : "bg-green-500"}`} />
                        {d.isEngaged ? "Engaged" : "Free"}
                      </div>
                    </div>
                    {d.isEngaged && d.currentCandidateName && (
                      <div className="rounded-lg bg-background/70 border p-2.5 space-y-1">
                        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Current Candidate</p>
                        <p className="text-sm font-semibold">{d.currentCandidateName}</p>
                        {d.currentCandidateCode && <p className="text-xs font-mono text-muted-foreground">{d.currentCandidateCode}</p>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <p className="text-center text-xs text-muted-foreground">Auto-refreshes every 4 seconds</p>
        </div>
      )}

      {/* ── DOCTOR ASSIGNMENTS ── */}
      {activeTab === "panel" && (
        <>
          {doctorsLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading…</div>
          ) : doctors.length === 0 ? (
            <div className="text-center py-16"><Stethoscope className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" /><p className="text-muted-foreground">No doctors found. Add doctors in the Users page.</p></div>
          ) : (
            <div className="space-y-4">
              {doctors.map((d) => (
                <Card key={d.doctorId}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{d.doctorName}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">{d.doctorEmail}</p>
                        {d.unitName && <p className="text-xs text-primary mt-0.5">Unit: {d.unitName}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {d.assignments.length} assigned · {d.assignments.filter((a) => a.status === "completed").length} done
                        </Badge>
                        <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => setAssignDoctorId(d.doctorId)}>
                          <UserPlus className="h-3.5 w-3.5" /> Assign
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {d.assignments.length > 0 && (
                    <CardContent className="pt-0">
                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/40 border-b">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Candidate</th>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Code</th>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Scheduled</th>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Status</th>
                              <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs">Score</th>
                              <th className="text-right px-3 py-2"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {d.assignments.map((a) => (
                              <tr key={a.id} className="border-t hover:bg-muted/20">
                                <td className="px-3 py-2 font-medium text-sm">{a.candidateName}</td>
                                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{a.candidateCode}</td>
                                <td className="px-3 py-2 text-xs text-muted-foreground">{a.scheduledAt ? fmtDate(a.scheduledAt) : "—"}</td>
                                <td className="px-3 py-2"><Badge variant={a.status === "completed" ? "default" : "secondary"} className="text-[10px]">{a.status}</Badge></td>
                                <td className="px-3 py-2 text-right font-semibold text-sm">{a.score != null ? a.score : "—"}</td>
                                <td className="px-3 py-2 text-right">
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => removeMutation.mutate(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── SCORES ── */}
      {activeTab === "scores" && (
        <Card>
          <CardHeader className="pb-0 pt-4 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" /> Interview Results Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 mt-4">
            {scores.length === 0 ? (
              <div className="text-center py-16"><Star className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" /><p className="text-muted-foreground">No interview scores yet</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Candidate</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Avg. Score</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Doctor Breakdown</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const grouped: Record<number, { name: string; code: string; scores: ScoreEntry[]; total: number }> = {};
                      scores.forEach((s) => {
                        if (!grouped[s.candidateId]) {
                          grouped[s.candidateId] = { name: s.candidateName, code: s.candidateCode, scores: [], total: s.totalMarks || 100 };
                        }
                        grouped[s.candidateId]!.scores.push(s);
                      });

                      return Object.entries(grouped).map(([cid, data]) => {
                        const avg = data.scores.reduce((acc, s) => acc + s.score, 0) / data.scores.length;
                        const lastDate = new Date(Math.max(...data.scores.map(s => new Date(s.submittedAt).getTime())));
                        
                        return (
                          <tr key={cid} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-4 py-3">
                              <p className="font-semibold">{data.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{data.code}</p>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex flex-col items-center">
                                <span className="text-lg font-bold text-primary">{avg.toFixed(1)}</span>
                                <span className="text-[10px] text-muted-foreground">out of {data.total}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-1.5">
                                {data.scores.map((s) => (
                                  <div key={s.id} className="flex items-center gap-2">
                                    <Badge variant="outline" className="h-5 px-1.5 font-mono text-[10px] bg-background">
                                      {s.score}
                                    </Badge>
                                    <span className="text-xs font-medium text-muted-foreground">{s.doctorName}</span>
                                    {s.remarks && (
                                      <span className="text-[10px] italic text-muted-foreground truncate max-w-[150px]" title={s.remarks}>
                                        — "{s.remarks}"
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                              {fmtDate(lastDate)}
                              <br />
                              {fmtTime(lastDate)}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Assign Dialog */}
      <Dialog open={assignDoctorId != null} onOpenChange={(o) => { if (!o) { setAssignDoctorId(null); setAssignCandidateId(""); setAssignScheduled(""); setCandidateSearch(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Assign Candidate to Doctor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Search Candidate</Label>
              <Input placeholder="Name or code…" value={candidateSearch} onChange={(e) => setCandidateSearch(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Select Candidate</Label>
              <Select value={assignCandidateId} onValueChange={setAssignCandidateId}>
                <SelectTrigger><SelectValue placeholder="Pick a candidate…" /></SelectTrigger>
                <SelectContent>
                  {filteredCandidates.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.fullName} · {c.candidateCode}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Scheduled Time (optional)</Label>
              <Input type="datetime-local" value={assignScheduled} onChange={(e) => setAssignScheduled(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAssignDoctorId(null); setAssignCandidateId(""); }}>Cancel</Button>
            <Button disabled={!assignCandidateId || assignMutation.isPending}
              onClick={() => assignDoctorId && assignMutation.mutate({ doctorId: assignDoctorId, candidateId: Number(assignCandidateId), scheduledAt: assignScheduled || undefined })}>
              {assignMutation.isPending ? "Assigning…" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Panels Tab ─── */
function PanelsTab({ toast, qc, candidates }: {
  toast: ReturnType<typeof import("../hooks/use-toast").useToast>["toast"];
  qc: ReturnType<typeof useQueryClient>;
  candidates: Candidate[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createRoom, setCreateRoom] = useState("");
  const [createSpecialityId, setCreateSpecialityId] = useState<string>("none");

  const [selectedPanelId, setSelectedPanelId] = useState<number | null>(null);
  const [addMemberDoctorId, setAddMemberDoctorId] = useState("");
  const [addCandidateId, setAddCandidateId] = useState("");
  const [candSearch, setCandSearch] = useState("");
  const [managePanel, setManagePanel] = useState<Panel | null>(null);

  const [editName, setEditName] = useState("");
  const [editRoom, setEditRoom] = useState("");
  const [editSpecialityId, setEditSpecialityId] = useState<string>("none");

  const { data: panels = [], isLoading } = useQuery<Panel[]>({
    queryKey: ["panels"],
    queryFn: () => api.get<Panel[]>("/panels"),
    refetchInterval: 8000,
  });

  const { data: specialities = [] } = useQuery<{ id: number; name: string; code: string }[]>({
    queryKey: ["specialities"],
    queryFn: () => api.get("/specialities"),
  });

  const { data: doctorUsers = [] } = useQuery<DoctorUser[]>({
    queryKey: ["users"],
    queryFn: () => api.get<DoctorUser[]>("/users"),
    select: (u) => u.filter((x) => x.role === "doctor"),
  });

  const { data: panelQueue = [] } = useQuery<QueueEntry[]>({
    queryKey: ["panel-queue", selectedPanelId],
    queryFn: () => api.get<QueueEntry[]>(`/panels/${selectedPanelId}/queue`),
    enabled: selectedPanelId !== null,
    refetchInterval: 5000,
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; roomNumber: string; specialityId?: number | null }) => api.post<Panel>("/panels", body),
    onSuccess: () => {
      toast({ title: "Panel created" });
      qc.invalidateQueries({ queryKey: ["panels"] });
      setCreateOpen(false); setCreateName(""); setCreateRoom(""); setCreateSpecialityId("none");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deletePanelMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/panels/${id}`),
    onSuccess: () => {
      toast({ title: "Panel deleted" });
      qc.invalidateQueries({ queryKey: ["panels"] });
      setSelectedPanelId(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updatePanelMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number; name?: string; roomNumber?: string; isActive?: boolean; specialityId?: number | null }) =>
      api.patch(`/panels/${id}`, body),
    onSuccess: () => {
      toast({ title: "Panel updated" });
      qc.invalidateQueries({ queryKey: ["panels"] });
      setManagePanel(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (managePanel) {
      setEditName(managePanel.name);
      setEditRoom(managePanel.roomNumber);
      setEditSpecialityId(managePanel.specialityId ? String(managePanel.specialityId) : "none");
    }
  }, [managePanel]);

  const addMemberMutation = useMutation({
    mutationFn: ({ panelId, doctorId }: { panelId: number; doctorId: number }) =>
      api.post(`/panels/${panelId}/members`, { doctorId }),
    onSuccess: () => {
      toast({ title: "Doctor added to panel" });
      qc.invalidateQueries({ queryKey: ["panels"] });
      setAddMemberDoctorId("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ panelId, doctorId }: { panelId: number; doctorId: number }) =>
      api.delete(`/panels/${panelId}/members/${doctorId}`),
    onSuccess: () => { toast({ title: "Doctor removed" }); qc.invalidateQueries({ queryKey: ["panels"] }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addToQueueMutation = useMutation({
    mutationFn: ({ panelId, candidateId }: { panelId: number; candidateId: number }) =>
      api.post(`/panels/${panelId}/queue`, { candidateId }),
    onSuccess: () => {
      toast({ title: "Added to queue" });
      qc.invalidateQueries({ queryKey: ["panel-queue", selectedPanelId] });
      setAddCandidateId(""); setCandSearch("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateQueueMutation = useMutation({
    mutationFn: ({ panelId, candidateId, status }: { panelId: number; candidateId: number; status: string }) =>
      api.patch(`/panels/${panelId}/queue/${candidateId}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["panel-queue", selectedPanelId] });
      qc.invalidateQueries({ queryKey: ["display-live"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeFromQueueMutation = useMutation({
    mutationFn: ({ panelId, candidateId }: { panelId: number; candidateId: number }) =>
      api.delete(`/panels/${panelId}/queue/${candidateId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["panel-queue", selectedPanelId] }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Auto-select first panel
  useEffect(() => {
    if (panels.length > 0 && !selectedPanelId) {
      setSelectedPanelId(panels[0]!.id);
    }
  }, [panels, selectedPanelId]);

  const selectedPanel = panels.find((p) => p.id === selectedPanelId);
  const filteredCandidates = candidates.filter((c) =>
    !candSearch || c.fullName.toLowerCase().includes(candSearch.toLowerCase()) || c.candidateCode.toLowerCase().includes(candSearch.toLowerCase())
  );

  const currentCandidate = panelQueue.find((q) => q.status === "in_progress");
  const waitingQueue = panelQueue.filter((q) => q.status === "waiting");
  const doneQueue = panelQueue.filter((q) => q.status === "done");

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading panels…</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{panels.length}</span> panels ·{" "}
          <span className="font-semibold text-emerald-600">{panels.filter((p) => p.isActive).length}</span> active
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Create Panel
        </Button>
      </div>

      {panels.length === 0 ? (
        <div className="rounded-xl border border-dashed p-16 text-center space-y-3">
          <LayoutGrid className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground font-medium">No interview panels yet</p>
          <p className="text-xs text-muted-foreground">Create a panel to assign doctors and manage the interview queue</p>
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Create First Panel</Button>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Panel list */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Panels</p>
            {panels.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPanelId(p.id)}
                className={`w-full text-left rounded-lg border p-3 transition-all ${
                  selectedPanelId === p.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 bg-card"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground">Room {p.roomNumber}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${p.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${p.isActive ? "bg-emerald-500" : "bg-gray-400"}`} />
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{p.members.length} doctors</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Panel detail */}
          {selectedPanel && (
            <div className="lg:col-span-2 space-y-4">
              {/* Panel header */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <DoorOpen className="h-4 w-4" /> Room {selectedPanel.roomNumber}
                        <span className="text-base font-normal text-muted-foreground">— {selectedPanel.name}</span>
                      </CardTitle>
                      {selectedPanel.specialityId && (
                        <div className="mt-1">
                          <Badge variant="outline" className="text-[10px] text-primary border-primary/20 bg-primary/5">
                            Specialization: {specialities.find((s) => s.id === selectedPanel.specialityId)?.name || "Mapped"}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"
                        onClick={() => updatePanelMutation.mutate({ id: selectedPanel.id, isActive: !selectedPanel.isActive })}>
                        {selectedPanel.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setManagePanel(selectedPanel)}>
                        <Settings className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => { if (window.confirm(`Delete panel "${selectedPanel.name}"?`)) deletePanelMutation.mutate(selectedPanel.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Panel Doctors</p>
                  {selectedPanel.members.length === 0 ? (
                    <p className="text-sm text-muted-foreground mb-2">No doctors assigned yet</p>
                  ) : (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {selectedPanel.members.map((m) => (
                        <div key={m.doctorId} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-sm">
                          <UserCheck className="h-3 w-3 text-primary" />
                          <span className="font-medium text-xs">{m.doctorName}</span>
                          {m.isMain && <Badge className="text-[9px] h-4 px-1">Main</Badge>}
                          <button className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                            onClick={() => removeMemberMutation.mutate({ panelId: selectedPanel.id, doctorId: m.doctorId })}>
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Select value={addMemberDoctorId} onValueChange={setAddMemberDoctorId}>
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue placeholder="Add a doctor to this panel…" />
                      </SelectTrigger>
                      <SelectContent>
                        {doctorUsers
                          .filter((d) => !selectedPanel.members.find((m) => m.doctorId === d.id))
                          .map((d) => (
                            <SelectItem key={d.id} value={String(d.id)} className="text-xs">{d.fullName}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" className="h-8 gap-1 text-xs" disabled={!addMemberDoctorId || addMemberMutation.isPending}
                      onClick={() => addMemberDoctorId && addMemberMutation.mutate({ panelId: selectedPanel.id, doctorId: Number(addMemberDoctorId) })}>
                      <UserPlus className="h-3.5 w-3.5" /> Add
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Queue */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2"><Users className="h-4 w-4" /> Interview Queue</span>
                    <Badge variant="secondary" className="text-xs">
                      {waitingQueue.length} waiting · {doneQueue.length} done
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Currently in session */}
                  {currentCandidate ? (
                    <div className="rounded-lg border-2 border-orange-400 bg-orange-50 dark:bg-orange-950/30 p-3">
                      <p className="text-[10px] font-semibold text-orange-500 uppercase tracking-wider mb-1">In Session</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{currentCandidate.candidateName}</p>
                          <p className="text-xs font-mono text-muted-foreground">{currentCandidate.candidateCode}</p>
                          {currentCandidate.calledAt && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Since {fmtTime(currentCandidate.calledAt)}
                            </p>
                          )}
                        </div>
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
                          onClick={() => updateQueueMutation.mutate({ panelId: selectedPanel.id, candidateId: currentCandidate.candidateId, status: "done" })}>
                          <CheckCircle2 className="h-3 w-3" /> Done
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
                      No active interview — call the next candidate below
                    </div>
                  )}

                  {/* Waiting list */}
                  {waitingQueue.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Waiting Queue</p>
                      {waitingQueue.map((q, i) => (
                        <div key={q.id} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                            <div>
                              <p className="text-sm font-medium">{q.candidateName}</p>
                              <p className="text-xs font-mono text-muted-foreground">{q.candidateCode}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {i === 0 && !currentCandidate && (
                              <Button size="sm" className="h-7 gap-1 text-xs"
                                onClick={() => updateQueueMutation.mutate({ panelId: selectedPanel.id, candidateId: q.candidateId, status: "in_progress" })}>
                                <ArrowRight className="h-3 w-3" /> Call
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => removeFromQueueMutation.mutate({ panelId: selectedPanel.id, candidateId: q.candidateId })}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add to queue */}
                  <div className="pt-2 border-t space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Add candidate to queue</p>
                    <Input
                      placeholder="Search candidate by name or code…" value={candSearch}
                      onChange={(e) => setCandSearch(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <div className="flex gap-2">
                      <Select value={addCandidateId} onValueChange={setAddCandidateId}>
                        <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Select candidate…" /></SelectTrigger>
                        <SelectContent>
                          {filteredCandidates
                            .filter((c) => !panelQueue.find((q) => q.candidateId === c.id && q.status !== "done"))
                            .map((c) => (
                              <SelectItem key={c.id} value={String(c.id)} className="text-xs">{c.fullName} · {c.candidateCode}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" className="h-8 text-xs gap-1" disabled={!addCandidateId || addToQueueMutation.isPending}
                        onClick={() => addCandidateId && addToQueueMutation.mutate({ panelId: selectedPanel.id, candidateId: Number(addCandidateId) })}>
                        <Plus className="h-3.5 w-3.5" /> Add
                      </Button>
                    </div>
                  </div>

                  {/* Done */}
                  {doneQueue.length > 0 && (
                    <div className="pt-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Completed Today ({doneQueue.length})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {doneQueue.map((q) => (
                          <span key={q.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs">
                            <CheckCircle2 className="h-2.5 w-2.5" /> {q.candidateCode}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {waitingQueue.length === 0 && !currentCandidate && doneQueue.length === 0 && (
                    <div className="text-center py-4 text-sm text-muted-foreground flex items-center justify-center gap-2">
                      <Clock className="h-4 w-4" /> Queue is empty — add candidates above
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Create Panel Dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); setCreateName(""); setCreateRoom(""); setCreateSpecialityId("none"); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create Interview Panel</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Panel Name</Label>
              <Input placeholder="e.g. Panel A, VR Panel…" value={createName} onChange={(e) => setCreateName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Room Number / Name</Label>
              <Input placeholder="e.g. Room 101, Conference Hall…" value={createRoom} onChange={(e) => setCreateRoom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Specialization Mapping</Label>
              <Select value={createSpecialityId} onValueChange={setCreateSpecialityId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Specialization..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (General Panel)</SelectItem>
                  {specialities.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button disabled={!createName.trim() || !createRoom.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate({
                name: createName.trim(),
                roomNumber: createRoom.trim(),
                specialityId: createSpecialityId === "none" ? null : Number(createSpecialityId)
              })}>
              {createMutation.isPending ? "Creating…" : "Create Panel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Panel Info / Manage Dialog */}
      <Dialog open={managePanel !== null} onOpenChange={(o) => { if (!o) setManagePanel(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Manage Panel — {managePanel?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Panel Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Room Number / Name</Label>
              <Input value={editRoom} onChange={(e) => setEditRoom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Specialization Mapping</Label>
              <Select value={editSpecialityId} onValueChange={setEditSpecialityId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Specialization..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (General Panel)</SelectItem>
                  {specialities.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-between border-t pt-2 text-sm">
              <span className="text-muted-foreground">Members count:</span>
              <span className="font-semibold">{managePanel?.members.length} doctors</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManagePanel(null)}>Cancel</Button>
            <Button disabled={!editName.trim() || !editRoom.trim() || updatePanelMutation.isPending}
              onClick={() => managePanel && updatePanelMutation.mutate({
                id: managePanel.id,
                name: editName.trim(),
                roomNumber: editRoom.trim(),
                specialityId: editSpecialityId === "none" ? null : Number(editSpecialityId)
              })}>
              {updatePanelMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


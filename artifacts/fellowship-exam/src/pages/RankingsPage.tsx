import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { useToast } from "../hooks/use-toast";
import { 
  Trophy, Medal, Settings2, Download, RefreshCw, 
  Sparkles, Loader2, Sliders, CheckCircle2, ChevronRight 
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";

interface Program { id: number; name: string; code: string; academicYear: string; }
interface Speciality { id: number; programId: number; name: string; code: string; seats: number; }
interface CandidateRank {
  candidateId: number;
  candidateCode: string;
  fullName: string;
  mcqScore: number;
  psychometricScore: number;
  interviewScore: number;
  totalScore: number;
  rank: number;
  specialityRank: number | null;
  segmentRank: number | null;
  topPreference: string | null;
  unitName: string | null;
  status: string | null;
  preferredLocations: string[];
  phone: string;
  email: string;
}

interface WeightConfig {
  mcq: number;
  psychometric: number;
  interview: number;
}

const statusColors: Record<string, string> = {
  allocated: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300",
  Accepted: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300",
  Upgraded: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-300",
  Withdrawn: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-300",
  WAITLISTED: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300",
  waitlisted: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300",
  rejected: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-300",
  pending: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-400",
};

function fmt(v: number | null) {
  return v != null ? v.toFixed(1) : "—";
}

export default function RankingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedProgram, setSelectedProgram] = useState<string>("");
  const [selectedTab, setSelectedTab] = useState<string>("overall");
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);

  // Weight form states
  const [weightMcq, setWeightMcq] = useState("60");
  const [weightPsy, setWeightPsy] = useState("10");
  const [weightInt, setWeightInt] = useState("30");

  const canEdit = ["super_admin", "program_admin", "central_exam_coordinator"].includes(user?.role ?? "");

  // Fetch Programs
  const { data: programs = [] } = useQuery<Program[]>({
    queryKey: ["programs"],
    queryFn: () => api.get<Program[]>("/programs"),
  });

  // Auto select first program
  useEffect(() => {
    if (programs.length > 0 && !selectedProgram) {
      setSelectedProgram(String(programs[0]!.id));
    }
  }, [programs, selectedProgram]);

  // Fetch Specialities of selected program
  const { data: specialities = [] } = useQuery<Speciality[]>({
    queryKey: ["specialities", selectedProgram],
    queryFn: () => api.get<Speciality[]>(`/specialities?programId=${selectedProgram}`),
    enabled: !!selectedProgram,
  });

  // Fetch Weightages config
  const { data: weights, refetch: refetchWeights } = useQuery<WeightConfig>({
    queryKey: ["rankings-weights"],
    queryFn: () => api.get<WeightConfig>("/rankings/weights"),
  });

  // Fetch Rankings based on selectedProgram and active worksheet/specialty tab
  const activeSpecialityId = selectedTab === "overall" ? "" : selectedTab;
  const { data: rankings = [], isLoading, refetch: refetchRankings } = useQuery<CandidateRank[]>({
    queryKey: ["rankings", selectedProgram, activeSpecialityId],
    queryFn: () => {
      const url = `/rankings?programId=${selectedProgram}${activeSpecialityId ? `&specialityId=${activeSpecialityId}` : ""}`;
      return api.get<CandidateRank[]>(url);
    },
    enabled: !!selectedProgram,
  });

  // Pre-fill weight settings in modal
  useEffect(() => {
    if (weights) {
      setWeightMcq(String(weights.mcq));
      setWeightPsy(String(weights.psychometric));
      setWeightInt(String(weights.interview));
    }
  }, [weights, isWeightModalOpen]);

  // Mutation to save weights
  const saveWeightsMutation = useMutation({
    mutationFn: (newWeights: WeightConfig) => api.post("/rankings/weights", newWeights),
    onSuccess: () => {
      toast({ title: "Merit Weights Updated Successfully", description: "All aggregate ranks and final merit scores have been recomputed dynamically." });
      setIsWeightModalOpen(false);
      qc.invalidateQueries({ queryKey: ["rankings"] });
      refetchWeights();
    },
    onError: (e: Error) => {
      toast({ title: "Update Failed", description: e.message, variant: "destructive" });
    }
  });

  const handleSaveWeights = () => {
    const mcq = Number(weightMcq);
    const psy = Number(weightPsy);
    const int = Number(weightInt);

    if (isNaN(mcq) || isNaN(psy) || isNaN(int)) {
      toast({ title: "Invalid Inputs", description: "Weight values must be valid integers", variant: "destructive" });
      return;
    }

    if (mcq < 0 || psy < 0 || int < 0) {
      toast({ title: "Invalid Weights", description: "Weightages cannot be negative", variant: "destructive" });
      return;
    }

    if (Math.abs(mcq + psy + int - 100) > 0.01) {
      toast({ title: "Invalid Aggregate", description: "MCQ + Psychometric + Interview weights must sum to exactly 100%", variant: "destructive" });
      return;
    }

    saveWeightsMutation.mutate({ mcq, psychometric: psy, interview: int });
  };

  const handleExportExcel = () => {
    const token = localStorage.getItem("fellowship_token");
    window.open(`/api/rankings/export?programId=${selectedProgram}&token=${token}`, "_blank");
    toast({ title: "Export Protocol Triggered", description: "Downloading multi-sheet rankings report workbook..." });
  };

  const allocatedCount = rankings.filter((r) => r.status === "allocated" || r.status === "Accepted").length;

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-black p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-purple-700 to-indigo-600 p-8 text-white shadow-2xl">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/10 to-transparent blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-indigo-100 text-sm font-medium">
              <Trophy className="h-4 w-4" />
              <span>Counseling Merit Register</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight">Merit Rankings</h1>
            <p className="text-indigo-100/80 max-w-md">
              Review and manage NEET-style candidate standings. Recompute weighted aggregates, filter by specialization worksheets, and generate formal ranking books.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canEdit && (
              <Button 
                onClick={() => setIsWeightModalOpen(true)}
                className="bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-2xl h-12 px-6 font-bold shadow-xl gap-2 backdrop-blur-md"
              >
                <Sliders className="h-4 w-4 text-purple-200" /> Configure Weights
              </Button>
            )}
            {selectedProgram && rankings.length > 0 && (
              <Button 
                onClick={handleExportExcel}
                className="bg-emerald-500 hover:bg-emerald-600 text-white border-none rounded-2xl h-12 px-6 font-bold shadow-xl gap-2"
              >
                <Download className="h-4 w-4" /> Export Excel Workbook
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Program Selector & Real-Time Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <Card className="border-none shadow-md bg-white p-6 rounded-2xl">
          <div className="space-y-3">
            <Label className="text-xs font-black uppercase text-slate-500 tracking-wider">Academic Program context</Label>
            <Select value={selectedProgram} onValueChange={(val) => { setSelectedProgram(val); setSelectedTab("overall"); }}>
              <SelectTrigger className="h-12 border-2 rounded-xl focus:ring-indigo-500">
                <SelectValue placeholder="Select a program…" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.academicYear})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {selectedProgram && rankings.length > 0 && (
          <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: "Total Appearing", value: rankings.length, color: "text-slate-900", bg: "bg-slate-100" },
              { label: "Provisionally Allocated", value: allocatedCount, color: "text-emerald-700", bg: "bg-emerald-50" },
              { label: "Waitlisted / Remainder", value: rankings.length - allocatedCount, color: "text-amber-700", bg: "bg-amber-50" },
            ].map((card, i) => (
              <Card key={i} className={`border-none shadow-sm p-4 rounded-xl ${card.bg}`}>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">{card.label}</p>
                <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
              </Card>
            ))}
          </div>
        )}
      </div>

      {!selectedProgram ? (
        <Card className="border-dashed py-16 text-center">
          <CardContent className="space-y-3">
            <Trophy className="h-12 w-12 mx-auto text-slate-300" />
            <p className="text-slate-500 font-medium">Please select an academic program context to view rankings</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          <span className="text-xs uppercase font-black tracking-widest animate-pulse">Computing Ranks and Running Tie-Breakers...</span>
        </div>
      ) : rankings.length === 0 ? (
        <Card className="border-dashed py-16 text-center">
          <CardContent className="space-y-3">
            <Trophy className="h-12 w-12 mx-auto text-slate-300" />
            <p className="text-slate-500 font-medium">No candidates have matching evaluations or scores for this program cycle.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Worksheet Tabs */}
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
            <TabsList className="bg-slate-100 p-1 rounded-xl flex overflow-x-auto justify-start border-none max-w-full gap-1 h-12 scrollbar-hide">
              <TabsTrigger 
                value="overall" 
                className="rounded-lg px-6 font-black uppercase text-[10px] tracking-widest h-10 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm transition-all border-none shrink-0"
              >
                Overall Merit List
              </TabsTrigger>
              {specialities.map((spec) => (
                <TabsTrigger 
                  key={spec.id} 
                  value={String(spec.id)} 
                  className="rounded-lg px-6 font-black uppercase text-[10px] tracking-widest h-10 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm transition-all border-none shrink-0"
                >
                  {spec.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Overall & Specific Tabs share the same table wrapper but show relevant specific ranks */}
            <TabsContent value={selectedTab} className="mt-6 outline-none">
              <Card className="shadow-premium border-none bg-white rounded-2xl overflow-hidden">
                <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
                    <Trophy className="h-4 w-4 text-amber-500" /> 
                    {selectedTab === "overall" ? "Overall All-India Rank List" : `${specialities.find(s => String(s.id) === selectedTab)?.name} Specialty Rank List`}
                  </CardTitle>
                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => refetchRankings()}>
                    <RefreshCw className="h-3 w-3 animate-spin" /> Reload List
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b text-xs uppercase font-bold text-slate-400 text-center">
                          <th className="px-4 py-3.5 text-left w-16">Rank</th>
                          <th className="px-4 py-3.5 text-left min-w-[200px]">Candidate Details</th>
                          {selectedTab === "overall" ? (
                            <th className="px-4 py-3.5 text-left">Top Preference</th>
                          ) : (
                            <>
                              <th className="px-4 py-3.5 text-center">Spec Rank</th>
                              <th className="px-4 py-3.5 text-center">Segment Rank</th>
                            </>
                          )}
                          <th className="px-4 py-3.5 text-left">Allocated Seat</th>
                          <th className="px-3 py-3.5 text-right w-20">MCQ ({weights ? weights.mcq : 60}%)</th>
                          <th className="px-3 py-3.5 text-right w-20">Psych ({weights ? weights.psychometric : 10}%)</th>
                          <th className="px-3 py-3.5 text-right w-20">Interview ({weights ? weights.interview : 30}%)</th>
                          <th className="px-4 py-3.5 text-right w-24 bg-slate-50/80">Final Merit Score</th>
                          <th className="px-4 py-3.5 text-center w-24">Counselling Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankings.map((r, idx) => {
                          const isAllocated = r.status === "allocated" || r.status === "Accepted" || r.status === "Upgraded";
                          
                          // Determine the displaying rank
                          const currentRank = selectedTab === "overall" ? r.rank : (r.specialityRank ?? idx + 1);

                          return (
                            <tr 
                              key={r.candidateId} 
                              className={`border-b last:border-0 hover:bg-slate-50/50 transition-colors ${
                                isAllocated ? "bg-emerald-50/30 hover:bg-emerald-50/50 dark:bg-emerald-950/5" : ""
                              }`}
                            >
                              <td className="px-4 py-4 text-left">
                                {currentRank <= 3 ? (
                                  <div className="flex items-center gap-1">
                                    <Medal className={`h-5 w-5 ${
                                      currentRank === 1 ? "text-yellow-500" : currentRank === 2 ? "text-slate-400" : "text-amber-600"
                                    }`} />
                                    <span className="font-black text-sm">{currentRank}</span>
                                  </div>
                                ) : (
                                  <span className="font-bold text-slate-400 font-mono">#{currentRank}</span>
                                )}
                              </td>
                              <td className="px-4 py-4 text-left">
                                <p className="font-bold text-slate-900 text-sm leading-tight mb-0.5">{r.fullName}</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-slate-400 font-mono tracking-wide">{r.candidateCode}</span>
                                </div>
                              </td>

                              {selectedTab === "overall" ? (
                                <td className="px-4 py-4 text-left">
                                  <Badge variant="outline" className="bg-slate-50 text-[10px] font-bold border-slate-200">
                                    {r.topPreference ?? "—"}
                                  </Badge>
                                </td>
                              ) : (
                                <>
                                  <td className="px-4 py-4 text-center font-bold text-indigo-600 font-mono">
                                    {r.specialityRank ? `#${r.specialityRank}` : "—"}
                                  </td>
                                  <td className="px-4 py-4 text-center text-xs text-slate-500 font-mono">
                                    {r.segmentRank ? `#${r.segmentRank}` : "—"}
                                  </td>
                                </>
                              )}

                              <td className="px-4 py-4 text-left">
                                {r.unitName ? (
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                                    <Sparkles className="h-3 w-3 text-indigo-500" />
                                    <span>{r.unitName}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-300 text-xs">—</span>
                                )}
                              </td>
                              <td className="px-3 py-4 text-right tabular-nums text-slate-600 font-mono text-xs">{fmt(r.mcqScore)}</td>
                              <td className="px-3 py-4 text-right tabular-nums text-slate-600 font-mono text-xs">{fmt(r.psychometricScore)}</td>
                              <td className="px-3 py-4 text-right tabular-nums text-slate-600 font-mono text-xs">{fmt(r.interviewScore)}</td>
                              
                              <td className="px-4 py-4 text-right bg-slate-50/30 border-x">
                                <Badge className="bg-indigo-600 text-white font-black text-xs h-7 px-3.5 shadow-sm border-none font-mono">
                                  {r.totalScore.toFixed(2)}
                                </Badge>
                              </td>
                              
                              <td className="px-4 py-4 text-center">
                                {r.status ? (
                                  <Badge variant="outline" className={`text-[10px] font-black uppercase tracking-wider px-3 h-6 rounded-full border-2 ${statusColors[r.status] ?? ""}`}>
                                    {r.status.replace(/_/g, " ")}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider px-3 h-6 rounded-full border-2 bg-slate-50 text-slate-400">
                                    PENDING
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Dynamic Weightages Configuration Modal */}
      <Dialog open={isWeightModalOpen} onOpenChange={setIsWeightModalOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
              <Sliders className="h-5 w-5 text-purple-600 animate-pulse" />
              Weightages Protocol Setup
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 uppercase tracking-wider font-bold">
              Adjust parameters for computed rankings tie-breaking and seat allotting
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="bg-purple-50 rounded-2xl p-4 border border-purple-100 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-purple-500 shrink-0" />
              <p className="text-xs text-purple-900 font-bold leading-relaxed uppercase">
                The total sum of MCQ, Psychometric, and interview weights must equal exactly 100%. Changing weights will recalculate all applicant matrices atomically.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">MCQ weight %</Label>
                <Input 
                  type="number"
                  value={weightMcq}
                  onChange={(e) => setWeightMcq(e.target.value)}
                  className="h-12 text-center text-sm font-black border-2 rounded-xl focus:ring-purple-500 focus:border-purple-500 font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Psych weight %</Label>
                <Input 
                  type="number"
                  value={weightPsy}
                  onChange={(e) => setWeightPsy(e.target.value)}
                  className="h-12 text-center text-sm font-black border-2 rounded-xl focus:ring-purple-500 focus:border-purple-500 font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Interview %</Label>
                <Input 
                  type="number"
                  value={weightInt}
                  onChange={(e) => setWeightInt(e.target.value)}
                  className="h-12 text-center text-sm font-black border-2 rounded-xl focus:ring-purple-500 focus:border-purple-500 font-mono"
                />
              </div>
            </div>

            {/* Sum validation display */}
            {(() => {
              const sum = (Number(weightMcq) || 0) + (Number(weightPsy) || 0) + (Number(weightInt) || 0);
              const isValid = Math.abs(sum - 100) < 0.01;
              return (
                <div className={`p-3.5 rounded-xl border text-center font-bold text-xs uppercase tracking-widest ${
                  isValid ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-rose-50 border-rose-100 text-rose-700"
                }`}>
                  Current Aggregate Sum: <span className="font-mono">{sum}%</span> {isValid ? "— VALID PROTOCOL" : "— SUM MUST EQUAL 100%"}
                </div>
              );
            })()}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl h-11 text-xs font-bold uppercase" onClick={() => setIsWeightModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              className="rounded-xl h-11 bg-slate-900 hover:bg-purple-700 text-white font-bold text-xs uppercase" 
              onClick={handleSaveWeights}
              disabled={saveWeightsMutation.isPending}
            >
              {saveWeightsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Commit Weight Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

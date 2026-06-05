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
  const [selectedTab, setSelectedTab] = useState<string>("");

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

  // Auto select first speciality
  useEffect(() => {
    if (specialities.length > 0 && (!selectedTab || selectedTab === "overall")) {
      setSelectedTab(String(specialities[0].id));
    }
  }, [specialities, selectedTab]);

  // Fetch Rankings based on selectedProgram and active worksheet/specialty tab
  const activeSpecialityId = selectedTab;
  const { data: rankings = [], isLoading, refetch: refetchRankings } = useQuery<CandidateRank[]>({
    queryKey: ["rankings", selectedProgram, activeSpecialityId],
    queryFn: () => {
      const url = `/rankings?programId=${selectedProgram}${activeSpecialityId ? `&specialityId=${activeSpecialityId}` : ""}`;
      return api.get<CandidateRank[]>(url);
    },
    enabled: !!selectedProgram && !!activeSpecialityId,
  });

  const sortedRankings = [...rankings].sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    const rankA = a.specialityRank ?? a.rank ?? 99999;
    const rankB = b.specialityRank ?? b.rank ?? 99999;
    return rankA - rankB;
  });

  const handleExportExcel = () => {
    const token = localStorage.getItem("fellowship_token");
    window.open(`/api/rankings/export?programId=${selectedProgram}&token=${token}`, "_blank");
    toast({ title: "Export Protocol Triggered", description: "Downloading sub-specialization rankings report workbook..." });
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
              Review and manage fellowship candidate standings. Filter by specialization worksheets and generate sub-specialty ranking books.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
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
            <Select value={selectedProgram} onValueChange={(val) => { setSelectedProgram(val); setSelectedTab(""); }}>
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
                    {`${specialities.find(s => String(s.id) === selectedTab)?.name ?? ""} Specialty Rank List`}
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
                          <th className="px-4 py-3.5 text-left">Application No</th>
                          <th className="px-4 py-3.5 text-left">Student Name</th>
                          <th className="px-4 py-3.5 text-left">Speciality</th>
                          <th className="px-3 py-3.5 text-right w-24">MCQ</th>
                          <th className="px-3 py-3.5 text-right w-24">Viva</th>
                          <th className="px-3 py-3.5 text-right w-24">Mind Matters</th>
                          <th className="px-4 py-3.5 text-right w-32 bg-slate-50/80">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedRankings.map((r, idx) => {
                          const isAllocated = r.status === "allocated" || r.status === "Accepted" || r.status === "Upgraded";
                          
                          // Determine the displaying rank
                          const currentRank = r.specialityRank ?? idx + 1;

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
                              <td className="px-4 py-4 text-left font-semibold font-mono text-xs text-slate-600">
                                {r.candidateCode}
                              </td>
                              <td className="px-4 py-4 text-left font-bold text-slate-900 text-sm">
                                {r.fullName}
                              </td>
                              <td className="px-4 py-4 text-left text-slate-700 text-xs font-semibold">
                                {specialities.find(s => String(s.id) === selectedTab)?.name || r.topPreference || "—"}
                              </td>
                              <td className="px-3 py-4 text-right tabular-nums text-slate-600 font-mono text-xs">{fmt(r.mcqScore)}</td>
                              <td className="px-3 py-4 text-right tabular-nums text-slate-600 font-mono text-xs">{fmt(r.interviewScore)}</td>
                              <td className="px-3 py-4 text-right tabular-nums text-slate-600 font-mono text-xs">{fmt(r.psychometricScore)}</td>
                              
                              <td className="px-4 py-4 text-right bg-slate-50/30 border-l">
                                <Badge className="bg-indigo-600 text-white font-black text-xs h-7 px-3.5 shadow-sm border-none font-mono">
                                  {r.totalScore.toFixed(2)}
                                </Badge>
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
    </div>
  );
}

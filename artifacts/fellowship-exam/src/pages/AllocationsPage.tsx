import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { useToast } from "../hooks/use-toast";
import { 
  Trophy, Medal, Settings2, Download, RefreshCw, Loader2, Sparkles, 
  MapPin, CheckCircle2, XCircle, Users, Zap, Search, FileText, Printer, Mail, 
  Sliders, ChevronRight, AlertCircle, Building2, UserCheck, Inbox, ShieldAlert
} from "lucide-react";

interface Program { id: number; name: string; code: string; academicYear: string; }
interface Speciality { id: number; name: string; code: string; seats: number; }
interface Unit { id: number; name: string; city: string; }

interface Allocation {
  id: number;
  candidateId: number;
  candidateName: string;
  candidateCode: string;
  specialityId: number | null;
  specialityName: string | null;
  programName: string;
  unitId: number | null;
  unitName: string | null;
  status: string;
  rank: number;
  totalScore: number;
  allocatedAt: string;
}

interface AllocationSummary {
  totalSeats: number;
  filledSeats: number;
  vacantSeats: number;
  waitingList: {
    id: number;
    candidateName: string;
    candidateCode: string;
    rank: number;
    totalScore: number;
  }[];
  occupancy: {
    id: number;
    speciality: string;
    unitName: string;
    totalSeats: number;
    allocatedSeats: number;
    vacantSeats: number;
  }[];
}

const statusColors: Record<string, string> = {
  "Provisionally Allocated": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-300",
  Accepted: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300",
  Upgraded: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-300",
  Withdrawn: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-300",
  WAITLISTED: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300",
  waitlisted: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300",
};

function fmt(v: number | null) {
  return v != null ? v.toFixed(1) : "—";
}

export default function AllocationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [counsellingRound, setCounsellingRound] = useState<string>("Round 1");
  const [activeTab, setActiveTab] = useState<string>("counselling");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Override dialog state
  const [selectedAllocToOverride, setSelectedAllocToOverride] = useState<Allocation | null>(null);
  const [overrideSpecId, setOverrideSpecId] = useState<string>("none");
  const [overrideUnitId, setOverrideUnitId] = useState<string>("none");
  const [overrideStatus, setOverrideStatus] = useState<string>("Provisionally Allocated");

  // Dossier state
  const [selectedDossierCand, setSelectedDossierCand] = useState<any | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState(false);

  const canEdit = ["super_admin", "program_admin", "central_exam_coordinator"].includes(user?.role ?? "");

  // Fetch Programs
  const { data: programs = [], isLoading: isLoadingPrograms } = useQuery<Program[]>({
    queryKey: ["programs"],
    queryFn: () => api.get<Program[]>("/programs"),
  });

  // Auto-select first program
  useEffect(() => {
    if (programs.length > 0 && !selectedProgramId) {
      setSelectedProgramId(String(programs[0]!.id));
    }
  }, [programs, selectedProgramId]);

  // Fetch Specialities
  const { data: specialities = [] } = useQuery<Speciality[]>({
    queryKey: ["specialities", selectedProgramId],
    queryFn: () => api.get<Speciality[]>(`/specialities?programId=${selectedProgramId}`),
    enabled: !!selectedProgramId,
  });

  // Fetch Units
  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ["units"],
    queryFn: () => api.get<Unit[]>("/units"),
  });

  // Fetch NEET merit register rankings
  const { data: rankedCandidates = [], isLoading: isLoadingRanked, refetch: refetchRankings } = useQuery<any[]>({
    queryKey: ["rankings", selectedProgramId],
    queryFn: () => api.get<any[]>(`/rankings?programId=${selectedProgramId}`),
    enabled: !!selectedProgramId,
  });

  // Fetch Allocations
  const { data: allocations = [], isLoading: isLoadingAllocations, refetch: refetchAllocations } = useQuery<Allocation[]>({
    queryKey: ["allocations", selectedProgramId],
    queryFn: () => api.get<Allocation[]>(`/allocations?programId=${selectedProgramId}`),
    enabled: !!selectedProgramId,
  });

  // Fetch Allocation Summary (Matrices, Occupancies, Waitlists)
  const { data: summary, isLoading: isLoadingSummary, refetch: refetchSummary } = useQuery<AllocationSummary>({
    queryKey: ["allocations-summary", selectedProgramId],
    queryFn: () => api.get<AllocationSummary>(`/allocations/summary?programId=${selectedProgramId}`),
    enabled: !!selectedProgramId,
  });

  // NEET Allotment Engine Run Mutation
  const runAllotmentMutation = useMutation({
    mutationFn: () => api.post(`/allocations/run`, { programId: Number(selectedProgramId) }),
    onSuccess: (data: any) => {
      toast({
        title: "NEET Allotment Protocol Completed",
        description: `Successfully executed: ${data.selected} provisionally allocated, ${data.waitlisted} waitlisted.`,
      });
      qc.invalidateQueries({ queryKey: ["allocations", selectedProgramId] });
      qc.invalidateQueries({ queryKey: ["allocations-summary", selectedProgramId] });
      qc.invalidateQueries({ queryKey: ["rankings", selectedProgramId] });
      qc.invalidateQueries({ queryKey: ["seat-matrix", selectedProgramId] });
    },
    onError: (e: Error) => {
      toast({ title: "Protocol Failed", description: e.message, variant: "destructive" });
    }
  });

  // Override Mutation
  const overrideMutation = useMutation({
    mutationFn: (payload: { allocationId: number; specialityId: number | null; status: string }) =>
      api.post(`/allocations/${payload.allocationId}/override`, {
        specialityId: payload.specialityId,
        status: payload.status,
      }),
    onSuccess: () => {
      toast({ title: "Allocation Override Saved", description: "The records and seat counts have been updated successfully." });
      setSelectedAllocToOverride(null);
      qc.invalidateQueries({ queryKey: ["allocations", selectedProgramId] });
      qc.invalidateQueries({ queryKey: ["allocations-summary", selectedProgramId] });
      qc.invalidateQueries({ queryKey: ["rankings", selectedProgramId] });
    },
    onError: (e: Error) => {
      toast({ title: "Override Failed", description: e.message, variant: "destructive" });
    }
  });

  const handleRunAllotment = () => {
    if (confirm("Executing the Allotment Engine will wipe existing seat assignments and run NEET candidate sequential matching. Proceed?")) {
      runAllotmentMutation.mutate();
    }
  };

  const handleOpenOverride = (alloc: Allocation) => {
    setSelectedAllocToOverride(alloc);
    setOverrideSpecId(alloc.specialityId ? String(alloc.specialityId) : "none");
    setOverrideUnitId(alloc.unitId ? String(alloc.unitId) : "none");
    setOverrideStatus(alloc.status);
  };

  const handleSaveOverride = () => {
    if (!selectedAllocToOverride) return;
    const specId = overrideSpecId === "none" ? null : Number(overrideSpecId);
    overrideMutation.mutate({
      allocationId: selectedAllocToOverride.id,
      specialityId: specId,
      status: overrideStatus,
    });
  };

  const handleDownloadLetter = (allocationId: number) => {
    const token = localStorage.getItem("fellowship_token");
    window.open(`/api/allocations/${allocationId}/letter?token=${token}`, "_blank");
    toast({ title: "Letter Generated", description: "Downloading formal allotment offer document..." });
  };

  const handleViewDossier = (candId: number) => {
    // Locate rich details from rankings list
    const richCand = rankedCandidates.find(c => c.candidateId === candId);
    if (richCand) {
      setSelectedDossierCand(richCand);
      setIsDossierOpen(true);
    } else {
      toast({ title: "Dossier Error", description: "Could not locate candidate detail parameters.", variant: "destructive" });
    }
  };

  const handlePrintApplication = (candidateId: number) => {
    const richCand = rankedCandidates.find(c => c.candidateId === candidateId);
    // Find matching submission id
    if (richCand) {
      const token = localStorage.getItem("fellowship_token");
      window.open(`/api/print-application/${candidateId}?token=${token}`, "_blank");
    } else {
      toast({ title: "Form Unavailable", description: "Matching submission could not be verified.", variant: "destructive" });
    }
  };

  const filteredAllocations = allocations.filter(a => {
    const matchesSearch = searchQuery === "" || 
      a.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.candidateCode.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const isLoading = isLoadingPrograms || isLoadingRanked || isLoadingAllocations || isLoadingSummary;

  if (isLoadingPrograms) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-black p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
      {/* Premium Gradient Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-800 via-indigo-950 to-slate-950 p-8 text-white shadow-2xl">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/10 to-transparent blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-indigo-200 text-sm font-medium">
              <Zap className="h-4 w-4 text-indigo-400" />
              <span>NEET-Style Counselling Command</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight italic">Master Counselling & Seats Allotment</h1>
            <p className="text-slate-400 max-w-md">
              Run sequential preferences counseling rounds, track real-time matrix filled capacities, and manage manual allocation overrides.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canEdit && (
              <Button 
                onClick={handleRunAllotment}
                disabled={runAllotmentMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 px-6 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all gap-2"
              >
                {runAllotmentMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
                Smart NEET Allotment Engine
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Program and Round Control Toolbar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-none shadow-md bg-white p-6 rounded-2xl flex flex-col justify-center">
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase text-slate-500 tracking-wider">Counselling Program Context</Label>
            <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
              <SelectTrigger className="h-12 border-2 rounded-xl focus:ring-indigo-500 font-bold">
                <SelectValue placeholder="Select a program…" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)} className="font-bold">{p.name} ({p.academicYear})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card className="border-none shadow-md bg-white p-6 rounded-2xl flex flex-col justify-center">
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase text-slate-500 tracking-wider">Counselling lifecycle round</Label>
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl h-12">
              {["Round 1", "Round 2", "Mop-up"].map((r) => (
                <button
                  key={r}
                  onClick={() => setCounsellingRound(r)}
                  className={`rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border-none ${
                    counsellingRound === r 
                      ? "bg-indigo-600 text-white shadow-sm" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {selectedProgramId && summary && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total capacity", val: summary.totalSeats, color: "text-slate-900", bg: "bg-slate-100" },
              { label: "Seats filled", val: summary.filledSeats, color: "text-indigo-600", bg: "bg-indigo-50 border border-indigo-100" },
              { label: "Vacancies", val: summary.vacantSeats, color: "text-emerald-700", bg: "bg-emerald-50 border border-emerald-100" }
            ].map((stat, idx) => (
              <Card key={idx} className={`border-none shadow-sm p-4 rounded-xl flex flex-col justify-center text-center ${stat.bg}`}>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">{stat.label}</p>
                <p className={`text-2xl font-black ${stat.color}`}>{stat.val}</p>
              </Card>
            ))}
          </div>
        )}
      </div>

      {!selectedProgramId ? (
        <Card className="border-dashed py-16 text-center">
          <CardContent className="space-y-3">
            <Trophy className="h-12 w-12 mx-auto text-slate-300 animate-pulse" />
            <p className="text-slate-500 font-medium">Please select an academic program context to view counselling records</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <span className="text-xs uppercase font-black tracking-widest animate-pulse">Assembling Counselling Matrices & Queues...</span>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-slate-100 p-1.5 rounded-xl flex overflow-x-auto justify-start border-none max-w-full gap-1 h-12 scrollbar-hide">
            <TabsTrigger value="counselling" className="rounded-lg px-6 font-black uppercase text-[10px] tracking-widest h-10 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm border-none shrink-0">
              Counselling Control
            </TabsTrigger>
            <TabsTrigger value="registry" className="rounded-lg px-6 font-black uppercase text-[10px] tracking-widest h-10 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm border-none shrink-0">
              Allotment Registry
            </TabsTrigger>
            <TabsTrigger value="merit" className="rounded-lg px-6 font-black uppercase text-[10px] tracking-widest h-10 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm border-none shrink-0">
              Merit Rankings
            </TabsTrigger>
            <TabsTrigger value="waitlist" className="rounded-lg px-6 font-black uppercase text-[10px] tracking-widest h-10 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm border-none shrink-0">
              Waiting Queue ({summary?.waitingList.length ?? 0})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: COUNSELLING CONTROL (VACANCY MATRICES & CONTROLS) */}
          <TabsContent value="counselling" className="mt-6 outline-none space-y-8">
            <Card className="border-none shadow-premium bg-white rounded-3xl overflow-hidden">
              <CardHeader className="bg-slate-900 text-white p-6 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold uppercase tracking-widest flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-indigo-400" />
                    Unit / Center-wise Allotment & Seat Matrices
                  </CardTitle>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-1">Live allocation status updates per institutional center</p>
                </div>
                <Badge className="bg-emerald-500 text-white border-none font-bold text-[10px] h-6 px-3">ACTIVE LIFE-CYCLE</Badge>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {summary?.occupancy.map((occ, idx) => {
                    const pct = occ.totalSeats > 0 ? (occ.allocatedSeats / occ.totalSeats) * 100 : 0;
                    
                    // Renders visual filled capacity indicators
                    const isFull = occ.allocatedSeats >= occ.totalSeats;
                    const isPartiallyFilled = occ.allocatedSeats > 0 && occ.allocatedSeats < occ.totalSeats;
                    
                    let bgClass = "bg-emerald-50 border-emerald-200 text-emerald-800";
                    let pctBarClass = "bg-emerald-500";
                    let cardBorder = "hover:border-emerald-300";

                    if (isFull) {
                      bgClass = "bg-rose-50 border-rose-200 text-rose-800";
                      pctBarClass = "bg-rose-500";
                      cardBorder = "hover:border-rose-300";
                    } else if (isPartiallyFilled) {
                      bgClass = "bg-amber-50 border-amber-200 text-amber-800";
                      pctBarClass = "bg-amber-500";
                      cardBorder = "hover:border-amber-300";
                    }

                    return (
                      <Card key={idx} className={`border-2 rounded-2xl transition-all ${cardBorder}`}>
                        <CardContent className="p-6 space-y-4">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <h4 className="font-extrabold text-slate-800 text-sm leading-tight mb-1 uppercase tracking-tight">{occ.speciality}</h4>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                                {occ.unitName}
                              </p>
                            </div>
                            <span className="text-xl font-black text-slate-900 shrink-0 tabular-nums">
                              {occ.allocatedSeats}
                              <span className="text-slate-300 text-xs font-medium ml-1">/ {occ.totalSeats}</span>
                            </span>
                          </div>

                          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner relative">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ${pctBarClass}`} 
                              style={{ width: `${Math.min(pct, 100)}%` }} 
                            />
                          </div>

                          <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider">
                            <Badge variant="outline" className={`h-5 border-none px-2 rounded-md ${bgClass}`}>
                              {isFull ? "FULLY OCCUPIED" : isPartiallyFilled ? "PARTIALLY FILLED" : "COMPLETELY VACANT"}
                            </Badge>
                            <span className="text-slate-400">{occ.vacantSeats} Seats Available</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {(!summary || summary.occupancy.length === 0) && (
                    <div className="col-span-full py-16 text-center text-slate-400 uppercase text-xs font-bold border border-dashed rounded-2xl">
                      No Seat Matrix allocations seeded yet for this program cycle.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Counselling actions guidelines panel */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-none shadow-sm bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-2xl p-6">
                <ShieldAlert className="h-8 w-8 text-indigo-200 mb-4" />
                <h4 className="font-extrabold uppercase text-sm tracking-wider mb-2">NEET Counseling Protocol</h4>
                <p className="text-xs text-indigo-100 leading-relaxed font-semibold">
                  Rounds execute candidate preferences matching in order of absolute overall merit ranks. Provisionally allocated slots freeze to Accepted, float to Upgraded, or vacate on Withdrawal.
                </p>
              </Card>
              <Card className="border-none shadow-sm bg-amber-500 text-white rounded-2xl p-6">
                <Zap className="h-8 w-8 text-amber-200 mb-4 animate-bounce" />
                <h4 className="font-extrabold uppercase text-sm tracking-wider mb-2">Tie-Breaker Rules</h4>
                <p className="text-xs text-amber-50 text-slate-100 leading-relaxed font-semibold">
                  Ties in aggregate merit are settled by strict priority: 1. Higher Entrance MCQ Score, 2. Higher clinical panel interview average, 3. Earliest application timestamp.
                </p>
              </Card>
              <Card className="border-none shadow-sm bg-slate-900 text-white rounded-2xl p-6">
                <Sliders className="h-8 w-8 text-slate-400 mb-4" />
                <h4 className="font-extrabold uppercase text-sm tracking-wider mb-2">Capacity Configuration</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                  Administrators can modify individual unit seat metrics, add specialty tracks, or apply manual overrides on behalf of candidates inside the registry.
                </p>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 2: ALLOTMENT REGISTRY & LIFECYCLE OVERRIDES */}
          <TabsContent value="registry" className="mt-6 outline-none space-y-6">
            <Card className="border-none shadow-premium bg-white rounded-3xl overflow-hidden">
              <div className="p-8 bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                  <h3 className="text-2xl font-black tracking-tighter uppercase leading-none">Seat Allotment Registry</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Manage provisional placements and formal offer dispatches</p>
                </div>
                <div className="relative w-80 shrink-0">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input 
                    placeholder="SEARCH CANDIDATE..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="bg-white/10 border-white/10 text-white placeholder:text-slate-500 h-11 pl-11 rounded-xl focus:bg-white focus:text-slate-900 transition-all font-black text-[10px] uppercase tracking-widest border-2"
                  />
                </div>
              </div>
              
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b text-xs uppercase font-bold text-slate-400 text-center">
                        <th className="px-4 py-3.5 text-left w-16">Rank</th>
                        <th className="px-4 py-3.5 text-left min-w-[200px]">Candidate profile</th>
                        <th className="px-4 py-3.5 text-left">Allocated Speciality</th>
                        <th className="px-4 py-3.5 text-left">Institutional Center</th>
                        <th className="px-4 py-3.5 text-right w-24">Final score</th>
                        <th className="px-4 py-3.5 text-center w-28">Status</th>
                        <th className="px-4 py-3.5 text-right w-48">Execution Commands</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAllocations.map((a) => {
                        const isAllocated = a.specialityId !== null;

                        return (
                          <tr key={a.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-4 text-left">
                              <div className="h-10 w-10 rounded-xl bg-slate-100 border flex items-center justify-center font-black text-slate-600 font-mono text-sm shadow-sm">
                                #{a.rank}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-left">
                              <p className="font-extrabold text-slate-900 text-sm leading-tight mb-0.5">{a.candidateName}</p>
                              <span className="text-[10px] font-black text-slate-400 font-mono tracking-wide">{a.candidateCode}</span>
                            </td>
                            <td className="px-4 py-4 text-left font-bold text-slate-800">
                              {a.specialityName ? (
                                <Badge variant="outline" className="bg-indigo-50 border-indigo-100 text-indigo-700 h-6">
                                  {a.specialityName}
                                </Badge>
                              ) : (
                                <span className="text-slate-300 text-xs italic">No Track Seat</span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-left font-bold text-slate-800">
                              {a.unitName ? (
                                <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                                  {a.unitName}
                                </div>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-right font-mono font-bold text-slate-700">
                              {a.totalScore.toFixed(2)}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <Badge variant="outline" className={`text-[10px] font-black uppercase tracking-wider px-3 h-6 rounded-full border-2 ${statusColors[a.status] ?? ""}`}>
                                {a.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {isAllocated && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDownloadLetter(a.id)}
                                    className="rounded-lg h-8 px-3 text-[9px] font-black uppercase border-slate-200 text-indigo-600 gap-1.5 hover:bg-indigo-50"
                                  >
                                    <Download className="h-3 w-3" /> Letter
                                  </Button>
                                )}
                                {canEdit && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenOverride(a)}
                                    className="rounded-lg h-8 px-3 text-[9px] font-black uppercase border-slate-200 text-slate-600 gap-1.5 hover:bg-slate-100"
                                  >
                                    <Settings2 className="h-3 w-3" /> Override
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredAllocations.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-16 text-center text-slate-400 uppercase text-xs font-bold border-b">
                            No allocations registries populated. Use the "Smart NEET Allotment Engine" to seed assignments.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: MERIT STANDINGS (GLOBAL REGISTER WITH DETAILED CANDIDATE DOSSIERS) */}
          <TabsContent value="merit" className="mt-6 outline-none space-y-6">
            <Card className="border-none shadow-premium bg-white rounded-3xl overflow-hidden">
              <CardHeader className="bg-slate-900 text-white p-6 flex flex-row justify-between items-center">
                <div>
                  <CardTitle className="text-base font-bold uppercase tracking-widest flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    Integrated Candidates Merit Register & LORs
                  </CardTitle>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-1">Review comprehensive MCQ, Psychometric and Interview score parameters</p>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b text-xs uppercase font-bold text-slate-400 text-center">
                        <th className="px-4 py-3.5 text-left w-16">AIR</th>
                        <th className="px-4 py-3.5 text-left min-w-[200px]">Candidate Information</th>
                        <th className="px-3 py-3.5 text-right w-20">MCQ Score</th>
                        <th className="px-3 py-3.5 text-right w-20">Psych Score</th>
                        <th className="px-3 py-3.5 text-right w-20">Int. Score</th>
                        <th className="px-4 py-3.5 text-right w-24 bg-slate-50/80">Merit Aggregate</th>
                        <th className="px-4 py-3.5 text-left min-w-[150px]">Location Preferences</th>
                        <th className="px-4 py-3.5 text-right w-44">Commands</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankedCandidates.map((c, idx) => {
                        return (
                          <tr key={c.candidateId} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-4 text-left">
                              <div className="h-10 w-10 rounded-xl bg-slate-100 border flex items-center justify-center font-black text-slate-700 font-mono text-sm shadow-sm">
                                #{c.rank}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-left">
                              <p className="font-extrabold text-slate-900 text-sm leading-tight mb-0.5">{c.fullName}</p>
                              <span className="text-[10px] font-black text-slate-400 font-mono tracking-wide">{c.candidateCode}</span>
                            </td>
                            <td className="px-3 py-4 text-right tabular-nums text-slate-600 font-mono text-xs">{fmt(c.mcqScore)}</td>
                            <td className="px-3 py-4 text-right tabular-nums text-slate-600 font-mono text-xs">{fmt(c.psychometricScore)}</td>
                            <td className="px-3 py-4 text-right tabular-nums text-slate-600 font-mono text-xs">{fmt(c.interviewScore)}</td>
                            
                            <td className="px-4 py-4 text-right bg-slate-50/30 border-x">
                              <Badge className="bg-indigo-600 text-white font-black text-xs h-7 px-3.5 shadow-sm border-none font-mono">
                                {c.totalScore.toFixed(2)}
                              </Badge>
                            </td>

                            <td className="px-4 py-4 text-left max-w-[200px]">
                              <div className="flex flex-wrap gap-1">
                                {c.preferredLocations && c.preferredLocations.length > 0 ? (
                                  c.preferredLocations.map((loc: string, i: number) => (
                                    <Badge key={i} variant="outline" className="bg-slate-50 text-[9px] font-bold border-slate-200">
                                      {loc}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-slate-300 text-xs italic">Institutional Choice</span>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewDossier(c.candidateId)}
                                  className="rounded-lg h-8 px-3 text-[9px] font-black uppercase border-slate-200 text-slate-600 gap-1.5 hover:bg-slate-100"
                                >
                                  <FileText className="h-3 w-3" /> Dossier
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handlePrintApplication(c.candidateId)}
                                  className="rounded-lg h-8 px-3 text-[9px] font-black uppercase border-slate-200 text-indigo-600 gap-1.5 hover:bg-indigo-50"
                                >
                                  <Printer className="h-3 w-3" /> Print Form
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {rankedCandidates.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-16 text-center text-slate-400 uppercase text-xs font-bold border-b">
                            No evaluated candidates found in rankings context.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: COUNSELLING WAITING QUEUE LIST */}
          <TabsContent value="waitlist" className="mt-6 outline-none space-y-6">
            <Card className="border-none shadow-premium bg-white rounded-3xl overflow-hidden">
              <CardHeader className="bg-slate-900 text-white p-6">
                <CardTitle className="text-base font-bold uppercase tracking-widest flex items-center gap-2">
                  <Inbox className="h-5 w-5 text-amber-500" />
                  Active Counselling Waitlisted Candidate Queue
                </CardTitle>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-1">Sequential list of waitlisted candidates sorted by overall merit rank standings</p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b text-xs uppercase font-bold text-slate-400 text-center">
                        <th className="px-4 py-3.5 text-left w-20">Queue No</th>
                        <th className="px-4 py-3.5 text-left w-24">AIR Rank</th>
                        <th className="px-4 py-3.5 text-left min-w-[200px]">Candidate profile</th>
                        <th className="px-4 py-3.5 text-right w-32">Aggregate Score</th>
                        <th className="px-4 py-3.5 text-center w-36">Counselling status</th>
                        <th className="px-4 py-3.5 text-right w-36">Action commands</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary?.waitingList.map((wl, idx) => {
                        return (
                          <tr key={wl.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-4 text-left font-black text-slate-900 font-mono">
                              #{idx + 1}
                            </td>
                            <td className="px-4 py-4 text-left">
                              <Badge className="bg-slate-100 text-slate-600 font-bold border border-slate-200">
                                AIR #{wl.rank}
                              </Badge>
                            </td>
                            <td className="px-4 py-4 text-left">
                              <p className="font-extrabold text-slate-900 text-sm leading-tight mb-0.5">{wl.candidateName}</p>
                              <span className="text-[10px] font-black text-slate-400 font-mono tracking-wide">{wl.candidateCode}</span>
                            </td>
                            <td className="px-4 py-4 text-right font-mono font-bold text-slate-700">
                              {wl.totalScore.toFixed(2)}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider px-3 h-6 rounded-full border-2 bg-amber-50 text-amber-700 border-amber-200">
                                WAITLISTED
                              </Badge>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewDossier(wl.id)}
                                className="rounded-lg h-8 px-3 text-[9px] font-black uppercase border-slate-200 text-slate-600 gap-1.5 hover:bg-slate-100"
                              >
                                <FileText className="h-3 w-3" /> Dossier
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                      {(!summary || summary.waitingList.length === 0) && (
                        <tr>
                          <td colSpan={6} className="py-16 text-center text-slate-400 uppercase text-xs font-bold border-b">
                            No waitlisted candidates found in current round queue.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* OVERRIDE DIALOG */}
      <Dialog open={selectedAllocToOverride !== null} onOpenChange={(o) => { if (!o) setSelectedAllocToOverride(null); }}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6 border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
              <Sliders className="h-5 w-5 text-indigo-600 animate-pulse" />
              Manual Allocation Override
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Enforce specialty and unit center assignments on behalf of candidate
            </DialogDescription>
          </DialogHeader>

          {selectedAllocToOverride && (
            <div className="space-y-6 py-4">
              <div className="p-4 bg-slate-50 border rounded-2xl">
                <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Target Applicant Profile</p>
                <h4 className="font-extrabold text-slate-950 uppercase text-base mb-1">{selectedAllocToOverride.candidateName}</h4>
                <div className="flex gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                  <span>Code: {selectedAllocToOverride.candidateCode}</span>
                  <span>Rank: AIR #{selectedAllocToOverride.rank}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Override Speciality Assignment</Label>
                  <Select value={overrideSpecId} onValueChange={setOverrideSpecId}>
                    <SelectTrigger className="h-11 border-2 rounded-xl focus:ring-indigo-500 font-bold">
                      <SelectValue placeholder="Select speciality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="font-bold">Waitlist (No Speciality)</SelectItem>
                      {specialities.map((spec) => (
                        <SelectItem key={spec.id} value={String(spec.id)} className="font-bold">{spec.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Override Institutional Center</Label>
                  <Select value={overrideUnitId} onValueChange={setOverrideUnitId} disabled={overrideSpecId === "none"}>
                    <SelectTrigger className="h-11 border-2 rounded-xl focus:ring-indigo-500 font-bold">
                      <SelectValue placeholder="Select center unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="font-bold">No Center (Waitlist)</SelectItem>
                      {units.map((u) => (
                        <SelectItem key={u.id} value={String(u.id)} className="font-bold">{u.name} ({u.city})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Manual Lifecycle Status</Label>
                  <Select value={overrideStatus} onValueChange={setOverrideStatus}>
                    <SelectTrigger className="h-11 border-2 rounded-xl focus:ring-indigo-500 font-bold">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Provisionally Allocated" className="font-bold">Provisionally Allocated</SelectItem>
                      <SelectItem value="Accepted" className="font-bold">Accepted (Freeze)</SelectItem>
                      <SelectItem value="Upgraded" className="font-bold">Upgraded (Float)</SelectItem>
                      <SelectItem value="Withdrawn" className="font-bold">Withdrawn</SelectItem>
                      <SelectItem value="WAITLISTED" className="font-bold">WAITLISTED</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl h-11 text-xs font-bold uppercase" onClick={() => setSelectedAllocToOverride(null)}>
              Cancel
            </Button>
            <Button 
              className="rounded-xl h-11 bg-slate-900 hover:bg-indigo-700 text-white font-bold text-xs uppercase" 
              onClick={handleSaveOverride}
              disabled={overrideMutation.isPending}
            >
              {overrideMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Commit Seat Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DETAILED DOSSIER DIALOG */}
      <Dialog open={isDossierOpen} onOpenChange={setIsDossierOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-[32px] border-none bg-white shadow-2xl">
          <DialogHeader className="hidden"><DialogTitle>Candidate Dossier</DialogTitle></DialogHeader>
          {selectedDossierCand && (
            <div className="flex flex-col max-h-[85vh]">
              {/* Dossier Header */}
              <div className="p-8 bg-slate-950 text-white flex justify-between items-start shrink-0">
                <div className="flex gap-6 items-center">
                  <div className="h-20 w-20 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center font-black text-white text-3xl">
                    {selectedDossierCand.fullName.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="space-y-1.5">
                    <Badge className="bg-indigo-500/20 text-indigo-300 border-none font-black text-[9px] h-5 px-3">CLINICAL DOSSIER</Badge>
                    <h2 className="text-3xl font-black tracking-tight uppercase leading-none">{selectedDossierCand.fullName}</h2>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] font-mono">{selectedDossierCand.candidateCode}</p>
                  </div>
                </div>
                <Button 
                  onClick={() => handlePrintApplication(selectedDossierCand.candidateId)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] tracking-widest h-12 px-6 rounded-xl gap-2 shadow-xl shadow-indigo-600/10 transition-all hover:scale-[1.02]"
                >
                  <Printer className="h-4 w-4" /> Print Application
                </Button>
              </div>

              {/* Dossier Body */}
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  {/* Left Column: Academic & Preference */}
                  <div className="space-y-6">
                    <Card className="border rounded-2xl">
                      <CardHeader className="py-3 px-4 border-b">
                        <CardTitle className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                          <Building2 className="h-4 w-4 text-indigo-500" /> Academic & Location Preferences
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 space-y-3 text-xs">
                        <div className="flex justify-between items-center py-2 border-b">
                          <span className="font-bold text-slate-400 uppercase">Registered Specialities</span>
                          <span className="font-black text-slate-900 uppercase">{selectedDossierCand.topPreference || "—"}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span className="font-bold text-slate-400 uppercase">Counselling Status</span>
                          <Badge variant="outline" className={`text-[10px] font-black uppercase tracking-wider px-2 h-5 rounded-full border-2 ${statusColors[selectedDossierCand.status] ?? ""}`}>
                            {selectedDossierCand.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border rounded-2xl">
                      <CardHeader className="py-3 px-4 border-b">
                        <CardTitle className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                          <Sliders className="h-4 w-4 text-purple-500" /> Sequential Location List
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 space-y-2">
                        {selectedDossierCand.preferredLocations && selectedDossierCand.preferredLocations.length > 0 ? (
                          selectedDossierCand.preferredLocations.map((loc: string, i: number) => (
                            <div key={i} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                              <span className="font-bold text-slate-500">Choice #{i + 1}</span>
                              <span className="font-black text-slate-900 uppercase">{loc}</span>
                            </div>
                          ))
                        ) : (
                          <div className="py-8 text-center text-slate-300 text-xs font-black uppercase tracking-widest border border-dashed rounded-xl">
                            Institutional choice active
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Right Column: Score Breakdown */}
                  <div className="space-y-6">
                    <Card className="border rounded-2xl bg-slate-900 text-white shadow-lg shadow-indigo-900/5">
                      <CardHeader className="py-4 px-6 border-b border-white/5">
                        <CardTitle className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                          <Medal className="h-4 w-4 text-amber-500" /> Entrance Evaluation Register
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4 text-xs font-semibold">
                        <div className="flex justify-between items-center py-2.5 border-b border-white/5">
                          <span className="text-slate-400 uppercase">Entrance MCQ score</span>
                          <span className="text-sm font-black tabular-nums">{fmt(selectedDossierCand.mcqScore)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2.5 border-b border-white/5">
                          <span className="text-slate-400 uppercase">Psychometric profile</span>
                          <span className="text-sm font-black tabular-nums">{fmt(selectedDossierCand.psychometricScore)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2.5 border-b border-white/5">
                          <span className="text-slate-400 uppercase">Clinical panel average</span>
                          <span className="text-sm font-black tabular-nums">{fmt(selectedDossierCand.interviewScore)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-4">
                          <span className="text-sm font-black uppercase tracking-wider text-indigo-400">Aggregate Merit Score</span>
                          <span className="text-2xl font-black text-emerald-400 tabular-nums">{selectedDossierCand.totalScore.toFixed(2)}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border rounded-2xl bg-indigo-50 border-indigo-100 p-6 flex flex-col justify-center">
                      <div className="flex items-center gap-3 mb-2 text-indigo-950">
                        <CheckCircle2 className="h-5 w-5 text-indigo-600 shrink-0" />
                        <h4 className="font-extrabold uppercase text-xs tracking-wider">Counselling Merit Standing</h4>
                      </div>
                      <p className="text-xs text-indigo-900 leading-relaxed font-medium">
                        This candidate ranks #{selectedDossierCand.rank} globally out of all applicants appearing in this counseling cycle. All verification documents have been validated.
                      </p>
                    </Card>
                  </div>
                </div>
              </div>

              {/* Dossier Footer */}
              <div className="p-6 bg-slate-50 border-t flex justify-end gap-3 shrink-0">
                <Button variant="outline" className="rounded-xl h-11 text-xs font-bold uppercase" onClick={() => setIsDossierOpen(false)}>
                  Close Dossier
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

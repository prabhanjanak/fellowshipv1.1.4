import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import {
  Loader2,
  Download,
  CheckCircle2,
  Trophy,
  Search,
  Mail,
  FileText,
  Building2,
  BarChart3,
  Calendar,
  Wallet,
  UserPlus,
  Printer,
  Info,
  Medal,
  MapPin,
  FileSpreadsheet,
  MonitorCheck,
  TrendingUp,
  LayoutGrid,
  LayoutDashboard,
  Users,
  Settings2,
  ArrowLeft,
  Clock,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Link2,
  Copy,
  Check,
  Eye,
  ImageIcon,
  X,
  Award,
  Zap
} from "lucide-react";
import { Tabs as TabsRoot, TabsList as TabsListRoot, TabsTrigger as TabsTriggerRoot, TabsContent as TabsContentRoot } from "../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../components/ui/dialog";
import { useToast } from "../hooks/use-toast";
import * as XLSX from 'xlsx';

function numberToWords(num: number): string {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const numStr = num.toString();
  if (numStr.length > 9) return 'overflow';
  let n: any = ('000000000' + numStr).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';
  let str = '';
  str += (Number(n[1]) != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += (Number(n[2]) != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += (Number(n[3]) != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += (Number(n[4]) != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += (Number(n[5]) != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
  return str.trim();
}

interface DocTemplate {
  id: number;
  name: string;
  googleDocId: string;
}

export default function AllocationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [specFilter, setSpecFilter] = useState("all");
  const [previewCandidate, setPreviewCandidate] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedSpecTab, setSelectedSpecTab] = useState("all");

  // Offer Details Form State
  const [sendingCandidate, setSendingCandidate] = useState<any | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("default");
  const [offerDetails, setOfferDetails] = useState<any>({
    interview_date: "",
    duration: "24 Months",
    start_date: "",
    reporting_date: "",
    induction_dates: "",
    stipend: "45000",
    stipend_words: "Forty Five Thousand",
    reporting_doctor: "Dr. Kaushik Murali",
    signing_authority: "Dr. Kaushik Murali, President Medical Operations, Sankara Eye Hospital, Sankara Eye Foundation India",
    unit: "",
    specialization: ""
  });

  const [dossierCandidate, setDossierCandidate] = useState<any | null>(null);
  const [dossierOpen, setDossierOpen] = useState(false);

  // Dynamic Custom Fields State
  const [customFields, setCustomFields] = useState<{ key: string, value: string }[]>([]);

  const { data: candidates = [], isLoading: isLoadingCandidates } = useQuery({
    queryKey: ["candidates"],
    queryFn: () => api.get<any[]>("/candidates"),
  });

  const { data: matrixData, isLoading: isLoadingMatrix } = useQuery({
    queryKey: ["seat-matrix"],
    queryFn: () => api.get<any>("/seat-matrix"),
  });


  const allocationMutation = useMutation({
    mutationFn: ({ id, specialization }: { id: number, specialization: string }) =>
      api.patch(`/candidates/${id}`, { status: 'allocated', reviewNotes: `Allocated to ${specialization}` }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      queryClient.invalidateQueries({ queryKey: ["seat-matrix"] });
      toast({ title: "Allocation Successful", description: "Candidate assigned." });
    }
  });

  const sendOfferMutation = useMutation({
    mutationFn: (data: { id: number, payload: any }) => api.post(`/candidates/${data.id}/send-offer`, data.payload),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      toast({ title: "Email Sent", description: "Document emailed to candidate." });
      setSendingCandidate(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const downloadMutation = useMutation({
    mutationFn: async (data: { id: number, payload: any }) => {
      const token = localStorage.getItem("fellowship_token");
      const res = await fetch(`/api/candidates/${data.id}/generate-document`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(data.payload),
      });
      if (!res.ok) throw new Error("Generation failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(new Blob([blob as any]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Offer_Letter_${data.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    },
    onSuccess: () => toast({ title: "Download Started", description: "Generating and downloading PDF..." }),
    onError: (e: any) => toast({ title: "Download Failed", description: e.message, variant: "destructive" }),
  });

  const handlePrintDossier = (id: number) => {
    const token = localStorage.getItem('fellowship_token');
    window.open(`/api/candidates/${id}/summary-pdf?token=${token}`, '_blank');
  };

  const handleAutoAllocate = () => {
    const plan: { id: number, specialization: string }[] = [];
    const tempOccupancy = { ...occupancy };
    scoredCandidates.forEach((c: any) => {
      if (c.status === 'allocated') return;
      for (const pref of c.preferences) {
        if ((tempOccupancy[pref] || 0) < (SEAT_MATRIX[pref] || 0)) {
          plan.push({ id: c.id, specialization: pref });
          tempOccupancy[pref] = (tempOccupancy[pref] || 0) + 1;
          break;
        }
      }
    });

    if (plan.length > 0 && confirm(`Auto-allocate ${plan.length} candidates?`)) {
      (async () => {
        let success = 0;
        for (const p of plan) {
          try {
            await allocationMutation.mutateAsync(p);
            success++;
          } catch (e) { console.error(e); }
        }
        toast({ title: "Auto-Allocation Complete", description: `Successfully allocated ${success} candidates.` });
      })();
    }
  };

  const handleStipendChange = (val: string) => {
    const num = parseInt(val) || 0;
    setOfferDetails((prev: any) => ({ ...prev, stipend: val, stipend_words: numberToWords(num) }));
  };

  const occupancy: Record<string, number> = {};
  matrixData?.rows?.forEach((r: any) => {
    occupancy[r.speciality] = r.totalAllocated || 0;
  });

  const SEAT_MATRIX: Record<string, number> = {};
  matrixData?.rows?.forEach((r: any) => {
    SEAT_MATRIX[r.speciality] = r.total;
  });

  const SPECIALIZATIONS = matrixData?.rows?.map((r: any) => r.speciality) || [];

  const scoredCandidates = candidates
    .map((c: any) => {
      const interviewAvg = c.interviewScore || 0;
      return {
        ...c,
        totalScore: (c.mcqScore || 0) + (c.psychometricScore || 0) + interviewAvg,
        interviewAvg,
        preferences: c.specializations || [],
        parsedCenterPreference: (() => {
          try {
            return typeof c.centerPreference === 'string' ? JSON.parse(c.centerPreference) : c.centerPreference || {};
          } catch (e) { return {}; }
        })()
      };
    })
    .sort((a: any, b: any) => (b.totalScore || 0) - (a.totalScore || 0));

  const isLoading = isLoadingCandidates || isLoadingMatrix;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <div className="flex flex-col items-center gap-6">
          <Loader2 className="h-16 w-16 animate-spin text-orange-500 opacity-20" />
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] animate-pulse">Initializing Command Center...</p>
        </div>
      </div>
    );
  }

  // Rankings within specialities
  const specialityRankings: Record<string, any[]> = {};
  SPECIALIZATIONS.forEach((spec: string) => {
    specialityRankings[spec] = scoredCandidates
      .filter(c => c.preferences.includes(spec))
      .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
  });

  const filtered = scoredCandidates.filter(c => {
    const matchSearch = c.fullName.toLowerCase().includes(search.toLowerCase()) ||
      c.candidateCode.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    const isAllocated = c.status === 'allocated';
    const allocatedSpec = isAllocated ? (c.reviewNotes || '').replace('Allocated to ', '').split(' [')[0] : null;
    const matchSpec = specFilter === "all" || (isAllocated && allocatedSpec === specFilter);

    return matchSearch && matchStatus && matchSpec;
  });


  const addCustomField = () => setCustomFields([...customFields, { key: "", value: "" }]);
  const removeCustomField = (index: number) => setCustomFields(customFields.filter((_, i) => i !== index));
  const updateCustomField = (index: number, field: 'key' | 'value', val: string) => {
    const newFields = [...customFields];
    newFields[index][field] = val;
    setCustomFields(newFields);
  };

  const buildPayload = () => {
    const customObj: Record<string, string> = {};
    customFields.forEach(f => {
      if (f.key.trim()) customObj[f.key.trim()] = f.value;
    });
    return {
      ...offerDetails,
      templateId: null,
      custom_fields: customObj
    };
  };

  const handleSend = () => sendOfferMutation.mutate({ id: sendingCandidate.id, payload: buildPayload() });
  const handleDownload = () => downloadMutation.mutate({ id: sendingCandidate.id, payload: buildPayload() });

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-black p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-600 via-amber-600 to-orange-500 p-8 text-white shadow-2xl">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/10 to-transparent blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-orange-100 text-sm font-medium">
              <Trophy className="h-4 w-4" />
              <span>Final Merit & Allocation</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight">Master Allocation Command</h1>
            <p className="text-orange-100/80 max-w-md">Finalize candidate assignments, manage institutional seat matrices, and dispatch official offer letters.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button 
              onClick={handleAutoAllocate} 
              className="bg-white text-orange-700 hover:bg-orange-50 transition-all font-bold h-12 px-6 rounded-2xl shadow-xl hover:scale-105 active:scale-95 gap-2 border-none"
            >
              <Zap className="h-5 w-5" /> Smart Allocate Engine
            </Button>
            <Button 
              variant="outline" 
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-2xl h-12 px-6 font-bold shadow-xl gap-2"
            >
              <Download className="h-4 w-4" /> Export Protocol
            </Button>
          </div>
        </div>
      </div>

      <TabsRoot value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsListRoot className="bg-black/5 dark:bg-white/5 p-1.5 rounded-2xl backdrop-blur-md h-auto flex-wrap justify-start border-none">
          <TabsTriggerRoot 
            value="dashboard" 
            className="rounded-xl px-6 font-bold uppercase text-[10px] tracking-widest h-10 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-lg transition-all border-none"
          >
             <LayoutGrid className="w-4 h-4 mr-2" /> Dashboard
          </TabsTriggerRoot>
          <TabsTriggerRoot 
            value="ranking" 
            className="rounded-xl px-6 font-bold uppercase text-[10px] tracking-widest h-10 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-lg transition-all border-none"
          >
            <Trophy className="w-4 h-4 mr-2" /> Merit Register
          </TabsTriggerRoot>
          <TabsTriggerRoot 
            value="speciality" 
            className="rounded-xl px-6 font-bold uppercase text-[10px] tracking-widest h-10 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-lg transition-all border-none"
          >
            <LayoutDashboard className="w-4 h-4 mr-2" /> Speciality Matrix
          </TabsTriggerRoot>
          <TabsTriggerRoot 
            value="allocation" 
            className="rounded-xl px-6 font-bold uppercase text-[10px] tracking-widest h-10 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-lg transition-all border-none"
          >
            <MonitorCheck className="w-4 h-4 mr-2" /> Unit Dispatch
          </TabsTriggerRoot>
        </TabsListRoot>

        <TabsContentRoot value="dashboard" className="space-y-12 outline-none">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
             <Card className="border-none shadow-premium bg-gradient-to-br from-orange-600 to-orange-800 p-10 rounded-[48px] flex flex-col justify-center text-center hover:shadow-2xl transition-all group hover:-translate-y-2 overflow-hidden relative">
                <div className="absolute top-0 right-0 h-32 w-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
                <div className="h-20 w-20 bg-white/10 rounded-3xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform backdrop-blur-md">
                  <Users className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-5xl font-black text-white tracking-tighter leading-none">{candidates.length}</h3>
                <p className="text-[11px] font-black text-orange-200 uppercase tracking-[0.3em] mt-4">Total Asset Pool</p>
             </Card>

             <Card className="border-none shadow-premium bg-white p-10 rounded-[48px] flex flex-col justify-center text-center hover:shadow-2xl transition-all group hover:-translate-y-2 border-2 border-slate-50">
                <div className="h-20 w-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-sm">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
                <h3 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">{candidates.filter((c: any) => c.status === 'allocated').length}</h3>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mt-4">Successfully Assigned</p>
             </Card>

             <Card className="border-none shadow-premium bg-white p-10 rounded-[48px] flex flex-col justify-center text-center hover:shadow-2xl transition-all group hover:-translate-y-2 border-2 border-slate-50">
                <div className="h-20 w-20 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-sm">
                  <Medal className="w-10 h-10 text-amber-500" />
                </div>
                <h3 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">{Math.max(0, (SPECIALIZATIONS.reduce((acc: number, s: string) => acc + (SEAT_MATRIX[s] || 0), 0)) - candidates.filter((c: any) => c.status === 'allocated').length)}</h3>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mt-4">Strategic Vacancy</p>
             </Card>

             <Card className="border-none shadow-premium bg-white p-10 rounded-[48px] flex flex-col justify-center text-center hover:shadow-2xl transition-all group hover:-translate-y-2 border-2 border-slate-50">
                <div className="h-20 w-20 bg-orange-50 rounded-3xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-sm">
                  <Trophy className="w-10 h-10 text-orange-500" />
                </div>
                <h3 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">{(scoredCandidates[0]?.totalScore ?? 0).toFixed(1)}</h3>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mt-4">Merit Ceiling</p>
             </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
             <Card className="lg:col-span-8 shadow-premium border-none bg-white rounded-[48px] overflow-hidden">
                <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
                   <h3 className="text-2xl font-black tracking-tighter uppercase">Integrated Allocation Matrix</h3>
                   <Badge className="bg-primary/20 text-primary border-none font-black text-[10px] h-7 px-4">REAL-TIME INVENTORY</Badge>
                </div>
                <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                   {SPECIALIZATIONS.map((spec: string) => {
                      const total = SEAT_MATRIX[spec] || 0;
                      const filled = occupancy[spec] || 0;
                      const percent = (filled / total) * 100;
                      return (
                        <div key={spec} className="p-8 rounded-[32px] bg-slate-50/50 border-2 border-slate-100 hover:border-primary/20 transition-all group">
                           <div className="flex justify-between items-start mb-4">
                              <h4 className="text-lg font-black text-slate-800 uppercase leading-tight">{spec}</h4>
                              <span className="text-2xl font-black text-slate-900">{filled}<span className="text-slate-300 text-sm ml-1">/ {total}</span></span>
                           </div>
                           <div className="w-full h-3 bg-slate-200/50 rounded-full overflow-hidden mb-3">
                              <div className={`h-full transition-all duration-1000 ${percent >= 100 ? 'bg-rose-500' : 'bg-primary'}`} style={{ width: `${Math.min(percent, 100)}%` }} />
                           </div>
                           <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                              <span className="text-slate-400">{total - filled} Seats Free</span>
                              <span className={percent >= 100 ? 'text-rose-500' : 'text-primary'}>{Math.round(percent)}% Load</span>
                           </div>
                        </div>
                      );
                   })}
                </div>
             </Card>

             <Card className="lg:col-span-4 shadow-premium border-none bg-slate-900 rounded-[48px] p-10 text-white">
                <div className="h-16 w-16 bg-white/10 rounded-2xl flex items-center justify-center mb-8 border-2 border-white/5 backdrop-blur-xl">
                   <Settings2 className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-3xl font-black tracking-tighter uppercase mb-2 leading-none">Command Center</h3>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-10">Global Allocation Protocols</p>
                
                <div className="space-y-6">
                   <Button onClick={handleAutoAllocate} className="w-full h-16 rounded-[24px] bg-white text-slate-900 font-black uppercase tracking-widest text-[11px] hover:bg-primary hover:text-white transition-all shadow-xl gap-3">
                      <TrendingUp className="w-5 h-5" /> Execute Auto-Allocation
                   </Button>
                   <Button variant="outline" className="w-full h-16 rounded-[24px] border-white/10 bg-white/5 text-white font-black uppercase tracking-widest text-[11px] hover:bg-white/10 transition-all gap-3">
                      <Download className="w-5 h-5" /> Generate Master Report
                   </Button>
                   <div className="pt-8 border-t border-white/5">
                      <div className="bg-white/5 p-6 rounded-[32px] border border-white/5">
                         <div className="flex items-center gap-3 mb-4 text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">System Status</span>
                         </div>
                         <p className="text-xs font-bold text-slate-400 leading-relaxed">
                            V1.0.3 Engine is currently active. All merit scoring algorithms are synchronized with MCQ, Psychometric, and Panel data.
                         </p>
                      </div>
                   </div>
                </div>
             </Card>
          </div>
        </TabsContentRoot>

        <TabsContentRoot value="ranking" className="space-y-8 outline-none">
           <Card className="shadow-premium border-none bg-white rounded-[48px] overflow-hidden">
             <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
                <div className="space-y-1">
                   <h2 className="text-3xl font-black tracking-tighter uppercase leading-none">Global Merit Register</h2>
                   <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.3em]">Comprehensive Candidate Scoring Architecture</p>
                </div>
                <div className="relative w-96">
                   <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                   <Input 
                     placeholder="SEARCH BY NAME OR CODE..." 
                     value={search} 
                     onChange={e => setSearch(e.target.value)}
                     className="bg-white/10 border-white/10 text-white placeholder:text-slate-500 h-14 pl-14 rounded-[20px] focus:bg-white focus:text-slate-900 transition-all font-black text-[11px] uppercase tracking-widest border-2"
                   />
                </div>
             </div>
             <div className="overflow-x-auto">
               <Table>
                 <TableHeader className="bg-slate-50/80 backdrop-blur-sm sticky top-0 z-10">
                   <TableRow className="h-20 hover:bg-slate-50/80 border-b-2 border-slate-100">
                     <TableHead className="w-32 text-center font-black text-slate-400 text-[12px] uppercase tracking-widest">Merit Rank</TableHead>
                     <TableHead className="font-black text-slate-400 text-[12px] uppercase tracking-widest px-8">Candidate Profile</TableHead>
                     <TableHead className="text-center font-black text-slate-400 text-[12px] uppercase tracking-widest">MCQ</TableHead>
                     <TableHead className="text-center font-black text-slate-400 text-[12px] uppercase tracking-widest">Psych</TableHead>
                     <TableHead className="text-center font-black text-slate-400 text-[12px] uppercase tracking-widest">Interview</TableHead>
                     <TableHead className="text-center font-black text-slate-900 text-[12px] uppercase tracking-[0.2em] bg-slate-100/50">Aggregate</TableHead>
                     <TableHead className="text-right font-black text-slate-400 text-[12px] uppercase tracking-widest px-10">Command</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {filtered.map((c: any, index: number) => (
                     <TableRow key={c.id} className="h-28 hover:bg-slate-50/40 transition-all border-b border-slate-50 group">
                       <TableCell className="text-center">
                          <div className={`mx-auto h-16 w-16 rounded-[24px] flex items-center justify-center font-black text-2xl border-2 transition-all group-hover:scale-110 ${index < 3 ? 'border-amber-400 bg-amber-50 text-amber-700 shadow-2xl shadow-amber-200/50' : 'border-slate-100 bg-white text-slate-400'}`}>
                            {index + 1}
                          </div>
                       </TableCell>
                       <TableCell className="px-8">
                          <div className="font-black text-slate-900 uppercase tracking-tighter text-2xl leading-none mb-2 group-hover:text-primary transition-colors">{c.fullName}</div>
                          <div className="flex items-center gap-4">
                             <span className="text-[12px] font-black text-slate-400 uppercase font-mono bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">{c.candidateCode}</span>
                             <Badge variant="outline" className={`text-[10px] font-black uppercase tracking-widest h-6 px-3 rounded-full border-2 ${c.status === 'allocated' ? 'bg-primary/5 border-primary text-primary' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                               {c.status}
                             </Badge>
                          </div>
                       </TableCell>
                       <TableCell className="text-center text-xl font-bold text-slate-600 tabular-nums">{(c.mcqScore || 0).toFixed(1)}</TableCell>
                       <TableCell className="text-center text-xl font-bold text-slate-600 tabular-nums">{(c.psychometricScore || 0).toFixed(1)}</TableCell>
                       <TableCell className="text-center text-xl font-bold text-slate-600 tabular-nums">{(c.interviewAvg || 0).toFixed(1)}</TableCell>
                       <TableCell className="text-center text-3xl font-black text-slate-900 tabular-nums tracking-tighter bg-slate-50/30 group-hover:bg-slate-100/50 transition-all border-x border-slate-50 px-6">
                          {(c.totalScore || 0).toFixed(2)}
                       </TableCell>
                       <TableCell className="text-right px-10">
                          <Button 
                            variant="ghost" 
                            size="lg" 
                            onClick={() => setPreviewCandidate(c)}
                            className="rounded-2xl font-black uppercase tracking-widest text-[11px] h-12 px-8 gap-3 hover:bg-slate-100 hover:text-primary transition-all shadow-sm border border-slate-100"
                          >
                            <FileSpreadsheet className="w-5 h-5" /> Detailed Analysis
                          </Button>
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
             </div>
           </Card>
        </TabsContentRoot>

        <TabsContentRoot value="speciality" className="space-y-8 outline-none">
           <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide">
              <Button 
                variant={selectedSpecTab === "all" ? "default" : "outline"}
                onClick={() => setSelectedSpecTab("all")}
                className={`rounded-[20px] px-10 h-14 font-black uppercase tracking-widest text-[11px] shadow-lg transition-all ${selectedSpecTab === "all" ? 'bg-slate-900 shadow-slate-900/20 scale-105' : 'bg-white border-2 border-slate-200 hover:bg-slate-50 shadow-slate-200/20'}`}
              >
                Integrated Rankings
              </Button>
              {SPECIALIZATIONS.map((spec: string) => (
                <Button 
                  key={spec}
                  variant={selectedSpecTab === spec ? "default" : "outline"}
                  onClick={() => setSelectedSpecTab(spec)}
                  className={`rounded-[20px] px-10 h-14 font-black uppercase tracking-widest text-[11px] shadow-lg transition-all shrink-0 ${selectedSpecTab === spec ? 'bg-primary shadow-primary/20 scale-105' : 'bg-white border-2 border-slate-200 hover:bg-slate-50 shadow-slate-200/20'}`}
                >
                  {spec}
                </Button>
              ))}
           </div>

           <Card className="shadow-premium border-none bg-white rounded-[48px] overflow-hidden">
              <div className="p-10 border-b-2 border-slate-50 flex justify-between items-center bg-slate-50/20 backdrop-blur-sm">
                 <div className="space-y-1">
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">
                      {selectedSpecTab === "all" ? "Unified Merit Performance" : `${selectedSpecTab} Specialized Ranking`}
                    </h3>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Candidates ranked by track-specific aggregate merit</p>
                 </div>
                 <div className="h-12 bg-slate-900 text-white px-8 rounded-2xl flex items-center gap-3 text-[11px] font-black uppercase tracking-widest shadow-xl shadow-slate-900/20">
                    <UserPlus className="w-4 h-4 text-emerald-400" />
                    {(selectedSpecTab === "all" ? scoredCandidates : (specialityRankings[selectedSpecTab] || [])).length} Track Candidates
                 </div>
              </div>
              <Table>
                <TableHeader className="bg-slate-50/50">
                   <TableRow className="h-20 hover:bg-transparent border-b">
                      <TableHead className="w-32 text-center font-black uppercase text-[11px] tracking-widest text-slate-400">Position</TableHead>
                      <TableHead className="font-black uppercase text-[11px] tracking-widest px-8 text-slate-400">Candidate Information</TableHead>
                      <TableHead className="font-black uppercase text-[11px] tracking-widest text-center text-slate-400">Merit Aggregate</TableHead>
                      <TableHead className="font-black uppercase text-[11px] tracking-widest text-center text-slate-400">Center Preference</TableHead>
                      <TableHead className="text-right font-black uppercase text-[11px] tracking-widest px-12 text-slate-400">Lifecycle Status</TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                   {(selectedSpecTab === "all" ? scoredCandidates : (specialityRankings[selectedSpecTab] || [])).map((c, idx) => (
                      <TableRow key={c.id} className="h-24 border-b border-slate-50 hover:bg-slate-50/30 transition-all group">
                         <TableCell className="text-center">
                            <div className="mx-auto h-12 w-12 rounded-2xl bg-white border-2 border-slate-100 flex items-center justify-center font-black text-slate-900 text-lg shadow-sm group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all">
                               #{idx + 1}
                            </div>
                         </TableCell>
                         <TableCell className="px-8">
                            <div className="font-black text-slate-800 uppercase text-xl tracking-tight leading-none mb-1.5">{c.fullName}</div>
                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-mono">{c.candidateCode}</div>
                         </TableCell>
                         <TableCell className="text-center">
                            <div className="inline-flex h-10 px-6 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 items-center justify-center font-black text-lg tabular-nums shadow-sm">
                               {c.totalScore.toFixed(2)}
                            </div>
                         </TableCell>
                         <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-1.5">
                               <div className="h-8 w-8 bg-amber-50 rounded-lg flex items-center justify-center">
                                  <Trophy className="w-4 h-4 text-amber-600" />
                               </div>
                               <div className="flex flex-col items-center">
                                  <div className="flex flex-col mb-1">
                                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight leading-none">
                                       Allocated: {c.reviewNotes?.replace("Allocated to ", "").split(" [")[0] || "Pending"}
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                       Pref: {c.preferences?.[0] || "General"}
                                    </span>
                                  </div>
                                  <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1">
                                     <MapPin className="h-2 w-2" /> {(Object.values(c.parsedCenterPreference || {})?.[0] as string) || "Institutional Choice"}
                                  </span>
                               </div>
                            </div>
                         </TableCell>
                         <TableCell className="text-right px-12">
                            <div className="flex items-center justify-end gap-3">
                               <Button 
                                 variant="outline" 
                                 size="sm" 
                                 className="rounded-xl border-slate-200 font-black uppercase text-[9px] h-9 gap-2 hover:bg-slate-900 hover:text-white transition-all"
                                 onClick={() => {
                                   setDossierCandidate(c);
                                   setDossierOpen(true);
                                 }}
                               >
                                 <FileText className="h-3 w-3" /> Allocation Details
                               </Button>
                               <Badge variant={c.status === 'allocated' ? 'default' : 'outline'} className={`rounded-full px-5 h-8 font-black uppercase text-[10px] tracking-widest transition-all ${c.status === 'allocated' ? 'bg-primary shadow-lg shadow-primary/20' : 'bg-white border-2'}`}>
                                  {c.status}
                               </Badge>
                            </div>
                         </TableCell>
                      </TableRow>
                   ))}
                </TableBody>
              </Table>
           </Card>
        </TabsContentRoot>

        <TabsContentRoot value="allocation" className="space-y-8 outline-none">
           <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
              {/* Left Side: Real-time Seat Matrix Dashboard */}
              <div className="xl:col-span-3">
                 <Card className="shadow-premium border-none bg-white rounded-[40px] overflow-hidden sticky top-10 border-2 border-slate-100/50">
                    <CardHeader className="bg-slate-900 p-8">
                       <CardTitle className="text-[11px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                          <Building2 className="w-5 h-5 text-amber-400" /> Real-Time Inventory
                       </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8">
                       {SPECIALIZATIONS.map((spec: string) => {
                          const total = SEAT_MATRIX[spec] || 0;
                          const filled = occupancy[spec] || 0;
                          const remaining = total - filled;
                          return (
                             <div key={spec} className="space-y-4">
                                <div className="flex justify-between items-center">
                                   <span className="text-[11px] font-black text-slate-500 uppercase tracking-tight truncate max-w-[140px]">{spec}</span>
                                   <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg shadow-sm border ${remaining <= 0 ? 'text-rose-600 bg-rose-50 border-rose-100' : 'text-emerald-600 bg-emerald-50 border-emerald-100'}`}>
                                      {remaining} AVAILABLE
                                   </span>
                                </div>
                                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                   <div className={`h-full transition-all duration-1000 shadow-lg ${(filled/total) >= 1 ? 'bg-rose-500' : 'bg-primary'}`} style={{ width: `${Math.min((filled/total)*100, 100)}%` }} />
                                </div>
                             </div>
                          );
                       })}
                    </CardContent>
                 </Card>
              </div>

              {/* Right Side: Allocation Command Center */}
              <div className="xl:col-span-9">
                 <Card className="shadow-premium border-none bg-white rounded-[48px] overflow-hidden">
                    <Table>
                       <TableHeader className="bg-slate-50/60 backdrop-blur-sm sticky top-0 z-10">
                          <TableRow className="h-20 hover:bg-transparent border-b-2">
                             <TableHead className="w-24 text-center font-black text-slate-400 text-[11px] uppercase tracking-widest">Rank</TableHead>
                             <TableHead className="font-black text-slate-400 text-[11px] uppercase tracking-widest px-8">Candidate Analysis</TableHead>
                             <TableHead className="font-black text-slate-400 text-[11px] uppercase tracking-widest px-8">Track Preference & Execution</TableHead>
                             <TableHead className="text-right font-black text-slate-400 text-[11px] uppercase tracking-widest px-12">Action Control</TableHead>
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          {scoredCandidates.map((c, idx) => {
                             const isAllocated = c.status === 'allocated';
                             const allocatedSpec = isAllocated ? (c.reviewNotes || '').replace('Allocated to ', '').split(' [')[0] : null;
                             return (
                                <TableRow key={c.id} className={`h-36 border-b border-slate-50 transition-all hover:bg-slate-50/20 group ${isAllocated ? 'bg-slate-50/40' : ''}`}>
                                   <TableCell className="text-center">
                                      <div className="mx-auto h-14 w-14 rounded-2xl flex items-center justify-center font-black text-slate-300 text-2xl tabular-nums border-2 border-slate-100 group-hover:border-primary/20 group-hover:text-primary transition-all bg-white shadow-sm">
                                         #{idx + 1}
                                      </div>
                                   </TableCell>
                                   <TableCell className="px-8">
                                      <div className="font-black text-slate-900 uppercase text-2xl tracking-tighter leading-none mb-3 group-hover:text-primary transition-colors">{c.fullName}</div>
                                      <div className="flex gap-3 items-center">
                                         <Badge className="bg-slate-900 text-white border-none font-black text-[10px] px-3 h-6 rounded-lg shadow-lg shadow-slate-900/20">SCORE: {c.totalScore.toFixed(2)}</Badge>
                                         <Badge className="bg-emerald-100 text-emerald-800 border-none font-black text-[10px] px-3 h-6 rounded-lg">INT: {c.interviewAvg.toFixed(1)}</Badge>
                                      </div>
                                   </TableCell>
                                   <TableCell className="px-8">
                                      {isAllocated ? (
                                         <div className="flex flex-col gap-3">
                                            <div className="flex items-center gap-3">
                                               <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center">
                                                  <MonitorCheck className="w-5 h-5 text-primary" />
                                               </div>
                                               <div>
                                                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Allocated Track</div>
                                                  <span className="text-lg font-black text-slate-900 uppercase tracking-tight">{allocatedSpec}</span>
                                               </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100 w-fit px-3 py-1 rounded-lg">
                                               <Building2 className="w-4 h-4" /> {c.unitName}
                                            </div>
                                         </div>
                                      ) : (
                                         <div className="space-y-4">
                                            <div className="flex gap-2 flex-wrap">
                                               {c.preferences.map((p: string, i: number) => {
                                                  const isAvailable = (SEAT_MATRIX[p] || 0) > (occupancy[p] || 0);
                                                  return (
                                                     <button 
                                                       key={i} 
                                                       disabled={!isAvailable}
                                                       onClick={() => isAvailable && allocationMutation.mutate({ id: c.id, specialization: p })}
                                                       className={`text-[10px] font-black uppercase tracking-widest h-9 px-5 rounded-xl transition-all flex items-center gap-2 border-2 ${isAvailable ? 'bg-white border-primary/20 text-primary hover:bg-primary hover:text-white hover:border-primary hover:scale-105 active:scale-95 shadow-lg shadow-primary/5' : 'opacity-20 grayscale cursor-not-allowed border-slate-200 text-slate-400'}`}>
                                                       {p} {i === 0 && <Badge className="bg-primary/10 text-primary border-none text-[8px] h-4 px-1.5 ml-1">1ST</Badge>}
                                                     </button>
                                                  );
                                               })}
                                            </div>
                                             <div className="flex flex-col gap-2 mt-4">
                                                <div className="flex items-center gap-2 text-[10px] font-black text-orange-600 uppercase tracking-widest bg-orange-50 w-fit px-3 py-1.5 rounded-lg border border-orange-100 shadow-sm">
                                                   <Award className="w-3.5 h-3.5 text-orange-500" /> Choice 1: {c.preferences[0] || "General Track"}
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 w-fit px-3 py-1.5 rounded-lg border border-rose-100 shadow-sm">
                                                   <MapPin className="w-3.5 h-3.5" /> {(Object.values(c.parsedCenterPreference || {})?.[0] as string) || "INSTITUTIONAL CHOICE"}
                                                </div>
                                             </div>
                                         </div>
                                      )}
                                   </TableCell>
                                   <TableCell className="text-right px-12">
                                      <div className="flex justify-end gap-3">
                                         <Button size="icon" variant="outline" className="h-12 w-12 rounded-2xl border-2 border-slate-100 hover:border-primary hover:bg-primary/5 transition-all group/btn" onClick={() => setPreviewCandidate(c)}>
                                            <Info className="w-5 h-5 text-slate-400 group-hover/btn:text-primary" />
                                         </Button>
                                         <Button 
                                            size="icon" 
                                            variant="outline" 
                                            className="h-12 w-12 rounded-2xl border-2 border-slate-100 hover:border-primary hover:bg-primary/5 transition-all group/btn" 
                                            onClick={() => {
                                              const token = localStorage.getItem("fellowship_token");
                                              window.open(`/api/candidates/${c.id}/summary-pdf?token=${token}`, "_blank");
                                            }}
                                          >
                                            <Printer className="w-5 h-5 text-slate-400 group-hover/btn:text-primary" />
                                         </Button>
                                         {isAllocated && (
                                            <Button className="bg-slate-900 rounded-2xl px-8 h-12 font-black uppercase tracking-widest text-[11px] shadow-xl shadow-slate-900/20 hover:bg-primary transition-colors" 
                                               onClick={() => {
                                                  setSendingCandidate({...c, allocatedSpec: c.reviewNotes.replace('Allocated to ', '').split(' [')[0]});
                                                  setOfferDetails((prev: any) => ({ ...prev, specialization: c.reviewNotes.replace('Allocated to ', '').split(' [')[0], unit: c.unitName }));
                                               }}>
                                               Dispatch Offer
                                            </Button>
                                         )}
                                      </div>
                                   </TableCell>
                                </TableRow>
                             );
                          })}
                       </TableBody>
                    </Table>
                 </Card>
              </div>
           </div>
        </TabsContentRoot>
      </TabsRoot>

      {/* Marksheet / Profile Preview Dialog */}
      <Dialog open={!!previewCandidate} onOpenChange={() => setPreviewCandidate(null)}>
        <DialogContent className="max-w-5xl p-0 border-none bg-slate-100 rounded-[48px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.3)]">
           <div className="bg-slate-900 p-10 text-white flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 right-0 h-full w-1/3 bg-gradient-to-l from-primary/20 to-transparent pointer-events-none" />
              <div className="flex items-center gap-6 relative z-10">
                 <div className="h-20 w-20 bg-white/10 rounded-[28px] flex items-center justify-center border-2 border-white/10 backdrop-blur-md">
                    <FileSpreadsheet className="w-10 h-10 text-primary" />
                 </div>
                 <div>
                    <h2 className="text-4xl font-black uppercase tracking-tighter leading-none mb-2">{previewCandidate?.fullName}</h2>
                    <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em]">{previewCandidate?.candidateCode} • Institutional Merit Report</p>
                 </div>
              </div>
              <Button variant="ghost" onClick={() => setPreviewCandidate(null)} className="text-slate-400 hover:text-white rounded-full h-14 w-14 p-0 hover:bg-white/10 relative z-10"><X className="w-8 h-8" /></Button>
           </div>
           
           <div className="p-12 space-y-10 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-3 gap-8">
                 <Card className="p-8 rounded-[36px] border-none shadow-premium bg-white group hover:scale-[1.02] transition-transform">
                    <div className="flex items-center gap-3 mb-4">
                       <MonitorCheck className="w-5 h-5 text-blue-500" />
                       <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Entrance Performance</p>
                    </div>
                    <div className="text-5xl font-black text-slate-900 tabular-nums leading-none">{(previewCandidate?.mcqScore || 0).toFixed(1)}</div>
                    <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                       <div className="h-full bg-blue-500" style={{ width: `${(previewCandidate?.mcqScore || 0)}%` }} />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-4">Merit Component Weight: 50%</p>
                 </Card>
                 
                 <Card className="p-8 rounded-[36px] border-none shadow-premium bg-white group hover:scale-[1.02] transition-transform">
                    <div className="flex items-center gap-3 mb-4">
                       <LayoutGrid className="w-5 h-5 text-emerald-500" />
                       <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Psychometric Profile</p>
                    </div>
                    <div className="text-5xl font-black text-slate-900 tabular-nums leading-none">{(previewCandidate?.psychometricScore || 0).toFixed(1)}</div>
                    <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                       <div className="h-full bg-emerald-500" style={{ width: `${(previewCandidate?.psychometricScore || 0)}%` }} />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-4">Behavioral Alignment Index</p>
                 </Card>
                 
                 <Card className="p-8 rounded-[36px] border-none shadow-2xl bg-slate-900 text-white shadow-primary/30 group hover:scale-[1.02] transition-transform">
                    <div className="flex items-center gap-3 mb-4">
                       <Medal className="w-5 h-5 text-primary" />
                       <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Interview Aggregate</p>
                    </div>
                    <div className="text-5xl font-black text-white tabular-nums leading-none">{(previewCandidate?.interviewAvg || 0).toFixed(1)}</div>
                    <div className="mt-4 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                       <div className="h-full bg-primary shadow-[0_0_15px_rgba(var(--primary),0.8)]" style={{ width: `${(previewCandidate?.interviewAvg || 0)}%` }} />
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mt-4">Multi-Panel Consensus Score</p>
                 </Card>
              </div>

              <div className="grid grid-cols-5 gap-10">
                 <div className="col-span-3 bg-white rounded-[40px] p-10 border-2 border-slate-100 shadow-sm">
                    <h3 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                       <Trophy className="w-5 h-5 text-amber-500" /> Track Preference Matrix
                    </h3>
                    <div className="space-y-4">
                       {previewCandidate?.preferences.map((p: string, i: number) => (
                          <div key={i} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white hover:shadow-xl transition-all">
                             <div className="flex items-center gap-5">
                                <div className="h-10 w-10 bg-white rounded-xl border-2 border-slate-100 flex items-center justify-center font-black text-slate-900">
                                   {i + 1}
                                </div>
                                <span className="text-lg font-black text-slate-800 uppercase tracking-tight">{p}</span>
                             </div>
                             <Badge className="bg-slate-900 text-white border-none font-black text-[10px] px-4 h-8 rounded-xl shadow-lg">PRIORITY {i + 1}</Badge>
                          </div>
                       ))}
                    </div>
                 </div>

                 <div className="col-span-2 space-y-8">
                    <div className="bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl">
                       <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-6 leading-none">Operational Metrics</h3>
                       <div className="space-y-6">
                          <div className="flex justify-between items-center">
                             <span className="text-xs font-bold text-slate-400 uppercase">Aggregated Merit</span>
                             <span className="text-2xl font-black text-primary tabular-nums">{previewCandidate?.totalScore.toFixed(2)}</span>
                          </div>
                          <div className="h-px bg-white/5" />
                          <div className="flex justify-between items-center">
                             <span className="text-xs font-bold text-slate-400 uppercase">Institutional Status</span>
                             <Badge className="bg-white/10 text-white border-white/20 font-black uppercase text-[10px] h-7 px-4 rounded-lg">{previewCandidate?.status}</Badge>
                          </div>
                          <div className="h-px bg-white/5" />
                          <div className="flex justify-between items-center">
                             <span className="text-xs font-bold text-slate-400 uppercase">Center preference</span>
                             <span className="text-xs font-black uppercase tracking-widest">{previewCandidate?.centerPreference || "None Specified"}</span>
                          </div>
                       </div>
                    </div>

                    <div className="bg-emerald-50 rounded-[40px] p-8 border-2 border-emerald-100 flex items-center gap-6">
                       <div className="h-16 w-16 bg-white rounded-3xl flex items-center justify-center shadow-lg shadow-emerald-200">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                       </div>
                       <div>
                          <p className="text-[11px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1.5">Verification Status</p>
                          <h4 className="text-lg font-black text-emerald-900 uppercase">Payment Validated</h4>
                       </div>
                    </div>
                 </div>
              </div>
              
              <div className="flex justify-end gap-5 pt-6">
                 <Button variant="ghost" onClick={() => setPreviewCandidate(null)} className="h-14 px-10 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-slate-200">Close Registry Access</Button>
                 <Button 
                   className="h-14 px-10 rounded-2xl font-black uppercase tracking-widest text-[11px] bg-slate-900 shadow-2xl hover:scale-105 active:scale-95 transition-all gap-3"
                   onClick={() => {
                     if (!previewCandidate?.submissionId) {
                       toast({ title: "Analysis Unavailable", description: "No linked submission data found.", variant: "destructive" });
                       return;
                     }
                     const token = localStorage.getItem("fellowship_token");
                     window.open(`/api/v2/generate-print/${previewCandidate.submissionId}?token=${token}`, "_blank");
                   }}>
                   <Printer className="w-5 h-5" /> Print Comprehensive Performance Analysis
                 </Button>
              </div>
           </div>
        </DialogContent>
      </Dialog>

      {/* Document Management Dialog */}
      <Dialog open={!!sendingCandidate} onOpenChange={() => setSendingCandidate(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-[48px] shadow-2xl">
          <div className="bg-slate-900 p-10 text-white sticky top-0 z-20 flex justify-between items-center border-b border-white/5 backdrop-blur-xl">
            <div className="flex items-center gap-6">
              <div className="h-16 w-16 bg-primary/20 rounded-[28px] flex items-center justify-center border-2 border-primary/30">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <div>
                <DialogTitle className="font-black uppercase tracking-[0.2em] text-lg leading-none mb-2">Document Generation Suite</DialogTitle>
                <DialogDescription className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Configuring Allocation Letter for Dr. {sendingCandidate?.fullName}</DialogDescription>
              </div>
            </div>
            <Button variant="ghost" onClick={() => setSendingCandidate(null)} className="text-slate-400 hover:text-white rounded-full h-14 w-14 p-0 hover:bg-white/10"><X className="h-8 w-8" /></Button>
          </div>

          <div className="p-12 space-y-12">
            <div className="bg-amber-50 p-6 rounded-2xl border-2 border-amber-100 flex items-center gap-4">
              <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                <FileText className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-[11px] font-black text-amber-900 uppercase tracking-widest leading-none mb-1">Standard Institutional Protocol</p>
                <p className="text-[10px] font-bold text-amber-700/60 uppercase">Default Fellowship Offer Template Active</p>
              </div>
            </div>

            {/* Step 2: Content Details */}
            <div className="space-y-8 pt-8 border-t-2 border-slate-50">
              <div className="flex items-center gap-4 text-[12px] font-black uppercase tracking-[0.3em] text-slate-400">
                <div className="h-8 w-8 rounded-xl flex items-center justify-center bg-slate-100 text-slate-900 font-black border-2 border-slate-200">02</div>
                Deployment Configuration
              </div>
              <div className="grid grid-cols-3 gap-8">
                 <div className="space-y-3">
                    <Label className="text-[11px] font-black uppercase text-slate-500 tracking-widest ml-1">Allocated Unit</Label>
                    <div className="h-14 px-5 bg-slate-100 rounded-2xl flex items-center text-sm font-black text-slate-900 uppercase border-2 border-slate-200/50">
                       {offerDetails.unit}
                    </div>
                 </div>
                 <div className="space-y-3">
                    <Label className="text-[11px] font-black uppercase text-slate-500 tracking-widest ml-1">Specialization</Label>
                    <div className="h-14 px-5 bg-primary/5 rounded-2xl flex items-center text-sm font-black text-primary uppercase border-2 border-primary/10">
                       {offerDetails.specialization}
                    </div>
                 </div>
                 <div className="space-y-3">
                    <Label className="text-[11px] font-black uppercase text-slate-500 tracking-widest ml-1">Interview Date</Label>
                    <Input value={offerDetails.interview_date} onChange={e => setOfferDetails({ ...offerDetails, interview_date: e.target.value })} className="font-black h-14 text-sm rounded-2xl border-2 px-6 focus:ring-primary" />
                 </div>
              </div>
              
              <div className="grid grid-cols-3 gap-8">
                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase text-slate-500 tracking-widest ml-1">Cycle Start Date</Label>
                  <Input value={offerDetails.start_date} onChange={e => setOfferDetails({ ...offerDetails, start_date: e.target.value })} className="font-black h-14 text-sm rounded-2xl border-2 px-6 focus:ring-primary" />
                </div>
                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase text-slate-500 tracking-widest ml-1">Reporting Date</Label>
                  <Input value={offerDetails.reporting_date} onChange={e => setOfferDetails({ ...offerDetails, reporting_date: e.target.value })} className="font-black h-14 text-sm rounded-2xl border-2 px-6 focus:ring-primary" />
                </div>
                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase text-slate-500 tracking-widest ml-1">Monthly Stipend (INR)</Label>
                  <Input type="number" value={offerDetails.stipend} onChange={e => handleStipendChange(e.target.value)} className="font-black h-14 text-sm rounded-2xl border-2 px-6 focus:ring-primary" />
                </div>
              </div>
              
              <div className="space-y-3">
                <Label className="text-[11px] font-black uppercase text-slate-500 tracking-widest ml-1">Induction Protocol Period</Label>
                <Input value={offerDetails.induction_dates} onChange={e => setOfferDetails({ ...offerDetails, induction_dates: e.target.value })} className="font-black h-14 text-sm rounded-2xl border-2 px-6 focus:ring-primary" placeholder="e.g., July 1st to July 5th, 2026" />
              </div>

              <div className="space-y-3">
                <Label className="text-[11px] font-black uppercase text-slate-500 tracking-widest ml-1">Signing Authority</Label>
                <Input 
                  value={offerDetails.signing_authority} 
                  onChange={e => setOfferDetails({ ...offerDetails, signing_authority: e.target.value })} 
                  className="font-black h-14 text-sm rounded-2xl border-2 px-6 focus:ring-primary" 
                  placeholder="e.g., Dr. Kaushik Murali, President Medical Operations" 
                />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">This name/title will appear on the allocation letter</p>
              </div>
            </div>

            {/* Step 3: Custom Tags */}
            <div className="space-y-6 pt-8 border-t-2 border-slate-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-[12px] font-black uppercase tracking-[0.3em] text-slate-400">
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center bg-slate-100 text-slate-900 font-black border-2 border-slate-200">03</div>
                  Custom Metadata Tags
                </div>
                <Button variant="ghost" size="sm" onClick={addCustomField} className="h-10 px-5 text-[10px] font-black uppercase text-primary gap-2 hover:bg-primary/5 rounded-xl border border-primary/20 transition-all">
                  <Plus className="h-4 w-4" /> Inject New Parameter
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-6">
                {customFields.map((field, idx) => (
                  <div key={idx} className="flex gap-4 items-center bg-slate-50/50 p-4 rounded-2xl border-2 border-slate-100 group hover:border-primary/20 transition-all">
                    <div className="space-y-1 flex-1">
                       <Input placeholder="TAG NAME (e.g. JOINING_CODE)" value={field.key} onChange={(e) => updateCustomField(idx, 'key', e.target.value)} className="h-10 text-[10px] font-black border-none bg-transparent uppercase tracking-widest placeholder:text-slate-300 focus:ring-0 px-0" />
                       <Input placeholder="ASSIGNED VALUE" value={field.value} onChange={(e) => updateCustomField(idx, 'value', e.target.value)} className="h-10 text-sm font-bold border-none bg-transparent focus:ring-0 px-0" />
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeCustomField(idx)} className="h-10 w-10 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-600 shrink-0"><X className="h-5 w-5" /></Button>
                  </div>
                ))}
              </div>
              {customFields.length === 0 && (
                 <div className="h-32 rounded-3xl border-2 border-dashed border-slate-100 flex items-center justify-center text-slate-300 text-[11px] font-black uppercase tracking-[0.3em]">
                    No custom metadata assigned
                 </div>
              )}
            </div>
          </div>

          <div className="bg-slate-50 p-10 border-t-2 border-slate-100 grid grid-cols-2 gap-6 sticky bottom-0 z-20 backdrop-blur-xl">
            <Button variant="outline" onClick={handleDownload} disabled={downloadMutation.isPending} className="h-16 font-black uppercase tracking-widest text-[11px] gap-3 border-2 border-slate-200 rounded-[20px] bg-white hover:bg-slate-50 transition-all shadow-lg shadow-slate-200/50">
              {downloadMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
              Generate & Inspect PDF
            </Button>
            <Button onClick={handleSend} disabled={sendOfferMutation.isPending} className="h-16 font-black uppercase tracking-widest text-[11px] gap-3 bg-slate-900 text-white rounded-[20px] hover:bg-primary transition-all shadow-xl shadow-slate-900/20 active:scale-95">
              {sendOfferMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Mail className="h-5 w-5 text-emerald-400" />}
              Commit & Dispatch via Email
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={dossierOpen} onOpenChange={setDossierOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-[40px] border-none shadow-2xl">
          <DialogHeader className="hidden">
            <DialogTitle>Candidate Dossier</DialogTitle>
            <DialogDescription>Full application and evaluation details</DialogDescription>
          </DialogHeader>
          {dossierCandidate && (
            <div className="flex flex-col h-[85vh]">
              <div className="p-10 bg-slate-900 text-white flex justify-between items-start shrink-0">
                <div className="flex gap-8 items-center">
                  <div className="h-24 w-24 rounded-3xl bg-white/10 border-2 border-white/10 flex items-center justify-center overflow-hidden">
                    {dossierCandidate.photoUrl ? (
                      <img src={dossierCandidate.photoUrl} alt="Candidate" className="h-full w-full object-cover" />
                    ) : (
                      <Users className="h-10 w-10 text-white/20" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Badge className="bg-primary/20 text-primary border-none font-black text-[10px] h-6 px-4">ALLOCATION DOSSIER</Badge>
                    <h2 className="text-4xl font-black tracking-tighter uppercase leading-none italic">{dossierCandidate.fullName}</h2>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs font-mono">{dossierCandidate.candidateCode}</p>
                  </div>
                </div>
                <Button 
                  onClick={() => handlePrintDossier(dossierCandidate.id)}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-black uppercase text-[11px] tracking-widest h-14 px-10 rounded-2xl gap-3 shadow-xl shadow-orange-500/20 transition-all hover:scale-[1.02]"
                >
                  <Printer className="h-5 w-5" /> Print Formal Dossier
                </Button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-12 bg-white">
                <div className="grid grid-cols-2 gap-12">
                  <div className="space-y-10">
                    <section>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                        <div className="h-1 w-8 bg-primary rounded-full" /> Academic Profile
                      </h4>
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                          <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Primary Specialization</p>
                            <p className="font-black text-slate-900 uppercase text-sm">{dossierCandidate.preferences?.[0] || "General Track"}</p>
                          </div>
                          <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Preferred Location</p>
                             <p className="font-black text-slate-900 uppercase text-sm">{String(Object.values(dossierCandidate.parsedCenterPreference || {})?.[0] || "Institutional")}</p>
                          </div>
                        </div>
                        <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Institutional Status</p>
                          <Badge variant="outline" className="font-black uppercase text-[10px] tracking-widest border-2">{dossierCandidate.status}</Badge>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                        <div className="h-1 w-8 bg-emerald-500 rounded-full" /> Merit Matrix
                      </h4>
                      <div className="p-8 rounded-[40px] bg-slate-900 text-white space-y-6 shadow-2xl shadow-slate-900/20">
                        <div className="flex justify-between items-center pb-6 border-b border-white/10">
                          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">MCQ Score</span>
                          <span className="text-xl font-black tabular-nums">{(dossierCandidate.mcqScore || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center pb-6 border-b border-white/10">
                          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Psychometric</span>
                          <span className="text-xl font-black tabular-nums">{(dossierCandidate.psychometricScore || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center pb-6 border-b border-white/10">
                          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Clinical Interview</span>
                          <span className="text-xl font-black tabular-nums">{(dossierCandidate.interviewScore || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                          <span className="text-sm font-black uppercase tracking-[0.2em] text-primary">Aggregate Merit</span>
                          <span className="text-3xl font-black text-emerald-400 tabular-nums">{(dossierCandidate.totalScore || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className="space-y-10">
                    <section>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                        <div className="h-1 w-8 bg-amber-500 rounded-full" /> LOR & Verification
                      </h4>
                      <div className="space-y-4">
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border-2 border-slate-100 group hover:border-primary/20 transition-all">
                           <div className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                             <FileText className="h-5 w-5" />
                           </div>
                           <div className="flex-1">
                             <p className="text-[10px] font-black uppercase tracking-tight">Reference Document 01 (LOR)</p>
                             <p className="text-[9px] font-bold text-slate-400 uppercase">Verified via encrypted upload</p>
                           </div>
                           <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border-2 border-slate-100 group hover:border-primary/20 transition-all">
                           <div className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                             <FileText className="h-5 w-5" />
                           </div>
                           <div className="flex-1">
                             <p className="text-[10px] font-black uppercase tracking-tight">Reference Document 02 (LOR)</p>
                             <p className="text-[9px] font-bold text-slate-400 uppercase">Verified via encrypted upload</p>
                           </div>
                           <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        </div>
                      </div>
                    </section>

                    <section className="p-8 rounded-[40px] bg-orange-50 border-2 border-orange-100">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="h-12 w-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                          <Building2 className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-orange-900 uppercase tracking-tight">Allocation Instruction</p>
                          <p className="text-[10px] font-bold text-orange-700/60 uppercase">Protocol Summary</p>
                        </div>
                      </div>
                      <p className="text-xs font-bold text-orange-900/70 leading-relaxed italic">
                        "Candidate evaluation demonstrates high clinical proficiency. Strategic allocation to {dossierCandidate.reviewNotes?.replace("Allocated to ", "") || "specified unit"} is recommended based on merit ranking #{scoredCandidates.findIndex(cand => cand.id === dossierCandidate.id) + 1}."
                      </p>
                    </section>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

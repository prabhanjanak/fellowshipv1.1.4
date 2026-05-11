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
  UserCheck,
  Trophy,
  Search,
  Mail,
  FileText,
  Building2,
  BarChart3,
  Filter,
  Calendar,
  Wallet,
  UserPlus,
} from "lucide-react";
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

// Helper to convert numbers to Indian currency words
function numberToWords(num: number): string {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if ((num = num.toString()).length > 9) return 'overflow';
  let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return ''; 
  let str = '';
  str += (Number(n[1]) != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += (Number(n[2]) != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += (Number(n[3]) != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += (Number(n[4]) != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += (Number(n[5]) != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
  return str.trim();
}

export default function AllocationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [specFilter, setSpecFilter] = useState("all");
  const [previewCandidate, setPreviewCandidate] = useState<any | null>(null);
  
  // Offer Details Form State
  const [sendingCandidate, setSendingCandidate] = useState<any | null>(null);
  const [offerDetails, setOfferDetails] = useState({
    interview_date: "",
    duration: "24 Months",
    start_date: "",
    reporting_date: "",
    induction_dates: "",
    stipend: "45000",
    stipend_words: "Forty Five Thousand",
    reporting_doctor: "Dr. Kaushik Murali",
    signing_authority: "Dr. Kaushik Murali"
  });

  const { data: candidates = [], isLoading: isLoadingCandidates } = useQuery({
    queryKey: ["candidates"],
    queryFn: () => api.get<any[]>("/candidates"),
  });

  const { data: matrixData, isLoading: isLoadingMatrix } = useQuery({
    queryKey: ["seat-matrix"],
    queryFn: () => api.get<any>("/seat-matrix"),
  });

  const isLoading = isLoadingCandidates || isLoadingMatrix;

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
          } catch(e) { return {}; }
        })()
      };
    })
    .sort((a: any, b: any) => (b.totalScore || 0) - (a.totalScore || 0));

  const filtered = scoredCandidates.filter(c => {
    const matchSearch = c.fullName.toLowerCase().includes(search.toLowerCase()) || 
                       c.candidateCode.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    const isAllocated = c.status === 'allocated';
    const allocatedSpec = isAllocated ? c.reviewNotes?.replace('Allocated to ', '').split(' [')[0] : null;
    const matchSpec = specFilter === "all" || (isAllocated && allocatedSpec === specFilter);
    
    return matchSearch && matchStatus && matchSpec;
  });

  const allocationMutation = useMutation({
    mutationFn: ({ id, specialization }: { id: number, specialization: string }) => 
      api.patch(`/candidates/${id}`, { status: 'allocated', reviewNotes: `Allocated to ${specialization}` }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      queryClient.invalidateQueries({ queryKey: ["seat-matrix"] });
      toast({ title: "Allocation Successful", description: "Candidate has been assigned to the specialization." });
    }
  });

  const sendOfferMutation = useMutation({
    mutationFn: (data: { id: number, details: any }) => api.post(`/candidates/${data.id}/send-offer`, data.details),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      const methodText = res.method === "google_docs" ? " (via Google Docs Template)" : "";
      toast({ title: "Offer Letter Sent", description: `Professional offer letter dispatched successfully${methodText}.` });
      setSendingCandidate(null);
    },
    onError: (e: any) => {
      toast({ title: "Failed to send", description: e.message, variant: "destructive" });
    }
  });

  const autoAllocateMutation = useMutation({
    mutationFn: async (plan: { id: number, specialization: string }[]) => {
      for (const item of plan) {
        await api.patch(`/candidates/${item.id}`, { status: 'allocated', reviewNotes: `Allocated to ${item.specialization}` });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      queryClient.invalidateQueries({ queryKey: ["seat-matrix"] });
      toast({ title: "Auto-Allocation Complete", description: "Candidates assigned based on merit." });
    }
  });

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
    if (plan.length === 0) {
      toast({ title: "Nothing to allocate", description: "No eligible candidates or seats available." });
      return;
    }
    if (confirm(`Auto-allocate ${plan.length} candidates?`)) autoAllocateMutation.mutate(plan);
  };

  const handleStipendChange = (val: string) => {
    const num = parseInt(val) || 0;
    setOfferDetails(prev => ({
      ...prev,
      stipend: val,
      stipend_words: numberToWords(num)
    }));
  };

  const exportToExcel = () => {
    const data = filtered.map((c: any, index: number) => ({
      Rank: index + 1,
      "Candidate Code": c.candidateCode,
      Name: c.fullName,
      "MCQ Score": c.mcqScore || 0,
      "Total Score": c.totalScore.toFixed(2),
      "Allocated": c.status === 'allocated' ? c.reviewNotes?.replace('Allocated to ', '').split(' [')[0] : 'Pending',
      "Offer Sent": c.reviewNotes?.includes('[OFFER SENT]') ? 'Yes' : 'No'
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Allocations");
    XLSX.writeFile(workbook, `Allocations_JUL_2026.xlsx`);
  };

  const occupancy: Record<string, number> = {};
  matrixData?.rows?.forEach((r: any) => {
    occupancy[r.speciality] = r.totalAllocated || 0;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Merit-Based Allocation</h1>
          <p className="text-muted-foreground">JULY 2026 Batch — Final Seat Assignment & Offer Letters</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleAutoAllocate} variant="default" className="gap-2 bg-primary" disabled={autoAllocateMutation.isPending}>
            {autoAllocateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
            Smart Auto-Allocate
          </Button>
          <Button onClick={exportToExcel} variant="outline" className="gap-2 text-emerald-700 bg-emerald-50">
            <Download className="h-4 w-4" /> Export Excel
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex gap-2 flex-wrap bg-white p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name or code..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="interview_completed">Interview Done</SelectItem>
            <SelectItem value="allocated">Allocated</SelectItem>
          </SelectContent>
        </Select>
        <Select value={specFilter} onValueChange={setSpecFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Spec" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Specializations</SelectItem>
            {SPECIALIZATIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Seat Matrix Sidebar */}
        <Card className="xl:col-span-1 shadow-md h-fit">
          <CardHeader className="bg-slate-50 border-b p-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-tight">
              <BarChart3 className="h-4 w-4 text-primary" /> SEAT OCCUPANCY
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {SPECIALIZATIONS.map(spec => {
              const total = SEAT_MATRIX[spec] || 0;
              const filled = occupancy[spec] || 0;
              const percent = (filled / total) * 100;
              return (
                <div key={spec} className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold text-slate-600 uppercase tracking-tight">
                    <span className="truncate max-w-[160px]">{spec}</span>
                    <span className={filled >= total ? "text-rose-600" : "text-emerald-600"}>{filled} / {total}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div className={`h-full transition-all duration-500 ${percent >= 100 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(percent, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Merit List */}
        <Card className="xl:col-span-3 shadow-md overflow-hidden">
          <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3"><Trophy className="h-5 w-5 text-amber-400" /><h2 className="font-black uppercase tracking-widest text-sm">Merit Ranking & Allocation</h2></div>
            <Badge className="bg-primary text-white border-none text-[10px] uppercase font-black">Ranked by Total Score</Badge>
          </div>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-16 text-center font-bold">RANK</TableHead>
                  <TableHead className="font-bold">CANDIDATE</TableHead>
                  <TableHead className="font-bold">TOTAL</TableHead>
                  <TableHead className="font-bold">ALLOCATION</TableHead>
                  <TableHead className="text-right font-bold">ACTION</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c: any, index: number) => {
                  const isAllocated = c.status === 'allocated';
                  const allocatedSpec = isAllocated ? c.reviewNotes.replace('Allocated to ', '').split(' [')[0] : null;
                  const isMailSent = c.reviewNotes?.includes('[OFFER SENT]');
                  return (
                    <TableRow key={c.id} className={isAllocated ? "bg-emerald-50/40" : ""}>
                      <TableCell className="text-center font-black">{index + 1}</TableCell>
                      <TableCell>
                        <div className="font-black text-slate-800 uppercase tracking-tight">{c.fullName}</div>
                        <div className="text-[10px] font-mono text-slate-400">{c.candidateCode}</div>
                      </TableCell>
                      <TableCell className="text-lg font-black text-primary">{c.totalScore.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5 py-1">
                          {isAllocated ? (
                            <div className="flex flex-col">
                              <Badge className="bg-emerald-600 text-white w-fit text-[10px] font-black tracking-widest">{allocatedSpec}</Badge>
                              <span className="text-[10px] text-slate-400 mt-1 uppercase font-bold">{c.unitName}</span>
                            </div>
                          ) : (
                            c.preferences.slice(0, 2).map((p: string, i: number) => (
                              <div key={i} className="flex items-center gap-2 group">
                                <Badge variant="outline" className="text-[9px] h-4 px-1">{i + 1}</Badge>
                                <span className="text-[11px] font-bold text-slate-500 uppercase">{p}</span>
                                {(occupancy[p] || 0) < (SEAT_MATRIX[p] || 0) && (
                                  <button onClick={() => allocationMutation.mutate({ id: c.id, specialization: p })} className="text-[10px] font-black text-emerald-600 opacity-0 group-hover:opacity-100 uppercase">Allocate</button>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {isAllocated ? (
                          <div className="flex justify-end gap-2">
                             <Button size="sm" variant="outline" className="h-8 gap-1 text-[10px] font-black uppercase" onClick={() => setPreviewCandidate({ ...c, allocatedSpec })}>Preview</Button>
                             <Button 
                              size="sm" 
                              variant={isMailSent ? "secondary" : "default"} 
                              className="h-8 gap-1 text-[10px] font-black uppercase"
                              onClick={() => {
                                setSendingCandidate({ ...c, allocatedSpec });
                                // Pre-fill some details
                                setOfferDetails(prev => ({ ...prev, specialization: allocatedSpec, unit: c.unitName }));
                              }}
                            >
                              {isMailSent ? "Sent" : "Send Mail"}
                            </Button>
                          </div>
                        ) : <Badge variant="outline" className="text-slate-300">Pending</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Offer Details Dialog */}
      <Dialog open={!!sendingCandidate} onOpenChange={() => setSendingCandidate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Finalize Offer Letter Details
            </DialogTitle>
            <DialogDescription>Enter the specifics for Dr. {sendingCandidate?.fullName}'s fellowship offer.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Interview Date</Label>
              <Input value={offerDetails.interview_date} onChange={e => setOfferDetails({...offerDetails, interview_date: e.target.value})} placeholder="e.g. 15th May 2026" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Start Date</Label>
              <Input value={offerDetails.start_date} onChange={e => setOfferDetails({...offerDetails, start_date: e.target.value})} placeholder="e.g. 1st July 2026" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Reporting Date</Label>
              <Input value={offerDetails.reporting_date} onChange={e => setOfferDetails({...offerDetails, reporting_date: e.target.value})} placeholder="e.g. 30th June 2026" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Induction Dates</Label>
              <Input value={offerDetails.induction_dates} onChange={e => setOfferDetails({...offerDetails, induction_dates: e.target.value})} placeholder="e.g. 1st & 2nd July 2026" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Monthly Stipend (Rs)</Label>
              <Input type="number" value={offerDetails.stipend} onChange={e => handleStipendChange(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Stipend in Words</Label>
              <Input value={offerDetails.stipend_words} readOnly className="bg-slate-50 text-slate-500 italic text-[10px]" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><UserPlus className="h-3.5 w-3.5" /> Reporting Doctor</Label>
              <Input value={offerDetails.reporting_doctor} onChange={e => setOfferDetails({...offerDetails, reporting_doctor: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><UserPlus className="h-3.5 w-3.5" /> Signing Authority</Label>
              <Input value={offerDetails.signing_authority} onChange={e => setOfferDetails({...offerDetails, signing_authority: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendingCandidate(null)}>Cancel</Button>
            <Button onClick={() => sendOfferMutation.mutate({ id: sendingCandidate.id, details: offerDetails })} disabled={sendOfferMutation.isPending}>
              {sendOfferMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
              Generate & Send Offer Letter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewCandidate} onOpenChange={() => setPreviewCandidate(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 border-none">
          <div className="bg-slate-900 p-4 text-white flex justify-between items-center sticky top-0 z-10">
            <h2 className="font-black uppercase tracking-widest text-sm">Professional Offer Letter Preview</h2>
            <Button variant="ghost" size="sm" onClick={() => setPreviewCandidate(null)} className="text-white">Close</Button>
          </div>
          <div className="p-8 bg-white font-serif">
             <div className="border-2 border-slate-100 p-12 rounded shadow-sm relative min-h-[600px] text-slate-800 leading-relaxed">
                <div className="flex justify-between border-b-2 border-primary pb-6 mb-8">
                  <div className="h-16 w-32 bg-slate-50 flex items-center justify-center text-[8px] font-bold text-slate-300 rounded uppercase">Hospital Logo</div>
                  <div className="h-16 w-32 bg-slate-50 flex items-center justify-center text-[8px] font-bold text-slate-300 rounded uppercase">Academy Logo</div>
                </div>
                <div className="text-right text-sm font-bold mb-8 uppercase tracking-tighter">DATE: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                <div className="mb-6">
                  <p className="font-bold">Dear Dr. {previewCandidate?.fullName},</p>
                  <p className="text-xs text-slate-500">{previewCandidate?.address}</p>
                </div>
                <h3 className="text-center font-black underline mb-6">SUB: FELLOWSHIP OFFER LETTER</h3>
                <p className="mb-4">This refers to your interview for our Fellowship program.</p>
                <p className="mb-4">Sankara Academy of Vision is pleased to offer you fellowship in <strong>{previewCandidate?.allocatedSpec}</strong> at Sankara Eye Hospital – <strong>{previewCandidate?.unitName}</strong>.</p>
                <p className="mb-8">This letter is a professional preview. The final PDF will include all your custom fields and logos.</p>
                <div className="mt-20">
                  <p className="font-bold">Yours Sincerely,</p>
                  <br/><br/>
                  <p className="font-black uppercase text-slate-900">President,</p>
                  <p className="text-slate-500 text-sm">Medical Administration, Quality & Education</p>
                </div>
             </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

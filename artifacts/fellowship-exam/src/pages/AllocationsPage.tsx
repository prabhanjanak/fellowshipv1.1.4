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
  Plus,
  X,
  Tag,
  ChevronDown,
  Printer,
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
  
  // Offer Details Form State
  const [sendingCandidate, setSendingCandidate] = useState<any | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("default");
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

  const { data: programTemplates = [] } = useQuery<DocTemplate[]>({
    queryKey: ["document-templates", sendingCandidate?.programId],
    queryFn: () => sendingCandidate ? api.get<DocTemplate[]>(`/programs/${sendingCandidate.programId}/templates`) : Promise.resolve([]),
    enabled: !!sendingCandidate,
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
      const blob = await api.post(`/candidates/${data.id}/generate-document`, data.payload, { responseType: 'blob' });
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
      templateId: selectedTemplate === "default" ? null : selectedTemplate,
      custom_fields: customObj
    };
  };

  const handleSend = () => sendOfferMutation.mutate({ id: sendingCandidate.id, payload: buildPayload() });
  const handleDownload = () => downloadMutation.mutate({ id: sendingCandidate.id, payload: buildPayload() });

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
       // Batch update logic
    }
  };

  const handleStipendChange = (val: string) => {
    const num = parseInt(val) || 0;
    setOfferDetails(prev => ({ ...prev, stipend: val, stipend_words: numberToWords(num) }));
  };

  const occupancy: Record<string, number> = {};
  matrixData?.rows?.forEach((r: any) => {
    occupancy[r.speciality] = r.totalAllocated || 0;
  });

  return (
    <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen">
      {/* Header Section */}
      <div className="flex justify-between items-end pb-4 border-b border-slate-200">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tight text-slate-900">COMMAND CENTER</h1>
          <p className="text-muted-foreground font-black uppercase tracking-widest text-[10px] flex items-center gap-2">
            <Badge className="bg-primary text-white border-none text-[8px] h-4">ADM-2026</Badge>
            Fellowship Merit Allocation & Document Generation
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={handleAutoAllocate} variant="default" className="gap-2 bg-slate-900 font-black uppercase text-[10px] h-10 px-6">
            <Trophy className="h-4 w-4 text-amber-400" /> Smart Allocate
          </Button>
          <Button onClick={() => {}} variant="outline" className="gap-2 text-slate-900 bg-white font-black uppercase text-[10px] h-10 border-slate-300">
            <Download className="h-4 w-4" /> Export Batch
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Seat Matrix Sidebar */}
        <Card className="xl:col-span-3 shadow-sm h-fit border-slate-200 bg-white">
          <CardHeader className="bg-slate-50/50 border-b p-4">
            <CardTitle className="text-[10px] font-black flex items-center gap-2 uppercase tracking-widest text-slate-500">
              <BarChart3 className="h-4 w-4 text-primary" /> LIVE SEAT INVENTORY
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-5">
            {SPECIALIZATIONS.map(spec => {
              const total = SEAT_MATRIX[spec] || 0;
              const filled = occupancy[spec] || 0;
              const percent = (filled / total) * 100;
              return (
                <div key={spec} className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black text-slate-800 uppercase tracking-tight">
                    <span className="truncate max-w-[140px]">{spec}</span>
                    <span className={filled >= total ? "text-rose-600 bg-rose-50 px-1.5 rounded" : "text-emerald-600 bg-emerald-50 px-1.5 rounded"}>{filled} / {total}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-700 ${percent >= 100 ? 'bg-rose-500' : 'bg-primary'}`} style={{ width: `${Math.min(percent, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Merit List */}
        <Card className="xl:col-span-9 shadow-sm border-slate-200 overflow-hidden bg-white">
          <Table>
            <TableHeader className="bg-slate-900">
              <TableRow className="hover:bg-slate-900 border-none">
                <TableHead className="w-20 text-center font-black text-slate-400 text-[10px] uppercase">Rank</TableHead>
                <TableHead className="font-black text-slate-400 text-[10px] uppercase">Candidate Detail</TableHead>
                <TableHead className="font-black text-slate-400 text-[10px] uppercase">Merit Score</TableHead>
                <TableHead className="font-black text-slate-400 text-[10px] uppercase">Allocation</TableHead>
                <TableHead className="text-right font-black text-slate-400 text-[10px] uppercase">Action Center</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c: any, index: number) => {
                const isAllocated = c.status === 'allocated';
                const allocatedSpec = isAllocated ? c.reviewNotes.replace('Allocated to ', '').split(' [')[0] : null;
                const isMailSent = c.reviewNotes?.includes('[OFFER SENT]');
                return (
                  <TableRow key={c.id} className={`${isAllocated ? "bg-slate-50/50" : ""} border-slate-100`}>
                    <TableCell className="text-center">
                      <div className={`mx-auto h-9 w-9 rounded-xl flex items-center justify-center font-black text-sm border-2 ${index < 3 ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-100 bg-white text-slate-400'}`}>{index + 1}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-black text-slate-800 uppercase tracking-tight text-base leading-none mb-1">{c.fullName}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">{c.candidateCode}</span>
                        {isMailSent && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none h-4 text-[8px] font-black uppercase">Offer Dispatched</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xl font-black text-slate-900 tabular-nums tracking-tighter">{c.totalScore.toFixed(2)}</TableCell>
                    <TableCell>
                      {isAllocated ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-black text-primary uppercase tracking-widest">{allocatedSpec}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1"><Building2 className="h-3 w-3" /> {c.unitName}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex gap-1.5 flex-wrap">
                            {c.preferences.slice(0, 2).map((p: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-[9px] font-black uppercase tracking-tighter cursor-pointer hover:bg-primary hover:text-white transition-colors" onClick={() => allocationMutation.mutate({ id: c.id, specialization: p })}>
                                {p}
                              </Badge>
                            ))}
                          </div>
                          {c.centerPreference && (
                            <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1">
                              <Building2 className="h-3 w-3 text-emerald-500" /> Pref: {c.centerPreference}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isAllocated ? (
                        <div className="flex justify-end gap-1.5">
                           <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-slate-200" onClick={() => setPreviewCandidate({ ...c, allocatedSpec })} title="Preview">
                             <FileText className="h-4 w-4 text-slate-400" />
                           </Button>
                           {c.submissionId && (
                             <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-slate-200 text-blue-600" onClick={() => window.open(`/api/v2/generate-print/${c.submissionId}?token=${localStorage.getItem("fellowship_token")}`, "_blank")} title="Print Application Form">
                               <Printer className="h-4 w-4" />
                             </Button>
                           )}
                           <Button 
                            size="sm" 
                            variant="default" 
                            className="h-8 gap-2 text-[10px] font-black uppercase tracking-widest bg-slate-900"
                            onClick={() => {
                              const progId = scoredCandidates.find(x => x.id === c.id)?.programId;
                              setSendingCandidate({ ...c, allocatedSpec, programId: progId });
                              setOfferDetails(prev => ({ ...prev, specialization: allocatedSpec, unit: c.unitName }));
                            }}
                          >
                            <Calendar className="h-3.5 w-3.5" /> Manage Documents
                          </Button>
                        </div>
                      ) : <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Awaiting Merit Call</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Document Management Dialog */}
      <Dialog open={!!sendingCandidate} onOpenChange={() => setSendingCandidate(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 border-none bg-white">
          <div className="bg-slate-900 p-6 text-white sticky top-0 z-20 flex justify-between items-center">
            <div className="flex items-center gap-3">
               <div className="h-10 w-10 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
                  <FileText className="h-5 w-5 text-primary" />
               </div>
               <div>
                  <h2 className="font-black uppercase tracking-widest text-sm">Document Generation Suite</h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Configuring for Dr. {sendingCandidate?.fullName}</p>
               </div>
            </div>
            <Button variant="ghost" onClick={() => setSendingCandidate(null)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></Button>
          </div>
          
          <div className="p-8 space-y-8">
            {/* Step 1: Template Selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                 <Badge className="h-5 w-5 rounded-full p-0 flex items-center justify-center bg-slate-100 text-slate-500">1</Badge>
                 Select Letter Template
              </div>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="h-12 font-black uppercase tracking-tighter text-sm border-2">
                  <SelectValue placeholder="Choose a letter type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default" className="font-bold">Global Default Template</SelectItem>
                  {programTemplates.map(tpl => (
                    <SelectItem key={tpl.id} value={String(tpl.id)} className="font-bold uppercase">{tpl.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Step 2: Content Details */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
               <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                 <Badge className="h-5 w-5 rounded-full p-0 flex items-center justify-center bg-slate-100 text-slate-500">2</Badge>
                 Content Variables
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Interview Date</Label>
                  <Input value={offerDetails.interview_date} onChange={e => setOfferDetails({...offerDetails, interview_date: e.target.value})} className="font-bold h-9 text-xs" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Start Date</Label>
                  <Input value={offerDetails.start_date} onChange={e => setOfferDetails({...offerDetails, start_date: e.target.value})} className="font-bold h-9 text-xs" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Reporting Date</Label>
                  <Input value={offerDetails.reporting_date} onChange={e => setOfferDetails({...offerDetails, reporting_date: e.target.value})} className="font-bold h-9 text-xs" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Induction Program Dates</Label>
                  <Input value={offerDetails.induction_dates} onChange={e => setOfferDetails({...offerDetails, induction_dates: e.target.value})} className="font-bold h-9 text-xs" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Monthly Stipend</Label>
                  <Input type="number" value={offerDetails.stipend} onChange={e => handleStipendChange(e.target.value)} className="font-bold h-9 text-xs" />
                </div>
              </div>
            </div>

            {/* Step 3: Custom Tags */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <Badge className="h-5 w-5 rounded-full p-0 flex items-center justify-center bg-slate-100 text-slate-500">3</Badge>
                    Advanced Custom Tags
                  </div>
                  <Button variant="ghost" size="sm" onClick={addCustomField} className="h-6 text-[9px] font-black uppercase text-primary gap-1">
                    <Plus className="h-3 w-3" /> New Tag
                  </Button>
               </div>
               <div className="grid grid-cols-2 gap-3">
                  {customFields.map((field, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                       <Input placeholder="Tag Key" value={field.key} onChange={(e) => updateCustomField(idx, 'key', e.target.value)} className="h-8 text-[9px] font-black border-none bg-transparent" />
                       <Input placeholder="Value" value={field.value} onChange={(e) => updateCustomField(idx, 'value', e.target.value)} className="h-8 text-[9px] font-bold border-none bg-transparent" />
                       <Button size="sm" variant="ghost" onClick={() => removeCustomField(idx)} className="h-6 w-6 p-0 text-rose-500"><X className="h-3 w-3" /></Button>
                    </div>
                  ))}
               </div>
            </div>
          </div>

          <div className="bg-slate-50 p-8 border-t border-slate-200 grid grid-cols-2 gap-4">
             <Button variant="outline" onClick={handleDownload} disabled={downloadMutation.isPending} className="h-12 font-black uppercase tracking-widest text-xs gap-2 border-slate-300">
                {downloadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Download PDF Manually
             </Button>
             <Button onClick={handleSend} disabled={sendOfferMutation.isPending} className="h-12 font-black uppercase tracking-widest text-xs gap-2 bg-primary">
                {sendOfferMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Dispatch via Email
             </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewCandidate} onOpenChange={() => setPreviewCandidate(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-none bg-slate-200">
           <div className="p-12">
              <div className="bg-white shadow-2xl mx-auto max-w-[800px] min-h-[1000px] p-16 font-serif relative">
                 <div className="flex justify-between border-b-4 border-primary/20 pb-8 mb-12">
                    <div className="h-20 w-40 bg-slate-100 rounded-xl flex items-center justify-center text-[10px] font-black uppercase text-slate-300 italic">Hospital Logo</div>
                    <div className="h-20 w-40 bg-slate-100 rounded-xl flex items-center justify-center text-[10px] font-black uppercase text-slate-300 italic">Academy Logo</div>
                 </div>
                 <div className="space-y-6 text-slate-800">
                    <p className="text-right font-black uppercase tracking-widest text-xs text-slate-400">JULY 2026 ADMISSION CYCLE</p>
                    <div className="space-y-1">
                       <p className="font-black text-2xl text-slate-900 uppercase tracking-tighter">DR. {previewCandidate?.fullName}</p>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{previewCandidate?.candidateCode} • {previewCandidate?.address}</p>
                    </div>
                    <div className="h-1 w-20 bg-primary/30 rounded-full" />
                    <h2 className="text-center font-black underline text-2xl py-8 tracking-tight">SUB: FELLOWSHIP ALLOCATION OFFER</h2>
                    <p className="text-base leading-relaxed">This refers to your merit-based interview for the Fellowship program at Sankara Academy of Vision.</p>
                    <p className="text-base leading-relaxed">We are pleased to inform you that you have been allocated to the <strong>{previewCandidate?.allocatedSpec}</strong> specialization at our <strong>{previewCandidate?.unitName}</strong> unit.</p>
                    
                    <div className="py-20 text-center border-2 border-dashed rounded-3xl border-slate-100 mt-12 bg-slate-50/50">
                       <p className="font-black uppercase tracking-widest text-slate-300 text-xs italic">The formal document is generated via Google Docs API</p>
                    </div>
                 </div>
              </div>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

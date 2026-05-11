import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";
import { Search, UserPlus, Eye, FolderOpen, ExternalLink, Upload, Filter, ClipboardEdit, Trash2, Building2, CalendarDays, Info, ChevronDown, ChevronUp, Download, Printer } from "lucide-react";
import { useToast } from "../hooks/use-toast";

interface CandidateDocument {
  id: number; docType: string; fileName: string; fileUrl: string | null;
}

interface Candidate {
  id: number; candidateCode: string; fullName: string; email: string;
  phone: string | null; status: string; unitId: number | null; unitName?: string | null;
  gender?: string | null; dateOfBirth?: string | null;
  qualification?: string | null; collegeName?: string | null; address?: string | null;
  specializations: string[]; documents: CandidateDocument[]; createdAt?: string;
  mcqScore?: number | null; psychometricScore?: number | null;
  paymentInfo?: { amount: number | null; id: string | null; mode: string | null } | null;
  centerPreference?: string | null;
  submissionId?: number | null;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  interview_completed: "bg-blue-100 text-blue-800",
  waitlisted: "bg-purple-100 text-purple-800",
  allocated: "bg-emerald-100 text-emerald-800",
};

const INTERVIEW_SCHEDULE = [
  { displayDate: "01 June 2026", category: "Posterior Segment", specialities: ["Vitreo Retina", "Medical Retina"], venue: "Bengaluru" },
  { displayDate: "08 June 2026", category: "Anterior Segment", specialities: ["IOL Fellowship", "Cornea", "Glaucoma", "Oculoplasty", "Pediatric Ophthalmology", "Phaco Refractive"], venue: "Bengaluru" },
];

function getInterviewInfo(specializations: string[]) {
  for (const spec of specializations) {
    const slot = INTERVIEW_SCHEDULE.find((s) => s.specialities.includes(spec));
    if (slot) return slot;
  }
  return null;
}

const DOC_LABELS: Record<string, string> = {
  LOR1: "LOR 1", LOR2: "LOR 2", PAYMENT: "Payment Proof", PHOTO: "Passport Photo",
};

const SPEC_COLORS: Record<string, string> = {
  "IOL Fellowship": "bg-blue-100 text-blue-800",
  "Cornea": "bg-cyan-100 text-cyan-800",
  "Glaucoma": "bg-indigo-100 text-indigo-800",
  "Oculoplasty": "bg-pink-100 text-pink-800",
  "Pediatric Ophthalmology": "bg-orange-100 text-orange-800",
  "Phaco Refractive": "bg-violet-100 text-violet-800",
  "Medical Retina": "bg-red-100 text-red-800",
  "Vitreo Retina": "bg-rose-100 text-rose-800",
};

interface Panel { id: number; name: string; roomNumber: string; isActive: boolean; }

function ScoreDialog({ candidate, open, onClose }: { candidate: Candidate | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [mcq, setMcq] = useState(candidate?.mcqScore != null ? String(candidate.mcqScore) : "");
  const [psycho, setPsycho] = useState(candidate?.psychometricScore != null ? String(candidate.psychometricScore) : "");
  const [panelId, setPanelId] = useState<string>("");

  const { data: panels = [] } = useQuery<Panel[]>({
    queryKey: ["panels"],
    queryFn: () => api.get<Panel[]>("/panels"),
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: (data: { mcqScore?: number | null; psychometricScore?: number | null; panelId?: number | null }) =>
      api.patch(`/candidates/${candidate!.id}/marks`, data),
    onSuccess: () => {
      toast({ title: "Marks saved", description: panelId ? "Candidate added to panel queue" : undefined });
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["panels"] });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const activePanels = panels.filter((p) => p.isActive);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardEdit className="h-4 w-4" /> Enter Marks — {candidate?.fullName}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">{candidate?.candidateCode}</p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>MCQ Score <span className="text-muted-foreground text-xs">(0–100)</span></Label>
            <Input type="number" min={0} max={100} step={0.01} value={mcq} onChange={(e) => setMcq(e.target.value)} placeholder="e.g. 72.5" />
          </div>
          <div className="space-y-1.5">
            <Label>Psychometric Score <span className="text-muted-foreground text-xs">(0–100)</span></Label>
            <Input type="number" min={0} max={100} step={0.01} value={psycho} onChange={(e) => setPsycho(e.target.value)} placeholder="e.g. 65" />
          </div>
          <div className="space-y-1.5">
            <Label>Assign to Interview Panel <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Select value={panelId} onValueChange={setPanelId}>
              <SelectTrigger>
                <SelectValue placeholder="— No panel assignment —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— No panel assignment —</SelectItem>
                {activePanels.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    Room {p.roomNumber} — {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {panelId && panelId !== "none" && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Candidate will be added to the waiting queue for this panel
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded p-2">
            Interview scores are submitted separately by the panel doctors.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate({
            mcqScore: mcq !== "" ? Number(mcq) : null,
            psychometricScore: psycho !== "" ? Number(psycho) : null,
            panelId: panelId && panelId !== "none" ? Number(panelId) : null,
          })}>
            {saveMutation.isPending ? "Saving…" : "Save Marks"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CandidatesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [specFilter, setSpecFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [viewCandidate, setViewCandidate] = useState<Candidate | null>(null);
  const [docsCandidate, setDocsCandidate] = useState<Candidate | null>(null);
  const [scoreCandidate, setScoreCandidate] = useState<Candidate | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importProgramId, setImportProgramId] = useState("");
  const [importFileData, setImportFileData] = useState<string>("");
  const [importFileName, setImportFileName] = useState("");
  const [importColumns, setImportColumns] = useState<string[]>([]);
  const [importFieldLabels, setImportFieldLabels] = useState<Record<string, string>>({});
  const [importMapping, setImportMapping] = useState<Record<string, number>>({});
  const [importTotalRows, setImportTotalRows] = useState(0);
  const [importStep, setImportStep] = useState<"upload" | "map" | "done">("upload");
  const [importResult, setImportResult] = useState<{ inserted: number; updated: number; skipped: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ ids: number[]; label: string } | null>(null);
  const [assignUnitCandidate, setAssignUnitCandidate] = useState<Candidate | null>(null);
  const [assignUnitId, setAssignUnitId] = useState<string>("");

  const [form, setForm] = useState({
    fullName: "", email: "", phone: "", gender: "", qualification: "", collegeName: "", address: "",
  });

  const { data: candidates = [], isLoading } = useQuery<Candidate[]>({
    queryKey: ["candidates"],
    queryFn: () => api.get<Candidate[]>("/candidates"),
  });

  const { data: units = [] } = useQuery<{ id: number; name: string; city: string }[]>({
    queryKey: ["units"],
    queryFn: () => api.get("/units"),
  });

  const { data: programs = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["programs"],
    queryFn: () => api.get("/programs"),
  });

  const assignUnitMutation = useMutation({
    mutationFn: ({ candidateId, unitId }: { candidateId: number; unitId: number }) =>
      api.post(`/candidates/${candidateId}/assign-unit`, { unitId }),
    onSuccess: () => {
      toast({ title: "Unit assigned successfully" });
      qc.invalidateQueries({ queryKey: ["candidates"] });
      setAssignUnitCandidate(null);
      setAssignUnitId("");
    },
    onError: (e: Error) => toast({ title: "Assign failed", description: e.message, variant: "destructive" }),
  });

  const addMutation = useMutation({
    mutationFn: (data: typeof form) => api.post<Candidate>("/candidates", data),
    onSuccess: () => {
      toast({ title: "Candidate registered" });
      qc.invalidateQueries({ queryKey: ["candidates"] });
      setAddOpen(false);
      setForm({ fullName: "", email: "", phone: "", gender: "", qualification: "", collegeName: "", address: "" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status, candidate }: { id: number; status: string; candidate: Candidate }) =>
      api.patch<Candidate>(`/candidates/${id}`, { status }),
    onSuccess: (_data, vars) => {
      const { status, candidate } = vars;
      if (status === "approved") {
        const info = getInterviewInfo(candidate.specializations);
        toast({
          title: "Status updated → Approved",
          description: info
            ? `Interview: ${info.displayDate} at ${info.venue} (${info.category})`
            : "Status updated to approved",
        });
      } else if (status === "allocated") {
        toast({
          title: "Candidate allocated",
          description: `${candidate.fullName} has been allocated. Seat matrix updated.`,
        });
      } else {
        toast({ title: "Status updated" });
      }
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["seat-matrix"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) =>
      ids.length === 1
        ? api.delete(`/candidates/${ids[0]}`)
        : api.delete(`/candidates`),
    mutationKey: ["delete-candidates"],
    onSuccess: (_data, ids) => {
      toast({ title: `${ids.length === 1 ? "Candidate" : `${ids.length} candidates`} deleted` });
      qc.invalidateQueries({ queryKey: ["candidates"] });
      setSelected(new Set());
      setDeleteConfirm(null);
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const openImportDialog = () => {
    setImportStep("upload");
    setImportFileData("");
    setImportFileName("");
    setImportColumns([]);
    setImportMapping({});
    setImportProgramId("");
    setImportResult(null);
    setImportDialogOpen(true);
  };

  const handleFileSelect = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const b64 = (e.target!.result as string).split(",")[1]!;
      setImportFileData(b64);
      setImportFileName(file.name);
      setImportLoading(true);
      try {
        const res = await api.post<{ columns: string[]; suggestedMapping: Record<string, number>; fieldLabels: Record<string, string>; totalDataRows: number }>(
          "/import/excel/detect",
          { fileData: b64, fileName: file.name }
        );
        setImportColumns(res.columns);
        setImportMapping(res.suggestedMapping);
        setImportFieldLabels(res.fieldLabels);
        setImportTotalRows(res.totalDataRows);
        setImportStep("map");
      } catch (e) {
        toast({ title: "Could not read file", description: (e as Error).message, variant: "destructive" });
      } finally { setImportLoading(false); }
    };
    reader.readAsDataURL(file);
  };

  const runImport = async () => {
    if (!importProgramId) { toast({ title: "Please select a program" }); return; }
    setImportLoading(true);
    try {
      const result = await api.post<{ inserted: number; updated: number; skipped: number }>(
        "/import/excel/process",
        { fileData: importFileData, programId: Number(importProgramId), mapping: importMapping }
      );
      setImportResult(result);
      setImportStep("done");
      qc.invalidateQueries({ queryKey: ["candidates"] });
    } catch (e) {
      toast({ title: "Import failed", description: (e as Error).message, variant: "destructive" });
    } finally { setImportLoading(false); }
  };

  const allSpecs = Array.from(new Set(candidates.flatMap((c) => c.specializations))).sort();
  const filtered = candidates.filter((c) => {
    const matchSearch = c.fullName.toLowerCase().includes(search.toLowerCase()) ||
      c.candidateCode.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    const matchSpec = specFilter === "all" || c.specializations.includes(specFilter);
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchSpec && matchStatus;
  });

  const isSuperAdmin = user?.role === "super_admin";
  const isCEC = user?.role === "central_exam_coordinator";
  const canManage = user?.role === "super_admin" || user?.role === "program_admin" || isCEC;
  const canEnterScores = canManage;

  const allFilteredIds = filtered.map((c) => c.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selected.has(id));
  const someSelected = allFilteredIds.some((id) => selected.has(id));
  const selectedCount = allFilteredIds.filter((id) => selected.has(id)).length;

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selected);
      allFilteredIds.forEach((id) => next.delete(id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      allFilteredIds.forEach((id) => next.add(id));
      setSelected(next);
    }
  };

  const toggleOne = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const confirmDelete = (ids: number[]) => {
    const names = candidates.filter((c) => ids.includes(c.id)).map((c) => c.fullName);
    setDeleteConfirm({
      ids,
      label: ids.length === 1 ? names[0]! : `${ids.length} candidates`,
    });
  };

  const executeDelete = () => {
    if (!deleteConfirm) return;
    const { ids } = deleteConfirm;
    if (ids.length === 1) {
      api.delete<unknown>(`/candidates/${ids[0]}`).then(() => {
        toast({ title: "Candidate deleted" });
        qc.invalidateQueries({ queryKey: ["candidates"] });
        setSelected(new Set());
        setDeleteConfirm(null);
      }).catch((e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }));
    } else {
      api.post<unknown>("/candidates/bulk-delete", { ids }).then(() => {
        toast({ title: `${ids.length} candidates deleted` });
        qc.invalidateQueries({ queryKey: ["candidates"] });
        setSelected(new Set());
        setDeleteConfirm(null);
      }).catch((e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }));
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Candidates</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{filtered.length} of {candidates.length} candidates</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {canManage && selectedCount > 0 && (
            <Button variant="destructive" className="gap-2" onClick={() => confirmDelete(allFilteredIds.filter((id) => selected.has(id)))}>
              <Trash2 className="h-4 w-4" /> Delete {selectedCount} selected
            </Button>
          )}
          {(isSuperAdmin || isCEC) && (
            <Button variant="outline" className="gap-2" onClick={openImportDialog}>
              <Upload className="h-4 w-4" /> Import from Excel
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }}
          />
          {canManage && (
            <Button onClick={() => setAddOpen(true)} className="gap-2">
              <UserPlus className="h-4 w-4" /> Add Candidate
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, code, or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={specFilter} onValueChange={setSpecFilter}>
          <SelectTrigger className="w-52">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="All specializations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All specializations</SelectItem>
            {allSpecs.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["pending", "approved", "rejected", "interview_completed", "waitlisted", "allocated"].map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading candidates…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No candidates found</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    {canManage && (
                      <th className="px-4 py-3 w-10">
                        <Checkbox
                          checked={allSelected}
                          data-state={someSelected && !allSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"}
                          onCheckedChange={toggleAll}
                          aria-label="Select all"
                        />
                      </th>
                    )}
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Code</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email / Phone</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Specialization(s)</th>
                    {canEnterScores && <th className="text-center px-3 py-3 font-medium text-muted-foreground">MCQ</th>}
                    {canEnterScores && <th className="text-center px-3 py-3 font-medium text-muted-foreground">Psycho</th>}
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Payment</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className={`border-b last:border-0 hover:bg-muted/20 transition-colors ${selected.has(c.id) ? "bg-orange-50 dark:bg-orange-950/20" : ""}`}>
                      {canManage && (
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selected.has(c.id)}
                            onCheckedChange={() => toggleOne(c.id)}
                            aria-label={`Select ${c.fullName}`}
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.candidateCode}</td>
                      <td className="px-4 py-3 font-medium max-w-36 truncate">{c.fullName}</td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                        {c.phone && <div className="text-xs mt-0.5">{c.phone}</div>}
                      </td>
                      <td className="px-4 py-3 max-w-52">
                        <div className="flex flex-wrap gap-1">
                          {c.specializations.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : c.specializations.map((s) => (
                            <span key={s} className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium ${SPEC_COLORS[s] ?? "bg-gray-100 text-gray-700"}`}>{s}</span>
                          ))}
                        </div>
                      </td>
                      {canEnterScores && (
                        <td className="px-3 py-3 text-center">
                          {c.mcqScore != null
                            ? <span className="font-semibold text-primary">{c.mcqScore}</span>
                            : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                      )}
                      {canEnterScores && (
                        <td className="px-3 py-3 text-center">
                          {c.psychometricScore != null
                            ? <span className="font-semibold text-primary">{c.psychometricScore}</span>
                            : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        {c.paymentInfo ? (
                          <div className="space-y-0.5">
                            <div className="font-bold text-emerald-600">₹{c.paymentInfo.amount}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{c.paymentInfo.id}</div>
                            <div className="text-[9px] uppercase font-bold text-muted-foreground">{c.paymentInfo.mode}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No payment info</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {canManage ? (
                          <div className="space-y-1">
                            <Select value={c.status} onValueChange={(v) => updateStatus.mutate({ id: c.id, status: v, candidate: c })}>
                              <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {["pending", "approved", "rejected", "interview_completed", "waitlisted", "allocated"].map((s) => (
                                  <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {(c.status === "approved" || c.status === "interview_completed") && (() => {
                              const info = getInterviewInfo(c.specializations);
                              return info ? (
                                <div className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400">
                                  <CalendarDays className="h-2.5 w-2.5" />
                                  <span>{info.displayDate}</span>
                                </div>
                              ) : null;
                            })()}
                          </div>
                        ) : (
                          <Badge className={statusColors[c.status] ?? ""} variant="secondary">
                            {c.status.replace(/_/g, " ")}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {canEnterScores && (
                            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => setScoreCandidate(c)} title="Enter MCQ / Psychometric marks">
                              <ClipboardEdit className="h-3.5 w-3.5" /> Marks
                            </Button>
                          )}
                           {c.submissionId && (
                             <Button
                               variant="outline"
                               size="sm"
                               className="h-7 gap-1 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                               onClick={() => window.open(`/api/v2/generate-print/${c.submissionId}?token=${localStorage.getItem("fellowship_token")}`, "_blank")}
                               title="Print Application Form"
                             >
                               <Printer className="h-3.5 w-3.5" /> Print
                             </Button>
                           )}
                          {c.documents.length > 0 && (
                            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => setDocsCandidate(c)}>
                              <FolderOpen className="h-3.5 w-3.5" /> Docs
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setViewCandidate(c)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {canManage && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => { setAssignUnitCandidate(c); setAssignUnitId(c.unitId ? String(c.unitId) : ""); }} title="Assign Unit">
                              <Building2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canManage && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => confirmDelete([c.id])}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Score Entry Dialog */}
      <ScoreDialog candidate={scoreCandidate} open={!!scoreCandidate} onClose={() => setScoreCandidate(null)} />

      {/* Documents Dialog */}
      <Dialog open={!!docsCandidate} onOpenChange={() => setDocsCandidate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FolderOpen className="h-4 w-4" />Documents — {docsCandidate?.fullName}</DialogTitle></DialogHeader>
          {docsCandidate && (
            <div className="space-y-2">
              {docsCandidate.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No documents uploaded</p>
              ) : docsCandidate.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{DOC_LABELS[doc.docType] ?? doc.docType}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-60">{doc.fileName}</p>
                  </div>
                  {doc.fileUrl ? (
                    <Button size="sm" variant="outline" className="gap-1 text-xs shrink-0" onClick={() => window.open(doc.fileUrl!, "_blank")}>
                      <ExternalLink className="h-3 w-3" /> Open
                    </Button>
                  ) : <span className="text-xs text-muted-foreground">No link</span>}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Candidate Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Register Candidate</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            {[
              { field: "fullName", label: "Full Name", placeholder: "Dr. John Smith" },
              { field: "email", label: "Email", placeholder: "candidate@example.com" },
              { field: "phone", label: "Phone", placeholder: "+91 9876543210" },
              { field: "qualification", label: "Qualification", placeholder: "MBBS, MS Ophthalmology" },
              { field: "collegeName", label: "College/Institution", placeholder: "" },
              { field: "address", label: "Address", placeholder: "" },
            ].map(({ field, label, placeholder }) => (
              <div key={field} className="space-y-1">
                <Label>{label}</Label>
                <Input placeholder={placeholder} value={form[field as keyof typeof form]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} />
              </div>
            ))}
            <div className="space-y-1">
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={(v) => setForm((f) => ({ ...f, gender: v }))}>
                <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => addMutation.mutate(form)} disabled={addMutation.isPending || !form.fullName || !form.email}>
              {addMutation.isPending ? "Registering…" : "Register"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excel Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(o) => { if (!o) setImportDialogOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4" /> Import Candidates from Excel
            </DialogTitle>
          </DialogHeader>

          {importStep === "upload" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Upload the SAV fellowship application Excel file. Columns will be auto-detected from Google Sheets export.</p>
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">{importLoading ? "Detecting columns…" : "Click or drag an Excel file here"}</p>
                <p className="text-xs text-muted-foreground mt-1">.xlsx or .xls files only</p>
              </div>
            </div>
          )}

          {importStep === "map" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{importFileName}</p>
                  <p className="text-xs text-muted-foreground">{importTotalRows} data rows detected • {importColumns.length} columns</p>
                </div>
                <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => setImportStep("upload")}>Change file</button>
              </div>

              <div className="space-y-1.5">
                <Label>Program <span className="text-red-500">*</span></Label>
                <Select value={importProgramId} onValueChange={setImportProgramId}>
                  <SelectTrigger><SelectValue placeholder="Select program…" /></SelectTrigger>
                  <SelectContent>
                    {programs.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Column Mapping</p>
                <p className="text-xs text-muted-foreground mb-3">Auto-detected from column headers. Adjust any that are incorrect.</p>
                <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
                  {Object.entries(importFieldLabels).map(([field, label]) => (
                    <div key={field} className="flex items-center gap-3 px-3 py-2">
                      <span className="text-xs font-medium w-40 shrink-0 text-muted-foreground">{label}</span>
                      <Select
                        value={importMapping[field] != null ? String(importMapping[field]) : "__none__"}
                        onValueChange={(v) => {
                          setImportMapping((m) => {
                            const next = { ...m };
                            if (v === "__none__") delete next[field]; else next[field] = Number(v);
                            return next;
                          });
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs flex-1">
                          <SelectValue placeholder="— not mapped —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— not mapped —</SelectItem>
                          {importColumns.map((col, idx) => (
                            <SelectItem key={idx} value={String(idx)}>{col || `Column ${idx + 1}`}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setImportStep("upload")}>Back</Button>
                <Button onClick={runImport} disabled={importLoading || !importProgramId}>
                  {importLoading ? "Importing…" : `Import ${importTotalRows} rows`}
                </Button>
              </DialogFooter>
            </div>
          )}

          {importStep === "done" && importResult && (
            <div className="space-y-4 text-center py-4">
              <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto text-2xl font-bold">✓</div>
              <div>
                <p className="font-semibold text-lg">Import Complete</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {importResult.inserted} new · {importResult.updated} updated · {importResult.skipped} skipped
                </p>
              </div>
              <DialogFooter className="justify-center">
                <Button onClick={() => setImportDialogOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Candidate Dialog */}
      <Dialog open={!!viewCandidate} onOpenChange={() => setViewCandidate(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Candidate Details</DialogTitle></DialogHeader>
          {viewCandidate && (
            <div className="space-y-3 text-sm">
              {[
                ["Code", viewCandidate.candidateCode],
                ["Name", viewCandidate.fullName],
                ["Email", viewCandidate.email],
                ["Phone", viewCandidate.phone ?? "—"],
                ["Date of Birth", viewCandidate.dateOfBirth ?? "—"],
                ["Gender", viewCandidate.gender ?? "—"],
                ["Qualification", viewCandidate.qualification ?? "—"],
                ["College", viewCandidate.collegeName ?? "—"],
                ["Address", viewCandidate.address ?? "—"],
                ["Status", viewCandidate.status.replace(/_/g, " ")],
                ["Preferred Center", viewCandidate.centerPreference ?? "—"],
                ["MCQ Score", viewCandidate.mcqScore != null ? String(viewCandidate.mcqScore) : "—"],
                ["Psychometric Score", viewCandidate.psychometricScore != null ? String(viewCandidate.psychometricScore) : "—"],
              ].filter(([, v]) => v && v !== "—").map(([k, v]) => (
                <div key={k} className="flex justify-between border-b pb-2 last:border-0">
                  <span className="font-medium text-muted-foreground shrink-0 mr-3">{k}</span>
                  <span className="text-right max-w-64 break-words">{v}</span>
                </div>
              ))}
              {viewCandidate.specializations.length > 0 && (
                <div className="border-b pb-2">
                  <span className="font-medium text-muted-foreground block mb-1.5">Specialization(s)</span>
                  <div className="flex flex-wrap gap-1">
                    {viewCandidate.specializations.map((s) => (
                      <span key={s} className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${SPEC_COLORS[s] ?? "bg-gray-100 text-gray-700"}`}>{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {viewCandidate.documents && viewCandidate.documents.length > 0 && (
                <div className="border-b pb-2">
                  <span className="font-medium text-muted-foreground block mb-2">Documents</span>
                  <div className="space-y-2">
                    {viewCandidate.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">{doc.docType}</span>
                        {doc.fileUrl ? (
                          <a
                            href={doc.fileUrl.startsWith("/objects/") ? `/api/storage${doc.fileUrl}` : doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" /> View
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No file</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(() => {
                const info = getInterviewInfo(viewCandidate.specializations);
                if (!info) return null;
                return (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <CalendarDays className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Interview Schedule</span>
                    </div>
                    <p className="text-sm font-medium">{info.displayDate}</p>
                    <p className="text-xs text-muted-foreground">{info.category} • {info.venue}</p>
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign Unit Dialog */}
      <Dialog open={!!assignUnitCandidate} onOpenChange={(o) => { if (!o) { setAssignUnitCandidate(null); setAssignUnitId(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Assign Unit
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Candidate: <strong>{assignUnitCandidate?.fullName}</strong></p>
            {assignUnitCandidate?.unitName && (
              <p className="text-xs text-muted-foreground">Current unit: <span className="font-medium">{assignUnitCandidate.unitName}</span></p>
            )}
            <div className="space-y-1.5">
              <Label>Select Unit</Label>
              <Select value={assignUnitId} onValueChange={setAssignUnitId}>
                <SelectTrigger><SelectValue placeholder="Choose a unit…" /></SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name} — {u.city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAssignUnitCandidate(null); setAssignUnitId(""); }}>Cancel</Button>
            <Button
              disabled={!assignUnitId || assignUnitMutation.isPending}
              onClick={() => assignUnitMutation.mutate({ candidateId: assignUnitCandidate!.id, unitId: Number(assignUnitId) })}
            >
              {assignUnitMutation.isPending ? "Assigning…" : "Assign Unit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteConfirm?.ids.length === 1 ? "Candidate" : "Candidates"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteConfirm?.label}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={executeDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


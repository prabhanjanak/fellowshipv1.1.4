import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Separator } from "../components/ui/separator";
import {
  Plus, Link2, Copy, Check, Eye, Users, Clock, ChevronRight, ArrowLeft, ExternalLink,
  FileCheck, FileX, Loader2, Trash2, Download, CreditCard, GripVertical, Settings2, X as XIcon,
  RefreshCw, CheckCheck, Ban, FileText, ImageIcon, ChevronDown, ChevronUp, Building2, Printer,
} from "lucide-react";
import { useToast } from "../hooks/use-toast";

interface CustomField {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "radio" | "checkbox";
  options?: string[];
  required: boolean;
  placeholder?: string;
}

interface ApplicationForm {
  id: number; token: string; programId: number; programName: string | null;
  title: string; description: string | null; deadline: string | null;
  isActive: boolean; createdAt: string; submissionCount: number; pendingCount: number;
  customFields?: CustomField[];
  sectionsConfig?: any[];
}
interface Submission {
  id: number; formId: number; status: string; fullName: string; email: string;
  phone: string | null; specialization: string | null; centerPreference: string | null;
  permanentAddress: string | null; mailingAddress: string | null;
  dateOfBirth: string | null; maritalStatus: string | null; spouseDetails: string | null;
  healthDeclaration: string | null;
  referralSource: string | null; referredByName: string | null;
  degree: string | null; medicalCollege: string | null; university: string | null;
  pgQualifications: string | null;
  doQualification: boolean | null; doDetails: string | null;
  msMdQualification: boolean | null; msMdDetails: string | null;
  dnbQualification: boolean | null; dnbDetails: string | null;
  otherTraining: string | null;
  medicalCouncilNumber: string | null;
  totalSurgeries: string | null;
  publications: string | null; presentations: string | null;
  lor1Url: string | null; lor1RefName: string | null; lor1RefContact: string | null; lor1RefEmail: string | null;
  lor2Url: string | null; lor2RefName: string | null; lor2RefContact: string | null; lor2RefEmail: string | null;
  paymentUrl: string | null; photoUrl: string | null;
  otherInformation: string | null;
  declarationAccepted: boolean | null; submittedAt: string;
  reviewNotes: string | null; customAnswers?: Record<string, string>;
  readyForReview?: boolean; source?: string;
}
interface Program { id: number; name: string; }

/** Parse specialization field — may be a JSON array or plain comma-separated string */
function parseSpecializations(spec: string | null | undefined): string[] {
  if (!spec) return [];
  try {
    const parsed: unknown = JSON.parse(spec);
    if (Array.isArray(parsed)) return (parsed as unknown[]).map(String).filter(Boolean);
  } catch { /* not JSON */ }
  return spec.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Parse center preference field — may be JSON or needs fallback to customAnswers */
function parseCenterPreferences(cp: string | null | undefined, customAnswers?: any, sections?: any[]): Record<string, string> {
  if (cp) {
    try {
      const parsed: unknown = JSON.parse(cp);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, string>;
    } catch { /* not JSON or invalid */ }
  }
  
  // Fallback: search customAnswers for unit_* fields
  if (customAnswers && typeof customAnswers === "object") {
    const prefs: Record<string, string> = {};
    Object.entries(customAnswers).forEach(([key, val]) => {
      if (key.startsWith("unit_") && val) {
        let label = key.replace("unit_", "").replace(/_/g, " ").toUpperCase();
        // Try to find the real label from sectionsConfig
        if (sections) {
          sections.forEach(sec => {
            sec.fields?.forEach((f: any) => {
              if (f.id === key) label = f.label.replace(" Preferred Center", "");
            });
          });
        }
        prefs[label] = Array.isArray(val) ? val.join(", ") : String(val);
      }
    });
    return prefs;
  }
  return {};
}

const SPEC_BADGE_COLORS: Record<string, string> = {
  "Vitreo Retina": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "Medical Retina": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  "Cornea": "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  "Glaucoma": "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  "IOL Fellowship": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "Oculoplasty": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "Pediatric Ophthalmology": "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  "Phaco Refractive": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800", reviewed: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800", rejected: "bg-red-100 text-red-800",
};

function buildFormLink(token: string) {
  return `${window.location.origin}/apply/${token}`;
}

function genId() {
  return `cf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const FIELD_TYPE_LABELS: Record<CustomField["type"], string> = {
  text: "Short Text",
  textarea: "Long Text",
  select: "Dropdown (select one)",
  radio: "Multiple Choice (radio)",
  checkbox: "Checkbox (yes/no)",
};

function getStorageUrl(objectPath: string): string {
  return `/api/storage${objectPath}`;
}

function DocValue({ label, url }: { label: string; url: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchAndOpen = async (inline: boolean) => {
    if (!url || !url.startsWith("/objects/")) return;
    const servingUrl = `/api/storage${url}`;
    const token = localStorage.getItem("fellowship_token");
    setFetchError(null);
    setLoading(true);
    try {
      const res = await fetch(servingUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      if (inline) {
        setBlobUrl(objectUrl);
        setExpanded(true);
      } else {
        // Open in new tab
        const a = document.createElement("a");
        a.href = objectUrl;
        a.target = "_blank";
        a.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
      }
    } catch (e: any) {
      setFetchError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    if (expanded) {
      setExpanded(false);
    } else if (blobUrl) {
      setExpanded(true);
    } else {
      fetchAndOpen(true);
    }
  };

  if (!url || url === "nil" || url === "null") {
    return <span className="text-xs text-muted-foreground">Not provided</span>;
  }

  if (url.startsWith("razorpay:")) {
    const refId = url.slice("razorpay:".length);
    if (refId.startsWith("pay_")) {
      return (
        <a
          href={`https://dashboard.razorpay.com/app/payments/${refId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          {refId}
        </a>
      );
    }
    return <Badge variant="outline" className="text-xs font-mono py-0">{refId}</Badge>;
  }

  // Object storage path — fetch with auth and show inline
  if (url.startsWith("/objects/")) {
    const isPhoto = label.toLowerCase().includes("photo");
    return (
      <div className="w-full mt-1 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="h-6 text-xs px-2 gap-1" onClick={toggle} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : isPhoto ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
            {expanded ? "Hide" : "View"} {label}
          </Button>
          <button
            className="text-xs text-primary hover:underline flex items-center gap-0.5"
            onClick={() => fetchAndOpen(false)}
            disabled={loading}
          >
            <ExternalLink className="h-3 w-3" /> Open
          </button>
        </div>
        {fetchError && <p className="text-xs text-destructive">{fetchError}</p>}
        {expanded && blobUrl && isPhoto && (
          <img src={blobUrl} alt={label} className="rounded-lg border max-h-48 max-w-full object-contain" />
        )}
        {expanded && blobUrl && !isPhoto && (
          <iframe
            src={blobUrl}
            className="w-full rounded-lg border"
            style={{ height: 380 }}
            title={label}
          />
        )}
      </div>
    );
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return (
      <Button size="sm" variant="outline" className="h-6 text-xs px-2 gap-1"
        onClick={() => window.open(url, "_blank")}>
        <ExternalLink className="h-3 w-3" /> Open
      </Button>
    );
  }

  return <span className="text-xs font-mono break-all text-right max-w-48">{url}</span>;
}

function CustomFieldEditor({
  field,
  onChange,
  onDelete,
}: {
  field: CustomField;
  onChange: (updated: CustomField) => void;
  onDelete: () => void;
}) {
  const [optionsText, setOptionsText] = useState((field.options ?? []).join("\n"));
  const needsOptions = field.type === "select" || field.type === "radio";

  const updateOptions = (text: string) => {
    setOptionsText(text);
    const opts = text.split("\n").map((o) => o.trim()).filter(Boolean);
    onChange({ ...field, options: opts });
  };

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 mt-2.5 text-muted-foreground shrink-0 cursor-grab" />
        <div className="flex-1 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Field Label</Label>
              <Input
                placeholder="e.g., Institution Type"
                value={field.label}
                onChange={(e) => onChange({ ...field, label: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Input Type</Label>
              <Select
                value={field.type}
                onValueChange={(v) => onChange({ ...field, type: v as CustomField["type"], options: [] })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(FIELD_TYPE_LABELS) as [CustomField["type"], string][]).map(([val, lbl]) => (
                    <SelectItem key={val} value={val}>{lbl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!needsOptions && field.type !== "checkbox" && (
            <div className="space-y-1">
              <Label className="text-xs">Placeholder Text (optional)</Label>
              <Input
                placeholder="e.g., Enter your answer"
                value={field.placeholder ?? ""}
                onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
          )}

          {needsOptions && (
            <div className="space-y-1">
              <Label className="text-xs">Options (one per line)</Label>
              <Textarea
                placeholder={"Option A\nOption B\nOption C"}
                value={optionsText}
                onChange={(e) => updateOptions(e.target.value)}
                rows={3}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">Enter each option on a new line</p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id={`req-${field.id}`}
              checked={field.required}
              onCheckedChange={(v) => onChange({ ...field, required: !!v })}
            />
            <Label htmlFor={`req-${field.id}`} className="text-xs cursor-pointer">Required field</Label>
          </div>
        </div>
        <button onClick={onDelete} className="text-destructive/60 hover:text-destructive mt-0.5 shrink-0">
          <XIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function RichTextArea({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder?: string; label?: string }) {
  const editorRef = useRef<HTMLDivElement>(null);

  const execCommand = (command: string, value: string = "") => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  // Sync external value to editor (only if different to avoid cursor jumps)
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  return (
    <div className="space-y-1.5">
      {label && <Label className="text-[10px] font-bold text-muted-foreground uppercase">{label}</Label>}
      <div className="border rounded-md overflow-hidden bg-white dark:bg-slate-950 flex flex-col">
        <div className="flex items-center gap-0.5 p-1 bg-muted/30 border-b flex-wrap">
          <Button variant="ghost" size="sm" className="h-7 px-2 font-bold hover:bg-muted" onClick={() => execCommand("bold")}>B</Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 italic hover:bg-muted" onClick={() => execCommand("italic")}>I</Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 underline hover:bg-muted" onClick={() => execCommand("underline")}>U</Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button variant="ghost" size="sm" className="h-7 px-2 hover:bg-muted" onClick={() => execCommand("insertOrderedList")}>1.</Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 hover:bg-muted" onClick={() => execCommand("insertUnorderedList")}>•</Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] uppercase font-bold hover:bg-muted" onClick={() => execCommand("removeFormat")}>Clear</Button>
        </div>
        <div
          ref={editorRef}
          contentEditable
          onInput={(e) => onChange(e.currentTarget.innerHTML)}
          placeholder={placeholder}
          className="min-h-[120px] p-3 text-sm focus:outline-none overflow-y-auto prose prose-sm max-w-none dark:prose-invert"
          style={{ whiteSpace: "pre-wrap" }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground italic">Tip: Use the toolbar to format. No need to type HTML tags.</p>
    </div>
  );
}

export default function ApplicationFormsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [createdForm, setCreatedForm] = useState<ApplicationForm | null>(null);
  const [editForm, setEditForm] = useState<ApplicationForm | null>(null);
  const [viewFormId, setViewFormId] = useState<number | null>(null);
  const [viewSubId, setViewSubId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [createFormData, setCreateFormData] = useState({ programId: "", title: "", description: "", deadline: "", loadDefaults: true });
  const [createCustomFields, setCreateCustomFields] = useState<CustomField[]>([]);
  const [editCustomFields, setEditCustomFields] = useState<CustomField[]>([]);
  const [editSectionsConfig, setEditSectionsConfig] = useState<any[]>([]);

  // Google Sheets integration state (per edit dialog + success dialog)
  const [googleSheetsConfig, setGoogleSheetsConfig] = useState({ spreadsheetId: "", sheetName: "Form Responses 1", serviceAccountJson: "" });
  const [savingGsConfig, setSavingGsConfig] = useState(false);
  const [createdFormGsOpen, setCreatedFormGsOpen] = useState(false);
  const [createdFormGsConfig, setCreatedFormGsConfig] = useState({ spreadsheetId: "", sheetName: "Form Responses 1", serviceAccountJson: "" });
  const [savingCreatedGs, setSavingCreatedGs] = useState(false);

  // Load existing GS config when edit dialog opens
  const { data: editFormGsData } = useQuery<{ spreadsheetId: string; sheetName: string; hasServiceAccount: boolean }>({
    queryKey: ["gs-config", editForm?.id],
    queryFn: () => api.get<{ spreadsheetId: string; sheetName: string; hasServiceAccount: boolean }>(`/application-forms/${editForm!.id}/google-sheets-config`),
    enabled: editForm !== null,
  });
  // Populate GS config fields when data loads for edit dialog
  useEffect(() => {
    if (editFormGsData && editForm) {
      setGoogleSheetsConfig({
        spreadsheetId: editFormGsData.spreadsheetId || "",
        sheetName: editFormGsData.sheetName || "Form Responses 1",
        serviceAccountJson: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editFormGsData, editForm?.id]);

  // Submissions list UI state
  const [statusFilter, setStatusFilter] = useState<"all" | "ready" | "pending" | "approved" | "rejected">("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const { data: forms = [], isLoading } = useQuery<ApplicationForm[]>({
    queryKey: ["application-forms"],
    queryFn: () => api.get<ApplicationForm[]>("/application-forms"),
  });
  const { data: programs = [] } = useQuery<Program[]>({
    queryKey: ["programs"],
    queryFn: () => api.get<Program[]>("/programs"),
  });
  const { data: submissions = [], isLoading: subsLoading } = useQuery<Submission[]>({
    queryKey: ["submissions", viewFormId],
    queryFn: () => api.get<Submission[]>(`/application-forms/${viewFormId}/submissions`),
    enabled: viewFormId !== null,
  });

  const createMutation = useMutation({
    mutationFn: (data: { programId: number; title: string; description?: string; deadline?: string; customFields: CustomField[]; loadDefaults?: boolean }) =>
      api.post<ApplicationForm>("/application-forms", data),
    onSuccess: (form) => {
      qc.invalidateQueries({ queryKey: ["application-forms"] });
      setCreateOpen(false);
      setCreateFormData({ programId: "", title: "", description: "", deadline: "", loadDefaults: true });
      setCreateCustomFields([]);
      setCreatedForm(form);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      api.patch<ApplicationForm>(`/application-forms/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["application-forms"] }),
  });

  const updateFormMutation = useMutation({
    mutationFn: (data: { id: number; title?: string; description?: string; deadline?: string; customFields?: CustomField[]; sectionsConfig?: any[] }) => {
      const { id, ...body } = data;
      return api.patch<ApplicationForm>(`/application-forms/${id}`, body);
    },
    onSuccess: () => {
      toast({ title: "Form updated" });
      qc.invalidateQueries({ queryKey: ["application-forms"] });
      setEditForm(null);
      setEditCustomFields([]);
      setEditSectionsConfig([]);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteForm = useMutation({
    mutationFn: (id: number) => api.delete(`/application-forms/${id}`),
    onSuccess: () => {
      toast({ title: "Form deleted" });
      qc.invalidateQueries({ queryKey: ["application-forms"] });
      setDeleteConfirmId(null);
      if (viewFormId === deleteConfirmId) setViewFormId(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateSubmission = useMutation({
    mutationFn: ({ id, status, reviewNotes }: { id: number; status?: string; reviewNotes?: string }) =>
      api.patch<Submission>(`/application-forms/submissions/${id}`, { status, reviewNotes }),
    onSuccess: () => {
      toast({ title: "Submission updated" });
      qc.invalidateQueries({ queryKey: ["submissions", viewFormId] });
      qc.invalidateQueries({ queryKey: ["application-forms"] });
    },
  });

  const approveSubmission = useMutation({
    mutationFn: (id: number) => api.post<{ message: string; candidateId: number }>(`/application-forms/submissions/${id}/approve`, {}),
    onSuccess: (data) => {
      toast({ title: "Approved", description: `${data.message} (ID: ${data.candidateId})` });
      qc.invalidateQueries({ queryKey: ["submissions", viewFormId] });
      qc.invalidateQueries({ queryKey: ["application-forms"] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
      setViewSubId(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const syncGoogleSheets = useMutation({
    mutationFn: (formId: number) =>
      api.post<{ imported: number; total: number }>(
        `/application-forms/${formId}/sync-google-sheets`, {}
      ),
    onSuccess: (data, formId) => {
      toast({
        title: `Sync complete`,
        description: data.imported > 0 ? `${data.imported} new submissions imported.` : "No new responses.",
      });
      qc.invalidateQueries({ queryKey: ["submissions", formId] });
      qc.invalidateQueries({ queryKey: ["application-forms"] });
    },
    onError: (e: Error) => toast({ title: "Sync failed", description: e.message, variant: "destructive" }),
  });

  const bulkAction = useMutation({
    mutationFn: ({ formId, action, ids }: { formId: number; action: "approve" | "reject"; ids: number[] }) =>
      api.post<{ processed: number }>(`/application-forms/${formId}/submissions/bulk-action`, { action, ids }),
    onSuccess: (data, { formId, action }) => {
      toast({ title: `Bulk ${action} done`, description: `${data.processed} submissions processed.` });
      qc.invalidateQueries({ queryKey: ["submissions", formId] });
      qc.invalidateQueries({ queryKey: ["application-forms"] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
      setSelectedIds([]);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteSubMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/application-submissions/${id}`),
    onSuccess: () => {
      toast({ title: "Submission deleted" });
      qc.invalidateQueries({ queryKey: ["submissions", viewFormId] });
      qc.invalidateQueries({ queryKey: ["application-forms"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const bulkDeleteSubsMutation = useMutation({
    mutationFn: (ids: number[]) => api.post(`/application-submissions/bulk-delete`, { ids }),
    onSuccess: () => {
      toast({ title: "Submissions deleted" });
      qc.invalidateQueries({ queryKey: ["submissions", viewFormId] });
      qc.invalidateQueries({ queryKey: ["application-forms"] });
      setSelectedIds([]);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveGoogleSheetsConfig = async (formId: number) => {
    setSavingGsConfig(true);
    try {
      await api.put(`/application-forms/${formId}/google-sheets-config`, googleSheetsConfig);
      toast({ title: "Google Sheets integration saved" });
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to save", variant: "destructive" });
    } finally {
      setSavingGsConfig(false);
    }
  };

  const safeCopyToClipboard = async (text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.error("Clipboard API failed, falling back", err);
      }
    }

    // Fallback for non-secure contexts or older browsers
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error("Fallback copy failed", err);
      return false;
    }
  };

  const copyLink = async (form: ApplicationForm) => {
    const success = await safeCopyToClipboard(buildFormLink(form.token));
    if (success) {
      setCopiedId(form.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({ title: "Link copied to clipboard" });
    } else {
      toast({ title: "Failed to copy link", variant: "destructive" });
    }
  };

  const exportExcel = async (formId: number) => {
    setExporting(true);
    try {
      const token = localStorage.getItem("fellowship_token");
      const res = await fetch(`/api/application-forms/${formId}/export`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disp = res.headers.get("Content-Disposition") ?? "";
      const fname = disp.match(/filename="([^"]+)"/)?.[1] ?? `submissions-${formId}.xlsx`;
      a.href = url;
      a.download = fname;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Downloaded", description: "Submissions exported to Excel" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const viewedSub = submissions.find((s) => s.id === viewSubId);
  const viewedForm = forms.find((f) => f.id === viewFormId);

  const addCustomField = (fields: CustomField[], setFields: (f: CustomField[]) => void) => {
    setFields([...fields, { id: genId(), label: "", type: "text", required: false }]);
  };

  const updateCustomField = (fields: CustomField[], setFields: (f: CustomField[]) => void, id: string, updated: CustomField) => {
    setFields(fields.map((f) => f.id === id ? updated : f));
  };

  const deleteCustomField = (fields: CustomField[], setFields: (f: CustomField[]) => void, id: string) => {
    setFields(fields.filter((f) => f.id !== id));
  };

  // Submission detail view
  if (viewFormId !== null && viewSubId !== null && viewedSub) {
    const customFields = viewedForm?.customFields ?? [];
    return (
      <div className="p-6 space-y-5 print-area">
        <style>{`
          @media print { 
            aside, header, nav, .no-print { display: none !important; } 
            body, main, .print-area { background: white !important; color: black !important; margin: 0; padding: 0; width: 100%; box-shadow: none !important; border: none !important; }
            .print-area { padding: 1cm !important; }
            .card { box-shadow: none !important; border: 1px solid #e2e8f0 !important; break-inside: avoid; }
          }
        `}</style>
        <div className="flex items-center gap-3 no-print">
          <Button variant="ghost" size="sm" onClick={() => setViewSubId(null)} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Submissions
          </Button>
          <Badge className={STATUS_COLORS[viewedSub.status] ?? ""}>{viewedSub.status}</Badge>
          <div className="flex gap-2 ml-auto no-print">
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => window.print()} 
              className="gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 shadow-lg shadow-slate-200"
            >
              <Printer className="h-4 w-4" /> Print Only
            </Button>
          </div>
        </div>
        {/* Specialization(s) & Preferred Centers banner — prominently shown at the top */}
        {(() => {
          const specs = parseSpecializations(viewedSub.specialization);
          const centerPrefs = parseCenterPreferences(viewedSub.centerPreference, viewedSub.customAnswers, viewedForm?.sectionsConfig);
          if (specs.length === 0) return null;
          return (
            <div className={`rounded-lg border p-5 ${specs.length > 1 ? "border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800" : "border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800"}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black uppercase tracking-widest text-slate-500">Applied Specialization & Center Preference</span>
                  {specs.length > 1 && (
                    <Badge className="bg-orange-200 text-orange-900 border-none text-[10px] h-5">Multi-Specialization</Badge>
                  )}
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">{viewedSub.status.toUpperCase()}</Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {specs.map((sp) => (
                  <div key={sp} className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col gap-2">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-black uppercase tracking-tighter w-fit ${SPEC_BADGE_COLORS[sp] ?? "bg-gray-100 text-gray-700"}`}>
                      {sp}
                    </span>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Preferred Location</span>
                        <span className="text-sm font-bold text-slate-800">{centerPrefs[sp] || "No preference set"}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Personal Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                ["Full Name", viewedSub.fullName], ["Email", viewedSub.email],
                ["Phone", viewedSub.phone], ["Date of Birth", viewedSub.dateOfBirth],
                ["Marital Status", viewedSub.maritalStatus],
                ["Permanent Address", viewedSub.permanentAddress],
                ["Mailing Address", viewedSub.mailingAddress],
                ["Referred By", viewedSub.referredByName],
                ["Referral Source", viewedSub.referralSource],
                ["Spouse Details", viewedSub.spouseDetails],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b pb-1.5 last:border-0">
                  <span className="font-medium text-muted-foreground shrink-0 mr-3">{k}</span>
                  <span className="text-right max-w-56 break-words">{v}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Education &amp; Experience</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                ["MBBS / Degree", viewedSub.degree], ["Medical College", viewedSub.medicalCollege],
                ["University", viewedSub.university],
                ["PG Qualifications", viewedSub.pgQualifications],
                ["DO", viewedSub.doQualification ? `Yes${viewedSub.doDetails ? " — " + viewedSub.doDetails : ""}` : null],
                ["MS / MD", viewedSub.msMdQualification ? `Yes${viewedSub.msMdDetails ? " — " + viewedSub.msMdDetails : ""}` : null],
                ["DNB", viewedSub.dnbQualification ? `Yes${viewedSub.dnbDetails ? " — " + viewedSub.dnbDetails : ""}` : null],
                ["Other Training", viewedSub.otherTraining],
                ["MC Reg. Number", viewedSub.medicalCouncilNumber],
                ["Total Surgeries", viewedSub.totalSurgeries],
                ["Publications", viewedSub.publications],
                ["Presentations", viewedSub.presentations],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b pb-1.5 last:border-0">
                  <span className="font-medium text-muted-foreground shrink-0 mr-3">{k}</span>
                  <span className="text-right max-w-56 break-words">{v}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Documents &amp; References</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "LOR 1", url: viewedSub.lor1Url, refName: viewedSub.lor1RefName, refContact: viewedSub.lor1RefContact, refEmail: viewedSub.lor1RefEmail },
                { label: "LOR 2", url: viewedSub.lor2Url, refName: viewedSub.lor2RefName, refContact: viewedSub.lor2RefContact, refEmail: viewedSub.lor2RefEmail },
              ].map(({ label, url, refName, refContact, refEmail }) => (
                <div key={label} className="space-y-1 border-b pb-2 last:border-0">
                  <div className="flex items-center justify-between text-sm gap-2">
                    <span className="font-medium text-muted-foreground">{label}</span>
                    <DocValue label={label} url={url} />
                  </div>
                  {(refName || refContact || refEmail) && (
                    <div className="pl-2 space-y-0.5 text-xs text-muted-foreground">
                      {refName && <div>Referee: <span className="text-foreground">{refName}</span></div>}
                      {refContact && <div>Contact: <span className="text-foreground">{refContact}</span></div>}
                      {refEmail && <div>Email: <span className="text-foreground">{refEmail}</span></div>}
                    </div>
                  )}
                </div>
              ))}
              {[
                { label: "Payment Reference", url: viewedSub.paymentUrl },
                { label: "Passport Photo", url: viewedSub.photoUrl },
              ].map(({ label, url }) => (
                <div key={label} className="flex items-center justify-between text-sm gap-2 border-b pb-2 last:border-0">
                  <span className="text-muted-foreground flex-shrink-0">{label}</span>
                  <DocValue label={label} url={url} />
                </div>
              ))}
            </CardContent>
          </Card>
          {(viewedSub.healthDeclaration || viewedSub.otherInformation) && (
            <Card className="md:col-span-2">
              <CardHeader><CardTitle className="text-base">Health &amp; Additional Information</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {viewedSub.healthDeclaration && (
                  <div className="border-b pb-2">
                    <span className="font-medium text-muted-foreground block mb-1">Health Declaration</span>
                    <p className="whitespace-pre-wrap">{viewedSub.healthDeclaration}</p>
                  </div>
                )}
                {viewedSub.otherInformation && (
                  <div>
                    <span className="font-medium text-muted-foreground block mb-1">Other Information</span>
                    <p className="whitespace-pre-wrap">{viewedSub.otherInformation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Clinical Skills & Experience */}
          {(viewedSub.diagnosticSkills || viewedSub.surgicalExperience) && (
            <Card className="md:col-span-2">
              <CardHeader><CardTitle className="text-base">Clinical Skills & Surgical Experience</CardTitle></CardHeader>
              <CardContent className="space-y-6 text-sm">
                {viewedSub.diagnosticSkills && (() => {
                  try {
                    const skills = JSON.parse(viewedSub.diagnosticSkills);
                    return (
                      <div>
                        <span className="font-medium text-muted-foreground block mb-2">Diagnostic Skills</span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {Object.entries(skills).map(([skill, val]) => (
                            <div key={skill} className="flex flex-col border rounded p-2 bg-muted/10">
                              <span className="text-xs text-muted-foreground">{skill}</span>
                              <span className="font-medium">{val as string}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  } catch { return null; }
                })()}
                {viewedSub.surgicalExperience && (() => {
                  try {
                    const exp = JSON.parse(viewedSub.surgicalExperience);
                    return (
                      <div>
                        <span className="font-medium text-muted-foreground block mb-2">Surgical Experience (No. of Procedures)</span>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-muted/50">
                                <th className="text-left p-2 border">Procedure</th>
                                <th className="text-center p-2 border">Under Supervision</th>
                                <th className="text-center p-2 border">Independently</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(exp).map(([proc, vals]: [string, any]) => (
                                <tr key={proc}>
                                  <td className="p-2 border font-medium">{proc}</td>
                                  <td className="p-2 border text-center">{vals.supervision ?? 0}</td>
                                  <td className="p-2 border text-center">{vals.independent ?? 0}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  } catch { return null; }
                })()}
              </CardContent>
            </Card>
          )}

          <Card className="no-print">
            <CardHeader><CardTitle className="text-base">Review Actions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm">Status</Label>
                <Select value={viewedSub.status}
                  onValueChange={(v) => updateSubmission.mutate({ id: viewedSub.id, status: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <Button className="w-full gap-2"
                onClick={() => approveSubmission.mutate(viewedSub.id)}
                disabled={approveSubmission.isPending || viewedSub.status === "approved"}>
                {approveSubmission.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4" />}
                {viewedSub.status === "approved" ? "Already Approved" : "Approve & Create Candidate"}
              </Button>
              <Button variant="destructive" className="w-full gap-2"
                onClick={() => updateSubmission.mutate({ id: viewedSub.id, status: "rejected" })}
                disabled={updateSubmission.isPending}>
                <FileX className="h-4 w-4" /> Reject Application
              </Button>
              <p className="text-xs text-muted-foreground">Declaration: {viewedSub.declarationAccepted ? "Accepted" : "Not accepted"}</p>
              <p className="text-xs text-muted-foreground">Submitted: {new Date(viewedSub.submittedAt).toLocaleString("en-IN")}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Submissions list view
  if (viewFormId !== null) {
    const filteredSubs = submissions.filter((s) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "ready") return s.readyForReview;
      return s.status === statusFilter;
    });

    const readyCount = submissions.filter((s) => s.readyForReview).length;

    const allFilteredSelected = filteredSubs.length > 0 && filteredSubs.every((s) => selectedIds.includes(s.id));
    const toggleSelectAll = () => {
      if (allFilteredSelected) setSelectedIds([]);
      else setSelectedIds(filteredSubs.map((s) => s.id));
    };
    const toggleSelect = (id: number) =>
      setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

    return (
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setViewFormId(null); setViewSubId(null); setStatusFilter("all"); setSelectedIds([]); }} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <div>
              <h1 className="text-xl font-bold">{viewedForm?.title}</h1>
              <p className="text-sm text-muted-foreground">{submissions.length} submissions · {readyCount} ready for review</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="gap-1.5"
              onClick={() => syncGoogleSheets.mutate(viewFormId)}
              disabled={syncGoogleSheets.isPending}>
              {syncGoogleSheets.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Sync Google Sheets
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportExcel(viewFormId)} disabled={exporting || submissions.length === 0}>
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Export to Excel
            </Button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 flex-wrap">
          {(["all", "ready", "pending", "approved", "rejected"] as const).map((f) => (
            <Button key={f} size="sm" variant={statusFilter === f ? "default" : "outline"}
              className="h-7 text-xs px-3"
              onClick={() => { setStatusFilter(f); setSelectedIds([]); }}>
              {f === "all" ? `All (${submissions.length})` : f === "ready" ? `Ready for Review (${readyCount})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${submissions.filter((s) => s.status === f).length})`}
            </Button>
          ))}
        </div>

        {/* Bulk action toolbar */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-2">
            <span className="text-sm font-medium">{selectedIds.length} selected</span>
            <Button size="sm" className="gap-1.5 h-7 text-xs"
              onClick={() => bulkAction.mutate({ formId: viewFormId, action: "approve", ids: selectedIds })}
              disabled={bulkAction.isPending}>
              {bulkAction.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
              Approve All
            </Button>
            <Button size="sm" variant="destructive" className="gap-1.5 h-7 text-xs"
              onClick={() => bulkAction.mutate({ formId: viewFormId, action: "reject", ids: selectedIds })}
              disabled={bulkAction.isPending}>
              <Ban className="h-3 w-3" /> Reject All
            </Button>
            <Button size="sm" variant="destructive" className="gap-1.5 h-7 text-xs bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (confirm(`Are you sure you want to delete ${selectedIds.length} submissions? This cannot be undone.`)) {
                  bulkDeleteSubsMutation.mutate(selectedIds);
                }
              }}
              disabled={bulkDeleteSubsMutation.isPending}>
              {bulkDeleteSubsMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Delete Selected
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto" onClick={() => setSelectedIds([])}>
              Clear
            </Button>
          </div>
        )}

        {subsLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading submissions…</div>
        ) : filteredSubs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {submissions.length === 0 ? "No submissions yet. Share the form link with candidates." : "No submissions match this filter."}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="px-4 py-3">
                        <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} className="h-3.5 w-3.5 cursor-pointer" />
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Specialization</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Source</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Submitted</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubs.map((s) => (
                      <tr key={s.id} className={`border-b last:border-0 hover:bg-muted/20 ${selectedIds.includes(s.id) ? "bg-blue-50" : ""}`}>
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleSelect(s.id)} className="h-3.5 w-3.5 cursor-pointer" />
                        </td>
                        <td className="px-4 py-3 font-medium">
                          <div className="flex items-center gap-1.5">
                            {s.fullName}
                            {s.readyForReview && <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-500" title="Ready for review" />}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{s.email}</td>
                        <td className="px-4 py-3">
                          {(() => {
                            const specs = parseSpecializations(s.specialization);
                            if (specs.length === 0) return <span className="text-muted-foreground">—</span>;
                            return (
                              <div className="flex flex-wrap gap-1">
                                {specs.map((sp) => (
                                  <span key={sp} className={`inline-block text-xs px-1.5 py-0.5 rounded font-medium ${SPEC_BADGE_COLORS[sp] ?? "bg-gray-100 text-gray-700"}`}>{sp}</span>
                                ))}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={STATUS_COLORS[s.status] ?? ""} variant="secondary">{s.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {s.source === "google_sheets" ? "Google Sheets" : s.source === "google_forms" ? "Google Forms" : "Internal"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {new Date(s.submittedAt).toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-right flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="gap-1 h-7" onClick={() => setViewSubId(s.id)}>
                            <Eye className="h-3.5 w-3.5" /> Review
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this submission?")) {
                                deleteSubMutation.mutate(s.id);
                              }
                            }}
                            disabled={deleteSubMutation.isPending}>
                            <Trash2 className="h-3.5 w-3.5" />
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
      </div>
    );
  }

  // Forms list view
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Application Forms</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Generate shareable links for candidate applications</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New Form
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading forms…</div>
      ) : forms.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Link2 className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="font-semibold text-lg">No forms yet</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-4">Create an application form and share the link with candidates</p>
            <Button onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Create First Form</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {forms.map((form) => (
            <Card key={form.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base">{form.title}</h3>
                      <Badge variant={form.isActive ? "default" : "secondary"} className="text-xs">
                        {form.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {form.pendingCount > 0 && (
                        <Badge className="bg-yellow-100 text-yellow-800 text-xs">{form.pendingCount} pending</Badge>
                      )}
                      {(form.customFields?.length ?? 0) > 0 && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Settings2 className="h-2.5 w-2.5" />
                          {form.customFields!.length} custom field{form.customFields!.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                    {form.description && (
                      <p className="text-sm text-muted-foreground mt-1">{form.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {form.submissionCount} submissions</span>
                      {form.deadline && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Deadline: {new Date(form.deadline).toLocaleDateString("en-IN")}
                        </span>
                      )}
                      <span>Program: {form.programName ?? `#${form.programId}`}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <code className="text-xs bg-muted rounded px-2 py-1 flex-1 truncate max-w-sm">
                        {buildFormLink(form.token)}
                      </code>
                      <Button variant="outline" size="sm" className="gap-1 h-7 shrink-0" onClick={() => copyLink(form)}>
                        {copiedId === form.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        {copiedId === form.id ? "Copied!" : "Copy"}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Active</Label>
                      <Switch checked={form.isActive}
                        onCheckedChange={(v) => toggleActive.mutate({ id: form.id, isActive: v })} />
                    </div>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => {
                      setEditForm(form);
                      setEditCustomFields(form.customFields ?? []);
                      setEditSectionsConfig(form.sectionsConfig ?? []);
                    }}>
                      <Settings2 className="h-3.5 w-3.5" /> Configure
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => setViewFormId(form.id)}>
                      <Eye className="h-4 w-4" /> Submissions <ChevronRight className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1 text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirmId(form.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) { setCreateCustomFields([]); setCreateFormData({ programId: "", title: "", description: "", deadline: "" }); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Application Form</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Program</Label>
                <Select value={createFormData.programId} onValueChange={(v) => setCreateFormData((f) => ({ ...f, programId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger>
                  <SelectContent>
                    {programs.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Application Deadline (optional)</Label>
                <Input type="datetime-local" value={createFormData.deadline}
                  onChange={(e) => setCreateFormData((f) => ({ ...f, deadline: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Form Title</Label>
              <Input placeholder="e.g., Fellowship Application Jan 2026"
                value={createFormData.title} onChange={(e) => setCreateFormData((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea placeholder="Instructions or notes for candidates…"
                value={createFormData.description} onChange={(e) => setCreateFormData((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>

            <Separator />
            
            <div className="space-y-2 bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900/50 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-blue-800 dark:text-blue-300">Standard Fellowship Template</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-blue-600 font-bold uppercase">Include?</span>
                  <Switch 
                    checked={createFormData.loadDefaults} 
                    onCheckedChange={(v) => setCreateFormData(f => ({ ...f, loadDefaults: v }))} 
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">This template includes core sections like Specialization, Units, Medical History, etc. You can fully edit them later.</p>
              {createFormData.loadDefaults && (
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground list-disc pl-4">
                  <li>Personal Details & Contact</li>
                  <li>Specialization & Unit Preferences</li>
                  <li>Medical & Surgical History</li>
                  <li>Educational Qualifications</li>
                  <li>Document Uploads</li>
                </ul>
              )}
            </div>

            <Separator />

            {/* Custom Fields Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold flex items-center gap-2"><Settings2 className="h-4 w-4" /> Custom Fields</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Add extra questions that appear in the "References" step of the form</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 shrink-0"
                  onClick={() => addCustomField(createCustomFields, setCreateCustomFields)}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Field
                </Button>
              </div>

              {createCustomFields.length === 0 ? (
                <div className="border border-dashed rounded-lg p-4 text-center text-xs text-muted-foreground">
                  No custom fields added yet. Click "Add Field" to add dropdown, text, or other input types.
                </div>
              ) : (
                <div className="space-y-2">
                  {createCustomFields.map((cf) => (
                    <CustomFieldEditor
                      key={cf.id}
                      field={cf}
                      onChange={(updated) => updateCustomField(createCustomFields, setCreateCustomFields, cf.id, updated)}
                      onDelete={() => deleteCustomField(createCustomFields, setCreateCustomFields, cf.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button disabled={!createFormData.programId || !createFormData.title || createMutation.isPending}
              onClick={() => createMutation.mutate({
                programId: Number(createFormData.programId), title: createFormData.title,
                description: createFormData.description || undefined, deadline: createFormData.deadline || undefined,
                customFields: createCustomFields,
                loadDefaults: createFormData.loadDefaults,
              })}>
              {createMutation.isPending ? "Creating…" : "Create & Get Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit / Configure Dialog */}
      <Dialog open={editForm !== null} onOpenChange={(o) => { if (!o) { setEditForm(null); setEditCustomFields([]); setGoogleFormsConfig({ googleFormId: "", serviceAccountJson: "" }); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Configure Form — {editForm?.title}</DialogTitle></DialogHeader>
          {editForm && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Form Title</Label>
                <Input value={editForm.title} onChange={(e) => setEditForm((f) => f ? { ...f, title: e.target.value } : f)} />
              </div>
              <div className="space-y-1.5">
                <Label>Description (optional)</Label>
                <Textarea rows={2} value={editForm.description ?? ""} onChange={(e) => setEditForm((f) => f ? { ...f, description: e.target.value } : f)} />
              </div>
              <div className="space-y-1.5">
                <Label>Application Deadline (optional)</Label>
                <Input
                  type="datetime-local"
                  value={editForm.deadline ? new Date(editForm.deadline).toISOString().slice(0, 16) : ""}
                  onChange={(e) => setEditForm((f) => f ? { ...f, deadline: e.target.value || null } : f)}
                />
              </div>

              <Separator />

              {/* Google Sheets Integration */}
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Google Sheets Integration</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Auto-import responses from a Google Sheet into this application form</p>
                </div>
                <div className="space-y-2 rounded-lg border p-3 bg-muted/20">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Spreadsheet ID</Label>
                    <Input
                      placeholder="e.g., 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                      value={googleSheetsConfig.spreadsheetId}
                      onChange={(e) => setGoogleSheetsConfig((c) => ({ ...c, spreadsheetId: e.target.value }))}
                      className="text-xs font-mono"
                    />
                    <p className="text-xs text-muted-foreground">Find this in the Google Sheet URL after /d/</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Sheet Name</Label>
                    <Input
                      placeholder="e.g., Form Responses 1"
                      value={googleSheetsConfig.sheetName}
                      onChange={(e) => setGoogleSheetsConfig((c) => ({ ...c, sheetName: e.target.value }))}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Service Account JSON {editFormGsData?.hasServiceAccount && <span className="text-muted-foreground font-normal">(leave blank to keep existing)</span>}</Label>
                    <Textarea
                      placeholder={editFormGsData?.hasServiceAccount ? '(saved) — paste new JSON to replace' : '{"type":"service_account","project_id":"..."}'}
                      rows={4}
                      value={googleSheetsConfig.serviceAccountJson}
                      onChange={(e) => setGoogleSheetsConfig((c) => ({ ...c, serviceAccountJson: e.target.value }))}
                      className="text-xs font-mono"
                    />
                  </div>
                  <Button size="sm" className="gap-1.5" onClick={() => saveGoogleSheetsConfig(editForm.id)} disabled={savingGsConfig || !googleSheetsConfig.spreadsheetId}>
                    {savingGsConfig ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Save Integration
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-2"><FileCheck className="h-4 w-4" /> Form Sections (Standard)</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Enable/disable or rename built-in form sections and fields</p>
                  </div>
                  {editSectionsConfig.length === 0 && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="gap-1.5 h-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                      onClick={async () => {
                        try {
                          const res = await api.get("/application-forms/default-sections");
                          setEditSectionsConfig(res.data);
                          toast({ title: "Template loaded" });
                        } catch (e) {
                          toast({ title: "Failed to load template", variant: "destructive" });
                        }
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" /> Load Standard Template
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  {editSectionsConfig.map((section, sIdx) => (
                    <div key={section.id} className="border rounded-xl p-4 bg-muted/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 mr-4">
                          <Input
                            value={section.title}
                            onChange={(e) => {
                              const newCfg = [...editSectionsConfig];
                              newCfg[sIdx].title = e.target.value;
                              setEditSectionsConfig(newCfg);
                            }}
                            className="h-8 font-bold text-sm bg-transparent border-none focus-visible:ring-0 px-0"
                          />
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Section ID: {section.id}</p>
                        </div>
                        <Switch
                          checked={section.enabled}
                          onCheckedChange={(v) => {
                            const newCfg = [...editSectionsConfig];
                            newCfg[sIdx].enabled = v;
                            setEditSectionsConfig(newCfg);
                          }}
                        />
                      </div>

                      {section.enabled && (
                        <div className="space-y-3 mt-2">
                          <RichTextArea
                            label="Section Description"
                            placeholder="Add instructions or details for this section..."
                            value={section.description || ""}
                            onChange={(v) => {
                              const newCfg = [...editSectionsConfig];
                              newCfg[sIdx].description = v;
                              setEditSectionsConfig(newCfg);
                            }}
                          />
                        </div>
                      )}

                      {section.enabled && section.fields && (
                        <div className="pl-4 border-l-2 border-muted space-y-3 mt-2">
                          {section.fields.map((field: any, fIdx: number) => (
                            <div key={field.id} className="flex items-start gap-3 bg-white dark:bg-slate-900 p-2 rounded-lg border shadow-sm group relative">
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Field Label</Label>
                                    <Select 
                                      value={field.type} 
                                      onValueChange={(v) => {
                                        const newCfg = [...editSectionsConfig];
                                        newCfg[sIdx].fields[fIdx].type = v;
                                        if (["select", "radio", "checkbox_group"].includes(v) && !newCfg[sIdx].fields[fIdx].options) {
                                          newCfg[sIdx].fields[fIdx].options = ["Option 1"];
                                        }
                                        setEditSectionsConfig(newCfg);
                                      }}
                                    >
                                      <SelectTrigger className="h-6 text-[10px] py-0 w-36"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="text">Short Text</SelectItem>
                                        <SelectItem value="textarea">Paragraph</SelectItem>
                                        <SelectItem value="phone">Mobile Number</SelectItem>
                                        <SelectItem value="email">Email Address</SelectItem>
                                        <SelectItem value="date">Date Picker</SelectItem>
                                        <SelectItem value="select">Dropdown / Select</SelectItem>
                                        <SelectItem value="radio">Radio Button</SelectItem>
                                        <SelectItem value="checkbox_group">Checkbox Group</SelectItem>
                                        <SelectItem value="checkbox">Single Checkbox (Yes/No)</SelectItem>
                                        <SelectItem value="file">File Upload</SelectItem>
                                        <SelectItem value="info">Information block</SelectItem>
                                        <SelectItem value="number">Number</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-600 transition-opacity"
                                    onClick={() => {
                                      const newCfg = [...editSectionsConfig];
                                      newCfg[sIdx].fields.splice(fIdx, 1);
                                      setEditSectionsConfig(newCfg);
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                                <Input
                                  value={field.label}
                                  onChange={(e) => {
                                    const newCfg = [...editSectionsConfig];
                                    newCfg[sIdx].fields[fIdx].label = e.target.value;
                                    setEditSectionsConfig(newCfg);
                                  }}
                                  className="h-7 text-xs"
                                />
                                {field.type === 'info' && (
                                  <div className="mt-2">
                                    <RichTextArea
                                      label="Instruction Content"
                                      value={field.defaultValue || ""}
                                      onChange={(v) => {
                                        const newCfg = [...editSectionsConfig];
                                        newCfg[sIdx].fields[fIdx].defaultValue = v;
                                        setEditSectionsConfig(newCfg);
                                      }}
                                    />
                                  </div>
                                )}
                                {field.options && ["select", "radio", "checkbox_group"].includes(field.type) && (
                                  <div className="mt-2 space-y-1.5 p-2 bg-muted/20 border rounded text-xs">
                                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Options</Label>
                                    {(field.options || []).map((opt: string, oIdx: number) => (
                                      <div key={oIdx} className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded-full border border-muted-foreground/30 flex items-center justify-center shrink-0">
                                          {field.type === 'checkbox_group' ? <Check className="h-2.5 w-2.5 text-muted-foreground/30" /> : <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />}
                                        </div>
                                        <Input
                                          value={opt}
                                          onChange={(e) => {
                                            const newCfg = [...editSectionsConfig];
                                            newCfg[sIdx].fields[fIdx].options[oIdx] = e.target.value;
                                            setEditSectionsConfig(newCfg);
                                          }}
                                          className="h-7 text-xs flex-1"
                                          placeholder={`Option ${oIdx + 1}`}
                                        />
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600 shrink-0"
                                          onClick={() => {
                                            const newCfg = [...editSectionsConfig];
                                            newCfg[sIdx].fields[fIdx].options.splice(oIdx, 1);
                                            setEditSectionsConfig(newCfg);
                                          }}
                                        >
                                          <XIcon className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ))}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-[10px] gap-1 px-2 mt-1 hover:bg-muted"
                                      onClick={() => {
                                        const newCfg = [...editSectionsConfig];
                                        if (!newCfg[sIdx].fields[fIdx].options) newCfg[sIdx].fields[fIdx].options = [];
                                        newCfg[sIdx].fields[fIdx].options.push(`Option ${(newCfg[sIdx].fields[fIdx].options.length || 0) + 1}`);
                                        setEditSectionsConfig(newCfg);
                                      }}
                                    >
                                      <Plus className="h-3 w-3" /> Add Option
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full h-8 border-dashed border-2 text-[10px] uppercase tracking-wider font-bold gap-2"
                            onClick={() => {
                              const newCfg = [...editSectionsConfig];
                              newCfg[sIdx].fields.push({
                                id: `field_${Date.now()}`,
                                type: "text",
                                label: "New Field",
                                required: false
                              });
                              setEditSectionsConfig(newCfg);
                            }}
                          >
                            <Plus className="h-3 w-3" /> Add Field to Section
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Custom Fields Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-2"><Settings2 className="h-4 w-4" /> Custom Fields</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Add dropdown, text, checkbox, or multiple-choice questions for candidates</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={() => addCustomField(editCustomFields, setEditCustomFields)}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Field
                  </Button>
                </div>

                {editCustomFields.length === 0 ? (
                  <div className="border border-dashed rounded-lg p-4 text-center text-xs text-muted-foreground">
                    No custom fields. Click "Add Field" to add dropdown, text, or multiple-choice inputs.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {editCustomFields.map((cf) => (
                      <CustomFieldEditor
                        key={cf.id}
                        field={cf}
                        onChange={(updated) => updateCustomField(editCustomFields, setEditCustomFields, cf.id, updated)}
                        onDelete={() => deleteCustomField(editCustomFields, setEditCustomFields, cf.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditForm(null); setEditCustomFields([]); setGoogleSheetsConfig({ spreadsheetId: "", sheetName: "Form Responses 1", serviceAccountJson: "" }); }}>Cancel</Button>
            <Button
              disabled={updateFormMutation.isPending || !editForm?.title}
              onClick={() => editForm && updateFormMutation.mutate({
                id: editForm.id,
                title: editForm.title,
                description: editForm.description ?? undefined,
                deadline: editForm.deadline ?? undefined,
                customFields: editCustomFields,
                sectionsConfig: editSectionsConfig,
              })}
            >
              {updateFormMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form Created Success Dialog */}
      <Dialog open={createdForm !== null} onOpenChange={(o) => { if (!o) { setCreatedForm(null); setCreatedFormGsOpen(false); setCreatedFormGsConfig({ spreadsheetId: "", sheetName: "Form Responses 1", serviceAccountJson: "" }); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Check className="h-5 w-5" /> Form Created Successfully
            </DialogTitle>
          </DialogHeader>
          {createdForm && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Your application form <strong className="text-foreground">"{createdForm.title}"</strong> is ready. Share the link below with candidates.
              </p>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Application Form Link</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted rounded-md px-3 py-2 break-all">
                    {buildFormLink(createdForm.token)}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1"
                    onClick={async () => {
                      const success = await safeCopyToClipboard(buildFormLink(createdForm.token));
                      if (success) toast({ title: "Link copied to clipboard" });
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </Button>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="gap-1" onClick={() => window.open(buildFormLink(createdForm.token), "_blank")}>
                  <ExternalLink className="h-3.5 w-3.5" /> Preview Form
                </Button>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => { setViewFormId(createdForm.id); setCreatedForm(null); }}>
                  <Eye className="h-3.5 w-3.5" /> View Submissions
                </Button>
              </div>

              {/* Google Sheets Integration Section */}
              <div className="border rounded-lg overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium bg-muted/50 hover:bg-muted transition-colors"
                  onClick={() => setCreatedFormGsOpen((v) => !v)}
                >
                  <span className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                    Connect Google Sheets (optional)
                  </span>
                  {createdFormGsOpen
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {createdFormGsOpen && (
                  <div className="p-4 space-y-3 border-t">
                    <p className="text-xs text-muted-foreground">Link a Google Sheet to automatically sync responses as submissions.</p>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Spreadsheet ID</Label>
                      <Input
                        placeholder="e.g. 1BxiMVs0XRA5..."
                        className="h-8 text-xs font-mono"
                        value={createdFormGsConfig.spreadsheetId}
                        onChange={(e) => setCreatedFormGsConfig((c) => ({ ...c, spreadsheetId: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Sheet Name</Label>
                      <Input
                        placeholder="Form Responses 1"
                        className="h-8 text-xs"
                        value={createdFormGsConfig.sheetName}
                        onChange={(e) => setCreatedFormGsConfig((c) => ({ ...c, sheetName: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Service Account JSON</Label>
                      <Textarea
                        placeholder='{"type":"service_account",...}'
                        className="text-xs font-mono h-24 resize-none"
                        value={createdFormGsConfig.serviceAccountJson}
                        onChange={(e) => setCreatedFormGsConfig((c) => ({ ...c, serviceAccountJson: e.target.value }))}
                      />
                    </div>
                    <Button
                      size="sm"
                      className="gap-1.5 w-full"
                      disabled={savingCreatedGs || !createdFormGsConfig.spreadsheetId}
                      onClick={async () => {
                        setSavingCreatedGs(true);
                        try {
                          await api.put(`/application-forms/${createdForm.id}/google-sheets-config`, createdFormGsConfig);
                          toast({ title: "Google Sheets integration saved" });
                          setCreatedFormGsOpen(false);
                        } catch (e) {
                          toast({ title: "Failed to save", description: (e as Error).message, variant: "destructive" });
                        } finally { setSavingCreatedGs(false); }
                      }}
                    >
                      {savingCreatedGs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      Save Integration
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => { setCreatedForm(null); setCreatedFormGsOpen(false); }}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(o) => { if (!o) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Form?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the form and all its submissions. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteForm.isPending}
              onClick={() => deleteConfirmId !== null && deleteForm.mutate(deleteConfirmId)}>
              {deleteForm.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


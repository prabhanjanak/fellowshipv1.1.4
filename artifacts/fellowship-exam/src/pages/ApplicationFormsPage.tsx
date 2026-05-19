import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "../components/ui/card";
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
  FileCheck, FileX, Loader2, Trash2, Download, CreditCard, GripVertical, Settings2, X,
  RefreshCw, CheckCheck, Ban, FileText, ImageIcon, ChevronDown, ChevronUp, Building2, Printer,
  Edit3 as Edit, Save, AlertCircle, FileJson, CheckCircle2, LayoutDashboard, CalendarDays,
  FileSignature, ExternalLink as ExtLink, FileType, CheckCircle, UserPlus, MonitorCheck, LayoutGrid, Wallet
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "../hooks/use-toast";
import QRCode from "react-qr-code";

interface CustomField {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "radio" | "checkbox" | "checkbox_group" | "date" | "time" | "file" | "number" | "email" | "phone" | "heading" | "static_text";
  options?: string[];
  required: boolean;
  placeholder?: string;
  description?: string;
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
  diagnosticSkills: string | null;
  surgicalExperience: string | null;
  publications: string | null; presentations: string | null;
  lor1Url: string | null; lor1RefName: string | null; lor1RefContact: string | null; lor1RefEmail: string | null;
  lor2Url: string | null; lor2RefName: string | null; lor2RefContact: string | null; lor2RefEmail: string | null;
  paymentUrl: string | null; photoUrl: string | null;
  otherInformation: string | null;
  declarationAccepted: boolean | null; submittedAt: string;
  reviewNotes: string | null; customAnswers?: Record<string, string>;
  readyForReview?: boolean; source?: string;
  formData?: any;
}
interface Program { id: number; name: string; }

/** Parse specialization field — may be a JSON array, PostgreSQL array or plain comma-separated string */
function parseSpecializations(spec: string | null | undefined): string[] {
  if (!spec) return [];
  let s = spec.trim();
  
  // Handle PostgreSQL curly-brace array format: {"Cornea", "Phaco Refractive"}
  if (s.startsWith("{") && s.endsWith("}")) {
    s = s.substring(1, s.length - 1);
    const list: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < s.length; i++) {
      const char = s[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        list.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    if (current.trim() || list.length > 0) {
      list.push(current.trim());
    }
    return list.map(item => {
      let cleaned = item;
      if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        cleaned = cleaned.substring(1, cleaned.length - 1);
      }
      return cleaned.trim();
    }).filter(Boolean);
  }

  try {
    const parsed: unknown = JSON.parse(s);
    if (Array.isArray(parsed)) return (parsed as unknown[]).map(String).filter(Boolean);
  } catch { /* not JSON */ }
  return s.split(",").map((x) => x.trim()).filter(Boolean);
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

function SubmissionFormDataEditor({ sectionsConfig, formData, onChange }: { sectionsConfig: any[], formData: any, onChange: (newData: any) => void }) {
  const updateField = (id: string, mapping: string | undefined, value: any, isStandard?: boolean) => {
    if (isStandard && mapping) {
      onChange({ ...formData, [mapping]: value });
    } else {
      const currentFormData = formData.formData || {};
      onChange({ ...formData, formData: { ...currentFormData, [id]: value } });
    }
  };

  const getFieldValue = (id: string, mapping: string | undefined, isStandard?: boolean) => {
    if (isStandard && mapping) {
      return formData[mapping];
    }
    return formData.formData?.[id];
  };

  return (
    <div className="space-y-12">
      {sectionsConfig.map((section: any) => (
        <motion.div 
          key={section.id} 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1 h-5 bg-orange-500 rounded-full"></span>
              {section.title}
            </h3>
            <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            {section.fields?.map((field: any) => {
              if (field.type === 'heading' || field.type === 'static_text' || field.type === 'info') return null;
              
              const val = getFieldValue(field.id, field.mapping, field.isStandard);

              // Conditional visibility logic
              if (field.visibleIf) {
                const targetVal = getFieldValue(field.visibleIf.field, undefined, false);
                const standardTargetVal = getFieldValue(undefined, field.visibleIf.field, true);
                const actualTargetVal = targetVal !== undefined ? targetVal : standardTargetVal;

                const conditionValue = field.visibleIf.contains || field.visibleIf.equals;
                
                if (field.visibleIf.key) {
                   if (actualTargetVal?.[field.visibleIf.key] !== conditionValue) return null;
                } else if (field.visibleIf.contains) {
                   if (!actualTargetVal || !actualTargetVal.includes(conditionValue)) return null;
                } else if (field.visibleIf.equals) {
                   if (actualTargetVal !== conditionValue) return null;
                }
              }

              const isFullWidth = ['skills_table', 'surgery_table', 'qualification_matrix', 'textarea', 'checkbox_group', 'file'].includes(field.type);
              
              return (
                <div key={field.id} className={`space-y-2.5 ${isFullWidth ? 'md:col-span-2' : ''}`}>
                  <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">{field.label}</Label>
                  
                  {field.type === 'text' || field.type === 'email' || field.type === 'number' || field.type === 'phone' ? (
                    <Input 
                      type={field.type === 'phone' ? 'text' : field.type}
                      value={val || ""} 
                      onChange={(e) => updateField(field.id, field.mapping, e.target.value, field.isStandard)}
                      className="bg-white/50 backdrop-blur-sm border-slate-200 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 h-10 transition-all rounded-xl"
                      placeholder={field.placeholder || field.label}
                    />
                  ) : field.type === 'textarea' ? (
                    <Textarea 
                      value={val || ""} 
                      onChange={(e) => updateField(field.id, field.mapping, e.target.value, field.isStandard)}
                      className="bg-white/50 backdrop-blur-sm border-slate-200 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 min-h-[120px] transition-all rounded-xl"
                      placeholder={field.label}
                    />
                  ) : field.type === 'select' ? (
                    <Select value={val || ""} onValueChange={(v) => updateField(field.id, field.mapping, v, field.isStandard)}>
                      <SelectTrigger className="bg-white/50 border-slate-200 h-11 rounded-xl transition-all">
                        <SelectValue placeholder="Select Option" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {field.options?.map((opt: string) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.type === 'radio' ? (
                    <RadioGroup value={val || ""} onValueChange={(v) => updateField(field.id, field.mapping, v, field.isStandard)} className="flex flex-wrap gap-4 pt-1">
                      {field.options?.map((opt: string) => (
                        <div key={opt} className={`flex items-center space-x-3 bg-slate-50 px-4 py-2.5 rounded-xl border transition-all cursor-pointer ${val === opt ? 'border-orange-200 bg-orange-50/50' : 'border-slate-100 hover:border-slate-200'}`}>
                          <RadioGroupItem value={opt} id={`${field.id}-${opt}`} />
                          <Label htmlFor={`${field.id}-${opt}`} className="text-sm font-bold text-slate-700 cursor-pointer">{opt}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  ) : field.type === 'date' ? (
                    <Input 
                      type="date" 
                      value={val || ""} 
                      onChange={(e) => updateField(field.id, field.mapping, e.target.value, field.isStandard)}
                      className="bg-white/50 border-slate-200 h-10 rounded-xl"
                    />
                  ) : field.type === 'checkbox' ? (
                    <div className={`flex items-center space-x-3 p-4 rounded-xl border transition-all ${!!val ? 'border-orange-200 bg-orange-50/50' : 'border-slate-100 bg-slate-50/50'}`}>
                      <Checkbox 
                        id={field.id} 
                        checked={!!val} 
                        onCheckedChange={(checked) => updateField(field.id, field.mapping, !!checked, field.isStandard)} 
                      />
                      <Label htmlFor={field.id} className="text-sm font-bold text-slate-700 leading-none cursor-pointer">{field.label}</Label>
                    </div>
                  ) : field.type === 'checkbox_group' ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                      {field.options?.map((opt: string) => (
                        <div key={opt} className={`flex items-center space-x-3 p-4 rounded-xl border transition-all ${val?.includes(opt) ? 'border-orange-200 bg-orange-50/50' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                          <Checkbox 
                            id={`${field.id}-${opt}`} 
                            checked={val?.includes(opt)} 
                            onCheckedChange={(checked) => {
                              let current = Array.isArray(val) ? [...val] : [];
                              if (checked) {
                                if (opt === "None of the Above") current = [opt];
                                else {
                                  current = current.filter(i => i !== "None of the Above");
                                  current.push(opt);
                                }
                              } else {
                                current = current.filter(i => i !== opt);
                              }
                              updateField(field.id, field.mapping, current, field.isStandard);
                            }} 
                          />
                          <Label htmlFor={`${field.id}-${opt}`} className="text-sm font-bold text-slate-700 cursor-pointer">{opt}</Label>
                        </div>
                      ))}
                    </div>
                  ) : field.type === 'skills_table' ? (
                    <div className="overflow-hidden border border-slate-100 rounded-2xl shadow-sm bg-white">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50/50 border-b border-slate-100">
                          <tr>
                            <th className="px-6 py-4 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]">Skill</th>
                            {field.options?.map((opt: string) => (
                              <th key={opt} className="px-6 py-4 text-center font-black text-slate-500 uppercase tracking-widest text-[10px]">{opt}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {field.rows?.map((row: string) => (
                            <tr key={row} className="hover:bg-slate-50/30 transition-colors">
                              <td className="px-6 py-4 font-bold text-slate-800">{row}</td>
                              {field.options?.map((opt: string) => {
                                const isChecked = (typeof val === 'string' ? JSON.parse(val || "{}") : (val || {}))[row] === opt;
                                return (
                                  <td key={opt} className="px-6 py-4 text-center">
                                    <input
                                      type="radio"
                                      name={`${field.id}_${row}`}
                                      checked={isChecked}
                                      onChange={() => {
                                        const current = typeof val === 'string' ? JSON.parse(val || "{}") : (val || {});
                                        updateField(field.id, field.mapping, { ...current, [row]: opt }, field.isStandard);
                                      }}
                                      className="w-4 h-4 text-orange-600 border-slate-300 focus:ring-orange-500 transition-all"
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : field.type === 'surgery_table' ? (
                    <div className="overflow-hidden border border-slate-100 rounded-2xl shadow-sm bg-white">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50/50 border-b border-slate-100">
                          <tr>
                            <th className="px-6 py-4 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]">Surgery Type</th>
                            <th className="px-6 py-4 text-center font-black text-orange-600 bg-orange-50/30 uppercase tracking-widest text-[10px]">Supervision</th>
                            <th className="px-6 py-4 text-center font-black text-emerald-600 bg-emerald-50/30 uppercase tracking-widest text-[10px]">Independent</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {field.rows?.map((row: string) => {
                            const data = (typeof val === 'string' ? JSON.parse(val || "{}") : (val || {}))[row] || {};
                            return (
                              <tr key={row} className="hover:bg-slate-50/30 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-800">{row}</td>
                                <td className="px-6 py-4 bg-orange-50/5">
                                  <Input 
                                    type="number"
                                    value={data.supervision || ""}
                                    onChange={(e) => {
                                      const current = typeof val === 'string' ? JSON.parse(val || "{}") : (val || {});
                                      updateField(field.id, field.mapping, { ...current, [row]: { ...data, supervision: parseInt(e.target.value) || 0 } }, field.isStandard);
                                    }}
                                    className="w-24 mx-auto h-9 text-center rounded-lg border-slate-200 focus:ring-orange-500/20"
                                  />
                                </td>
                                <td className="px-6 py-4 bg-emerald-50/5">
                                  <Input 
                                    type="number"
                                    value={data.independent || ""}
                                    onChange={(e) => {
                                      const current = typeof val === 'string' ? JSON.parse(val || "{}") : (val || {});
                                      updateField(field.id, field.mapping, { ...current, [row]: { ...data, independent: parseInt(e.target.value) || 0 } }, field.isStandard);
                                    }}
                                    className="w-24 mx-auto h-9 text-center rounded-lg border-slate-200 focus:ring-emerald-500/20"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : field.type === 'qualification_matrix' ? (
                    <div className="overflow-hidden border border-slate-100 rounded-2xl shadow-sm bg-white">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50/50 border-b border-slate-100">
                          <tr>
                            <th className="px-6 py-4 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]">Qualification</th>
                            <th className="px-6 py-4 text-center font-black text-slate-500 uppercase tracking-widest text-[10px]">Yes</th>
                            <th className="px-6 py-4 text-center font-black text-slate-500 uppercase tracking-widest text-[10px]">No</th>
                            <th className="px-6 py-4 text-center font-black text-slate-500 uppercase tracking-widest text-[10px]">N/A</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {['DO (Diploma Ophthlmology)', 'MS/MD ( Masters in Ophthalmology)', 'DNB'].map((q: string) => {
                            const current = typeof val === 'string' ? JSON.parse(val || "{}") : (val || {});
                            return (
                              <tr key={q} className="hover:bg-slate-50/30 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-800">{q}</td>
                                {['Yes', 'No', 'N/A'].map((option: string) => (
                                  <td key={option} className="px-6 py-4 text-center">
                                    <input
                                      type="radio"
                                      name={`${field.id}_${q}`}
                                      checked={current[q] === option}
                                      onChange={() => {
                                        updateField(field.id, field.mapping, { ...current, [q]: option }, field.isStandard);
                                      }}
                                      className="w-4 h-4 text-orange-600 border-slate-300 focus:ring-orange-500"
                                    />
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground italic p-4 border rounded-xl border-dashed bg-slate-50">
                      Response data: {JSON.stringify(val)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      ))}
    </div>
  );
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
  textarea: "Paragraph",
  email: "Email Address",
  phone: "Mobile Number",
  number: "Number",
  date: "Date Picker",
  time: "Time Picker",
  radio: "Radio Button (Select One)",
  checkbox_group: "Checkbox Group (Select Multiple)",
  select: "Dropdown / Select",
  file: "File Upload",
  checkbox: "Single Checkbox (Yes/No)",
  heading: "Section Heading",
  static_text: "Static Text / Description",
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
    const isLor = label.toLowerCase().includes("lor") || label.toLowerCase().includes("recommendation");
    const verifyUrl = typeof window !== 'undefined' ? (window.location.origin + "/verify-lor?path=" + encodeURIComponent(url)) : "";

    return (
      <div className="w-full mt-1 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="h-6 text-xs px-2 gap-1 no-print" onClick={toggle} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : isPhoto ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
            {expanded ? "Hide" : "View"} {label}
          </Button>
          <button
            className="text-xs text-primary hover:underline flex items-center gap-0.5 no-print"
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
        {isLor && verifyUrl && (
          <div className="mt-3 p-3 bg-slate-50 border border-slate-150 rounded-2xl flex flex-col md:flex-row gap-4 items-center print:bg-white print:border-none print:p-0 print:mt-2 print:gap-2">
            <div className="flex-1 space-y-1 text-center md:text-left print:hidden">
              <p className="text-xs font-black text-slate-800 flex items-center gap-1.5 justify-center md:justify-start">
                <CheckCircle className="w-3.5 h-3.5 text-[#0b4a8f]" />
                Access-Secured LOR QR
              </p>
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                Scan this code to verify authenticity. Access requires an authorized admin login.
              </p>
            </div>
            <div className="p-2 bg-white border border-slate-200 rounded-xl shadow-sm flex-shrink-0 print:shadow-none print:border-slate-350 print:p-1">
              <QRCode value={verifyUrl} size={90} className="w-[90px] h-[90px] print:w-[80px] print:h-[80px]" />
            </div>
          </div>
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
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  field: CustomField;
  onChange: (updated: CustomField) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const needsOptions = ["select", "radio", "checkbox_group"].includes(field.type);
  const isDisplayOnly = ["heading", "static_text"].includes(field.type);

  const addOption = () => {
    const newOptions = [...(field.options || []), `Option ${(field.options?.length || 0) + 1}`];
    onChange({ ...field, options: newOptions });
  };

  const updateOption = (index: number, val: string) => {
    const newOptions = [...(field.options || [])];
    newOptions[index] = val;
    onChange({ ...field, options: newOptions });
  };

  const removeOption = (index: number) => {
    const newOptions = (field.options || []).filter((_, i) => i !== index);
    onChange({ ...field, options: newOptions });
  };

  return (
    <div className="border rounded-xl p-4 space-y-4 bg-white shadow-sm dark:bg-slate-950 transition-all">
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1 mt-1 shrink-0">
          {onMoveUp && (
            <button onClick={onMoveUp} disabled={isFirst} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
              <ChevronUp className="h-4 w-4" />
            </button>
          )}
          {onMoveDown && (
            <button onClick={onMoveDown} disabled={isLast} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex-1 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-8 space-y-1.5">
              <Input
                placeholder={isDisplayOnly ? "Enter Section Title or Text..." : "Question / Field Label"}
                value={field.label}
                onChange={(e) => onChange({ ...field, label: e.target.value })}
                className="h-10 text-base font-medium bg-muted/50"
              />
            </div>
            <div className="md:col-span-4 space-y-1.5">
              <Select
                value={field.type}
                onValueChange={(v) => {
                  const newType = v as CustomField["type"];
                  const needsOpts = ["select", "radio", "checkbox_group"].includes(newType);
                  onChange({
                    ...field,
                    type: newType,
                    options: needsOpts && (!field.options || field.options.length === 0) ? ["Option 1"] : field.options
                  });
                }}
              >
                <SelectTrigger className="h-10 bg-muted/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {(Object.entries(FIELD_TYPE_LABELS) as [CustomField["type"], string][]).map(([val, lbl]) => (
                    <SelectItem key={val} value={val}>{lbl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isDisplayOnly && (
            <div className="space-y-1.5">
              <Input
                placeholder="Help text or description (optional)"
                value={field.description || ""}
                onChange={(e) => onChange({ ...field, description: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
          )}

          {!needsOptions && !isDisplayOnly && field.type !== "checkbox" && field.type !== "file" && (
            <div className="space-y-1.5">
              <Input
                placeholder="Placeholder Text (optional)"
                value={field.placeholder ?? ""}
                onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
          )}

          {needsOptions && (
            <div className="space-y-2 mt-2 pl-2 border-l-2 border-muted">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Options</Label>
              {(field.options || []).map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2 group">
                  {field.type === 'radio' ? (
                    <div className="h-4 w-4 rounded-full border shrink-0 bg-muted/30" />
                  ) : field.type === 'checkbox_group' ? (
                    <div className="h-4 w-4 rounded-sm border shrink-0 bg-muted/30" />
                  ) : (
                    <span className="text-xs text-muted-foreground w-4 text-center">{idx + 1}.</span>
                  )}
                  <Input
                    value={opt}
                    onChange={(e) => updateOption(idx, e.target.value)}
                    className="h-8 text-sm focus-visible:ring-1"
                    placeholder={`Option ${idx + 1}`}
                  />
                  <button
                    onClick={() => removeOption(idx)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0 transition-opacity"
                    title="Remove option"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                {field.type === 'radio' ? (
                  <div className="h-4 w-4 rounded-full border shrink-0 bg-muted/10" />
                ) : field.type === 'checkbox_group' ? (
                  <div className="h-4 w-4 rounded-sm border shrink-0 bg-muted/10" />
                ) : (
                  <span className="text-xs text-muted-foreground w-4 text-center">{((field.options?.length) || 0) + 1}.</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 justify-start px-2"
                  onClick={addOption}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Option
                </Button>
              </div>
            </div>
          )}

          <Separator className="my-2" />

          <div className="flex items-center justify-between">
            {!isDisplayOnly ? (
              <div className="flex items-center gap-2">
                <Switch
                  id={`req-${field.id}`}
                  checked={field.required}
                  onCheckedChange={(v) => onChange({ ...field, required: !!v })}
                />
                <Label htmlFor={`req-${field.id}`} className="text-sm cursor-pointer font-medium">Required field</Label>
              </div>
            ) : <div />}

            <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5">
              <Trash2 className="h-4 w-4" /> Delete Field
            </Button>
          </div>
        </div>
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

  const [viewSubId, setViewSubId] = useState<number | null>(null);
  const [viewFormId, setViewFormId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createdForm, setCreatedForm] = useState<ApplicationForm | null>(null);
  const [editForm, setEditForm] = useState<ApplicationForm | null>(null);
  const [activeSubDetail, setActiveSubDetail] = useState<any | null>(null);
  const [isEditingData, setIsEditingData] = useState(false);
  const [tempFormData, setTempFormData] = useState<any>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [createFormData, setCreateFormData] = useState({ programId: "", title: "", description: "", deadline: "", loadDefaults: true, customToken: "" });
  const [createCustomFields, setCreateCustomFields] = useState<CustomField[]>([]);
  const [editCustomFields, setEditCustomFields] = useState<CustomField[]>([]);
  const [editSectionsConfig, setEditSectionsConfig] = useState<any[]>([]);
  const [photoBlobUrl, setPhotoBlobUrl] = useState<string | null>(null);
  const [specFilter, setSpecFilter] = useState<string>("all");

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

  // Manual submission state
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [manualEntryData, setManualEntryData] = useState<any>({
    fullName: "",
    email: "",
    phone: "",
    specialization: "",
    status: "pending",
    medicalHistory: "",
    education: "",
    experience: "",
    publications: "",
    lor: "",
    declaration: true,
    photoUrl: "",
    cvUrl: "",
    paymentId: "",
    paidAmount: "",
    paymentMode: "Online"
  });

  const createManualSubmission = useMutation({
    mutationFn: (data: any) => api.post(`/application-submissions`, { ...data, formId: viewFormId }),
    onSuccess: () => {
      toast({ title: "Submission created" });
      qc.invalidateQueries({ queryKey: ["submissions", viewFormId] });
      setManualEntryOpen(false);
      setManualEntryData({ 
        fullName: "", email: "", phone: "", specialization: "", status: "pending",
        medicalHistory: "", education: "", experience: "", publications: "", lor: "",
        declaration: true, photoUrl: "", cvUrl: "",
        paymentId: "", paidAmount: "", paymentMode: "Online"
      });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const { data: specialities = [] } = useQuery<any[]>({
    queryKey: ["specialities"],
    queryFn: () => api.get("/specialities"),
  });

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
    mutationFn: (data: { programId: number; title: string; description?: string; deadline?: string; customFields: CustomField[]; loadDefaults?: boolean; customToken?: string }) =>
      api.post<ApplicationForm>("/application-forms", data),
    onSuccess: (form) => {
      qc.invalidateQueries({ queryKey: ["application-forms"] });
      setCreateOpen(false);
      setCreateFormData({ programId: "", title: "", description: "", deadline: "", loadDefaults: true, customToken: "" });
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
    mutationFn: ({ id, status, reviewNotes, formData, fullName, email, phone }: any) => 
      api.patch(`/application-forms/submissions/${id}`, { status, reviewNotes, formData, fullName, email, phone }),
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

  // Convert any image URL/Blob into a standard scannable and printable JPG data url!
  const convertToJpg = (srcUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/jpeg", 0.9));
        } else {
          resolve(srcUrl);
        }
      };
      img.onerror = () => {
        resolve(srcUrl);
      };
      img.src = srcUrl;
    });
  };

  useEffect(() => {
    let active = true;
    let localUrl: string | null = null;

    if (viewedSub?.photoUrl) {
      if (viewedSub.photoUrl.startsWith("/objects/")) {
        const token = localStorage.getItem("fellowship_token");
        const servingUrl = `/api/storage${viewedSub.photoUrl}`;
        fetch(servingUrl, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => {
            if (!res.ok) throw new Error();
            return res.blob();
          })
          .then(blob => {
            if (active) {
              const url = URL.createObjectURL(blob);
              localUrl = url;
              convertToJpg(url).then(jpgDataUrl => {
                if (active) {
                  setPhotoBlobUrl(jpgDataUrl);
                }
              }).catch(() => {
                if (active) {
                  setPhotoBlobUrl(url);
                }
              });
            }
          })
          .catch(() => {
            if (active) setPhotoBlobUrl(null);
          });
      } else if (viewedSub.photoUrl.startsWith("http://") || viewedSub.photoUrl.startsWith("https://")) {
        convertToJpg(viewedSub.photoUrl).then(jpgDataUrl => {
          if (active) setPhotoBlobUrl(jpgDataUrl);
        }).catch(() => {
          if (active) setPhotoBlobUrl(viewedSub.photoUrl);
        });
      } else {
        setPhotoBlobUrl(null);
      }
    } else {
      setPhotoBlobUrl(null);
    }

    return () => {
      active = false;
      if (localUrl) {
        URL.revokeObjectURL(localUrl);
      }
    };
  }, [viewedSub?.photoUrl]);

  const addCustomField = (fields: CustomField[], setFields: (f: CustomField[]) => void) => {
    setFields([...fields, { id: genId(), label: "", type: "text", required: false }]);
  };

  const updateCustomField = (fields: CustomField[], setFields: (f: CustomField[]) => void, id: string, updated: CustomField) => {
    setFields(fields.map((f) => f.id === id ? updated : f));
  };

  const deleteCustomField = (fields: CustomField[], setFields: (f: CustomField[]) => void, id: string) => {
    setFields(fields.filter((f) => f.id !== id));
  };
  
  // Reset editing state when submission changes
  useEffect(() => {
    setIsEditingData(false);
    setTempFormData({});
  }, [viewSubId]);

  const handleEditData = () => {
    if (!viewedSub) return;
    setTempFormData({ 
      fullName: viewedSub.fullName,
      email: viewedSub.email,
      phone: viewedSub.phone,
      status: viewedSub.status,
      reviewNotes: viewedSub.reviewNotes,
      formData: { ...viewedSub.formData }
    });
    setIsEditingData(true);
  };

  const handleSaveData = () => {
    if (!viewedSub) return;
    updateSubmission.mutate({ 
      id: viewedSub.id, 
      ...tempFormData
    }, {
      onSuccess: (updated) => {
        setActiveSubDetail(updated);
        setIsEditingData(false);
        toast({ title: "Submission Updated", description: "The submission has been updated successfully." });
      }
    });
  };

  // Helper to format center preferences as a string matching specialities
  const formatCenterPreferences = () => {
    if (!viewedSub) return "";
    const prefs = parseCenterPreferences(viewedSub.centerPreference, viewedSub.formData, viewedForm?.sectionsConfig);
    const entries = Object.entries(prefs).map(([specName, loc]) => `${specName}: ${loc}`);
    if (entries.length === 0) {
      return viewedSub.centerPreference ? cleanArrayValue(viewedSub.centerPreference) : "";
    }
    return entries.join(", ");
  };

  const cleanArrayValue = (val: string): string => {
    if (!val) return "";
    const trimmed = val.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return parseSpecializations(trimmed).join(", ");
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.join(", ");
    } catch { /* not JSON */ }
    return val;
  };

  // Extract all standard and dynamic fields into a compact list of key-value pairs
  const getCompactPrintFields = () => {
    if (!viewedSub || !viewedForm) return [];
    const fields: { label: string; value: string }[] = [];
    
    // Core demographic details
    if (viewedSub.dateOfBirth) fields.push({ label: "Date of Birth", value: new Date(viewedSub.dateOfBirth).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) });
    if (viewedSub.maritalStatus) fields.push({ label: "Marital Status", value: viewedSub.maritalStatus });
    if (viewedSub.phone) fields.push({ label: "Contact Number", value: viewedSub.phone });
    if (viewedSub.centerPreference) fields.push({ label: "Center Preference", value: formatCenterPreferences() });
    
    // Read dynamic non-file fields
    for (const s of viewedForm.sectionsConfig || []) {
      for (const f of s.fields) {
        if (f.type !== "file" && f.type !== "info" && f.type !== "heading" && f.type !== "static_text") {
          const val = f.isStandard && f.mapping ? viewedSub[f.mapping] : viewedSub.formData?.[f.id];
          if (val && typeof val !== "object" && String(val).trim() !== "") {
            const cleanedVal = cleanArrayValue(String(val));
            if (!fields.some(item => item.label.toLowerCase() === f.label.toLowerCase())) {
              fields.push({ label: f.label, value: cleanedVal });
            }
          }
        }
      }
    }
    return fields;
  };

  const getPrintLorFields = () => {
    if (!viewedSub || !viewedForm) return [];
    const list: { label: string; value: string }[] = [];
    for (const s of viewedForm.sectionsConfig || []) {
      for (const f of s.fields) {
        if (f.type === "file") {
          const isLor = f.label.toLowerCase().includes("lor") || f.label.toLowerCase().includes("recommendation");
          if (isLor) {
            const val = f.isStandard && f.mapping ? viewedSub[f.mapping] : viewedSub.formData?.[f.id];
            if (val && String(val) !== "nil" && String(val) !== "null") {
              if (!list.some(item => item.value === String(val))) {
                list.push({ label: f.label, value: String(val) });
              }
            }
          }
        }
      }
    }
    return list;
  };

  // Submission detail view
  if (viewFormId !== null && viewSubId !== null && viewedSub) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="detail-overlay fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex flex-col print:relative print:inset-auto print:bg-white print:z-0 print:h-auto print:overflow-visible"
      >
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            /* Force A4 dimensions and tight margins for 1-page layout */
            @page { margin: 0.8cm; size: A4 portrait; }
            body, html, #root { 
               background: white !important; 
               margin: 0 !important; 
               padding: 0 !important; 
               width: 100% !important;
               height: 100% !important;
               overflow: hidden !important;
            }
            
            /* Remove all overflow restrictions that truncate pages */
            * {
               overflow: visible !important;
            }
            
            aside, .md\\:hidden, .main-sidebar, .main-header, .no-print { display: none !important; }
            .flex.h-screen, .flex.h-screen > main {
               display: block !important;
               height: auto !important;
               overflow: visible !important;
               position: static !important;
            }
            
            /* Make the overlay cover everything and flow naturally */
            .detail-overlay { 
               position: absolute !important; 
               top: 0 !important;
               left: 0 !important;
               background: white !important; 
               height: 100% !important; 
               width: 100% !important;
               display: block !important;
               margin: 0 !important;
               padding: 0 !important;
               z-index: 9999 !important;
            }
            
            table {
               table-layout: fixed !important;
               width: 100% !important;
               max-width: 100% !important;
               word-wrap: break-word !important;
               page-break-inside: avoid;
            }
            td, th {
               word-break: break-word !important;
               white-space: normal !important;
            }
            
            /* Ensure UI elements like cards break nicely */
            .card, .glass-card {
               break-inside: avoid;
               box-shadow: none !important;
               border: 1px solid #e2e8f0 !important;
            }
            
            * { 
               -webkit-print-color-adjust: exact !important; 
               print-color-adjust: exact !important; 
            }
          }
        `}} />
        <div className="flex-1 flex flex-col bg-slate-50/50 print:bg-white print:h-auto print:overflow-visible">
          {/* Glass Header */}
          <div className="glass-header px-8 py-5 flex items-center justify-between border-b border-slate-200 bg-white/90 backdrop-blur-xl no-print">
            <div className="flex items-center gap-5">
               <Button 
                 variant="ghost" 
                 size="icon" 
                 onClick={() => setViewSubId(null)} 
                 className="rounded-full hover:bg-slate-100 transition-all hover:scale-110 active:scale-95"
               >
                  <ArrowLeft className="w-5 h-5 text-slate-600" />
               </Button>
               <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">{viewedSub.fullName}</h2>
                  <div className="flex items-center gap-3 mt-1">
                     <Badge className={`${STATUS_COLORS[viewedSub.status] || "bg-slate-100"} rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-widest border-none shadow-sm`}>
                       {viewedSub.status}
                     </Badge>
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                       <Clock className="w-3 h-3" /> 
                       Submitted {new Date(viewedSub.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                     </span>
                  </div>
               </div>
            </div>
            
            <div className="flex items-center gap-3">
               <Button variant="outline" size="sm" onClick={() => window.print()} className="rounded-xl border-slate-200 hover:bg-slate-50 transition-all font-bold px-4">
                  <Printer className="w-4 h-4 mr-2" /> Print PDF
               </Button>
               
               {isEditingData ? (
                 <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingData(false)} className="rounded-xl font-bold px-4">Cancel</Button>
                    <Button size="sm" onClick={handleSaveData} disabled={updateSubmission.isPending} className="rounded-xl orange-gradient text-white border-none shadow-lg shadow-orange-500/20 px-6 font-bold hover:scale-[1.02] active:scale-[0.98] transition-all">
                      {updateSubmission.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      Save Changes
                    </Button>
                 </div>
               ) : (
                 <Button size="sm" onClick={handleEditData} className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-xl hover:shadow-2xl px-6 font-bold transition-all hover:-translate-y-0.5">
                   <Edit className="w-4 h-4 mr-2" /> Edit Submission
                 </Button>
               )}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-8 fancy-scrollbar print:overflow-visible print:h-auto print:p-0">
             {/* Formal Print Header Title */}
             <div className="hidden print:flex items-start justify-between border-b-2 border-[#0b4a8f] pb-4 mb-6">
                <div className="space-y-0.5">
                   <h1 className="text-3xl font-black uppercase tracking-tight text-[#0b4a8f]">Sankara Academy of Vision</h1>
                   <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Fellowship Application Record</p>
                </div>
                <div className="text-right">
                   <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Date Printed</p>
                   <p className="text-xs font-bold text-slate-950 text-right">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
             </div>

             {/* Candidate Details & Photo Placement (Below Header, Photo on the Right) */}
             <div className="hidden print:grid grid-cols-12 gap-6 items-start pb-6 mb-6 border-b border-slate-200">
                <div className="col-span-8 space-y-4">
                   <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-[#0b4a8f] leading-none mb-1">Applicant Registration Number</p>
                      <p className="text-xl font-black text-slate-900 font-mono tracking-wider">{viewedSub.candidateCode || "PENDING"}</p>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                         <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Full Name of Applicant</p>
                         <p className="text-sm font-black text-slate-900">{viewedSub.fullName}</p>
                      </div>
                      <div>
                         <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">E-Mail Address</p>
                         <p className="text-sm font-semibold text-slate-700 break-all">{viewedSub.email}</p>
                      </div>
                   </div>
                   <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1.5">Specialization Applied For</p>
                      <div className="flex flex-wrap gap-1.5">
                         {(() => {
                            const centerPrefs = parseCenterPreferences(viewedSub.centerPreference, viewedSub.formData, viewedForm?.sectionsConfig);
                            return parseSpecializations(viewedSub.specialization).map((spec, idx) => {
                               const matchKey = Object.keys(centerPrefs).find(k => 
                                  k.toLowerCase().trim() === spec.toLowerCase().trim() ||
                                  spec.toLowerCase().trim().includes(k.toLowerCase().trim()) ||
                                  k.toLowerCase().trim().includes(spec.toLowerCase().trim())
                               );
                               const loc = matchKey ? centerPrefs[matchKey] : "";
                               const displayName = loc ? `${spec} (${loc})` : spec;
                               return (
                            <span key={idx} className="text-[10px] font-black text-[#0b4a8f] bg-[#0b4a8f]/5 border border-[#0b4a8f]/10 px-2.5 py-0.5 rounded-lg shadow-sm">
                               {displayName}
                            </span>
                               );
                            });
                         })()}
                      </div>
                   </div>
                </div>
                
                <div className="col-span-4 flex justify-end">
                   <div className="w-28 h-32 border-2 border-slate-300 bg-white p-1 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden shadow-sm">
                      {photoBlobUrl ? (
                         <img src={photoBlobUrl} alt="Candidate Photo" className="w-full h-full object-cover rounded" />
                      ) : (
                         <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center text-center p-2 rounded">
                            <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Passport size</span>
                            <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Photograph</span>
                         </div>
                      )}
                   </div>
                </div>
             </div>

             <div className="no-print">
             <AnimatePresence mode="wait">
              <motion.div
                key={isEditingData ? 'edit' : 'view'}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="max-w-5xl mx-auto"
              >
                {isEditingData ? (
                  <Card className="border-none shadow-2xl rounded-3xl overflow-hidden glass-card">
                     <div className="bg-slate-900/5 px-8 py-8 border-b border-white/20">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-lg">
                              <Edit className="w-5 h-5" />
                           </div>
                           <div>
                              <h3 className="text-xl font-black text-slate-900 tracking-tight">Response Editor</h3>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Modify candidate details and form responses</p>
                           </div>
                        </div>
                     </div>
                     <CardContent className="p-10 space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                           <div className="space-y-2">
                              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Full Name</Label>
                              <Input 
                                value={tempFormData.fullName || ""} 
                                onChange={(e) => setTempFormData({ ...tempFormData, fullName: e.target.value })}
                                className="rounded-xl bg-slate-50/50 border-slate-200 focus:ring-4 focus:ring-orange-500/10"
                              />
                           </div>
                           <div className="space-y-2">
                              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Email</Label>
                              <Input 
                                value={tempFormData.email || ""} 
                                onChange={(e) => setTempFormData({ ...tempFormData, email: e.target.value })}
                                className="rounded-xl bg-slate-50/50 border-slate-200 focus:ring-4 focus:ring-orange-500/10"
                              />
                           </div>
                           <div className="space-y-2">
                              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Status</Label>
                              <Select value={tempFormData.status || "pending"} onValueChange={(v) => setTempFormData({ ...tempFormData, status: v })}>
                                <SelectTrigger className="rounded-xl bg-slate-50/50 border-slate-200">
                                   <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="reviewed">Reviewed</SelectItem>
                                  <SelectItem value="approved">Approved</SelectItem>
                                  <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                              </Select>
                           </div>
                        </div>
                        
                        <Separator className="opacity-50" />
                        
                        <SubmissionFormDataEditor 
                          sectionsConfig={viewedForm?.sectionsConfig || []} 
                          formData={tempFormData} 
                          onChange={(newData) => setTempFormData(newData)} 
                        />
                     </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Metadata & Actions */}
                    <div className="lg:col-span-1 space-y-8">
                       <Card className="border-none shadow-premium rounded-3xl p-8 bg-white overflow-hidden relative">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                             <FileText className="w-3 h-3" /> Candidate Summary
                          </h4>
                          <div className="space-y-6">
                             <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm">
                                   <FileType className="w-6 h-6" />
                                </div>
                                <div>
                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</p>
                                   <p className="text-sm font-bold text-slate-900 break-all">{viewedSub.email}</p>
                                </div>
                             </div>
                             <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm">
                                   <CalendarDays className="w-6 h-6" />
                                </div>
                                <div>
                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone Number</p>
                                   <p className="text-sm font-bold text-slate-900">{viewedSub.phone || "Not Provided"}</p>
                                </div>
                             </div>
                          </div>
                       </Card>
                       
                       <Card className="border-none shadow-premium rounded-3xl p-8 bg-white overflow-hidden">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                             <FileSignature className="w-3 h-3" /> Internal Review Notes
                          </h4>
                          <Textarea 
                            className="text-sm border-none bg-slate-50/50 rounded-2xl focus:ring-0 min-h-[180px] resize-none font-medium placeholder:text-slate-300" 
                            placeholder="Add internal evaluation notes, interview results, or credential verification status..."
                            value={viewedSub.reviewNotes || ""}
                            onChange={(e) => updateSubmission.mutate({ id: viewedSub.id, reviewNotes: e.target.value })}
                          />
                       </Card>
                       <Card className="border-none shadow-premium rounded-3xl p-8 bg-white overflow-hidden no-print">
                           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                              <CheckCircle2 className="w-3 h-3" /> Management Actions
                           </h4>
                           <div className="space-y-4">
                              <div className="space-y-2">
                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Update Status</Label>
                                <Select value={viewedSub.status} onValueChange={(v) => updateSubmission.mutate({ id: viewedSub.id, status: v })}>
                                  <SelectTrigger className="rounded-xl bg-slate-50 border-slate-100 h-11 font-bold text-xs uppercase tracking-wider">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-2xl">
                                    <SelectItem value="pending">PENDING</SelectItem>
                                    <SelectItem value="reviewed">REVIEWED</SelectItem>
                                    <SelectItem value="rejected">REJECTED</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <Separator className="opacity-50 my-2" />
                              
                              <Button 
                                className="w-full h-12 rounded-xl orange-gradient text-white border-none shadow-lg shadow-orange-500/20 font-bold hover:scale-[1.02] active:scale-[0.98] transition-all gap-2"
                                onClick={() => approveSubmission.mutate(viewedSub.id)}
                                disabled={approveSubmission.isPending || viewedSub.status === "approved"}
                              >
                                {approveSubmission.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
                                {viewedSub.status === "approved" ? "ALREADY APPROVED" : "APPROVE & ENROLL"}
                              </Button>
                              
                              <Button 
                                variant="outline" 
                                className="w-full h-11 rounded-xl border-slate-200 text-slate-600 font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all gap-2"
                                onClick={() => updateSubmission.mutate({ id: viewedSub.id, status: "rejected" })}
                                disabled={updateSubmission.isPending}
                              >
                                <Ban className="h-4 w-4" /> REJECT APPLICATION
                              </Button>
                           </div>
                        </Card>
                    </div>
                     
                     {/* Right Column: Form Responses */}
                     <div className="lg:col-span-2 space-y-8">
                        {(viewedForm?.sectionsConfig || []).map((section: any) => {
                          const visibleFields = section.fields.filter((f: any) => 
                            f.type !== 'info' && f.type !== 'heading' && f.type !== 'static_text'
                          );
                          
                          return (
                            <Card key={section.id} className="border-none shadow-premium rounded-3xl overflow-hidden bg-white">
                              <div className="bg-slate-50/50 px-8 py-5 border-b border-slate-100 flex items-center justify-between">
                                 <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{section.title}</h4>
                              </div>
                              <div className="divide-y divide-slate-50">
                                {visibleFields.map((field: any) => {
                                  const val = field.isStandard && field.mapping ? viewedSub[field.mapping] : viewedSub.formData?.[field.id];
                                  if (val === undefined || val === null || val === "") return null;
                                  
                                  return (
                                    <div key={field.id} className="px-8 py-5 grid grid-cols-1 md:grid-cols-3 gap-4 hover:bg-slate-50/30 transition-colors">
                                       <div className="md:col-span-1">
                                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pt-1 leading-tight">{field.label}</p>
                                       </div>
                                       <div className="md:col-span-2">
                                          {field.type === 'file' ? (
                                            <DocValue label={field.label} url={String(val)} />
                                          ) : typeof val === 'object' ? (
                                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                               <pre className="text-[10px] font-mono text-slate-600 overflow-x-auto">
                                                 {JSON.stringify(val, null, 2)}
                                               </pre>
                                            </div>
                                          ) : (
                                            <p className="text-sm font-bold text-slate-800 break-words leading-relaxed">{String(val)}</p>
                                          )}
                                       </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </Card>
                          );
                        })}
                     </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
            </div>

            {/* Dedicated 1-Page A4 Print View (Hidden on Screen, Visible on Print) */}
            <div className="hidden print:block space-y-4 print:text-slate-900 mt-2">
               {/* Academic & Personal Grid */}
               <div className="border border-slate-350 rounded-xl overflow-hidden bg-white shadow-sm">
                  <div className="bg-[#0b4a8f]/5 px-4 py-1.5 border-b border-slate-350">
                     <p className="text-[10px] font-black text-[#0b4a8f] uppercase tracking-wider">I. Candidate Profile & Academic Overview</p>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 text-xs">
                     {getCompactPrintFields().map((field, idx) => (
                        <div key={idx} className="p-2 flex items-center justify-between min-h-[36px]">
                           <span className="font-bold text-slate-500 uppercase text-[9px] tracking-wider">{field.label}</span>
                           <span className="font-black text-slate-800 break-all pl-2 text-right">{field.value}</span>
                        </div>
                     ))}
                  </div>
               </div>

               {/* Secure Letters of Recommendation Verification (LORs side-by-side) */}
               {getPrintLorFields().length > 0 && (
                  <div className="grid grid-cols-2 gap-4">
                     {getPrintLorFields().map((lor, idx) => {
                        const verifyUrl = typeof window !== 'undefined' ? (window.location.origin + "/verify-lor?path=" + encodeURIComponent(lor.value)) : "";
                        return (
                           <div key={idx} className="border border-slate-350 rounded-xl p-3.5 bg-white flex items-center justify-between gap-4 shadow-sm min-h-[110px]">
                              <div className="space-y-1">
                                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Verified Reference</p>
                                 <p className="text-xs font-black text-slate-900 leading-snug">{lor.label}</p>
                                 <div className="pt-1.5 flex items-center gap-1 text-[8px] font-black text-[#0b4a8f] uppercase tracking-wider">
                                    <span>🔒 Secure Verification QR</span>
                                 </div>
                                 <p className="text-[7.5px] text-slate-455 font-medium leading-tight max-w-[130px]">
                                    Administrative review required. Scanning validates credential authenticity.
                                 </p>
                              </div>
                              <div className="p-1 bg-white border border-slate-200 rounded-lg flex-shrink-0">
                                 {verifyUrl && <QRCode value={verifyUrl} size={65} className="w-[65px] h-[65px]" />}
                              </div>
                           </div>
                        );
                     })}
                  </div>
               )}

               {/* Print Verification Sign-off Box */}
               <div className="border border-slate-350 rounded-xl p-4 bg-white/50 grid grid-cols-3 gap-6 items-end pt-12 mt-4">
                  <div className="space-y-1">
                     <div className="border-t border-slate-400 w-full pt-1.5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Signature of Reviewer</p>
                     </div>
                  </div>
                  <div className="space-y-1 text-center">
                     <div className="border-t border-slate-400 w-full pt-1.5">
                        <p className="text-[9px] font-black text-[#0b4a8f] uppercase tracking-wider font-mono opacity-20">SAV OFFICIAL SEAL</p>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Authorized Seal / Stamp</p>
                     </div>
                  </div>
                  <div className="space-y-1 text-right">
                     <div className="border-t border-slate-400 w-full pt-1.5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Date of Verification</p>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Submissions list view
  if (viewFormId !== null) {
    
    
    const filteredSubs = submissions.filter((s) => {
      const statusMatch = statusFilter === "all" ? true : (statusFilter === "ready" ? s.readyForReview : s.status === statusFilter);
      const specMatch = specFilter === "all" ? true : parseSpecializations(s.specialization).includes(specFilter);
      return statusMatch && specMatch;
    });

    const readyCount = submissions.filter((s) => s.readyForReview).length;
    
    // Get unique specializations for filter
    const allSpecs = Array.from(new Set(submissions.flatMap(s => parseSpecializations(s.specialization)))).sort();

    const allFilteredSelected = filteredSubs.length > 0 && filteredSubs.every((s) => selectedIds.includes(s.id));
    const toggleSelectAll = () => {
      if (allFilteredSelected) setSelectedIds([]);
      else setSelectedIds(filteredSubs.map((s) => s.id));
    };
    const totalApplications = submissions.reduce((acc, s) => acc + parseSpecializations(s.specialization).length, 0);
    const today = new Date().toLocaleDateString("en-IN");
    const todayApplications = submissions.reduce((acc, s) => {
      if (new Date(s.submittedAt).toLocaleDateString("en-IN") === today) {
        return acc + parseSpecializations(s.specialization).length;
      }
      return acc;
    }, 0);

    const toggleSelect = (id: number) =>
      setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="p-8 space-y-8"
      >
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-5">
            <Button variant="ghost" size="icon" onClick={() => { setViewFormId(null); setViewSubId(null); setStatusFilter("all"); setSelectedIds([]); }} className="rounded-full hover:bg-slate-100">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Button>
            <div>
               <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-slate-900 text-white border-none rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-widest">
                     Management
                  </Badge>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                     <FileText className="w-3 h-3" /> {viewedForm?.title}
                  </span>
               </div>
               <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Submissions Queue</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="rounded-xl border-slate-200 font-bold px-4"
              onClick={() => syncGoogleSheets.mutate(viewFormId)}
              disabled={syncGoogleSheets.isPending}>
              {syncGoogleSheets.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Sync Sheets
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl border-slate-200 font-bold px-4" onClick={() => exportExcel(viewFormId)} disabled={exporting || submissions.length === 0}>
              {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Excel Export
            </Button>
            <Button size="sm" className="rounded-xl orange-gradient text-white border-none shadow-lg shadow-orange-500/20 font-bold px-6 hover:scale-[1.02] active:scale-[0.98] transition-all" onClick={() => setManualEntryOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Manual Entry
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           {[
             { label: "Total Apps", value: totalApplications, sub: "Across all specializations", color: "blue" },
             { label: "Today", value: todayApplications, sub: today, color: "emerald" },
             { label: "Candidates", value: submissions.length, sub: "Unique applicants", color: "orange" },
             { label: "Pending", value: submissions.filter(s => s.status === 'pending').length, sub: "Awaiting review", color: "slate" }
           ].map((stat, idx) => (
             <Card key={idx} className="border-none shadow-premium rounded-3xl p-6 bg-white overflow-hidden relative group">
                <div className={`absolute top-0 right-0 w-24 h-24 bg-${stat.color}-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform`}></div>
                <p className={`text-[10px] font-black text-${stat.color}-600 uppercase tracking-widest mb-1`}>{stat.label}</p>
                <p className="text-3xl font-black text-slate-900">{stat.value}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 opacity-70">{stat.sub}</p>
             </Card>
           ))}
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div className="flex items-center gap-4 flex-wrap">
            <div className="flex gap-1.5 p-1 bg-slate-100 rounded-2xl w-fit">
              {(["all", "ready", "pending", "approved", "rejected"] as const).map((f) => (
                <Button 
                  key={f} 
                  size="sm" 
                  variant={statusFilter === f ? "default" : "ghost"}
                  className={`rounded-xl text-[10px] font-black uppercase tracking-widest px-4 h-9 ${statusFilter === f ? 'bg-white text-slate-900 shadow-sm hover:bg-white' : 'text-slate-500 hover:text-slate-900'}`}
                  onClick={() => { setStatusFilter(f); setSelectedIds([]); }}>
                  {f}
                  <Badge className="ml-2 bg-slate-200 text-slate-600 border-none group-hover:bg-slate-300">
                     {f === "all" ? submissions.length : f === "ready" ? readyCount : submissions.filter((s) => s.status === f).length}
                  </Badge>
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-2 bg-white/50 border border-slate-200 p-1.5 rounded-2xl shadow-sm">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Filter Specialty</span>
               <Select value={specFilter} onValueChange={setSpecFilter}>
                 <SelectTrigger className="h-8 min-w-[180px] rounded-xl border-none bg-slate-100 hover:bg-slate-200 transition-all text-[10px] font-black uppercase tracking-widest focus:ring-0">
                    <SelectValue placeholder="All Specializations" />
                 </SelectTrigger>
                 <SelectContent className="rounded-2xl border-slate-100 shadow-2xl">
                    <SelectItem value="all" className="text-[10px] font-black uppercase tracking-widest">All Specializations</SelectItem>
                    {allSpecs.map(spec => (
                      <SelectItem key={spec} value={spec} className="text-[10px] font-black uppercase tracking-widest">{spec}</SelectItem>
                    ))}
                 </SelectContent>
               </Select>
            </div>
          </div>

         {selectedIds.length > 0 && (
             <motion.div 
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               className="flex items-center gap-3 bg-slate-900 text-white rounded-2xl px-5 py-2 shadow-xl"
             >
               <span className="text-xs font-bold mr-2">{selectedIds.length} Selected</span>
               <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-[10px] font-black uppercase h-8 px-3"
                 onClick={() => bulkAction.mutate({ formId: viewFormId, action: "approve", ids: selectedIds })}
                 disabled={bulkAction.isPending}>
                 Approve
               </Button>
               <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 text-[10px] font-black uppercase h-8 px-3"
                 onClick={() => {
                   if (confirm(`Delete ${selectedIds.length} submissions?`)) bulkDeleteSubsMutation.mutate(selectedIds);
                 }}
                 disabled={bulkDeleteSubsMutation.isPending}>
                 Delete
               </Button>
             </motion.div>
           )}
        </div>

        <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-white">
          <div className="overflow-x-auto fancy-scrollbar">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-5 w-10">
                    <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} className="rounded-md border-slate-300" />
                  </th>
                  <th className="text-left px-6 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Candidate</th>
                  <th className="text-left px-6 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Applied For</th>
                  <th className="text-left px-6 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Status</th>
                  <th className="text-left px-6 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Payment Ref</th>
                  <th className="text-left px-6 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Submitted</th>
                  <th className="text-right px-6 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredSubs.map((s) => (
                  <tr key={s.id} className={`group hover:bg-slate-50/50 transition-colors ${selectedIds.includes(s.id) ? "bg-orange-50/30" : ""}`}>
                    <td className="px-6 py-5">
                      <Checkbox checked={selectedIds.includes(s.id)} onCheckedChange={() => toggleSelect(s.id)} className="rounded-md border-slate-300" />
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900 text-base leading-tight group-hover:text-orange-600 transition-colors cursor-pointer flex items-center gap-2" onClick={() => setViewSubId(s.id)}>
                           {s.fullName}
                           {s.readyForReview && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{s.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {(() => {
                        const specs = parseSpecializations(s.specialization);
                        return (
                          <div className="flex flex-wrap gap-1.5">
                            {specs.map((sp) => (
                              <Badge key={sp} className={`${SPEC_BADGE_COLORS[sp] ?? "bg-slate-100 text-slate-600"} rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-tight border-none`}>
                                 {sp}
                              </Badge>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-5">
                      <Badge className={`${STATUS_COLORS[s.status] ?? "bg-slate-100"} rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest border-none`}>
                        {s.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-5">
                      <DocValue label="Payment" url={s.paymentUrl || s.paymentId} />
                    </td>
                    <td className="px-6 py-5">
                       <p className="text-xs font-bold text-slate-700">{new Date(s.submittedAt).toLocaleDateString()}</p>
                       <p className="text-[10px] font-medium text-slate-400">{new Date(s.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                    <td className="px-6 py-5 text-right">
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         onClick={() => setViewSubId(s.id)}
                         className="rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 hover:text-white"
                       >
                          View Detail
                       </Button>
                     </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>
    );
  }

  // Forms list view
  return (
    <div className="p-10 space-y-10">
      <div className="flex items-center justify-between gap-6 flex-wrap">
        <div>
           <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-orange-500 text-white border-none rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-widest">
                 System
              </Badge>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                 <Settings2 className="w-3 h-3" /> Configuration
              </span>
           </div>
           <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Application Forms</h1>
           <p className="text-sm text-slate-500 font-medium mt-2">Manage dynamic application entry points and program enrollment</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="rounded-2xl orange-gradient text-white border-none shadow-xl shadow-orange-500/20 px-8 py-6 font-bold hover:scale-[1.02] active:scale-[0.98] transition-all gap-2">
          <Plus className="h-5 w-5" /> NEW FORM
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
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {forms.map((form) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              key={form.id}
            >
              <Card className="border-none shadow-premium rounded-3xl overflow-hidden bg-white group hover:shadow-2xl transition-all duration-300">
                <CardContent className="p-0">
                  <div className="p-8">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={`${form.isActive ? "bg-emerald-500" : "bg-slate-400"} text-white border-none rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest shadow-sm`}>
                            {form.isActive ? "Active" : "Paused"}
                          </Badge>
                          {form.pendingCount > 0 && (
                            <Badge className="bg-orange-500 text-white border-none rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest shadow-sm">
                              {form.pendingCount} Pending
                            </Badge>
                          )}
                        </div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight group-hover:text-orange-600 transition-colors">{form.title}</h3>
                        {form.description && (
                          <p className="text-sm text-slate-500 font-medium line-clamp-1 mt-1">{form.description}</p>
                        )}
                        
                        <div className="flex items-center gap-5 mt-5 flex-wrap">
                           <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center border border-blue-100">
                                 <Users className="w-4 h-4" />
                              </div>
                              <div>
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Submissions</p>
                                 <p className="text-sm font-bold text-slate-700">{form.submissionCount}</p>
                              </div>
                           </div>
                           {form.deadline && (
                              <div className="flex items-center gap-2">
                                 <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center border border-orange-100">
                                    <Clock className="w-4 h-4" />
                                 </div>
                                 <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Deadline</p>
                                    <p className="text-sm font-bold text-slate-700">{new Date(form.deadline).toLocaleDateString("en-IN")}</p>
                                 </div>
                              </div>
                           )}
                           <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center border border-slate-100">
                                 <Building2 className="w-4 h-4" />
                              </div>
                              <div>
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Program</p>
                                 <p className="text-sm font-bold text-slate-700 truncate max-w-[120px]">{form.programName ?? `#${form.programId}`}</p>
                              </div>
                           </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2 shrink-0">
                         <Button variant="ghost" size="icon" className="rounded-2xl hover:bg-red-50 hover:text-red-600 transition-all" onClick={() => setDeleteConfirmId(form.id)}>
                            <Trash2 className="w-4 h-4" />
                         </Button>
                         <Switch checked={form.isActive} onCheckedChange={(v) => toggleActive.mutate({ id: form.id, isActive: v })} className="data-[state=checked]:bg-emerald-500" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50/80 px-8 py-5 border-t border-slate-100 flex items-center justify-between gap-4">
                     <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 flex items-center gap-2 truncate">
                           <Link2 className="w-3 h-3 text-slate-400 shrink-0" />
                           <code className="text-[10px] font-bold text-slate-600 truncate">{buildFormLink(form.token)}</code>
                        </div>
                        <Button variant="ghost" size="sm" className="rounded-xl h-8 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200" onClick={() => copyLink(form)}>
                           {copiedId === form.id ? <Check className="w-3 h-3 mr-1.5" /> : <Copy className="w-3 h-3 mr-1.5" />}
                           {copiedId === form.id ? "Copied" : "Copy"}
                        </Button>
                     </div>
                     <div className="flex items-center gap-2 shrink-0">
                        <Button variant="outline" size="sm" className="rounded-xl h-9 border-slate-200 font-bold px-4" onClick={() => {
                          setEditForm(form);
                          setEditCustomFields(form.customFields ?? []);
                          setEditSectionsConfig(form.sectionsConfig ?? []);
                        }}>
                           <Settings2 className="w-4 h-4 mr-2 text-slate-500" /> Config
                        </Button>
                        <Button size="sm" className="rounded-xl h-9 bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 shadow-lg shadow-slate-200" onClick={() => setViewFormId(form.id)}>
                           Submissions <ChevronRight className="w-3.5 h-3.5 ml-1.5" />
                        </Button>
                     </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) { setCreateCustomFields([]); setCreateFormData({ programId: "", title: "", description: "", deadline: "", loadDefaults: true, customToken: "" }); } }}>
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
            <div className="space-y-1.5">
              <Label>Custom Link Code (optional)</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap bg-muted px-3 py-2 rounded-md border">{window.location.origin}/apply/</span>
                <Input placeholder="e.g., JULY2026"
                  value={createFormData.customToken} onChange={(e) => setCreateFormData((f) => ({ ...f, customToken: e.target.value.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase() }))} />
              </div>
              <p className="text-xs text-muted-foreground">Leave blank to auto-generate a random link.</p>
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
                  {createCustomFields.map((cf, idx) => (
                    <CustomFieldEditor
                      key={cf.id}
                      field={cf}
                      isFirst={idx === 0}
                      isLast={idx === createCustomFields.length - 1}
                      onMoveUp={() => {
                        const newFields = [...createCustomFields];
                        [newFields[idx - 1], newFields[idx]] = [newFields[idx], newFields[idx - 1]];
                        setCreateCustomFields(newFields);
                      }}
                      onMoveDown={() => {
                        const newFields = [...createCustomFields];
                        [newFields[idx + 1], newFields[idx]] = [newFields[idx], newFields[idx + 1]];
                        setCreateCustomFields(newFields);
                      }}
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
                customToken: createFormData.customToken || undefined,
              })}>
              {createMutation.isPending ? "Creating…" : "Create & Get Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit / Configure Dialog */}
      <Dialog open={editForm !== null} onOpenChange={(o) => { if (!o) { setEditForm(null); setEditCustomFields([]); setGoogleSheetsConfig({ spreadsheetId: "", sheetName: "Form Responses 1", serviceAccountJson: "" }); } }}>
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
                          const res = await api.get<any[]>("/application-forms/default-sections");
                          setEditSectionsConfig(res);
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
                                          <X className="h-3 w-3" />
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
                    {editCustomFields.map((cf, idx) => (
                      <CustomFieldEditor
                        key={cf.id}
                        field={cf}
                        isFirst={idx === 0}
                        isLast={idx === editCustomFields.length - 1}
                        onMoveUp={() => {
                          const newFields = [...editCustomFields];
                          [newFields[idx - 1], newFields[idx]] = [newFields[idx], newFields[idx - 1]];
                          setEditCustomFields(newFields);
                        }}
                        onMoveDown={() => {
                          const newFields = [...editCustomFields];
                          [newFields[idx + 1], newFields[idx]] = [newFields[idx], newFields[idx + 1]];
                          setEditCustomFields(newFields);
                        }}
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

      {/* Manual Entry Dialog */}
      <Dialog open={manualEntryOpen} onOpenChange={setManualEntryOpen}>
        <DialogContent className="max-w-4xl rounded-[40px] p-0 border-none bg-slate-50 overflow-hidden shadow-2xl">
          <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/30">
                <UserPlus className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tight">Administrative Registration</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Manual Candidate Submission Interface</p>
              </div>
            </div>
            <Button variant="ghost" onClick={() => setManualEntryOpen(false)} className="text-slate-400 hover:text-white rounded-full h-12 w-12 p-0"><X className="h-6 h-6" /></Button>
          </div>

          <div className="p-10 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Full Identity</Label>
                <Input 
                  value={manualEntryData.fullName} 
                  onChange={e => setManualEntryData({...manualEntryData, fullName: e.target.value})}
                  placeholder="DR. JOHN DOE"
                  className="rounded-2xl border-slate-200 h-12 font-black uppercase text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Email Protocol</Label>
                <Input 
                  value={manualEntryData.email} 
                  onChange={e => setManualEntryData({...manualEntryData, email: e.target.value})}
                  placeholder="CANDIDATE@DOMAIN.COM"
                  className="rounded-2xl border-slate-200 h-12 font-black uppercase text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Contact Sequence</Label>
                <Input 
                  value={manualEntryData.phone} 
                  onChange={e => setManualEntryData({...manualEntryData, phone: e.target.value})}
                  placeholder="+91 00000 00000"
                  className="rounded-2xl border-slate-200 h-12 font-black uppercase text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Track Specialization</Label>
                  <Select 
                    value={manualEntryData.specialization} 
                    onValueChange={v => setManualEntryData({...manualEntryData, specialization: v})}
                  >
                    <SelectTrigger className="rounded-2xl border-slate-200 h-12 font-black uppercase text-xs">
                      <SelectValue placeholder="CHOOSE SPECIALIZATION" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {specialities.map(s => (
                        <SelectItem key={s.id} value={s.name} className="font-bold">{s.name.toUpperCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
               </div>
               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Lifecycle Status</Label>
                  <Select 
                    value={manualEntryData.status} 
                    onValueChange={v => setManualEntryData({...manualEntryData, status: v})}
                  >
                    <SelectTrigger className="rounded-2xl border-slate-200 h-12 font-black uppercase text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="pending" className="font-bold">PENDING REVIEW</SelectItem>
                      <SelectItem value="approved" className="font-bold">APPROVED / ACTIVE</SelectItem>
                      <SelectItem value="rejected" className="font-bold">REJECTED / INACTIVE</SelectItem>
                    </SelectContent>
                  </Select>
               </div>
            </div>

            <div className="h-px bg-slate-200" />

            <div className="space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 w-fit px-3 py-1 rounded-lg">
                   <Wallet className="w-3.5 h-3.5" /> Payment Intelligence (Mandatory)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Razorpay Payment ID</Label>
                      <Input 
                        value={manualEntryData.paymentId} 
                        onChange={e => setManualEntryData({...manualEntryData, paymentId: e.target.value})}
                        placeholder="PAY_XXXXXXXXXXXXXXXX"
                        className="rounded-2xl border-slate-200 h-12 font-black uppercase text-xs"
                      />
                   </div>
                   <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Amount Paid (INR)</Label>
                      <Input 
                        type="number"
                        value={manualEntryData.paidAmount} 
                        onChange={e => setManualEntryData({...manualEntryData, paidAmount: e.target.value})}
                        placeholder="1000"
                        className="rounded-2xl border-slate-200 h-12 font-black text-xs"
                      />
                   </div>
                   <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Payment Mode</Label>
                      <Select 
                        value={manualEntryData.paymentMode} 
                        onValueChange={v => setManualEntryData({...manualEntryData, paymentMode: v})}
                      >
                        <SelectTrigger className="rounded-2xl border-slate-200 h-12 font-black uppercase text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          <SelectItem value="Online" className="font-bold">Online / Razorpay</SelectItem>
                          <SelectItem value="GPay / PhonePe" className="font-bold">GPay / PhonePe</SelectItem>
                          <SelectItem value="Bank Transfer" className="font-bold">Bank Transfer / NEFT</SelectItem>
                        </SelectContent>
                      </Select>
                   </div>
                </div>
             </div>

            <div className="h-px bg-slate-200" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 w-fit px-3 py-1 rounded-lg">
                     <MonitorCheck className="w-3.5 h-3.5" /> Medical History & Qualifications
                  </div>
                  <Textarea 
                    value={manualEntryData.medicalHistory} 
                    onChange={e => setManualEntryData({...manualEntryData, medicalHistory: e.target.value})}
                    placeholder="Enter relevant medical background..."
                    className="rounded-2xl border-slate-200 min-h-[120px] text-xs font-medium"
                  />
                  <Textarea 
                    value={manualEntryData.education} 
                    onChange={e => setManualEntryData({...manualEntryData, education: e.target.value})}
                    placeholder="Academic credentials (MBBS, MS/MD)..."
                    className="rounded-2xl border-slate-200 min-h-[120px] text-xs font-medium"
                  />
               </div>
               <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 w-fit px-3 py-1 rounded-lg">
                     <LayoutGrid className="w-3.5 h-3.5" /> Clinical & Academic Research
                  </div>
                  <Textarea 
                    value={manualEntryData.experience} 
                    onChange={e => setManualEntryData({...manualEntryData, experience: e.target.value})}
                    placeholder="Clinical experience & residency details..."
                    className="rounded-2xl border-slate-200 min-h-[120px] text-xs font-medium"
                  />
                  <Textarea 
                    value={manualEntryData.publications} 
                    onChange={e => setManualEntryData({...manualEntryData, publications: e.target.value})}
                    placeholder="Publications, Presentations & Research work..."
                    className="rounded-2xl border-slate-200 min-h-[120px] text-xs font-medium"
                  />
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Letter of Recommendation (LOR)</Label>
                  <Textarea 
                    value={manualEntryData.lor} 
                    onChange={e => setManualEntryData({...manualEntryData, lor: e.target.value})}
                    placeholder="Paste LOR content or references..."
                    className="rounded-2xl border-slate-200 min-h-[100px] text-xs font-medium"
                  />
               </div>
               <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Photo Reference URL</Label>
                    <Input 
                      value={manualEntryData.photoUrl} 
                      onChange={e => setManualEntryData({...manualEntryData, photoUrl: e.target.value})}
                      placeholder="HTTPS://DRIVE.GOOGLE.COM/FILE/..."
                      className="rounded-2xl border-slate-200 h-10 font-mono text-[10px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">CV / Document Link</Label>
                    <Input 
                      value={manualEntryData.cvUrl} 
                      onChange={e => setManualEntryData({...manualEntryData, cvUrl: e.target.value})}
                      placeholder="HTTPS://DRIVE.GOOGLE.COM/FILE/..."
                      className="rounded-2xl border-slate-200 h-10 font-mono text-[10px]"
                    />
                  </div>
               </div>
            </div>
          </div>

          <div className="p-8 bg-white border-t flex justify-end gap-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] relative z-10">
            <Button variant="ghost" className="rounded-2xl px-10 h-14 font-black uppercase tracking-widest text-[11px] hover:bg-slate-100 transition-all" onClick={() => setManualEntryOpen(false)}>Discard Entry</Button>
            <Button 
              className="rounded-2xl bg-slate-900 hover:bg-primary px-12 h-14 font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-slate-900/20 active:scale-95 transition-all gap-3"
              disabled={createManualSubmission.isPending || !manualEntryData.fullName || !manualEntryData.email}
              onClick={() => {
                if (!manualEntryData.paymentId || !manualEntryData.paidAmount) {
                  toast({ title: "Missing Information", description: "Payment ID and Amount are mandatory for manual submission.", variant: "destructive" });
                  return;
                }
                
                // Map frontend names to DB schema names before mutation
                const dbPayload = {
                  ...manualEntryData,
                  medicalConditions: manualEntryData.medicalHistory,
                  pgQualifications: manualEntryData.education,
                  surgicalExperience: manualEntryData.experience,
                  publications: manualEntryData.publications,
                  lor1Url: manualEntryData.lor,
                  photoUrl: manualEntryData.photoUrl,
                  paymentUrl: manualEntryData.cvUrl, // Re-purposing for CV link
                  paymentId: manualEntryData.paymentId,
                  paidAmount: parseInt(manualEntryData.paidAmount),
                  paymentMode: manualEntryData.paymentMode,
                  declarationAccepted: true
                };
                createManualSubmission.mutate(dbPayload);
              }}>
              {createManualSubmission.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Commit Submission to Registry
            </Button>
          </div>
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


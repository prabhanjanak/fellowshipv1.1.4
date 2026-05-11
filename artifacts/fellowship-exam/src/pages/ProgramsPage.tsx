import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Badge } from "../components/ui/badge";
import { Plus, GraduationCap, Users, Star, Trash2, Edit2, FileText, Loader2 } from "lucide-react";
import { useToast } from "../hooks/use-toast";

interface Program {
  id: number;
  name: string;
  code: string;
  description: string | null;
  academicYear: string;
  offerLetterTemplateId: string | null;
  totalSeats: number;
  specialityCount: number;
  candidateCount: number;
}

export default function ProgramsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editProgram, setEditProgram] = useState<Program | null>(null);
  const canManage = ["super_admin", "program_admin"].includes(user?.role ?? "");
  const [form, setForm] = useState({ name: "", code: "", description: "", academicYear: "2026", offerLetterTemplateId: "" });

  const { data: programs = [], isLoading } = useQuery<Program[]>({
    queryKey: ["programs"],
    queryFn: () => api.get<Program[]>("/programs"),
  });

  const addMutation = useMutation({
    mutationFn: (data: typeof form) => api.post<Program>("/programs", data),
    onSuccess: () => {
      toast({ title: "Program created" });
      qc.invalidateQueries({ queryKey: ["programs"] });
      setAddOpen(false);
      setForm({ name: "", code: "", description: "", academicYear: "2026", offerLetterTemplateId: "" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Program>) => api.patch<Program>(`/programs/${data.id}`, data),
    onSuccess: () => {
      toast({ title: "Program updated" });
      qc.invalidateQueries({ queryKey: ["programs"] });
      setEditProgram(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/programs/${id}`),
    onSuccess: () => {
      toast({ title: "Program deleted" });
      qc.invalidateQueries({ queryKey: ["programs"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">PROGRAMS</h1>
          <p className="text-muted-foreground text-sm uppercase tracking-widest">{programs.length} active fellowship programs</p>
        </div>
        {canManage && (
          <Button onClick={() => setAddOpen(true)} className="gap-2 font-black uppercase tracking-widest text-xs">
            <Plus className="h-4 w-4" /> Add Program
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
      ) : programs.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-xl">
          <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
          <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">No programs configured yet</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {programs.map((p) => (
            <Card key={p.id} className="hover:shadow-xl transition-all relative group border-slate-200 overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-black tracking-tight text-slate-800 uppercase">{p.name}</CardTitle>
                    <p className="text-xs font-bold text-slate-500 line-clamp-1">{p.description || "No description provided."}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-slate-100 text-slate-600 border-slate-200">{p.academicYear}</Badge>
                    {canManage && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-primary hover:bg-primary/5"
                          onClick={() => setEditProgram(p)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50"
                          onClick={() => {
                            if (confirm("Delete this program? This action is irreversible.")) {
                              deleteMutation.mutate(p.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Specialities</span>
                    <span className="text-lg font-black text-slate-800">{p.specialityCount}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Candidates</span>
                    <span className="text-lg font-black text-slate-800">{p.candidateCount}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Seats</span>
                    <span className="text-lg font-black text-slate-800">{p.totalSeats}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between border-t pt-3 border-slate-100">
                  <div className="flex items-center gap-2">
                    <FileText className={`h-4 w-4 ${p.offerLetterTemplateId ? "text-emerald-500" : "text-slate-300"}`} />
                    <span className="text-[10px] font-bold uppercase tracking-tight text-slate-500">
                      {p.offerLetterTemplateId ? "Custom Template Linked" : "Using Default Template"}
                    </span>
                  </div>
                  <code className="text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded tracking-widest">{p.code}</code>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-black text-xl uppercase tracking-tight">ADD NEW PROGRAM</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="font-black text-[10px] uppercase tracking-widest">Program Name</Label>
              <Input placeholder="e.g. Fellowship Program July 2026" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase tracking-widest">Program Code</Label>
                <Input placeholder="FP-2026" value={form.code} onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase tracking-widest">Academic Year</Label>
                <Input placeholder="2026" value={form.academicYear} onChange={(e) => setForm(f => ({ ...f, academicYear: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-black text-[10px] uppercase tracking-widest text-primary">Google Doc Template ID (Optional)</Label>
              <Input 
                placeholder="1aBc2DeFg..." 
                value={form.offerLetterTemplateId} 
                onChange={(e) => setForm(f => ({ ...f, offerLetterTemplateId: e.target.value }))} 
                className="border-primary/20 bg-primary/5"
              />
              <p className="text-[9px] text-muted-foreground italic">If left empty, the global default template will be used.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} className="font-bold uppercase text-[10px]">Cancel</Button>
            <Button
              className="font-black uppercase tracking-widest text-[10px]"
              disabled={!form.name || !form.code || addMutation.isPending}
              onClick={() => addMutation.mutate(form)}
            >
              {addMutation.isPending ? "Creating…" : "Create Program"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editProgram} onOpenChange={() => setEditProgram(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black text-xl uppercase tracking-tight">EDIT PROGRAM</DialogTitle>
            <DialogDescription className="font-bold text-xs uppercase text-slate-400">Update configuration for {editProgram?.name}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
             <div className="space-y-2">
              <Label className="font-black text-[10px] uppercase tracking-widest">Program Name</Label>
              <Input value={editProgram?.name || ""} onChange={(e) => setEditProgram(p => p ? { ...p, name: e.target.value } : null)} />
            </div>
            <div className="space-y-2">
              <Label className="font-black text-[10px] uppercase tracking-widest">Description</Label>
              <Input value={editProgram?.description || ""} onChange={(e) => setEditProgram(p => p ? { ...p, description: e.target.value } : null)} />
            </div>
            <div className="space-y-2">
              <Label className="font-black text-[10px] uppercase tracking-widest text-primary">Google Doc Template ID</Label>
              <Input 
                placeholder="Leave empty for global default" 
                value={editProgram?.offerLetterTemplateId || ""} 
                onChange={(e) => setEditProgram(p => p ? { ...p, offerLetterTemplateId: e.target.value } : null)}
                className="border-primary/20 bg-primary/5"
              />
              <p className="text-[9px] text-muted-foreground italic">Overrides the global template for this specific program.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProgram(null)} className="font-bold uppercase text-[10px]">Cancel</Button>
            <Button
              className="font-black uppercase tracking-widest text-[10px]"
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate(editProgram!)}
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Plus, BookOpen, Clock, HelpCircle, Trash2 } from "lucide-react";
import { useToast } from "../hooks/use-toast";

interface Exam {
  id: number;
  title: string;
  kind: string;
  programId: number | null;
  programName: string | null;
  durationMinutes: number;
  totalQuestions: number;
  questionCount: number;
  passingScore: number | null;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

export default function ExamsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [addOpen, setAddOpen] = useState(false);

  const [form, setForm] = useState({
    title: "", kind: "mcq", programId: "", durationMinutes: "60",
    totalQuestions: "20", passingScore: "", description: "",
  });

  const { data: exams = [], isLoading } = useQuery<Exam[]>({
    queryKey: ["exams"],
    queryFn: () => api.get<Exam[]>("/exams"),
  });

  const addMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Exam>("/exams", data),
    onSuccess: () => {
      toast({ title: "Exam created" });
      qc.invalidateQueries({ queryKey: ["exams"] });
      setAddOpen(false);
      setForm({ title: "", kind: "mcq", programId: "", durationMinutes: "60", totalQuestions: "20", passingScore: "", description: "" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/exams/${id}`),
    onSuccess: () => {
      toast({ title: "Exam deleted" });
      qc.invalidateQueries({ queryKey: ["exams"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const canManage = user?.role === "super_admin" || user?.role === "program_admin" || user?.role === "central_exam_coordinator";

  const kindLabel: Record<string, string> = {
    mcq: "MCQ", psychometric: "Psychometric", written: "Written",
  };

  const kindColor: Record<string, string> = {
    mcq: "bg-blue-100 text-blue-800",
    psychometric: "bg-purple-100 text-purple-800",
    written: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Exams</h1>
          <p className="text-muted-foreground text-sm mt-1">{exams.length} exams configured</p>
        </div>
        {canManage && (
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Create Exam
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading exams…</div>
      ) : exams.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No exams found</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {exams.map((e) => (
            <Card 
              key={e.id} 
              className="hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => navigate(`/exams/${e.id}`)}
            >
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm leading-tight">{e.title}</h3>
                  <div className="flex items-center gap-1">
                    <Badge className={kindColor[e.kind] ?? "bg-gray-100 text-gray-800"} variant="secondary">
                      {kindLabel[e.kind] ?? e.kind}
                    </Badge>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(evt) => {
                          evt.stopPropagation();
                          if (confirm(`Are you sure you want to delete "${e.title}"?`)) {
                            deleteMutation.mutate(e.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {e.programName && (
                  <p className="text-xs text-muted-foreground">{e.programName}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{e.durationMinutes} min</span>
                  <span className="flex items-center gap-1"><HelpCircle className="h-3 w-3" />{e.questionCount}/{e.totalQuestions} Q</span>
                </div>
                {e.startsAt && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(e.startsAt).toLocaleDateString("en-IN")}
                    {e.endsAt ? ` – ${new Date(e.endsAt).toLocaleDateString("en-IN")}` : ""}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <Badge variant={e.active ? "default" : "secondary"} className="text-[10px]">
                    {e.active ? "Active" : "Inactive"}
                  </Badge>
                  {e.passingScore != null && (
                    <span className="text-[10px] text-muted-foreground">Pass: {e.passingScore}%</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Exam</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input placeholder="Fellowship Entrance Exam MCQ" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={form.kind} onValueChange={(v) => setForm((f) => ({ ...f, kind: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mcq">MCQ</SelectItem>
                    <SelectItem value="psychometric">Psychometric</SelectItem>
                    <SelectItem value="written">Written</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Duration (min)</Label>
                <Input type="number" value={form.durationMinutes} onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Total Questions</Label>
                <Input type="number" value={form.totalQuestions} onChange={(e) => setForm((f) => ({ ...f, totalQuestions: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Passing Score (%)</Label>
                <Input type="number" placeholder="Optional" value={form.passingScore} onChange={(e) => setForm((f) => ({ ...f, passingScore: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description (optional)</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              disabled={!form.title || !form.kind || addMutation.isPending}
              onClick={() => addMutation.mutate({
                title: form.title,
                kind: form.kind,
                durationMinutes: Number(form.durationMinutes),
                totalQuestions: Number(form.totalQuestions),
                passingScore: form.passingScore ? Number(form.passingScore) : null,
                description: form.description || null,
              })}
            >
              {addMutation.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


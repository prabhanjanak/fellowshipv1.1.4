import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Checkbox } from "../components/ui/checkbox";
import { Badge } from "../components/ui/badge";
import {
  Loader2,
  Plus,
  Users,
  Calendar,
  Clock,
  ClipboardCheck,
  Trophy,
  ArrowRight,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { api } from "../lib/api";

export default function BatchesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedCandidates, setSelectedCandidates] = useState<number[]>([]);
  const [viewingBatchId, setViewingBatchId] = useState<number | null>(null);
  const [marksDialogOpen, setMarksDialogOpen] = useState(false);
  const [marksUpdates, setMarksUpdates] = useState<Record<number, { mcq?: string; psych?: string; interview?: string }>>({});

  // Queries
  const { data: batches = [], isLoading: isLoadingBatches } = useQuery({
    queryKey: ["batches"],
    queryFn: () => api.get<any[]>("/batches"),
  });

  const { data: candidates = [], isLoading: isLoadingCandidates } = useQuery({
    queryKey: ["candidates"],
    queryFn: () => api.get<any[]>("/candidates"),
  });

  const { data: programs = [] } = useQuery({
    queryKey: ["programs"],
    queryFn: () => api.get<any[]>("/programs"),
  });

  const { data: batchCandidates = [] } = useQuery({
    queryKey: ["batch-candidates", viewingBatchId],
    queryFn: () => api.get<any[]>(`/batches/${viewingBatchId}/candidates`),
    enabled: !!viewingBatchId,
  });

  // Approved candidates not in a batch (simplified for now)
  const approvedCandidates = candidates.filter((c: any) => c.status === "approved" || c.status === "pending");

  // Mutations
  const createBatchMutation = useMutation({
    mutationFn: (newBatch: any) => api.post("/batches", newBatch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      setIsCreateDialogOpen(false);
      toast({ title: "Success", description: "Batch created successfully" });
    },
  });

  const assignCandidatesMutation = useMutation({
    mutationFn: ({ batchId, candidateIds }: { batchId: number; candidateIds: number[] }) => 
      api.post(`/batches/${batchId}/candidates`, { candidateIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      setSelectedCandidates([]);
      toast({ title: "Success", description: "Candidates assigned to batch" });
    },
  });

  const deleteBatchMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/batches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      toast({ title: "Batch deleted" });
      if (viewingBatchId === deleteBatchMutation.variables) setViewingBatchId(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMarksMutation = useMutation({
    mutationFn: (data: { batchId: number; updates: any[] }) => 
      api.patch(`/batches/${data.batchId}/marks`, { updates: data.updates }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      queryClient.invalidateQueries({ queryKey: ["batch-candidates", viewingBatchId] });
      setMarksDialogOpen(false);
      toast({ title: "Marks updated successfully" });
    },
  });

  const handleCreateBatch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name"),
      segment: formData.get("segment"),
      date: formData.get("date"),
      timing: formData.get("timing"),
      venue: formData.get("venue"),
      programId: parseInt(formData.get("programId") as string),
      mcqTotalMarks: parseFloat(formData.get("mcqTotal") as string),
      psychometricTotalMarks: parseFloat(formData.get("psychTotal") as string),
      interviewTotalMarks: parseFloat(formData.get("interviewTotal") as string),
    };
    createBatchMutation.mutate(data);
  };

  if (isLoadingBatches) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Batch Management</h1>
          <p className="text-muted-foreground">Create and manage candidate batches for exams and interviews.</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Create New Batch
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleCreateBatch}>
              <DialogHeader>
                <DialogTitle>Create Examination Batch</DialogTitle>
                <DialogDescription>
                  Define the batch details and set the total marks for each component.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Input id="name" name="name" placeholder="July 2026 - Group A" className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="segment" className="text-right">Segment</Label>
                  <select name="segment" className="col-span-3 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" required>
                    <option value="Retina">Retina</option>
                    <option value="Anterior Segment">Anterior Segment</option>
                    <option value="General">General</option>
                  </select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="date" className="text-right">Exam Date</Label>
                  <Input id="date" name="date" type="date" className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="timing" className="text-right">Timing</Label>
                  <Input id="timing" name="timing" placeholder="09:00 AM - 01:00 PM" className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="venue" className="text-right">Venue</Label>
                  <Input id="venue" name="venue" defaultValue="SEH, Bangalore" className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="programId" className="text-right">Program</Label>
                  <select name="programId" className="col-span-3 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" required>
                    {programs.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold mb-3">Marks Configuration</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="mcqTotal" className="text-xs">MCQ Total</Label>
                      <Input id="mcqTotal" name="mcqTotal" type="number" defaultValue="50" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="psychTotal" className="text-xs">Psych Total</Label>
                      <Input id="psychTotal" name="psychTotal" type="number" defaultValue="50" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="interviewTotal" className="text-xs">Interview Total</Label>
                      <Input id="interviewTotal" name="interviewTotal" type="number" defaultValue="100" required />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createBatchMutation.isPending}>
                  {createBatchMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Batch
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Batches List */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" /> Active Batches
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch Name / Segment</TableHead>
                    <TableHead>Date / Venue</TableHead>
                    <TableHead className="text-center">Candidates</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No batches created yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    batches.map((batch: any) => (
                      <TableRow key={batch.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => setViewingBatchId(batch.id)}>
                        <TableCell>
                          <div className="font-medium">{batch.name}</div>
                          <Badge variant="outline" className="text-[10px] mt-1">{batch.segment || "General"}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Calendar className="h-3.5 w-3.5" /> {new Date(batch.date).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                            <Building2 className="h-3.5 w-3.5" /> {batch.venue || "SEH, Bangalore"}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="font-mono">
                            {batch.candidateCount || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-blue-600 hover:bg-blue-50"
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setViewingBatchId(batch.id);
                                setMarksDialogOpen(true);
                              }}
                              title="Enter Offline Marks"
                            >
                              <Trophy className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setViewingBatchId(batch.id); }}>
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Are you sure you want to delete batch "${batch.name}"?`)) {
                                  deleteBatchMutation.mutate(batch.id);
                                }
                              }}
                              disabled={deleteBatchMutation.isPending}
                            >
                              {deleteBatchMutation.isPending && deleteBatchMutation.variables === batch.id ? 
                                <Loader2 className="h-4 w-4 animate-spin" /> : 
                                <Trash2 className="h-4 w-4" />
                              }
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Candidate Assignment */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Approved Candidates
              </CardTitle>
              <CardDescription>Select students to assign to the current batch.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-y-auto px-6 pb-6 space-y-2">
                {approvedCandidates.length === 0 ? (
                  <p className="text-sm text-center py-8 text-muted-foreground">No approved candidates available.</p>
                ) : (
                  approvedCandidates.map((candidate: any) => (
                    <div key={candidate.id} className="flex items-center space-x-3 p-3 rounded-lg border hover:border-primary/50 transition-colors">
                      <Checkbox
                        id={`c-${candidate.id}`}
                        checked={selectedCandidates.includes(candidate.id)}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedCandidates([...selectedCandidates, candidate.id]);
                          else setSelectedCandidates(selectedCandidates.filter(id => id !== candidate.id));
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <Label htmlFor={`c-${candidate.id}`} className="text-sm font-semibold truncate block cursor-pointer">
                          {candidate.fullName}
                        </Label>
                        <p className="text-[10px] text-muted-foreground truncate">{candidate.email}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 bg-muted/30 border-t">
                <select
                  className="w-full mb-3 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  onChange={(e) => setViewingBatchId(parseInt(e.target.value))}
                  value={viewingBatchId || ""}
                >
                  <option value="">Select Target Batch...</option>
                  {batches.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <Button
                  className="w-full gap-2"
                  disabled={selectedCandidates.length === 0 || !viewingBatchId || assignCandidatesMutation.isPending}
                  onClick={() => assignCandidatesMutation.mutate({ batchId: viewingBatchId!, candidateIds: selectedCandidates })}
                >
                  {assignCandidatesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add {selectedCandidates.length} to Batch
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Offline Marks Entry Dialog */}
      <Dialog open={marksDialogOpen} onOpenChange={setMarksDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-blue-600" />
              Enter Offline Marks
            </DialogTitle>
            <DialogDescription>
              Enter evaluation marks for candidates in this batch.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead className="w-24">MCQ</TableHead>
                  <TableHead className="w-24">Psych</TableHead>
                  <TableHead className="w-24">Interview</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batchCandidates.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-4">No candidates in batch</TableCell></TableRow>
                ) : (
                  batchCandidates.map((bc: any) => (
                    <TableRow key={bc.candidateId}>
                      <TableCell>
                        <div className="font-medium text-sm">{bc.candidateName}</div>
                        <div className="text-[10px] text-muted-foreground">{bc.candidateCode}</div>
                      </TableCell>
                      <TableCell>
                        <Input 
                          type="number" 
                          className="h-8 text-xs" 
                          defaultValue={bc.mcqScore ?? ""}
                          onChange={(e) => setMarksUpdates(prev => ({
                            ...prev,
                            [bc.candidateId]: { ...prev[bc.candidateId], mcq: e.target.value }
                          }))}
                        />
                      </TableCell>
                      <TableCell>
                        <Input 
                          type="number" 
                          className="h-8 text-xs" 
                          defaultValue={bc.psychometricScore ?? ""}
                          onChange={(e) => setMarksUpdates(prev => ({
                            ...prev,
                            [bc.candidateId]: { ...prev[bc.candidateId], psych: e.target.value }
                          }))}
                        />
                      </TableCell>
                      <TableCell>
                        <Input 
                          type="number" 
                          className="h-8 text-xs" 
                          defaultValue={bc.interviewScore ?? ""}
                          onChange={(e) => setMarksUpdates(prev => ({
                            ...prev,
                            [bc.candidateId]: { ...prev[bc.candidateId], interview: e.target.value }
                          }))}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarksDialogOpen(false)}>Cancel</Button>
            <Button 
              disabled={updateMarksMutation.isPending || batchCandidates.length === 0}
              onClick={() => {
                const updates = Object.entries(marksUpdates).map(([cid, vals]) => ({
                  candidateId: parseInt(cid),
                  mcqScore: vals.mcq ? parseFloat(vals.mcq) : undefined,
                  psychometricScore: vals.psych ? parseFloat(vals.psych) : undefined,
                  interviewScore: vals.interview ? parseFloat(vals.interview) : undefined,
                }));
                if (updates.length > 0) {
                  updateMarksMutation.mutate({ batchId: viewingBatchId!, updates });
                } else {
                  setMarksDialogOpen(false);
                }
              }}
            >
              {updateMarksMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save All Marks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


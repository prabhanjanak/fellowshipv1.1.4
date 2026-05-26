import { useEffect, useState } from "react";
import { fmtDate, fmtTime } from "../lib/dateUtils";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Loader2, Monitor, CheckCircle2, Clock } from "lucide-react";
import logoUrl from "../assets/seh_sav_logo_1777703794142.jpg";

interface QueueItem { candidateCode: string; }
interface PanelDisplay {
  panelId: number;
  panelName: string;
  roomNumber: string;
  isActive: boolean;
  current: { candidateCode: string; calledAt: string } | null;
  nextQueue: QueueItem[];
}

function useTime() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return t;
}

export default function DisplayPage() {
  const { user } = useAuth();
  const now = useTime();

  const { data: panels = [], isLoading, error } = useQuery<PanelDisplay[]>({
    queryKey: ["display-live"],
    queryFn: () => api.get<PanelDisplay[]>("/display/live"),
    refetchInterval: 5000,
  });

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src={logoUrl} alt="SAV" className="h-12 w-12 rounded-xl object-contain bg-white p-1.5" />
          <div>
            <h1 className="text-xl font-bold text-white">Sankara Academy of Vision</h1>
            <p className="text-sm text-gray-400">Fellowship Interview — Waiting Hall Display</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-mono font-bold text-blue-400">
            {fmtTime(now)}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {fmtDate(now)}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
            <p className="text-gray-400 text-lg">Loading panel status…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64">
            <p className="text-red-400 text-lg">Unable to load panel data. Please check connection.</p>
          </div>
        ) : panels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Monitor className="h-16 w-16 text-gray-700" />
            <p className="text-gray-500 text-xl">No active interview panels configured</p>
            <p className="text-gray-600 text-sm">Panels will appear here once they are set up in the admin panel</p>
          </div>
        ) : (
          <div className={`grid gap-6 ${panels.length === 1 ? "grid-cols-1 max-w-lg mx-auto" : panels.length === 2 ? "grid-cols-2" : panels.length <= 4 ? "grid-cols-2 lg:grid-cols-2" : "grid-cols-2 lg:grid-cols-3"}`}>
            {panels.map((p) => (
              <PanelCard key={p.panelId} panel={p} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-900 border-t border-gray-800 px-8 py-2 flex items-center justify-between">
        <p className="text-xs text-gray-600">Refreshes every 5 seconds · Sankara Eye Care Institutions</p>
        <div className="flex items-center gap-2 text-xs text-emerald-500">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </div>
      </div>
    </div>
  );
}

function PanelCard({ panel }: { panel: PanelDisplay }) {
  const hasCurrent = !!panel.current;
  const nextList = panel.nextQueue.slice(0, 3);

  return (
    <div className={`rounded-2xl border-2 overflow-hidden transition-all duration-500 ${
      hasCurrent
        ? "border-blue-500 bg-gradient-to-b from-blue-950/60 to-gray-900"
        : "border-gray-700 bg-gray-900"
    }`}>
      {/* Room header */}
      <div className={`px-6 py-3 flex items-center justify-between ${hasCurrent ? "bg-blue-900/40" : "bg-gray-800/50"}`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Room</p>
          <p className="text-2xl font-bold text-white">{panel.roomNumber}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">{panel.panelName}</p>
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mt-1 ${
            hasCurrent ? "bg-blue-500/20 text-blue-300" : "bg-green-500/20 text-green-400"
          }`}>
            <div className={`h-1.5 w-1.5 rounded-full ${hasCurrent ? "bg-blue-400 animate-pulse" : "bg-green-400"}`} />
            {hasCurrent ? "In Session" : "Available"}
          </div>
        </div>
      </div>

      {/* Current candidate */}
      <div className="px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Now Interviewing</p>
        {hasCurrent ? (
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <p className="text-3xl font-bold font-mono tracking-wider text-white">{panel.current!.candidateCode}</p>
              {panel.current!.calledAt && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Called at {fmtTime(panel.current!.calledAt)}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 opacity-50">
            <div className="h-12 w-12 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center">
              <Clock className="h-6 w-6 text-gray-500" />
            </div>
            <p className="text-xl font-medium text-gray-500">—</p>
          </div>
        )}
      </div>

      {/* Next queue */}
      {nextList.length > 0 && (
        <div className="px-6 pb-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Next in Queue</p>
          <div className="flex flex-wrap gap-2">
            {nextList.map((q, i) => (
              <div key={q.candidateCode} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-mono ${
                i === 0
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                  : "bg-gray-800 border-gray-700 text-gray-400"
              }`}>
                <span className="text-[10px] font-sans font-medium opacity-60">{i + 1}</span>
                {q.candidateCode}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


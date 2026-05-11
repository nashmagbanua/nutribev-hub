/**
 * PPERequest.tsx
 * Route: /ppe
 *
 * Supabase table required:
 * CREATE TABLE ppe_requests (
 *   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   company_id text NOT NULL,
 *   employee_name text NOT NULL,
 *   items jsonb NOT NULL DEFAULT '[]',
 *   urgency text NOT NULL DEFAULT 'normal',
 *   notes text,
 *   status text NOT NULL DEFAULT 'pending',
 *   requested_at timestamptz DEFAULT now(),
 *   reviewed_by text,
 *   reviewed_at timestamptz
 * );
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase, formatPH, type PPERequest, type PPEItem } from "@/lib/supabase";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ShieldCheck, Plus, Trash2, AlertTriangle, Clock,
  CheckCircle2, XCircle, Package, ChevronDown, ChevronUp,
  HardHat, Shirt,
} from "lucide-react";

// ─── PPE catalogue ────────────────────────────────────────────────────────────

const PPE_CATALOGUE: { category: string; items: { name: string; hasSizes: boolean; sizes?: string[] }[] }[] = [
  {
    category: "Head Protection",
    items: [
      { name: "Hard Hat / Safety Helmet", hasSizes: false },
      { name: "Bump Cap", hasSizes: false },
    ],
  },
  {
    category: "Eye & Face Protection",
    items: [
      { name: "Safety Glasses", hasSizes: false },
      { name: "Face Shield", hasSizes: false },
      { name: "Goggles (Chemical Splash)", hasSizes: false },
    ],
  },
  {
    category: "Hearing Protection",
    items: [
      { name: "Ear Plugs (Disposable)", hasSizes: false },
      { name: "Ear Muffs", hasSizes: false },
    ],
  },
  {
    category: "Respiratory Protection",
    items: [
      { name: "Dust Mask (N95)", hasSizes: false },
      { name: "Half-face Respirator", hasSizes: true, sizes: ["S", "M", "L"] },
    ],
  },
  {
    category: "Hand Protection",
    items: [
      { name: "Rubber Gloves", hasSizes: true, sizes: ["S", "M", "L", "XL"] },
      { name: "Cut-resistant Gloves", hasSizes: true, sizes: ["S", "M", "L", "XL"] },
      { name: "Chemical-resistant Gloves", hasSizes: true, sizes: ["S", "M", "L", "XL"] },
      { name: "Cotton Work Gloves", hasSizes: true, sizes: ["S", "M", "L", "XL"] },
    ],
  },
  {
    category: "Foot Protection",
    items: [
      { name: "Safety Boots (Steel-toe)", hasSizes: true, sizes: ["38","39","40","41","42","43","44","45"] },
      { name: "Rubber Boots", hasSizes: true, sizes: ["38","39","40","41","42","43","44","45"] },
    ],
  },
  {
    category: "Body Protection",
    items: [
      { name: "Safety Vest (Reflective)", hasSizes: true, sizes: ["S", "M", "L", "XL", "2XL"] },
      { name: "Chemical Apron", hasSizes: true, sizes: ["S", "M", "L", "XL"] },
      { name: "Coverall / Jumpsuit", hasSizes: true, sizes: ["S", "M", "L", "XL", "2XL"] },
    ],
  },
  {
    category: "Fall Protection",
    items: [
      { name: "Safety Harness", hasSizes: true, sizes: ["S/M", "L/XL"] },
      { name: "Lanyard", hasSizes: false },
    ],
  },
];

const ALL_PPE_NAMES = PPE_CATALOGUE.flatMap(c => c.items.map(i => i.name));
const getPPEItem = (name: string) => PPE_CATALOGUE.flatMap(c => c.items).find(i => i.name === name);

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PPERequest["status"], { label: string; className: string; icon: React.ReactNode }> = {
  pending:  { label: "Pending Review", className: "bg-muted text-muted-foreground border border-border",              icon: <Clock        className="h-3 w-3" /> },
  approved: { label: "Approved",       className: "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30", icon: <CheckCircle2 className="h-3 w-3" /> },
  issued:   { label: "Issued",         className: "bg-primary/15 text-primary border border-primary/30",              icon: <Package      className="h-3 w-3" /> },
  rejected: { label: "Rejected",       className: "bg-destructive/15 text-destructive border border-destructive/30",  icon: <XCircle      className="h-3 w-3" /> },
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function PPERequest() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<PPERequest[]>([]);
  const [items, setItems]       = useState<PPEItem[]>([blankItem()]);
  const [urgency, setUrgency]   = useState<"normal" | "urgent">("normal");
  const [notes, setNotes]       = useState("");
  const [saving, setSaving]     = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  function blankItem(): PPEItem {
    return { ppe_type: "", size: null, quantity: 1, reason: "" };
  }

  const load = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("ppe_requests").select("*")
      .eq("company_id", profile.company_id)
      .order("requested_at", { ascending: false });
    setRequests((data as PPERequest[]) ?? []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profile]);

  // ── Add / remove items ───────────────────────────────────────────────────
  const addItem = () => setItems(prev => [...prev, blankItem()]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, patch: Partial<PPEItem>) =>
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, ...patch } : item));

  // ── Submit ───────────────────────────────────────────────────────────────
  const submit = async () => {
    if (!profile) return;
    for (const [i, item] of items.entries()) {
      if (!item.ppe_type) { toast.error(`Item ${i + 1}: Please select a PPE type.`); return; }
      if (!item.reason.trim()) { toast.error(`Item ${i + 1}: Please provide a reason (e.g. damaged, lost, new issue).`); return; }
      if (item.quantity < 1) { toast.error(`Item ${i + 1}: Quantity must be at least 1.`); return; }
    }
    setSaving(true);
    const { error } = await supabase.from("ppe_requests").insert({
      company_id:    profile.company_id,
      employee_name: profile.full_name,
      items,
      urgency,
      notes:         notes.trim() || null,
      status:        "pending",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("PPE request submitted — Safety Officer will review shortly.");
    setItems([blankItem()]); setUrgency("normal"); setNotes("");
    load();
  };

  // ── Cancel ───────────────────────────────────────────────────────────────
  const cancel = async (id: string) => {
    if (!confirm("Cancel this PPE request?")) return;
    const { error } = await supabase.from("ppe_requests").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Request cancelled."); load();
  };

  if (!profile) return null;

  const active  = requests.filter(r => r.status !== "issued" && r.status !== "rejected");
  const history = requests.filter(r => r.status === "issued" || r.status === "rejected");

  return (
    <div className="min-h-screen gradient-subtle">
      <AppHeader />
      <main className="container py-8 space-y-6 max-w-3xl">

        {/* Title */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" /> PPE Request
          </h1>
          <p className="text-muted-foreground">Request Personal Protective Equipment. The Safety Officer will review and approve.</p>
        </div>

        {/* ── Request form ──────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-card border border-border shadow-soft p-6 space-y-5">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" /> New Request
          </h2>

          {/* Urgency */}
          <div className="flex gap-3">
            {(["normal", "urgent"] as const).map(u => (
              <button key={u} type="button"
                onClick={() => setUrgency(u)}
                className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                  urgency === u
                    ? u === "urgent"
                      ? "bg-destructive/15 border-destructive/40 text-destructive"
                      : "bg-primary/10 border-primary/30 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/30"
                }`}
              >
                {u === "urgent" && <AlertTriangle className="h-4 w-4" />}
                {u === "normal" ? "Normal Priority" : "Urgent — Safety Risk"}
              </button>
            ))}
          </div>
          {urgency === "urgent" && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/30 px-4 py-3 flex items-start gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <span>Urgent requests are flagged to the Safety Officer immediately. Only select this if there is an active safety risk.</span>
            </div>
          )}

          {/* PPE items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">PPE Items *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="rounded-xl">
                <Plus className="h-3.5 w-3.5 mr-1.5" />Add Item
              </Button>
            </div>

            {items.map((item, i) => {
              const catalogue = getPPEItem(item.ppe_type);
              return (
                <div key={i} className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Item {i + 1}</span>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* PPE type select */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">PPE Type *</Label>
                    <Select value={item.ppe_type || "__none__"}
                      onValueChange={v => updateItem(i, { ppe_type: v === "__none__" ? "" : v, size: null })}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select PPE…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Select PPE type —</SelectItem>
                        {PPE_CATALOGUE.map(cat => (
                          <div key={cat.category}>
                            <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider bg-muted/50 sticky top-0">
                              {cat.category}
                            </div>
                            {cat.items.map(ppe => (
                              <SelectItem key={ppe.name} value={ppe.name}>{ppe.name}</SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Size — only shown if this PPE has sizes */}
                    {catalogue?.hasSizes && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Size</Label>
                        <Select value={item.size || "__none__"} onValueChange={v => updateItem(i, { size: v === "__none__" ? null : v })}>
                          <SelectTrigger className="rounded-xl"><SelectValue placeholder="Size…" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Select size —</SelectItem>
                            {(catalogue.sizes ?? []).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {/* Quantity */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Quantity *</Label>
                      <Input
                        type="number" min={1} max={20}
                        value={item.quantity}
                        onChange={e => updateItem(i, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Reason / Condition *</Label>
                    <Input
                      value={item.reason}
                      onChange={e => updateItem(i, { reason: e.target.value })}
                      placeholder="e.g. Damaged, Lost, First issue, Worn out…"
                      className="rounded-xl"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Additional notes */}
          <div className="space-y-1.5">
            <Label>Additional Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any other information for the Safety Officer…"
              rows={2}
              className="rounded-xl resize-none"
            />
          </div>

          <Button onClick={submit} disabled={saving} className="w-full sm:w-auto rounded-xl gradient-primary text-primary-foreground">
            <ShieldCheck className="h-4 w-4 mr-2" />
            {saving ? "Submitting…" : "Submit PPE Request"}
          </Button>
        </div>

        {/* ── Active requests ────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-card border border-border shadow-soft p-6">
          <h2 className="font-bold text-lg flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-primary" /> Active Requests
          </h2>
          {active.length === 0 && (
            <div className="flex flex-col items-center py-8 gap-3 text-muted-foreground">
              <ShieldCheck className="h-12 w-12 opacity-20" />
              <p className="text-sm">No active requests.</p>
            </div>
          )}
          <div className="space-y-3">
            {active.map(r => (
              <RequestCard key={r.id} r={r}
                expanded={expanded === r.id}
                onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
                onCancel={r.status === "pending" ? () => cancel(r.id) : undefined}
              />
            ))}
          </div>
        </div>

        {/* ── History ────────────────────────────────────────────────────── */}
        {history.length > 0 && (
          <div className="rounded-2xl bg-card border border-border shadow-soft p-6">
            <h2 className="font-bold text-lg flex items-center gap-2 mb-4">
              <Package className="h-5 w-5 text-primary" /> History
            </h2>
            <div className="space-y-3 opacity-75">
              {history.map(r => (
                <RequestCard key={r.id} r={r}
                  expanded={expanded === r.id}
                  onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── RequestCard ───────────────────────────────────────────────────────────────

function RequestCard({ r, expanded, onToggle, onCancel }: {
  r: PPERequest; expanded: boolean; onToggle: () => void; onCancel?: () => void;
}) {
  const cfg = STATUS_CONFIG[r.status];
  const items = r.items as PPEItem[];

  return (
    <div className={`rounded-xl border transition-colors ${
      r.urgency === "urgent" ? "border-destructive/30 bg-destructive/5" :
      r.status === "approved" ? "border-emerald-500/30 bg-emerald-500/5" : "border-border"
    }`}>
      {/* Header row */}
      <button onClick={onToggle} className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
            r.urgency === "urgent" ? "bg-destructive/15" : "bg-primary/10"
          }`}>
            <ShieldCheck className={`h-4 w-4 ${r.urgency === "urgent" ? "text-destructive" : "text-primary"}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">
                {items.length} item{items.length !== 1 ? "s" : ""} — {items.map(i => i.ppe_type).join(", ")}
              </span>
              {r.urgency === "urgent" && (
                <Badge className="rounded-full text-[10px] bg-destructive/15 text-destructive border border-destructive/30 px-2">
                  <AlertTriangle className="h-2.5 w-2.5 mr-1" />Urgent
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {formatPH(r.requested_at, { dateStyle: "medium", timeStyle: "short" } as any)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={`rounded-lg text-xs flex items-center gap-1 ${cfg.className}`}>
            {cfg.icon}{cfg.label}
          </Badge>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="rounded-xl bg-muted/40 px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <div className="font-medium text-sm">{item.ppe_type}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.size && <span>Size: {item.size} · </span>}
                    Qty: {item.quantity} · Reason: {item.reason}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {r.notes && <p className="text-sm text-muted-foreground italic">Notes: {r.notes}</p>}
          {r.reviewed_by && (
            <p className="text-xs text-muted-foreground">
              Reviewed by {r.reviewed_by}
              {r.reviewed_at && ` on ${formatPH(r.reviewed_at, { dateStyle: "medium" } as any)}`}
            </p>
          )}
          {onCancel && (
            <Button size="sm" variant="outline" onClick={onCancel}
              className="rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />Cancel Request
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

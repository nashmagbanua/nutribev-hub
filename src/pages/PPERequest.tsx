import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase, type PPERequest as PPERequestType, type PPEItem } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Send, ShieldCheck, AlertTriangle, History, ClipboardList, Loader2 } from "lucide-react";
import { PPERequestCard } from "@/components/PPERequestCard"; // I-import ang card

const CATEGORIES = [
  { name: "Head", items: ["Safety Helmet", "Bump Cap"] },
  { name: "Eye", items: ["Safety Glasses", "Safety Goggles", "Face Shield"] },
  { name: "Hand", items: ["Cotton Gloves", "Leather Gloves", "Nitril Gloves"], hasSize: true },
  { name: "Foot", items: ["Safety Shoes", "Rubber Boots"], hasSize: true },
  { name: "Body", items: ["Reflective Vest", "Coveralls", "Raincoat"], hasSize: true },
  { name: "Fall Protection", items: ["Full Body Harness", "Lanyard"], hasSize: true },
];

export default function PPERequest() {
  const { profile } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [isUrgent, setIsUrgent] = useState(false);
  const [history, setHistory] = useState<PPERequestType[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { if (profile) fetchHistory(); }, [profile]);

  async function fetchHistory() {
    const { data } = await supabase.from('ppe_requests')
      .select('*').eq('company_id', profile?.company_id).order('requested_at', { ascending: false });
    setHistory(data || []);
  }

  const addItem = () => setItems([...items, { ppe_type: "", size: "", quantity: 1, reason: "", hasSize: false }]);
  
  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    if (field === 'ppe_type') {
      const cat = CATEGORIES.find(c => c.items.includes(value));
      newItems[index].hasSize = cat?.hasSize || false;
    }
    newItems[index][field] = value;
    setItems(newItems);
  };

  async function submit() {
    if (!items.length) return toast.error("Add at least one item");
    setLoading(true);
    const { error } = await supabase.from('ppe_requests').insert({
      company_id: profile?.company_id,
      employee_name: profile?.full_name,
      items,
      urgency: isUrgent ? 'urgent' : 'normal'
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Request submitted");
    setItems([]);
    fetchHistory();
  }

  return (
    <div className="space-y-6">
      {/* Form Section */}
      <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold flex items-center gap-2"><Plus className="h-4 w-4"/> New Request</h2>
          <Button variant={isUrgent ? "destructive" : "outline"} size="sm" onClick={() => setIsUrgent(!isUrgent)} className="h-8 text-[10px]">
             {isUrgent ? "URGENT MODE" : "NORMAL PRIORITY"}
          </Button>
        </div>

        {isUrgent && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex gap-3 items-center text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p className="text-xs font-medium">Urgent: Use this only for immediate safety risks or damaged essential gear.</p>
          </div>
        )}

        {items.map((item, i) => (
          <div key={i} className="p-4 border rounded-xl space-y-3 bg-muted/30 relative">
            <Button variant="ghost" size="sm" onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 h-7 w-7 p-0 text-muted-foreground hover:text-destructive">×</Button>
            <div className="grid gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] uppercase text-muted-foreground">PPE Item</Label>
                <Select onValueChange={(v) => updateItem(i, 'ppe_type', v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select type..." /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <div key={cat.name}>
                        <div className="px-2 py-1 text-[10px] font-bold opacity-50">{cat.name}</div>
                        {cat.items.map(it => <SelectItem key={it} value={it}>{it}</SelectItem>)}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {item.hasSize && (
                  <div className="space-y-1">
                    <Label className="text-[11px]">Size</Label>
                    <Input className="h-9" placeholder="e.g. XL, 9" onChange={e => updateItem(i, 'size', e.target.value)} />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-[11px]">Qty</Label>
                  <Input type="number" className="h-9" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Reason</Label>
                <Select onValueChange={(v) => updateItem(i, 'reason', v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Reason..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="First Issue">First Issue</SelectItem>
                    <SelectItem value="Damaged">Damaged / Worn out</SelectItem>
                    <SelectItem value="Lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ))}

        <Button variant="outline" onClick={addItem} className="w-full border-dashed py-6 rounded-xl border-2 hover:bg-primary/5 hover:border-primary/50 transition-all">
          <Plus className="h-4 w-4 mr-2" /> Add Item
        </Button>

        {items.length > 0 && (
          <Button onClick={submit} disabled={loading} className="w-full h-11 rounded-xl gradient-primary">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-2"/> Submit Request</>}
          </Button>
        )}
      </div>

      {/* History Section */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm flex items-center gap-2 px-1"><History className="h-4 w-4"/> Recent Requests</h3>
        {history.length === 0 ? (
          <div className="text-center py-10 bg-muted/20 rounded-2xl border-2 border-dashed">
            <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">No requests yet.</p>
          </div>
        ) : (
          history.map(r => (
            <PPERequestCard 
              key={r.id} 
              r={r} 
              expanded={expanded === r.id} 
              onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

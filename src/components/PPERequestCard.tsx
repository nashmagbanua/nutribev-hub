import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPH, type PPERequest, type PPEItem } from "@/lib/supabase";
import { ShieldCheck, AlertTriangle, Clock, CheckCircle2, Package, XCircle, ChevronDown, ChevronUp, Trash2 } from "lucide-react";

interface Props {
  r: PPERequest;
  expanded: boolean;
  onToggle: () => void;
  onCancel?: () => void;
}

export function PPERequestCard({ r, expanded, onToggle, onCancel }: Props) {
  const items = r.items as PPEItem[];
  
  const statusStyles: Record<string, any> = {
    pending: { label: "Pending", icon: <Clock className="h-3 w-3" />, class: "bg-muted text-muted-foreground" },
    approved: { label: "Approved", icon: <CheckCircle2 className="h-3 w-3" />, class: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    issued: { label: "Issued", icon: <Package className="h-3 w-3" />, class: "bg-primary/10 text-primary border-primary/20" },
    rejected: { label: "Rejected", icon: <XCircle className="h-3 w-3" />, class: "bg-destructive/10 text-destructive border-destructive/20" },
  };

  const style = statusStyles[r.status] || statusStyles.pending;

  return (
    <div className={`rounded-xl border transition-all ${r.urgency === 'urgent' ? 'border-destructive/30 bg-destructive/5' : 'bg-card'}`}>
      <button onClick={onToggle} className="w-full px-4 py-3 flex items-center justify-between text-left">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${r.urgency === 'urgent' ? 'bg-destructive/20' : 'bg-primary/10'}`}>
            <ShieldCheck className={`h-4 w-4 ${r.urgency === 'urgent' ? 'text-destructive' : 'text-primary'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm leading-none">Request #{r.id.slice(0, 5)}</span>
              {r.urgency === 'urgent' && <Badge variant="destructive" className="h-4 text-[10px] px-1 animate-pulse">URGENT</Badge>}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {items.length} items • {formatPH(r.requested_at, { dateStyle: 'medium' } as any)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-[10px] gap-1 ${style.class}`}>
            {style.icon} {style.label}
          </Badge>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t space-y-3">
          <div className="grid gap-2">
            {items.map((item, i) => (
              <div key={i} className="text-sm p-2 rounded-lg bg-muted/50 border border-border/50">
                <div className="flex justify-between font-medium">
                  <span>{item.ppe_type}</span>
                  <span>x{item.quantity}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Size: {item.size || 'N/A'} • Reason: {item.reason}
                </div>
              </div>
            ))}
          </div>
          {r.reviewed_by && (
            <div className="text-[10px] text-muted-foreground bg-muted p-2 rounded italic">
              Reviewed by {r.reviewed_by} on {r.reviewed_at && formatPH(r.reviewed_at, { dateStyle: 'short' } as any)}
            </div>
          )}
          {r.status === 'pending' && onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} className="w-full text-destructive hover:bg-destructive/10 h-8 text-xs">
              <Trash2 className="h-3 w-3 mr-2" /> Cancel Request
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

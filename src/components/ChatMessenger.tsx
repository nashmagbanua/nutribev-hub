import { useEffect, useMemo, useRef, useState } from "react";
import { supabase, withTimeout, type Message, type Profile } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, Search, Trash2, ArrowLeft, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { format, isToday } from "date-fns";

type Convo = {
  peer: Profile;
  last?: Message;
  unread: number;
};

export function ChatMessenger({ currentId }: { currentId: string }) {
  const [people, setPeople] = useState<Profile[]>([]);
  const [allMsgs, setAllMsgs] = useState<Message[]>([]);
  const [activePeer, setActivePeer] = useState<string | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadInbox = async () => {
    try {
      const [pRes, mRes] = await Promise.all([
        withTimeout(
          supabase.from("profiles").select("id, company_id, full_name, role, avatar_url, dob, is_approved").eq("is_approved", true),
          8000, "Directory"
        ) as any,
        withTimeout(
          supabase.from("messages")
            .select("*")
            .or(`to_company_id.eq.${currentId},from_company_id.eq.${currentId}`)
            .order("created_at", { ascending: false }).limit(500),
          8000, "Messages"
        ) as any,
      ]);
      setPeople(((pRes.data as Profile[]) ?? []).filter((p) => p.company_id !== currentId));
      setAllMsgs((mRes.data as Message[]) ?? []);
    } catch (e: any) { toast.error(e.message ?? "Failed to load inbox"); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadInbox(); /* eslint-disable-next-line */ }, [currentId]);

  // Group messages into conversations (excludes soft-deleted-by-current-user).
  const visibleMsgs = useMemo(() => allMsgs.filter(m => {
    if (m.from_company_id === currentId && m.deleted_by_sender) return false;
    if (m.to_company_id === currentId && m.deleted_by_receiver) return false;
    return true;
  }), [allMsgs, currentId]);

  const conversations: Convo[] = useMemo(() => {
    const map = new Map<string, Convo>();
    for (const m of visibleMsgs) {
      const peerId = m.from_company_id === currentId ? m.to_company_id : m.from_company_id;
      const peer = people.find(p => p.company_id === peerId);
      if (!peer) continue;
      const existing = map.get(peerId);
      const isUnread = m.to_company_id === currentId && !m.read;
      if (!existing) {
        map.set(peerId, { peer, last: m, unread: isUnread ? 1 : 0 });
      } else {
        if (isUnread) existing.unread += 1;
        if (!existing.last || new Date(m.created_at) > new Date(existing.last.created_at)) existing.last = m;
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      new Date(b.last?.created_at ?? 0).getTime() - new Date(a.last?.created_at ?? 0).getTime()
    );
  }, [visibleMsgs, people, currentId]);

  const totalUnread = conversations.reduce((n, c) => n + c.unread, 0);

  const filteredPeople = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return people.filter(p => p.full_name.toLowerCase().includes(q)).slice(0, 8);
  }, [search, people]);

  const openThread = async (peerId: string) => {
    setActivePeer(peerId);
    setSearch(""); setSearchOpen(false);
    // Load this conversation's messages.
    try {
      const { data } = await withTimeout(
        supabase.from("messages").select("*")
          .or(`and(from_company_id.eq.${currentId},to_company_id.eq.${peerId}),and(from_company_id.eq.${peerId},to_company_id.eq.${currentId})`)
          .order("created_at", { ascending: true }).limit(500),
        8000, "Thread"
      ) as any;
      const msgs = (data as Message[]) ?? [];
      setThread(msgs.filter(m => {
        if (m.from_company_id === currentId && m.deleted_by_sender) return false;
        if (m.to_company_id === currentId && m.deleted_by_receiver) return false;
        return true;
      }));
      // Mark unread → read.
      const unreadIds = msgs.filter(m => m.to_company_id === currentId && !m.read).map(m => m.id);
      if (unreadIds.length) {
        await supabase.from("messages").update({ read: true, status: "read" }).in("id", unreadIds);
        loadInbox();
      }
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
    } catch (e: any) { toast.error(e.message ?? "Failed to load conversation"); }
  };

  const send = async () => {
    if (!activePeer || !body.trim()) return;
    const text = body.trim();
    setBody("");
    try {
      const { data, error } = await withTimeout(
        supabase.from("messages").insert({
          from_company_id: currentId, to_company_id: activePeer, body: text, status: "sent",
        }).select().single(),
        8000, "Send"
      ) as any;
      if (error) throw error;
      setThread(t => [...t, data as Message]);
      setAllMsgs(m => [data as Message, ...m]);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
    } catch (e: any) { toast.error(e.message ?? "Send failed"); setBody(text); }
  };

  // Soft delete — only hides for current user.
  const softDelete = async (m: Message) => {
    const field = m.from_company_id === currentId ? "deleted_by_sender" : "deleted_by_receiver";
    const { error } = await supabase.from("messages").update({ [field]: true }).eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    setThread(t => t.filter(x => x.id !== m.id));
    setAllMsgs(arr => arr.map(x => x.id === m.id ? { ...x, [field]: true } : x));
  };

  const activeProfile = people.find(p => p.company_id === activePeer);

  return (
    <div className="rounded-2xl bg-card border border-border shadow-soft overflow-hidden">
      <div className="grid md:grid-cols-[320px_1fr] min-h-[60vh]">
        {/* LEFT — conversations list */}
        <aside className={`border-r border-border ${activePeer ? "hidden md:block" : "block"}`}>
          <div className="p-3 border-b border-border space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="font-semibold">Chats</span>
              {totalUnread > 0 && <Badge className="rounded-full bg-primary text-primary-foreground">{totalUnread}</Badge>}
            </div>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => { setSearch(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search by name…"
                className="pl-9 rounded-xl"
              />
              {searchOpen && filteredPeople.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-border bg-popover shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                  {filteredPeople.map(p => (
                    <button key={p.id} onClick={() => openThread(p.company_id)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted text-left">
                      <Avatar className="h-8 w-8"><AvatarImage src={p.avatar_url ?? undefined} /><AvatarFallback>{p.full_name.split(" ").map(n=>n[0]).slice(0,2).join("")}</AvatarFallback></Avatar>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p.full_name}</div>
                        <div className="text-xs text-muted-foreground truncate">{p.role}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="overflow-y-auto max-h-[55vh]">
            {loading && <p className="text-center text-sm text-muted-foreground py-6">Loading…</p>}
            {!loading && conversations.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6 px-4">No conversations yet. Search a name above to start a chat.</p>
            )}
            {conversations.map(c => (
              <button key={c.peer.id} onClick={() => openThread(c.peer.company_id)}
                className={`w-full flex items-center gap-3 px-3 py-3 text-left border-b border-border/60 hover:bg-muted/50 ${activePeer === c.peer.company_id ? "bg-muted" : ""}`}>
                <Avatar className="h-10 w-10"><AvatarImage src={c.peer.avatar_url ?? undefined} /><AvatarFallback>{c.peer.full_name.split(" ").map(n=>n[0]).slice(0,2).join("")}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium truncate">{c.peer.full_name}</span>
                    {c.last && <span className="text-[10px] text-muted-foreground shrink-0">{isToday(new Date(c.last.created_at)) ? format(new Date(c.last.created_at), "p") : format(new Date(c.last.created_at), "MMM d")}</span>}
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-xs text-muted-foreground truncate">
                      {c.last ? (c.last.from_company_id === currentId ? "You: " : "") + c.last.body : ""}
                    </span>
                    {c.unread > 0 && <Badge className="rounded-full bg-primary text-primary-foreground h-5 min-w-5 px-1.5 text-[10px]">{c.unread}</Badge>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* RIGHT — active thread */}
        <section className={`flex flex-col ${activePeer ? "block" : "hidden md:flex"}`}>
          {!activePeer ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-6 text-center">
              Select a conversation or search a name to start chatting.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 p-3 border-b border-border">
                <Button size="icon" variant="ghost" className="md:hidden" onClick={() => setActivePeer(null)}><ArrowLeft className="h-4 w-4" /></Button>
                <Avatar className="h-9 w-9"><AvatarImage src={activeProfile?.avatar_url ?? undefined} /><AvatarFallback>{activeProfile?.full_name.split(" ").map(n=>n[0]).slice(0,2).join("")}</AvatarFallback></Avatar>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{activeProfile?.full_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{activeProfile?.role}</div>
                </div>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[55vh]">
                {thread.length === 0 && <p className="text-center text-xs text-muted-foreground">No messages yet — say hello 👋</p>}
                {thread.map(m => {
                  const mine = m.from_company_id === currentId;
                  return (
                    <div key={m.id} className={`group max-w-[75%] ${mine ? "ml-auto" : ""}`}>
                      <div className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {m.body}
                      </div>
                      <div className={`text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 ${mine ? "justify-end" : ""}`}>
                        <span>{format(new Date(m.created_at), "p")}</span>
                        {mine && <span className="uppercase">{m.read ? "read" : (m.status ?? "sent")}</span>}
                        <button onClick={() => softDelete(m)} className="opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-3 border-t border-border flex items-center gap-2">
                <Input
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Type a message…"
                  className="rounded-xl"
                />
                <Button onClick={send} disabled={!body.trim()} className="rounded-xl gradient-primary text-primary-foreground">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

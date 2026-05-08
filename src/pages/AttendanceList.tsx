import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  supabase,
  formatPH,
  lastNameOf,
  phDateKey,
  type AttendanceRow,
  type Profile,
} from "@/lib/supabase";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  ArrowLeft,
  CalendarCheck,
  Loader2,
} from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";

function isValidDate(value: unknown): boolean {
  if (!value) return false;

  const d = new Date(value as string);

  return !isNaN(d.getTime());
}

function safeFormatTime(timestamp?: string) {
  if (!timestamp) return "—";

  if (!isValidDate(timestamp)) {
    console.error("Invalid timestamp:", timestamp);
    return "Invalid";
  }

  try {
    return formatPH(timestamp, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch (err) {
    console.error("Format error:", err);
    return "Invalid";
  }
}

export default function AttendanceList() {
  const [date, setDate] = useState<string>(() => phToday());

  const [rows, setRows] = useState<AttendanceRow[]>([]);

  const [profiles, setProfiles] = useState<
    Record<string, Profile>
  >({});

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);

      try {
        const [y, m, d] = date.split("-").map(Number);

        if (isNaN(y)) {
          throw new Error("Invalid date selected");
        }

        // PH timezone offset handling
        const start = new Date(
          Date.UTC(y, m - 1, d, -8, 0, 0)
        );

        const end = new Date(
          start.getTime() + 34 * 60 * 60 * 1000
        );

        const [a, p] = await Promise.all([
          supabase
            .from("attendance")
            .select("*")
            .gte("timestamp", start.toISOString())
            .lte("timestamp", end.toISOString())
            .order("timestamp", { ascending: true }),

          supabase
            .from("profiles")
            .select(
              "id, company_id, full_name, position, role"
            ),
        ]);

        const attendanceData =
          (a.data as AttendanceRow[]) ?? [];

        // REMOVE INVALID RECORDS
        const cleanedRows = attendanceData.filter((r) => {
          if (!r.company_id) {
            console.warn(
              "Missing company_id:",
              r
            );
            return false;
          }

          if (!r.timestamp) {
            console.warn(
              "Missing timestamp:",
              r
            );
            return false;
          }

          if (!isValidDate(r.timestamp)) {
            console.warn(
              "Invalid timestamp:",
              r.timestamp,
              r
            );
            return false;
          }

          return true;
        });

        console.table(cleanedRows);

        setRows(cleanedRows);

        const map: Record<string, Profile> = {};

        ((p.data as Profile[]) ?? []).forEach((pr) => {
          map[pr.company_id] = pr;
        });

        setProfiles(map);
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [date]);

  const grouped = useMemo(() => {
    const m: Record<
      string,
      {
        in?: AttendanceRow;
        out?: AttendanceRow;
      }
    > = {};

    // SAFE SORT
    const sortedRows = [...rows].sort((a, b) => {
      const at = new Date(a.timestamp).getTime();
      const bt = new Date(b.timestamp).getTime();

      return at - bt;
    });

    sortedRows.forEach((r) => {
      try {
        if (!r.timestamp || !r.company_id) {
          return;
        }

        if (!isValidDate(r.timestamp)) {
          console.error(
            "Bad timestamp during grouping:",
            r
          );
          return;
        }

        if (!m[r.company_id]) {
          m[r.company_id] = {};
        }

        let rowDatePH = "";

        try {
          rowDatePH = phDateKey(r.timestamp);
        } catch (err) {
          console.error(
            "phDateKey error:",
            r.timestamp
          );
          return;
        }

        // TIME IN
        if (r.type === "time_in") {
          if (rowDatePH === date) {
            m[r.company_id].in = r;
          }
        }

        // TIME OUT
        else if (r.type === "time_out") {
          const myIn = m[r.company_id].in;

          if (myIn) {
            if (!isValidDate(myIn.timestamp)) {
              return;
            }

            const inTime = new Date(
              myIn.timestamp
            ).getTime();

            const outTime = new Date(
              r.timestamp
            ).getTime();

            const diffHours =
              (outTime - inTime) /
              (1000 * 60 * 60);

            // valid pair within 16 hours
            if (
              diffHours > 0 &&
              diffHours < 16
            ) {
              m[r.company_id].out = r;
            }
          }
        }
      } catch (e) {
        console.error(
          "Attendance mapping error:",
          e,
          r
        );
      }
    });

    return Object.entries(m)
      .filter(([, pair]) => !!pair.in)
      .sort(([a], [b]) => {
        const an =
          profiles[a]?.full_name ?? a;

        const bn =
          profiles[b]?.full_name ?? b;

        return lastNameOf(an).localeCompare(
          lastNameOf(bn)
        );
      });
  }, [rows, profiles, date]);

  return (
    <div className="min-h-screen gradient-subtle">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="container flex items-center justify-between h-16">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to kiosk
          </Link>

          <ThemeToggle />
        </div>
      </header>

      <main className="container py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <CalendarCheck className="h-7 w-7 text-primary" />
              Daily Attendance List
            </h1>

            <p className="text-muted-foreground">
              Philippine Time · Asia/Manila
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={date}
              onChange={(e) =>
                setDate(e.target.value)
              }
              className="rounded-xl max-w-[200px]"
            />

            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setDate(phToday())}
            >
              Today
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-4">
                    Employee
                  </th>

                  <th className="p-4">
                    Position
                  </th>

                  <th className="p-4">
                    Date
                  </th>

                  <th className="p-4">
                    Time In
                  </th>

                  <th className="p-4">
                    Time Out
                  </th>

                  <th className="p-4">
                    Shift
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-12 text-center text-muted-foreground"
                    >
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading records...
                    </td>
                  </tr>
                )}

                {!loading &&
                  grouped.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-12 text-center text-muted-foreground"
                      >
                        No records for {date}.
                      </td>
                    </tr>
                  )}

                {grouped.map(
                  ([companyId, pair]) => {
                    const p =
                      profiles[companyId];

                    return (
                      <tr
                        key={companyId}
                        className="border-t border-border hover:bg-muted/30"
                      >
                        <td className="p-4 font-medium">
                          {p?.full_name ??
                            companyId}
                        </td>

                        <td className="p-4 text-muted-foreground">
                          {p?.position ??
                            "—"}
                        </td>

                        <td className="p-4">
                          {date}
                        </td>

                        <td className="p-4 font-mono">
                          {pair.in
                            ? safeFormatTime(
                                pair.in
                                  .timestamp
                              )
                            : "—"}
                        </td>

                        <td className="p-4 font-mono">
                          {pair.out ? (
                            safeFormatTime(
                              pair.out
                                .timestamp
                            )
                          ) : (
                            <Badge
                              variant="outline"
                              className="font-normal opacity-70"
                            >
                              Active
                            </Badge>
                          )}
                        </td>

                        <td className="p-4">
                          {pair.in
                            ?.shift && (
                            <Badge
                              variant={
                                pair.in
                                  .shift ===
                                "night"
                                  ? "default"
                                  : "secondary"
                              }
                              className="capitalize"
                            >
                              {
                                pair.in
                                  .shift
                              }
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function phToday(): string {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(new Date());
}

import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Terminal, 
  Info, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle 
} from "lucide-react";
import type { LogEntry } from "@shared/schema";

interface ActivityLogProps {
  logs: LogEntry[];
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function LogIcon({ type }: { type: LogEntry["type"] }) {
  switch (type) {
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-chart-2 shrink-0" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-chart-3 shrink-0" />;
    case "error":
      return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
    default:
      return <Info className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}

export function ActivityLog({ logs }: ActivityLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
          <Terminal className="h-5 w-5" />
          Log de Atividades
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md bg-muted/30">
          <ScrollArea className="h-64" ref={scrollRef}>
            <div 
              ref={viewportRef}
              className="p-4 space-y-2 font-mono text-sm"
              data-testid="log-container"
            >
              {logs.length === 0 ? (
                <div className="text-muted-foreground text-center py-8">
                  Nenhuma atividade registrada ainda...
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 animate-in fade-in slide-in-from-bottom-1 duration-200"
                    data-testid={`log-entry-${log.id}`}
                  >
                    <span className="text-muted-foreground shrink-0 tabular-nums">
                      [{formatTimestamp(new Date(log.timestamp))}]
                    </span>
                    <LogIcon type={log.type} />
                    <span 
                      className={`
                        ${log.type === "error" ? "text-destructive" : ""}
                        ${log.type === "warning" ? "text-chart-3" : ""}
                        ${log.type === "success" ? "text-chart-2" : ""}
                      `}
                    >
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

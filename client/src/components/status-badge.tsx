import { Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  isConnected: boolean;
  userRa?: string | null;
}

export function StatusBadge({ isConnected, userRa }: StatusBadgeProps) {
  return (
    <div className="flex items-center gap-3">
      {userRa && (
        <span className="text-sm text-muted-foreground hidden sm:inline" data-testid="text-user-ra">
          RA: {userRa}
        </span>
      )}
      <Badge
        variant={isConnected ? "secondary" : "destructive"}
        className="gap-1.5"
        data-testid="badge-connection-status"
      >
        {isConnected ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chart-2 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-chart-2"></span>
            </span>
            Conectado
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3" />
            Desconectado
          </>
        )}
      </Badge>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Clock, Timer } from "lucide-react";
import type { ProgressData, AutomationState } from "@shared/schema";

interface ProgressPanelProps {
  progress: ProgressData;
  state: AutomationState;
  bookTitle?: string | null;
}

function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export function ProgressPanel({ progress, state, bookTitle }: ProgressPanelProps) {
  const isActive = state === "reading" || state === "paused" || state === "completed";
  const isCompleted = state === "completed";
  const isPaused = state === "paused";
  const percentage = progress.totalPages 
    ? Math.min(100, (progress.currentPage / progress.totalPages) * 100)
    : progress.percentage;

  return (
    <Card className={`transition-all duration-300 ${isActive ? "ring-2 ring-primary/20" : ""}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <BookOpen className="h-5 w-5" />
            Progresso
          </CardTitle>
          {bookTitle && (
            <span className="text-sm text-muted-foreground truncate max-w-[200px]" data-testid="text-book-title">
              {bookTitle}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-baseline justify-center gap-1">
            <span 
              className="text-5xl font-bold tabular-nums tracking-tight"
              data-testid="text-percentage"
            >
              {percentage.toFixed(1)}
            </span>
            <span className="text-2xl font-medium text-muted-foreground">%</span>
          </div>
          
          {isPaused && (
            <span className="inline-block px-3 py-1 text-sm font-medium bg-muted rounded-full text-muted-foreground">
              Pausado
            </span>
          )}
          
          {isCompleted && (
            <span className="inline-block px-3 py-1 text-sm font-medium bg-chart-2/20 text-chart-2 rounded-full">
              Concluído
            </span>
          )}
        </div>

        <div className="space-y-2">
          <Progress 
            value={percentage} 
            className="h-4"
            data-testid="progress-bar"
          />
          
          <div className="flex items-center justify-center text-lg font-medium" data-testid="text-pages">
            {progress.currentPage}
            {progress.totalPages && (
              <span className="text-muted-foreground">
                {" / "}{progress.totalPages} páginas
              </span>
            )}
            {!progress.totalPages && progress.currentPage > 0 && (
              <span className="text-muted-foreground"> páginas viradas</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-muted-foreground">Tempo decorrido</div>
              <div className="font-medium tabular-nums" data-testid="text-elapsed-time">
                {formatTime(progress.elapsedTime)}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Timer className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-muted-foreground">Tempo restante</div>
              <div className="font-medium tabular-nums" data-testid="text-remaining-time">
                {progress.estimatedTimeRemaining !== null 
                  ? formatTime(progress.estimatedTimeRemaining)
                  : "Calculando..."
                }
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

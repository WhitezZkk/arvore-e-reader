import { Play, Pause, Square, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AutomationState } from "@shared/schema";

interface ControlPanelProps {
  state: AutomationState;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onReset: () => void;
  isConfigValid: boolean;
}

export function ControlPanel({
  state,
  onStart,
  onPause,
  onResume,
  onStop,
  onReset,
  isConfigValid,
}: ControlPanelProps) {
  const isIdle = state === "idle";
  const isRunning = state === "reading" || state === "connecting" || state === "logging_in" || state === "loading_book";
  const isPaused = state === "paused";
  const isCompleted = state === "completed";
  const isError = state === "error";
  const isLoading = state === "connecting" || state === "logging_in" || state === "loading_book";

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {isIdle && (
        <Button
          size="lg"
          className="h-12 px-8 gap-2"
          onClick={onStart}
          disabled={!isConfigValid}
          data-testid="button-start"
        >
          <Play className="h-5 w-5" />
          Iniciar Automação
        </Button>
      )}

      {isRunning && !isLoading && (
        <Button
          variant="secondary"
          size="lg"
          className="h-12 px-6 gap-2"
          onClick={onPause}
          data-testid="button-pause"
        >
          <Pause className="h-5 w-5" />
          Pausar
        </Button>
      )}

      {isLoading && (
        <Button
          variant="secondary"
          size="lg"
          className="h-12 px-6 gap-2"
          disabled
          data-testid="button-loading"
        >
          <Loader2 className="h-5 w-5 animate-spin" />
          {state === "connecting" && "Conectando..."}
          {state === "logging_in" && "Fazendo login..."}
          {state === "loading_book" && "Carregando livro..."}
        </Button>
      )}

      {isPaused && (
        <Button
          size="lg"
          className="h-12 px-6 gap-2"
          onClick={onResume}
          data-testid="button-resume"
        >
          <Play className="h-5 w-5" />
          Retomar
        </Button>
      )}

      {(isRunning || isPaused) && (
        <Button
          variant="destructive"
          size="lg"
          className="h-12 px-6 gap-2"
          onClick={onStop}
          data-testid="button-stop"
        >
          <Square className="h-5 w-5" />
          Parar
        </Button>
      )}

      {(isCompleted || isError) && (
        <Button
          size="lg"
          className="h-12 px-8 gap-2"
          onClick={onReset}
          data-testid="button-reset"
        >
          <RotateCcw className="h-5 w-5" />
          Nova Execução
        </Button>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from "react";
import type { 
  AutomationSession, 
  AutomationConfig, 
  LogEntry, 
  WsMessage,
  AutomationState,
  ProgressData
} from "@shared/schema";
import { initialSession } from "@shared/schema";

export function useAutomation() {
  const [session, setSession] = useState<AutomationSession>(initialSession);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      addLog("info", "Conectado ao servidor");
    };

    socket.onclose = () => {
      setIsConnected(false);
      addLog("warning", "Desconectado do servidor");
      
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    socket.onerror = () => {
      addLog("error", "Erro de conexão");
    };

    socket.onmessage = (event) => {
      try {
        const message: WsMessage = JSON.parse(event.data);
        handleMessage(message);
      } catch (e) {
        console.error("Failed to parse message:", e);
      }
    };
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const addLog = useCallback((type: LogEntry["type"], message: string) => {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type,
      message,
    };
    setSession((prev) => ({
      ...prev,
      logs: [...prev.logs, entry],
    }));
  }, []);

  const handleMessage = useCallback((message: WsMessage) => {
    switch (message.type) {
      case "connected":
        setSession((prev) => ({
          ...prev,
          id: message.payload?.sessionId || prev.id,
        }));
        break;

      case "state_update":
        const newState = message.payload?.state as AutomationState;
        setSession((prev) => ({
          ...prev,
          state: newState,
          bookTitle: message.payload?.bookTitle || prev.bookTitle,
          userRa: message.payload?.userRa || prev.userRa,
          startedAt: message.payload?.startedAt ? new Date(message.payload.startedAt) : prev.startedAt,
        }));
        break;

      case "progress_update":
        const progress = message.payload as ProgressData;
        setSession((prev) => ({
          ...prev,
          progress: {
            ...prev.progress,
            ...progress,
          },
        }));
        break;

      case "log":
        addLog(message.payload?.type || "info", message.payload?.message || "");
        break;

      case "error":
        addLog("error", message.payload?.message || "Erro desconhecido");
        setSession((prev) => ({
          ...prev,
          state: "error",
        }));
        break;
    }
  }, [addLog]);

  const sendMessage = useCallback((message: WsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const startAutomation = useCallback((config: AutomationConfig) => {
    setSession((prev) => ({
      ...prev,
      config,
      state: "connecting",
      logs: [],
      progress: {
        currentPage: 0,
        totalPages: null,
        percentage: 0,
        elapsedTime: 0,
        estimatedTimeRemaining: null,
      },
      startedAt: new Date(),
    }));
    
    sendMessage({
      type: "start",
      payload: config,
    });
    
    addLog("info", "Iniciando automação...");
  }, [sendMessage, addLog]);

  const pauseAutomation = useCallback(() => {
    sendMessage({ type: "pause" });
    addLog("info", "Pausando automação...");
  }, [sendMessage, addLog]);

  const resumeAutomation = useCallback(() => {
    sendMessage({ type: "resume" });
    addLog("info", "Retomando automação...");
  }, [sendMessage, addLog]);

  const stopAutomation = useCallback(() => {
    sendMessage({ type: "stop" });
    addLog("warning", "Parando automação...");
  }, [sendMessage, addLog]);

  const resetSession = useCallback(() => {
    setSession({
      ...initialSession,
      id: session.id,
    });
  }, [session.id]);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    session,
    isConnected,
    startAutomation,
    pauseAutomation,
    resumeAutomation,
    stopAutomation,
    resetSession,
  };
}

import type { Express } from "express";
import { type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { AutomationService } from "./automation";
import { BookBrowserService } from "./book-browser";
import { 
  automationConfigSchema, 
  type WsMessage,
  insertReadingSettingsSchema,
  insertBookQueueSchema,
  insertScheduledReadingSchema
} from "@shared/schema";
import { storage } from "./storage";
import { randomUUID } from "crypto";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  const sessions = new Map<string, AutomationService>();

  wss.on("connection", (ws: WebSocket) => {
    const sessionId = randomUUID();
    const automation = new AutomationService();
    sessions.set(sessionId, automation);

    const sendMessage = (message: WsMessage) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    };

    sendMessage({
      type: "connected",
      payload: { sessionId },
    });

    automation.on("stateChange", (state, data) => {
      sendMessage({
        type: "state_update",
        payload: { state, ...data },
      });
    });

    automation.on("progress", async (progress) => {
      sendMessage({
        type: "progress_update",
        payload: progress,
      });
      
      if (automation.getCurrentBookQueueId()) {
        await storage.updateBookProgress(
          automation.getCurrentBookQueueId()!,
          progress.currentPage,
          progress.totalPages || undefined
        );
      }
    });

    automation.on("log", (type, message) => {
      sendMessage({
        type: "log",
        payload: { type, message },
      });
    });

    automation.on("error", (message) => {
      sendMessage({
        type: "error",
        payload: { message },
      });
    });

    automation.on("completed", async (data) => {
      if (data.bookQueueId) {
        await storage.markBookCompleted(
          data.bookQueueId,
          data.pagesRead,
          data.totalPages,
          data.timeSpent
        );
      }
    });

    ws.on("message", async (data) => {
      try {
        const message: WsMessage = JSON.parse(data.toString());

        switch (message.type) {
          case "start":
            const configResult = automationConfigSchema.safeParse(message.payload);
            if (configResult.success) {
              automation.start(configResult.data);
            } else {
              sendMessage({
                type: "error",
                payload: { message: "Configuração inválida" },
              });
            }
            break;

          case "pause":
            automation.pause();
            break;

          case "resume":
            automation.resume();
            break;

          case "stop":
            await automation.stop();
            break;
        }
      } catch (error) {
        console.error("Error processing message:", error);
        sendMessage({
          type: "error",
          payload: { message: "Erro ao processar mensagem" },
        });
      }
    });

    ws.on("close", async () => {
      const session = sessions.get(sessionId);
      if (session) {
        await session.stop();
        sessions.delete(sessionId);
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Reading Settings
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getReadingSettings();
      res.json(settings || null);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Erro ao buscar configurações" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const result = insertReadingSettingsSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Dados inválidos", details: result.error.errors });
      }
      const settings = await storage.upsertReadingSettings(result.data);
      res.json(settings);
    } catch (error) {
      console.error("Error saving settings:", error);
      res.status(500).json({ error: "Erro ao salvar configurações" });
    }
  });

  // Books Queue
  app.get("/api/queue", async (req, res) => {
    try {
      const queue = await storage.getQueuedBooks();
      res.json(queue);
    } catch (error) {
      console.error("Error fetching queue:", error);
      res.status(500).json({ error: "Erro ao buscar fila" });
    }
  });

  app.get("/api/queue/:id", async (req, res) => {
    try {
      const book = await storage.getQueuedBook(req.params.id);
      if (!book) {
        return res.status(404).json({ error: "Livro não encontrado na fila" });
      }
      res.json(book);
    } catch (error) {
      console.error("Error fetching queued book:", error);
      res.status(500).json({ error: "Erro ao buscar livro" });
    }
  });

  app.post("/api/queue", async (req, res) => {
    try {
      const result = insertBookQueueSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Dados inválidos", details: result.error.errors });
      }
      const book = await storage.addToQueue(result.data);
      res.status(201).json(book);
    } catch (error) {
      console.error("Error adding to queue:", error);
      res.status(500).json({ error: "Erro ao adicionar à fila" });
    }
  });

  app.patch("/api/queue/:id", async (req, res) => {
    try {
      const book = await storage.updateQueuedBook(req.params.id, req.body);
      if (!book) {
        return res.status(404).json({ error: "Livro não encontrado na fila" });
      }
      res.json(book);
    } catch (error) {
      console.error("Error updating queued book:", error);
      res.status(500).json({ error: "Erro ao atualizar livro" });
    }
  });

  app.delete("/api/queue/:id", async (req, res) => {
    try {
      await storage.removeFromQueue(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing from queue:", error);
      res.status(500).json({ error: "Erro ao remover da fila" });
    }
  });

  // Reading History
  app.get("/api/history", async (req, res) => {
    try {
      const history = await storage.getReadingHistory();
      res.json(history);
    } catch (error) {
      console.error("Error fetching history:", error);
      res.status(500).json({ error: "Erro ao buscar histórico" });
    }
  });

  app.get("/api/history/stats", async (req, res) => {
    try {
      const stats = await storage.getHistoryStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Erro ao buscar estatísticas" });
    }
  });

  // Scheduled Readings
  app.get("/api/schedules", async (req, res) => {
    try {
      const schedules = await storage.getScheduledReadings();
      res.json(schedules);
    } catch (error) {
      console.error("Error fetching schedules:", error);
      res.status(500).json({ error: "Erro ao buscar agendamentos" });
    }
  });

  app.get("/api/schedules/:id", async (req, res) => {
    try {
      const schedule = await storage.getScheduledReading(req.params.id);
      if (!schedule) {
        return res.status(404).json({ error: "Agendamento não encontrado" });
      }
      res.json(schedule);
    } catch (error) {
      console.error("Error fetching schedule:", error);
      res.status(500).json({ error: "Erro ao buscar agendamento" });
    }
  });

  app.post("/api/schedules", async (req, res) => {
    try {
      const result = insertScheduledReadingSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Dados inválidos", details: result.error.errors });
      }
      const schedule = await storage.createScheduledReading(result.data);
      res.status(201).json(schedule);
    } catch (error) {
      console.error("Error creating schedule:", error);
      res.status(500).json({ error: "Erro ao criar agendamento" });
    }
  });

  app.patch("/api/schedules/:id", async (req, res) => {
    try {
      const schedule = await storage.updateScheduledReading(req.params.id, req.body);
      if (!schedule) {
        return res.status(404).json({ error: "Agendamento não encontrado" });
      }
      res.json(schedule);
    } catch (error) {
      console.error("Error updating schedule:", error);
      res.status(500).json({ error: "Erro ao atualizar agendamento" });
    }
  });

  app.delete("/api/schedules/:id", async (req, res) => {
    try {
      await storage.deleteScheduledReading(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting schedule:", error);
      res.status(500).json({ error: "Erro ao excluir agendamento" });
    }
  });

  const browseRequestSchema = z.object({
    ra: z.string().min(1, "RA é obrigatório").regex(/^\d+[a-zA-Z]{2}$/, "RA inválido"),
    password: z.string().min(1, "Senha é obrigatória"),
  });

  app.post("/api/books/browse", async (req, res) => {
    try {
      const result = browseRequestSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ 
          error: "Dados inválidos", 
          details: result.error.errors.map(e => e.message) 
        });
      }

      const { ra, password } = result.data;

      const browserService = new BookBrowserService();
      const categories = await browserService.fetchBooks(ra, password);
      
      res.json({ categories });
    } catch (error) {
      console.error("Error browsing books:", error);
      res.status(500).json({ error: "Erro ao buscar livros. Verifique suas credenciais." });
    }
  });

  return httpServer;
}

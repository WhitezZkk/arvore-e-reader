import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Reading Settings table - stores user preferences for automation
export const readingSettings = pgTable("reading_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ra: text("ra").notNull(),
  password: text("password").notNull(),
  defaultInterval: real("default_interval").notNull().default(60),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertReadingSettingsSchema = createInsertSchema(readingSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertReadingSettings = z.infer<typeof insertReadingSettingsSchema>;
export type ReadingSettings = typeof readingSettings.$inferSelect;

// Books Queue table - stores books in reading queue
export const booksQueue = pgTable("books_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookSlug: text("book_slug").notNull(),
  bookTitle: text("book_title"),
  position: integer("position").notNull().default(0),
  interval: real("interval").notNull().default(60),
  status: text("status").notNull().default("pending"), // pending, reading, completed, paused
  currentPage: integer("current_page").notNull().default(0),
  totalPages: integer("total_pages"),
  addedAt: timestamp("added_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export const insertBookQueueSchema = createInsertSchema(booksQueue).omit({
  id: true,
  addedAt: true,
  startedAt: true,
  completedAt: true,
});

export type InsertBookQueue = z.infer<typeof insertBookQueueSchema>;
export type BookQueue = typeof booksQueue.$inferSelect;

// Reading History table - stores completed reading sessions
export const readingHistory = pgTable("reading_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookSlug: text("book_slug").notNull(),
  bookTitle: text("book_title"),
  pagesRead: integer("pages_read").notNull().default(0),
  totalPages: integer("total_pages"),
  timeSpentSeconds: integer("time_spent_seconds").notNull().default(0),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
  wasCompleted: boolean("was_completed").notNull().default(false),
});

export const insertReadingHistorySchema = createInsertSchema(readingHistory).omit({
  id: true,
  completedAt: true,
});

export type InsertReadingHistory = z.infer<typeof insertReadingHistorySchema>;
export type ReadingHistory = typeof readingHistory.$inferSelect;

// Scheduled Readings table - stores scheduled automation sessions
export const scheduledReadings = pgTable("scheduled_readings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookQueueId: varchar("book_queue_id").references(() => booksQueue.id),
  scheduledTime: timestamp("scheduled_time").notNull(),
  repeatType: text("repeat_type").notNull().default("once"), // once, daily, weekly
  isActive: boolean("is_active").notNull().default(true),
  lastRun: timestamp("last_run"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertScheduledReadingSchema = createInsertSchema(scheduledReadings).omit({
  id: true,
  lastRun: true,
  createdAt: true,
});

export type InsertScheduledReading = z.infer<typeof insertScheduledReadingSchema>;
export type ScheduledReading = typeof scheduledReadings.$inferSelect;

// Relations
export const booksQueueRelations = relations(booksQueue, ({ many }) => ({
  scheduledReadings: many(scheduledReadings),
}));

export const scheduledReadingsRelations = relations(scheduledReadings, ({ one }) => ({
  bookQueue: one(booksQueue, {
    fields: [scheduledReadings.bookQueueId],
    references: [booksQueue.id],
  }),
}));

// Automation session states
export const automationStates = ["idle", "connecting", "logging_in", "loading_book", "reading", "paused", "completed", "error"] as const;
export type AutomationState = typeof automationStates[number];

// Log entry types
export const logTypes = ["info", "success", "warning", "error"] as const;
export type LogType = typeof logTypes[number];

// Automation configuration schema
export const automationConfigSchema = z.object({
  ra: z.string().min(1, "RA é obrigatório").regex(/^\d+[a-zA-Z]{2}$/, "RA inválido. Formato: número + estado (ex: 00001152877136sp)"),
  password: z.string().min(1, "Senha é obrigatória"),
  bookSlug: z.string().min(1, "Slug do livro é obrigatório"),
  interval: z.number().min(60).max(300).default(60),
  bookQueueId: z.string().optional(),
});

export type AutomationConfig = z.infer<typeof automationConfigSchema>;

// Log entry interface
export interface LogEntry {
  id: string;
  timestamp: Date;
  type: LogType;
  message: string;
}

// Progress data interface
export interface ProgressData {
  currentPage: number;
  totalPages: number | null;
  percentage: number;
  elapsedTime: number;
  estimatedTimeRemaining: number | null;
}

// Automation session interface
export interface AutomationSession {
  id: string;
  state: AutomationState;
  config: AutomationConfig | null;
  progress: ProgressData;
  logs: LogEntry[];
  startedAt: Date | null;
  bookTitle: string | null;
  userRa: string | null;
}

// WebSocket message types
export const wsMessageTypes = [
  "start",
  "pause",
  "resume",
  "stop",
  "state_update",
  "progress_update",
  "log",
  "error",
  "connected"
] as const;

export type WsMessageType = typeof wsMessageTypes[number];

// WebSocket message interface
export interface WsMessage {
  type: WsMessageType;
  payload?: any;
}

// Initial session state
export const initialSession: AutomationSession = {
  id: "",
  state: "idle",
  config: null,
  progress: {
    currentPage: 0,
    totalPages: null,
    percentage: 0,
    elapsedTime: 0,
    estimatedTimeRemaining: null,
  },
  logs: [],
  startedAt: null,
  bookTitle: null,
  userRa: null,
};

// Queue status type
export const queueStatuses = ["pending", "reading", "completed", "paused"] as const;
export type QueueStatus = typeof queueStatuses[number];

// Repeat types for scheduling
export const repeatTypes = ["once", "daily", "weekly"] as const;
export type RepeatType = typeof repeatTypes[number];

// Available book from platform
export interface AvailableBook {
  id: string;
  title: string;
  author?: string;
  coverUrl?: string;
  slug: string;
  category?: string;
}

// Book category
export interface BookCategory {
  name: string;
  books: AvailableBook[];
}

import { 
  type User, type InsertUser,
  type ReadingSettings, type InsertReadingSettings,
  type BookQueue, type InsertBookQueue,
  type ReadingHistory, type InsertReadingHistory,
  type ScheduledReading, type InsertScheduledReading,
  users, readingSettings, booksQueue, readingHistory, scheduledReadings
} from "@shared/schema";
import { db } from "./db";
import { eq, asc, desc, and, lte, gte } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Reading Settings
  getReadingSettings(): Promise<ReadingSettings | undefined>;
  upsertReadingSettings(settings: InsertReadingSettings): Promise<ReadingSettings>;
  
  // Books Queue
  getQueuedBooks(): Promise<BookQueue[]>;
  getQueuedBook(id: string): Promise<BookQueue | undefined>;
  addToQueue(book: InsertBookQueue): Promise<BookQueue>;
  updateQueuedBook(id: string, updates: Partial<InsertBookQueue>): Promise<BookQueue | undefined>;
  removeFromQueue(id: string): Promise<void>;
  getNextPendingBook(): Promise<BookQueue | undefined>;
  updateBookProgress(id: string, currentPage: number, totalPages?: number): Promise<void>;
  markBookCompleted(id: string, pagesRead: number, totalPages: number, timeSpent: number): Promise<void>;
  
  // Reading History
  getReadingHistory(): Promise<ReadingHistory[]>;
  addToHistory(entry: InsertReadingHistory): Promise<ReadingHistory>;
  getHistoryStats(): Promise<{ totalBooks: number; totalPages: number; totalTime: number; completedBooks: number }>;
  
  // Scheduled Readings
  getScheduledReadings(): Promise<ScheduledReading[]>;
  getScheduledReading(id: string): Promise<ScheduledReading | undefined>;
  createScheduledReading(schedule: InsertScheduledReading): Promise<ScheduledReading>;
  updateScheduledReading(id: string, updates: Partial<InsertScheduledReading>): Promise<ScheduledReading | undefined>;
  deleteScheduledReading(id: string): Promise<void>;
  getDueScheduledReadings(): Promise<ScheduledReading[]>;
  markScheduleAsRun(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Reading Settings
  async getReadingSettings(): Promise<ReadingSettings | undefined> {
    const [settings] = await db.select().from(readingSettings).limit(1);
    return settings || undefined;
  }

  async upsertReadingSettings(settings: InsertReadingSettings): Promise<ReadingSettings> {
    const existing = await this.getReadingSettings();
    if (existing) {
      const [updated] = await db
        .update(readingSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(readingSettings.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(readingSettings).values(settings).returning();
    return created;
  }

  // Books Queue
  async getQueuedBooks(): Promise<BookQueue[]> {
    return db.select().from(booksQueue).orderBy(asc(booksQueue.position));
  }

  async getQueuedBook(id: string): Promise<BookQueue | undefined> {
    const [book] = await db.select().from(booksQueue).where(eq(booksQueue.id, id));
    return book || undefined;
  }

  async addToQueue(book: InsertBookQueue): Promise<BookQueue> {
    const existingBooks = await this.getQueuedBooks();
    const maxPosition = existingBooks.length > 0 
      ? Math.max(...existingBooks.map(b => b.position)) + 1 
      : 0;
    
    const [created] = await db
      .insert(booksQueue)
      .values({ ...book, position: book.position ?? maxPosition })
      .returning();
    return created;
  }

  async updateQueuedBook(id: string, updates: Partial<InsertBookQueue>): Promise<BookQueue | undefined> {
    const [updated] = await db
      .update(booksQueue)
      .set(updates)
      .where(eq(booksQueue.id, id))
      .returning();
    return updated || undefined;
  }

  async removeFromQueue(id: string): Promise<void> {
    await db.delete(booksQueue).where(eq(booksQueue.id, id));
  }

  async getNextPendingBook(): Promise<BookQueue | undefined> {
    const [book] = await db
      .select()
      .from(booksQueue)
      .where(eq(booksQueue.status, "pending"))
      .orderBy(asc(booksQueue.position))
      .limit(1);
    return book || undefined;
  }

  async updateBookProgress(id: string, currentPage: number, totalPages?: number): Promise<void> {
    const updates: Partial<BookQueue> = { currentPage };
    if (totalPages !== undefined) {
      updates.totalPages = totalPages;
    }
    await db.update(booksQueue).set(updates).where(eq(booksQueue.id, id));
  }

  async markBookCompleted(id: string, pagesRead: number, totalPages: number, timeSpent: number): Promise<void> {
    const book = await this.getQueuedBook(id);
    if (!book) return;

    await db
      .update(booksQueue)
      .set({ 
        status: "completed", 
        completedAt: new Date(),
        currentPage: pagesRead,
        totalPages
      })
      .where(eq(booksQueue.id, id));

    await this.addToHistory({
      bookSlug: book.bookSlug,
      bookTitle: book.bookTitle,
      pagesRead,
      totalPages,
      timeSpentSeconds: Math.floor(timeSpent),
      wasCompleted: true
    });
  }

  // Reading History
  async getReadingHistory(): Promise<ReadingHistory[]> {
    return db.select().from(readingHistory).orderBy(desc(readingHistory.completedAt));
  }

  async addToHistory(entry: InsertReadingHistory): Promise<ReadingHistory> {
    const [created] = await db.insert(readingHistory).values(entry).returning();
    return created;
  }

  async getHistoryStats(): Promise<{ totalBooks: number; totalPages: number; totalTime: number; completedBooks: number }> {
    const history = await this.getReadingHistory();
    return {
      totalBooks: history.length,
      totalPages: history.reduce((sum, h) => sum + h.pagesRead, 0),
      totalTime: history.reduce((sum, h) => sum + h.timeSpentSeconds, 0),
      completedBooks: history.filter(h => h.wasCompleted).length
    };
  }

  // Scheduled Readings
  async getScheduledReadings(): Promise<ScheduledReading[]> {
    return db.select().from(scheduledReadings).orderBy(asc(scheduledReadings.scheduledTime));
  }

  async getScheduledReading(id: string): Promise<ScheduledReading | undefined> {
    const [schedule] = await db.select().from(scheduledReadings).where(eq(scheduledReadings.id, id));
    return schedule || undefined;
  }

  async createScheduledReading(schedule: InsertScheduledReading): Promise<ScheduledReading> {
    const [created] = await db.insert(scheduledReadings).values(schedule).returning();
    return created;
  }

  async updateScheduledReading(id: string, updates: Partial<InsertScheduledReading>): Promise<ScheduledReading | undefined> {
    const [updated] = await db
      .update(scheduledReadings)
      .set(updates)
      .where(eq(scheduledReadings.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteScheduledReading(id: string): Promise<void> {
    await db.delete(scheduledReadings).where(eq(scheduledReadings.id, id));
  }

  async getDueScheduledReadings(): Promise<ScheduledReading[]> {
    const now = new Date();
    return db
      .select()
      .from(scheduledReadings)
      .where(
        and(
          eq(scheduledReadings.isActive, true),
          lte(scheduledReadings.scheduledTime, now)
        )
      );
  }

  async markScheduleAsRun(id: string): Promise<void> {
    const schedule = await this.getScheduledReading(id);
    if (!schedule) return;

    if (schedule.repeatType === "once") {
      await db
        .update(scheduledReadings)
        .set({ isActive: false, lastRun: new Date() })
        .where(eq(scheduledReadings.id, id));
    } else {
      const nextRun = new Date(schedule.scheduledTime);
      if (schedule.repeatType === "daily") {
        nextRun.setDate(nextRun.getDate() + 1);
      } else if (schedule.repeatType === "weekly") {
        nextRun.setDate(nextRun.getDate() + 7);
      }
      await db
        .update(scheduledReadings)
        .set({ scheduledTime: nextRun, lastRun: new Date() })
        .where(eq(scheduledReadings.id, id));
    }
  }
}

export const storage = new DatabaseStorage();

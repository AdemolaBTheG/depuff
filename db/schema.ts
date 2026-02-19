import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export type ActionItem = {
  id: string;
  text: string;
  completed: boolean;
};

export const dailyLogs = sqliteTable('daily_logs', {
  // Primary Key is the DATE string (e.g., "2024-10-24").
  // This prevents duplicate rows for the same day and makes querying easy.
  date: text('date').primaryKey(),

  // Water Tracking (Synced with Widget) - in Milliliters
  waterIntake: integer('water_intake').default(0),

  // Did they finish the "Morning Protocol"?
  routineCompleted: integer('routine_completed', { mode: 'boolean' }).default(false),

  // The "Morning Score" cache.
  // Useful for graphing without joining the heavy scans table.
  dailyBloatScore: integer('daily_bloat_score'),

  // Sodium Status for the day (Calculated from Food Logs)
  // 'safe' | 'warning' | 'danger'
  sodiumStatus: text('sodium_status').default('safe'),

  // AI-generated daily checklist stringified as a JSON array
  actionableSteps: text('actionable_steps', { mode: 'json' }).$type<ActionItem[]>(),
});

export const faceScans = sqliteTable('face_scans', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  // ISO Timestamp (e.g., "2024-10-24T07:00:00.000Z")
  createdAt: text('created_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
 
  // The "Bloat Score" (0-100)
  score: integer('score').notNull(),

  // The AI Feedback ("Visible fluid retention under eyes")
  feedback: text('feedback'),

  // Specific areas flagged by AI (stored as JSON string: "['jaw', 'eyes']")
  flaggedAreas: text('flagged_areas'),

  // Local path to the image (file://...) so you can show it in the history
  // clear this if the user deletes the photo to save space
  localImageUri: text('local_image_uri'),
});

export const foodLogs = sqliteTable('food_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  // Link to the Daily Log (Foreign Key)
  logDate: text('log_date')
    .notNull()
    .references(() => dailyLogs.date),

  // Timestamp is crucial because LATE NIGHT salt is worse than morning salt
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),

  // 1. The AI's Visual Identification
  foodName: text('food_name'), // e.g., "Spicy Ramen Bowl"

  // 2. The "Depuff" Metrics (The only stats that matter)
  sodiumEstimateMg: integer('sodium_estimate_mg'), // e.g., 2200 (AI Guesses this)
  bloatRiskLevel: text('bloat_risk_level'), // 'safe' | 'caution' | 'danger'

  // 3. The "Why" (This is the feature that sells)
  // AI explains: "Broth contains hidden MSG and high sodium."
  aiReasoning: text('ai_reasoning'),

  // 4. Image storage (for the "Day Review")
  localImageUri: text('local_image_uri'),
});

export const InsertFoodLog = foodLogs.$inferInsert;
export const SelectFoodLog = foodLogs.$inferSelect;
export const InsertFaceScan = faceScans.$inferInsert;
export const SelectFaceScan = faceScans.$inferSelect;
export const InsertDailyLog = dailyLogs.$inferInsert;
export const SelectDailyLogn = dailyLogs.$inferSelect;

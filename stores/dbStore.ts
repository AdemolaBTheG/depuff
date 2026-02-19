import * as schema from "@/db/schema";
// import migrations from "@/drizzle/migrations";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
// import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import { openDatabaseSync } from "expo-sqlite";
import { create } from "zustand";

const SCHEMA_BOOTSTRAP_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS daily_logs (
  date text PRIMARY KEY NOT NULL,
  water_intake integer DEFAULT 0,
  routine_completed integer DEFAULT false,
  daily_bloat_score integer,
  sodium_status text DEFAULT 'safe'
);

CREATE TABLE IF NOT EXISTS face_scans (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  score integer NOT NULL,
  feedback text,
  flagged_areas text,
  local_image_uri text
);

CREATE TABLE IF NOT EXISTS food_logs (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  log_date text NOT NULL,
  created_at text DEFAULT CURRENT_TIMESTAMP,
  food_name text,
  sodium_estimate_mg integer,
  bloat_risk_level text,
  ai_reasoning text,
  local_image_uri text,
  FOREIGN KEY (log_date) REFERENCES daily_logs(date) ON UPDATE no action ON DELETE no action
);
`;

function ensureSchema(expoDb: ReturnType<typeof openDatabaseSync>) {
    expoDb.execSync(SCHEMA_BOOTSTRAP_SQL);
}

interface DatabaseState {
    expoDb: ReturnType<typeof openDatabaseSync> | null;
    db: ExpoSQLiteDatabase<typeof schema> | null;
    isLoading: boolean;

    initializeDb: (options?: {
        name?: string;
        useNewConnection?: boolean;
        enableChangeListener?: boolean;
    }) => Promise<void>;
    setNewDbInstance: (dbName: string) => Promise<void>;

    setExpoDb: (expoDb: ReturnType<typeof openDatabaseSync>) => void;
    setDb: (db: ExpoSQLiteDatabase<typeof schema>) => void;
}

export const useDbStore = create<DatabaseState>((set, get) => ({
    expoDb: null,
    db: null,
    isLoading: false,

    initializeDb: async (options = {}) => {
        const {
            name = "debloat.db",
            useNewConnection = false,
            enableChangeListener = true,
        } = options;

        // prevent re-init only if db is a real drizzle client
        const existing = get().db as any;
        if (existing && typeof existing.insert === "function") return;

        set({ isLoading: true });

        try {
            const expoDb = openDatabaseSync(name, {
                useNewConnection,
                enableChangeListener,
            });

            ensureSchema(expoDb);

            const db = drizzle(expoDb, { schema });
            // await migrate(db, migrations);

            set({ expoDb, db, isLoading: false });
        } catch (e) {
            set({ isLoading: false });
            throw e;
        }
    },

    setNewDbInstance: async (dbName: string) => {
        try {
            const { expoDb } = get();

            await expoDb?.closeAsync();

            set({ expoDb: null, db: null });

            const newExpoDb = openDatabaseSync(dbName, {
                useNewConnection: true,
                enableChangeListener: true,
            });

            if (!newExpoDb) {
                throw new Error("Failed to create new database instance");
            }

            ensureSchema(newExpoDb);

            const newDb = drizzle(newExpoDb, { schema });

            set({ expoDb: newExpoDb, db: newDb });
        } catch (error) {
            console.error("Error setting new database instance", error);
            throw error;
        }
    },

    setExpoDb: (expoDb: ReturnType<typeof openDatabaseSync>) => {
        set({ expoDb });
    },

    setDb: (db: ExpoSQLiteDatabase<typeof schema>) => {
        set({ db });
    },
}));

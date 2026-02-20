import * as schema from "@/db/schema";
import migrations from "@/drizzle/migrations";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import { openDatabaseSync } from "expo-sqlite";
import { create } from "zustand";

function hasLegacyTables(expoDb: ReturnType<typeof openDatabaseSync>): boolean {
    const tables = expoDb.getAllSync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('daily_logs', 'face_scans', 'food_logs')"
    );
    return tables.length > 0;
}

function ensureLegacyColumns(expoDb: ReturnType<typeof openDatabaseSync>) {
    const dailyLogColumns = expoDb.getAllSync<{ name: string }>(`PRAGMA table_info(daily_logs);`);
    const hasActionableSteps = dailyLogColumns.some((column) => column.name === "actionable_steps");
    if (!hasActionableSteps) {
        expoDb.execSync("ALTER TABLE daily_logs ADD COLUMN actionable_steps text;");
    }
}

function markInitialMigrationApplied(expoDb: ReturnType<typeof openDatabaseSync>) {
    expoDb.execSync(`
        CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
            id SERIAL PRIMARY KEY,
            hash text NOT NULL,
            created_at numeric
        );
    `);

    const existingMigrationRows = expoDb.getAllSync<{ created_at: number }>(
        'SELECT created_at FROM "__drizzle_migrations" ORDER BY created_at DESC LIMIT 1'
    );

    if (existingMigrationRows.length > 0) return;

    const journalEntries = migrations?.journal?.entries ?? [];
    const lastEntry = journalEntries[journalEntries.length - 1];
    if (!lastEntry) return;

    expoDb.execSync(
        `INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES ('', ${Number(lastEntry.when)});`
    );
}

async function runMigrationsWithLegacyFallback(
    db: ExpoSQLiteDatabase<typeof schema>,
    expoDb: ReturnType<typeof openDatabaseSync>
) {
    try {
        await migrate(db, migrations);
        return;
    } catch (error) {
        if (!hasLegacyTables(expoDb)) {
            throw error;
        }

        ensureLegacyColumns(expoDb);
        markInitialMigrationApplied(expoDb);
        await migrate(db, migrations);
    }
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
            name = "nobloat.db",
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

            const db = drizzle(expoDb, { schema });
            await runMigrationsWithLegacyFallback(db, expoDb);

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

            const newDb = drizzle(newExpoDb, { schema });
            await runMigrationsWithLegacyFallback(newDb, newExpoDb);

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

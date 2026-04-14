"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemSettings = exports.listeningHistory = exports.tracks = exports.users = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    username: (0, pg_core_1.varchar)('username', { length: 50 }).notNull().unique(),
    passwordHash: (0, pg_core_1.text)('password_hash').notNull(),
    role: (0, pg_core_1.varchar)('role', { length: 20 }).notNull().default('user'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
exports.tracks = (0, pg_core_1.pgTable)('tracks', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    filePath: (0, pg_core_1.text)('file_path').notNull().unique(),
    fileName: (0, pg_core_1.varchar)('file_name', { length: 255 }).notNull(),
    artist: (0, pg_core_1.varchar)('artist', { length: 255 }),
    album: (0, pg_core_1.varchar)('album', { length: 255 }),
    title: (0, pg_core_1.varchar)('title', { length: 255 }),
    genre: (0, pg_core_1.varchar)('genre', { length: 100 }),
    decade: (0, pg_core_1.varchar)('decade', { length: 20 }),
    isCategorized: (0, pg_core_1.boolean)('is_categorized').default(false),
    metadata: (0, pg_core_1.jsonb)('metadata'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
exports.listeningHistory = (0, pg_core_1.pgTable)('listening_history', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id),
    trackId: (0, pg_core_1.uuid)('track_id').references(() => exports.tracks.id),
    timestamp: (0, pg_core_1.timestamp)('timestamp').defaultNow(),
    completionPercentage: (0, pg_core_1.integer)('completion_percentage'),
});
exports.systemSettings = (0, pg_core_1.pgTable)('system_settings', {
    key: (0, pg_core_1.varchar)('key', { length: 100 }).primaryKey(),
    value: (0, pg_core_1.text)('value').notNull(), // This will store encrypted values for keys
    description: (0, pg_core_1.text)('description'),
});

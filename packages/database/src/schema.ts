import { integer, jsonb, pgTable, text, timestamp, boolean, uuid, varchar, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const listeningEvents = pgTable('listening_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  trackId: uuid('track_id').references(() => tracks.id).notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  durationSeconds: integer('duration_seconds'),
}, (table) => ({
  userIdIdx: index('listening_events_user_id_idx').on(table.userId),
  trackIdIdx: index('listening_events_track_id_idx').on(table.trackId),
}));

export const tracks = pgTable('tracks', {
  id: uuid('id').defaultRandom().primaryKey(),
  filePath: text('file_path').notNull().unique(),
  fileName: text('file_name').notNull(),
  title: text('title'),
  artist: text('artist'),
  album: text('album'),
  genre: text('genre'),
  decade: text('decade'),
  year: integer('year'),
  duration: integer('duration'),
  metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
  artworkHash: text('artwork_hash'),
  artworkMimeType: text('artwork_mime_type'),
  isCategorized: boolean('is_categorized').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  artistIdx: index('tracks_artist_idx').on(table.artist),
  genreIdx: index('tracks_genre_idx').on(table.genre),
  decadeIdx: index('tracks_decade_idx').on(table.decade),
}));

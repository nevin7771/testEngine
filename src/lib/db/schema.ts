import { sql } from 'drizzle-orm';
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey(),
  content: text('content').notNull(),
  chatId: text('chatId').notNull(),
  messageId: text('messageId').notNull(),
  role: text('type', { enum: ['assistant', 'user'] }),
  metadata: text('metadata', {
    mode: 'json',
  }),
});

interface File {
  name: string;
  fileId: string;
}

// Change the focusMode field to handle multiple values
export const chats = sqliteTable('chats', {
  // Existing fields
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: text('createdAt').notNull(),
  // Updated field - store as comma-separated string or JSON
  focusMode: text('focusMode')
    .notNull()
    .default(sql`'["generalAgent"]'`),
  // Renamed from focusMode to focusModes
  files: text('files', { mode: 'json' }).$type<File[]>().default(sql`'[]'`),
});
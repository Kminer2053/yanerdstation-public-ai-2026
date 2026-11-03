import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const workbench=sqliteTable('workbench',{id:text('id').primaryKey(),revision:integer('revision').notNull(),savedAt:text('saved_at').notNull(),body:text('body').notNull(),operationId:text('operation_id').notNull()});
export const audit=sqliteTable('audit',{id:text('id').primaryKey(),revision:integer('revision').notNull(),actor:text('actor').notNull(),savedAt:text('saved_at').notNull(),kind:text('kind').notNull(),body:text('body').notNull()});
export const facilityNotes=sqliteTable('facility_notes',{facilityId:text('facility_id').primaryKey(),body:text('body').notNull(),updatedAt:text('updated_at').notNull(),actor:text('actor').notNull()});

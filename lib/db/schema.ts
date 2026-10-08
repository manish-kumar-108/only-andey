import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const pricing = sqliteTable('pricing', {
  id: text('id').primaryKey(), 
  userId: text('userId').notNull(),
  boiled: text('boiled', { mode: 'json' }).$type<number[]>().notNull(), 
  raw: text('raw', { mode: 'json' }).$type<number[]>().notNull(),
  version: integer('version').notNull().default(1), 
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const orders = sqliteTable('egg_orders', {
  id: text('id').primaryKey(), 
  userId: text('userId').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  name: text('name').notNull().default(''),
  hostel: text('hostel').notNull().default('Uni 1'),
  boiledQuantity: integer('boiled_quantity').notNull(), 
  rawQuantity: integer('raw_quantity').notNull(),
  boiledPrice: real('boiled_price').notNull(), 
  rawPrice: real('raw_price').notNull(),
  boiledSubtotal: real('boiled_subtotal').notNull(), 
  rawSubtotal: real('raw_subtotal').notNull(),
  deliveryCharge: real('delivery_charge').notNull().default(0),
  roomDelivery: integer('room_delivery').notNull().default(0),
  total: real('total').notNull(), 
  room: text('room').notNull(), 
  phone: text('phone').notNull(),
  status: text('status').notNull().default('New'), 
  paymentStatus: text('payment_status').notNull().default('Pending'),
})

export const shopSettings = sqliteTable('shop_settings', {
  id: text('id').primaryKey(),
  isOpen: integer('is_open').notNull().default(1),
  activeHostel: text('active_hostel').notNull().default('Both'),
  rawAvailable: integer('raw_available').notNull().default(1),
  boiledAvailable: integer('boiled_available').notNull().default(1),
  deliveryCharge: real('delivery_charge').notNull().default(0),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export type OrderRow = typeof orders.$inferSelect

import { db, ensureDb } from '@/lib/db'
import { shopSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminSession } from '@/lib/auth'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  headers() // force dynamic without relying solely on export const dynamic
  try {
    await ensureDb()
    const [row] = await db.select().from(shopSettings).where(eq(shopSettings.id, 'store')).limit(1)
    const isOpen = row ? row.isOpen === 1 : true // default open
    const activeHostel = row ? row.activeHostel : 'Both'
    const rawAvailable = row ? (row.rawAvailable !== undefined && row.rawAvailable !== null ? row.rawAvailable === 1 : true) : true
    const boiledAvailable = row ? (row.boiledAvailable !== undefined && row.boiledAvailable !== null ? row.boiledAvailable === 1 : true) : true
    const deliveryCharge = row ? (row.deliveryCharge !== undefined && row.deliveryCharge !== null ? Number(row.deliveryCharge) : 0) : 0
    return Response.json(
      { isOpen, activeHostel, rawAvailable, boiledAvailable, deliveryCharge },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  } catch (error) {
    console.error('Error fetching shop status:', error)
    return Response.json({ isOpen: false, activeHostel: 'Both', rawAvailable: true, boiledAvailable: true, deliveryCharge: 0 }, { headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function PATCH(req: Request) {
  const session = await getAdminSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await ensureDb()
    const { isOpen, activeHostel, rawAvailable, boiledAvailable, deliveryCharge } = await req.json()
    if (isOpen !== undefined && typeof isOpen !== 'boolean') return Response.json({ error: 'Invalid value' }, { status: 400 })
    if (rawAvailable !== undefined && typeof rawAvailable !== 'boolean') return Response.json({ error: 'Invalid value' }, { status: 400 })
    if (boiledAvailable !== undefined && typeof boiledAvailable !== 'boolean') return Response.json({ error: 'Invalid value' }, { status: 400 })
    if (deliveryCharge !== undefined && (typeof deliveryCharge !== 'number' || deliveryCharge < 0)) return Response.json({ error: 'Invalid delivery charge' }, { status: 400 })

    const [existing] = await db.select().from(shopSettings).where(eq(shopSettings.id, 'store')).limit(1)
    if (existing) {
      await db.update(shopSettings)
        .set({ 
          isOpen: isOpen !== undefined ? (isOpen ? 1 : 0) : existing.isOpen, 
          activeHostel: activeHostel !== undefined ? activeHostel : existing.activeHostel,
          rawAvailable: rawAvailable !== undefined ? (rawAvailable ? 1 : 0) : existing.rawAvailable,
          boiledAvailable: boiledAvailable !== undefined ? (boiledAvailable ? 1 : 0) : existing.boiledAvailable,
          deliveryCharge: deliveryCharge !== undefined ? deliveryCharge : existing.deliveryCharge,
          updatedAt: new Date().toISOString() 
        })
        .where(eq(shopSettings.id, 'store'))
    } else {
      await db.insert(shopSettings)
        .values({ 
          id: 'store', 
          isOpen: isOpen !== undefined ? (isOpen ? 1 : 0) : 1, 
          activeHostel: activeHostel || 'Both',
          rawAvailable: rawAvailable !== undefined ? (rawAvailable ? 1 : 0) : 1,
          boiledAvailable: boiledAvailable !== undefined ? (boiledAvailable ? 1 : 0) : 1,
          deliveryCharge: deliveryCharge !== undefined ? deliveryCharge : 0,
          updatedAt: new Date().toISOString() 
        })
    }

    const [updated] = await db.select().from(shopSettings).where(eq(shopSettings.id, 'store')).limit(1)

    return Response.json({ 
      isOpen: updated ? updated.isOpen === 1 : true, 
      activeHostel: updated ? updated.activeHostel : 'Both',
      rawAvailable: updated ? updated.rawAvailable === 1 : true,
      boiledAvailable: updated ? updated.boiledAvailable === 1 : true,
      deliveryCharge: updated ? Number(updated.deliveryCharge) : 0
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Error updating shop status:', error)
    return Response.json({ error: 'Failed to update' }, { status: 500 })
  }
}

import { EggStore } from '@/components/egg-store'
import { db, ensureDb } from '@/lib/db'
import { pricing, shopSettings } from '@/lib/db/schema'
import { OWNER_ID, type Pricing } from '@/lib/pricing'
import { and, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export default async function Page() {
  let initialPricing: Pricing | undefined
  let initialShopStatus: { isOpen: boolean; activeHostel?: string; rawAvailable: boolean; boiledAvailable: boolean; deliveryCharge: number } | undefined

  try {
    await ensureDb()
    const [row] = await db.select({ boiled: pricing.boiled, raw: pricing.raw, version: pricing.version })
      .from(pricing).where(and(eq(pricing.id, 'store'), eq(pricing.userId, OWNER_ID)))
    initialPricing = row
  } catch (error) {
    console.error('Initial pricing lookup failed', error)
  }

  try {
    const [statusRow] = await db.select().from(shopSettings).where(eq(shopSettings.id, 'store')).limit(1)
    if (statusRow) {
      initialShopStatus = {
        isOpen: statusRow.isOpen === 1,
        activeHostel: statusRow.activeHostel,
        rawAvailable: statusRow.rawAvailable !== undefined && statusRow.rawAvailable !== null ? statusRow.rawAvailable === 1 : true,
        boiledAvailable: statusRow.boiledAvailable !== undefined && statusRow.boiledAvailable !== null ? statusRow.boiledAvailable === 1 : true,
        deliveryCharge: statusRow.deliveryCharge !== undefined && statusRow.deliveryCharge !== null ? Number(statusRow.deliveryCharge) : 0,
      }
    }
  } catch (error) {
    console.error('Initial shop status lookup failed', error)
  }

  return <EggStore initialPricing={initialPricing} initialShopStatus={initialShopStatus} />
}


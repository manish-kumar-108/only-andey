import { db } from '@/lib/db'
import { pricing } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { getAdminSession } from '@/lib/auth'
import { OWNER_ID } from '@/lib/pricing'
import { pricingInput } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getAdminSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [config] = await db
      .select()
      .from(pricing)
      .where(and(eq(pricing.id, 'store'), eq(pricing.userId, OWNER_ID)))
      .limit(1)

    if (!config) throw new Error('Pricing row not found')

    return Response.json({ boiled: config.boiled, raw: config.raw, version: config.version })
  } catch (error) {
    console.error('Error fetching pricing:', error)
    return Response.json({ error: 'Failed to fetch pricing' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const session = await getAdminSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = pricingInput.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid pricing format' }, { status: 400 })
  }
  const { boiled, raw } = parsed.data

  try {
    const [existing] = await db
      .select({ version: pricing.version })
      .from(pricing)
      .where(and(eq(pricing.id, 'store'), eq(pricing.userId, OWNER_ID)))
      .limit(1)

    let updated
    if (existing) {
      const res = await db
        .update(pricing)
        .set({ boiled, raw, version: existing.version + 1, updatedAt: new Date().toISOString() })
        .where(and(eq(pricing.id, 'store'), eq(pricing.userId, OWNER_ID)))
        .returning()
      updated = res[0]
    } else {
      const res = await db
        .insert(pricing)
        .values({ id: 'store', userId: OWNER_ID, boiled, raw, version: 1, updatedAt: new Date().toISOString() })
        .returning()
      updated = res[0]
    }

    if (!updated) throw new Error('Upsert returned nothing')
    return Response.json({ success: true, pricing: updated })
  } catch (error) {
    console.error('Error updating pricing:', error)
    return Response.json({ error: 'Failed to update pricing' }, { status: 500 })
  }
}

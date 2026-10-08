import { db, ensureDb } from '@/lib/db'
import { orders, pricing, shopSettings } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { calculateOrder, OWNER_ID } from '@/lib/pricing'
import { orderInput } from '@/lib/validation'

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.includes('application/json')) return Response.json({ error: 'Invalid request.' }, { status: 415 })
  if (Number(request.headers.get('content-length') ?? 0) > 4096) return Response.json({ error: 'Request too large.' }, { status: 413 })
  let body: unknown
  try { body = await request.json() } catch { return Response.json({ error: 'Please check your order and try again.' }, { status: 400 }) }
  const parsed = orderInput.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? 'Check your room and phone number.' }, { status: 400 })
  const input = parsed.data
  try {
    // Block orders when shop is closed or items are out of stock
    await ensureDb()
    const [shopRow] = await db.select().from(shopSettings).where(eq(shopSettings.id, 'store')).limit(1)
    const isOpen = shopRow ? shopRow.isOpen === 1 : true;
    if (!isOpen) {
      return Response.json({ error: 'We\'re closed right now. Orders will open again tomorrow!' }, { status: 403 })
    }

    const isRawAvailable = shopRow ? (shopRow.rawAvailable !== undefined && shopRow.rawAvailable !== null ? shopRow.rawAvailable === 1 : true) : true
    const isBoiledAvailable = shopRow ? (shopRow.boiledAvailable !== undefined && shopRow.boiledAvailable !== null ? shopRow.boiledAvailable === 1 : true) : true

    if (!isRawAvailable && input.raw > 0) {
      return Response.json({ error: 'Raw eggs are currently out of stock.' }, { status: 400 })
    }
    if (!isBoiledAvailable && input.boiled > 0) {
      return Response.json({ error: 'Boiled eggs are currently out of stock.' }, { status: 400 })
    }

    const result = await db.transaction(async (tx) => {
      const [config] = await tx.select().from(pricing).where(and(eq(pricing.id, 'store'), eq(pricing.userId, OWNER_ID))).limit(1)
      if (!config) throw new Error('Pricing unavailable')
      const [existing] = await tx.select().from(orders).where(and(eq(orders.id, input.id), eq(orders.userId, OWNER_ID))).limit(1)
      if (existing) {
        if (existing.room !== input.room || existing.phone !== input.phone || existing.boiledQuantity !== input.boiled || existing.rawQuantity !== input.raw) return { conflict: true as const }
        return { order: existing }
      }
      if (config.version !== input.version) return { changed: true as const }
      const deliveryCharge = (input.roomDelivery && shopRow?.deliveryCharge) ? Number(shopRow.deliveryCharge) : 0
      const totals = calculateOrder(input, config, deliveryCharge, !!input.roomDelivery)
      
      const res = await tx.insert(orders).values({ 
        id: input.id, 
        userId: OWNER_ID, 
        name: input.name, 
        hostel: input.hostel, 
        boiledQuantity: input.boiled, 
        rawQuantity: input.raw, 
        boiledPrice: totals.boiledPrice, 
        rawPrice: totals.rawPrice, 
        boiledSubtotal: totals.boiledSubtotal, 
        rawSubtotal: totals.rawSubtotal, 
        deliveryCharge: totals.deliveryCharge,
        roomDelivery: input.roomDelivery ? 1 : 0,
        total: totals.total, 
        room: input.room, 
        phone: input.phone 
      }).onConflictDoNothing().returning()
      const order = res[0]
      if (!order) return { conflict: true as const }
      return { order }
    })
    
    if ('changed' in result) return Response.json({ error: 'Prices have just been updated. Review your total and place your order again.', code: 'PRICING_CHANGED' }, { status: 409 })
    if ('conflict' in result) return Response.json({ error: 'This order request has already been used. Please retry.' }, { status: 409 })
    
    const o = result.order

    // --- WHATSAPP NOTIFICATIONS ---
    const phones = (process.env.WHATSAPP_PHONE || '').split(',');
    const keys = (process.env.WHATSAPP_APIKEY || '').split(',');
    
    if (phones.length > 0 && keys.length > 0) {
      const deliveryText = o.roomDelivery ? `\nRoom Delivery: Yes (+₹${o.deliveryCharge})` : '\nRoom Delivery: No';
      const text = `🍳 *New Order! (${o.hostel}, Room ${o.room})*\n\nName: ${o.name}\nBoiled: ${o.boiledQuantity}\nRaw: ${o.rawQuantity}${deliveryText}\nTotal: ₹${o.total}\nCustomer Phone: ${o.phone}`;
      const encodedText = encodeURIComponent(text);

      phones.forEach((phone, index) => {
        const apikey = keys[index] || keys[0]; // fallback to first key if missing
        if (phone.trim() && apikey.trim()) {
          try {
            const url = `https://api.callmebot.com/whatsapp.php?phone=${phone.trim()}&text=${encodedText}&apikey=${apikey.trim()}`;
            fetch(url).then(res => {
              if (!res.ok) console.error("WhatsApp notification failed for " + phone + ":", res.status)
            }).catch(e => console.error("WhatsApp network error for " + phone + ":", e));
          } catch (err) {
            console.error("WhatsApp setup failed for " + phone + ":", err);
          }
        }
      });
    }
    // -----------------------------

    return Response.json({ 
      id: o.id, 
      name: o.name, 
      hostel: o.hostel, 
      boiled: o.boiledQuantity, 
      raw: o.rawQuantity, 
      boiledPrice: Number(o.boiledPrice), 
      rawPrice: Number(o.rawPrice), 
      boiledSubtotal: Number(o.boiledSubtotal), 
      rawSubtotal: Number(o.rawSubtotal), 
      deliveryCharge: Number(o.deliveryCharge ?? 0),
      roomDelivery: o.roomDelivery === 1,
      total: Number(o.total), 
      room: o.room, 
      phone: o.phone, 
      createdAt: o.createdAt 
    }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Order submission failed', error)
    return Response.json({ error: 'We couldn’t confirm your order. Please try again; retrying won’t place it twice.' }, { status: 503 })
  }
}

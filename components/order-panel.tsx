'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, Egg, LoaderCircle, LockKeyhole, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { calculateOrder, money, type Pricing, type Quantities, type Receipt } from '@/lib/pricing'

export function OrderPanel({ 
  quantities, 
  pricing, 
  step, 
  setStep, 
  receipt, 
  onSubmit, 
  pending, 
  error, 
  onReset, 
  activeHostel = 'Both',
  deliveryCharge = 0
}: { 
  quantities: Quantities; 
  pricing?: Pricing; 
  step: 'cart' | 'details'; 
  setStep: (step: 'cart' | 'details') => void; 
  receipt: Receipt | null; 
  onSubmit: (name: string, hostel: string, room: string, phone: string, roomDelivery: boolean) => Promise<void>; 
  pending: boolean; 
  error: string; 
  onReset: () => void; 
  activeHostel?: string;
  deliveryCharge?: number;
}) {
  const [name, setName] = useState('')
  const [hostel, setHostel] = useState('Uni 1')
  const [room, setRoom] = useState('')
  const [phone, setPhone] = useState('')
  const [roomDelivery, setRoomDelivery] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; room?: string; phone?: string }>({})
  useEffect(() => {
    if (activeHostel === 'Uni 1' || activeHostel === 'Uni 2') setHostel(activeHostel)
  }, [activeHostel])
  const count = quantities.boiled + quantities.raw
  const totals = pricing ? calculateOrder(quantities, pricing, deliveryCharge, roomDelivery) : null
  const panel = useRef<HTMLElement>(null)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    panel.current?.querySelectorAll<HTMLElement>('.order-lines > div, .total-line strong').forEach(element => {
      const opacity = getComputedStyle(element).opacity
      element.getAnimations().forEach(animation => animation.cancel())
      element.animate([{ opacity }, { opacity: 0.65 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' })
    })
  }, [quantities.boiled, quantities.raw, pricing, roomDelivery, deliveryCharge])
  async function submit(event: FormEvent) {
    event.preventDefault()
    const next = { name: name.trim().length > 0 ? undefined : 'Please enter your name.', room: /^\d{3}$/.test(room.trim()) ? undefined : 'Room number must be exactly 3 digits.', phone: /^\d{10}$/.test(phone.replace(/[\s()-]/g, '')) ? undefined : 'Phone number must be exactly 10 digits.' }
    setErrors(next)
    if (!next.name && !next.room && !next.phone) await onSubmit(name.trim(), hostel, room.trim(), phone, roomDelivery)
  }
  if (receipt) return <aside className="order-panel receipt-panel" id="your-order" aria-live="polite">
    <span className="receipt-check"><Check size={30} /></span><p className="eyebrow">ORDER PLACED</p><h2>Egg-cellent choice.</h2><p className="receipt-intro">{receipt.roomDelivery ? <>We&apos;ll deliver your eggs straight to<br />Room {receipt.room}.</> : <>Pickup order for<br />Room {receipt.room}.</>}</p>
    <Separator />
    <div className="order-lines">
      {receipt.boiled > 0 && <div><span>{receipt.boiled} Boiled Eggs</span><strong>{money(receipt.boiledSubtotal)}</strong></div>}
      {receipt.raw > 0 && <div><span>{receipt.raw} Raw Eggs</span><strong>{money(receipt.rawSubtotal)}</strong></div>}
      {receipt.roomDelivery && (receipt.deliveryCharge ?? 0) > 0 && <div><span>Room delivery fee</span><strong>{money(receipt.deliveryCharge!)}</strong></div>}
    </div>
    <div className="total-line"><span>Total to pay</span><strong>{money(receipt.total)}</strong></div><p className="payment-note">Pay when we deliver. Cash or UPI.</p><p className="receipt-id">Order #{receipt.id.slice(0, 8).toUpperCase()}</p>
    <Button className="w-full h-12" onClick={onReset}>Start another order <ArrowRight data-icon="inline-end" /></Button>
  </aside>
  return <aside ref={panel} className="order-panel" id="your-order">
    <div className="order-panel-heading"><div><p className="eyebrow">FRESH PICKS</p><h2>{step === 'details' ? 'Where to?' : 'Your order'}</h2></div><span className="order-step">{step === 'cart' ? '01' : '02'} <span>/ 02</span></span></div>
    {step === 'details' && <button className="back-to-cart" onClick={() => setStep('cart')} disabled={pending}><ArrowLeft size={14} /> Back to your eggs</button>}
    {count === 0 ? <div className="empty-order"><Egg size={36} strokeWidth={1} /><p>A little hungry?</p><span>Tap an egg to start your order.</span></div> : <div className="order-lines" aria-live="polite">
      {quantities.boiled > 0 && <div><span>Boiled eggs<small>{quantities.boiled} × {totals ? money(totals.boiledPrice) : '—'} · salt included</small></span><strong>{totals ? money(totals.boiledSubtotal) : '—'}</strong></div>}
      {quantities.raw > 0 && <div><span>Raw eggs<small>{quantities.raw} × {totals ? money(totals.rawPrice) : '—'}</small></span><strong>{totals ? money(totals.rawSubtotal) : '—'}</strong></div>}
    </div>}
    <Separator />
    <div className="delivery-line">
      <span>Room delivery</span>
      <span>{roomDelivery ? (deliveryCharge > 0 ? money(deliveryCharge) : 'On us') : (deliveryCharge > 0 ? 'Not selected' : 'On us')}</span>
    </div>
    <div className="total-line"><span>Total</span><strong>{totals ? money(totals.total) : count ? '—' : money(0)}</strong></div>
    {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}
    {step === 'details' ? <form onSubmit={submit} noValidate><FieldGroup className="gap-4"><Field data-invalid={!!errors.name}><FieldLabel htmlFor="name">Your name</FieldLabel><Input id="name" placeholder="e.g. Rahul" value={name} maxLength={100} onChange={e => setName(e.target.value)} aria-invalid={!!errors.name} disabled={pending} required autoComplete="name" className="h-11" />{errors.name && <FieldError>{errors.name}</FieldError>}</Field><Field><FieldLabel>Hostel</FieldLabel><div className="flex gap-3"><label className={`flex-1 rounded-lg border-2 p-3 text-center text-sm font-bold transition-all ${activeHostel === 'Uni 2' ? 'opacity-40 cursor-not-allowed border-input bg-muted text-muted-foreground' : hostel === 'Uni 1' ? 'cursor-pointer border-[#DD5B3B] bg-[#DD5B3B]/10 text-[#DD5B3B]' : 'cursor-pointer border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}><input type="radio" name="hostel" value="Uni 1" checked={hostel === 'Uni 1'} onChange={e => setHostel(e.target.value)} disabled={pending || activeHostel === 'Uni 2'} className="sr-only" />Uni 1</label><label className={`flex-1 rounded-lg border-2 p-3 text-center text-sm font-bold transition-all ${activeHostel === 'Uni 1' ? 'opacity-40 cursor-not-allowed border-input bg-muted text-muted-foreground' : hostel === 'Uni 2' ? 'cursor-pointer border-[#DD5B3B] bg-[#DD5B3B]/10 text-[#DD5B3B]' : 'cursor-pointer border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}><input type="radio" name="hostel" value="Uni 2" checked={hostel === 'Uni 2'} onChange={e => setHostel(e.target.value)} disabled={pending || activeHostel === 'Uni 1'} className="sr-only" />Uni 2</label></div></Field><Field data-invalid={!!errors.room}><FieldLabel htmlFor="room">Room number</FieldLabel><Input id="room" placeholder="e.g. 013" value={room} maxLength={3} onChange={e => setRoom(e.target.value)} aria-invalid={!!errors.room} disabled={pending} required autoComplete="off" className="h-11" />{errors.room && <FieldError>{errors.room}</FieldError>}</Field><Field data-invalid={!!errors.phone}><FieldLabel htmlFor="phone">Phone number</FieldLabel><Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="Your 10-digit mobile number" value={phone} maxLength={10} onChange={e => setPhone(e.target.value)} aria-invalid={!!errors.phone} disabled={pending} required className="h-11" />{errors.phone && <FieldError>{errors.phone}</FieldError>}</Field><Field><label className="flex items-center gap-3 p-3.5 rounded-xl border border-input bg-background hover:bg-accent/40 cursor-pointer transition-all select-none"><input type="checkbox" id="room-delivery-checkbox" checked={roomDelivery} onChange={e => setRoomDelivery(e.target.checked)} disabled={pending} className="w-4 h-4 accent-[#DD5B3B] rounded cursor-pointer" /><div className="flex-1 flex items-center justify-between"><div><span className="text-sm font-bold text-[#2A2420] block">Room delivery</span><span className="text-[11px] text-muted-foreground block">{deliveryCharge > 0 ? 'Delivered directly to your room door' : 'Complimentary room delivery'}</span></div><span className="text-xs font-extrabold text-[#DD5B3B] bg-[#DD5B3B]/10 px-2.5 py-1 rounded-full">{deliveryCharge > 0 ? `+${money(deliveryCharge)}` : 'FREE'}</span></div></label></Field><Button type="submit" className="w-full h-12" disabled={pending || !count || !pricing}>{pending ? <><LoaderCircle className="animate-spin" data-icon="inline-start" />Placing your order…</> : <>Place order · {money(totals?.total ?? 0)}<ArrowRight data-icon="inline-end" /></>}</Button></FieldGroup></form> : <Button className="w-full h-12" disabled={!count || !pricing} onClick={() => setStep('details')}>Continue <ArrowRight data-icon="inline-end" /></Button>}
    <p className="payment-note"><LockKeyhole size={12} /> No payment now. Pay at your door.</p><div className="panel-footer"><MapPin size={14} /><span>Your hostel. Your room. Your eggs.</span></div>
  </aside>
}

'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { ArrowDown, ArrowUpRight, ShoppingBag, MessageCircle } from 'lucide-react'
import { EggProduct } from '@/components/egg-product'
import { OrderPanel } from '@/components/order-panel'
import { ClosedScreen } from '@/components/closed-screen'
import { type EggType, type Pricing, type Quantities, type Receipt } from '@/lib/pricing'

async function fetchPricing(url: string): Promise<Pricing> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Couldn’t load prices.')
  return response.json()
}
async function fetchShopStatus(url: string): Promise<{ isOpen: boolean; activeHostel?: string; rawAvailable?: boolean; boiledAvailable?: boolean; deliveryCharge?: number }> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Failed to fetch status')
  return response.json()
}
export function EggStore({ 
  initialPricing, 
  initialShopStatus 
}: { 
  initialPricing?: Pricing; 
  initialShopStatus?: { isOpen: boolean; activeHostel?: string; rawAvailable?: boolean; boiledAvailable?: boolean; deliveryCharge?: number } 
}) {
  const { data: shopStatus, error: shopError } = useSWR('/api/shop-status', fetchShopStatus, { fallbackData: initialShopStatus, refreshInterval: 15000, revalidateOnFocus: true })
  const { data: pricing, error: pricingError, mutate } = useSWR<Pricing>('/api/pricing', fetchPricing, { fallbackData: initialPricing, revalidateOnMount: !initialPricing, refreshInterval: 30000, revalidateOnFocus: true })
  const [quantities, setQuantities] = useState<Quantities>({ boiled: 0, raw: 0 })
  const [step, setStep] = useState<'cart' | 'details'>('cart')
  const [pending, setPending] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const submission = useRef<{ fingerprint: string; id: string } | null>(null)
  const submitting = useRef(false)
  const confirmationAudio = useRef<HTMLAudioElement>(null)
  useEffect(() => setReady(true), [])

  const isBoiledAvailable = shopStatus?.boiledAvailable !== false
  const isRawAvailable = shopStatus?.rawAvailable !== false

  useEffect(() => {
    if (!isBoiledAvailable && quantities.boiled > 0) {
      setQuantities(q => ({ ...q, boiled: 0 }))
    }
    if (!isRawAvailable && quantities.raw > 0) {
      setQuantities(q => ({ ...q, raw: 0 }))
    }
  }, [isBoiledAvailable, isRawAvailable])

  const count = quantities.boiled + quantities.raw
  const badge = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const element = badge.current
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const transform = getComputedStyle(element).transform
    if (element.getAnimations) element.getAnimations().forEach(animation => animation.cancel())
    element.animate([{ transform }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 180, easing: 'ease-out' })
  }, [count])
  function change(type: EggType, delta: number) {
    if (type === 'boiled' && !isBoiledAvailable && delta > 0) return
    if (type === 'raw' && !isRawAvailable && delta > 0) return
    if (delta > 0) {
      const audio = new Audio('/audio/egg-add.wav')
      audio.volume = 0.5
      audio.play().catch(() => { })
    }
    setReceipt(null)
    setError('')
    setQuantities(q => ({ ...q, [type]: Math.max(0, q[type] + delta) }))
  }
  async function submit(name: string, hostel: string, room: string, phone: string, roomDelivery: boolean = false) {
    if (!pricing || submitting.current) return
    submitting.current = true
    setPending(true)
    setError('')
    const fingerprint = JSON.stringify({ quantities, name, hostel, room, phone, roomDelivery })
    if (submission.current?.fingerprint !== fingerprint) submission.current = { fingerprint, id: crypto.randomUUID() }
    try {
      const audio = confirmationAudio.current
      if (audio) {
        audio.muted = true
        try {
          await audio.play()
          audio.pause()
          audio.currentTime = 0
        } catch { }
        audio.muted = false
      }
      const response = await fetch('/api/orders', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          ...quantities, 
          name, 
          hostel, 
          room, 
          phone, 
          roomDelivery,
          version: pricing.version, 
          id: submission.current!.id 
        }) 
      })
      const body = await response.json()
      if (!response.ok) { if (body.code === 'PRICING_CHANGED') await mutate(); throw new Error(body.error || 'Please try placing your order again.') }
      setReceipt(body)
      if (audio) {
        audio.currentTime = 0
        void audio.play().catch(() => { })
      }
      document.getElementById('your-order')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t reach us. Please try again.') }
    finally { setPending(false); submitting.current = false }
  }
  function goToOrder() { document.getElementById('your-order')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
  if (shopError || (shopStatus && !shopStatus.isOpen)) return <ClosedScreen />
  if (!shopStatus) return <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--coral)', color: 'var(--cream)' }}>Checking shop status...</div>
  return <div className="store-page" data-ready={ready} data-step={step} data-pricing-error={!!pricingError}>
    <style>{`
      .store-page { height: 100dvh; min-height: 0; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); overflow-x: clip; }
      .store-page .store-header { min-height: clamp(48px, 8dvh, 76px); flex-shrink: 0; }
      .store-page .store-main { display: flex; flex-direction: column; min-height: 0; }
      .store-page .store-intro { flex-shrink: 0; padding: clamp(10px, 2.5dvh, 24px) 0; }
      .store-page .store-intro h1 { font-size: clamp(34px, 7dvh, 64px); }
      .store-page .store-intro > p:last-child { margin-top: clamp(6px, 1.3dvh, 12px); }
      .store-page .ordering-layout { flex: 1; min-height: 0; align-items: center; gap: clamp(12px, 3dvh, 32px); padding-bottom: clamp(6px, 1dvh, 12px); }
      .store-page .products-section { display: flex; flex-direction: column; justify-content: center; min-height: 0; }
      .store-page .egg-tap { width: clamp(80px, 26dvh, 240px); max-width: 100%; margin: clamp(2px, 0.8dvh, 8px) auto 0; }
      .store-page .egg-photo, .store-page .tap-dot { transition: none; }
      .store-page .egg-tap:hover .egg-photo, .store-page .egg-tap:hover .tap-dot { transform: none; }
      .store-page button { touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none; }
      .store-page .egg-tap { user-select: none; }
      .store-page .egg-plus { font-size: 14px; line-height: 1; padding: 5px 8px; border-radius: 20px; background: var(--cream); color: var(--ink); animation: store-chip 500ms ease-out forwards; }
      @keyframes store-chip { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-24px); } }
      .store-page .quantity-control output { display: inline-block; width: 4ch; min-width: 4ch; font-variant-numeric: tabular-nums; }
      .store-page .product-price { min-width: 5.5ch; font-variant-numeric: tabular-nums; }
      .store-page .cart-indicator > span { display: inline-block; min-width: 3ch; text-align: center; font-variant-numeric: tabular-nums; }
      .store-page .tier-hint { min-height: 2.4em; margin-top: clamp(4px, 0.8dvh, 8px); }
      .store-page .tap-instruction { margin-top: clamp(2px, 0.8dvh, 8px); }
      .store-page .order-panel { flex-shrink: 0; padding: clamp(10px, 1.8dvh, 18px); }
      .store-page .eyebrow { margin-bottom: 3px; }
      .store-page .order-panel h2 { font-size: clamp(20px, 3.2dvh, 26px); }
      .store-page .empty-order, .store-page .order-lines { height: 70px; min-height: 70px; padding: 8px 0; gap: 6px; justify-content: center; }
      .store-page .empty-order > svg { width: 24px; height: 24px; margin-bottom: 2px; }
      .store-page .empty-order > span { margin-top: 2px; }
      .store-page .order-lines > div { align-items: center; font-size: 11px; }
      .store-page .order-lines > div > span { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
      .store-page .order-lines small { display: inline; font-size: 9px; margin-top: 0; }
      .store-page .order-lines strong, .store-page .total-line strong { font-variant-numeric: tabular-nums; white-space: nowrap; }
      .store-page .delivery-line { margin: 6px 0 2px; }
      .store-page .total-line { margin-bottom: 6px; }
      .store-page .total-line > strong { font-size: 24px; }
      .store-page .order-panel [data-slot='button'] { height: 40px; }
      .store-page .payment-note { margin-top: 6px; }
      .store-page .panel-footer { margin-top: 6px; padding-top: 6px; }
      .store-page .store-footer { flex-shrink: 0; padding: clamp(6px, 1.2dvh, 12px) 0; }
      .store-page[data-step='details'], .store-page[data-pricing-error='true'] { height: auto; min-height: 100dvh; }
      .store-page[data-step='details'] .store-main, .store-page[data-step='details'] .ordering-layout { flex: auto; }
      @media (max-width: 700px) {
        .store-page .store-intro { padding: clamp(8px, 1.5dvh, 16px) 0; }
        .store-page .store-intro h1 { font-size: clamp(30px, 5dvh, 44px); }
        .store-page .order-panel { line-height: 1.3; padding: clamp(10px, 1.5dvh, 14px); }
        .store-page .order-panel-heading { line-height: 1.2; }
        .store-page .empty-order, .store-page .order-lines { height: 46px; min-height: 46px; gap: 3px; padding: 4px 0; }
        .store-page .empty-order > svg { width: 20px; height: 20px; }
        .store-page .delivery-line { margin: 4px 0 2px; }
        .store-page .total-line { margin-bottom: 4px; }
        .store-page .total-line > strong { font-size: 22px; }
        .store-page .order-panel [data-slot='button'] { height: 36px; }
        .store-page .payment-note { margin-top: 4px; }
        .store-page .panel-footer { margin-top: 4px; padding-top: 4px; }
        .store-page .pricing-error { margin-top: 3px; font-size: 10px; }
        .store-page .ordering-layout { align-items: stretch; gap: clamp(6px, 1.2dvh, 12px); }
        .store-page .products-section { flex: 1; min-height: min-content; }
        .store-page .egg-tap { width: clamp(70px, 14dvh, 140px); }
        .store-page .product-title h2 { font-size: 14px; line-height: 1.2; }
        .store-page .product-title > span { font-size: 8px; line-height: 1.3; }
        .store-page .tier-hint { min-height: 1.3em; line-height: 1.3; }
        .store-page .tap-instruction { line-height: 1.3; font-size: 9px; }
        .store-page .product-title > span { margin-top: 3px; }
        .store-page .product-bottom { gap: 5px; }
        .store-page .quantity-control button { width: 27px; height: 30px; }
        .store-page .product-price { font-size: 18px; }
        .store-page .tier-hint { font-size: 8px; }
        .store-page .order-panel { width: 100%; }
      }
      @media (max-height: 639px) { .store-page .store-footer { display: none; } }
      @media (max-height: 599px) {
        .store-page { height: auto; min-height: 100dvh; }
        .store-page .store-main, .store-page .ordering-layout { flex: auto; }
      }
      @media (prefers-reduced-motion: reduce) {
        .store-page *, .store-page *::before, .store-page *::after { animation: none !important; transition: none !important; }
        .store-page .egg-plus { display: none; }
      }
    `}</style>
    <audio ref={confirmationAudio} src="/audio/order-alert.wav" preload="auto" />
    <header className="store-header"><a href="/" className="wordmark" aria-label="Only Andey home"><img src="/Screenshot_2026-10-02_at_1.45.42_AM-removebg-preview.png" alt="" className="wordmark-egg" />nlyAndey</a><div className="header-right"><a href="https://wa.me/7307397779?text=Yo%20boss!%20Andey-shandey%20se%20related%20ek%20query%20thi%20%F0%9F%98%81" target="_blank" rel="noopener noreferrer" className="support-link" aria-label="Support via WhatsApp"><MessageCircle size={17} /></a><span className="delivery-status"><span />Room delivery, made easy</span><button className="cart-indicator" onClick={goToOrder} aria-label={`View order, ${count} eggs`}><ShoppingBag size={17} /><span ref={badge}>{count}</span></button></div></header>
    <main className="store-main"><section className="store-intro" aria-labelledby="store-title"><h1 id="store-title">Good eggs.<br /><span>Right to your room.</span></h1><p>Pick your eggs. We&apos;ll handle the rest.</p></section>
      <div className="ordering-layout">
        <section className="products-section" aria-label="Choose your eggs">
          <div className="products-grid">
            <EggProduct 
              type="boiled" 
              quantity={quantities.boiled} 
              tiers={pricing?.boiled} 
              onChange={delta => change('boiled', delta)} 
              disabled={pending} 
              available={isBoiledAvailable}
            />
            <EggProduct 
              type="raw" 
              quantity={quantities.raw} 
              tiers={pricing?.raw} 
              onChange={delta => change('raw', delta)} 
              disabled={pending} 
              available={isRawAvailable}
            />
          </div>
          <div className="tap-instruction">
            {!isBoiledAvailable && !isRawAvailable ? (
              <span>Eggs are temporarily out of stock. Check back soon!</span>
            ) : (
              <>
                <ArrowUpRight size={15} />
                <span>Tap an egg. Add a little goodness.</span>
              </>
            )}
          </div>
          {pricingError && <p className="pricing-error" role="alert">Prices couldn&apos;t load. <button onClick={() => mutate()}>Try again</button></p>}
        </section>
        <OrderPanel 
          quantities={quantities} 
          pricing={pricing} 
          step={step} 
          setStep={next => { setStep(next); if (next === 'details') requestAnimationFrame(goToOrder) }} 
          receipt={receipt} 
          onSubmit={submit} 
          pending={pending} 
          error={error} 
          onReset={() => { setReceipt(null); setQuantities({ boiled: 0, raw: 0 }); setStep('cart'); submission.current = null }} 
          activeHostel={shopStatus?.activeHostel} 
          deliveryCharge={shopStatus?.deliveryCharge ?? 0}
        />
      </div><button className="mobile-order-link" onClick={goToOrder}>Your order · {count} {count === 1 ? 'egg' : 'eggs'} <ArrowDown size={16} /></button>
    </main><footer className="store-footer"><span>GOOD FOOD. NO FUSS.</span><span>Made for hostel life.</span></footer>
  </div>
}

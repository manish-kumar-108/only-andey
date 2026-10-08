'use client'

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Minus, Plus } from 'lucide-react'
import { type EggType, money, pricePerEgg } from '@/lib/pricing'
import { cn } from '@/lib/utils'

export function EggProduct({ 
  type, 
  quantity, 
  tiers, 
  onChange, 
  disabled, 
  available = true 
}: { 
  type: EggType; 
  quantity: number; 
  tiers?: number[]; 
  onChange: (delta: number) => void; 
  disabled: boolean;
  available?: boolean;
}) {
  const photo = useRef<HTMLSpanElement>(null)
  const product = useRef<HTMLElement>(null)
  const chipId = useRef(0)
  const [chips, setChips] = useState<number[]>([])
  const boiled = type === 'boiled'
  function animate(element: HTMLElement | null, frames: Keyframe[], duration: number) {
    if (!element) return
    const { transform, opacity } = getComputedStyle(element)
    if (element.getAnimations) element.getAnimations().forEach(animation => animation.cancel())
    element.animate([{ transform, opacity }, ...frames], { duration, easing: 'ease-out' })
  }
  useEffect(() => {
    product.current?.querySelectorAll<HTMLElement>('output, .product-price, .tier-hint').forEach(element =>
      animate(element, [{ opacity: 0.65, transform: element.tagName === 'OUTPUT' ? 'translateY(3px)' : 'none' }, { opacity: 1, transform: 'none' }], 150))
  }, [quantity, tiers])
  function change(delta: number, event: MouseEvent<HTMLButtonElement>) {
    if (!available && delta > 0) return
    onChange(delta)
    animate(event.currentTarget.classList.contains('egg-tap') ? event.currentTarget.querySelector<HTMLElement>('.tap-dot') : event.currentTarget, [{ transform: `scale(${delta > 0 ? 1.15 : 1.06})` }, { transform: 'scale(1)' }], delta > 0 ? 220 : 160)
    if (delta < 0) return
    animate(photo.current, [{ transform: 'translateY(3px) scale(0.92) rotate(-7deg)', offset: 0.15 }, { transform: 'translateY(-12px) scale(1.06) rotate(6deg)', offset: 0.45 }, { transform: 'translateY(-3px) scale(1.02) rotate(-3deg)', offset: 0.7 }, { transform: 'translateY(0) scale(1) rotate(0deg)' }], 480)
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const id = ++chipId.current
      setChips(current => [...current, id])
    }
  }
  return <article ref={product} className={cn('egg-product', !available && 'is-out-of-stock')}>
    <div className="product-title">
      <div className="product-heading-row">
        <h2>{boiled ? 'BOILED' : 'RAW'}</h2>
        {!available && <span className="product-stock-badge">Out of Stock</span>}
      </div>
      <span>{boiled ? 'Ready to eat. Salt included.' : 'Fresh eggs. Your way.'}</span>
    </div>
    <button 
      className={cn('egg-tap', boiled ? 'egg-boiled' : 'egg-raw', !available && 'egg-out-of-stock')} 
      aria-label={available ? `Add ${type} egg` : `${boiled ? 'Boiled' : 'Raw'} eggs are out of stock`} 
      onClick={event => available && change(1, event)} 
      disabled={disabled || !available} 
      type="button"
    >
      <span ref={photo} className="egg-photo" role="img" aria-label={`A fresh brown ${type} egg`} />
      {chips.map(id => <span key={id} className="egg-plus" aria-hidden="true" onAnimationEnd={() => setChips(current => current.filter(chip => chip !== id))}>+1</span>)}
      {available ? (
        <span className="tap-dot" aria-hidden="true"><Plus size={19} strokeWidth={1.7} /></span>
      ) : (
        <span className="out-of-stock-overlay-pill" aria-hidden="true">Out of Stock</span>
      )}
    </button>
    <div className="product-bottom">
      <div className="product-price">{tiers ? money(pricePerEgg(quantity, tiers)) : '—'}<span> / egg</span></div>
      {available ? (
        <div className="quantity-control">
          <button type="button" onClick={event => change(-1, event)} disabled={!quantity || disabled} aria-label={`Remove ${type} egg`}><Minus size={17} /></button>
          <input type="number" min="0" max="999" aria-label={`${boiled ? 'Boiled' : 'Raw'} egg quantity`} value={quantity || ''} placeholder="0" onChange={e => { const val = parseInt(e.target.value); onChange((isNaN(val) ? 0 : val) - quantity); }} disabled={disabled} />
          <button type="button" onClick={event => change(1, event)} disabled={disabled} aria-label={`Increase ${type} eggs`}><Plus size={17} /></button>
        </div>
      ) : (
        <div className="quantity-out-of-stock">Unavailable</div>
      )}
    </div>
    <p className="tier-hint">
      {!available 
        ? 'Currently out of stock. Back soon!' 
        : tiers 
          ? quantity >= 10 
            ? 'You’ve unlocked our best price.' 
            : `10+ eggs? Just ${money(tiers[5])} each.` 
          : 'Getting today’s prices…'}
    </p>
  </article>
}

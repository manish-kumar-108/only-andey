
'use client'

import { useState, useEffect, useRef } from 'react'

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  
  // Login State
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // Dashboard State
  const [orders, setOrders] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [statusFilter, setStatusFilter] = useState('All')
  const [paymentFilter, setPaymentFilter] = useState('All')
  const [pricingLoading, setPricingLoading] = useState(false)
  const [pricingSaving, setPricingSaving] = useState(false)
  const [pricingFeedback, setPricingFeedback] = useState('')
  const [pricingIsError, setPricingIsError] = useState(false)
  const [pricingFetchError, setPricingFetchError] = useState(false)
  const [notifPerm, setNotifPerm] = useState('default')
  const [shopOpen, setShopOpen] = useState<boolean | null>(null)
  const [activeHostel, setActiveHostel] = useState<string>('Both')
  const [rawAvailable, setRawAvailable] = useState<boolean>(true)
  const [boiledAvailable, setBoiledAvailable] = useState<boolean>(true)
  const [deliveryCharge, setDeliveryCharge] = useState<number>(0)
  const [deliverySaving, setDeliverySaving] = useState(false)
  const [deliveryFeedback, setDeliveryFeedback] = useState('')
  const [deliveryIsError, setDeliveryIsError] = useState(false)
  const savedDeliveryCharge = useRef<number>(0)

  // Pricing Arrays (length 6)
  const [boiledPrices, setBoiledPrices] = useState<number[]>([])
  const [rawPrices, setRawPrices] = useState<number[]>([])
  // Saved snapshot for dirty tracking
  const savedBoiled = useRef<number[]>([])
  const savedRaw = useRef<number[]>([])

  useEffect(() => {
    checkAuth()
  }, [])

  const knownOrders = useRef(new Set<string>())
  const firstLoad = useRef(true)
  const orderAudio = useRef<HTMLAudioElement>(null)
  const soundAllowed = useRef(false)
  const pendingSounds = useRef(0)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [soundError, setSoundError] = useState('')
  const [orderAlert, setOrderAlert] = useState('')

  const playNextSound = () => {
    const audio = orderAudio.current
    if (!soundAllowed.current || !audio || pendingSounds.current === 0 || !audio.paused) return
    pendingSounds.current -= 1
    audio.currentTime = 0
    audio.play().catch(() => {
      soundAllowed.current = false
      pendingSounds.current = 0
      setSoundEnabled(false)
      setSoundError('Sound could not play. Click Enable order sound to try again.')
    })
  }

  const toggleOrderSound = () => {
    soundAllowed.current = !soundAllowed.current
    setSoundEnabled(soundAllowed.current)
    setSoundError('')
    pendingSounds.current = 0
    if (soundAllowed.current) {
      pendingSounds.current = 1
      playNextSound()
    } else {
      orderAudio.current?.pause()
    }
  }

  useEffect(() => {
    if (authenticated && typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPerm(Notification.permission);
    }
  }, [authenticated])

  const requestNotif = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission().then(p => {
        setNotifPerm(p);
        if (p === 'granted') alert('Notifications enabled successfully!');
        if (p === 'denied') alert('Notifications are blocked by your browser settings. Please allow them in Chrome settings.');
      });
    }
  }

  const fetchShopStatus = async () => {
    try {
      const res = await fetch('/api/shop-status', { cache: 'no-store' })
      const data = await res.json()
      setShopOpen(data.isOpen)
      if (data.activeHostel) setActiveHostel(data.activeHostel)
      if (data.rawAvailable !== undefined) setRawAvailable(data.rawAvailable)
      if (data.boiledAvailable !== undefined) setBoiledAvailable(data.boiledAvailable)
      if (data.deliveryCharge !== undefined) {
        setDeliveryCharge(Number(data.deliveryCharge))
        savedDeliveryCharge.current = Number(data.deliveryCharge)
      }
    } catch (e) {}
  }

  const saveDeliveryCharge = async () => {
    setDeliverySaving(true)
    setDeliveryFeedback('')
    setDeliveryIsError(false)
    try {
      const res = await fetch('/api/shop-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryCharge: Number(deliveryCharge) })
      })
      if (!res.ok) throw new Error('Update failed')
      const data = await res.json()
      if (data.deliveryCharge !== undefined) {
        setDeliveryCharge(Number(data.deliveryCharge))
        savedDeliveryCharge.current = Number(data.deliveryCharge)
      }
      setDeliveryFeedback('Delivery charge saved!')
      setTimeout(() => setDeliveryFeedback(''), 3000)
    } catch (e) {
      setDeliveryIsError(true)
      setDeliveryFeedback('Failed to save delivery charge.')
    } finally {
      setDeliverySaving(false)
    }
  }

  const toggleShop = async () => {
    if (shopOpen) {
      if (!confirm('Close the shop? Customers will not be able to order.')) return
    }
    try {
      const res = await fetch('/api/shop-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOpen: !shopOpen })
      })
      if (!res.ok) throw new Error('Update failed')
      const data = await res.json()
      if (data.isOpen !== undefined) setShopOpen(data.isOpen)
    } catch (e) {
      alert('Failed to update shop status. Please check your connection and try again.')
    }
  }

  const toggleRaw = async () => {
    const next = !rawAvailable
    setRawAvailable(next)
    try {
      const res = await fetch('/api/shop-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawAvailable: next })
      })
      if (!res.ok) throw new Error('Update failed')
      const data = await res.json()
      if (data.rawAvailable !== undefined) setRawAvailable(data.rawAvailable)
    } catch (e) {
      setRawAvailable(!next)
      alert('Failed to update raw eggs availability.')
    }
  }

  const toggleBoiled = async () => {
    const next = !boiledAvailable
    setBoiledAvailable(next)
    try {
      const res = await fetch('/api/shop-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boiledAvailable: next })
      })
      if (!res.ok) throw new Error('Update failed')
      const data = await res.json()
      if (data.boiledAvailable !== undefined) setBoiledAvailable(data.boiledAvailable)
    } catch (e) {
      setBoiledAvailable(!next)
      alert('Failed to update boiled eggs availability.')
    }
  }

  const updateActiveHostel = async (newHostel: string) => {
    try {
      const res = await fetch('/api/shop-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeHostel: newHostel })
      })
      if (!res.ok) throw new Error('Update failed')
      const data = await res.json()
      if (data.activeHostel) setActiveHostel(data.activeHostel)
    } catch (e) {
      alert('Failed to update active hostel.')
    }
  }

  useEffect(() => {
    if (authenticated) {
      fetchOrders()
      fetchShopStatus()
      checkNewOrders()
      const interval = setInterval(() => {
        fetchOrders()
        fetchShopStatus()
      }, 30000)
      const notifInterval = setInterval(checkNewOrders, 5000)
      return () => { clearInterval(interval); clearInterval(notifInterval) }
    }
  }, [authenticated, statusFilter, paymentFilter])

  const checkNewOrders = async () => {
    try {
      const url = new URL(window.location.origin + '/api/admin/orders')
      url.searchParams.set('status', 'New')
      const res = await fetch(url.toString())
      const data = await res.json()
      if (data.orders) {
        let newFound = false;
        data.orders.forEach((o: any) => {
          if (!knownOrders.current.has(o.id)) {
            knownOrders.current.add(o.id)
            if (!firstLoad.current) {
              const text = `${o.name || 'Someone'} (${o.hostel || 'Uni 1'}, Room ${o.room}) ordered ${o.boiledQuantity} boiled, ${o.rawQuantity} raw eggs.`
              setOrderAlert(text)
              if (soundAllowed.current) {
                pendingSounds.current += 1
                playNextSound()
              }
              if ('Notification' in window && Notification.permission === 'granted') {
                try {
                  new Notification('New Egg Order!', { body: text })
                } catch {}
              }
            }
            newFound = true;
          }
        });
        if (newFound && !firstLoad.current) fetchOrders();
        firstLoad.current = false;
      }
    } catch (e) {}
  }

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/admin/auth')
      const data = await res.json()
      setAuthenticated(res.ok && data.authenticated === true)
    } catch {
      setAuthenticated(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      if (res.ok) {
        setAuthenticated(true)
      } else {
        setLoginError('Invalid credentials')
      }
    } catch {
      setLoginError('Something went wrong')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLogout = async () => {
    soundAllowed.current = false
    pendingSounds.current = 0
    orderAudio.current?.pause()
    setSoundEnabled(false)
    knownOrders.current.clear()
    firstLoad.current = true
    await fetch('/api/admin/auth', { method: 'DELETE' })
    setAuthenticated(false)
  }

  const fetchOrders = async () => {
    try {
      const url = new URL(window.location.origin + '/api/admin/orders')
      if (statusFilter !== 'All') url.searchParams.set('status', statusFilter)
      if (paymentFilter !== 'All') url.searchParams.set('payment', paymentFilter)
      
      const res = await fetch(url.toString())
      const data = await res.json()
      if (data.orders) {
        setOrders(data.orders)
        setStats(data.stats)
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    if (authenticated) fetchPricing()
  }, [authenticated])

  const fetchPricing = async () => {
    setPricingLoading(true)
    setPricingFetchError(false)
    setPricingFeedback('')
    try {
      const res = await fetch('/api/admin/pricing', { cache: 'no-store' })
      if (res.status === 401) {
        setAuthenticated(false)
        setLoginError('Please sign in to manage prices.')
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load saved prices')
      if (data.boiled && data.raw) {
        setBoiledPrices(data.boiled)
        setRawPrices(data.raw)
        savedBoiled.current = data.boiled
        savedRaw.current = data.raw
      } else {
        throw new Error('Saved prices are unavailable')
      }
    } catch (err) {
      setPricingFetchError(true)
      setPricingFeedback(err instanceof Error ? err.message : 'Failed to load saved prices')
      setPricingIsError(true)
    } finally {
      setPricingLoading(false)
    }
  }

  const savePricing = async () => {
    // Client-side validation
    const allPrices = [...boiledPrices, ...rawPrices]
    for (const p of allPrices) {
      if (!Number.isFinite(p) || p <= 0) {
        setPricingFeedback('All prices must be positive numbers.')
        setPricingIsError(true)
        return
      }
    }
    if (boiledPrices.length !== 6 || rawPrices.length !== 6) {
      setPricingFeedback('Each egg type needs exactly 6 tier prices.')
      setPricingIsError(true)
      return
    }
    setPricingSaving(true)
    setPricingFeedback('')
    setPricingIsError(false)
    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boiled: boiledPrices, raw: rawPrices })
      })
      const data = await res.json()
      if (!res.ok || !data.success || !data.pricing) throw new Error(data.error || 'Prices were not saved')
      savedBoiled.current = boiledPrices
      savedRaw.current = rawPrices
      setPricingFeedback('Prices saved!')
      setPricingIsError(false)
      setTimeout(() => setPricingFeedback(''), 3000)
    } catch (err) {
      setPricingFeedback(err instanceof Error ? err.message : 'Failed to save prices')
      setPricingIsError(true)
    } finally {
      setPricingSaving(false)
    }
  }

  const updateOrderStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      fetchOrders()
    } catch (err) {}
  }

  const updatePaymentStatus = async (id: string, paymentStatus: string) => {
    try {
      await fetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus })
      })
      fetchOrders()
    } catch (err) {}
  }

  if (authenticated === null) return null // loading

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#FAF6EE] flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-[#FFFDF7] p-8 rounded-2xl shadow-sm border border-gray-100 max-w-sm w-full">
          <h1 className="text-2xl font-bold text-[#2A2420] text-center mb-6">Admin Login</h1>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input 
                type="text" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#DD5B3B]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#DD5B3B]"
                required
              />
            </div>
          </div>
          
          {loginError && <p className="text-red-500 text-sm mt-4 text-center">{loginError}</p>}
          
          <button 
            type="submit" 
            disabled={loginLoading}
            className="w-full bg-[#DD5B3B] text-white font-bold py-2.5 rounded-lg mt-6 hover:bg-[#c94d30] disabled:opacity-70 transition-colors"
          >
            {loginLoading ? 'Loading...' : 'Login'}
          </button>
        </form>
      </div>
    )
  }

  const tierLabels = ['1 egg', '2 eggs', '3 eggs', '4 eggs', '5-9 eggs', '10+ eggs']

  return (
    <div className="min-h-screen bg-[#FAF6EE] text-[#2A2420] font-sans pb-12">
      <header className="bg-[#FFFDF7] px-6 py-4 flex flex-wrap justify-between items-center sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/Screenshot_2026-10-02_at_1.45.42_AM-removebg-preview.png" alt="" style={{ height: '34px', width: 'auto', objectFit: 'contain', marginRight: '-16px' }} /><span style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '-1px', color: '#2A2420' }}>nlyAndey</span>
          <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded-full text-[10px] font-bold tracking-wider">ADMIN</span>
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-4 sm:mt-0">
          <audio ref={orderAudio} src="/audio/order-alert.wav" preload="auto" onEnded={playNextSound} />
          <button onClick={toggleOrderSound} aria-pressed={soundEnabled} className="text-xs bg-[#FAF6EE] border border-[#2A2420]/20 px-3 py-1.5 rounded-full font-bold hover:bg-[#EFE8DC] transition-colors">
            {soundEnabled ? 'Mute order sound' : 'Enable order sound'}
          </button>
          {notifPerm === 'default' && (
            <button onClick={requestNotif} className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-full font-bold hover:bg-blue-100 transition-colors">
              🔔 Enable Notifications
            </button>
          )}
          {notifPerm === 'denied' && (
            <button onClick={() => alert('Please allow notifications in browser settings.')} className="text-xs bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-full font-bold">
              🔕 Notifications Blocked
            </button>
          )}

          {shopOpen !== null && (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Active Hostel:</span>
                <select 
                  value={activeHostel} 
                  onChange={e => updateActiveHostel(e.target.value)}
                  className="bg-[#FAF6EE] border border-[#2A2420]/20 text-xs font-bold px-2 py-1 rounded outline-none"
                >
                  <option value="Both">Both</option>
                  <option value="Uni 1">Uni 1</option>
                  <option value="Uni 2">Uni 2</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{shopOpen ? 'Shop Open' : 'Shop Closed'}</span>
                <button
                  type="button"
                  onClick={toggleShop}
                  aria-label="Toggle shop open or closed"
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    shopOpen ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      shopOpen ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* 1st: Raw Available */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{rawAvailable ? 'Raw Available' : 'Raw Out of Stock'}</span>
                <button
                  type="button"
                  onClick={toggleRaw}
                  aria-label="Toggle raw eggs availability"
                  title={rawAvailable ? 'Click to mark Raw eggs as Out of Stock' : 'Click to mark Raw eggs as Available'}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    rawAvailable ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      rawAvailable ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* 2nd: Boiled Available */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{boiledAvailable ? 'Boiled Available' : 'Boiled Out of Stock'}</span>
                <button
                  type="button"
                  onClick={toggleBoiled}
                  aria-label="Toggle boiled eggs availability"
                  title={boiledAvailable ? 'Click to mark Boiled eggs as Out of Stock' : 'Click to mark Boiled eggs as Available'}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    boiledAvailable ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      boiledAvailable ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
          
          <div className="w-px h-6 bg-gray-200 mx-2 hidden sm:block"></div>
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-800 font-medium">Logout</button>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 mt-8 space-y-8">
        {soundError && <p role="alert" className="text-sm text-red-700">{soundError}</p>}
        <div role="status" aria-live="polite">
          {orderAlert && <p className="bg-[#FFFDF7] border border-[#DD5B3B]/30 rounded-xl px-4 py-3 text-sm"><strong>New order: </strong>{orderAlert}</p>}
        </div>
        
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-[#FFFDF7] p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500 font-medium mb-1">Total Orders</p>
              <p className="text-4xl font-extrabold tracking-tight">{stats.todayOrders}</p>
            </div>
            <div className="bg-[#FFFDF7] p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500 font-medium mb-1">Total Revenue</p>
              <p className="text-4xl font-extrabold tracking-tight">₹{stats.todayRevenue}</p>
            </div>
            <div className="bg-[#FFFDF7] p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500 font-medium mb-1">Pending Orders</p>
              <p className="text-4xl font-extrabold tracking-tight text-[#DD5B3B]">{stats.pendingOrders}</p>
            </div>
            <div className="bg-[#FFFDF7] p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500 font-medium mb-1">Delivered</p>
              <p className="text-4xl font-extrabold tracking-tight text-green-500">{stats.deliveredOrders}</p>
            </div>
          </div>
        )}

        {/* Orders Section */}
        <section className="bg-[#FFFDF7] rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold mb-4">Orders</h2>
            <div className="flex flex-wrap gap-4 justify-between items-center">
              <div className="flex flex-wrap gap-2">
                {['All', 'New', 'Confirmed', 'Out for Delivery', 'Delivered', 'Cancelled'].map(s => (
                  <button 
                    key={s} 
                    onClick={() => setStatusFilter(s)}
                    className={`text-xs font-semibold px-4 py-1.5 rounded-full border transition-all ${
                      statusFilter === s ? 'bg-[#DD5B3B] border-[#DD5B3B] text-white' : 'bg-transparent border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {['All', 'Pending', 'Paid'].map(s => (
                  <button 
                    key={s} 
                    onClick={() => setPaymentFilter(s)}
                    className={`text-xs font-semibold px-4 py-1.5 rounded-full border transition-all ${
                      paymentFilter === s ? 'bg-[#DD5B3B] border-[#DD5B3B] text-white' : 'bg-transparent border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm whitespace-nowrap min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-4 font-medium text-gray-500">Order ID + time</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Name</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Hostel & Room</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Phone</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Items</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Total</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Order Status</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Payment</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.length === 0 ? (
                  <tr><td colSpan={9} className="px-6 py-12 text-center text-gray-400">No orders match the filters.</td></tr>
                ) : (
                  orders.map(order => {
                    const time = new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    const isNew = order.status === 'New';
                    
                    const selectBg = 
                      order.status === 'New' ? 'bg-blue-500 text-white' :
                      order.status === 'Confirmed' ? 'bg-amber-400 text-white' :
                      order.status === 'Out for Delivery' ? 'bg-purple-500 text-white' :
                      order.status === 'Delivered' ? 'bg-green-500 text-white' :
                      'bg-[#DD5B3B] text-white';

                    return (
                      <tr key={order.id} className="group hover:bg-gray-50/30 transition-colors">
                        <td className="px-6 py-4 relative">
                          {isNew && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#DD5B3B] rounded-r" />}
                          <div className="flex items-baseline gap-2">
                            <span className="font-extrabold text-[#2A2420]">#{order.id.substring(0,6).toUpperCase()}</span>
                            <span className="text-gray-400 text-xs font-medium">{time}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-[#2A2420]">{order.name || '—'}</td>
                        <td className="px-6 py-4 font-semibold text-[#2A2420]">{order.hostel || 'Uni 1'} - {order.room}</td>
                        <td className="px-6 py-4 text-gray-500">{order.phone}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {order.boiledQuantity > 0 && <span className="bg-[#DD5B3B]/10 text-[#DD5B3B] px-3 py-1 rounded-full text-xs font-bold">{order.boiledQuantity} Boiled</span>}
                            {order.rawQuantity > 0 && <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold">{order.rawQuantity} Raw</span>}
                            {(order.roomDelivery === 1 || order.roomDelivery === true) && (
                              <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-xs font-bold">
                                Room Delivery {Number(order.deliveryCharge) > 0 ? `(+₹${order.deliveryCharge})` : '(Free)'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-bold text-[#2A2420]">₹{order.total}</td>
                        <td className="px-6 py-4">
                          <div className="relative inline-block w-36">
                            <select 
                              value={order.status}
                              onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                              className={`appearance-none w-full text-xs font-bold rounded-full pl-4 pr-8 py-1.5 outline-none cursor-pointer ${selectBg}`}
                            >
                              {['New', 'Confirmed', 'Out for Delivery', 'Delivered', 'Cancelled'].map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-white">
                              <svg className="fill-current h-4 w-4" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-3 py-1 rounded-full ${order.paymentStatus === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {order.paymentStatus}
                            </span>
                            {order.paymentStatus === 'Pending' && (
                              <button onClick={() => updatePaymentStatus(order.id, 'Paid')} className="text-[#DD5B3B] border border-[#DD5B3B] text-[10px] font-bold px-2 py-1 rounded-full hover:bg-[#DD5B3B]/5 transition-colors">
                                Mark Paid
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {order.status !== 'Cancelled' && (
                            <button onClick={() => updateOrderStatus(order.id, 'Cancelled')} className="text-[#DD5B3B] text-xs font-semibold hover:underline">
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Pricing Management */}
        <section className="bg-[#FFFDF7] rounded-2xl shadow-sm border border-gray-100 p-6">
          {/* Header row */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Pricing Management</h2>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {pricingFeedback && (
                <span className={`text-sm font-medium ${pricingIsError ? 'text-red-600' : 'text-green-600'}`}>
                  {pricingFeedback}
                </span>
              )}
              {!pricingFetchError && (
                <button
                  onClick={savePricing}
                  disabled={
                    pricingSaving ||
                    pricingLoading ||
                    boiledPrices.length !== 6 ||
                    rawPrices.length !== 6 ||
                    (JSON.stringify(boiledPrices) === JSON.stringify(savedBoiled.current) &&
                      JSON.stringify(rawPrices) === JSON.stringify(savedRaw.current))
                  }
                  className="bg-[#2A2420] text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-[#1a1614] disabled:opacity-40 transition-colors shadow-sm"
                >
                  {pricingSaving ? 'Saving…' : 'Save Prices'}
                </button>
              )}
            </div>
          </div>

          {/* Loading skeleton */}
          {pricingLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[0, 1].map(c => (
                <div key={c} className="border border-gray-100 rounded-xl p-6 bg-white/50 animate-pulse">
                  <div className="h-4 w-28 bg-gray-200 rounded mb-6" />
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex justify-between items-center mb-3">
                      <div className="h-3 w-20 bg-gray-100 rounded" />
                      <div className="h-8 w-24 bg-gray-100 rounded-lg" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : pricingFetchError ? (
            /* Fetch error state */
            <div className="flex flex-col items-center gap-3 py-10">
              <p className="text-red-600 text-sm font-medium">{pricingFeedback || 'Failed to fetch pricing'}</p>
              <button
                onClick={fetchPricing}
                className="text-sm font-bold px-5 py-2 rounded-full border border-[#DD5B3B] text-[#DD5B3B] hover:bg-[#DD5B3B]/5 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Boiled Sub-card */}
              <div className="border border-gray-100 rounded-xl p-6 bg-white/50">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-[#2A2420] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#DD5B3B]" /> Boiled Eggs
                  </h3>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${boiledAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                    {boiledAvailable ? 'Available' : 'Out of Stock'}
                  </span>
                </div>
                <div className="space-y-3">
                  {boiledPrices.map((price, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <label className="text-sm font-medium text-gray-600">{tierLabels[i]}</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">₹</span>
                        <input
                          type="number"
                          aria-label={`Boiled eggs ${tierLabels[i]} price per egg`}
                          min="0.01"
                          step="0.01"
                          value={price || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            const newArr = [...boiledPrices]
                            newArr[i] = Number.isFinite(val) ? val : 0
                            setBoiledPrices(newArr)
                          }}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value)
                            if (!Number.isFinite(val) || val <= 0) {
                              const newArr = [...boiledPrices]
                              newArr[i] = savedBoiled.current[i] ?? 0
                              setBoiledPrices(newArr)
                            }
                          }}
                          className="w-24 pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm font-bold text-[#2A2420] outline-none focus:border-[#DD5B3B] transition-colors"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Raw Sub-card */}
              <div className="border border-gray-100 rounded-xl p-6 bg-white/50">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-[#2A2420] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-400" /> Raw Eggs
                  </h3>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${rawAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                    {rawAvailable ? 'Available' : 'Out of Stock'}
                  </span>
                </div>
                <div className="space-y-3">
                  {rawPrices.map((price, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <label className="text-sm font-medium text-gray-600">{tierLabels[i]}</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">₹</span>
                        <input
                          type="number"
                          aria-label={`Raw eggs ${tierLabels[i]} price per egg`}
                          min="0.01"
                          step="0.01"
                          value={price || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            const newArr = [...rawPrices]
                            newArr[i] = Number.isFinite(val) ? val : 0
                            setRawPrices(newArr)
                          }}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value)
                            if (!Number.isFinite(val) || val <= 0) {
                              const newArr = [...rawPrices]
                              newArr[i] = savedRaw.current[i] ?? 0
                              setRawPrices(newArr)
                            }
                          }}
                          className="w-24 pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm font-bold text-[#2A2420] outline-none focus:border-[#DD5B3B] transition-colors"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Delivery Charge Management */}
        <section className="bg-[#FFFDF7] rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-bold">Delivery Charge</h2>
              <p className="text-xs text-gray-500 mt-1">Set the fee charged when customers select room delivery at checkout.</p>
            </div>
            <div className="flex items-center gap-3">
              {deliveryFeedback && (
                <span className={`text-sm font-medium ${deliveryIsError ? 'text-red-600' : 'text-green-600'}`}>
                  {deliveryFeedback}
                </span>
              )}
              <button
                onClick={saveDeliveryCharge}
                disabled={deliverySaving || deliveryCharge === savedDeliveryCharge.current}
                className="bg-[#2A2420] text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-[#1a1614] disabled:opacity-40 transition-colors shadow-sm"
              >
                {deliverySaving ? 'Saving…' : 'Save Delivery Charge'}
              </button>
            </div>
          </div>

          <div className="border border-gray-100 rounded-xl p-6 bg-white/50 max-w-md">
            <label className="block text-sm font-medium text-gray-600 mb-2">Room Delivery Fee</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">₹</span>
              <input
                type="number"
                min="0"
                step="1"
                aria-label="Room delivery fee"
                value={deliveryCharge === 0 ? '' : deliveryCharge}
                placeholder="0 (Free)"
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  setDeliveryCharge(isNaN(val) ? 0 : Math.max(0, val))
                }}
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm font-bold text-[#2A2420] outline-none focus:border-[#DD5B3B] transition-colors"
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {deliveryCharge > 0 
                ? `Customers will be charged ₹${deliveryCharge} when they check the "Room delivery" option.` 
                : 'Room delivery is currently set to free (₹0).'}
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

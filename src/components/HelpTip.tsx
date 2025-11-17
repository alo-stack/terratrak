import React, { useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'

export default function HelpTip({ text, id }:{ text: string; id?: string }){
  const [open, setOpen] = React.useState(false)
  const btnRef = React.useRef<HTMLButtonElement|null>(null)
  const popRef = React.useRef<HTMLDivElement|null>(null)
  const [pos, setPos] = React.useState<{ left:number; top:number; placement:'top'|'bottom'; width:number } | null>(null)
  const [sticky, setSticky] = React.useState(false)

  // detect hover-capable devices (desktop) vs touch-first devices
  const hoverCapable = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches

  React.useEffect(()=>{
    const onDoc = (e: MouseEvent)=>{
      if (!btnRef.current || !popRef.current) return
      if (!btnRef.current.contains(e.target as Node) && !popRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSticky(false)
      }
    }
    document.addEventListener('click', onDoc)
    return ()=> document.removeEventListener('click', onDoc)
  },[])

  // auto-close on mobile after a short time to avoid blocking UI
  React.useEffect(()=>{
    if (!open || hoverCapable) return
    const t = window.setTimeout(()=> setOpen(false), 6000)
    return ()=> window.clearTimeout(t)
  },[open, hoverCapable])

  // compute and update portal position using measurements
  const computePos = React.useCallback(()=>{
    const btn = btnRef.current
    const pop = popRef.current
    if (!btn || !pop) return
    const btnRect = btn.getBoundingClientRect()
    const popRect = pop.getBoundingClientRect()
    const margin = 8
    const placeTop = btnRect.top - popRect.height - margin > 8
    const top = placeTop ? btnRect.top - popRect.height - margin : btnRect.bottom + margin
    let left = btnRect.right - popRect.width
    left = Math.max(margin, Math.min(left, (window.innerWidth - popRect.width - margin)))
    setPos({ left: Math.round(left), top: Math.round(top), placement: placeTop ? 'top' : 'bottom', width: Math.round(popRect.width) })
  }, [])

  useLayoutEffect(()=>{
    if (!open) return
    // compute after render
    computePos()
    const onResize = () => computePos()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return ()=>{
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  },[open, computePos])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); setSticky(false) }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(s => { const next = !s; if (next) setSticky(true); else setSticky(false); return next }) }
  }

  const btn = (
    <button
      ref={btnRef}
      aria-expanded={open}
      aria-describedby={id}
      onClick={(e)=>{ e.stopPropagation(); setOpen(s=>{ const next = !s; if (next) setSticky(true); else setSticky(false); return next }) }}
      onMouseEnter={()=> { if (hoverCapable) setOpen(true) }}
      onMouseLeave={()=> { if (hoverCapable && !sticky) setOpen(false) }}
      onFocus={()=> { if (hoverCapable) setOpen(true) }}
      onBlur={()=> { if (hoverCapable && !sticky) setOpen(false) }}
      onKeyDown={onKey}
      className="ml-2 p-1 rounded-full bg-transparent text-emerald-600 dark:text-emerald-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-300"
      title={text}
    >
      <Icon name="info" className="w-4 h-4" />
    </button>
  )

  // Portal content
  const portal = open ? createPortal(
    <div ref={popRef} role="tooltip" id={id} style={{ position: 'absolute', left: pos?.left ?? 0, top: pos?.top ?? 0, zIndex: 9999, maxWidth: 360, visibility: pos ? 'visible' : 'hidden' }}>
      <div className="bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 text-xs rounded-md border shadow-lg p-2" style={{ boxShadow: '0 6px 24px rgba(0,0,0,0.15)' }}>
        <div className="text-xs leading-tight">{text}</div>
      </div>
    </div>, document.body
  ) : null

  return (
    <span className="inline-flex items-center relative">
      {btn}
      {portal}
    </span>
  )
}

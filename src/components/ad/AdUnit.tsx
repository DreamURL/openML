import { useEffect, useRef, type RefObject } from 'react'

interface AdUnitProps {
  slot: string
  format?: string
  layout?: string
  className?: string
}

interface SideAdProps {
  slot: string
  className?: string
}

declare global {
  interface Window {
    adsbygoogle: unknown[]
  }
}

function useAdInit(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    try {
      if (ref.current && ref.current.querySelector('.adsbygoogle')?.childElementCount === 0) {
        (window.adsbygoogle = window.adsbygoogle || []).push({})
      }
    } catch {
      // AdSense not loaded
    }
  }, [ref])
}

export function AdUnit({ slot, format = 'auto', layout, className }: AdUnitProps) {
  const adRef = useRef<HTMLDivElement>(null)
  useAdInit(adRef)

  return (
    <div ref={adRef} className={className}>
      <ins
        className="adsbygoogle"
        style={layout ? { display: 'block', textAlign: 'center' } : { display: 'block' }}
        data-ad-client="ca-pub-2030441326964978"
        data-ad-slot={slot}
        data-ad-format={format}
        {...(layout ? { 'data-ad-layout': layout } : {})}
        {...(format === 'auto' ? { 'data-full-width-responsive': 'true' } : {})}
      />
    </div>
  )
}

export function SideAd({ slot, className }: SideAdProps) {
  const adRef = useRef<HTMLDivElement>(null)
  useAdInit(adRef)

  return (
    <div ref={adRef} className={`w-[160px] max-h-[600px] overflow-hidden ${className ?? ''}`}>
      <ins
        className="adsbygoogle"
        style={{ display: 'inline-block', width: '160px', height: '600px' }}
        data-ad-client="ca-pub-2030441326964978"
        data-ad-slot={slot}
      />
    </div>
  )
}

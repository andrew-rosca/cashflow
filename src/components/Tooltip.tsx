'use client'

import { useState, useRef, useEffect } from 'react'

interface TooltipProps {
  content: string
  children: React.ReactNode
  className?: string
}

export default function Tooltip({ content, children, className = '' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, showBelow: false })
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Don't show tooltip if content is empty
  if (!content) {
    return <>{children}</>
  }

  const updatePosition = () => {
    if (!containerRef.current || !tooltipRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    
    // Position tooltip above the element, centered horizontally
    let top = containerRect.top - tooltipRect.height - 8
    let left = containerRect.left + (containerRect.width / 2) - (tooltipRect.width / 2)
    let showBelow = false
    
    // Keep tooltip within viewport bounds
    if (left < 8) left = 8
    if (left + tooltipRect.width > window.innerWidth - 8) {
      left = window.innerWidth - tooltipRect.width - 8
    }
    if (top < 8) {
      // If not enough space above, show below
      top = containerRect.bottom + 8
      showBelow = true
    }
    
    setPosition({ top, left, showBelow })
  }

  useEffect(() => {
    if (isVisible && tooltipRef.current && containerRef.current) {
      // Calculate position immediately, then update after render
      updatePosition()
      
      // Use requestAnimationFrame to ensure tooltip is rendered and has dimensions
      requestAnimationFrame(() => {
        updatePosition()
      })
      
      const handleUpdate = () => updatePosition()
      window.addEventListener('scroll', handleUpdate, true)
      window.addEventListener('resize', handleUpdate)
      
      return () => {
        window.removeEventListener('scroll', handleUpdate, true)
        window.removeEventListener('resize', handleUpdate)
      }
    }
  }, [isVisible])

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className="fixed z-50 px-2 py-1 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded shadow-lg whitespace-nowrap pointer-events-none"
          data-tooltip-content={content}
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
        >
          {content}
          {/* Arrow pointing to the element */}
          <div 
            className={`absolute left-1/2 transform -translate-x-1/2 w-0 h-0 ${
              position.showBelow 
                ? 'top-0 border-b-4 border-b-gray-900 dark:border-b-gray-700 border-l-4 border-r-4 border-l-transparent border-r-transparent' 
                : 'bottom-0 border-t-4 border-t-gray-900 dark:border-t-gray-700 border-l-4 border-r-4 border-l-transparent border-r-transparent'
            }`}
          />
        </div>
      )}
    </div>
  )
}


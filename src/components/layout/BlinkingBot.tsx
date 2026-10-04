interface BlinkingBotProps {
  size?: number
  className?: string
  glow?: boolean
}

export function BlinkingBot({ size = 20, className = '', glow = true }: BlinkingBotProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 animate-bot-idle select-none ${className}`}
      style={{ width: size, height: size }}
      aria-label="Blinking AI Bot"
    >
      {/* Outer ambient glow */}
      {glow && (
        <span
          className="absolute -inset-1 rounded-full bg-accent/20 blur-xs animate-pulse pointer-events-none"
          aria-hidden="true"
        />
      )}

      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        {/* Antenna */}
        <line x1="12" y1="2" x2="12" y2="5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        {/* Antenna Glowing Orb */}
        <circle cx="12" cy="2" r="1.8" fill="var(--color-accent, #22d3ee)" className="animate-bot-glow" />

        {/* Ears / Side Pins */}
        <rect x="1.5" y="9" width="1.8" height="4" rx="0.9" fill="currentColor" opacity="0.6" />
        <rect x="20.7" y="9" width="1.8" height="4" rx="0.9" fill="currentColor" opacity="0.6" />

        {/* Robot Head Body */}
        <rect
          x="3.2"
          y="5.2"
          width="17.6"
          height="14.6"
          rx="4"
          fill="currentColor"
          fillOpacity="0.12"
          stroke="currentColor"
          strokeWidth="1.6"
        />

        {/* Inner Visor Screen */}
        <rect
          x="5.2"
          y="7.2"
          width="13.6"
          height="7.2"
          rx="2.2"
          fill="currentColor"
          fillOpacity="0.85"
        />

        {/* Left Eye (Blinks via keyframes) */}
        <g className="animate-bot-blink" style={{ transformOrigin: '8.8px 10.8px' }}>
          <circle cx="8.8" cy="10.8" r="1.5" fill="#22d3ee" />
          <circle cx="9.2" cy="10.4" r="0.5" fill="#ffffff" />
        </g>

        {/* Right Eye (Blinks via keyframes) */}
        <g className="animate-bot-blink" style={{ transformOrigin: '15.2px 10.8px' }}>
          <circle cx="15.2" cy="10.8" r="1.5" fill="#22d3ee" />
          <circle cx="15.6" cy="10.4" r="0.5" fill="#ffffff" />
        </g>

        {/* Cheerful Robot Mouth Smile */}
        <path
          d="M8.5 16.5C9.5 17.5 14.5 17.5 15.5 16.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.8"
        />

        {/* Cheek glow blushes */}
        <circle cx="6.5" cy="14" r="0.75" fill="var(--color-accent, #22d3ee)" opacity="0.6" />
        <circle cx="17.5" cy="14" r="0.75" fill="var(--color-accent, #22d3ee)" opacity="0.6" />
      </svg>
    </div>
  )
}

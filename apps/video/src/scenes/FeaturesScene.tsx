import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

// Simple SVG icons
const ShieldIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const SmartphoneIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);

const BotIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" y1="16" x2="8" y2="16" />
    <line x1="16" y1="16" x2="16" y2="16" />
  </svg>
);

const QrCodeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="3" height="3" />
    <rect x="18" y="14" width="3" height="3" />
    <rect x="14" y="18" width="3" height="3" />
    <rect x="18" y="18" width="3" height="3" />
  </svg>
);

const LockIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const CloudIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
  </svg>
);

// Feature card component
const FeatureCardDisplay: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  opacity: number;
  scale: number;
  translateY: number;
}> = ({ icon, title, description, opacity, scale, translateY }) => (
  <div
    style={{
      width: 280,
      padding: 20,
      backgroundColor: '#1f1f1f',
      border: '1px solid #373737',
      borderRadius: 8,
      transform: `scale(${scale}) translateY(${translateY}px)`,
      opacity,
    }}
  >
    <div
      style={{
        width: 44,
        height: 44,
        border: '1px solid #373737',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
        color: '#9b9b9b',
      }}
    >
      {icon}
    </div>
    <h3 style={{ color: '#e9e9e7', fontSize: 15, fontWeight: 700, marginBottom: 6, fontFamily: 'JetBrains Mono, monospace' }}>
      {title}
    </h3>
    <p style={{ color: '#6b6b6b', fontSize: 12, lineHeight: 1.5, fontFamily: 'JetBrains Mono, monospace' }}>
      {description}
    </p>
  </div>
);

const features = [
  { icon: <BotIcon />, title: 'Multi-Agent', description: 'Run Claude, Gemini, Cursor in parallel' },
  { icon: <SmartphoneIcon />, title: 'Mobile-First', description: 'Touch-optimized terminal UI' },
  { icon: <LockIcon />, title: 'Read-Only Default', description: 'Safe monitoring by default' },
  { icon: <ShieldIcon />, title: 'Guardrails', description: 'Block dangerous commands' },
  { icon: <QrCodeIcon />, title: 'QR Connect', description: 'Instant secure connection' },
  { icon: <CloudIcon />, title: 'Cloudflare', description: 'Encrypted tunnel access' },
];

export const FeaturesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Heading animation
  const headingOpacity = interpolate(frame, [0, fps * 0.3], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const headingY = interpolate(
    spring({ frame, fps, config: { damping: 200 } }),
    [0, 1],
    [-20, 0]
  );

  // Feature card animations - staggered
  const getCardAnim = (index: number) => {
    const startFrame = fps * 0.3 + index * (fps * 0.15);
    const delayedFrame = Math.max(0, frame - startFrame);
    return {
      opacity: interpolate(frame, [startFrame, startFrame + fps * 0.3], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }),
      scale: spring({ frame: delayedFrame, fps, config: { damping: 15, stiffness: 100 } }),
      translateY: interpolate(
        spring({ frame: delayedFrame, fps, config: { damping: 200 } }),
        [0, 1],
        [30, 0]
      ),
    };
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#191919',
        fontFamily: 'JetBrains Mono, monospace',
      }}
    >
      {/* Centered Content */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 60,
        }}
      >
        {/* Heading */}
        <div
          style={{
            opacity: headingOpacity,
            transform: `translateY(${headingY}px)`,
            textAlign: 'center',
            marginBottom: 40,
          }}
        >
          <h2 style={{ fontSize: 48, fontWeight: 700, color: '#e9e9e7', margin: 0, marginBottom: 12 }}>
            Built for Developers
          </h2>
          <p style={{ color: '#6b6b6b', fontSize: 18, margin: 0 }}>
            Security and convenience without compromise
          </p>
        </div>

        {/* Feature Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
            maxWidth: 920,
          }}
        >
          {features.map((feature, index) => {
            const anim = getCardAnim(index);
            return (
              <FeatureCardDisplay
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                {...anim}
              />
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

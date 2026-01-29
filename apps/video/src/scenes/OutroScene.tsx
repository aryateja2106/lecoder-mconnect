import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from 'remotion';
import { PixelLogo } from '../components/PixelLogo';
import { TypewriterText } from '../components/TypewriterText';

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo animation
  const logoScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 80 },
  });

  const logoOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // CTA animation
  const ctaOpacity = interpolate(frame, [fps * 0.8, fps * 1.2], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const ctaY = interpolate(
    spring({
      frame: Math.max(0, frame - fps * 0.8),
      fps,
      config: { damping: 200 },
    }),
    [0, 1],
    [30, 0]
  );

  // Command box animation
  const commandOpacity = interpolate(frame, [fps * 1.5, fps * 2], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const commandScale = spring({
    frame: Math.max(0, frame - fps * 1.5),
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  // Grid background
  const gridOpacity = interpolate(frame, [0, fps], [0, 0.02], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#191919',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'JetBrains Mono, monospace',
      }}
    >
      {/* Grid Background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,${gridOpacity}) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,${gridOpacity}) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Logo */}
      <div
        style={{
          transform: `scale(${logoScale})`,
          opacity: logoOpacity,
          marginBottom: 32,
        }}
      >
        <PixelLogo size={80} animate={false} />
      </div>

      {/* CTA Text */}
      <div
        style={{
          opacity: ctaOpacity,
          transform: `translateY(${ctaY}px)`,
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: '#e9e9e7',
            margin: 0,
            marginBottom: 16,
          }}
        >
          Ready to take control?
        </h2>
        <p style={{ color: '#6b6b6b', fontSize: 20, margin: 0 }}>
          Free. Open Source. MIT License.
        </p>
      </div>

      {/* Install Command */}
      <div
        style={{
          marginTop: 50,
          opacity: commandOpacity,
          transform: `scale(${commandScale})`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 28px',
            backgroundColor: '#1f1f1f',
            border: '2px solid #373737',
            borderRadius: 8,
          }}
        >
          <span style={{ color: '#6b6b6b', fontSize: 18 }}>$</span>
          <Sequence from={fps * 2}>
            <TypewriterText
              text="npx lecoder-mconnect"
              charsPerSecond={15}
              fontSize={20}
              color="#e9e9e7"
            />
          </Sequence>
        </div>
      </div>

      {/* Links */}
      <Sequence from={fps * 3}>
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            display: 'flex',
            gap: 40,
            color: '#4a4a4a',
            fontSize: 14,
          }}
        >
          <span>github.com/aryateja2106/lecoder-mconnect</span>
          <span>|</span>
          <span>npmjs.com/package/lecoder-mconnect</span>
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { PixelLogo } from '../components/PixelLogo';

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Background grid opacity
  const gridOpacity = interpolate(frame, [0, fps], [0, 0.02], {
    extrapolateRight: 'clamp',
  });

  // Logo animation
  const logoScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 80 },
  });

  const logoOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Title animation (starts at 0.5s)
  const titleProgress = spring({
    frame: Math.max(0, frame - fps * 0.5),
    fps,
    config: { damping: 200 },
  });

  const titleY = interpolate(titleProgress, [0, 1], [40, 0]);
  const titleOpacity = interpolate(frame, [fps * 0.5, fps], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Tagline animation (starts at 1.2s) - typewriter effect via character count
  const taglineStartFrame = fps * 1.2;
  const taglineText = 'Terminal in your pocket';
  const charsPerSecond = 20;
  const charsPerFrame = charsPerSecond / fps;
  const taglineChars = Math.floor(Math.max(0, frame - taglineStartFrame) * charsPerFrame);
  const displayTagline = taglineText.slice(0, Math.min(taglineChars, taglineText.length));
  const taglineOpacity = frame >= taglineStartFrame ? 1 : 0;

  // Bottom keywords (starts at 2.5s)
  const keywordsOpacity = interpolate(frame, [fps * 2.5, fps * 3], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#191919',
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

      {/* Centered Content */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Logo */}
        <div
          style={{
            transform: `scale(${logoScale})`,
            opacity: logoOpacity,
            marginBottom: 32,
          }}
        >
          <PixelLogo size={120} animate={false} />
        </div>

        {/* Title */}
        <div
          style={{
            transform: `translateY(${titleY}px)`,
            opacity: titleOpacity,
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: '#e9e9e7',
              margin: 0,
              marginBottom: 16,
              letterSpacing: -2,
            }}
          >
            LeCoder MConnect
          </h1>

          <p
            style={{
              fontSize: 24,
              color: '#6b6b6b',
              margin: 0,
              height: 32,
              opacity: taglineOpacity,
            }}
          >
            {displayTagline}
            {taglineChars < taglineText.length && <span style={{ color: '#4ade80' }}>|</span>}
          </p>
        </div>
      </div>

      {/* Bottom Keywords */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 32,
          color: '#4a4a4a',
          fontSize: 14,
          opacity: keywordsOpacity,
        }}
      >
        <span>Multi-Agent</span>
        <span>|</span>
        <span>Mobile-First</span>
        <span>|</span>
        <span>Secure</span>
      </div>
    </AbsoluteFill>
  );
};

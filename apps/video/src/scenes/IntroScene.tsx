import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from 'remotion';
import { PixelLogo } from '../components/PixelLogo';
import { TypewriterText } from '../components/TypewriterText';

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

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

  // Title animation
  const titleY = interpolate(
    spring({
      frame: Math.max(0, frame - fps * 0.5),
      fps,
      config: { damping: 200 },
    }),
    [0, 1],
    [40, 0]
  );

  const titleOpacity = interpolate(frame, [fps * 0.5, fps], [0, 1], {
    extrapolateLeft: 'clamp',
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

        <Sequence from={fps * 1.2}>
          <p
            style={{
              fontSize: 24,
              color: '#6b6b6b',
              margin: 0,
            }}
          >
            <TypewriterText
              text="Terminal in your pocket"
              charsPerSecond={20}
              color="#6b6b6b"
              fontSize={24}
            />
          </p>
        </Sequence>
      </div>

      {/* Tagline */}
      <Sequence from={fps * 2.5}>
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            display: 'flex',
            gap: 32,
            color: '#4a4a4a',
            fontSize: 14,
          }}
        >
          <span>Multi-Agent</span>
          <span>|</span>
          <span>Mobile-First</span>
          <span>|</span>
          <span>Secure</span>
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};

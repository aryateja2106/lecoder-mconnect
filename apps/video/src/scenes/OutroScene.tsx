import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { PixelLogo } from '../components/PixelLogo';

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

  // CTA animation (starts at 0.8s)
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

  // Command box animation (starts at 1.5s)
  const commandStartFrame = fps * 1.5;
  const commandOpacity = interpolate(frame, [commandStartFrame, commandStartFrame + fps * 0.3], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const commandScale = spring({
    frame: Math.max(0, frame - commandStartFrame),
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  // Command typewriter (starts at 2s)
  const typewriterStart = fps * 2;
  const commandText = 'npx lecoder-mconnect';
  const charsPerSecond = 15;
  const charsPerFrame = charsPerSecond / fps;
  const charCount = Math.floor(Math.max(0, frame - typewriterStart) * charsPerFrame);
  const displayCommand = commandText.slice(0, Math.min(charCount, commandText.length));
  const isTyping = charCount < commandText.length && frame >= typewriterStart;

  // Links animation (starts at 3s)
  const linksOpacity = interpolate(frame, [fps * 3, fps * 3.5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Grid background
  const gridOpacity = interpolate(frame, [0, fps], [0, 0.02], {
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
            <span style={{ color: '#e9e9e7', fontSize: 20 }}>
              {displayCommand}
              {isTyping && <span style={{ color: '#4ade80' }}>|</span>}
            </span>
          </div>
        </div>
      </div>

      {/* Links at Bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 40,
          color: '#4a4a4a',
          fontSize: 14,
          opacity: linksOpacity,
        }}
      >
        <span>github.com/aryateja2106/lecoder-mconnect</span>
        <span>|</span>
        <span>npmjs.com/package/lecoder-mconnect</span>
      </div>
    </AbsoluteFill>
  );
};

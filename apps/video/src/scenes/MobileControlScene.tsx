import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from 'remotion';
import { PhoneMockup } from '../components/PhoneMockup';
import { QRCode } from '../components/QRCode';
import { TypewriterText } from '../components/TypewriterText';

export const MobileControlScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // QR Code animation
  const qrOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const qrScale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  // Arrow animation
  const arrowOpacity = interpolate(frame, [fps * 0.8, fps * 1.2], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const arrowX = interpolate(
    frame,
    [fps * 1, fps * 1.5, fps * 2, fps * 2.5],
    [0, 20, 0, 20],
    { extrapolateRight: 'extend' }
  );

  // Phone animation starts after QR
  const phoneDelay = fps * 1.5;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#191919',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'JetBrains Mono, monospace',
        gap: 80,
      }}
    >
      {/* Left side - QR Code */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
          opacity: qrOpacity,
          transform: `scale(${qrScale})`,
        }}
      >
        <h2 style={{ fontSize: 32, color: '#e9e9e7', fontWeight: 700 }}>
          Scan to Connect
        </h2>
        <QRCode size={200} animate={false} />
        <p style={{ color: '#6b6b6b', fontSize: 14 }}>
          No port forwarding needed
        </p>
      </div>

      {/* Arrow */}
      <div
        style={{
          opacity: arrowOpacity,
          transform: `translateX(${arrowX}px)`,
        }}
      >
        <svg width="60" height="40" viewBox="0 0 60 40" fill="none">
          <path
            d="M0 20H50M50 20L35 5M50 20L35 35"
            stroke="#4a4a4a"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Right side - Phone */}
      <Sequence from={phoneDelay}>
        <PhoneMockup title="Claude Code" width={260} height={520}>
          {/* Terminal Content in Phone */}
          <div style={{ padding: 12, fontSize: 10, lineHeight: 1.6 }}>
            {/* Agent tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              <div
                style={{
                  padding: '4px 12px',
                  backgroundColor: '#373737',
                  borderRadius: 4,
                  color: '#e9e9e7',
                  fontSize: 9,
                }}
              >
                Claude
              </div>
              <div
                style={{
                  padding: '4px 12px',
                  backgroundColor: '#252525',
                  borderRadius: 4,
                  color: '#6b6b6b',
                  fontSize: 9,
                }}
              >
                Shell
              </div>
            </div>

            {/* Terminal output */}
            <Sequence from={fps * 0.5}>
              <div style={{ color: '#6b6b6b' }}>$ claude</div>
            </Sequence>

            <Sequence from={fps * 1}>
              <div style={{ marginTop: 8, color: '#4ade80', fontSize: 9 }}>
                <TypewriterText
                  text="Claude Code is ready..."
                  charsPerSecond={15}
                  fontSize={9}
                  color="#4ade80"
                />
              </div>
            </Sequence>

            <Sequence from={fps * 2}>
              <div style={{ marginTop: 12, color: '#e9e9e7' }}>
                <TypewriterText
                  text="> Create a REST API..."
                  charsPerSecond={20}
                  fontSize={10}
                  color="#e9e9e7"
                />
              </div>
            </Sequence>

            <Sequence from={fps * 3.5}>
              <div style={{ marginTop: 8, color: '#9b9b9b', fontSize: 9 }}>
                Working on your request...
              </div>
            </Sequence>
          </div>

          {/* Bottom Controls */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '8px 12px',
              backgroundColor: '#202020',
              borderTop: '1px solid #2a2a2a',
              display: 'flex',
              gap: 8,
            }}
          >
            <div
              style={{
                flex: 1,
                padding: '6px 10px',
                backgroundColor: '#252525',
                borderRadius: 4,
                fontSize: 9,
                color: '#6b6b6b',
              }}
            >
              Type command...
            </div>
            <div
              style={{
                padding: '6px 12px',
                backgroundColor: '#e9e9e7',
                color: '#191919',
                borderRadius: 4,
                fontSize: 9,
                fontWeight: 600,
              }}
            >
              Send
            </div>
          </div>
        </PhoneMockup>
      </Sequence>
    </AbsoluteFill>
  );
};

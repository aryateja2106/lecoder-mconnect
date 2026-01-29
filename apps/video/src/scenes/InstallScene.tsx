import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from 'remotion';
import { TerminalWindow } from '../components/TerminalWindow';
import { CommandLine, OutputLine } from '../components/TypewriterText';

export const InstallScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Heading animation
  const headingOpacity = interpolate(frame, [0, fps * 0.3], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const headingY = interpolate(
    spring({
      frame,
      fps,
      config: { damping: 200 },
    }),
    [0, 1],
    [-20, 0]
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#191919',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'JetBrains Mono, monospace',
        gap: 40,
      }}
    >
      {/* Heading */}
      <div
        style={{
          opacity: headingOpacity,
          transform: `translateY(${headingY}px)`,
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: '#e9e9e7',
            margin: 0,
            marginBottom: 12,
          }}
        >
          One command to start
        </h2>
        <p style={{ color: '#6b6b6b', fontSize: 18, margin: 0 }}>
          No complex setup. Just run and connect.
        </p>
      </div>

      {/* Terminal */}
      <Sequence from={fps * 0.5}>
        <TerminalWindow title="~ Terminal" width={700} height={350}>
          {/* Command 1 */}
          <Sequence from={fps * 0.3}>
            <CommandLine command="npx lecoder-mconnect" charsPerSecond={20} />
          </Sequence>

          {/* Output lines */}
          <Sequence from={fps * 1.5}>
            <div style={{ marginTop: 16 }}>
              <OutputLine delay={0} color="#4ade80">
                [INFO] MConnect v0.2.0 starting...
              </OutputLine>
            </div>
          </Sequence>

          <Sequence from={fps * 1.8}>
            <OutputLine delay={0} color="#9b9b9b">
              [INFO] Starting Cloudflare Tunnel...
            </OutputLine>
          </Sequence>

          <Sequence from={fps * 2.1}>
            <OutputLine delay={0} color="#4ade80">
              [SUCCESS] Tunnel established!
            </OutputLine>
          </Sequence>

          <Sequence from={fps * 2.5}>
            <div style={{ marginTop: 16, padding: 16, backgroundColor: '#252525', borderRadius: 8 }}>
              <OutputLine delay={0} color="#e9e9e7">
                Scan QR code to connect:
              </OutputLine>
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <span style={{ color: '#6b6b6b' }}>URL:</span>
                <span style={{ color: '#4ade80' }}>https://mconnect.lecoder.ai/s/abc123</span>
              </div>
            </div>
          </Sequence>
        </TerminalWindow>
      </Sequence>
    </AbsoluteFill>
  );
};

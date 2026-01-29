import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from 'remotion';
import { PhoneMockup } from '../components/PhoneMockup';
import { TypewriterText } from '../components/TypewriterText';

const AgentTab: React.FC<{ name: string; active?: boolean; status?: string }> = ({
  name,
  active = false,
  status = 'running',
}) => (
  <div
    style={{
      padding: '6px 12px',
      backgroundColor: active ? '#373737' : '#252525',
      borderRadius: 4,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}
  >
    <div
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: status === 'running' ? '#4ade80' : status === 'waiting' ? '#fbbf24' : '#6b6b6b',
      }}
    />
    <span style={{ color: active ? '#e9e9e7' : '#6b6b6b', fontSize: 10 }}>{name}</span>
  </div>
);

export const MultiAgentScene: React.FC = () => {
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
          Run Multiple Agents
        </h2>
        <p style={{ color: '#6b6b6b', fontSize: 18, margin: 0 }}>
          Claude, Gemini, Cursor - all in parallel
        </p>
      </div>

      {/* Three phones showing different agents */}
      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-end' }}>
        {/* Phone 1 - Claude */}
        <Sequence from={fps * 0.5}>
          <PhoneMockup title="MConnect" width={220} height={440} rotation={-6}>
            <div style={{ padding: 10 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
                <AgentTab name="Claude" active status="running" />
                <AgentTab name="Gemini" status="waiting" />
                <AgentTab name="Shell" status="idle" />
              </div>
              <div style={{ fontSize: 9, lineHeight: 1.6 }}>
                <div style={{ color: '#6b6b6b' }}>$ claude</div>
                <Sequence from={fps * 0.5}>
                  <div style={{ color: '#4ade80', marginTop: 6 }}>
                    <TypewriterText
                      text="Building REST API..."
                      charsPerSecond={12}
                      fontSize={9}
                      color="#4ade80"
                    />
                  </div>
                </Sequence>
              </div>
            </div>
          </PhoneMockup>
        </Sequence>

        {/* Phone 2 - Gemini (center, larger) */}
        <Sequence from={fps * 1}>
          <PhoneMockup title="MConnect" width={260} height={520}>
            <div style={{ padding: 12 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
                <AgentTab name="Claude" status="running" />
                <AgentTab name="Gemini" active status="running" />
                <AgentTab name="Shell" status="idle" />
              </div>
              <div style={{ fontSize: 10, lineHeight: 1.6 }}>
                <div style={{ color: '#6b6b6b' }}>$ gemini</div>
                <Sequence from={fps * 0.5}>
                  <div style={{ color: '#4ade80', marginTop: 8 }}>
                    <TypewriterText
                      text="Writing tests..."
                      charsPerSecond={12}
                      fontSize={10}
                      color="#4ade80"
                    />
                  </div>
                </Sequence>
                <Sequence from={fps * 1.5}>
                  <div style={{ marginTop: 8, color: '#9b9b9b', fontSize: 9 }}>
                    Creating test suite for API endpoints...
                  </div>
                </Sequence>
              </div>
            </div>
          </PhoneMockup>
        </Sequence>

        {/* Phone 3 - Cursor */}
        <Sequence from={fps * 1.5}>
          <PhoneMockup title="MConnect" width={220} height={440} rotation={6}>
            <div style={{ padding: 10 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
                <AgentTab name="Claude" status="running" />
                <AgentTab name="Cursor" active status="running" />
                <AgentTab name="Shell" status="idle" />
              </div>
              <div style={{ fontSize: 9, lineHeight: 1.6 }}>
                <div style={{ color: '#6b6b6b' }}>$ cursor-agent</div>
                <Sequence from={fps * 0.5}>
                  <div style={{ color: '#4ade80', marginTop: 6 }}>
                    <TypewriterText
                      text="Reviewing code..."
                      charsPerSecond={12}
                      fontSize={9}
                      color="#4ade80"
                    />
                  </div>
                </Sequence>
              </div>
            </div>
          </PhoneMockup>
        </Sequence>
      </div>
    </AbsoluteFill>
  );
};

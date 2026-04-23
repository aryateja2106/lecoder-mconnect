import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

// Agent Tab component
const AgentTab: React.FC<{ name: string; active?: boolean; status?: 'running' | 'waiting' | 'idle' }> = ({
  name,
  active = false,
  status = 'running',
}) => (
  <div
    style={{
      padding: '6px 10px',
      backgroundColor: active ? '#373737' : '#252525',
      borderRadius: 4,
      display: 'flex',
      alignItems: 'center',
      gap: 5,
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

// Phone component for this scene - larger and clearer
const AgentPhone: React.FC<{
  opacity: number;
  scale: number;
  translateY: number;
  rotation?: number;
  width?: number;
  height?: number;
  agentName: string;
  commandText: string;
  statusText: string;
  typewriterChars: number;
}> = ({ opacity, scale, translateY, rotation = 0, width = 240, height = 480, agentName, commandText, statusText, typewriterChars }) => (
  <div
    style={{
      width,
      height,
      borderRadius: 32,
      border: '3px solid #373737',
      backgroundColor: '#191919',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      transform: `scale(${scale}) translateY(${translateY}px) rotate(${rotation}deg)`,
      opacity,
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
    }}
  >
    {/* Notch */}
    <div style={{ height: 28, backgroundColor: '#191919', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 8 }}>
      <div style={{ width: 70, height: 22, backgroundColor: '#000', borderRadius: 11 }} />
    </div>

    {/* Header */}
    <div style={{ padding: '8px 14px', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#27c93f' }} />
      <span style={{ color: '#e9e9e7', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>MConnect</span>
    </div>

    {/* Content */}
    <div style={{ flex: 1, backgroundColor: '#1f1f1f', padding: 12 }}>
      {/* Tabs - single row */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <AgentTab name={agentName} active status="running" />
        <AgentTab name="Shell" status="idle" />
      </div>

      {/* Terminal */}
      <div style={{ fontSize: 11, lineHeight: 1.6, fontFamily: 'JetBrains Mono, monospace' }}>
        <div style={{ color: '#6b6b6b', marginBottom: 8 }}>$ {commandText}</div>
        <div style={{ color: '#4ade80' }}>
          {statusText.slice(0, Math.min(typewriterChars, statusText.length))}
          {typewriterChars < statusText.length && <span>|</span>}
        </div>
      </div>
    </div>

    {/* Home bar */}
    <div style={{ height: 24, backgroundColor: '#191919', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 80, height: 4, backgroundColor: '#373737', borderRadius: 2 }} />
    </div>
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
    spring({ frame, fps, config: { damping: 200 } }),
    [0, 1],
    [-20, 0]
  );

  // Phone animations - staggered
  const phone1Start = fps * 0.5;
  const phone2Start = fps * 0.8;
  const phone3Start = fps * 1.1;

  const getPhoneAnim = (startFrame: number) => {
    const delayedFrame = Math.max(0, frame - startFrame);
    return {
      opacity: interpolate(frame, [startFrame, startFrame + fps * 0.3], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }),
      scale: spring({ frame: delayedFrame, fps, config: { damping: 15, stiffness: 80 } }),
      translateY: interpolate(
        spring({ frame: delayedFrame, fps, config: { damping: 200 } }),
        [0, 1],
        [40, 0]
      ),
    };
  };

  const phone1 = getPhoneAnim(phone1Start);
  const phone2 = getPhoneAnim(phone2Start);
  const phone3 = getPhoneAnim(phone3Start);

  // Typewriter for each phone
  const charsPerSecond = 15;
  const charsPerFrame = charsPerSecond / fps;
  const chars1 = Math.floor(Math.max(0, frame - phone1Start - fps * 0.4) * charsPerFrame);
  const chars2 = Math.floor(Math.max(0, frame - phone2Start - fps * 0.4) * charsPerFrame);
  const chars3 = Math.floor(Math.max(0, frame - phone3Start - fps * 0.4) * charsPerFrame);

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
          gap: 50,
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
          <h2 style={{ fontSize: 52, fontWeight: 700, color: '#e9e9e7', margin: 0, marginBottom: 12 }}>
            Run Multiple Agents
          </h2>
          <p style={{ color: '#6b6b6b', fontSize: 20, margin: 0 }}>
            Claude, Gemini, Cursor — all in parallel
          </p>
        </div>

        {/* Three phones */}
        <div style={{ display: 'flex', gap: 40, alignItems: 'flex-end' }}>
          <AgentPhone
            {...phone1}
            rotation={-5}
            width={220}
            height={420}
            agentName="Claude"
            commandText="claude"
            statusText="Building REST API..."
            typewriterChars={chars1}
          />
          <AgentPhone
            {...phone2}
            rotation={0}
            width={260}
            height={500}
            agentName="Gemini"
            commandText="gemini"
            statusText="Writing test suite..."
            typewriterChars={chars2}
          />
          <AgentPhone
            {...phone3}
            rotation={5}
            width={220}
            height={420}
            agentName="Cursor"
            commandText="cursor-agent"
            statusText="Reviewing changes..."
            typewriterChars={chars3}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

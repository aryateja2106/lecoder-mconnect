import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

type TerminalWindowProps = {
  title?: string;
  children: React.ReactNode;
  width?: number;
  height?: number;
  animate?: boolean;
  delay?: number;
};

export const TerminalWindow: React.FC<TerminalWindowProps> = ({
  title = 'Terminal',
  children,
  width = 800,
  height = 500,
  animate = true,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delayedFrame = Math.max(0, frame - delay);

  const scale = animate
    ? spring({
        frame: delayedFrame,
        fps,
        config: { damping: 200 },
      })
    : 1;

  const opacity = animate
    ? interpolate(delayedFrame, [0, fps * 0.3], [0, 1], {
        extrapolateRight: 'clamp',
      })
    : 1;

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: '#1f1f1f',
        border: '1px solid #373737',
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transform: `scale(${scale})`,
        opacity,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Terminal Header */}
      <div
        style={{
          backgroundColor: '#202020',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1px solid #2a2a2a',
        }}
      >
        <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ff5f56' }} />
        <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
        <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#27c93f' }} />
        <span style={{ marginLeft: 8, color: '#6b6b6b', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>
          {title}
        </span>
      </div>

      {/* Terminal Body */}
      <div
        style={{
          flex: 1,
          padding: 24,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 14,
          lineHeight: 1.8,
          color: '#e9e9e7',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
};

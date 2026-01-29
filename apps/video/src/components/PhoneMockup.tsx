import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

type PhoneMockupProps = {
  children: React.ReactNode;
  title?: string;
  width?: number;
  height?: number;
  animate?: boolean;
  delay?: number;
  rotation?: number;
};

export const PhoneMockup: React.FC<PhoneMockupProps> = ({
  children,
  title = 'MConnect',
  width = 280,
  height = 560,
  animate = true,
  delay = 0,
  rotation = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delayedFrame = Math.max(0, frame - delay);

  const scale = animate
    ? spring({
        frame: delayedFrame,
        fps,
        config: { damping: 15, stiffness: 80 },
      })
    : 1;

  const opacity = animate
    ? interpolate(delayedFrame, [0, fps * 0.3], [0, 1], {
        extrapolateRight: 'clamp',
      })
    : 1;

  const translateY = animate
    ? interpolate(
        spring({
          frame: delayedFrame,
          fps,
          config: { damping: 200 },
        }),
        [0, 1],
        [50, 0]
      )
    : 0;

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 36,
        border: '3px solid #373737',
        backgroundColor: '#191919',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transform: `scale(${scale}) translateY(${translateY}px) rotate(${rotation}deg)`,
        opacity,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Phone Notch */}
      <div
        style={{
          height: 32,
          backgroundColor: '#191919',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 8,
        }}
      >
        <div
          style={{
            width: 80,
            height: 24,
            backgroundColor: '#000',
            borderRadius: 12,
          }}
        />
      </div>

      {/* Screen Header */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid #2a2a2a',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#27c93f' }} />
        <span style={{ color: '#6b6b6b', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
          {title}
        </span>
      </div>

      {/* Screen Content */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          backgroundColor: '#1f1f1f',
        }}
      >
        {children}
      </div>

      {/* Home Bar */}
      <div
        style={{
          height: 28,
          backgroundColor: '#191919',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: 4,
        }}
      >
        <div
          style={{
            width: 100,
            height: 4,
            backgroundColor: '#373737',
            borderRadius: 2,
          }}
        />
      </div>
    </div>
  );
};

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

type FeatureCardProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay?: number;
  width?: number;
};

export const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  delay = 0,
  width = 300,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delayedFrame = Math.max(0, frame - delay);

  const scale = spring({
    frame: delayedFrame,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const opacity = interpolate(delayedFrame, [0, fps * 0.3], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const translateY = interpolate(
    spring({
      frame: delayedFrame,
      fps,
      config: { damping: 200 },
    }),
    [0, 1],
    [30, 0]
  );

  return (
    <div
      style={{
        width,
        padding: 24,
        backgroundColor: '#1f1f1f',
        border: '1px solid #373737',
        borderRadius: 8,
        transform: `scale(${scale}) translateY(${translateY}px)`,
        opacity,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          border: '1px solid #373737',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          color: '#9b9b9b',
        }}
      >
        {icon}
      </div>
      <h3
        style={{
          color: '#e9e9e7',
          fontSize: 16,
          fontWeight: 700,
          marginBottom: 8,
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          color: '#6b6b6b',
          fontSize: 13,
          lineHeight: 1.5,
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        {description}
      </p>
    </div>
  );
};

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

type PixelLogoProps = {
  size?: number;
  animate?: boolean;
};

export const PixelLogo: React.FC<PixelLogoProps> = ({ size = 100, animate = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = animate
    ? spring({
        frame,
        fps,
        config: { damping: 15, stiffness: 100 },
      })
    : 1;

  const opacity = animate
    ? interpolate(frame, [0, fps * 0.5], [0, 1], {
        extrapolateRight: 'clamp',
      })
    : 1;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      style={{
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      <rect x="4" y="4" width="10" height="24" fill="#e9e9e7" />
      <rect x="4" y="22" width="24" height="6" fill="#e9e9e7" />
      <rect x="10" y="10" width="4" height="12" fill="#191919" opacity="0.3" />
    </svg>
  );
};

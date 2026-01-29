import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

type QRCodeProps = {
  size?: number;
  animate?: boolean;
  delay?: number;
};

// Simple QR code placeholder - generates a pattern that looks like a QR code
export const QRCode: React.FC<QRCodeProps> = ({ size = 150, animate = true, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delayedFrame = Math.max(0, frame - delay);

  const scale = animate
    ? spring({
        frame: delayedFrame,
        fps,
        config: { damping: 15, stiffness: 100 },
      })
    : 1;

  const opacity = animate
    ? interpolate(delayedFrame, [0, fps * 0.3], [0, 1], {
        extrapolateRight: 'clamp',
      })
    : 1;

  // Generate a simple QR-like pattern
  const gridSize = 21;
  const cellSize = size / gridSize;

  // Seed for consistent pattern
  const pattern = React.useMemo(() => {
    const cells: boolean[][] = [];
    for (let i = 0; i < gridSize; i++) {
      cells[i] = [];
      for (let j = 0; j < gridSize; j++) {
        // Position finders (corners)
        const isFinderArea =
          (i < 7 && j < 7) ||
          (i < 7 && j >= gridSize - 7) ||
          (i >= gridSize - 7 && j < 7);

        if (isFinderArea) {
          // Create finder pattern
          const localI = i < 7 ? i : (i >= gridSize - 7 ? i - (gridSize - 7) : i);
          const localJ = j < 7 ? j : (j >= gridSize - 7 ? j - (gridSize - 7) : j);

          if (localI === 0 || localI === 6 || localJ === 0 || localJ === 6) {
            cells[i][j] = true;
          } else if (localI >= 2 && localI <= 4 && localJ >= 2 && localJ <= 4) {
            cells[i][j] = true;
          } else {
            cells[i][j] = false;
          }
        } else {
          // Random data pattern
          cells[i][j] = Math.sin(i * 13 + j * 17) > 0.2;
        }
      }
    }
    return cells;
  }, []);

  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: '#e9e9e7',
        padding: cellSize,
        borderRadius: 4,
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      <svg width={size - cellSize * 2} height={size - cellSize * 2} viewBox={`0 0 ${gridSize} ${gridSize}`}>
        {pattern.map((row, i) =>
          row.map((cell, j) =>
            cell ? (
              <rect key={`${i}-${j}`} x={j} y={i} width={1} height={1} fill="#191919" />
            ) : null
          )
        )}
      </svg>
    </div>
  );
};

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

// Simple QR Code component (inline to avoid import issues)
const QRCodeDisplay: React.FC<{ size: number; opacity: number; scale: number }> = ({ size, opacity, scale }) => {
  const gridSize = 21;

  // Generate QR-like pattern
  const pattern = React.useMemo(() => {
    const cells: boolean[][] = [];
    for (let i = 0; i < gridSize; i++) {
      cells[i] = [];
      for (let j = 0; j < gridSize; j++) {
        const isFinderArea =
          (i < 7 && j < 7) ||
          (i < 7 && j >= gridSize - 7) ||
          (i >= gridSize - 7 && j < 7);

        if (isFinderArea) {
          const localI = i < 7 ? i : i - (gridSize - 7);
          const localJ = j < 7 ? j : j - (gridSize - 7);
          if (localI === 0 || localI === 6 || localJ === 0 || localJ === 6) {
            cells[i][j] = true;
          } else if (localI >= 2 && localI <= 4 && localJ >= 2 && localJ <= 4) {
            cells[i][j] = true;
          } else {
            cells[i][j] = false;
          }
        } else {
          cells[i][j] = Math.sin(i * 13 + j * 17) > 0.2;
        }
      }
    }
    return cells;
  }, []);

  const cellSize = size / gridSize;

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
            cell ? <rect key={`${i}-${j}`} x={j} y={i} width={1} height={1} fill="#191919" /> : null
          )
        )}
      </svg>
    </div>
  );
};

// Simple Phone Mockup (inline)
const PhoneDisplay: React.FC<{
  opacity: number;
  scale: number;
  translateY: number;
  children: React.ReactNode;
}> = ({ opacity, scale, translateY, children }) => (
  <div
    style={{
      width: 260,
      height: 520,
      borderRadius: 36,
      border: '3px solid #373737',
      backgroundColor: '#191919',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      transform: `scale(${scale}) translateY(${translateY}px)`,
      opacity,
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    }}
  >
    {/* Notch */}
    <div style={{ height: 32, backgroundColor: '#191919', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 8 }}>
      <div style={{ width: 80, height: 24, backgroundColor: '#000', borderRadius: 12 }} />
    </div>
    {/* Header */}
    <div style={{ padding: '8px 16px', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#27c93f' }} />
      <span style={{ color: '#6b6b6b', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>Claude Code</span>
    </div>
    {/* Content */}
    <div style={{ flex: 1, overflow: 'hidden', backgroundColor: '#1f1f1f', position: 'relative' }}>
      {children}
    </div>
    {/* Home bar */}
    <div style={{ height: 28, backgroundColor: '#191919', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 4 }}>
      <div style={{ width: 100, height: 4, backgroundColor: '#373737', borderRadius: 2 }} />
    </div>
  </div>
);

export const MobileControlScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // QR Code animation (starts immediately)
  const qrOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const qrScale = spring({ frame, fps, config: { damping: 15, stiffness: 100 } });

  // Arrow animation (starts at 0.8s)
  const arrowOpacity = interpolate(frame, [fps * 0.8, fps * 1.2], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const arrowX = interpolate(
    frame % (fps * 1.5),
    [0, fps * 0.75, fps * 1.5],
    [0, 20, 0]
  );

  // Phone animation (starts at 1.5s)
  const phoneStartFrame = fps * 1.5;
  const phoneOpacity = interpolate(frame, [phoneStartFrame, phoneStartFrame + fps * 0.3], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const phoneScale = spring({
    frame: Math.max(0, frame - phoneStartFrame),
    fps,
    config: { damping: 15, stiffness: 80 },
  });
  const phoneTranslateY = interpolate(
    spring({ frame: Math.max(0, frame - phoneStartFrame), fps, config: { damping: 200 } }),
    [0, 1],
    [50, 0]
  );

  // Phone content typewriter
  const typewriterStart = phoneStartFrame + fps * 0.5;
  const charsPerSecond = 15;
  const charsPerFrame = charsPerSecond / fps;
  const text1 = 'Claude Code is ready...';
  const text2 = '> Create a REST API...';
  const chars1 = Math.floor(Math.max(0, frame - typewriterStart) * charsPerFrame);
  const chars2 = Math.floor(Math.max(0, frame - typewriterStart - fps * 1) * charsPerFrame);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#191919',
        fontFamily: 'JetBrains Mono, monospace',
      }}
    >
      {/* Centered horizontal layout */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
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
          }}
        >
          <h2 style={{ fontSize: 32, color: '#e9e9e7', fontWeight: 700, opacity: qrOpacity }}>
            Scan to Connect
          </h2>
          <QRCodeDisplay size={200} opacity={qrOpacity} scale={qrScale} />
          <p style={{ color: '#6b6b6b', fontSize: 14, opacity: qrOpacity }}>
            No port forwarding needed
          </p>
        </div>

        {/* Arrow */}
        <div style={{ opacity: arrowOpacity, transform: `translateX(${arrowX}px)` }}>
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
        <PhoneDisplay opacity={phoneOpacity} scale={phoneScale} translateY={phoneTranslateY}>
          <div style={{ padding: 12, fontSize: 10, lineHeight: 1.6 }}>
            {/* Agent tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              <div style={{ padding: '4px 12px', backgroundColor: '#373737', borderRadius: 4, color: '#e9e9e7', fontSize: 9 }}>
                Claude
              </div>
              <div style={{ padding: '4px 12px', backgroundColor: '#252525', borderRadius: 4, color: '#6b6b6b', fontSize: 9 }}>
                Shell
              </div>
            </div>

            {/* Terminal output */}
            <div style={{ color: '#6b6b6b' }}>$ claude</div>

            {frame >= typewriterStart && (
              <div style={{ marginTop: 8, color: '#4ade80', fontSize: 9 }}>
                {text1.slice(0, Math.min(chars1, text1.length))}
                {chars1 < text1.length && <span style={{ color: '#4ade80' }}>|</span>}
              </div>
            )}

            {frame >= typewriterStart + fps * 1 && (
              <div style={{ marginTop: 12, color: '#e9e9e7', fontSize: 10 }}>
                {text2.slice(0, Math.min(chars2, text2.length))}
                {chars2 < text2.length && <span style={{ color: '#4ade80' }}>|</span>}
              </div>
            )}

            {frame >= typewriterStart + fps * 2.5 && (
              <div style={{ marginTop: 8, color: '#9b9b9b', fontSize: 9 }}>
                Working on your request...
              </div>
            )}
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
            <div style={{ flex: 1, padding: '6px 10px', backgroundColor: '#252525', borderRadius: 4, fontSize: 9, color: '#6b6b6b' }}>
              Type command...
            </div>
            <div style={{ padding: '6px 12px', backgroundColor: '#e9e9e7', color: '#191919', borderRadius: 4, fontSize: 9, fontWeight: 600 }}>
              Send
            </div>
          </div>
        </PhoneDisplay>
      </div>
    </AbsoluteFill>
  );
};

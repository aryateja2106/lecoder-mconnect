import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

// Typewriter helper
const useTypewriter = (text: string, startFrame: number, charsPerSecond: number, frame: number, fps: number) => {
  const charsPerFrame = charsPerSecond / fps;
  const charCount = Math.floor(Math.max(0, frame - startFrame) * charsPerFrame);
  const displayText = text.slice(0, Math.min(charCount, text.length));
  const isTyping = charCount < text.length && frame >= startFrame;
  const isDone = charCount >= text.length;
  return { displayText, isTyping, isDone, visible: frame >= startFrame };
};

// Mini QR Code for preview
const MiniQRCode: React.FC<{ size: number; opacity: number }> = ({ size, opacity }) => {
  const gridSize = 11;
  const pattern = React.useMemo(() => {
    const cells: boolean[][] = [];
    for (let i = 0; i < gridSize; i++) {
      cells[i] = [];
      for (let j = 0; j < gridSize; j++) {
        const isFinderArea = (i < 4 && j < 4) || (i < 4 && j >= gridSize - 4) || (i >= gridSize - 4 && j < 4);
        if (isFinderArea) {
          const localI = i < 4 ? i : i - (gridSize - 4);
          const localJ = j < 4 ? j : j - (gridSize - 4);
          cells[i][j] = localI === 0 || localI === 3 || localJ === 0 || localJ === 3 || (localI >= 1 && localI <= 2 && localJ >= 1 && localJ <= 2);
        } else {
          cells[i][j] = Math.sin(i * 13 + j * 17) > 0.2;
        }
      }
    }
    return cells;
  }, []);

  return (
    <div style={{ width: size, height: size, backgroundColor: '#e9e9e7', padding: 4, borderRadius: 4, opacity }}>
      <svg width={size - 8} height={size - 8} viewBox={`0 0 ${gridSize} ${gridSize}`}>
        {pattern.map((row, i) =>
          row.map((cell, j) => (cell ? <rect key={`${i}-${j}`} x={j} y={i} width={1} height={1} fill="#191919" /> : null))
        )}
      </svg>
    </div>
  );
};

export const InstallScene: React.FC = () => {
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

  // Terminal animation (starts at 0.5s)
  const terminalStartFrame = fps * 0.5;
  const terminalOpacity = interpolate(frame, [terminalStartFrame, terminalStartFrame + fps * 0.3], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const terminalScale = spring({
    frame: Math.max(0, frame - terminalStartFrame),
    fps,
    config: { damping: 200 },
  });

  // Command typewriter (starts at 0.8s)
  const command = useTypewriter('npx lecoder-mconnect', fps * 0.8, 25, frame, fps);

  // Output lines timing
  const line1Start = fps * 1.8;
  const line2Start = fps * 2.2;
  const line3Start = fps * 2.6;
  const boxStart = fps * 3;
  const qrStart = fps * 3.8;

  const line1Opacity = interpolate(frame, [line1Start, line1Start + fps * 0.15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const line2Opacity = interpolate(frame, [line2Start, line2Start + fps * 0.15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const line3Opacity = interpolate(frame, [line3Start, line3Start + fps * 0.15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const boxOpacity = interpolate(frame, [boxStart, boxStart + fps * 0.3], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const qrOpacity = interpolate(frame, [qrStart, qrStart + fps * 0.3], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Cursor blink
  const cursorVisible = Math.floor(frame / (fps / 2)) % 2 === 0;

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
              fontSize: 52,
              fontWeight: 700,
              color: '#e9e9e7',
              margin: 0,
              marginBottom: 12,
            }}
          >
            One command to start
          </h2>
          <p style={{ color: '#6b6b6b', fontSize: 20, margin: 0 }}>
            No complex setup. Just run and connect.
          </p>
        </div>

        {/* Terminal Window */}
        <div
          style={{
            width: 750,
            backgroundColor: '#1f1f1f',
            border: '1px solid #373737',
            borderRadius: 10,
            overflow: 'hidden',
            opacity: terminalOpacity,
            transform: `scale(${terminalScale})`,
            boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.6)',
          }}
        >
          {/* Terminal Header */}
          <div
            style={{
              backgroundColor: '#202020',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderBottom: '1px solid #2a2a2a',
            }}
          >
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ff5f56' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#27c93f' }} />
            <span style={{ marginLeft: 10, color: '#6b6b6b', fontSize: 13 }}>~ Terminal</span>
          </div>

          {/* Terminal Body */}
          <div style={{ padding: 28, fontSize: 15, lineHeight: 2 }}>
            {/* Command Line */}
            {command.visible && (
              <div style={{ display: 'flex', gap: 10 }}>
                <span style={{ color: '#6b6b6b' }}>$</span>
                <span style={{ color: '#e9e9e7' }}>
                  {command.displayText}
                  {command.isTyping && <span style={{ color: '#4ade80' }}>|</span>}
                  {command.isDone && cursorVisible && <span style={{ color: '#4ade80' }}>|</span>}
                </span>
              </div>
            )}

            {/* Output Lines */}
            <div style={{ marginTop: 20, opacity: line1Opacity, color: '#4ade80' }}>
              [INFO] MConnect v0.2.0 starting...
            </div>
            <div style={{ opacity: line2Opacity, color: '#9b9b9b' }}>
              [INFO] Starting Cloudflare Tunnel...
            </div>
            <div style={{ opacity: line3Opacity, color: '#4ade80' }}>
              [SUCCESS] Tunnel established!
            </div>

            {/* URL Box with QR */}
            <div
              style={{
                marginTop: 20,
                padding: 18,
                backgroundColor: '#252525',
                borderRadius: 8,
                opacity: boxOpacity,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ color: '#e9e9e7', marginBottom: 10, fontWeight: 600 }}>Scan QR code to connect:</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <span style={{ color: '#6b6b6b' }}>URL:</span>
                  <span style={{ color: '#4ade80' }}>https://mconnect.lecoder.ai/s/abc123</span>
                </div>
              </div>
              <MiniQRCode size={60} opacity={qrOpacity} />
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

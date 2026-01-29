import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

type TypewriterTextProps = {
  text: string;
  startFrame?: number;
  charsPerSecond?: number;
  showCursor?: boolean;
  cursorChar?: string;
  color?: string;
  fontSize?: number;
};

export const TypewriterText: React.FC<TypewriterTextProps> = ({
  text,
  startFrame = 0,
  charsPerSecond = 30,
  showCursor = true,
  cursorChar = '|',
  color = '#e9e9e7',
  fontSize = 14,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const adjustedFrame = Math.max(0, frame - startFrame);
  const charsPerFrame = charsPerSecond / fps;
  const charCount = Math.floor(adjustedFrame * charsPerFrame);
  const displayText = text.slice(0, Math.min(charCount, text.length));
  const isTyping = charCount < text.length;

  // Cursor blink effect (visible every other half second)
  const cursorVisible = Math.floor(frame / (fps / 2)) % 2 === 0;

  return (
    <span style={{ color, fontSize, fontFamily: 'JetBrains Mono, monospace' }}>
      {displayText}
      {showCursor && (isTyping || cursorVisible) && (
        <span style={{ color: '#4ade80' }}>{cursorChar}</span>
      )}
    </span>
  );
};

type CommandLineProps = {
  prompt?: string;
  command: string;
  startFrame?: number;
  charsPerSecond?: number;
};

export const CommandLine: React.FC<CommandLineProps> = ({
  prompt = '$',
  command,
  startFrame = 0,
  charsPerSecond = 25,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const adjustedFrame = Math.max(0, frame - startFrame);
  const charsPerFrame = charsPerSecond / fps;
  const charCount = Math.floor(adjustedFrame * charsPerFrame);
  const displayCommand = command.slice(0, Math.min(charCount, command.length));
  const isTyping = charCount < command.length;
  const cursorVisible = Math.floor(frame / (fps / 2)) % 2 === 0;

  return (
    <div style={{ display: 'flex', gap: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 14 }}>
      <span style={{ color: '#6b6b6b' }}>{prompt}</span>
      <span style={{ color: '#e9e9e7' }}>
        {displayCommand}
        {(isTyping || cursorVisible) && <span style={{ color: '#4ade80' }}>|</span>}
      </span>
    </div>
  );
};

type OutputLineProps = {
  children: React.ReactNode;
  delay?: number;
  color?: string;
};

export const OutputLine: React.FC<OutputLineProps> = ({
  children,
  delay = 0,
  color = '#9b9b9b',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(
    frame,
    [delay, delay + fps * 0.2],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div style={{ color, opacity, fontFamily: 'JetBrains Mono, monospace', fontSize: 14 }}>
      {children}
    </div>
  );
};

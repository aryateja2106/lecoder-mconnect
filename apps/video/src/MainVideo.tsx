import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate } from 'remotion';

import { IntroScene } from './scenes/IntroScene';
import { InstallScene } from './scenes/InstallScene';
import { MobileControlScene } from './scenes/MobileControlScene';
import { MultiAgentScene } from './scenes/MultiAgentScene';
import { FeaturesScene } from './scenes/FeaturesScene';
import { OutroScene } from './scenes/OutroScene';

// Constants - fps is 30, defined in Root.tsx
const FPS = 30;

// Scene durations in frames
const INTRO_DURATION = 4 * FPS; // 4 seconds = 120 frames
const INSTALL_DURATION = 5 * FPS; // 5 seconds = 150 frames
const MOBILE_DURATION = 5 * FPS; // 5 seconds = 150 frames
const MULTIAGENT_DURATION = 5 * FPS; // 5 seconds = 150 frames
const FEATURES_DURATION = 4 * FPS; // 4 seconds = 120 frames
const OUTRO_DURATION = 4 * FPS; // 4 seconds = 120 frames

const FADE_DURATION = 15; // 0.5 second fade

// Calculate start frames for each scene
const SCENE_STARTS = {
  intro: 0,
  install: INTRO_DURATION,
  mobile: INTRO_DURATION + INSTALL_DURATION,
  multiAgent: INTRO_DURATION + INSTALL_DURATION + MOBILE_DURATION,
  features: INTRO_DURATION + INSTALL_DURATION + MOBILE_DURATION + MULTIAGENT_DURATION,
  outro: INTRO_DURATION + INSTALL_DURATION + MOBILE_DURATION + MULTIAGENT_DURATION + FEATURES_DURATION,
};

// Fade wrapper component for transitions
const FadeWrapper: React.FC<{
  children: React.ReactNode;
  startFrame: number;
  duration: number;
}> = ({ children, startFrame, duration }) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  // Fade in at start, fade out at end
  const fadeIn = interpolate(localFrame, [0, FADE_DURATION], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const fadeOut = interpolate(
    localFrame,
    [duration - FADE_DURATION, duration],
    [1, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  const opacity = Math.min(fadeIn, fadeOut);

  return <div style={{ opacity, width: '100%', height: '100%' }}>{children}</div>;
};

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#191919' }}>
      {/* Scene 1: Intro */}
      <Sequence from={SCENE_STARTS.intro} durationInFrames={INTRO_DURATION}>
        <FadeWrapper startFrame={SCENE_STARTS.intro} duration={INTRO_DURATION}>
          <IntroScene />
        </FadeWrapper>
      </Sequence>

      {/* Scene 2: Install/Setup */}
      <Sequence from={SCENE_STARTS.install} durationInFrames={INSTALL_DURATION}>
        <FadeWrapper startFrame={SCENE_STARTS.install} duration={INSTALL_DURATION}>
          <InstallScene />
        </FadeWrapper>
      </Sequence>

      {/* Scene 3: Mobile Control with QR */}
      <Sequence from={SCENE_STARTS.mobile} durationInFrames={MOBILE_DURATION}>
        <FadeWrapper startFrame={SCENE_STARTS.mobile} duration={MOBILE_DURATION}>
          <MobileControlScene />
        </FadeWrapper>
      </Sequence>

      {/* Scene 4: Multi-Agent */}
      <Sequence from={SCENE_STARTS.multiAgent} durationInFrames={MULTIAGENT_DURATION}>
        <FadeWrapper startFrame={SCENE_STARTS.multiAgent} duration={MULTIAGENT_DURATION}>
          <MultiAgentScene />
        </FadeWrapper>
      </Sequence>

      {/* Scene 5: Features */}
      <Sequence from={SCENE_STARTS.features} durationInFrames={FEATURES_DURATION}>
        <FadeWrapper startFrame={SCENE_STARTS.features} duration={FEATURES_DURATION}>
          <FeaturesScene />
        </FadeWrapper>
      </Sequence>

      {/* Scene 6: Outro/CTA */}
      <Sequence from={SCENE_STARTS.outro} durationInFrames={OUTRO_DURATION}>
        <FadeWrapper startFrame={SCENE_STARTS.outro} duration={OUTRO_DURATION}>
          <OutroScene />
        </FadeWrapper>
      </Sequence>
    </AbsoluteFill>
  );
};

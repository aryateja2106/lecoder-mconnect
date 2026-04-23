import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';

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

// Calculate start frames for each scene
const SCENE_STARTS = {
  intro: 0,
  install: INTRO_DURATION,
  mobile: INTRO_DURATION + INSTALL_DURATION,
  multiAgent: INTRO_DURATION + INSTALL_DURATION + MOBILE_DURATION,
  features: INTRO_DURATION + INSTALL_DURATION + MOBILE_DURATION + MULTIAGENT_DURATION,
  outro: INTRO_DURATION + INSTALL_DURATION + MOBILE_DURATION + MULTIAGENT_DURATION + FEATURES_DURATION,
};

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#191919' }}>
      {/* Scene 1: Intro */}
      <Sequence from={SCENE_STARTS.intro} durationInFrames={INTRO_DURATION} name="Intro">
        <IntroScene />
      </Sequence>

      {/* Scene 2: Install/Setup */}
      <Sequence from={SCENE_STARTS.install} durationInFrames={INSTALL_DURATION} name="Install">
        <InstallScene />
      </Sequence>

      {/* Scene 3: Mobile Control with QR */}
      <Sequence from={SCENE_STARTS.mobile} durationInFrames={MOBILE_DURATION} name="Mobile">
        <MobileControlScene />
      </Sequence>

      {/* Scene 4: Multi-Agent */}
      <Sequence from={SCENE_STARTS.multiAgent} durationInFrames={MULTIAGENT_DURATION} name="MultiAgent">
        <MultiAgentScene />
      </Sequence>

      {/* Scene 5: Features */}
      <Sequence from={SCENE_STARTS.features} durationInFrames={FEATURES_DURATION} name="Features">
        <FeaturesScene />
      </Sequence>

      {/* Scene 6: Outro/CTA */}
      <Sequence from={SCENE_STARTS.outro} durationInFrames={OUTRO_DURATION} name="Outro">
        <OutroScene />
      </Sequence>
    </AbsoluteFill>
  );
};

import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';

import { IntroScene } from './scenes/IntroScene';
import { InstallScene } from './scenes/InstallScene';
import { MobileControlScene } from './scenes/MobileControlScene';
import { MultiAgentScene } from './scenes/MultiAgentScene';
import { FeaturesScene } from './scenes/FeaturesScene';
import { OutroScene } from './scenes/OutroScene';

export const MainVideo: React.FC = () => {
  const { fps } = useVideoConfig();

  // Scene durations in seconds
  const INTRO_DURATION = 4 * fps; // 4 seconds
  const INSTALL_DURATION = 5 * fps; // 5 seconds
  const MOBILE_DURATION = 5 * fps; // 5 seconds
  const MULTIAGENT_DURATION = 5 * fps; // 5 seconds
  const FEATURES_DURATION = 4 * fps; // 4 seconds
  const OUTRO_DURATION = 4 * fps; // 4 seconds

  const TRANSITION_DURATION = Math.round(0.5 * fps); // 0.5 second transitions

  return (
    <AbsoluteFill style={{ backgroundColor: '#191919' }}>
      <TransitionSeries>
        {/* Scene 1: Intro */}
        <TransitionSeries.Sequence durationInFrames={INTRO_DURATION}>
          <IntroScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* Scene 2: Install/Setup */}
        <TransitionSeries.Sequence durationInFrames={INSTALL_DURATION}>
          <InstallScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* Scene 3: Mobile Control with QR */}
        <TransitionSeries.Sequence durationInFrames={MOBILE_DURATION}>
          <MobileControlScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* Scene 4: Multi-Agent */}
        <TransitionSeries.Sequence durationInFrames={MULTIAGENT_DURATION}>
          <MultiAgentScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* Scene 5: Features */}
        <TransitionSeries.Sequence durationInFrames={FEATURES_DURATION}>
          <FeaturesScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* Scene 6: Outro/CTA */}
        <TransitionSeries.Sequence durationInFrames={OUTRO_DURATION}>
          <OutroScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};

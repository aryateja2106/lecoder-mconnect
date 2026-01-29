import React from 'react';
import { Composition, Folder } from 'remotion';
import { MainVideo } from './MainVideo';
import { IntroScene } from './scenes/IntroScene';
import { InstallScene } from './scenes/InstallScene';
import { MobileControlScene } from './scenes/MobileControlScene';
import { MultiAgentScene } from './scenes/MultiAgentScene';
import { FeaturesScene } from './scenes/FeaturesScene';
import { OutroScene } from './scenes/OutroScene';

import './styles.css';

// Video Configuration
const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

// Scene durations in frames
const SCENE_DURATIONS = {
  intro: 4 * FPS,
  install: 5 * FPS,
  mobile: 5 * FPS,
  multiAgent: 5 * FPS,
  features: 4 * FPS,
  outro: 4 * FPS,
};

const TRANSITION_FRAMES = Math.round(0.5 * FPS);
const NUM_TRANSITIONS = 5;

// Total duration: sum of scenes minus overlapping transitions
const TOTAL_DURATION =
  Object.values(SCENE_DURATIONS).reduce((a, b) => a + b, 0) -
  NUM_TRANSITIONS * TRANSITION_FRAMES;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Main Video */}
      <Composition
        id="MainVideo"
        component={MainVideo}
        durationInFrames={TOTAL_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      {/* Individual Scenes for Preview/Development */}
      <Folder name="Scenes">
        <Composition
          id="Intro"
          component={IntroScene}
          durationInFrames={SCENE_DURATIONS.intro}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="Install"
          component={InstallScene}
          durationInFrames={SCENE_DURATIONS.install}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="MobileControl"
          component={MobileControlScene}
          durationInFrames={SCENE_DURATIONS.mobile}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="MultiAgent"
          component={MultiAgentScene}
          durationInFrames={SCENE_DURATIONS.multiAgent}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="Features"
          component={FeaturesScene}
          durationInFrames={SCENE_DURATIONS.features}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="Outro"
          component={OutroScene}
          durationInFrames={SCENE_DURATIONS.outro}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
      </Folder>

      {/* Social Media Formats */}
      <Folder name="Social">
        {/* Instagram/TikTok Vertical */}
        <Composition
          id="MainVideo-Vertical"
          component={MainVideo}
          durationInFrames={TOTAL_DURATION}
          fps={FPS}
          width={1080}
          height={1920}
        />
        {/* Square Format */}
        <Composition
          id="MainVideo-Square"
          component={MainVideo}
          durationInFrames={TOTAL_DURATION}
          fps={FPS}
          width={1080}
          height={1080}
        />
      </Folder>
    </>
  );
};

declare module 'react-native-vlc-media-player' {
  import { Component } from 'react';
  import { ViewStyle } from 'react-native';

  export interface VLCPlayerProps {
    source: {
      uri: string;
      initType?: number;
      hwDecoderEnabled?: number;
      hwDecoderForced?: number;
      initOptions?: string[];
    };
    style?: ViewStyle;
    autoplay?: boolean;
    paused?: boolean;
    repeat?: boolean;
    muted?: boolean;
    volume?: number;
    videoAspectRatio?: string;
    resizeMode?: 'contain' | 'cover' | 'stretch';
    onPlaying?: (event: { duration: number; seekable: boolean }) => void;
    onProgress?: (event: { currentTime: number; duration: number; position: number }) => void;
    onPaused?: () => void;
    onStopped?: () => void;
    onBuffering?: (event: { isBuffering: boolean }) => void;
    onEnded?: () => void;
    onError?: (event: { error: string }) => void;
    onLoad?: (event: { duration: number }) => void;
  }

  export class VLCPlayer extends Component<VLCPlayerProps> {}
  export default VLCPlayer;
}

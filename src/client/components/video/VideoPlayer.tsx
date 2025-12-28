// src/client/components/video/VideoPlayer.tsx
import "@vidstack/react/player/styles/default/layouts/video.css";
import "@vidstack/react/player/styles/default/theme.css";

import {
  MediaPlayer,
  MediaProvider,
  type MediaPlayerInstance,
  type MediaProviderAdapter
} from "@vidstack/react";
import {
  defaultLayoutIcons,
  DefaultVideoLayout
} from "@vidstack/react/player/layouts/default";
import { useCallback, useEffect, useRef } from "react";
import { useUIStore } from "../../stores/uiStore";

interface VideoPlayerProps {
  src: string;
  title?: string;
  poster?: string;
  onError?: (error: Error) => void;
  onLoadedMetadata?: (duration: number, width: number, height: number) => void;
  className?: string;
}

export function VideoPlayer({
  src,
  title,
  poster,
  onError,
  onLoadedMetadata,
  className = ""
}: VideoPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance>(null);
  const hasSetInitialVolume = useRef(false);

  // Optimized Zustand selector
  const videoVolume = useUIStore((state) => state.videoVolume);
  const setVideoVolume = useUIStore((state) => state.setVideoVolume);

  // Set initial volume when player is ready
  useEffect(() => {
    const player = playerRef.current;
    if (player && !hasSetInitialVolume.current) {
      player.volume = videoVolume;
      hasSetInitialVolume.current = true;
    }
  }, [videoVolume]);

  // Handle provider setup
  const handleProviderSetup = useCallback((provider: MediaProviderAdapter) => {
    //console.log("[VideoPlayer] Provider setup:", provider?.type);
  }, []);

  // Handle when video can play
  const handleCanPlay = useCallback(() => {
    //console.log("[VideoPlayer] Can play");
  }, []);

  // Handle loaded metadata
  const handleLoadedMetadata = useCallback(() => {
    //console.log("[VideoPlayer] Loaded metadata");
    const player = playerRef.current;
    if (player && onLoadedMetadata) {
      const { duration, width, height } = player.state;
      if (duration > 0 && width > 0 && height > 0) {
        onLoadedMetadata(duration, width, height);
      }
    }
  }, [onLoadedMetadata]);

  // Handle volume changes
  const handleVolumeChange = useCallback(() => {
    const player = playerRef.current;
    if (player) {
      setVideoVolume(player.volume);
    }
  }, [setVideoVolume]);

  // Handle errors
  const handleError = useCallback(
    (detail: any) => {
      console.error("[VideoPlayer] Error:", detail);
      if (onError) {
        const errorMessage = detail?.message || "Failed to load video";
        onError(new Error(errorMessage));
      }
    },
    [onError]
  );

  return (
    <div className={`relative w-full h-full ${className}`}>
      <MediaPlayer
        ref={playerRef}
        className="w-full h-full"
        title={title}
        src={src}
        poster={poster}
        volume={videoVolume}
        crossOrigin
        playsInline
        onProviderSetup={handleProviderSetup}
        onCanPlay={handleCanPlay}
        onLoadedMetadata={handleLoadedMetadata}
        onVolumeChange={handleVolumeChange}
        onError={handleError}>
        <MediaProvider />
        <DefaultVideoLayout icons={defaultLayoutIcons} />
      </MediaPlayer>
    </div>
  );
}

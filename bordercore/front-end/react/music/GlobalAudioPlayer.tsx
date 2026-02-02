import React from "react";
import ReactJinkeMusicPlayer from "react-jinke-music-player";
import "react-jinke-music-player/assets/index.css";
import { EventBus } from "../utils/reactUtils";
import type { BaseTrack } from "./types";

// Timeout before marking a song as listened to (10 seconds)
const MUSIC_LISTEN_TIMEOUT = 10000;

interface PlayTrackEvent {
  track: BaseTrack;
  trackList: BaseTrack[];
  songUrl: string;
  markListenedToUrl: string;
  csrfToken: string;
}

export const GlobalAudioPlayer: React.FC = () => {
  const [audioList, setAudioList] = React.useState<any[]>([]);
  const [playIndex, setPlayIndex] = React.useState(0);
  const [config, setConfig] = React.useState<{
    markListenedToUrl: string;
    csrfToken: string;
    songUrl: string;
  } | null>(null);

  const listenTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const currentSongUuidRef = React.useRef<string | null>(null);

  const markSongAsListenedTo = React.useCallback(
    async (uuid: string) => {
      if (!config || !uuid) return;

      try {
        const url = config.markListenedToUrl.replace(/00000000-0000-0000-0000-000000000000/, uuid);
        await fetch(url, {
          method: "POST",
          headers: {
            "X-CSRFToken": config.csrfToken,
          },
          credentials: "include",
        });
      } catch (error) {
        console.error("Error marking song as listened:", error);
      }
    },
    [config]
  );

  const startListenTimer = React.useCallback(
    (uuid: string) => {
      if (listenTimeoutRef.current) {
        clearTimeout(listenTimeoutRef.current);
      }

      currentSongUuidRef.current = uuid;
      listenTimeoutRef.current = setTimeout(() => {
        if (currentSongUuidRef.current === uuid) {
          markSongAsListenedTo(uuid);
        }
      }, MUSIC_LISTEN_TIMEOUT);
    },
    [markSongAsListenedTo]
  );

  React.useEffect(() => {
    const handlePlayTrack = (data: PlayTrackEvent) => {
      const newList = data.trackList.map(track => ({
        name: track.title,
        musicSrc: data.songUrl + track.uuid,
        uuid: track.uuid, // Store uuid for tracking
        cover: "/static/img/bordercore-logo.jpg", // Add a default cover
      }));

      const index = data.trackList.findIndex(t => t.uuid === data.track.uuid);

      setAudioList(newList);
      setPlayIndex(index >= 0 ? index : 0);
      setConfig({
        markListenedToUrl: data.markListenedToUrl,
        csrfToken: data.csrfToken,
        songUrl: data.songUrl,
      });

      // Start timer for the first song
      startListenTimer(data.track.uuid);
    };

    EventBus.$on("play-track", handlePlayTrack);
    return () => {
      EventBus.$off("play-track", handlePlayTrack);
    };
  }, [startListenTimer]);

  const onAudioPlay = (audioInfo: any) => {
    const uuid = audioInfo.uuid;
    if (uuid) {
      startListenTimer(uuid);
      // Update document title
      document.title = audioInfo.name || "Bordercore";
      // Notify other components that playback has started
      EventBus.$emit("audio-play", { uuid });
    }
  };

  const onAudioPause = (audioInfo: any) => {
    const uuid = audioInfo.uuid;
    // Notify other components that playback has paused
    EventBus.$emit("audio-pause", { uuid });
  };

  if (audioList.length === 0) return null;

  return (
    <div className="global-audio-player">
      <ReactJinkeMusicPlayer
        audioLists={audioList}
        playIndex={playIndex}
        onAudioPlay={onAudioPlay}
        onAudioPause={onAudioPause}
        mode="full"
        autoPlay={true}
        showDownload={false}
        showThemeSwitch={false}
        toggleMode={false}
        remember={false}
        responsive={true}
        glassBg={true}
        clearPriorAudioLists={true}
        onPlayIndexChange={index => setPlayIndex(index)}
        quietUpdate={false}
      />
    </div>
  );
};

export default GlobalAudioPlayer;

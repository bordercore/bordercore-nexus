import React from "react";
import ReactJinkeMusicPlayer from "react-jinke-music-player";
import "react-jinke-music-player/assets/index.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faForwardStep } from "@fortawesome/free-solid-svg-icons";
import { EventBus, getCsrfToken } from "../utils/reactUtils";
import type { BaseTrack } from "./types";

// Timeout before marking a song as listened to (10 seconds)
const MUSIC_LISTEN_TIMEOUT = 10000;

interface PlayTrackEvent {
  track: BaseTrack;
  trackList: BaseTrack[];
  songUrl: string;
  markListenedToUrl: string;
}

export const GlobalAudioPlayer: React.FC = () => {
  const [audioList, setAudioList] = React.useState<any[]>([]);
  const [playIndex, setPlayIndex] = React.useState(0);
  const [autoPlayNext, setAutoPlayNext] = React.useState(false);
  const [config, setConfig] = React.useState<{
    markListenedToUrl: string;
    songUrl: string;
  } | null>(null);

  const listenTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const currentSongUuidRef = React.useRef<string | null>(null);
  const audioInstanceRef = React.useRef<HTMLAudioElement | null>(null);
  const isManualPlayRef = React.useRef(false);
  const songEndedRef = React.useRef(false);

  const markSongAsListenedTo = React.useCallback(
    async (uuid: string) => {
      if (!config || !uuid || !config.markListenedToUrl) return;

      try {
        const url = config.markListenedToUrl.replace(/00000000-0000-0000-0000-000000000000/, uuid);
        await fetch(url, {
          method: "POST",
          headers: {
            "X-CSRFToken": getCsrfToken(),
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
      isManualPlayRef.current = true;
      const newList = data.trackList.map(track => {
        const t = track as unknown as Record<string, unknown>;
        const artist =
          (typeof t.artist === "string" && t.artist) ||
          (typeof t.artist_name === "string" && t.artist_name) ||
          (typeof t.artist__name === "string" && t.artist__name) ||
          "";
        return {
          name: track.title,
          singer: artist,
          musicSrc: track.musicSrc || data.songUrl + track.uuid,
          uuid: track.uuid,
          cover: "/static/img/bordercore-logo.jpg",
        };
      });

      const index = data.trackList.findIndex(t => t.uuid === data.track.uuid);

      setAudioList(newList);
      setPlayIndex(index >= 0 ? index : 0);

      setConfig({
        markListenedToUrl: data.markListenedToUrl,
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
      if (songEndedRef.current) {
        // This is the singleLoop auto-replay after a song ended
        // with autoplay off — pause it, don't let it loop.
        songEndedRef.current = false;
        if (audioInstanceRef.current) {
          audioInstanceRef.current.pause();
        }
        return;
      }
      isManualPlayRef.current = false;

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

  const onAudioEnded = React.useCallback(
    (currentPlayId: string, audioLists: any[], audioInfo: any) => {
      // Notify other components that playback has ended
      EventBus.$emit("audio-ended", { uuid: audioInfo.uuid });

      if (!autoPlayNext) {
        // Signal that the next onAudioPlay is a singleLoop auto-replay
        // (not a user action) and should be paused.
        songEndedRef.current = true;
      }
    },
    [autoPlayNext]
  );

  if (audioList.length === 0) return null;

  return (
    <div className="global-audio-player">
      <ReactJinkeMusicPlayer
        audioLists={audioList}
        playIndex={playIndex}
        onAudioPlay={onAudioPlay}
        onAudioPause={onAudioPause}
        onAudioEnded={onAudioEnded}
        renderAudioTitle={(audioInfo: { name?: string; singer?: string }, isMobile: boolean) => {
          if (isMobile) return <span className="audio-name">{audioInfo.name}</span>;
          return (
            <>
              <span className="audio-name">{audioInfo.name}</span>
              {audioInfo.singer ? (
                <>
                  <span className="audio-sep"> — </span>
                  <span className="audio-singer">{audioInfo.singer}</span>
                </>
              ) : null}
            </>
          );
        }}
        getAudioInstance={(instance: HTMLAudioElement) => {
          audioInstanceRef.current = instance;
        }}
        mode="full"
        playMode={autoPlayNext ? "order" : "singleLoop"}
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
        extendsContent={
          <button
            type="button"
            className={`auto-play-next-btn${autoPlayNext ? " active" : ""}`}
            title={autoPlayNext ? "Auto play next: on" : "Auto play next: off"}
            onClick={() => setAutoPlayNext(prev => !prev)}
          >
            <FontAwesomeIcon icon={faForwardStep} />
          </button>
        }
      />
    </div>
  );
};

export default GlobalAudioPlayer;

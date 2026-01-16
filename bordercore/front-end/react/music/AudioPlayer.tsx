import React from "react";
import type { BaseTrack } from "./types";

// Import media-chrome for audio player controls
import "media-chrome";

// Timeout before marking a song as listened to (10 seconds)
const MUSIC_LISTEN_TIMEOUT = 10000;

interface AudioPlayerProps {
  trackList: BaseTrack[];
  songUrl: string;
  markListenedToUrl: string;
  csrfToken: string;
  onCurrentSong: (songIndex: number) => void;
  onIsPlaying: (isPlaying: boolean) => void;
}

export interface AudioPlayerHandle {
  playTrack: (songUuid: string) => void;
}

export const AudioPlayer = React.forwardRef<AudioPlayerHandle, AudioPlayerProps>(
  function AudioPlayer(
    { trackList, songUrl, markListenedToUrl, csrfToken, onCurrentSong, onIsPlaying },
    ref
  ) {
    const [continuousPlay, setContinuousPlay] = React.useState(false);
    const [currentSongUuid, setCurrentSongUuid] = React.useState<string | null>(null);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const audioRef = React.useRef<HTMLAudioElement>(null);
    const listenTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    const currentTitle = React.useMemo(() => {
      const song = trackList.find((x) => x.uuid === currentSongUuid);
      return song ? song.title : "";
    }, [trackList, currentSongUuid]);

    const getIndex = React.useCallback(() => {
      return trackList.findIndex((x) => x.uuid === currentSongUuid);
    }, [trackList, currentSongUuid]);

    const markSongAsListenedTo = React.useCallback(async () => {
      if (!currentSongUuid) return;

      try {
        const url = markListenedToUrl.replace(
          /00000000-0000-0000-0000-000000000000/,
          currentSongUuid
        );
        await fetch(url, {
          method: "POST",
          headers: {
            "X-CSRFToken": csrfToken,
          },
          credentials: "include",
        });
      } catch (error) {
        console.error("Error marking song as listened:", error);
      }
    }, [currentSongUuid, markListenedToUrl, csrfToken]);

    const playTrack = React.useCallback(
      (songUuid: string, selectRow = true) => {
        setCurrentSongUuid(songUuid);
        setIsPlaying(true);
        onIsPlaying(true);

        if (audioRef.current) {
          audioRef.current.src = songUrl + songUuid;
          audioRef.current.play();
        }

        if (selectRow) {
          const index = trackList.findIndex((x) => x.uuid === songUuid);
          onCurrentSong(index);
        }

        // Clear any existing timeout
        if (listenTimeoutRef.current) {
          clearTimeout(listenTimeoutRef.current);
        }

        // Set timeout to mark song as listened
        listenTimeoutRef.current = setTimeout(() => {
          markSongAsListenedTo();
        }, MUSIC_LISTEN_TIMEOUT);

        // Update document title
        const song = trackList.find((x) => x.uuid === songUuid);
        if (song) {
          document.title = song.title;
        }
      },
      [songUrl, trackList, onCurrentSong, onIsPlaying, markSongAsListenedTo]
    );

    const playNextTrack = React.useCallback(() => {
      const currentIndex = getIndex();
      const newIndex = currentIndex + 1;

      if (continuousPlay && newIndex < trackList.length) {
        const nextSongUuid = trackList[newIndex].uuid;
        playTrack(nextSongUuid, true);
      } else {
        // Let the parent know that the last song has played
        onCurrentSong(-1);
        setIsPlaying(false);
        onIsPlaying(false);
      }
    }, [continuousPlay, trackList, getIndex, playTrack, onCurrentSong, onIsPlaying]);

    // Expose playTrack to parent via ref
    React.useImperativeHandle(ref, () => ({
      playTrack,
    }));

    // Handle play button clicks
    React.useEffect(() => {
      const handlePlayButtonClick = () => {
        // If no song is selected, play the first song
        if (!currentSongUuid && trackList.length > 0) {
          playTrack(trackList[0].uuid);
          return;
        }

        // Toggle playing state and notify parent
        const newValue = !isPlaying;
        setIsPlaying(newValue);
        onIsPlaying(newValue);
      };

      const playButton = document.getElementById("media-play-button");
      if (playButton) {
        playButton.addEventListener("click", handlePlayButtonClick);
      }

      return () => {
        if (playButton) {
          playButton.removeEventListener("click", handlePlayButtonClick);
        }
      };
    }, [onIsPlaying, currentSongUuid, trackList, playTrack, isPlaying]);

    // Handle audio ended event
    React.useEffect(() => {
      const audio = audioRef.current;
      if (audio) {
        audio.onended = playNextTrack;
      }

      return () => {
        if (audio) {
          audio.onended = null;
        }
      };
    }, [playNextTrack]);

    // Suppress "no supported sources" error from media-chrome when no song is loaded
    React.useEffect(() => {
      const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        if (event.reason?.name === "NotSupportedError" &&
            event.reason?.message?.includes("no supported sources")) {
          event.preventDefault();
        }
      };

      window.addEventListener("unhandledrejection", handleUnhandledRejection);

      return () => {
        window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      };
    }, []);

    // Cleanup timeout on unmount
    React.useEffect(() => {
      return () => {
        if (listenTimeoutRef.current) {
          clearTimeout(listenTimeoutRef.current);
        }
      };
    }, []);

    return (
      <div className="audio-player-wrapper h-100 p-2">
        <div className="text5 text-center text-truncate mx-2">{currentTitle}</div>
        <div>
          {/* @ts-ignore - media-chrome web components */}
          <media-controller audio className="w-100">
            <audio
              id="player"
              ref={audioRef}
              slot="media"
              src=""
            />
            {/* @ts-ignore */}
            <media-control-bar className="media-control-bar">
              {/* @ts-ignore */}
              <media-play-button id="media-play-button" />
              {/* @ts-ignore */}
              <media-time-display showDuration />
              {/* @ts-ignore */}
              <media-time-range />
              {/* @ts-ignore */}
              <media-playback-rate-button />
              {/* @ts-ignore */}
              <media-mute-button />
              {/* @ts-ignore */}
              <media-volume-range />
            </media-control-bar>
          </media-controller>
        </div>
        <div className="d-flex align-items-center ms-2 mt-2 pb-2">
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              id="continuous_play"
              checked={continuousPlay}
              onChange={(e) => setContinuousPlay(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="continuous_play">
              Continuous Play
            </label>
          </div>
        </div>
      </div>
    );
  }
);

export default AudioPlayer;

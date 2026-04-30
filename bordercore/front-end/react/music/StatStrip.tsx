import React from "react";
import { EventBus } from "../utils/reactUtils";
import type { DashboardStats } from "./types";

export interface NowPlayingTrack {
  uuid: string;
  title: string;
  artist: string;
}

interface Props {
  stats: DashboardStats;
  initialTrack: NowPlayingTrack | null;
}

const StatStrip: React.FC<Props> = ({ stats, initialTrack }) => {
  const [track, setTrack] = React.useState<NowPlayingTrack | null>(initialTrack);
  const [isPlaying, setIsPlaying] = React.useState(false);

  React.useEffect(() => {
    setTrack(initialTrack);
  }, [initialTrack]);

  React.useEffect(() => {
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    EventBus.$on("audio-play", onPlay);
    EventBus.$on("audio-pause", onPause);
    return () => {
      EventBus.$off("audio-play", onPlay);
      EventBus.$off("audio-pause", onPause);
    };
  }, []);

  return (
    <div className="mlo-stat-strip">
      <div className="mlo-stat">
        <div className="mlo-stat-label">now playing</div>
        <div className="mlo-stat-value">
          <span className={`mlo-pulse${isPlaying ? " mlo-pulse-playing" : ""}`} />
          {track ? track.artist : "—"}
        </div>
        <div className="mlo-stat-hint">{track ? track.title : "nothing"}</div>
      </div>
      <div className="mlo-stat">
        <div className="mlo-stat-label">plays this week</div>
        <div className="mlo-stat-value">{stats.plays_this_week}</div>
        <div className="mlo-stat-hint">{stats.plays_today} today</div>
      </div>
      <div className="mlo-stat">
        <div className="mlo-stat-label">top tag (7d)</div>
        <div className="mlo-stat-value">{stats.top_tag_7d ? stats.top_tag_7d.name : "—"}</div>
        <div className="mlo-stat-hint">
          {stats.top_tag_7d ? `${stats.top_tag_7d.count} plays` : ""}
        </div>
      </div>
      <div className="mlo-stat">
        <div className="mlo-stat-label">added this month</div>
        <div className="mlo-stat-value">{stats.added_this_month}</div>
        <div className="mlo-stat-hint">albums</div>
      </div>
      <div className="mlo-stat">
        <div className="mlo-stat-label">longest streak</div>
        <div className="mlo-stat-value">{stats.longest_streak}</div>
        <div className="mlo-stat-hint">consecutive days</div>
      </div>
    </div>
  );
};

export default StatStrip;

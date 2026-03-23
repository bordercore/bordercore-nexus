import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar } from "@fortawesome/free-solid-svg-icons";
import axios from "axios";

interface StarRatingProps {
  songUuid: string;
  rating: number | null;
  setSongRatingUrl: string;
  csrfToken: string;
  onRatingChange: (songUuid: string, newRating: number | null) => void;
}

export function StarRating({
  songUuid,
  rating,
  setSongRatingUrl,
  csrfToken,
  onRatingChange,
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [animatingIndex, setAnimatingIndex] = useState<number | null>(null);

  const handleMouseOver = (starIndex: number) => {
    setHoverRating(starIndex + 1);
  };

  const handleMouseLeave = () => {
    setHoverRating(null);
  };

  const handleClick = async (starIndex: number) => {
    if (isUpdating) return;

    const clickedRating = starIndex + 1;
    const isDeselect = clickedRating === rating;

    // Reset animation so it replays if clicking the same star again
    setAnimatingIndex(null);
    // Force a separate render before setting the new animation
    requestAnimationFrame(() => setAnimatingIndex(starIndex));

    setIsUpdating(true);

    try {
      const params = new URLSearchParams();
      params.append("song_uuid", songUuid);
      params.append("rating", isDeselect ? "" : String(clickedRating));

      await axios.post(setSongRatingUrl, params, {
        headers: {
          "X-CSRFToken": csrfToken,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        withCredentials: true,
      });

      onRatingChange(songUuid, isDeselect ? null : clickedRating);
      if (isDeselect) setHoverRating(null);
    } catch (error) {
      console.error("Error setting rating:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const displayRating = hoverRating ?? rating ?? 0;

  return (
    <div className="rating-container d-flex" onMouseLeave={handleMouseLeave}>
      {[0, 1, 2, 3, 4].map(starIndex => (
        <span
          key={starIndex}
          className={`rating me-1 ${displayRating > starIndex ? "rating-star-selected" : ""} ${isUpdating ? "cursor-wait" : "cursor-pointer"} ${animatingIndex === starIndex ? "rating-animate" : ""}`}
          onClick={() => handleClick(starIndex)}
          onMouseOver={() => handleMouseOver(starIndex)}
          onAnimationEnd={() => setAnimatingIndex(null)}
        >
          <FontAwesomeIcon icon={faStar} />
        </span>
      ))}
    </div>
  );
}

export default StarRating;

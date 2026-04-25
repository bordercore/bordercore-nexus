import React from "react";

interface FollowUpsProps {
  suggestions: string[];
  onSelect: (text: string) => void;
}

export function FollowUps({ suggestions, onSelect }: FollowUpsProps) {
  if (suggestions.length === 0) return null;
  return (
    <div className="chatbot-followups">
      {suggestions.map((s, i) => (
        <button key={i} type="button" className="chatbot-followup-chip" onClick={() => onSelect(s)}>
          {s}
        </button>
      ))}
    </div>
  );
}

export default FollowUps;

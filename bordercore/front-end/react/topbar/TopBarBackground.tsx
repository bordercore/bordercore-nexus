import React, { useEffect, useState } from "react";
import AuroraBg from "./AuroraBg";
import ConstellationBg from "./ConstellationBg";

// Mirrors the choices on UserProfile.topbar_animation. Adding a new
// animation: add the value here, add a case below, and add the choice
// tuple to TOPBAR_ANIMATION_CHOICES in accounts/models.py.
type AnimationKey = "aurora" | "constellations" | "none";

function readAnimation(): AnimationKey {
  const v = document.documentElement.getAttribute("topbar-animation");
  if (v === "constellations" || v === "none") return v;
  return "aurora";
}

export default function TopBarBackground() {
  const [key, setKey] = useState<AnimationKey>(readAnimation);

  useEffect(() => {
    const obs = new MutationObserver(() => setKey(readAnimation()));
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["topbar-animation"],
    });
    return () => obs.disconnect();
  }, []);

  if (key === "constellations") return <ConstellationBg />;
  if (key === "none") return null;
  return <AuroraBg />;
}

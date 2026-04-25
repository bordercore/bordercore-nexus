import React from "react";

interface MirrorCubeProps {
  size?: number;
  dir?: 1 | -1;
}

const FACE_BASE_STYLE: React.CSSProperties = {
  position: "absolute",
  border: "1px solid rgba(179, 107, 255, 0.5)",
  background: "rgba(179, 107, 255, 0.05)",
  boxShadow: "inset 0 0 50px rgba(179, 107, 255, 0.18)",
};

const INNER_GRID_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage:
    "linear-gradient(rgba(179,107,255,0.18) 1px, transparent 1px)," +
    "linear-gradient(90deg, rgba(179,107,255,0.18) 1px, transparent 1px)",
  backgroundSize: "32px 32px",
};

export function MirrorCube({ size = 200, dir = 1 }: MirrorCubeProps) {
  const half = size / 2;
  const faceTransforms = [
    `translateZ(${half}px)`,
    `rotateY(180deg) translateZ(${half}px)`,
    `rotateY(90deg) translateZ(${half}px)`,
    `rotateY(-90deg) translateZ(${half}px)`,
    `rotateX(90deg) translateZ(${half}px)`,
    `rotateX(-90deg) translateZ(${half}px)`,
  ];

  return (
    <div
      data-anim
      aria-hidden="true"
      // must remain inline — width/height/animation depend on runtime props
      style={{
        width: size,
        height: size,
        transformStyle: "preserve-3d",
        animation: `${dir > 0 ? "mc-a" : "mc-b"} 22s linear infinite`,
      }}
    >
      {faceTransforms.map((tf, i) => (
        <div
          key={i}
          // must remain inline — width, height, and transform depend on runtime props
          style={{
            ...FACE_BASE_STYLE,
            width: size,
            height: size,
            transform: tf,
          }}
        >
          {/* must remain inline — object ref satisfies style prop type */}
          <div style={INNER_GRID_STYLE} />
        </div>
      ))}
    </div>
  );
}

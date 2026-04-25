import React from "react";

interface MirrorCubeProps {
  size?: number;
  dir?: 1 | -1;
}

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
          className="bc-login-mirror-cube__face"
          // must remain inline — width, height, and transform depend on runtime props
          style={{
            width: size,
            height: size,
            transform: tf,
          }}
        >
          <div className="bc-login-mirror-cube__grid" />
        </div>
      ))}
    </div>
  );
}

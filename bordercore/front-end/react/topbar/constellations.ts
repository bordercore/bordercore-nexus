// Curated, stylized constellation dataset for the top-bar ConstellationBg
// animation. Coordinates live in each constellation's own normalized box
// (0..1 in both axes); the renderer scales them to fit the bar height and
// horizontally pans the whole shape across the bar.
//
// These are not astronomical-grade positions — they're hand-tuned to read
// cleanly at the bar's wide-short aspect. `width` is the intrinsic aspect
// ratio (w/h); the renderer multiplies it by the rendered constellation
// height to get the pixel width.

export interface ConstellationStar {
  x: number; // 0..1 within constellation box
  y: number; // 0..1 within constellation box
  mag: number; // 0..1 — drives radius and alpha bonus
}

export interface Constellation {
  name: string;
  width: number; // intrinsic aspect ratio, w/h
  stars: ConstellationStar[];
  lines: [number, number][]; // index pairs into stars[]
}

export const CONSTELLATIONS: Constellation[] = [
  {
    name: "Orion",
    width: 1.6,
    stars: [
      { x: 0.1, y: 0.1, mag: 0.95 }, // Betelgeuse (top-left shoulder)
      { x: 0.85, y: 0.18, mag: 0.85 }, // Bellatrix (top-right shoulder)
      { x: 0.42, y: 0.48, mag: 0.7 }, // Alnitak (belt)
      { x: 0.5, y: 0.5, mag: 0.7 }, // Alnilam (belt)
      { x: 0.58, y: 0.52, mag: 0.7 }, // Mintaka (belt)
      { x: 0.18, y: 0.88, mag: 0.9 }, // Saiph (bottom-left foot)
      { x: 0.78, y: 0.92, mag: 1.0 }, // Rigel (bottom-right foot)
    ],
    lines: [
      [0, 1], // shoulders
      [0, 2],
      [1, 4], // shoulders to belt
      [2, 3],
      [3, 4], // belt
      [2, 5],
      [4, 6], // belt to feet
      [5, 6], // feet
    ],
  },
  {
    name: "Cassiopeia",
    width: 1.8,
    stars: [
      { x: 0.05, y: 0.3, mag: 0.85 },
      { x: 0.28, y: 0.75, mag: 0.95 },
      { x: 0.52, y: 0.2, mag: 0.8 },
      { x: 0.74, y: 0.7, mag: 0.9 },
      { x: 0.95, y: 0.35, mag: 0.85 },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
  },
  {
    name: "Big Dipper",
    width: 2.2,
    stars: [
      { x: 0.05, y: 0.4, mag: 0.9 }, // Dubhe
      { x: 0.22, y: 0.55, mag: 0.85 }, // Merak
      { x: 0.36, y: 0.5, mag: 0.8 }, // Phecda
      { x: 0.52, y: 0.42, mag: 0.75 }, // Megrez
      { x: 0.68, y: 0.35, mag: 0.95 }, // Alioth
      { x: 0.82, y: 0.28, mag: 0.85 }, // Mizar
      { x: 0.97, y: 0.2, mag: 0.8 }, // Alkaid
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3], // bowl
      [3, 0], // close bowl
      [3, 4],
      [4, 5],
      [5, 6], // handle
    ],
  },
  {
    name: "Cygnus",
    width: 1.5,
    stars: [
      { x: 0.5, y: 0.08, mag: 0.95 }, // Deneb (tail)
      { x: 0.5, y: 0.4, mag: 0.75 }, // Sadr (body)
      { x: 0.5, y: 0.85, mag: 0.85 }, // Albireo (beak)
      { x: 0.1, y: 0.4, mag: 0.8 }, // Gienah (left wing)
      { x: 0.9, y: 0.4, mag: 0.8 }, // Delta Cygni (right wing)
    ],
    lines: [
      [0, 1],
      [1, 2], // spine
      [3, 1],
      [1, 4], // wings
    ],
  },
  {
    name: "Lyra",
    width: 1.0,
    stars: [
      { x: 0.5, y: 0.08, mag: 1.0 }, // Vega
      { x: 0.3, y: 0.4, mag: 0.7 },
      { x: 0.7, y: 0.4, mag: 0.7 },
      { x: 0.25, y: 0.8, mag: 0.65 },
      { x: 0.75, y: 0.8, mag: 0.65 },
    ],
    lines: [
      [0, 1],
      [0, 2], // top triangle
      [1, 3],
      [2, 4], // sides
      [3, 4], // bottom
    ],
  },
  {
    name: "Scorpius",
    width: 2.4,
    stars: [
      { x: 0.04, y: 0.2, mag: 0.85 }, // claws
      { x: 0.14, y: 0.45, mag: 0.8 },
      { x: 0.24, y: 0.3, mag: 0.8 },
      { x: 0.36, y: 0.45, mag: 0.95 }, // Antares
      { x: 0.5, y: 0.55, mag: 0.8 },
      { x: 0.62, y: 0.65, mag: 0.8 },
      { x: 0.74, y: 0.75, mag: 0.8 },
      { x: 0.86, y: 0.62, mag: 0.85 }, // stinger curl
      { x: 0.96, y: 0.4, mag: 0.85 },
    ],
    lines: [
      [0, 1],
      [2, 1],
      [1, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 8],
    ],
  },
  {
    name: "Leo",
    width: 2.0,
    stars: [
      { x: 0.1, y: 0.55, mag: 0.95 }, // Regulus
      { x: 0.22, y: 0.3, mag: 0.75 },
      { x: 0.32, y: 0.18, mag: 0.75 },
      { x: 0.46, y: 0.25, mag: 0.8 },
      { x: 0.55, y: 0.45, mag: 0.8 },
      { x: 0.42, y: 0.6, mag: 0.75 },
      { x: 0.78, y: 0.4, mag: 0.85 },
      { x: 0.95, y: 0.55, mag: 0.9 }, // Denebola
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4], // sickle
      [4, 5],
      [5, 0], // body close
      [4, 6],
      [6, 7], // tail
    ],
  },
  {
    name: "Lacerta",
    width: 1.1,
    stars: [
      { x: 0.5, y: 0.06, mag: 0.65 },
      { x: 0.4, y: 0.28, mag: 0.7 },
      { x: 0.55, y: 0.45, mag: 0.65 },
      { x: 0.42, y: 0.65, mag: 0.7 },
      { x: 0.58, y: 0.85, mag: 0.65 },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
  },
];

import React from "react";

interface CoverMosaicProps {
  tiles: (string | null)[];
  alt: string;
  small?: boolean;
}

export function CoverMosaic({ tiles, alt, small = false }: CoverMosaicProps) {
  return (
    <div className={`cl-mosaic${small ? " cl-mosaic-thumb-sm" : ""}`}>
      {tiles.slice(0, 4).map((url, i) => (
        <div key={i} className={`cl-mosaic-tile${url ? "" : " cl-mosaic-tile-empty"}`}>
          {url ? <img src={url} alt={i === 0 ? alt : ""} loading="lazy" /> : null}
        </div>
      ))}
    </div>
  );
}

export default CoverMosaic;

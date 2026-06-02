import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faShuffle,
  faPlus,
  faMusic,
  faRecordVinyl,
  faList,
} from "@fortawesome/free-solid-svg-icons";
import DropDownMenu from "../common/DropDownMenu";

interface Props {
  onShuffleAll: () => void;
  createSongUrl: string;
  createAlbumUrl: string;
  onCreatePlaylist: () => void;
}

const PageHead: React.FC<Props> = ({
  onShuffleAll,
  createSongUrl,
  createAlbumUrl,
  onCreatePlaylist,
}) => {
  const addLinks = [
    {
      id: "new-song",
      title: "New Song",
      url: createSongUrl,
      icon: faMusic,
    },
    {
      id: "new-album",
      title: "New Album",
      url: createAlbumUrl,
      icon: faRecordVinyl,
    },
    {
      id: "new-playlist",
      title: "New Playlist",
      url: "#",
      icon: faList,
      clickHandler: onCreatePlaylist,
    },
  ];

  return (
    <div className="mlo-pagehead">
      <div>
        <h1 className="mlo-pagehead-title">
          <span className="bc-page-title">Music Library</span>
        </h1>
      </div>
      <div className="mlo-pagehead-actions">
        <button type="button" className="refined-btn" onClick={onShuffleAll}>
          <FontAwesomeIcon icon={faShuffle} /> shuffle all
        </button>
        <DropDownMenu
          links={addLinks}
          showTarget={false}
          iconSlot={
            <span className="refined-btn primary">
              <FontAwesomeIcon icon={faPlus} /> add
            </span>
          }
        />
      </div>
    </div>
  );
};

export default PageHead;

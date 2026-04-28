import React from "react";
import { Hero } from "./Hero";
import { PullQuote } from "./PullQuote";
import { FrontPageColumn } from "./FrontPageColumn";
import { StudyDeskColumn } from "./StudyDeskColumn";
import { AmbientColumn } from "./AmbientColumn";
import { FooterRail } from "./FooterRail";
import { Marquee } from "./Marquee";
import type {
  Bookmark,
  DefaultCollection,
  DrillProgress,
  OverdueExercise,
  Quote,
  RandomImageInfo,
  Song,
  Task,
} from "../types";

export interface MagazinePageProps {
  todoListUrl: string;
  drillListUrl: string;
  bookmarkOverviewUrl: string;
  getCalendarEventsUrl: string;

  tasks: Task[];
  drillProgress: DrillProgress;
  overdueExercises: OverdueExercise[];
  dailyBookmarks: Bookmark[];
  bookmarks: Bookmark[];
  music: Song[];
  quote: Quote | null;
  randomImageInfo: RandomImageInfo | null;
  defaultCollection: DefaultCollection | null;

  exerciseDetailUrlTemplate: string;
  bookmarkClickUrlTemplate: string;
  artistDetailUrlTemplate: string;
  blobDetailUrlTemplate: string;
  collectionDetailUrlTemplate: string;
}

export function MagazinePage(props: MagazinePageProps) {
  return (
    <div className="homepage-magazine">
      <Hero
        randomImageInfo={props.randomImageInfo}
        defaultCollection={props.defaultCollection}
        blobDetailUrlTemplate={props.blobDetailUrlTemplate}
        collectionDetailUrlTemplate={props.collectionDetailUrlTemplate}
      />

      <main className="mag-body">
        <PullQuote quote={props.quote} />

        <div className="mag-columns">
          <FrontPageColumn
            tasks={props.tasks}
            todoListUrl={props.todoListUrl}
            dailyBookmarks={props.dailyBookmarks}
            bookmarkClickUrlTemplate={props.bookmarkClickUrlTemplate}
          />

          <StudyDeskColumn
            drillProgress={props.drillProgress}
            drillListUrl={props.drillListUrl}
            getCalendarEventsUrl={props.getCalendarEventsUrl}
          />

          <AmbientColumn
            music={props.music}
            artistDetailUrlTemplate={props.artistDetailUrlTemplate}
            defaultCollection={props.defaultCollection}
            collectionDetailUrlTemplate={props.collectionDetailUrlTemplate}
          />
        </div>

        <FooterRail
          bookmarks={props.bookmarks}
          bookmarkOverviewUrl={props.bookmarkOverviewUrl}
          bookmarkClickUrlTemplate={props.bookmarkClickUrlTemplate}
          overdueExercises={props.overdueExercises}
          exerciseDetailUrlTemplate={props.exerciseDetailUrlTemplate}
        />
      </main>

      <Marquee quote={props.quote} />
    </div>
  );
}

export default MagazinePage;

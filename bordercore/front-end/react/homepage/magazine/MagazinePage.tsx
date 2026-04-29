import React from "react";
import { Hero } from "./Hero";
import { PullQuote } from "./PullQuote";
import { FrontPageColumn } from "./FrontPageColumn";
import { StudyDeskColumn } from "./StudyDeskColumn";
import { AmbientColumn } from "./AmbientColumn";
import { FooterRail } from "./FooterRail";
import type {
  Bookmark,
  DefaultCollection,
  DrillProgress,
  Habit,
  OverdueExercise,
  Quote,
  RandomImageInfo,
  Reminder,
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
  reminders: Reminder[];
  reminderAppUrl: string;
  habits: Habit[];
  habitListUrl: string;
  fitnessSummaryUrl: string;
  musicListUrl: string;
  userName: string;

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
        userName={props.userName}
      />

      <main className="mag-body">
        <PullQuote quote={props.quote} />

        <div className="mag-columns">
          <FrontPageColumn
            tasks={props.tasks}
            todoListUrl={props.todoListUrl}
            overdueExercises={props.overdueExercises}
            exerciseDetailUrlTemplate={props.exerciseDetailUrlTemplate}
            fitnessSummaryUrl={props.fitnessSummaryUrl}
            habits={props.habits}
            habitListUrl={props.habitListUrl}
          />

          <StudyDeskColumn
            drillProgress={props.drillProgress}
            drillListUrl={props.drillListUrl}
            defaultCollection={props.defaultCollection}
            collectionDetailUrlTemplate={props.collectionDetailUrlTemplate}
          />

          <AmbientColumn
            music={props.music}
            artistDetailUrlTemplate={props.artistDetailUrlTemplate}
            musicListUrl={props.musicListUrl}
            getCalendarEventsUrl={props.getCalendarEventsUrl}
            reminders={props.reminders}
            reminderAppUrl={props.reminderAppUrl}
          />
        </div>

        <FooterRail
          bookmarks={props.bookmarks}
          bookmarkOverviewUrl={props.bookmarkOverviewUrl}
          bookmarkClickUrlTemplate={props.bookmarkClickUrlTemplate}
          dailyBookmarks={props.dailyBookmarks}
        />
      </main>
    </div>
  );
}

export default MagazinePage;

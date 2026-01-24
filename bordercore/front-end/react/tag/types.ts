export interface Tag {
  uuid: string;
  name: string;
}

export interface TagAlias {
  uuid: string;
  name: string;
  tag: Tag;
}

export interface TagInfo {
  name: string;
  blob__count?: number;
  bookmark__count?: number;
  todo__count?: number;
  question__count?: number;
  song__count?: number;
  album__count?: number;
  collection__count?: number;
}

export interface TagListUrls {
  tagSearchUrl: string;
  tagAliasListUrl: string;
  tagAliasDetailUrl: string;
  getTodoCountsUrl: string;
  addAliasUrl: string;
}

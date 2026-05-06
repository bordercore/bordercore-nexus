import { useCallback, useState } from "react";
import { doGet, doPost, doDelete, EventBus } from "../../utils/reactUtils";
import type {
  TagBootstrap,
  TagSnapshot,
  AliasLibraryRow,
  CuratorUrls,
} from "./types";

export interface TagWorkspace {
  activeName: string;
  tag: TagSnapshot;
  aliasLibrary: AliasLibraryRow[];
  tagNames: string[];
  setActiveName: (name: string) => Promise<void>;
  setPinned: (value: boolean) => void;
  setMeta: (value: boolean) => void;
  addAlias: (tagName: string, aliasName: string) => Promise<void>;
  removeAlias: (tagName: string, uuid: string) => Promise<void>;
}

const toast = (body: string) => EventBus.$emit("toast", { body });

export function useTagWorkspace(
  bootstrap: TagBootstrap,
  urls: CuratorUrls,
): TagWorkspace {
  const [activeName, _setActiveName] = useState(bootstrap.active_name);
  const [tag, setTag] = useState<TagSnapshot>(bootstrap.tag);
  const [aliasLibrary, setAliasLibrary] = useState<AliasLibraryRow[]>(
    bootstrap.alias_library,
  );
  const [tagNames] = useState<string[]>(bootstrap.tag_names);

  const setActiveName = useCallback(
    (name: string) =>
      new Promise<void>(resolve => {
        if (name === activeName) {
          resolve();
          return;
        }
        const url = urls.tagSnapshotUrl.replace("__NAME__", encodeURIComponent(name));
        doGet(
          url,
          response => {
            setTag(response.data as TagSnapshot);
            _setActiveName(name);
            resolve();
          },
          "Failed to load tag",
        );
      }),
    [activeName, urls.tagSnapshotUrl],
  );

  const setPinned = useCallback(
    (value: boolean) => {
      setTag(t => ({ ...t, pinned: value }));
      const url = value ? urls.pinUrl : urls.unpinUrl;
      doPost(
        url,
        { tag: tag.name },
        () => {},
        "",
        "Failed to update pinned state",
      );
    },
    [tag.name, urls.pinUrl, urls.unpinUrl],
  );

  const setMeta = useCallback(
    (value: boolean) => {
      setTag(t => ({ ...t, meta: value }));
      doPost(
        urls.setMetaUrl,
        { tag: tag.name, value: String(value) },
        () => {},
        "",
        "Failed to update meta state",
      );
    },
    [tag.name, urls.setMetaUrl],
  );

  const addAlias = useCallback(
    (tagName: string, aliasName: string) =>
      new Promise<void>(resolve => {
        const trimmed = aliasName.trim().toLowerCase();
        if (!trimmed) {
          resolve();
          return;
        }
        doPost(
          urls.addAliasUrl,
          { tag_name: tagName, alias_name: trimmed },
          response => {
            const newUuid: string =
              (response?.data?.uuid as string) || crypto.randomUUID();
            const row: AliasLibraryRow = { uuid: newUuid, name: trimmed, tag: tagName };
            setAliasLibrary(rows =>
              [...rows, row].sort((a, b) =>
                a.tag === b.tag ? a.name.localeCompare(b.name) : a.tag.localeCompare(b.tag),
              ),
            );
            if (tagName === activeName) {
              setTag(t => ({
                ...t,
                aliases: [...t.aliases, { uuid: newUuid, name: trimmed }].sort((a, b) =>
                  a.name.localeCompare(b.name),
                ),
              }));
            }
            toast(`alias "${trimmed}" forged`);
            resolve();
          },
          "",
          "Failed to add alias",
        );
      }),
    [activeName, urls.addAliasUrl],
  );

  const removeAlias = useCallback(
    (tagName: string, uuid: string) =>
      new Promise<void>(resolve => {
        const url = urls.tagAliasDetailUrl.replace("__UUID__", uuid);
        doDelete(
          url,
          () => {
            setAliasLibrary(rows => rows.filter(r => r.uuid !== uuid));
            if (tagName === activeName) {
              setTag(t => ({ ...t, aliases: t.aliases.filter(a => a.uuid !== uuid) }));
            }
            toast("alias revoked");
            resolve();
          },
          "",
        );
      }),
    [activeName, urls.tagAliasDetailUrl],
  );

  return {
    activeName,
    tag,
    aliasLibrary,
    tagNames,
    setActiveName,
    setPinned,
    setMeta,
    addAlias,
    removeAlias,
  };
}

import { doPost } from "../../utils/reactUtils";

export function markItemRead(itemId: number, onSuccess: (readAt: string) => void): void {
  doPost(
    `/feed/items/${itemId}/read/`,
    {},
    response => onSuccess(response.data.read_at),
    "",
    "Failed to mark item as read"
  );
}

export function markFeedRead(feedUuid: string, onSuccess: (marked: number) => void): void {
  doPost(
    `/feed/${feedUuid}/mark_all_read/`,
    {},
    response => onSuccess(response.data.marked),
    "",
    "Failed to mark feed as read"
  );
}

export type PocketNotificationSeverity = "info" | "success" | "warning" | "critical";

export interface PocketNotification {
  id: string;
  title: string;
  message: string;
  source: string;
  severity: PocketNotificationSeverity;
  createdAt: string;
  read: boolean;
  actionApp?: string;
  actionLabel?: string;
  metadata?: Record<string, unknown>;
}

export const POCKET_NOTIFICATIONS_KEY = "pocketflow.notifications.v1";
export const POCKET_NOTIFICATIONS_EVENT = "pocketflow:notifications-updated";
const MAX_NOTIFICATIONS = 80;

const createId = () =>
  `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const loadPocketNotifications = (): PocketNotification[] => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(POCKET_NOTIFICATIONS_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is PocketNotification => Boolean(item?.id && item?.title && item?.createdAt))
      .slice(0, MAX_NOTIFICATIONS);
  } catch {
    return [];
  }
};

const savePocketNotifications = (items: PocketNotification[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(POCKET_NOTIFICATIONS_KEY, JSON.stringify(items.slice(0, MAX_NOTIFICATIONS)));
  window.dispatchEvent(new CustomEvent(POCKET_NOTIFICATIONS_EVENT));
};

const shouldPersistPocketNotification = (notification: PocketNotification) => {
  if (notification.severity === "warning" || notification.severity === "critical") return true;
  if (notification.metadata?.persist === true) return true;
  if (notification.metadata?.notificationType === "daily_digest") return true;
  return false;
};

export const addPocketNotification = (
  input: Omit<PocketNotification, "id" | "createdAt" | "read"> & Partial<Pick<PocketNotification, "id" | "createdAt" | "read">>,
) => {
  const notification: PocketNotification = {
    id: input.id || createId(),
    title: input.title,
    message: input.message,
    source: input.source,
    severity: input.severity,
    createdAt: input.createdAt || new Date().toISOString(),
    read: input.read ?? false,
    actionApp: input.actionApp,
    actionLabel: input.actionLabel,
    metadata: input.metadata,
  };
  if (!shouldPersistPocketNotification(notification)) {
    return notification;
  }
  const current = loadPocketNotifications();
  const dedupeKey = `${notification.source}:${notification.title}:${notification.message}`;
  const withoutDuplicate = current.filter((item) => `${item.source}:${item.title}:${item.message}` !== dedupeKey);
  savePocketNotifications([notification, ...withoutDuplicate]);
  return notification;
};

export const markPocketNotificationsRead = () => {
  savePocketNotifications(loadPocketNotifications().map((item) => ({ ...item, read: true })));
};

export const pruneLowPriorityPocketNotifications = () => {
  savePocketNotifications(
    loadPocketNotifications().filter((item) => shouldPersistPocketNotification(item)),
  );
};

export const clearPocketNotifications = () => {
  savePocketNotifications([]);
};

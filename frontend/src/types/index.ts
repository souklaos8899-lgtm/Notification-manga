export type {
  ReadingStatus,
  ExtractionMode,
  FetchStrategy,
  SourceCheckState,
  MangaSourceDto,
  MangaItemDto,
  NotificationChannelConfig,
  NotificationChannelDto,
  NotificationLogDto,
  DetectedChapterCandidate,
  UrlAnalyzeResultDto,
  UserProfileDto,
  SystemSettingsDto,
} from '../../../shared/contract';

export type FilterStatus = 'ALL' | 'UNREAD' | 'READING' | 'ON_HOLD' | 'PLAN_TO_READ' | 'COMPLETED';

export type SortField = 'LATEST_UPDATE' | 'LAST_READ' | 'TITLE';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  readonly id: string;
  readonly type: ToastType;
  readonly title: string;
  readonly message?: string;
}

export type ModalState =
  | { readonly kind: 'none' }
  | { readonly kind: 'add_manga' }
  | { readonly kind: 'edit_manga'; readonly mangaId: string }
  | { readonly kind: 'notification_channels' }
  | { readonly kind: 'notifications_center' }
  | { readonly kind: 'system_settings' }
  | { readonly kind: 'auth' };

export interface CreateMangaInput {
  readonly title: string;
  readonly coverUrl: string | null;
  readonly status: import('../../../shared/contract').ReadingStatus;
  readonly lastReadChapter: number | null;
  readonly notes?: string | null;
  readonly sources: readonly {
    readonly url: string;
    readonly label: string;
    readonly extractionMode: import('../../../shared/contract').ExtractionMode;
    readonly fetchStrategy?: import('../../../shared/contract').FetchStrategy;
    readonly isPrimary?: boolean;
  }[];
}

export interface UpdateMangaInput {
  readonly title?: string;
  readonly coverUrl?: string | null;
  readonly status?: import('../../../shared/contract').ReadingStatus;
  readonly lastReadChapter?: number | null;
  readonly notes?: string | null;
}

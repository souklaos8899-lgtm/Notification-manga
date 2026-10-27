export type ReadingStatus = 'READING' | 'ON_HOLD' | 'PLAN_TO_READ' | 'COMPLETED';

export type ExtractionMode =
  | { readonly kind: 'auto' }
  | {
      readonly kind: 'css';
      readonly chapterSelector: string;
      readonly titleSelector?: string;
      readonly coverSelector?: string;
    };

export type FetchStrategy = 'http' | 'browser_headers';

export type SourceCheckState =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'ok';
      readonly chapterNumber: number | null;
      readonly chapterTitle: string;
      readonly chapterUrl: string;
      readonly checkedAt: string;
    }
  | {
      readonly kind: 'error';
      readonly error: string;
      readonly checkedAt: string;
    };

export interface MangaSourceDto {
  readonly id: string;
  readonly mangaId: string;
  readonly label: string;
  readonly url: string;
  readonly domain: string;
  readonly isPrimary: boolean;
  readonly extractionMode: ExtractionMode;
  readonly fetchStrategy: FetchStrategy;
  readonly checkState: SourceCheckState;
}

export interface MangaItemDto {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly coverUrl: string | null;
  readonly status: ReadingStatus;
  readonly lastReadChapter: number | null;
  readonly lastReadChapterTitle: string | null;
  readonly lastReadAt: string | null;
  readonly latestChapter: number | null;
  readonly latestChapterTitle: string | null;
  readonly latestChapterUrl: string | null;
  readonly latestSourceDomain: string | null;
  readonly latestUpdatedAt: string | null;
  readonly hasUnread: boolean;
  readonly unreadCountEstimate: number;
  readonly notes: string | null;
  readonly sources: readonly MangaSourceDto[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type NotificationChannelConfig =
  | {
      readonly kind: 'telegram';
      readonly botToken: string;
      readonly chatId: string;
    }
  | {
      readonly kind: 'discord';
      readonly webhookUrl: string;
    }
  | {
      readonly kind: 'line';
      readonly channelAccessToken: string;
      readonly toUserId: string;
    }
  | {
      readonly kind: 'webhook';
      readonly url: string;
      readonly secretHeader?: string;
    };

export interface NotificationChannelDto {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly config: NotificationChannelConfig;
  readonly createdAt: string;
}

export interface NotificationLogDto {
  readonly id: string;
  readonly userId: string;
  readonly mangaId: string | null;
  readonly mangaTitle: string;
  readonly chapterNumber: number | null;
  readonly chapterTitle: string;
  readonly chapterUrl: string;
  readonly channelName: string;
  readonly channelKind: NotificationChannelConfig['kind'] | 'in_app';
  readonly deliveryStatus: 'sent' | 'failed';
  readonly errorMessage: string | null;
  readonly isRead: boolean;
  readonly createdAt: string;
}

export interface DetectedChapterCandidate {
  readonly chapterNumber: number | null;
  readonly chapterTitle: string;
  readonly chapterUrl: string;
  readonly selectorHint: string;
  readonly confidence: 'high' | 'medium' | 'low';
}

export interface UrlAnalyzeResultDto {
  readonly url: string;
  readonly domain: string;
  readonly detectedTitle: string;
  readonly detectedCoverUrl: string | null;
  readonly detectedPlatform: 'madara' | 'mangastream' | 'generic_chapter' | 'custom';
  readonly recommendedChapter: DetectedChapterCandidate | null;
  readonly candidates: readonly DetectedChapterCandidate[];
}

export interface UserProfileDto {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly role: 'admin' | 'user';
}

export interface SystemSettingsDto {
  readonly appMode: 'personal' | 'public';
  readonly allowPublicRegistration: boolean;
  readonly checkIntervalMinutes: number;
  readonly lastGlobalCheckAt: string | null;
}

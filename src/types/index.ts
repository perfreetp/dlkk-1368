export interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  category: 'milestone' | 'daily' | 'trip' | 'special';
  photos?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Letter {
  id: string;
  title: string;
  content: string;
  sender: 'me' | 'partner';
  date: string;
  isRead: boolean;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Photo {
  id: string;
  title: string;
  description?: string;
  filePath: string;
  thumbnailPath?: string;
  date: string;
  location?: string;
  tags: string[];
  albumId?: string;
  isFavorite: boolean;
  createdAt: string;
}

export interface PhotoAlbum {
  id: string;
  name: string;
  description?: string;
  coverPhotoId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Travel {
  id: string;
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  photos: string[];
  highlights: string[];
  cost?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Receipt {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  payer: 'me' | 'partner' | 'shared';
  note?: string;
  imagePath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  deadline: string;
  status: 'pending' | 'in_progress' | 'completed';
  progress: number;
  category: 'life' | 'career' | 'finance' | 'travel' | 'other';
  milestones: GoalMilestone[];
  createdAt: string;
  updatedAt: string;
}

export interface GoalMilestone {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  deadline?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
  assignee: 'me' | 'partner' | 'both';
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface Keepsake {
  id: string;
  title: string;
  description: string;
  category: 'movie' | 'food' | 'gift' | 'song' | 'book' | 'place' | 'other';
  date: string;
  imagePath?: string;
  rating?: number;
  note?: string;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemperatureRecord {
  id: string;
  date: string;
  myTemperature: number;
  partnerTemperature: number;
  note?: string;
  createdAt: string;
}

export interface SafeFile {
  id: string;
  fileName: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  category: 'document' | 'image' | 'video' | 'audio' | 'other';
  uploadedAt: string;
  description?: string;
  isEncrypted: boolean;
}

export interface Backup {
  id: string;
  name: string;
  createdAt: string;
  filePath: string;
  fileSize: number;
  type: 'full' | 'partial';
  note?: string;
}

export interface Settings {
  theme: 'romantic-pink' | 'soft-purple' | 'warm-orange' | 'custom';
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  language: 'zh-CN' | 'en';
  autoBackup: boolean;
  backupInterval: 'daily' | 'weekly' | 'monthly';
  backupPath?: string;
  encryptionEnabled: boolean;
  passwordHash?: string;
  passwordHint?: string;
  visitorModeEnabled: boolean;
  visitorPasswordHash?: string;
  temperatureUnit: 'celsius' | 'fahrenheit';
  currency: string;
  anniversaryDate: string;
  partnerName: string;
  myName: string;
  avatarPath?: string;
  partnerAvatarPath?: string;
  notificationsEnabled: boolean;
  reminderTime?: string;
}

export type ViewType =
  | 'timeline'
  | 'letters'
  | 'gallery'
  | 'travels'
  | 'checklist'
  | 'stats'
  | 'safe'
  | 'backup';

export interface SearchState {
  query: string;
  isActive: boolean;
  results: SearchResult[];
}

export interface SearchResult {
  type: ViewType;
  id: string;
  title: string;
  snippet?: string;
  date?: string;
}

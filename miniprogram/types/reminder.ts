export interface Reminder {
  _id?: string;
  text?: string;
  title: string;
  remindAt: string;
  location?: string;
  note?: string;
  remindOffsetMinutes?: number;
  notifyStatus?: 'pending' | 'authorized' | 'denied' | 'sending' | 'sent' | 'failed' | 'missed' | 'unknown' | 'cancelled';
  sourceType?: 'text' | 'clipboard' | 'voice' | 'image';
  aiConfidence?: number;
  parseWarnings?: string[];
  status?: 'pending' | 'completed' | 'deleted';
  createdAt?: string;
  completedAt?: string;
  sentAt?: string;
  deletedAt?: string;
}

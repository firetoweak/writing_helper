
// Data Models

export interface User {
  id: string;
  name: string;
  avatar: string; // URL or Initials
  role: 'author' | 'reviewer' | 'viewer' | 'prompt_expert';
}

export interface ReviewComment {
  id: string;
  userId: string;
  text: string;
  severity: 'high' | 'medium' | 'low'; // Importance level
  category: 'grammar' | 'logic' | 'style' | 'completeness';
  resolved: boolean;
  assignedTo?: string; // User ID for @mentions
  timestamp: number;
}

export interface ChapterReviewData {
  score: number;
  summary: string;
  todos: string[];
  lastReviewedContent?: string;
}

export interface WritingPoint {
  id: string;
  text: string;
  subPoints: string[]; // Detailed sub-points
  isCompleted: boolean;
  tags: string[];
}

export type VersionType = 'manual' | 'ai_gen' | 'full_polish' | 'partial_merge' | 'smart_edit';

export interface Version {
  id: string;
  timestamp: number;
  content: string;
  note?: string; // e.g., "AI Rewrite", "Manual Save"
  type?: VersionType;
}

export interface OutlineNode {
  id: string;
  title: string;
  level: number; // 1 = H1, 2 = H2, etc.
  parentId: string | null;
  content: string; // The text content of this chunk
  isLocked: boolean; // Level 1 titles cannot be deleted/modified title
  status: 'draft' | 'reviewing' | 'done';
  // reviews: ReviewComment[]; // Deprecated in favor of structured chapterReview
  chapterReview?: ChapterReviewData; // Structured review data
  writingPoints?: WritingPoint[]; // Points specific to this node (generated at outline stage)
  lastReviewedContent?: string; // To track if review is outdated
  history?: Version[]; // Version history
  chapterGuide?: string;
}

export interface GlobalGuide {
    globalOverview: string;
    chapterGuides: Record<string, string>; // Key: Chapter Title, Value: Guide
}

export interface Project {
  id: string;
  title: string;
  concept: string; // User's initial concept/idea
  description: string;
  outline: OutlineNode[];
  users: User[];
  materials: string[]; // Mock list of uploaded file names/content
  globalGuide?: GlobalGuide;
}

export interface Reference {
  id: string;
  text: string;
  source: 'editor' | 'chat'; // Where it came from
  preview: string; // Truncated text
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  sources?: { title: string; uri: string }[];
  summary?: string; // Short summary for timeline
  type?: 'qa' | 'writing'; // Type of interaction
  selected?: boolean; // For multi-select merge
  suggestionData?: {
      userQuestions: string[]; // Column 1: What user might ask
      aiInfo: string[];        // Column 2: What AI can provide
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  isActive: boolean;
  linkedSectionId?: string;
}

export interface PromptsConfig {
  outline_gen: string;
  content_gen: string;
  review_gen: string;
  rewrite_gen: string;
}

// UI State Types
export type ViewState = 'setup' | 'outline' | 'writing' | 'final_review' | 'expert_dashboard';

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Alice Chen', avatar: 'AC', role: 'author' },
  { id: 'u2', name: 'Bob Smith', avatar: 'BS', role: 'reviewer' },
  { id: 'u3', name: 'Dr. Prompt', avatar: 'DP', role: 'prompt_expert' },
];

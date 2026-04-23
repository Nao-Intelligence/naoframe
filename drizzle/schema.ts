import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const feedbackKindEnum = pgEnum("feedback_kind", ["text", "audio"]);
export const decisionStatusEnum = pgEnum("decision_status", [
  "accepted",
  "rejected",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  clientName: text("client_name"),
  baseWireframeUrl: text("base_wireframe_url"),
  uploadPath: text("upload_path"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const userStories = pgTable(
  "user_stories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    acceptanceCriteria: text("acceptance_criteria").notNull().default(""),
    startPath: text("start_path").notNull().default("/"),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: index("user_stories_project_idx").on(t.projectId),
  }),
);

export const shareLinks = pgTable(
  "share_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    label: text("label"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => ({
    projectIdx: index("share_links_project_idx").on(t.projectId),
  }),
);

export const reviewerSessions = pgTable(
  "reviewer_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shareLinkId: uuid("share_link_id")
      .notNull()
      .references(() => shareLinks.id, { onDelete: "cascade" }),
    reviewerEmail: text("reviewer_email"),
    reviewerName: text("reviewer_name"),
    userAgent: text("user_agent"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    shareLinkIdx: index("reviewer_sessions_share_link_idx").on(t.shareLinkId),
  }),
);

export const storyDecisions = pgTable(
  "story_decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userStoryId: uuid("user_story_id")
      .notNull()
      .references(() => userStories.id, { onDelete: "cascade" }),
    reviewerSessionId: uuid("reviewer_session_id")
      .notNull()
      .references(() => reviewerSessions.id, { onDelete: "cascade" }),
    status: decisionStatusEnum("status").notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    storyIdx: index("story_decisions_story_idx").on(t.userStoryId),
    sessionIdx: index("story_decisions_session_idx").on(t.reviewerSessionId),
  }),
);

export const feedbackEntries = pgTable(
  "feedback_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userStoryId: uuid("user_story_id")
      .notNull()
      .references(() => userStories.id, { onDelete: "cascade" }),
    reviewerSessionId: uuid("reviewer_session_id")
      .notNull()
      .references(() => reviewerSessions.id, { onDelete: "cascade" }),
    kind: feedbackKindEnum("kind").notNull(),
    body: text("body").notNull(),
    audioObjectKey: text("audio_object_key"),
    audioDurationMs: integer("audio_duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    storyIdx: index("feedback_entries_story_idx").on(t.userStoryId),
    sessionIdx: index("feedback_entries_session_idx").on(t.reviewerSessionId),
    createdAtIdx: index("feedback_entries_created_at_idx").on(t.createdAt),
  }),
);

export type Project = typeof projects.$inferSelect;
export type UserStory = typeof userStories.$inferSelect;
export type ShareLink = typeof shareLinks.$inferSelect;
export type ReviewerSession = typeof reviewerSessions.$inferSelect;
export type StoryDecision = typeof storyDecisions.$inferSelect;
export type FeedbackEntry = typeof feedbackEntries.$inferSelect;

// Suppress unused import in environments without drizzle-orm sql usage.
void sql;

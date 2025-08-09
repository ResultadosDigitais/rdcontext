-- Unified V2 Schema Migration
-- Creates the optimized rdcontext schema with unified snippets table and sqlite-vec support

-- Create libraries table (unchanged from v1)
CREATE TABLE `libraries` (
	`name` text PRIMARY KEY NOT NULL,
	`description` text,
	`owner` text NOT NULL,
	`repo` text NOT NULL,
	`ref` text NOT NULL,
	`sha` text NOT NULL,
	`folders` text DEFAULT (json_array()) NOT NULL,
	`files` integer DEFAULT 0,
	`snippets` integer DEFAULT 0,
	`timestamp` text DEFAULT (current_timestamp) NOT NULL
);

-- Create unified snippets table (v2 schema - supports both OpenAI and Gemini)
CREATE TABLE `snippets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`library` text NOT NULL,
	`path` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`language` text,
	`code` text NOT NULL,
	`provider` text NOT NULL,
	`embedding_dims` integer NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`library`) REFERENCES `libraries`(`name`) ON DELETE cascade
);

-- Create fallback vector table for when sqlite-vec is not available
CREATE TABLE `snippets_vec_fallback` (
	`snippet_id` integer PRIMARY KEY,
	`embedding` blob NOT NULL
);

-- Create optimized indexes for fast queries
CREATE INDEX `snippets_library_idx` ON `snippets` (`library`);
CREATE INDEX `snippets_provider_idx` ON `snippets` (`provider`);
CREATE INDEX `snippets_created_at_idx` ON `snippets` (`created_at`);
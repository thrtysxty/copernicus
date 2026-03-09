# Retrospective Workflow Guide

## Overview

The **Release Retrospective** workflow is an automated 9-node process designed to analyze sprint performance, extract actionable learnings, and reinforce agent memory. It integrates data from git logs, model usage statistics, performance scores, and build logs to provide a holistic view of the sprint.

## 9 Workflow Nodes

The workflow executes the following nodes sequentially:

1.  **`git-log-reader`** (Shell Command): Extracts git commit messages since the last release tag.
2.  **`model-calls-summary`** (DB Query): Aggregates model usage statistics (calls, tokens, cost) from the last 14 days.
3.  **`performance-analyser`** (DB Query): Retrieves model performance metrics (speed, cost, accuracy, adherence) from the last 14 days.
4.  **`build-error-reader`** (File Read): Reads the latest build and application logs to identify recurring technical issues.
5.  **`user-reflection`** (Human Approval): Prompts the user to provide qualitative feedback on what went well and what slowed them down.
6.  **`learning-extractor`** (AI Agent): An AI senior developer analyzes all gathered evidence and extracts 5-10 concrete learning rules.
7.  **`routing-weight-updater`** (Memory Write): Updates the project's memory with routing-specific learnings (Importance: 9).
8.  **`memory-writer`** (Memory Write): Writes general sprint learnings to the project memory (Importance: 8).
9.  **`agents-md-updater`** (AGENTS.md Append): Appends the reinforced rules to the `AGENTS.md` file for future reference.

## Triggering the Retrospective

To run the retrospective, click the **Brain icon (Run Retrospective)** button in the **Kanban Board header bar** (top-right).

## Memories and Reinforcements

### Memory Storage
Learnings are stored in the `project_memory` table with high importance (8-9). These memories are automatically retrieved and injected into agent prompts during relevant tasks to prevent recurring mistakes.

### AGENTS.md Reinforcements
Actionable rules are appended to the `## Reinforcements` section of `AGENTS.md`. This serves as a "living contract" that agents must follow during implementation.

## Process Rule

**Run the retrospective before starting every new sprint.** This ensures that the collective intelligence gained from the previous sprint is immediately available to agents working on new stories.

## Routing Weights
Learnings marked with `retrospective-routing` source influence the `ModelRegistry` when selecting the best model for a given task, favoring models that demonstrated high adherence and accuracy in previous sprints.

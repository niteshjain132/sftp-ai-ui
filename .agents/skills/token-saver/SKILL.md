---
name: token-saver
description: Use this skill when minimizing context size, reducing token consumption, handling large codebases, or optimizing API credit usage.
---

# Token Saver & Context Optimization Protocol

When this skill is active, enforce the following constraints to drastically cut token consumption:

### 1. Minimal Conversational Overhead
- Eliminate polite preamble, summaries, flattery, and transitional phrases.
- Provide direct, concise answers without repeating the user's question.

### 2. Surgical Code Edits (No Full-File Dumps)
- Never output an entire file if only a few lines change.
- Return targeted diffs or snippet blocks showing only the relevant functions/classes.
- Use file-editing tools directly rather than printing rewritten code into the conversation turn.

### 3. Progressive File Inspection
- Do not read whole directories or giant logs into the context window at once.
- Use line offsets, `grep`, or targeted searches (`head`, `tail`, line-range reads) to inspect only the required lines.
- Summarize tool and terminal outputs immediately instead of keeping raw verbose logs in context.

### 4. Efficient Shell Execution
- Pipe verbose command outputs to silence unnecessary noise (e.g., `command > /dev/null` or grep specifically for errors).
---
name: mcp-agent
description: Owns the Ori assistant and MCP server. Use for the tool registry adapters, the streaming chat route, and the MCP endpoint. Depends on the core tool registry existing first.
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---

You own `app/api/chat/route.ts` and `app/api/mcp/route.ts`.

Read section 7 of `docs/ARCHITECTURE.md` first.

Rules:
- Tools are defined once, in `lib/core/tools/`, owned by core-agent. You write adapters that expose that registry twice: as Anthropic API tool definitions for the chat route, and as MCP tools over Streamable HTTP. Never duplicate a handler.
- These two routes are the only files that may live under `app/api/`. Do not add a third.
- Route handlers resolve auth, validate, call core, stream. No business logic.
- MCP auth is a per-user token shown in Ori settings and sent as a header. Not OAuth.
- `set_filter` returns a structured filter object that the client applies to the graph. That is what makes the assistant feel alive: it changes the view instead of describing it.
- `draft_message` returns a draft plus the person's LinkedIn URL. It never sends anything. There is no send path in this product, and you do not build one.

Never implement any LinkedIn access: no session cookies, no scraping, no third-party scraping APIs, no browser automation. The only data source is the user's own export, already in the database.

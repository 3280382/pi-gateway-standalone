# Mock Data

Mock data for development environment.

## Purpose

Vite development server uses these files as Mock API responses.

## File Descriptions

| File | Purpose |
|------|---------|
| `api-responses/models.json` | Available model list |
| `api-responses/system-prompt.json` | System prompt |
| `sessions/index.json` | Session list |
| `sessions/*.jsonl` | Session message data |
| `files/*.json` | File browsing data |

## Usage

In development mode (`npm run dev:react`), Vite automatically uses these files as API responses.

Production environment uses real backend APIs.

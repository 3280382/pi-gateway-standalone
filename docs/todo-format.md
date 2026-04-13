# Todo.md Format Specification

## Overview
A human-readable, AI-friendly, and machine-parseable todo format.

## Format

```markdown
# Todo List

## Project: [Project Name]
Generated: 2024-01-15T10:30:00Z

---

## TODO

### [/path/to/file1.js]
- [ ] Implement user authentication | #high #feature @john | 2024-01-15
- [x] Fix login bug | #bug #urgent | 2024-01-14
- [ ] Add unit tests | #test #medium | 2024-01-16

### [/path/to/folder/]
- [ ] Review folder structure | #low #refactor | 2024-01-17

---

## Completed

### [/path/to/file2.ts]
- [x] Setup project | #setup | 2024-01-10
- [x] Initial commit | #git | 2024-01-10

---

## Metadata

### Statistics
- Total: 5
- Pending: 3
- Completed: 2
- High Priority: 1
- Medium Priority: 2
- Low Priority: 1
```

## Field Definitions

### Todo Item Format
```
- [status] content | #tags @assignee | due_date
```

- **status**: `[ ]` pending, `[x]` completed
- **content**: Human readable description
- **tags**: Optional, prefixed with `#`, e.g., `#high`, `#bug`, `#feature`
- **assignee**: Optional, prefixed with `@`, e.g., `@john`
- **due_date**: Optional, ISO 8601 format `YYYY-MM-DD`

### File/Folder Grouping
Todos are grouped by file or folder path under `### [path]` headers.

### Sections
- **TODO**: Active/pending todos
- **Completed**: Finished todos (can be archived)
- **Metadata**: Statistics and tracking info

## Benefits

1. **Human Readable**: Markdown format with clear structure
2. **AI Readable**: Structured headers and consistent formatting
3. **Machine Parseable**: Regex-friendly patterns
4. **Version Control Friendly**: Line-based, diff-friendly
5. **Extensible**: Easy to add new fields or sections

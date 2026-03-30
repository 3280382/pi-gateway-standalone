# File Browser User Test Cases

## Test Environment
- Frontend: http://127.0.0.1:5173
- Backend: http://127.0.0.1:3000
- Test Directory: `/root/test_files/`

## Setup
```bash
# Create test directory
mkdir -p /root/test_files

# Create test files
echo "console.log('Hello JavaScript');" > /root/test_files/test.js
echo "print('Hello Python')" > /root/test_files/test.py
echo "#!/bin/bash\necho 'Hello Bash'" > /root/test_files/test.sh
echo "# Markdown Test\n\nThis is a **test** file." > /root/test_files/test.md
echo "{\"name\": \"test\", \"value\": 123}" > /root/test_files/test.json
echo "<html><body><h1>Test HTML</h1></body></html>" > /root/test_files/test.html
echo "body { color: blue; }" > /root/test_files/test.css
```

## Test Case 1: Basic Navigation
### Steps:
1. Open browser to http://127.0.0.1:5173
2. Click "Files" tab to switch to file browser view
3. Observe left sidebar with directory tree
4. Click on root directory (`/`) in sidebar
5. Click on `test_files` directory

### Expected Results:
- File browser loads with sidebar and main content area
- Sidebar shows directory tree with expandable items
- Clicking root directory loads its contents
- Clicking `test_files` navigates to that directory
- Main area shows test files created in setup

## Test Case 2: File Selection and Actions
### Steps:
1. Navigate to `/root/test_files/`
2. Click on `test.js` file
3. Observe FileActionBar appears with View, Edit, Run buttons
4. Click "View" button
5. Click "Edit" button
6. Click "Run" button

### Expected Results:
- Clicking file selects it (highlighted)
- FileActionBar appears below toolbar with selected filename
- View button opens FileViewer in view mode
- Edit button opens FileViewer in edit mode with editable content
- Run button executes file and opens bottom panel with output

## Test Case 3: File Viewer Functionality
### Steps:
1. Select `test.js` and click "View"
2. Verify file content displays correctly
3. Click close button (X)
4. Select `test.js` and click "Edit"
5. Modify content and click "Save"
6. Click "View" again to verify changes

### Expected Results:
- FileViewer modal opens with file content
- Syntax highlighting for JavaScript
- Close button works
- Edit mode allows content modification
- Save button persists changes
- Changes visible when reopening file

## Test Case 4: File Execution
### Steps:
1. Select `test.sh` file
2. Click "Run" button
3. Observe bottom panel opens
4. Verify output shows "Hello Bash"
5. Select `test.py` file
6. Click "Run" button
7. Verify output shows "Hello Python"

### Expected Results:
- Run button appears for executable files (.sh, .py, .js)
- Bottom panel opens automatically when executing
- Command output streams to bottom panel
- Different file types execute correctly

## Test Case 5: Different File Formats
### Steps:
1. Select `test.md` and click "View"
2. Select `test.json` and click "View"
3. Select `test.html` and click "View"
4. Select `test.css` and click "View"

### Expected Results:
- Markdown files display with basic formatting
- JSON files display with syntax highlighting
- HTML files display as plain text (or could render in iframe)
- CSS files display with syntax highlighting

## Test Case 6: Directory Operations
### Steps:
1. In sidebar, click on `test_files` directory
2. Click expand icon (if available)
3. Navigate back to parent directory using ".." button in toolbar
4. Use path bar to navigate directly to `/root`

### Expected Results:
- Directory click navigates to that directory
- Expand icon shows/hides subdirectories
- ".." button navigates to parent directory
- Path bar shows current path and allows navigation

## Test Case 7: Search and Filter
### Steps:
1. Navigate to `/root/test_files/`
2. Type "js" in search/filter input
3. Type "test" in search/filter input
4. Clear search input

### Expected Results:
- Files filter dynamically as you type
- Only `test.js` shows when searching "js"
- All test files show when searching "test"
- Clearing search shows all files

## Test Case 8: View Modes
### Steps:
1. Click grid view icon (if available)
2. Click list view icon (if available)
3. Verify both views work correctly

### Expected Results:
- Grid view shows files as icons with names
- List view shows files in table format with details
- View mode persists between navigation

## Test Case 9: Keyboard Shortcuts
### Steps:
1. Select a file
2. Press Enter key
3. Press Escape key while FileViewer is open
4. Double-click a file

### Expected Results:
- Enter opens selected file in FileViewer
- Escape closes FileViewer
- Double-click opens file in FileViewer

## Test Case 10: Error Handling
### Steps:
1. Try to navigate to non-existent directory
2. Try to execute non-executable file (e.g., .txt)
3. Try to save file without write permissions

### Expected Results:
- Error messages display appropriately
- UI remains responsive
- User can recover from errors

## Performance Tests
### Steps:
1. Navigate to directory with many files (e.g., `/root/`)
2. Scroll through file list
3. Expand directory with many subdirectories in sidebar
4. Search/filter with many files

### Expected Results:
- File list loads and scrolls smoothly
- Sidebar expands without noticeable lag
- Search/filter responds quickly

## Cross-Browser Compatibility
### Test in:
- Chrome/Chromium
- Firefox
- Safari (if available)

### Expected Results:
- Consistent appearance and behavior
- All features work correctly
- No JavaScript errors in console

## Mobile Responsiveness
### Steps:
1. Resize browser window to mobile size
2. Test all major functionalities

### Expected Results:
- Layout adapts to smaller screens
- Touch interactions work correctly
- Text remains readable

## Accessibility
### Steps:
1. Test keyboard navigation
2. Check screen reader compatibility
3. Verify color contrast

### Expected Results:
- All functionality accessible via keyboard
- Screen readers can interpret UI elements
- Sufficient color contrast for readability

## Regression Tests
After code changes, verify:
1. All existing functionality still works
2. No new bugs introduced
3. Performance not degraded

## Automated Test Commands
```bash
# Run unit tests
cd /root/pi-gateway-standalone
npm test

# Run integration tests
npm run test:integration

# Run specific file browser tests
npm test -- test/integration/file-browser-comprehensive.test.ts
```
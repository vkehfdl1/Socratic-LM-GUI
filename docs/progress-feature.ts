// Progress Bar Feature Implementation - Test Examples
// This file demonstrates how the progress bar feature works with chatbot responses

/*
Example chatbot responses that will show progress bars:

1. Basic progress example:
"I'm working on your request. <PROGRESS>0.3</PROGRESS> Processing data..."

2. Multiple progress updates in one message:
"Starting analysis... <PROGRESS>0.1</PROGRESS>
Running calculations... <PROGRESS>0.5</PROGRESS>
Almost done! <PROGRESS>0.9</PROGRESS>
Complete!"

3. Progress with percentage format (will be clamped to 0-1):
"Download progress: <PROGRESS>0.75</PROGRESS> (75% complete)"

4. Invalid progress values (will be clamped):
"<PROGRESS>1.5</PROGRESS>" // Will be clamped to 1.0
"<PROGRESS>-0.2</PROGRESS>" // Will be clamped to 0.0

Features implemented:
✅ Progress bar component with smooth transitions
✅ Automatic progress extraction from <PROGRESS>value</PROGRESS> tags
✅ Progress bar displays only for assistant messages with valid progress tags
✅ Real-time updates during message streaming
✅ Progress tags are removed from displayed text content
✅ Progress values are clamped to 0-1 range for safety
✅ Responsive design with proper styling

Usage:
- The chatbot should include <PROGRESS>value</PROGRESS> tags in its responses
- Value should be a float between 0 and 1 (0% to 100%)
- Progress bar will automatically appear at the top of assistant message boxes
- Multiple progress updates in the same message will show the last/highest value
*/

export {};

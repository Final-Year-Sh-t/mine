Plan: Clean up Help page bullet formatting

## What will change
Update `src/pages/Docs.tsx` so the text under these three cards no longer uses markdown-style bold bullets (`- **Label**:`):
- Getting Started → Verification Process → "Performing a Verification"
- Getting Started → Verification Process → "Understanding Results"
- Security → "Data Protection"

## Proposed formatting
- Replace each `- **Label**: value` line with a plain-sentence paragraph such as `Label: value`.
- Keep the paragraph breaks so the information stays readable and organized.
- Leave other help sections untouched.

## Technical detail
`src/pages/Docs.tsx` stores the content strings inside the `sections` constant. The text is rendered with `whitespace-pre-line`, so line breaks are preserved. We only need to edit the string content for the three cards listed above.

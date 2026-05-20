# Goal Description

The user requests that the Fellowship admin portal works flawlessly, with a specific focus on making the Letter of Recommendation (LOR) documents visible correctly in the candidate and application review pages. Additionally, they want all existing issues resolved so the system runs without errors.

## User Review Required

> [!IMPORTANT]
> This plan outlines extensive changes across multiple components (pages, utilities, API calls, and UI components). Please review the proposed modifications, especially the handling of LOR URLs, authentication, and UI layout changes. Approve or suggest adjustments before we proceed.

## Open Questions

> [!QUESTION]
> 1. **LOR storage format**: Are LOR files stored as `/objects/...` paths, or do they sometimes use external URLs? Should we support both?
> 2. **Access control**: Should LOR visibility be restricted to admin users only, or also to interviewers/unit coordinators?
> 3. **UI expectations**: Do you prefer inline preview for PDFs/images, or a simple "Open" button?
> 4. **Testing environment**: Is there a staging backend URL we can use for fetching LOR files, or should we rely on the current development server?

## Proposed Changes

---
### Candidate Review Page (`src/pages/CandidatesPage.tsx` or similar)
- Ensure LOR fields (`lor1Url`, `lor2Url`) are parsed using the `DocValue` component.
- Add fallback handling for missing or malformed URLs.
- Apply proper authentication headers when fetching LORs.
- Update UI to display QR verification button alongside the preview.

---
### Application Review Page (`src/pages/ApplicationFormsPage.tsx`)
- Within the submission list, render LOR columns using `DocValue`.
- Introduce a helper `isLorUrl(url)` to classify LOR links.
- Adjust table layout to allocate sufficient width for the preview button.

---
### `DocValue` Component (`src/components/DocValue.tsx` or inline in ApplicationFormsPage)
- Refactor to separate concerns: fetching, preview rendering, error handling.
- Add explicit error messages when the LOR cannot be fetched.
- Ensure the QR verification URL uses the correct base (`window.location.origin`).
- Provide a prop `allowInline` to control inline preview vs download.

---
### API Utility (`src/lib/api.ts`)
- Centralize storage fetching logic in a function `fetchStorageObject(path: string)` that adds the Authorization header.
- Update all direct `fetch` calls to use this helper.

---
### Authentication Context (`src/contexts/AuthContext.tsx`)
- Verify that `fellowship_token` is set and refreshed on login.
- Expose a helper `getAuthHeaders()` for use by API utils.

---
### Global Error Boundary
- Add a top‑level error boundary to catch uncaught React errors and display a friendly UI.
- Log errors to the console and optionally send them to a monitoring endpoint.

---
### Styling & UX Enhancements
- Apply consistent button styles for LOR actions (view, download, verify).
- Add subtle hover animations using `framer‑motion` for better feedback.
- Ensure dark‑mode compatibility for the preview modal.

---
### Tests & Validation
- Write unit tests for `DocValue` fetching logic using mocked fetch responses.
- Add integration tests for the Candidate and Application pages to verify LOR elements render correctly.
- Run the TypeScript compiler and linting to ensure no new errors are introduced.

## Verification Plan

### Automated Tests
- Execute `npm run test` (or the project's test script) after implementing changes.
- Use `npm run lint` to check for TypeScript/ESLint issues.
- Run the development server (`npm run dev`) and manually navigate to:
  1. Candidate review page – confirm LOR preview and QR verification work.
  2. Application review page – confirm LOR columns display correctly.
  3. Verify that other pages (Login, Verify LOR, Units, etc.) load without console errors.

### Manual Verification
- Open a sample candidate with LOR URLs and test both inline preview and file download.
- Log in as an admin and as a non‑admin role to ensure access restrictions behave as expected.
- Check responsive layout on different screen sizes.

---
**Next Steps**: Await user approval of this implementation plan before proceeding with code changes.

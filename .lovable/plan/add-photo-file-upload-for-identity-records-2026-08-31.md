# Add Photo File Upload for Identity Records

## Goal

Let admins pick a photo file (JPG/PNG/WebP) from their device when adding or editing an identity record, instead of only pasting an image URL. The photo is stored in cloud storage and its link is saved automatically to the record — no URL hunting required.

## What changes

### 1. New cloud storage bucket: `identity-photos`

- Public bucket so photos render on the verification card without a login.
- Files are organized per institution: `{institution_id}/{random-name}.{ext}`.

### 2. Storage access rules (database migration)

Mirror the existing institution-logo rules, scoped to the new bucket:

- Anyone can view photos in the bucket (public read).
- Institution admins can upload, replace, and delete photos inside their own institution's folder.
- Super admins can manage any photo.
- Regular staff members cannot upload or delete photos.

### 3. Add Record / Edit Record form (Admin page)

Replace the plain "Photo URL" text box with an upload control:

- **Upload area** — click to pick a file from the device (JPG, PNG, or WebP, max ~2 MB, matching the logo upload behavior).
- **Live preview** — the chosen photo is shown in the form immediately after upload.
- **Automatic saving** — the file uploads to the `identity-photos` bucket and the returned link is stored in the record's `photo_url`.
- **Manual URL still works** — the existing "paste a link" field remains as a fallback.
- **Editing** — the current photo is shown; admins can replace it with a new file or clear it.
- **Error handling** — invalid file type or oversized file shows a clear message (same pattern as the logo upload).

### 4. No other changes

- The verification card already renders `photo_url`, so no changes needed there.
- Bulk upload keeps using the `photo_url` column (spreadsheets can't carry files).

## Files touched

- `src/pages/Admin.tsx` — upload handler + form UI
- Database migration — storage bucket policies (bucket itself created via the storage tool)
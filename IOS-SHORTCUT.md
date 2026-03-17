# iOS Shortcut: Copy Page Text

A Siri Shortcut that extracts the text from any webpage and copies it to your clipboard — ready to paste into RSVP Reader.

---

## Why this is needed on iOS

Getting the full text of a webpage on iOS is surprisingly difficult. No iOS browser offers a reliable "Select All" for page content — tap-and-drag selection is tedious, frequently grabs the wrong elements, and on complex pages it's nearly impossible to select everything cleanly. Safari's built-in Reader mode helps on well-structured articles, but it doesn't activate on many page types: forums, Reddit threads, documentation sites, wiki pages, and anything with non-standard layouts will show no Reader option at all.

This shortcut solves both problems. It tries Safari Reader first for clean extraction, and when Reader can't parse the page, it falls back to fetching the raw HTML and stripping it to plain text. The result is a single share-sheet action that works on virtually any webpage, giving you the full text on your clipboard in one tap.

By configuring it as a **share sheet** shortcut rather than a standalone one, you can run it directly from the page you're already looking at — tap the share icon in Safari, pick "Copy Page Text," and you're done. No switching apps, no copying URLs manually, no extra steps. The share sheet passes the current page's URL straight to the shortcut automatically.

---

## Setup

1. Open the **Shortcuts** app and tap **+** to create a new Shortcut.
2. Tap the name at the top and rename it to **"Copy Page Text"**.
3. Tap the info icon or dropdown and enable **Show in Share Sheet**.
4. Under **Receives**, select **URLs** (deselect anything else).

## Actions

Add the following actions in order:

### Get Article using Safari Reader

Search for and add **Get Article using Safari Reader**. Its input should automatically be set to "Shortcut Input."

### If (Article has any value)

Add an **If** action. Set it to: **If *Article* has any value.** This catches pages where Reader returns nothing.

### Reader succeeded (inside the "If" block)

1. **Get Text from** — set input to "Article." This strips it down to plain text.
2. **Set Variable** — name it `PageText`.

### Reader failed (inside the "Otherwise" block)

1. **Get Contents of URL** — set input to "Shortcut Input" (the original URL). This fetches the raw HTML.
2. **Make Rich Text from HTML** — set input to "Contents of URL."
3. **Get Text from** — set input to "Rich Text from HTML." This flattens it to plain text.
4. **Set Variable** — same name, `PageText`.

### After the "End If"

1. **Copy to Clipboard** — set input to the variable `PageText`.
2. **Show Notification** — set the title to "Copied!" and the body to "Page text is on your clipboard."

## Usage

1. Open any page in Safari.
2. Tap the **share icon**.
3. Choose **"Copy Page Text"** from the list.
4. The text lands on your clipboard as plain text.
5. Open RSVP Reader, tap **Paste from Clipboard**, and start reading.

## Testing

Try it on a couple of different page types:

- **News article** — should hit the Reader path.
- **Reddit thread or forum page** — will likely hit the fallback path.

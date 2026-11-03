# noteful.me

Built by Mehmet Firat Aksoy · [mfirataksoy.com](https://mfirataksoy.com)

Shared notes with no account. Open the site, share the link, and write together
in real time: everyone's cursor shows up with their name, and edits merge
without conflicts, even after going offline for a while. Any note can be locked
with a password, which encrypts it in the browser, so the server never sees what
it says.

**Live:** https://noteful.me (formerly notewith.me)

## How it works

- **Editor:** Vue 3 and [Tiptap](https://tiptap.dev) (ProseMirror) with markdown
  shortcuts (`#`, `-`, `1.`, `[]`, `>`, ```` ``` ````), checklists, highlights,
  code blocks and tables. Type `/` for a menu of blocks (`src/lib/slashCommands.js`).
- **Offline and installable:** a service worker (`vite-plugin-pwa`) keeps the app
  shell, and open notes keep a Yjs copy in IndexedDB (`src/lib/localCopy.js`), so
  notes you've opened before open without a connection and offline edits sync
  when it's back. Locked notes are never stored on the device unencrypted.
- **Real time:** the note is a [Yjs](https://yjs.dev) document (a CRDT). Each note
  is its own Cloudflare Durable Object (`worker/room.js`, built on
  `y-partyserver`) that browsers reach over WebSocket. It merges updates, relays
  cursors and stores the document in the object's SQLite storage.
- **Hosting:** Cloudflare Pages serves the app (`dist/`, project `noteful`); the Worker runs at `live.noteful.me`.
- **Old notes:** notes from before the realtime editor were HTML in MongoDB, and
  were copied once into a D1 database (`noteful-legacy`, see
  `scripts/export-legacy-notes.cjs`). The first time an old note is opened, its
  room reads the HTML from D1 and hands it to that browser, which imports it.

## Sharing and your notes

- **Your notes:** the notes you open are listed in this browser (localStorage
  only; locked notes keep no title), so a lost link isn't a lost note.
- **Read-only links:** `/v/<id>` shows a note live without edit rights. The
  Worker maps the id to the note in D1 (`view_links`), so the viewer never sees
  the edit link, and the room marks the connection read-only, so Yjs ignores
  its edits. Replacing the link or locking the note ends it.
- **QR codes** for the edit and read-only links, to continue on a phone.
- **Download and import:** Markdown, HTML, plain text, print or save as PDF;
  Markdown or text files are added at the end of the note.

## Images and comments

- **Images** (paste, drop, the toolbar or `/`): the browser shrinks each image,
  encrypts it with its own random AES-GCM key and uploads the ciphertext to R2
  (`POST /parties/note-room/<id>/images`, the access key is required for locked
  notes). The key lives only in the image's address inside the note
  (`noteful-image:<id>#k=…`), so the server never sees an image, and for locked
  notes the address is encrypted with the rest of the note. Deleting a note
  deletes its images.
- **Abuse limits:** 6 uploads a minute and 40 an hour per visitor (D1
  `upload_counts`, keyed by a daily hash of the IP, pruned after 48 h); 8 MB per image and 50 MB per note; all images together stop at
  `IMAGE_STORAGE_GB` (D1 `image_usage`). *Report abuse* (footer and the ⋯ menu)
  mails a note's link, which is enough to open and delete it.
- **Comments:** select text and press *Comment* (or ⌘⌥M). Threads live in the
  note's Yjs document, so they sync live, are encrypted with locked notes and
  are part of version history; the commented text carries a `comment` mark.
  Reply, resolve (removes the highlight) or delete.

## History and self-destruct

- **Version history:** the room keeps a copy of the note every 10 minutes of
  editing (the newest 50). For locked notes the browser sends encrypted copies
  instead, so the history is as private as the note. Restoring is a normal edit
  that everyone sees, and the current text is kept as a version first. Locking
  a note deletes its readable history.
- **Delete automatically / now:** a Durable Object alarm deletes the note at
  the chosen time (1 hour to 30 days): text, history, read-only link and any
  imported legacy copy. Only a "deleted" mark stays, so the address can't come
  back with an old copy. Open tabs switch to a "deleted" screen.

## Locked notes

The lock icon puts a password on a note. Everything happens in the browser
(`src/lib/noteCrypto.js`, `src/lib/encryptedProvider.js`):

- PBKDF2-SHA256 (310,000 iterations, random salt per note) turns the password
  into 512 bits: an AES-GCM key that encrypts the note, and an access key.
- The room deletes its readable copy and from then on keeps only a log of
  encrypted Yjs updates. It stores a SHA-256 hash of the access key and relays
  updates and cursors only to connections that present the right key, so a
  locked note still works for writing together.
- Ten wrong passwords block unlocking for 15 minutes. When the log grows past 100
  updates, the room asks a browser for one encrypted snapshot to replace it.
- A forgotten password can't be recovered. Removing the password sends the
  decrypted document back so the room stores it readable again.

## Run it locally

Needs Node 22.12 or newer.

```
npm install
npm run dev:worker   # the realtime Worker on http://localhost:8787
npm run dev          # the app on http://localhost:5173
```

To try the import of old notes, apply the D1 schema locally
(`npx wrangler d1 migrations apply noteful-legacy --local`) and insert a row into
`notes` with `npx wrangler d1 execute noteful-legacy --local --command "..."`.

With the Worker running, `npm run test:images` checks image uploads,
`npm run test:limits` the upload limits (`STORAGE_CHECK=1` with a tiny
`IMAGE_STORAGE_GB` in `.dev.vars` checks the ceiling),
`npm run test:history` checks version history and
self-destruct (`EXPIRY_WAIT=1` also waits for a real alarm), `npm run test:viewlink`
checks read-only links and
`npm run test:realtime` checks the locked-note rules:
nothing reaches a connection without the key, compaction, and the lockout after
wrong passwords.

## Deploy

1. New D1 tables first: `npx wrangler d1 migrations apply noteful-legacy --remote`
   (the database also holds `view_links`, `upload_counts` and `image_usage`). The R2 bucket `noteful-images` must
   exist (`npx wrangler r2 bucket create noteful-images`).
2. `npm run deploy:worker` publishes the Worker to `live.noteful.me` (host set
   in `.env.production`). Deploy it first when a change touches both.
3. Cloudflare Pages builds the app from `main` with `npm run build` (output
   `dist/`). The SPA fallback needs no config: there is no `404.html`.

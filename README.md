# notewith.me

Built by Mehmet Firat Aksoy · [mfirataksoy.com](https://mfirataksoy.com)

Shared notes with no account. Open the site, share the link, and write together
in real time: everyone's cursor shows up with their name, and edits merge
without conflicts, even after going offline for a while. Any note can be locked
with a password, which encrypts it in the browser, so the server never sees what
it says.

**Live:** https://notewith-me.netlify.app

## How it works

- **Editor:** Vue 3 and [Tiptap](https://tiptap.dev) (ProseMirror) with markdown
  shortcuts (`#`, `-`, `1.`, `[]`, `>`, ```` ``` ````), checklists, highlights and
  code blocks.
- **Real time:** the note is a [Yjs](https://yjs.dev) document (a CRDT). Each note
  is its own Cloudflare Durable Object (`worker/room.js`, built on
  `y-partyserver`) that browsers reach over WebSocket. It merges updates, relays
  cursors and stores the document in the object's SQLite storage.
- **Hosting:** Netlify serves the app (`dist/`); the Worker runs on Cloudflare.
- **Old notes:** notes from before the realtime editor are HTML in MongoDB. The
  first time an old note is opened, its room fetches the HTML from the legacy API
  (`app.js`, a Netlify Function) and hands it to that browser, which imports it.
  The legacy API is read-only now.

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

To try the import of old notes, run the legacy API too (`npm start`, needs
MongoDB on `mongodb://127.0.0.1:27017` or `MONGODB_URI`) and put
`LEGACY_API=http://localhost:2500` in `.dev.vars`.

With the Worker running, `npm run test:realtime` checks the locked-note rules:
nothing reaches a connection without the key, compaction, and the lockout after
wrong passwords.

## Deploy

1. `npm run deploy:worker` publishes the Worker to
   `notewith-me.mehmetfirataksoy.workers.dev` (host set in `.env.production`).
2. Netlify builds the app with `npm run build` (see `netlify.toml`); the legacy
   API needs `MONGODB_URI` in the site's environment variables.

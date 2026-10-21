const path = require("path");
const express = require("express");

const app = require("./app");

const port = process.env.PORT || 2500;

// Serve the built Vue app; every other path falls back to index.html so
// history-mode routes like /abc123 work on reload.
const dist = path.join(__dirname, "dist");
app.use(express.static(dist));
app.get("*", (req, res) => {
  res.sendFile(path.join(dist, "index.html"));
});

app.listen(port, () => {
  console.log(`notewith.me listening at http://localhost:${port}`);
});

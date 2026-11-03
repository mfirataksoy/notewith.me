// Where people report notes or images that shouldn't be on noteful.me. The
// note's link lets Fırat open it (and its images) and delete it.
const CONTACT = "mehmetfirataksoy@gmail.com";

export function abuseReportHref(noteUrl = "") {
  const subject = "noteful.me abuse report";
  const body = noteUrl
    ? `Note: ${noteUrl}\n\nWhat's wrong with it:\n`
    : "Link to the note:\n\nWhat's wrong with it:\n";
  return `mailto:${CONTACT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

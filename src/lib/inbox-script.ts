// The Google Apps Script each person pastes into their own Google account
// (Settings → Inbox). It runs there every morning, reads new mail in the inbox
// without Promotions and Social, and sends it to /api/inbox with their key.

export function inboxScript(appUrl: string, key: string) {
  return `// Effendy Family · inbox digest
// Runs every morning in your own Gmail and sends the new mails to the app,
// where Rialna sums them up. Only you see your digest.
// To stop: delete this project, or press "Disconnect" in the app's Settings.

const APP = ${JSON.stringify(`${appUrl.replace(/\/$/, "")}/api/inbox`)};
const KEY = ${JSON.stringify(key)};

// Run this once (choose "setup" above, then press Run).
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("sendDigest").timeBased().everyDays(1).atHour(6).inTimezone("Europe/Berlin").create();
  sendDigest();
}

function sendDigest() {
  const props = PropertiesService.getUserProperties();
  const me = Session.getActiveUser().getEmail();
  const since = Number(props.getProperty("since")) || Date.now() - 24 * 3600 * 1000;
  const threads = GmailApp.search("in:inbox -category:promotions -category:social newer_than:3d", 0, 100);
  const emails = [];
  threads.forEach(function (t) {
    t.getMessages().forEach(function (m) {
      if (m.getDate().getTime() <= since || m.isDraft()) return;
      if (me && m.getFrom().indexOf(me) >= 0) return; // your own replies
      emails.push({
        id: m.getId(),
        thread: t.getId(),
        from: m.getFrom(),
        subject: m.getSubject(),
        date: m.getDate().toISOString(),
        body: m.getPlainBody().replace(/\\s+/g, " ").slice(0, 1500),
      });
    });
  });
  emails.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  const res = UrlFetchApp.fetch(APP, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + KEY },
    payload: JSON.stringify({ account: me, emails: emails.slice(0, 60) }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() === 200) props.setProperty("since", String(Date.now()));
  console.log(res.getResponseCode() + " " + res.getContentText());
}
`;
}

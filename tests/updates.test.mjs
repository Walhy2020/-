import test from "node:test";
import assert from "node:assert/strict";
import { VersionTracker, versionLabel } from "../src/updates.js";
const A = "aaaaaaaaaaaaaaaa", B = "bbbbbbbbbbbbbbbb", C = "cccccccccccccccc";

test("visible version combines release and content build", () => {
  assert.equal(versionLabel("0.2.0", A), "v0.2.0+aaaaaaaa");
  assert.equal(versionLabel("invalid", A), "版本检测中…");
  assert.equal(versionLabel("0.2.0", "broken"), "版本检测中…");
});

test("new versions must remain stable; an initial check does not prompt", () => {
  const tracker = new VersionTracker(A);
  tracker.observe(A, 0);
  tracker.observe(B, 100);
  assert.equal(tracker.shouldPrompt, false);
  tracker.observe(C, 900);
  tracker.observe(C, 1800);
  assert.equal(tracker.shouldPrompt, false);
  tracker.observe(C, 2000);
  assert.equal(tracker.pending, C);
  assert.equal(tracker.shouldPrompt, true);
});

test("deferring a version avoids repeated popups but a later version can prompt", () => {
  const tracker = new VersionTracker(A);
  tracker.observe(B, 0); tracker.observe(B, 1100); tracker.dismiss();
  tracker.observe(B, 5000);
  assert.equal(tracker.shouldPrompt, false);
  assert.equal(tracker.pending, B);
  tracker.observe(C, 6000); tracker.observe(C, 7100);
  assert.equal(tracker.shouldPrompt, true);
  tracker.observe(A, 7200);
  assert.equal(tracker.pending, null);
});

test("missing startup metadata takes a baseline and rejects malformed responses", () => {
  const tracker = new VersionTracker(null);
  tracker.observe("<html>Server offline</html>", 0);
  assert.equal(tracker.current, null);
  tracker.observe(A, 1000);
  assert.equal(tracker.current, A);
  assert.equal(tracker.shouldPrompt, false);
});

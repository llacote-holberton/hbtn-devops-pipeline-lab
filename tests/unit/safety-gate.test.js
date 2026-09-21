'use strict';

// TEMPORARY: deliberate failure proving that a red test blocks the image
// build and the staging deploy. Reverted right after the experiment.
test('deliberate failure for safety gate', () => {
  expect(true).toBe(false);
});

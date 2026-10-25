import { expect, test } from "@playwright/test";
test("driver can prepare a real overnight trip, preview manual delay facts and restore offline", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Announcements",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Local pilot", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Trip setup", exact: true }).click();
  await page.getByLabel("Route distance (km)").fill("365");
  await page.getByLabel("Crew introduction").fill("Ravi and Arun");
  await page.getByRole("button", { name: "Add stop", exact: true }).click();
  await page.getByLabel("Stop 1 name").fill("Confirmed rest stop");
  await page
    .getByLabel("I have confirmed the actual timetable and trip details.")
    .check();
  await page.getByRole("button", { name: "Save trip", exact: true }).click();
  await expect(page.locator(".journey-route")).toContainText("365 km");
  await page
    .getByRole("button", { name: "Edit Journey briefing", exact: true })
    .click();
  await expect(page.locator(".script-copy")).toContainText("365 kilometres");
  await page
    .getByRole("button", { name: "Close preview", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit Traffic & delay", exact: true })
    .click();
  await page.getByLabel("Confirmed reason").selectOption("roadblock");
  await page.getByLabel("Delay (minutes)").fill("45");
  await expect(page.locator(".script-copy")).toContainText("road obstruction");
  await expect(page.locator(".script-copy")).toContainText("45 minutes");
  await page
    .getByRole("button", { name: "Edit announcement script", exact: true })
    .click();
  await page
    .getByLabel("Announcement script", { exact: true })
    .fill("An edited update for passengers.");
  await page
    .getByRole("button", { name: "Finish editing script", exact: true })
    .click();
  await expect(page.locator(".script-copy")).toContainText("An edited update");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator(".script-copy")).toContainText("45 minutes");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  await page.reload();
  await expect(page.locator(".journey-route")).toContainText("365 km");
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".journey-route")).toContainText("365 km");
  await expect(page.getByText("Offline", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test("custom scripts, recordings, library playback and activity work without API keys", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create custom announcement", exact: true })
    .click();
  await page.getByLabel("Announcement title").fill("Changed drop-off");
  await page
    .getByLabel("English script")
    .fill("We will stop at the confirmed drop-off.");
  await page
    .getByLabel("Malayalam script")
    .fill("ദയവായി ജീവനക്കാരുടെ നിർദ്ദേശങ്ങൾ ശ്രദ്ധിക്കുക.");
  await page
    .getByRole("button", { name: "Save announcement", exact: true })
    .click();
  await expect(page.locator(".preview-intro h2")).toHaveText(
    "Changed drop-off",
  );
  await page.getByLabel("Playback languages").selectOption("en");
  await page
    .getByRole("button", { name: "Add recording", exact: true })
    .click();
  await page.getByLabel("Recording language").selectOption("en");
  const wav = Buffer.alloc(44 + 48000);
  wav.write("RIFF");
  wav.writeUInt32LE(36 + 48000, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(24000, 24);
  wav.writeUInt32LE(48000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(48000, 40);
  await page
    .locator('input[type=file][accept="audio/*"]')
    .setInputFiles({ name: "test.wav", mimeType: "audio/wav", buffer: wav });
  await page
    .getByRole("button", { name: "Save recording", exact: true })
    .click();
  await expect(page.getByText("Offline ready", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Play announcement", exact: true })
    .click();
  await expect(page.locator(".global-player")).toBeHidden({ timeout: 10000 });
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "All tools" })
    .getByRole("button", { name: "Activity", exact: true })
    .click();
  await expect(page.getByText("played", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "All tools" })
    .getByRole("button", { name: "Audio library", exact: true })
    .click();
  await expect(
    page.getByText("Changed drop-off", { exact: true }),
  ).toBeVisible();
});
test("mobile navigation, preview dismissal, preferences and driver profiles", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Edit Welcome aboard", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Play announcement", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close preview", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page.getByRole("button", { name: "Fleet & crew", exact: true }).click();
  await page.getByRole("button", { name: "Add driver", exact: true }).click();
  await page.getByLabel("Driver name").fill("Test Driver");
  await page.getByLabel("Email address").fill("driver@example.test");
  await page
    .getByRole("button", { name: "Add driver", exact: true })
    .last()
    .click();
  await expect(page.getByText("Test Driver", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("switch", { name: "Night appearance", exact: true })
    .check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
});
test("server routes reject unauthorized voice and driver creation", async ({
  request,
}) => {
  expect(
    (
      await request.post("/api/speech", {
        data: { text: "Hello", language: "en" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (await request.post("/api/fleet/drivers", { data: {} })).status(),
  ).toBe(403);
  expect((await request.get("/api/config")).status()).toBe(200);
});

test("sample timetable stays explicit on mobile and missing voices have a recovery before playback", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByText("Sample timetable — confirm trip details", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start trip", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Set up your trip", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByText("Sample timetable — confirm trip details", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Welcome aboard", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Play announcement", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".audio-readiness")).toContainText(
    /voices? missing/,
  );
  await expect(page.locator(".playback-recovery")).toContainText(
    "Add a recording",
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Close preview", exact: true }),
  ).toBeHidden();
});

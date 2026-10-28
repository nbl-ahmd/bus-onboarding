import { expect, test } from "@playwright/test";

test("Live preparation saves separate bilingual clips, requires listening/approval, and reuses them", async ({
  page,
}) => {
  const errors: string[] = [];
  const transcripts: string[] = [];
  let sessions = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/config", (route) =>
    route.fulfill({
      json: {
        supabase: false,
        gemini: true,
        live: true,
        pilotCode: false,
        weather: false,
        voice: "Kore",
        model: "gemini-3.8-flash-lite-tts",
        liveModel: "gemini-3.8-live",
      },
    }),
  );
  await page.route("**/api/live/session", (route) => {
    sessions++;
    return route.fulfill({
      json: {
        token: "auth_tokens/fixture",
        model: "gemini-3.8-live",
        voice: "Kore",
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      },
    });
  });
  await page.routeWebSocket(/generativelanguage\.googleapis\.com/, (socket) => {
    socket.onMessage((message) => {
      const data = JSON.parse(String(message));
      if (data.setup) {
        expect(data.setup.model).toBe("models/gemini-3.8-live");
        expect(data.setup.outputAudioTranscription).toEqual({});
        socket.send(JSON.stringify({ setupComplete: {} }));
      }
      if (data.clientContent) {
        const text = data.clientContent.turns[0].parts[0].text as string;
        transcripts.push(text);
        socket.send(
          JSON.stringify({
            serverContent: {
              modelTurn: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "audio/pcm;rate=24000",
                      data: Buffer.alloc(9600).toString("base64"),
                    },
                  },
                ],
              },
              outputTranscription: { text },
              turnComplete: true,
              interactionStatus: "IDLE",
            },
          }),
        );
      }
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Edit Welcome aboard", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Prepare voice", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review your voices", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".audio-row")).toHaveCount(2);
  expect(transcripts).toHaveLength(2);
  expect(transcripts.some((text) => text.includes("സ്വാഗതം"))).toBe(true);
  expect(sessions).toBe(2); // One per language; no TTS endpoint or microphone.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.screenshot({
    path: ".impeccable/review/live-review-phone.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  const english = page.getByRole("button", {
    name: "Approve Welcome aboard in English",
    exact: true,
  });
  await expect(english).toBeDisabled();
  await page
    .getByRole("button", {
      name: "Review Welcome aboard in English",
      exact: true,
    })
    .click();
  await expect(english).toBeEnabled();
  await page
    .getByRole("button", {
      name: "Regenerate Welcome aboard in English",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("New clip saved.", { exact: false }),
  ).toBeVisible();
  await expect(english).toBeDisabled();
  await page
    .getByRole("button", {
      name: "Review Welcome aboard in English",
      exact: true,
    })
    .click();
  await expect(english).toBeEnabled();
  await english.click();
  const malayalam = page.getByRole("button", {
    name: "Approve Welcome aboard in Malayalam",
    exact: true,
  });
  await expect(malayalam).toBeDisabled();
  await page
    .getByRole("button", {
      name: "Review Welcome aboard in Malayalam",
      exact: true,
    })
    .click();
  await expect(malayalam).toBeEnabled();
  await malayalam.click();
  await expect(
    page.getByText("Approved for bus playback", { exact: true }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Announcements", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Play Welcome aboard", exact: true })
    .click();
  await expect(page.locator(".global-player")).toBeHidden({ timeout: 10000 });
  await page
    .getByRole("button", { name: "Edit Welcome aboard", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Prepare voice", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("already saved");
  expect(transcripts).toHaveLength(3); // Only the rejected English clip was regenerated.
  expect(sessions).toBe(3);
  expect(errors).toEqual([]);
});

test("a Live batch reuses sessions, pending clips survive reload, and are never bus-ready", async ({
  page,
}) => {
  let generated = 0;
  let sessions = 0;
  await page.route("**/api/config", (route) =>
    route.fulfill({
      json: {
        supabase: false,
        gemini: true,
        pilotCode: false,
        weather: false,
        voice: "Kore",
        model: "gemini-3.8-flash-lite-tts",
      },
    }),
  );
  await page.route("**/api/live/session", (route) => {
    sessions++;
    return route.fulfill({
      json: {
        token: "auth_tokens/fixture",
        model: "gemini-3.8-live",
        voice: "Kore",
      },
    });
  });
  await page.routeWebSocket(/generativelanguage\.googleapis\.com/, (socket) =>
    socket.onMessage((message) => {
      const data = JSON.parse(String(message));
      if (data.setup) socket.send(JSON.stringify({ setupComplete: {} }));
      if (data.clientContent) {
        generated++;
        socket.send(
          JSON.stringify({
            serverContent: {
              modelTurn: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "audio/pcm;rate=24000",
                      data: Buffer.alloc(9600).toString("base64"),
                    },
                  },
                ],
              },
              turnComplete: true,
            },
          }),
        );
      }
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Download trip audio", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Prepare & save audio", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review your voices", exact: true }),
  ).toBeVisible();
  expect(generated).toBe(12); // Six trip steps in each language.
  expect(sessions).toBe(2); // Six independent recordings share each language's connection.
  await page.reload();
  const row = page.locator(".quick-row").filter({
    has: page.getByRole("button", {
      name: "Play Welcome aboard",
      exact: true,
    }),
  });
  await expect(row).toContainText("Review audio");
  await page
    .getByRole("button", { name: "Play Welcome aboard", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review your voices", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Approve Welcome aboard in Malayalam",
      exact: true,
    }),
  ).toBeDisabled();
  expect(generated).toBe(12);
});

import { expect, test } from "@playwright/test";

test("a trip guides each stop, supports interruptions and preserves progress offline", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    class Utterance {
      text: string;
      lang = "";
      voice = null;
      rate = 1;
      onend?: () => void;
      constructor(text: string) {
        this.text = text;
      }
    }
    Object.assign(window, { SpeechSynthesisUtterance: Utterance });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [
          { voiceURI: "en", name: "English", lang: "en-IN" },
          { voiceURI: "ml", name: "Malayalam", lang: "ml-IN" },
        ],
        addEventListener() {},
        removeEventListener() {},
        speak(u: Utterance) {
          setTimeout(() => u.onend?.(), 10);
        },
        cancel() {},
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Trip setup", exact: true }).click();
  await page.getByRole("button", { name: "Add stop", exact: true }).click();
  await page
    .getByLabel("Stop 1 name", { exact: true })
    .fill("Pilot boarding point");
  await page.getByLabel("Stop 1 type", { exact: true }).selectOption("boarding");
  await page.getByLabel("Stop 1 time").fill("22:15");
  await page.getByRole("button", { name: "Add stop", exact: true }).click();
  await page.getByLabel("Stop 2 name", { exact: true }).fill("Pilot rest stop");
  await page
    .getByRole("button", { name: "Move stop 2 up", exact: true })
    .click();
  await expect(page.getByLabel("Stop 1 name", { exact: true })).toHaveValue(
    "Pilot rest stop",
  );
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Save trip", exact: true }).click();
  await page.getByRole("button", { name: "Start trip", exact: true }).click();
  const guide = page.getByRole("region", { name: "Guided trip" });
  await expect(
    guide.getByRole("heading", { name: "Welcome aboard", exact: true }),
  ).toBeVisible();
  await guide.getByRole("button", { name: "Play next announcement" }).click();
  await expect(
    guide.getByRole("heading", { name: "Journey summary", exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await guide
    .getByRole("button", { name: "Traffic & delay", exact: true })
    .click();
  await expect(page.locator(".global-player")).toBeHidden({ timeout: 10000 });
  await expect(
    guide.getByRole("heading", { name: "Journey summary", exact: true }),
  ).toBeVisible();
  await guide.getByRole("button", { name: "Skip", exact: true }).click();
  await guide.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(
    guide.getByRole("heading", {
      name: "Approaching Pilot rest stop",
      exact: true,
    }),
  ).toBeVisible();
  await guide.getByRole("button", { name: "Play next announcement" }).click();
  await expect(
    guide.getByRole("heading", {
      name: "Rest break at Pilot rest stop",
      exact: true,
    }),
  ).toBeVisible({ timeout: 10000 });
  await page.reload();
  await expect(
    guide.getByRole("heading", {
      name: "Rest break at Pilot rest stop",
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(
    guide.getByRole("heading", {
      name: "Rest break at Pilot rest stop",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await context.setOffline(false);
});

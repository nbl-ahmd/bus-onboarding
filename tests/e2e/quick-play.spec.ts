import { expect, test, type Page } from "@playwright/test";
async function prepareDeviceVoices(page: Page) {
  await page.addInitScript(() => {
    const observed = {
      spoken: [] as string[],
      haptics: [] as (number | number[])[],
    };
    Object.assign(window, { __pilotObserved: observed });
    class TestUtterance {
      text: string;
      lang = "";
      voice: unknown = null;
      rate = 1;
      onend: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: TestUtterance,
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: (pattern: number | number[]) => {
        observed.haptics.push(pattern);
        return true;
      },
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [
          { voiceURI: "test-en", name: "Test English", lang: "en-IN" },
          { voiceURI: "test-ml", name: "Test Malayalam", lang: "ml-IN" },
        ],
        addEventListener: () => {},
        removeEventListener: () => {},
        speak: (utterance: SpeechSynthesisUtterance) => {
          observed.spoken.push(utterance.lang);
          timer = setTimeout(
            () => utterance.onend?.(new Event("end") as SpeechSynthesisEvent),
            20,
          );
        },
        cancel: () => clearTimeout(timer),
      },
    });
  });
}
async function spoken(page: Page) {
  return page.evaluate(
    () =>
      (window as unknown as { __pilotObserved: { spoken: string[] } })
        .__pilotObserved.spoken,
  );
}

test("one tap plays English and Malayalam twice, without opening the editor", async ({
  page,
}) => {
  await prepareDeviceVoices(page);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Change playback sequence" }),
  ).toContainText("EN → ML → EN → ML");
  await page
    .getByRole("button", { name: "Play Welcome aboard", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop playback sequence" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Announcement preview" }),
  ).toBeHidden();
  await expect
    .poll(() => spoken(page))
    .toEqual(["en-IN", "ml-IN", "en-IN", "ml-IN"]);
  await expect(page.locator(".global-player")).toBeHidden();
  const feedback = await page.evaluate(
    () =>
      (window as unknown as { __pilotObserved: { haptics: unknown[] } })
        .__pilotObserved.haptics,
  );
  expect(feedback).toContain(16);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("dialog", { name: "All tools" })
    .getByRole("button", { name: "Activity", exact: true })
    .click();
  await expect(page.locator(".history-row")).toHaveCount(1);
  await expect(page.locator(".history-row")).toContainText("EN → ML → EN → ML");
  await expect(page.getByText("played", { exact: true })).toBeVisible();
});

test("grouped sequence persists and runs all of English before Malayalam", async ({
  page,
}) => {
  await prepareDeviceVoices(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Change playback sequence" }).click();
  await page.getByLabel("Playback order").selectOption("en-ml");
  await page.getByRole("button", { name: /Repeat each language/ }).click();
  await page
    .getByRole("button", { name: "Use this sequence", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Your playback sequence" }),
  ).toBeHidden();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Change playback sequence" }),
  ).toContainText("EN → EN → ML → ML");
  await page
    .getByRole("button", { name: "Play Welcome aboard", exact: true })
    .click();
  await expect
    .poll(() => spoken(page))
    .toEqual(["en-IN", "en-IN", "ml-IN", "ml-IN"]);
});

test("hold opens editing without playing, and the player swipe stops the entire sequence", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareDeviceVoices(page);
  await page.goto("/");
  const button = page.getByRole("button", {
    name: "Play Welcome aboard",
    exact: true,
  });
  await button.dispatchEvent("pointerdown", {
    pointerType: "touch",
    button: 0,
    clientX: 100,
    clientY: 300,
  });
  await expect(
    page.getByRole("dialog", { name: "Announcement preview" }),
  ).toBeVisible();
  await button.dispatchEvent("pointerup", {
    pointerType: "touch",
    button: 0,
    clientX: 100,
    clientY: 300,
  });
  await button.dispatchEvent("click", { detail: 1 });
  expect(await spoken(page)).toEqual([]);
  await page
    .getByRole("button", { name: "Close preview", exact: true })
    .click();
  await button.click();
  const player = page.locator(".global-player");
  await expect(player).toBeVisible();
  await player.dispatchEvent("pointerdown", {
    pointerType: "touch",
    button: 0,
    clientX: 300,
    clientY: 600,
  });
  await player.dispatchEvent("pointerup", {
    pointerType: "touch",
    button: 0,
    clientX: 100,
    clientY: 600,
  });
  await expect(player).toBeHidden();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("dialog", { name: "All tools" })
    .getByRole("button", { name: "Activity", exact: true })
    .click();
  await expect(page.getByText("stopped", { exact: true })).toBeVisible();
  expect((await spoken(page)).length).toBeLessThan(4);
});

test("explicit optional announcements remain one tap in quiet mode", async ({
  page,
}) => {
  await prepareDeviceVoices(page);
  await page.goto("/");
  await page.getByRole("button", { name: /^All \d+$/ }).click();
  await page
    .getByRole("button", { name: "Play Time to rest", exact: true })
    .click();
  await expect
    .poll(() => spoken(page))
    .toEqual(["en-IN", "ml-IN", "en-IN", "ml-IN"]);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("stop edits stay with their own announcement instead of changing the arrival point", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Edit Refreshment stop", exact: true })
    .click();
  await page
    .getByLabel("Stop location", { exact: true })
    .fill("Confirmed rest area");
  await page
    .getByRole("button", { name: "Close preview", exact: true })
    .click();
  await page.getByRole("button", { name: /^All \d+$/ }).click();
  await page
    .getByRole("button", { name: "Edit We’ve arrived", exact: true })
    .click();
  await expect(page.getByLabel("Drop-off point", { exact: true })).toHaveValue(
    "Bengaluru",
  );
  await expect(page.locator(".script-copy")).not.toContainText(
    "Confirmed rest area",
  );
});

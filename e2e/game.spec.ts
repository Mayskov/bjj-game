import { expect, test, type Page } from "@playwright/test";

const idle = (page: Page) => page.locator('.app[data-busy="0"]').waitFor();
async function act(page: Page, action: string) {
  await idle(page);
  await page.locator(`[data-action="${action}"]`).click();
}

const SIZES = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 360, height: 640 }
];

for (const size of SIZES) {
  test(`сцена и все действия помещаются без прокрутки — ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    // Стойка (6 кнопок), затем гард снизу и дуэль — проверяем разные наборы действий.
    await page.goto("/?botScript=breathe,breathe,breathe,breathe");
    const check = async () => {
      const scene = await page.locator(".scene").boundingBox();
      expect(scene!.height).toBeGreaterThan(150);
      expect(scene!.y).toBeGreaterThanOrEqual(0);
      for (const btn of await page.locator(".actions .act").all()) {
        const b = (await btn.boundingBox())!;
        expect(b.y + b.height).toBeLessThanOrEqual(size.height + 0.5);
        expect(b.height).toBeGreaterThanOrEqual(44);
      }
      const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflowX).toBeLessThanOrEqual(0);
      const scrollY = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
      expect(scrollY).toBeLessThanOrEqual(1);
    };
    await check();
    await act(page, "grip");
    await act(page, "pullGuard");
    await idle(page);
    await check();
    await act(page, "grip");
    await act(page, "triangle");
    await idle(page);
    await expect(page.locator(".actions .act")).toHaveCount(2);
    await check();
  });
}

test("треугольник: попытка → фиксация → дожим → сдача, окно победы после сдачи", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?botScript=grip,breathe,breathe,breathe,turn");
  await expect(page.locator(".scene")).toHaveAttribute("data-pose", "standing");
  await expect(page.getByTestId("hint")).toHaveText("Набери захват, чтобы открыть техники");
  await expect(page.locator('[data-action="pullGuard"]')).toBeDisabled();
  await act(page, "grip");
  await idle(page);
  await expect(page.locator('[data-action="pullGuard"]')).toBeEnabled();
  await act(page, "pullGuard");
  await idle(page);
  // Игрок затянул в гард: чёрный снизу (роль B), белый сверху (роль A).
  await expect(page.locator(".scene")).toHaveAttribute("data-pose", "guard");
  await expect(page.locator(".scene")).toHaveAttribute("data-roles", "bot-player");
  await expect(page.getByTestId("hint")).toContainText("Ты снизу в гарде");
  await act(page, "grip");
  await act(page, "triangle");
  await expect(page.getByTestId("grip-spinner")).toBeVisible();
  await expect(page.locator('.scene[data-phase="playerAttempt"][data-grip="0"]')).toBeVisible();
  await expect(page.locator(".scene")).toHaveAttribute("data-pose", "triangle.attempt");
  await expect(page.getByTestId("caption")).toContainText("Попытка");
  await expect(page.locator('[data-action="grip"]')).toBeDisabled();
  await expect(page.locator('.scene[data-phase="result"]')).toBeVisible();
  await expect(page.locator(".scene")).toHaveAttribute("data-pose", "triangle.locked");
  await expect(page.locator(".mark-lock")).toBeVisible();
  await expect(page.getByTestId("ind-player").first()).toHaveText(/Приём зафиксирован/);
  await expect(page.getByTestId("ind-bot").filter({ hasText: "Под угрозой" })).toBeVisible();
  await idle(page);
  await expect(page.getByTestId("hint")).toHaveText("Треугольник зафиксирован — выбери продолжение");
  await act(page, "finish");
  await expect(page.locator('.scene[data-pose="triangle.finish"]')).toBeVisible();
  await expect(page.locator('.scene[data-pose="triangle.tap"]')).toBeVisible();
  await expect(page.locator(".mark-tap")).toBeVisible();
  await expect(page.getByTestId("result")).toHaveCount(0);
  await expect(page.getByTestId("result")).toBeVisible();
  await expect(page.getByTestId("result")).toContainText("Победа!");
  await expect(page.getByTestId("result-reason")).toContainText("Треугольник");
  await page.getByTestId("rematch").click();
  await expect(page.getByTestId("exchange")).toContainText("1");
  await expect(page.locator(".scene")).toHaveAttribute("data-pose", "standing");
});

test("бот проводит удушение со спины, игрок защищается верно", async ({ page }) => {
  // 11 обменов: бот проходит в ноги и доходит до спины, на 11-м начинает удушение.
  await page.goto("/?botScript=grip,takedown,openGuard,grip,passGuard,grip,mountUp,grip,takeBack,grip,choke,finish");
  for (let i = 0; i < 12 && (await page.locator('[data-action="defendGrip"]').count()) === 0; i++) {
    await act(page, "breathe");
    await idle(page);
  }
  await expect(page.locator(".scene")).toHaveAttribute("data-pose", "choke.locked");
  await expect(page.getByTestId("exchange")).toContainText("11");
  // Бот на спине игрока: белый контролирует (роль A), чёрный защищается.
  await expect(page.locator(".scene")).toHaveAttribute("data-roles", "bot-player");
  await expect(page.getByTestId("score-bot")).toHaveText("13");
  await expect(page.getByTestId("hint")).toContainText("Ты под угрозой");
  await act(page, "defendGrip");
  await expect(page.locator('.scene[data-pose="choke.defendGrip"]')).toBeVisible();
  await expect(page.locator('.scene[data-pose="choke.finish"]')).toBeVisible();
  // Итоговый кадр: приём снят, бойцы в базовой «Спине».
  await expect(page.locator('.scene[data-pose="back"]')).toBeVisible();
  await expect(page.getByTestId("ind-player").first()).toHaveText(/Защита сработала/);
  await expect(page.getByTestId("ind-bot").first()).toHaveText(/Приём снят/);
  await idle(page);
  await expect(page.getByTestId("exchange")).toContainText("12");
});

test("двойное нажатие создаёт только один обмен", async ({ page }) => {
  await page.goto("/?botScript=breathe,breathe");
  await page.locator('[data-action="grip"]').dblclick();
  await idle(page);
  await expect(page.getByTestId("exchange")).toContainText("2");
  await expect(page.getByTestId("res-player")).toHaveText("1/6");
});

test("перезапуск во время анимации не повреждает новую игру", async ({ page }) => {
  await page.goto("/?botScript=breathe");
  await page.locator('[data-action="grip"]').click();
  await expect(page.locator('.scene[data-phase="playerAttempt"]')).toBeVisible();
  // Меню паузы останавливает показ; из него — «Начать заново».
  await page.getByTestId("menu").click();
  await page.getByTestId("restart").click();
  await page.waitForTimeout(3000);
  await expect(page.locator(".app")).toHaveAttribute("data-busy", "0");
  await expect(page.getByTestId("exchange")).toContainText("1");
  await expect(page.getByTestId("res-player")).toHaveText("0/6");
  await expect(page.getByTestId("ind-player")).toHaveCount(0);
  await expect(page.locator(".scene")).toHaveAttribute("data-pose", "standing");
});

test("цвета бойцов: чёрное ги — игрок в любой роли", async ({ page }) => {
  await page.goto("/?botScript=breathe,breathe");
  await act(page, "grip");
  await act(page, "takedown");
  await idle(page);
  // Проход игрока: игрок сверху → роль A — player.
  await expect(page.locator(".scene")).toHaveAttribute("data-roles", "player-bot");
  const torsoFill = await page.locator('[data-part="A.t"] path').first().getAttribute("fill");
  expect(torsoFill).toBe("#2a2c35");
  const botFill = await page.locator('[data-part="B.t"] path').first().getAttribute("fill");
  expect(botFill).toBe("#f7f4ec");
  await expect(page.getByTestId("score-player")).toHaveText("2");
});

test.describe("prefers-reduced-motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("последовательность этапов сохраняется", async ({ page }) => {
    await page.goto("/?botScript=frame");
    await page.evaluate(() => {
      const seen: string[] = [];
      (window as unknown as { __phases: string[] }).__phases = seen;
      const el = document.querySelector(".scene")!;
      new MutationObserver(() => {
        const p = `${el.getAttribute("data-phase")}${el.getAttribute("data-grip") === "1" ? "+grip" : ""}`;
        if (seen[seen.length - 1] !== p) seen.push(p);
      }).observe(el, { attributes: true });
    });
    await act(page, "grip");
    await page.waitForTimeout(300);
    await idle(page);
    const phases = await page.evaluate(() => (window as unknown as { __phases: string[] }).__phases);
    expect(phases).toEqual(["playerAttempt+grip", "playerAttempt", "botResponse+grip", "botResponse", "result", "idle"]);
    await expect(page.getByTestId("ind-bot").first()).toHaveText(/Рамка/);
  });
});

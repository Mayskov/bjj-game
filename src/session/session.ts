import { chooseBotAction } from "../engine/bot";
import { defaultRng, type Rng } from "../engine/rng";
import { createMatch, isLegal, resolveExchange } from "../engine/rules";
import type { ActionId, ExchangeResult, MatchState, Side } from "../engine/types";
import { baseKey, type SceneFrame } from "../visual/manifest";
import { buildIndicators, buildSequence, type Caption, type Indicator, type SequenceStep } from "./sequence";
import { timingFor, type Timing } from "./timing";

export type Phase = "idle" | "playerAttempt" | "botResponse" | "result";

export interface SessionView {
  /** Номер схватки; растёт при реванше. */
  round: number;
  /** Состояние, показанное в интерфейсе (обновляется только на кадре результата). */
  match: MatchState;
  phase: Phase;
  grip: boolean;
  busy: boolean;
  frame: SceneFrame;
  caption: Caption | null;
  indicators: Record<Side, Indicator[]>;
  showResult: boolean;
  lastResult: ExchangeResult | null;
}

export interface SessionOptions {
  rng?: Rng;
  /** Сценарий бота для проверок: действия по порядку, недоступные заменяются обычным выбором. */
  botScript?: ActionId[];
  reducedMotion?: () => boolean;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
}

interface Task {
  run: () => void;
  ms: number;
}

const EMPTY: Record<Side, Indicator[]> = { player: [], bot: [] };

export class GameSession {
  private view: SessionView;
  private truth: MatchState;
  private botPick: { key: string; action: ActionId } | null = null;
  private listeners = new Set<() => void>();
  private queue: Task[] = [];
  private timer: unknown = null;
  private due = 0;
  private remaining = 0;
  private pauses = new Set<string>();
  private generation = 0;
  private scriptIndex = 0;
  private readonly rng: Rng;
  private readonly script: ActionId[];
  private readonly reduced: () => boolean;
  private readonly now: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (id: unknown) => void;
  /** Сколько раз бот фиксировал выбор — для проверок. */
  botDecisions = 0;

  constructor(options: SessionOptions = {}) {
    this.rng = options.rng ?? defaultRng;
    this.script = options.botScript ?? [];
    this.reduced = options.reducedMotion ?? (() => false);
    this.now = options.now ?? (() => Date.now());
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = options.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
    this.truth = createMatch();
    this.view = this.freshView(0);
    this.prepareBot();
  }

  private freshView(round: number): SessionView {
    return {
      round,
      match: this.truth,
      phase: "idle",
      grip: false,
      busy: false,
      frame: { key: baseKey(this.truth), basics: [] },
      caption: null,
      indicators: EMPTY,
      showResult: false,
      lastResult: null
    };
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.view;

  get timing(): Timing {
    return timingFor(this.reduced());
  }

  private set(patch: Partial<SessionView>) {
    this.view = { ...this.view, ...patch };
    for (const fn of this.listeners) fn();
  }

  /** Бот делает скрытый выбор заранее: один раз на обмен и один раз на решающую дуэль. */
  private prepareBot() {
    const s = this.truth;
    if (s.result) {
      this.botPick = null;
      return;
    }
    const key = `${this.view.round}:${s.exchange}:${s.submission ? "duel" : "main"}`;
    if (this.botPick?.key === key) return;
    let action: ActionId | undefined;
    while (this.scriptIndex < this.script.length && action === undefined) {
      const next = this.script[this.scriptIndex++];
      if (isLegal(s, "bot", next)) action = next;
    }
    this.botPick = { key, action: action ?? chooseBotAction(s, this.rng) };
    this.botDecisions += 1;
  }

  act(action: ActionId) {
    if (this.view.busy || this.truth.result || !this.botPick) return false;
    if (!isLegal(this.truth, "player", action)) return false;
    const before = this.truth;
    const result = resolveExchange(before, action, this.botPick.action);
    this.truth = result.nextState;
    this.botPick = null;
    const steps = buildSequence(before, result);
    this.set({ busy: true, caption: null, indicators: EMPTY, lastResult: null });
    this.play(steps, result);
    return true;
  }

  private play(steps: SequenceStep[], result: ExchangeResult) {
    const t = this.timing;
    const tasks: Task[] = [];
    for (const step of steps) {
      if (step.gripBefore) {
        tasks.push({ ms: t.grip, run: () => this.set({ grip: true, phase: step.stage, caption: null }) });
      }
      const hold = step.stage === "result" ? 0 : step.stage === "playerAttempt" ? t.attempt : t.response;
      tasks.push({
        ms: hold,
        run: () => {
          if (step.stage === "result") {
            this.set({
              grip: false,
              phase: "result",
              frame: step.frame,
              caption: step.caption,
              match: this.truth,
              indicators: buildIndicators(result),
              lastResult: result
            });
          } else {
            this.set({ grip: false, phase: step.stage, frame: step.frame, caption: step.caption });
          }
        }
      });
    }
    if (this.truth.result) {
      tasks.push({ ms: 0, run: () => undefined });
      tasks[tasks.length - 2].ms = t.endDelay;
      tasks[tasks.length - 1].run = () => this.set({ busy: false, phase: "idle", showResult: true });
    } else {
      tasks[tasks.length - 1].ms = t.unlock;
      tasks.push({
        ms: 0,
        run: () => {
          this.prepareBot();
          this.set({ busy: false, phase: "idle" });
        }
      });
    }
    this.queue = tasks;
    this.runNext(this.generation);
  }

  private runNext(gen: number) {
    if (gen !== this.generation) return;
    const task = this.queue.shift();
    if (!task) return;
    task.run();
    if (!this.queue.length) return;
    this.schedule(gen, task.ms);
  }

  private schedule(gen: number, ms: number) {
    this.remaining = ms;
    if (this.pauses.size) return;
    this.due = this.now() + ms;
    this.timer = this.setTimer(() => {
      this.timer = null;
      this.runNext(gen);
    }, ms);
  }

  /** Вкладка ушла в фон — ставим показ на паузу, чтобы не пропустить кадры. */
  setHidden(hidden: boolean) {
    this.setPaused("hidden", hidden);
  }

  /** Пауза показа по причине (фон вкладки, открытое меню). Продолжается, когда причин не осталось. */
  setPaused(reason: string, on: boolean) {
    const wasPaused = this.pauses.size > 0;
    if (on) this.pauses.add(reason);
    else this.pauses.delete(reason);
    const isPaused = this.pauses.size > 0;
    if (isPaused === wasPaused) return;
    if (isPaused) {
      if (this.timer !== null) {
        this.clearTimer(this.timer);
        this.timer = null;
        this.remaining = Math.max(0, this.due - this.now());
      }
    } else if (this.queue.length && this.timer === null) {
      this.schedule(this.generation, this.remaining);
    }
  }

  restart() {
    this.generation += 1;
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    this.queue = [];
    this.truth = createMatch();
    this.botPick = null;
    this.view = this.freshView(this.view.round + 1);
    this.prepareBot();
    this.set({});
  }

  closeResult() {
    this.set({ showResult: false });
  }

  /** Только для проверок: заранее зафиксированный выбор бота. */
  peekBotPickForTests() {
    return this.botPick;
  }
}

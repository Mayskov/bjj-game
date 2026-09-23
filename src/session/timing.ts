/** Длительности показа обмена, мс. */
export interface Timing {
  /** Круговая анимация борьбы за захват между кадрами. */
  grip: number;
  /** Кадр попытки игрока. */
  attempt: number;
  /** Кадр ответа бота. */
  response: number;
  /** Плавный переход поз. */
  tween: number;
  /** Пауза перед разблокировкой ввода после итога. */
  unlock: number;
  /** Сколько показывать сдачу/итог перед окном результата. */
  endDelay: number;
}

export const TIMING: Timing = {
  grip: 380,
  attempt: 900,
  response: 900,
  tween: 320,
  unlock: 250,
  endDelay: 1800
};

/** При prefers-reduced-motion последовательность та же, но без вращения и морфинга поз. */
export const REDUCED_TIMING: Timing = {
  grip: 250,
  attempt: 900,
  response: 900,
  tween: 0,
  unlock: 250,
  endDelay: 1800
};

export function timingFor(reduced: boolean): Timing {
  return reduced ? REDUCED_TIMING : TIMING;
}

import type { Side } from "../engine/types";

export interface FighterPalette {
  gi: string;
  giShade: string;
  giHi: string;
  lapel: string;
  outline: string;
  belt: string;
  beltEdge: string;
  skin: string;
  skinShade: string;
  hair: string;
  eye: string;
}

/** Игрок — чёрное ги, бот — белое ги. Внешность постоянна во всех кадрах. */
export const PALETTES: Record<Side, FighterPalette> = {
  player: {
    gi: "#2a2c35",
    giShade: "#1a1b21",
    giHi: "#555a6b",
    lapel: "#40434f",
    outline: "#08080b",
    belt: "#7a3fb8",
    beltEdge: "#3e1c63",
    skin: "#c98e62",
    skinShade: "#a5714b",
    hair: "#1b1410",
    eye: "#1b1410"
  },
  bot: {
    gi: "#f7f4ec",
    giShade: "#d8d1c1",
    giHi: "#ffffff",
    lapel: "#e2dac8",
    outline: "#525a6c",
    belt: "#2f6fd6",
    beltEdge: "#173a78",
    skin: "#f1c9a3",
    skinShade: "#d2a47d",
    hair: "#8a5a2b",
    eye: "#3a2616"
  }
};

export const SIDE_LABEL: Record<Side, string> = {
  player: "Ты · чёрное ги",
  bot: "Бот · белое ги"
};

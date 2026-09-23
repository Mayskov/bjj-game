import { DojoBackdrop } from "../visual/Dojo";
import { FighterLayer } from "../visual/FighterLayer";
import { POSES } from "../visual/poses";
import { buildFramePose } from "../visual/scenePose";

/** Служебная галерея поз для визуальной проверки: ?gallery */
export function Gallery() {
  const filter = new URLSearchParams(window.location.search).get("gallery") || "";
  const ids = Object.keys(POSES).filter((id) => !filter || id.startsWith(filter));
  return (
    <div style={{ ["--gw" as string]: (new URLSearchParams(window.location.search).get("w") || "400") + "px", display: "grid", gridTemplateColumns: "repeat(2, var(--gw, 400px))", gap: 6, padding: 6, background: "#222" }}>
      {ids.flatMap((id) =>
        [false, true].map((swap) => {
          const sides = swap ? ({ A: "bot", B: "player" } as const) : ({ A: "player", B: "bot" } as const);
          const pose = buildFramePose(POSES[id], swap);
          return (
            <figure key={id + swap} style={{ margin: 0, color: "#fff", font: "12px sans-serif" }}>
              <svg viewBox="60 40 280 200" width="100%" style={{ display: "block", width: "var(--gw, 400px)", height: "auto" }}>
                <DojoBackdrop />
                <FighterLayer pose={pose} sides={sides} />
              </svg>
              <figcaption>
                {id} — A={sides.A} {swap ? "(mirrored)" : ""}
              </figcaption>
            </figure>
          );
        })
      )}
    </div>
  );
}

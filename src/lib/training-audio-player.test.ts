import { describe, expect, it } from "vitest";
import {
  interpretPlayRejection,
  isMediaReadyEnough,
  mapAudioFailureToMessage,
  playButtonAriaLabel,
  reduceAudioLifecycleEvent,
  shouldEnablePlayButton,
  shouldPreservePlaybackAcrossRender,
  shouldReloadSource,
  trainingAudioStatusLabel,
} from "@/lib/training-audio-player";

describe("training audio player readiness", () => {
  it("treats immediately available media (readyState >= 2) as playable", () => {
    expect(isMediaReadyEnough(0)).toBe(false);
    expect(isMediaReadyEnough(1)).toBe(false);
    expect(isMediaReadyEnough(2)).toBe(true);
    expect(isMediaReadyEnough(4)).toBe(true);
    expect(shouldEnablePlayButton("ready")).toBe(true);
    expect(shouldEnablePlayButton("loading")).toBe(false);
  });

  it("keeps play disabled while the source is still delayed / loading", () => {
    expect(reduceAudioLifecycleEvent("ready", "source_change")).toBe("loading");
    expect(reduceAudioLifecycleEvent("loading", "loadstart")).toBe("loading");
    expect(reduceAudioLifecycleEvent("loading", "loadedmetadata")).toBe("loading");
    expect(reduceAudioLifecycleEvent("loading", "canplay")).toBe("ready");
    expect(shouldEnablePlayButton(reduceAudioLifecycleEvent("loading", "stalled"))).toBe(false);
    expect(trainingAudioStatusLabel("loading")).toBe("Chargement de l’audio…");
  });

  it("maps first play() NotSupportedError before ready to loading, not a raw crash", () => {
    const result = interpretPlayRejection({
      rejection: { name: "NotSupportedError", message: "The element has no supported sources." },
      readyState: 0,
      intentionalStop: false,
    });
    expect(result.ignore).toBe(false);
    expect(result.nextStatus).toBe("loading");
    expect(result.message).toMatch(/pas encore prêt|Réessayez/i);
    expect(result.message).not.toMatch(/NotSupportedError/);
  });

  it("supports a successful retry path after a recoverable failure", () => {
    expect(shouldReloadSource({ reason: "user_retry", autoAttempts: 99 })).toBe(true);
    expect(reduceAudioLifecycleEvent("error", "source_change")).toBe("loading");
    expect(reduceAudioLifecycleEvent("loading", "canplaythrough")).toBe("ready");
    expect(shouldEnablePlayButton("ready")).toBe(true);
    expect(playButtonAriaLabel("ready")).toBe("Lecture");
  });

  it("surfaces a definitive error for unsupported / missing sources", () => {
    const afterReadyFailure = interpretPlayRejection({
      rejection: { name: "NotSupportedError" },
      readyState: 4,
      intentionalStop: false,
    });
    expect(afterReadyFailure.nextStatus).toBe("error");
    expect(afterReadyFailure.message).toMatch(/non pris en charge|indisponible/i);

    expect(mapAudioFailureToMessage({ mediaErrorCode: 4 })).toMatch(/introuvable|non support/i);
    expect(reduceAudioLifecycleEvent("ready", "error")).toBe("error");
    expect(shouldEnablePlayButton("error")).toBe(false);
  });

  it("preserves playback across rapid activity re-renders with same id/url (autosave)", () => {
    expect(
      shouldPreservePlaybackAcrossRender({
        prevActivityId: "GA-A1-M03-H01",
        nextActivityId: "GA-A1-M03-H01",
        prevUrl: "/exam-media/ga-a1-m03/hoeren-einkaufen.mp3",
        nextUrl: "/exam-media/ga-a1-m03/hoeren-einkaufen.mp3",
      }),
    ).toBe(true);

    expect(
      shouldPreservePlaybackAcrossRender({
        prevActivityId: "GA-A1-M03-H01",
        nextActivityId: "GA-A1-M03-H02",
        prevUrl: "/exam-media/ga-a1-m03/hoeren-einkaufen.mp3",
        nextUrl: "/exam-media/ga-a1-m03/hoeren-einkaufen.mp3",
      }),
    ).toBe(false);
  });

  it("does not auto-loop reloads; only user retry / source change reload", () => {
    expect(shouldReloadSource({ reason: "auto", autoAttempts: 0, maxAutoAttempts: 0 })).toBe(
      false,
    );
    expect(shouldReloadSource({ reason: "auto", autoAttempts: 0, maxAutoAttempts: 1 })).toBe(true);
    expect(shouldReloadSource({ reason: "auto", autoAttempts: 1, maxAutoAttempts: 1 })).toBe(false);
    expect(shouldReloadSource({ reason: "source_change", autoAttempts: 0 })).toBe(true);
  });

  it("exposes an accessible loading label suitable for mobile and screen readers", () => {
    expect(trainingAudioStatusLabel("loading")).toBe("Chargement de l’audio…");
    expect(playButtonAriaLabel("loading")).toMatch(/chargement/i);
    expect(playButtonAriaLabel("playing")).toBe("Pause");
  });

  it("ignores AbortError from intentional pause / navigation", () => {
    const result = interpretPlayRejection({
      rejection: { name: "AbortError" },
      readyState: 4,
      intentionalStop: true,
    });
    expect(result.ignore).toBe(true);
  });

  it("keeps playing status through buffer waits without forcing a remount-like loading lock", () => {
    expect(reduceAudioLifecycleEvent("playing", "waiting")).toBe("playing");
    expect(reduceAudioLifecycleEvent("playing", "stalled")).toBe("playing");
    expect(reduceAudioLifecycleEvent("playing", "canplay")).toBe("playing");
  });
});

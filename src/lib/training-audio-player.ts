/**
 * Pure helpers for the shared training Hören audio player.
 * Keeps load/play/retry rules testable without DOM flakiness.
 */

/** HTMLMediaElement.HAVE_CURRENT_DATA — enough buffered to begin playback. */
export const MEDIA_READY_THRESHOLD = 2;

export type TrainingAudioUiStatus =
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "error";

export type TrainingAudioPlayRejection = {
  name: string;
  message?: string;
};

export function isMediaReadyEnough(readyState: number): boolean {
  return Number.isFinite(readyState) && readyState >= MEDIA_READY_THRESHOLD;
}

export function trainingAudioStatusLabel(status: TrainingAudioUiStatus): string {
  switch (status) {
    case "loading":
      return "Chargement de l’audio…";
    case "ready":
      return "Audio prêt";
    case "playing":
      return "Lecture en cours";
    case "paused":
      return "En pause";
    case "error":
      return "Impossible de charger l’audio";
  }
}

export function shouldEnablePlayButton(status: TrainingAudioUiStatus): boolean {
  return status === "ready" || status === "playing" || status === "paused";
}

export function playButtonAriaLabel(status: TrainingAudioUiStatus): string {
  if (status === "playing") return "Pause";
  if (status === "loading") return "Lecture indisponible — chargement";
  if (status === "error") return "Lecture indisponible — erreur";
  return "Lecture";
}

/**
 * Map media element / play() failures to a short FR message.
 * Never expose raw DOMException names to the learner.
 */
export function mapAudioFailureToMessage(input: {
  playRejection?: TrainingAudioPlayRejection | null;
  mediaErrorCode?: number | null;
  readyState?: number;
}): string {
  const name = input.playRejection?.name ?? "";
  if (name === "NotAllowedError") {
    return "La lecture a été bloquée. Touchez Lecture une nouvelle fois.";
  }
  if (name === "AbortError") {
    return "Lecture interrompue. Vous pouvez réessayer.";
  }
  if (name === "NotSupportedError") {
    if (!isMediaReadyEnough(input.readyState ?? 0)) {
      return "L’audio n’est pas encore prêt. Patientez ou réessayez.";
    }
    return "Format audio non pris en charge ou source indisponible.";
  }
  // MEDIA_ERR_* codes: 1 aborted, 2 network, 3 decode, 4 src not supported
  if (input.mediaErrorCode === 2) {
    return "Réseau interrompu pendant le chargement. Réessayez.";
  }
  if (input.mediaErrorCode === 3) {
    return "Impossible de décoder l’audio. Réessayez ou contactez le support.";
  }
  if (input.mediaErrorCode === 4) {
    return "Source audio introuvable ou non supportée.";
  }
  return "Impossible de lire l’audio. Vérifiez votre connexion puis réessayez.";
}

export function reduceAudioLifecycleEvent(
  status: TrainingAudioUiStatus,
  event:
    | "loadstart"
    | "loadedmetadata"
    | "canplay"
    | "canplaythrough"
    | "playing"
    | "pause"
    | "ended"
    | "error"
    | "stalled"
    | "waiting"
    | "source_change",
): TrainingAudioUiStatus {
  switch (event) {
    case "source_change":
    case "loadstart":
      return "loading";
    case "loadedmetadata":
      return status === "playing" ? "playing" : status === "error" ? "error" : "loading";
    case "canplay":
    case "canplaythrough":
      if (status === "playing") return "playing";
      if (status === "paused") return "paused";
      if (status === "error") return "error";
      return "ready";
    case "playing":
      return "playing";
    case "pause":
      return status === "loading" || status === "error" ? status : "paused";
    case "ended":
      return "paused";
    case "waiting":
    case "stalled":
      return status === "playing" ? "playing" : "loading";
    case "error":
      return "error";
    default:
      return status;
  }
}

/**
 * Decide how to treat a rejected play() promise.
 * AbortError while pausing/navigating away is ignored.
 */
export function interpretPlayRejection(input: {
  rejection: TrainingAudioPlayRejection;
  readyState: number;
  intentionalStop: boolean;
}): {
  ignore: boolean;
  nextStatus: TrainingAudioUiStatus;
  message: string | null;
} {
  if (input.intentionalStop || input.rejection.name === "AbortError") {
    return { ignore: true, nextStatus: "paused", message: null };
  }
  if (
    input.rejection.name === "NotSupportedError" &&
    !isMediaReadyEnough(input.readyState)
  ) {
    return {
      ignore: false,
      nextStatus: "loading",
      message: mapAudioFailureToMessage({
        playRejection: input.rejection,
        readyState: input.readyState,
      }),
    };
  }
  return {
    ignore: false,
    nextStatus: "error",
    message: mapAudioFailureToMessage({
      playRejection: input.rejection,
      readyState: input.readyState,
    }),
  };
}

/** User-initiated reload only — never auto-loop. */
export function shouldReloadSource(input: {
  reason: "user_retry" | "source_change" | "auto";
  autoAttempts: number;
  maxAutoAttempts?: number;
}): boolean {
  if (input.reason === "user_retry" || input.reason === "source_change") return true;
  const max = input.maxAutoAttempts ?? 0;
  return input.autoAttempts < max;
}

/**
 * Autosave / answer invalidation must not force an audio remount when the
 * activity id and url are unchanged.
 */
export function shouldPreservePlaybackAcrossRender(input: {
  prevActivityId: string;
  nextActivityId: string;
  prevUrl: string;
  nextUrl: string;
}): boolean {
  return input.prevActivityId === input.nextActivityId && input.prevUrl === input.nextUrl;
}

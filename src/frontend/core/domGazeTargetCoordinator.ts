import { readonly, ref, type Ref } from "vue";
import { resolveGazeTarget, type GazeTargetCandidate } from "./gazeTargetResolver";

export type DomGazeTargetRegistration = {
  id: string;
  element: () => HTMLElement | undefined;
  enabled: () => boolean;
  hitPadding: () => number;
  priority: () => number;
};

const registrations = new Map<string, DomGazeTargetRegistration>();
const activeTargetId = ref<string>();
let pointerRef: Ref<GazePoint> | undefined;
let frame = 0;

function isVisible(element: HTMLElement, rect: DOMRect) {
  return element.isConnected && rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden";
}

function collectCandidates() {
  const candidates: GazeTargetCandidate[] = [];
  for (const registration of registrations.values()) {
    const element = registration.element();
    if (!element) continue;
    const rect = element.getBoundingClientRect();
    candidates.push({
      id: registration.id,
      rect,
      enabled: registration.enabled(),
      visible: isVisible(element, rect),
      hitPadding: Math.max(0, registration.hitPadding()),
      priority: registration.priority()
    });
  }
  return candidates;
}

function tick() {
  const pointer = pointerRef?.value;
  activeTargetId.value = pointer?.valid
    ? resolveGazeTarget(collectCandidates(), pointer)?.id
    : undefined;
  frame = window.requestAnimationFrame(tick);
}

function start(pointer: Ref<GazePoint>) {
  pointerRef = pointer;
  if (frame) return;
  frame = window.requestAnimationFrame(tick);
}

function stop() {
  if (registrations.size > 0) return;
  window.cancelAnimationFrame(frame);
  frame = 0;
  pointerRef = undefined;
  activeTargetId.value = undefined;
}

export function registerDomGazeTarget(registration: DomGazeTargetRegistration, pointer: Ref<GazePoint>) {
  registrations.set(registration.id, registration);
  start(pointer);
  return () => {
    registrations.delete(registration.id);
    if (activeTargetId.value === registration.id) activeTargetId.value = undefined;
    stop();
  };
}

export const activeDomGazeTargetId = readonly(activeTargetId);

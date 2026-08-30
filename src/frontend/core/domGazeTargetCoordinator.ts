import { readonly, ref, type Ref } from "vue";
import {
  resolveGazeTarget,
  type GazeTargetCandidate,
  type GazeTargetRect,
} from "./gazeTargetResolver";

export type DomGazeTargetRegistration = {
  id: string;
  element: () => HTMLElement | undefined;
  enabled: () => boolean;
  hitPadding: () => number;
  priority: () => number;
  /**
   * Рамка нарисованной фигуры, если она не совпадает с боксом элемента.
   * Видимость по-прежнему считается по самому элементу: пустой контейнер
   * не должен становиться целью только потому, что внутри что-то торчит.
   */
  shape?: () => GazeTargetRect | undefined;
};

const registrations = new Map<string, DomGazeTargetRegistration>();
const activeTargetId = ref<string>();
let pointerRef: Ref<GazePoint> | undefined;
let frame = 0;

function isVisible(element: HTMLElement, rect: DOMRect) {
  return (
    element.isConnected &&
    rect.width > 0 &&
    rect.height > 0 &&
    getComputedStyle(element).visibility !== "hidden"
  );
}

function collectCandidates() {
  const candidates: GazeTargetCandidate[] = [];
  for (const registration of registrations.values()) {
    const element = registration.element();
    if (!element) continue;
    const box = element.getBoundingClientRect();
    candidates.push({
      id: registration.id,
      rect: registration.shape?.() ?? box,
      enabled: registration.enabled(),
      visible: isVisible(element, box),
      hitPadding: Math.max(0, registration.hitPadding()),
      priority: registration.priority(),
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

export function registerDomGazeTarget(
  registration: DomGazeTargetRegistration,
  pointer: Ref<GazePoint>,
) {
  registrations.set(registration.id, registration);
  start(pointer);
  return () => {
    registrations.delete(registration.id);
    if (activeTargetId.value === registration.id) activeTargetId.value = undefined;
    stop();
  };
}

/**
 * Снимок всех зарегистрированных зон взгляда: то, по чему на самом деле
 * считается попадание. Нужен приёмке — иначе проверить, что зона совпадает
 * с нарисованным, можно только повторив вычисление снаружи, то есть никак.
 */
export type GazeTargetSnapshotEntry = GazeTargetCandidate & { element: HTMLElement };

export function gazeTargetSnapshot(): GazeTargetSnapshotEntry[] {
  const snapshot: GazeTargetSnapshotEntry[] = [];
  for (const registration of registrations.values()) {
    const element = registration.element();
    if (!element) continue;
    const box = element.getBoundingClientRect();
    snapshot.push({
      id: registration.id,
      rect: registration.shape?.() ?? box,
      enabled: registration.enabled(),
      visible: isVisible(element, box),
      hitPadding: Math.max(0, registration.hitPadding()),
      priority: registration.priority(),
      element,
    });
  }
  return snapshot;
}

export const activeDomGazeTargetId = readonly(activeTargetId);

export function isCanvasControlBlocked(point: { x: number; y: number }) {
  if (activeTargetId.value) return true;
  if (typeof document.elementsFromPoint !== "function") return false;
  return document
    .elementsFromPoint(point.x, point.y)
    .some((element) => Boolean(element.closest("[data-canvas-overlay]")));
}

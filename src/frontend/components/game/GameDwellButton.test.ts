import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gazeTargetSnapshot } from "../../core/domGazeTargetCoordinator";
import GameDwellButton from "./GameDwellButton.vue";

describe("GameDwellButton", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  // Games key cards by item id, so a card that stays on the next screen keeps
  // its component and only gets a new target-id (feed-animal, round 2).
  it("re-registers its gaze target when target-id changes", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const targetId = ref("feed-animal:round-1:food:fish");
    const root = document.createElement("div");
    document.body.append(root);
    const app = createApp(
      defineComponent({
        setup: () => () => h(GameDwellButton, { targetId: targetId.value }),
      }),
    );
    app.mount(root);
    const ids = () => gazeTargetSnapshot().map((entry) => entry.id);

    expect(ids()).toContain("feed-animal:round-1:food:fish");

    targetId.value = "feed-animal:round-2:food:fish";
    await nextTick();

    expect(ids()).toContain("feed-animal:round-2:food:fish");
    expect(ids()).not.toContain("feed-animal:round-1:food:fish");

    app.unmount();
    expect(ids()).not.toContain("feed-animal:round-2:food:fish");
  });
});

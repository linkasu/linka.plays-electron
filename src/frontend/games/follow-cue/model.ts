export function isFollowCueHintVisible(isTarget: boolean, cueStrength: number) {
  return isTarget && cueStrength > 0;
}

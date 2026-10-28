/**
 * A shop's story is complete when it has its text, village or town, state
 * and at least one photo. Products cannot publish until it is.
 */
export function isShopStoryComplete(story: {
  homePlace: null | string;
  homeState: null | string;
  images: number;
  story: null | string;
}): boolean {
  return Boolean(
    story.story && story.homePlace && story.homeState && story.images > 0,
  );
}

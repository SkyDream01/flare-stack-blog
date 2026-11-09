import { useRouteContext } from "@tanstack/react-router";
import { getThemeAvatar } from "@/features/theme/site-config.helpers";
import {
  getPublicImageSrc,
  PUBLIC_IMAGE_WIDTH,
} from "@/features/media/utils/media.utils";

/** The author's avatar, as it heads a Moment and the box that writes one. */
export function MomentAvatar() {
  const { siteConfig } = useRouteContext({ from: "__root__" });
  return (
    <img
      src={getPublicImageSrc(
        getThemeAvatar(siteConfig),
        PUBLIC_IMAGE_WIDTH.avatar,
      )}
      alt=""
      width={40}
      height={40}
      className="size-10 shrink-0 rounded-full object-cover"
    />
  );
}

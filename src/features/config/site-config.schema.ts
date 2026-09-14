import { z } from "zod";
import type { Messages } from "@/lib/i18n";
import {
  canonicalizeNavHref,
  isNavHref,
  NAV_LINK_LABEL_MAX,
  NAV_LINKS_MAX,
} from "./utils/nav-links";
import { SOCIAL_PLATFORM_KEYS } from "./utils/social-platforms";

const SocialLinkSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORM_KEYS),
  url: z.string(),
  icon: z.string().optional(),
  label: z.string().optional(),
});

export const FUWARI_THEME_HUE_MIN = 0;
export const FUWARI_THEME_HUE_MAX = 360;
export const DEFAULT_THEME_OPACITY_MIN = 0;
export const DEFAULT_THEME_OPACITY_MAX = 0.4;
export const DEFAULT_THEME_BLUR_MIN = 0;
export const DEFAULT_THEME_BLUR_MAX = 32;
export const DEFAULT_THEME_TRANSITION_MIN = 0;
export const DEFAULT_THEME_TRANSITION_MAX = 1500;
export const CUCKOO_THEME_HUE_MIN = 0;
export const CUCKOO_THEME_HUE_MAX = 360;

function createSiteTextSchema(max: number) {
  return z.string().trim().max(max);
}

const NavLinkSchema = z.object({
  label: createSiteTextSchema(NAV_LINK_LABEL_MAX).pipe(z.string().min(1)),
  href: z.string().trim().refine(isNavHref, {
    message: "Please enter a root-relative path or http(s) URL",
  }),
});

function createNavLinksFormSchema(messages: Messages) {
  return z
    .array(
      z.object({
        label: z.string(),
        href: z.string(),
      }),
    )
    .max(NAV_LINKS_MAX)
    .transform((links) =>
      links.map((link) => ({
        label: link.label.trim(),
        href: canonicalizeNavHref(link.href),
      })),
    )
    .superRefine((links, ctx) => {
      links.forEach((link, index) => {
        if (!link.label && !link.href) return;
        if (!link.label) {
          ctx.addIssue({
            code: "custom",
            message: messages.settings_site_validation_nav_label_required(),
            path: [index, "label"],
          });
        } else if (link.label.length > NAV_LINK_LABEL_MAX) {
          ctx.addIssue({
            code: "custom",
            message: messages.settings_site_validation_too_long({
              max: NAV_LINK_LABEL_MAX,
            }),
            path: [index, "label"],
          });
        }
        if (!link.href) {
          ctx.addIssue({
            code: "custom",
            message: messages.settings_site_validation_nav_href_required(),
            path: [index, "href"],
          });
        } else if (!isNavHref(link.href)) {
          ctx.addIssue({
            code: "custom",
            message: messages.settings_site_validation_invalid_nav_href(),
            path: [index, "href"],
          });
        }
      });
    });
}

function createSiteTextFormSchema(max: number, messages: Messages) {
  return z
    .string()
    .trim()
    .max(max, messages.settings_site_validation_too_long({ max }));
}

function createAssetRefSchema() {
  return z.string().refine((value) => value === "" || value.startsWith("/"), {
    message: "Please enter a root-relative path",
  });
}

function createAssetRefFormSchema(messages: Messages) {
  return z.string().refine((value) => value === "" || value.startsWith("/"), {
    message: messages.settings_site_validation_invalid_asset_ref(),
  });
}

function isExternalImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function createBackgroundImageRefSchema() {
  return z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" || value.startsWith("/") || isExternalImageUrl(value),
      {
        message: "Please enter a root-relative path or http(s) URL",
      },
    );
}

function createBackgroundImageRefFormSchema(messages: Messages) {
  return z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" || value.startsWith("/") || isExternalImageUrl(value),
      {
        message:
          messages.settings_site_validation_invalid_background_image_ref(),
      },
    );
}

function createAssetPathSchema() {
  return z.string().refine((value) => value.startsWith("/"), {
    message: "Please enter a root-relative path",
  });
}

function createAssetPathFormSchema(messages: Messages) {
  return z.string().refine((value) => value.startsWith("/"), {
    message: messages.settings_site_validation_invalid_asset_path(),
  });
}

function createOptionalAssetPathSchema() {
  return z.union([createAssetPathSchema(), z.literal("")]);
}

function createOptionalAssetPathFormSchema(messages: Messages) {
  return z.union([createAssetPathFormSchema(messages), z.literal("")]);
}

function createHueSchema() {
  return z
    .number()
    .int()
    .min(FUWARI_THEME_HUE_MIN)
    .max(FUWARI_THEME_HUE_MAX, {
      message: `Value must be between ${FUWARI_THEME_HUE_MIN} and ${FUWARI_THEME_HUE_MAX}`,
    });
}

function createHueFormSchema(messages: Messages) {
  return z.number().int().min(FUWARI_THEME_HUE_MIN).max(FUWARI_THEME_HUE_MAX, {
    message: messages.settings_site_validation_hue_range(),
  });
}

function createOpacitySchema() {
  return z
    .number()
    .min(DEFAULT_THEME_OPACITY_MIN)
    .max(DEFAULT_THEME_OPACITY_MAX);
}

function createOpacityFormSchema(messages: Messages) {
  return z
    .number()
    .min(DEFAULT_THEME_OPACITY_MIN)
    .max(
      DEFAULT_THEME_OPACITY_MAX,
      messages.settings_site_validation_opacity_range(),
    );
}

function createBlurSchema() {
  return z
    .number()
    .int()
    .min(DEFAULT_THEME_BLUR_MIN)
    .max(DEFAULT_THEME_BLUR_MAX);
}

function createBlurFormSchema(messages: Messages) {
  return z
    .number()
    .int()
    .min(DEFAULT_THEME_BLUR_MIN)
    .max(
      DEFAULT_THEME_BLUR_MAX,
      messages.settings_site_validation_blur_range(),
    );
}

function createTransitionDurationSchema() {
  return z
    .number()
    .int()
    .min(DEFAULT_THEME_TRANSITION_MIN)
    .max(DEFAULT_THEME_TRANSITION_MAX);
}

function createTransitionDurationFormSchema(messages: Messages) {
  return z
    .number()
    .int()
    .min(DEFAULT_THEME_TRANSITION_MIN)
    .max(
      DEFAULT_THEME_TRANSITION_MAX,
      messages.settings_site_validation_transition_range(),
    );
}

function createDefaultThemeBackgroundSchema() {
  return z.object({
    homeImage: createBackgroundImageRefSchema(),
    globalImage: createBackgroundImageRefSchema(),
    light: z.object({ opacity: createOpacitySchema() }),
    dark: z.object({ opacity: createOpacitySchema() }),
    backdropBlur: createBlurSchema(),
    transitionDuration: createTransitionDurationSchema(),
  });
}

function createDefaultThemeBackgroundInputSchema() {
  return z.object({
    homeImage: createBackgroundImageRefSchema().optional(),
    globalImage: createBackgroundImageRefSchema().optional(),
    light: z.object({ opacity: createOpacitySchema().optional() }).optional(),
    dark: z.object({ opacity: createOpacitySchema().optional() }).optional(),
    backdropBlur: createBlurSchema().optional(),
    transitionDuration: createTransitionDurationSchema().optional(),
  });
}

function createDefaultThemeBackgroundInputFormSchema(messages: Messages) {
  return z.object({
    homeImage: createBackgroundImageRefFormSchema(messages).optional(),
    globalImage: createBackgroundImageRefFormSchema(messages).optional(),
    light: z
      .object({ opacity: createOpacityFormSchema(messages).optional() })
      .optional(),
    dark: z
      .object({ opacity: createOpacityFormSchema(messages).optional() })
      .optional(),
    backdropBlur: createBlurFormSchema(messages).optional(),
    transitionDuration: createTransitionDurationFormSchema(messages).optional(),
  });
}

function createDefaultThemeSiteConfigSchema() {
  return z.object({
    navBarName: createSiteTextSchema(60),
    background: createDefaultThemeBackgroundSchema().optional(),
  });
}

function createDefaultThemeSiteConfigInputSchema() {
  return z.object({
    navBarName: createSiteTextSchema(60).optional(),
    background: createDefaultThemeBackgroundInputSchema().optional(),
  });
}

function createDefaultThemeSiteConfigInputFormSchema(messages: Messages) {
  return z.object({
    navBarName: createSiteTextFormSchema(60, messages).optional(),
    background:
      createDefaultThemeBackgroundInputFormSchema(messages).optional(),
  });
}

function createCuckooThemeSiteConfigSchema() {
  return z.object({
    bg: createBackgroundImageRefSchema(),
    avatar: createAssetRefSchema(),
    sidebarBg: createBackgroundImageRefSchema(),
    primaryHue: createHueSchema(),
    defaultCover: createBackgroundImageRefSchema(),
  });
}

function createCuckooThemeSiteConfigInputSchema() {
  return z.object({
    bg: createBackgroundImageRefSchema().optional(),
    avatar: createAssetRefSchema().optional(),
    sidebarBg: createBackgroundImageRefSchema().optional(),
    primaryHue: createHueSchema().optional(),
    defaultCover: createBackgroundImageRefSchema().optional(),
  });
}

function createCuckooThemeSiteConfigInputFormSchema(messages: Messages) {
  return z.object({
    bg: createBackgroundImageRefFormSchema(messages).optional(),
    avatar: createAssetRefFormSchema(messages).optional(),
    sidebarBg: createBackgroundImageRefFormSchema(messages).optional(),
    primaryHue: createHueFormSchema(messages).optional(),
    defaultCover: createBackgroundImageRefFormSchema(messages).optional(),
  });
}

function createFuwariThemeSiteConfigSchema() {
  return z.object({
    homeBg: createBackgroundImageRefSchema(),
    avatar: createAssetRefSchema(),
    primaryHue: createHueSchema(),
  });
}

function createFuwariThemeSiteConfigInputSchema() {
  return z.object({
    homeBg: createBackgroundImageRefSchema().optional(),
    avatar: createAssetRefSchema().optional(),
    primaryHue: createHueSchema().optional(),
  });
}

function createFuwariThemeSiteConfigInputFormSchema(messages: Messages) {
  return z.object({
    homeBg: createBackgroundImageRefFormSchema(messages).optional(),
    avatar: createAssetRefFormSchema(messages).optional(),
    primaryHue: createHueFormSchema(messages).optional(),
  });
}

export const fuwariThemeSiteConfigSchema = createFuwariThemeSiteConfigSchema();
export const fuwariThemeSiteConfigInputSchema =
  createFuwariThemeSiteConfigInputSchema();
export const defaultThemeBackgroundSchema =
  createDefaultThemeBackgroundSchema();
export const defaultThemeBackgroundInputSchema =
  createDefaultThemeBackgroundInputSchema();
export const defaultThemeSiteConfigSchema =
  createDefaultThemeSiteConfigSchema();
export const defaultThemeSiteConfigInputSchema =
  createDefaultThemeSiteConfigInputSchema();
export const cuckooThemeSiteConfigSchema = createCuckooThemeSiteConfigSchema();
export const cuckooThemeSiteConfigInputSchema =
  createCuckooThemeSiteConfigInputSchema();

export const FullSiteConfigSchema = z.object({
  title: createSiteTextSchema(120),
  author: createSiteTextSchema(80),
  description: createSiteTextSchema(300),
  social: z.array(SocialLinkSchema),
  navLinks: z.array(NavLinkSchema).max(NAV_LINKS_MAX),
  icons: z.object({
    faviconSvg: createAssetPathSchema(),
    faviconIco: createAssetPathSchema(),
    favicon96: createAssetPathSchema(),
    appleTouchIcon: createAssetPathSchema(),
    webApp192: createAssetPathSchema(),
    webApp512: createAssetPathSchema(),
  }),
  theme: z.object({
    default: defaultThemeSiteConfigSchema,
    fuwari: fuwariThemeSiteConfigSchema,
    cuckoo: cuckooThemeSiteConfigSchema,
  }),
});

export function createSiteConfigInputFormSchema(messages: Messages) {
  return z.object({
    title: createSiteTextFormSchema(120, messages).optional(),
    author: createSiteTextFormSchema(80, messages).optional(),
    description: createSiteTextFormSchema(300, messages).optional(),
    social: z.array(SocialLinkSchema).optional(),
    navLinks: createNavLinksFormSchema(messages).optional(),
    icons: z
      .object({
        faviconSvg: createOptionalAssetPathFormSchema(messages).optional(),
        faviconIco: createOptionalAssetPathFormSchema(messages).optional(),
        favicon96: createOptionalAssetPathFormSchema(messages).optional(),
        appleTouchIcon: createOptionalAssetPathFormSchema(messages).optional(),
        webApp192: createOptionalAssetPathFormSchema(messages).optional(),
        webApp512: createOptionalAssetPathFormSchema(messages).optional(),
      })
      .optional(),
    theme: z
      .object({
        default:
          createDefaultThemeSiteConfigInputFormSchema(messages).optional(),
        fuwari: createFuwariThemeSiteConfigInputFormSchema(messages).optional(),
        cuckoo: createCuckooThemeSiteConfigInputFormSchema(messages).optional(),
      })
      .optional(),
  });
}

export const SiteConfigInputSchema = z.object({
  title: createSiteTextSchema(120).optional(),
  author: createSiteTextSchema(80).optional(),
  description: createSiteTextSchema(300).optional(),
  social: z.array(SocialLinkSchema).optional(),
  navLinks: z.array(NavLinkSchema).max(NAV_LINKS_MAX).optional(),
  icons: z
    .object({
      faviconSvg: createOptionalAssetPathSchema().optional(),
      faviconIco: createOptionalAssetPathSchema().optional(),
      favicon96: createOptionalAssetPathSchema().optional(),
      appleTouchIcon: createOptionalAssetPathSchema().optional(),
      webApp192: createOptionalAssetPathSchema().optional(),
      webApp512: createOptionalAssetPathSchema().optional(),
    })
    .optional(),
  theme: z
    .object({
      default: defaultThemeSiteConfigInputSchema.optional(),
      fuwari: fuwariThemeSiteConfigInputSchema.optional(),
      cuckoo: cuckooThemeSiteConfigInputSchema.optional(),
    })
    .optional(),
});

export const SiteConfigSchema = SiteConfigInputSchema;

export type DefaultThemeSiteConfig = z.infer<
  typeof defaultThemeSiteConfigSchema
>;
export type DefaultThemeBackground = z.infer<
  typeof defaultThemeBackgroundSchema
>;
export type DefaultThemeSiteConfigInput = z.infer<
  typeof defaultThemeSiteConfigInputSchema
>;
export type FuwariThemeSiteConfig = z.infer<typeof fuwariThemeSiteConfigSchema>;
export type FuwariThemeSiteConfigInput = z.infer<
  typeof fuwariThemeSiteConfigInputSchema
>;
export type CuckooThemeSiteConfig = z.infer<typeof cuckooThemeSiteConfigSchema>;
export type CuckooThemeSiteConfigInput = z.infer<
  typeof cuckooThemeSiteConfigInputSchema
>;
export type SiteConfig = z.infer<typeof FullSiteConfigSchema>;
export type SiteConfigInput = z.infer<typeof SiteConfigInputSchema>;

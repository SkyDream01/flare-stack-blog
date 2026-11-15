import { useFormContext } from "react-hook-form";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { SystemConfig } from "@/features/config/config.schema";
import { m } from "@/paraglide/messages";

/** The retained build-selected themes keep their own presentation fields. */
export function BuildThemeSettings() {
  const { register } = useFormContext<SystemConfig>();
  if (__THEME_NAME__ === "fuwari") return null;

  return (
    <section className="site-theme-row">
      <div className="site-section-copy">
        <strong>{__THEME_NAME__ === "cuckoo" ? "Cuckoo" : "Default"}</strong>
      </div>
      {__THEME_NAME__ === "cuckoo" ? (
        <>
          <FormField label={m.settings_site_field_home_image()}>
            <Input {...register("site.theme.cuckoo.bg")} />
          </FormField>
          <FormField label={m.settings_site_field_avatar()}>
            <Input {...register("site.theme.cuckoo.avatar")} />
          </FormField>
          <FormField label={m.settings_site_field_sidebar_image_cuckoo()}>
            <Input {...register("site.theme.cuckoo.sidebarBg")} />
          </FormField>
          <FormField label={m.settings_site_field_default_cover_cuckoo()}>
            <Input {...register("site.theme.cuckoo.defaultCover")} />
          </FormField>
          <FormField label={m.settings_site_field_primary_hue()}>
            <Input
              {...register("site.theme.cuckoo.primaryHue", {
                valueAsNumber: true,
              })}
              type="number"
              min={0}
              max={360}
            />
          </FormField>
        </>
      ) : (
        <>
          <FormField label={m.settings_default_nav_name()}>
            <Input {...register("site.theme.default.navBarName")} />
          </FormField>
          <FormField label={m.settings_site_field_home_image()}>
            <Input {...register("site.theme.default.background.homeImage")} />
          </FormField>
          <FormField label={m.settings_default_global_image()}>
            <Input {...register("site.theme.default.background.globalImage")} />
          </FormField>
          <FormField label={m.settings_default_light_opacity()}>
            <Input
              {...register("site.theme.default.background.light.opacity", {
                setValueAs: optionalNumber,
              })}
              type="number"
              min={0}
              max={0.4}
              step={0.01}
            />
          </FormField>
          <FormField label={m.settings_default_dark_opacity()}>
            <Input
              {...register("site.theme.default.background.dark.opacity", {
                setValueAs: optionalNumber,
              })}
              type="number"
              min={0}
              max={0.4}
              step={0.01}
            />
          </FormField>
          <FormField label={m.settings_default_blur()}>
            <Input
              {...register("site.theme.default.background.backdropBlur", {
                setValueAs: optionalNumber,
              })}
              type="number"
              min={0}
              max={32}
            />
          </FormField>
          <FormField label={m.settings_default_transition()}>
            <Input
              {...register("site.theme.default.background.transitionDuration", {
                setValueAs: optionalNumber,
              })}
              type="number"
              min={0}
              max={1500}
            />
          </FormField>
        </>
      )}
    </section>
  );
}

function optionalNumber(value: string) {
  return value === "" ? undefined : Number(value);
}

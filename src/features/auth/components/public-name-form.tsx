import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { StatusText } from "@/components/ui/status-text";
import { m } from "@/paraglide/messages";
import { usePublicNameForm } from "../hooks/use-public-name-form";
import "./auth-pages.css";

/** The form behind the last sign-in step and the name gate. */
export function PublicNameForm({ onSaved }: { onSaved?: () => void }) {
  const form = usePublicNameForm({ onSaved });
  return (
    <form className="auth-form" onSubmit={form.handleSubmit} noValidate>
      <fieldset disabled={form.isSubmitting || form.saved}>
        <FormField
          label={m.profile_name()}
          hint={m.login_name_hint()}
          error={form.errors.name?.message}
          required
        >
          <Input
            {...form.register("name")}
            autoComplete="nickname"
            maxLength={20}
            placeholder={m.login_name_placeholder()}
          />
        </FormField>
        {form.submitError && <StatusText error>{form.submitError}</StatusText>}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="auth-action"
          loading={form.isSubmitting}
          icon={form.saved ? <Check size={16} /> : null}
        >
          {m.login_name_submit()}
        </Button>
      </fieldset>
    </form>
  );
}

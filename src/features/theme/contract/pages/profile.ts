import type { FieldErrors, UseFormRegister } from "react-hook-form";

export interface ProfileUserInfo {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role?: string | null;
}

export interface ProfileSchema {
  name: string;
  image?: string;
}

export interface ProfileFormData {
  register: UseFormRegister<ProfileSchema>;
  errors: FieldErrors<ProfileSchema>;
  handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  isSubmitting: boolean;
}

export interface NotificationData {
  available: boolean;
  enabled: boolean | undefined;
  isLoading: boolean;
  isPending: boolean;
  toggle: () => void;
}

export interface ProfilePageProps {
  user: ProfileUserInfo;
  profileForm: ProfileFormData;
  notification: NotificationData;
  logout: () => Promise<void>;
}

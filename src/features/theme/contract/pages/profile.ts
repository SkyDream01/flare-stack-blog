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

export type ProfileFormData = ReturnType<
  typeof import("@/features/auth/hooks/use-profile-form").useProfileForm
>;

export type NotificationData = ReturnType<
  typeof import("@/features/auth/hooks/use-notification-toggle").useNotificationToggle
>;

export interface ProfilePageProps {
  user: ProfileUserInfo;
  profileForm: ProfileFormData;
  notification: NotificationData;
  logout: () => Promise<void>;
}

import { AppShell } from "@/components/app-shell";
import { AuthCallbackScreen } from "@/components/screens/auth-callback-screen";

export default function AuthCallback() {
  return <AppShell hideNavigation authHeader><AuthCallbackScreen/></AppShell>;
}

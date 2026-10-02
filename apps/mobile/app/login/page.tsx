import { AppShell } from "@/components/app-shell";
import { LoginScreen } from "@/components/screens/login-screen";

export default function Login() {
  return <AppShell hideNavigation authHeader><LoginScreen/></AppShell>;
}

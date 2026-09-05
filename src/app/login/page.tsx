import { AuthForm } from "@/features/identity/auth-form";

export default function LoginPage() {
  return <AuthForm mode="login" reviewerPassword={Bun.env.NEXT_PUBLIC_REVIEWER_PASSWORD} />;
}

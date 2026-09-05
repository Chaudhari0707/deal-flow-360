import { z } from "zod";

const coreEnvironment = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  DATABASE_URL: z.url().refine((value) => value.startsWith("postgresql://"), {
    message: "DATABASE_URL must use postgresql://",
  }),
});

const emailEnvironment = z.object({
  EMAIL_FROM: z.string().min(3),
  RESEND_API_KEY: z.string().min(1),
});

const coreResult = coreEnvironment.safeParse(Bun.env);
if (!coreResult.success) {
  for (const issue of coreResult.error.issues) {
    console.error(`env: ${issue.path.join(".")} ${issue.message}`);
  }
  throw new Error("Core environment is invalid");
}

if (Bun.argv.includes("--email")) {
  const emailResult = emailEnvironment.safeParse(Bun.env);
  if (!emailResult.success) {
    for (const issue of emailResult.error.issues) {
      console.error(`env: ${issue.path.join(".")} ${issue.message}`);
    }
    throw new Error("Email environment is invalid");
  }
}

console.log(`env: core configuration valid${Bun.argv.includes("--email") ? "; email valid" : ""}`);

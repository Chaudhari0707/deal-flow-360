/** Only allowlisted guidance reaches the UI/audit; provider messages can contain private data. */
export function customerEmailError(error: unknown): string {
  const prefix = "Customer login created, but the welcome email was not confirmed. ";
  const name = error && typeof error === "object" && "name" in error ? error.name : "";
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  if (name === "validation_error" && /only send testing emails/i.test(message))
    return (
      prefix +
      "Resend's test sender cannot email this customer. Ask an administrator to configure a verified sending domain. Retrying the same test sender will not fix this."
    );
  if (name === "validation_error" && /domain.*not verified/i.test(message))
    return prefix + "Verify the saved sender's domain in Resend, then retry welcome email.";
  if (["missing_api_key", "invalid_api_key", "restricted_api_key"].includes(String(name)))
    return (
      prefix +
      "Ask an administrator to check the Resend API key and sending permissions, then retry."
    );
  if (name === "invalid_from_address")
    return (
      prefix +
      "The saved sender address is invalid. Ask an administrator to correct the email configuration."
    );
  if (name === "rate_limit_exceeded")
    return (
      prefix +
      "The email provider is rate limiting requests. Wait briefly, then retry welcome email."
    );
  return prefix + "Check email configuration and retry.";
}

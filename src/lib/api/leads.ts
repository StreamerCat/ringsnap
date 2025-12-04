// src/lib/api/leads.ts
export type SignupLeadPayload = {
  email?: string;
  full_name?: string;
  name?: string;
  phone?: string;
  source?: string;
  signup_flow?: string;
  [key: string]: unknown;
};

export type SignupLeadResponse = {
  success: boolean;
  message?: string;
  [key: string]: unknown;
};

const getEnvKey = (): { url: string; key: string } => {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const publishable = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const key = publishable ?? anon;

  if (!url) throw new Error("Missing environment variable VITE_SUPABASE_URL");
  if (!key) {
    throw new Error(
      "Missing environment variable VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY",
    );
  }
  return { url, key };
};

export async function captureSignupLead(
  payload: SignupLeadPayload,
): Promise<SignupLeadResponse> {
  const { url, key } = getEnvKey();
  const endpoint = `${url.replace(/\/$/, "")}/functions/v1/capture-signup-lead`;

  const bodyPayload = payload.full_name
    ? payload
    : { ...payload, full_name: payload.name ?? "" };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
    },
    body: JSON.stringify(bodyPayload),
  });

  if (!res.ok) {
    let errText = `captureSignupLead request failed with status ${res.status}`;
    try {
      const errBody = await res.json();
      errText += `: ${JSON.stringify(errBody)}`;
    } catch {
      const txt = await res.text().catch(() => "");
      if (txt) errText += `: ${txt}`;
    }
    throw new Error(errText);
  }

  try {
    const data = (await res.json()) as SignupLeadResponse;
    return data;
  } catch {
    return { success: true, message: "OK" };
  }
}

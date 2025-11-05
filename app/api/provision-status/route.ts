// app/api/signup/route.ts
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  const { name, email, phone, trade, companyName, areaCode = "303" } = await req.json();

  // create or fetch user and account as you already do
  const { data: user } = await supabase.from("users").insert({ name, email, phone }).select("*").single();
  const { data: account } = await supabase.from("accounts").insert({ owner_user_id: user.id, name: companyName ?? name }).select("*").single();

  // call the secure Edge Function to provision
  const res = await fetch(`${process.env.SUPABASE_URL}/functions/v1/provision`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({
      accountId: account.id,
      userId: user.id,
      companyName: companyName ?? "RingSnap",
      areaCode
    })
  });

  const body = await res.json();
  if (!res.ok || !body.ok) {
    return Response.json({ ok: false, error: body.error || "provision_failed" }, { status: 400 });
  }

  return Response.json({
    ok: true,
    accountId: account.id,
    assistantId: body.assistantId,
    phone: body.number
  });
}

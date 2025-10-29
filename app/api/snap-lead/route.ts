class NextResponse extends Response {
  static json(body: unknown, init?: ResponseInit) {
    const headers = new Headers(init?.headers);
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return new Response(JSON.stringify(body), {
      ...init,
      headers,
    });
  }
}

// OPTIONAL: import your DB client or mailer here
// import { createClient } from "@/lib/supabase/server";
// import { sendEmail } from "@/lib/email/sendEmail";
// import { buildRoiEmail } from "@/lib/email/buildRoiEmail";

export async function POST(req: Request) {
  try {
    const data = await req.json();

    const {
      email,
      monthlyCalls,
      answerRate,
      avgJobValue,
      missedCalls,
      recoveredJobs,
      recoveredRevenueMonthly,
      recoveredRevenueYearly,
      aiCost,
      planName,
      netGainMonthly,
      paybackJobs,
      paybackDays,
    } = data;

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    // 2. TODO: Persist lead to DB / Supabase / CRM
    // Example pseudo:
    //
    // const supabase = createClient();
    // await supabase.from("leads").insert({
    //   email,
    //   source: "roi-calculator",
    //   monthly_calls: monthlyCalls,
    //   answer_rate: answerRate,
    //   avg_job_value: avgJobValue,
    //   missed_calls: missedCalls,
    //   recovered_jobs: recoveredJobs,
    //   recovered_rev_month: recoveredRevenueMonthly,
    //   recovered_rev_year: recoveredRevenueYearly,
    //   ai_cost: aiCost,
    //   plan_name: planName,
    //   net_gain_month: netGainMonthly,
    //   payback_jobs: paybackJobs,
    //   payback_days: paybackDays,
    //   created_at: new Date().toISOString(),
    // });

    console.log("[ROI LEAD]", {
      email,
      monthlyCalls,
      answerRate,
      avgJobValue,
      missedCalls,
      recoveredJobs,
      recoveredRevenueMonthly,
      recoveredRevenueYearly,
      aiCost,
      planName,
      netGainMonthly,
      paybackJobs,
      paybackDays,
    });

    // 3. TODO: Send recap email to the lead
    //
    // await sendEmail({
    //   to: email,
    //   subject: "Your RingSnap ROI breakdown",
    //   text: buildRoiEmail({
    //     monthlyCalls,
    //     answerRate,
    //     avgJobValue,
    //     missedCalls,
    //     recoveredJobs,
    //     recoveredRevenueMonthly,
    //     recoveredRevenueYearly,
    //     aiCost,
    //     planName,
    //     netGainMonthly,
    //     paybackJobs,
    //     paybackDays,
    //   }),
    // });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("snap-lead error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

type RoiEmailArgs = {
  monthlyCalls: number;
  answerRate: number;
  avgJobValue: number;
  missedCalls: number;
  recoveredJobs: number;
  recoveredRevenueMonthly: number;
  recoveredRevenueYearly: number;
  aiCost: number;
  planName: string;
  netGainMonthly: number;
  paybackJobs: number;
  paybackDays: number;
};

export function buildRoiEmail(args: RoiEmailArgs) {
  const {
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
  } = args;

  return `
Your RingSnap ROI Breakdown

Here are the numbers using what you entered:

Calls you get each month: ${monthlyCalls}
Answered live: ${answerRate}%
Average booked job value: $${avgJobValue.toLocaleString()}

You’re currently missing about ${missedCalls} calls a month.
Those missed calls are real customers trying to book work.

If RingSnap answers those calls in under 1 second and books even ~70% of them:
• Extra booked jobs per month: ~${recoveredJobs}
• Added revenue per month: $${recoveredRevenueMonthly.toLocaleString()}
• Added revenue per year: $${recoveredRevenueYearly.toLocaleString()}

Your recommended plan: ${planName} ($${aiCost.toLocaleString()}/month)

How fast it pays for itself:
• Break even in about ${paybackJobs} jobs
• About ${paybackDays} days at your current call volume

Net gain after paying for RingSnap:
$${netGainMonthly.toLocaleString()} per month

What this means:
You are already generating the demand. You’re just not capturing it 24/7.
RingSnap answers every call immediately, sounds human, books the job, and puts it on your calendar.

Next step:
If you'd like, reply to this email with a good number and we’ll let you hear your AI receptionist in action taking a real call.
  `.trim();
}

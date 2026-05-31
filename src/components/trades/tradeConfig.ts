// Trade-specific configuration using Alex Hormozi's value equation framework
// Dream Outcome + Likelihood of Achievement / Time Delay + Effort & Sacrifice

export interface TradeConfig {
  slug: string;
  name: string;
  accentColor: string; // HSL value
  icon: string; // Emoji
  hero: {
    headline: string;
    subheadline: string;
    transcriptBusiness: string;
    transcriptScenario: {
      ai1: string;
      caller: string;
      ai2: string;
      ai3: string;
    };
    pickupStat: string;
  };
  painPoints: {
    title: string;
    items: Array<{
      stat: string;
      problem: string;
      emotion: string;
    }>;
  };
  testimonials: Array<{
    quote: string;
    name: string;
    business: string;
    location: string;
    metric: string;
    metricLabel: string;
    avatar: string;
  }>;
  stats: {
    contractorCount: number;
    avgJobValue: number;
    emergencyRate: string;
  };
  seo: {
    title: string;
    description: string;
    keywords: string;
    canonical: string;
  };
}

export const tradeConfigs: Record<string, TradeConfig> = {
  plumbers: {
    slug: "plumbers",
    name: "Plumbing",
    accentColor: "210 100% 50%", // Blue
    icon: "🔧",
    hero: {
      headline: "AI Receptionist for Plumbers: Stop Losing $6,800/Month to Missed Calls",
      subheadline: "Answers every emergency call in under 2 rings — burst pipes, sewer backups, and after-hours work booked while you're under the sink",
      transcriptBusiness: "Summit Plumbing",
      transcriptScenario: {
        ai1: "Thanks for calling Summit Plumbing. How can I help?",
        caller: "I have a burst pipe in the basement, water everywhere!",
        ai2: "That's an emergency. Turn your main shutoff valve clockwise. I'm routing our on-call tech now. What's your address?",
        ai3: "Got it. You're scheduled for arrival in 45 minutes. Text confirmation sent."
      },
      pickupStat: "<1s"
    },
    painPoints: {
      title: "Why plumbers leave thousands on the table every month",
      items: [
        {
          stat: "47%",
          problem: "of emergency calls go to voicemail after hours",
          emotion: "Every missed call is a $450+ job your competitor just booked"
        },
        {
          stat: "3.5 hrs",
          problem: "wasted daily playing phone tag with customers",
          emotion: "That's 87 billable hours you're losing every month to callbacks"
        },
        {
          stat: "$680",
          problem: "average lost revenue per unanswered weekend call",
          emotion: "Your phone rings Saturday at 9 PM. You're exhausted. You ignore it. Someone else got paid."
        }
      ]
    },
    testimonials: [
      {
        quote: "We were losing emergency calls every week. Now RingSnap handles them all — burst pipes at midnight get triaged immediately, routine calls get booked. Paid for itself fast.",
        name: "Tommy C.",
        business: "Plumbing Contractor",
        location: "Texas",
        metric: "Paid for itself in week 1",
        metricLabel: "Time to ROI",
        avatar: "TC"
      },
      {
        quote: "I used to lose sleep worrying about midnight emergency calls. Now RingSnap handles it — gives callers safety tips, books the job, and only wakes me if it's life-threatening.",
        name: "Marcus W.",
        business: "Plumbing Contractor",
        location: "Pacific Northwest",
        metric: "Zero missed emergencies",
        metricLabel: "After-hours coverage",
        avatar: "MW"
      },
      {
        quote: "RingSnap books jobs while I'm working. It handles quote requests, emergency triage, and scheduling. My revenue is up significantly and I haven't hired a single person.",
        name: "Lisa R.",
        business: "Plumbing Contractor",
        location: "Florida",
        metric: "More booked jobs",
        metricLabel: "Without extra staff",
        avatar: "LR"
      }
    ],
    stats: {
      contractorCount: 0,
      avgJobValue: 485,
      emergencyRate: "61%"
    },
    seo: {
      title: "AI Receptionist for Plumbers | Plumbing Answering Service | RingSnap",
      description: "Stop losing $6,800/month to unanswered calls. RingSnap's AI receptionist answers every plumbing call 24/7 — emergencies, drain clogs, and after-hours jobs booked automatically. Try free.",
      keywords: "AI receptionist for plumbers, plumber answering service, plumbing answering service, virtual receptionist for plumbers, emergency plumber calls, after hours plumbing, burst pipe calls",
      canonical: "https://getringsnap.com/plumbers"
    }
  },

  hvac: {
    slug: "hvac",
    name: "HVAC",
    accentColor: "0 70% 55%", // Red/Orange
    icon: "❄️",
    hero: {
      headline: "AI Receptionist for HVAC Contractors: Stop Losing $8,200/Month to Missed Calls",
      subheadline: "Captures emergency breakdowns AND maintenance calls 24/7 — AC failures, furnace emergencies, and tune-up requests booked while you're in the attic",
      transcriptBusiness: "Arctic Heating & Cooling",
      transcriptScenario: {
        ai1: "Thanks for calling Arctic Heating & Cooling. How can I help?",
        caller: "My AC just died and it's 98 degrees inside. I have elderly parents here!",
        ai2: "I understand—that's urgent. I'm dispatching our emergency tech now. They'll be there within 2 hours. In the meantime, close curtains and use fans to stay cool.",
        ai3: "You're confirmed for emergency service at 3:15 PM today. I've texted you the tech's name and ETA."
      },
      pickupStat: "<1s"
    },
    painPoints: {
      title: "Why HVAC contractors lose high-value calls every day",
      items: [
        {
          stat: "52%",
          problem: "of AC breakdown calls happen after 5 PM or on weekends",
          emotion: "Every voicemail is a panicked homeowner calling your competitor next"
        },
        {
          stat: "$920",
          problem: "average value of missed emergency HVAC service call",
          emotion: "Missing 2 emergency calls per week costs you $7,360 monthly"
        },
        {
          stat: "4.2 hrs",
          problem: "daily spent returning calls instead of turning wrenches",
          emotion: "That's 105 billable hours monthly wasted on phone tag"
        }
      ]
    },
    testimonials: [
      {
        quote: "HVAC emergencies AND quote requests come in around the clock. RingSnap captures them all — emergency repairs and scheduled maintenance — even when we're already on a job.",
        name: "Sarah M.",
        business: "HVAC Contractor",
        location: "Colorado",
        metric: "All calls captured",
        metricLabel: "24/7 coverage",
        avatar: "SM"
      },
      {
        quote: "Summer breakdowns are chaos. The Agent triages emergency vs routine, books both, and only escalates life-threatening situations. My crew size stayed the same but we're handling significantly more calls.",
        name: "David K.",
        business: "HVAC Contractor",
        location: "Arizona",
        metric: "More revenue, same crew",
        metricLabel: "Capacity without hiring",
        avatar: "DK"
      },
      {
        quote: "We used to lose maintenance contract opportunities because no one answered during install jobs. Now RingSnap captures every inquiry and books them automatically.",
        name: "Jennifer W.",
        business: "HVAC Contractor",
        location: "Texas",
        metric: "More maintenance bookings",
        metricLabel: "Without extra staff",
        avatar: "JW"
      }
    ],
    stats: {
      contractorCount: 0,
      avgJobValue: 850,
      emergencyRate: "58%"
    },
    seo: {
      title: "AI Receptionist for HVAC | HVAC Answering Service | RingSnap",
      description: "Stop losing $8,200/month to missed calls. RingSnap's AI receptionist handles AC breakdowns, furnace emergencies, and maintenance calls 24/7. Answers in under 2 rings. Try free.",
      keywords: "AI receptionist for HVAC, HVAC answering service, HVAC call answering, virtual receptionist for HVAC contractors, AC repair calls, furnace emergency service, after hours HVAC calls",
      canonical: "https://getringsnap.com/hvac"
    }
  },

  electricians: {
    slug: "electricians",
    name: "Electrical",
    accentColor: "45 100% 51%", // Yellow/Gold
    icon: "⚡",
    hero: {
      headline: "AI Receptionist for Electricians: Stop Losing $7,400/Month to Missed Calls",
      subheadline: "Books emergency calls and quote requests 24/7 — sparking panels, outages, and upgrades captured even when you're in a panel box",
      transcriptBusiness: "Bolt Electric",
      transcriptScenario: {
        ai1: "Thanks for calling Bolt Electric. How can I help?",
        caller: "My breaker panel is sparking and I smell burning plastic!",
        ai2: "That's a fire hazard—shut off your main breaker immediately. I'm dispatching our emergency electrician now. They'll be there in under 90 minutes.",
        ai3: "You're confirmed for emergency service. Our tech is 15 minutes away. I've sent you their photo and license number."
      },
      pickupStat: "<1s"
    },
    painPoints: {
      title: "Why electricians miss their most profitable calls",
      items: [
        {
          stat: "58%",
          problem: "of electrical emergency calls come during active jobsites",
          emotion: "You're on a ladder or in a panel. Your phone rings. You miss a $1,200 emergency job."
        },
        {
          stat: "$1,240",
          problem: "average value of missed electrical emergency service",
          emotion: "Just 6 missed calls per month costs you $7,440 in lost emergency revenue"
        },
        {
          stat: "3.8 hrs",
          problem: "daily lost to quote callbacks and scheduling",
          emotion: "95 hours monthly you could spend on high-margin electrical work"
        }
      ]
    },
    testimonials: [
      {
        quote: "I'm always on a ladder or in a panel box. RingSnap books jobs while I work — emergencies get routed immediately, routine calls get scheduled. My competitors are still missing calls.",
        name: "Mike J.",
        business: "Electrical Contractor",
        location: "Arizona",
        metric: "Always-on coverage",
        metricLabel: "While on jobsite",
        avatar: "MJ"
      },
      {
        quote: "The Agent handles emergency triage perfectly. It knows when to dispatch immediately (sparking panel) vs schedule next-day (outlet replacement). Our close rate on emergency calls improved significantly.",
        name: "Rachel A.",
        business: "Electrical Contractor",
        location: "Georgia",
        metric: "Better emergency triage",
        metricLabel: "Right call, right priority",
        avatar: "RA"
      },
      {
        quote: "Quote requests used to die in voicemail. Now RingSnap captures every one — even at 10 PM when someone's planning a kitchen remodel. We book significantly more estimate appointments.",
        name: "James P.",
        business: "Electrical Contractor",
        location: "Oregon",
        metric: "More quote bookings",
        metricLabel: "Captured after hours",
        avatar: "JP"
      }
    ],
    stats: {
      contractorCount: 0,
      avgJobValue: 720,
      emergencyRate: "64%"
    },
    seo: {
      title: "AI Receptionist for Electricians | Electrical Answering Service | RingSnap",
      description: "Stop losing $7,400/month to unanswered calls. RingSnap's AI receptionist triages electrical emergencies, books panel upgrades, and handles calls 24/7. Made for electricians. Try free.",
      keywords: "AI receptionist for electricians, electrician answering service, electrical answering service, virtual receptionist for electricians, electrical emergency calls, panel upgrade quotes, 24/7 electrical service",
      canonical: "https://getringsnap.com/electricians"
    }
  },

  roofing: {
    slug: "roofing",
    name: "Roofing",
    accentColor: "25 85% 45%", // Rust/Brown
    icon: "🏠",
    hero: {
      headline: "AI Receptionist for Roofers: Stop Missing $12K+ in Storm Damage Calls",
      subheadline: "Captures emergency leak calls AND inspection requests 24/7 — storm damage, insurance claims, and new jobs booked while you're 30 feet up",
      transcriptBusiness: "Summit Roofing & Repair",
      transcriptScenario: {
        ai1: "Thanks for calling Summit Roofing. How can I help?",
        caller: "My ceiling is dripping water after the storm last night. There's a stain spreading!",
        ai2: "That needs immediate attention. Place a bucket under the drip and move valuables away. I'm booking our emergency crew for this afternoon. What's your address?",
        ai3: "You're scheduled for emergency inspection today at 2 PM. I've texted you what to expect and our crew leader's contact."
      },
      pickupStat: "<1s"
    },
    painPoints: {
      title: "Why roofing contractors lose peak-season revenue",
      items: [
        {
          stat: "68%",
          problem: "of storm-damage calls happen during your busiest work hours",
          emotion: "You're on a roof. Your phone rings. It's an $8,000 emergency repair. You miss it."
        },
        {
          stat: "$890",
          problem: "average emergency roof repair job value",
          emotion: "Missing 3 emergency calls per week costs you $10,680 monthly"
        },
        {
          stat: "5.1 hrs",
          problem: "daily wasted on inspection scheduling and estimate callbacks",
          emotion: "That's 127 hours monthly you're not on roofs generating revenue"
        }
      ]
    },
    testimonials: [
      {
        quote: "After every storm, my phone explodes. The Agent handles emergency leaks, insurance claims, and inspection bookings simultaneously — all the calls I would have missed while I'm on the roof.",
        name: "Carlos M.",
        business: "Roofing Contractor",
        location: "Texas",
        metric: "Zero storm calls missed",
        metricLabel: "During peak surge",
        avatar: "CM"
      },
      {
        quote: "Insurance restoration is timing-sensitive. The Agent books inspections instantly while homeowners are motivated — instead of letting them cool off waiting for a callback.",
        name: "Amanda F.",
        business: "Roofing Contractor",
        location: "Florida",
        metric: "More inspections booked",
        metricLabel: "While homeowners are ready",
        avatar: "AF"
      },
      {
        quote: "Seasonal roofing means we're slammed 6 months and slow 6 months. RingSnap captures every call year-round so we're never leaving revenue on the table during the off-season.",
        name: "Robert C.",
        business: "Roofing Contractor",
        location: "Tennessee",
        metric: "Year-round call capture",
        metricLabel: "Peak and off-season",
        avatar: "RC"
      }
    ],
    stats: {
      contractorCount: 0,
      avgJobValue: 6800,
      emergencyRate: "45%"
    },
    seo: {
      title: "AI Receptionist for Roofers | Roofing Answering Service | RingSnap",
      description: "Stop losing $12,000/month in storm season. RingSnap's AI receptionist books emergency leak repairs, inspections, and storm damage calls 24/7. Made for roofing contractors. Try free.",
      keywords: "AI receptionist for roofers, roofing answering service, roofing call answering, virtual receptionist for roofers, roof leak emergency, storm damage calls, 24/7 roofer calls",
      canonical: "https://getringsnap.com/roofing"
    }
  },

  handyman: {
    slug: "handyman",
    name: "Handyman",
    accentColor: "30 80% 45%",
    icon: "🔨",
    hero: {
      headline: "AI Receptionist for Handymen: Stop Missing Jobs While You're on the Wrench",
      subheadline: "Answers every call 24/7 — honey-do lists, repair estimates, and urgent fix-it jobs booked while you're finishing the last one",
      transcriptBusiness: "Pro Handyman Services",
      transcriptScenario: {
        ai1: "Thanks for calling Pro Handyman Services. How can I help?",
        caller: "I need someone to fix a leaking faucet and patch some drywall this week.",
        ai2: "Happy to help. To get the right tech to you, can I confirm your address and which day works best?",
        ai3: "You're booked for Thursday at 10 AM. I've texted you a confirmation with what to expect."
      },
      pickupStat: "<2s"
    },
    painPoints: {
      title: "Why handymen leave money on the table every week",
      items: [
        {
          stat: "60%",
          problem: "of calls go to voicemail while you're finishing a job",
          emotion: "Every missed call is a repair job your competitor just picked up"
        },
        {
          stat: "2.5 hrs",
          problem: "wasted daily playing phone tag with homeowners",
          emotion: "That's 62 hours per month you could spend billing for actual work"
        },
        {
          stat: "$350",
          problem: "average value of a missed handyman repair call",
          emotion: "Missing 3 calls per week costs you over $5,000 a month in lost work"
        }
      ]
    },
    testimonials: [
      {
        quote: "I was missing calls constantly while on jobs. Now RingSnap books estimate appointments and routine repairs while I work. My schedule stays full without me playing phone tag.",
        name: "Dave M.",
        business: "Handyman Contractor",
        location: "Georgia",
        metric: "Full schedule, less admin",
        metricLabel: "Without phone tag",
        avatar: "DM"
      },
      {
        quote: "Homeowners want someone to answer the phone. When I was going to voicemail, they'd call the next handyman. Now RingSnap answers immediately and I get the job.",
        name: "Kevin R.",
        business: "Handyman Contractor",
        location: "Ohio",
        metric: "More jobs captured",
        metricLabel: "First call answered",
        avatar: "KR"
      },
      {
        quote: "I do everything from drywall to deck repairs. RingSnap handles all the call types — estimates, emergency fixes, routine maintenance — and schedules them while I'm hands-on.",
        name: "Maria S.",
        business: "Handyman Contractor",
        location: "California",
        metric: "All job types handled",
        metricLabel: "Estimates to emergencies",
        avatar: "MS"
      }
    ],
    stats: {
      contractorCount: 0,
      avgJobValue: 350,
      emergencyRate: "25%"
    },
    seo: {
      title: "AI Receptionist for Handymen | Handyman Answering Service | RingSnap",
      description: "Stop missing handyman jobs while you're on a call. RingSnap's AI receptionist answers every call 24/7 — estimates, repairs, and urgent fix-it requests booked automatically. Try free.",
      keywords: "AI receptionist for handymen, handyman answering service, handyman call answering, virtual receptionist for handymen, handyman phone service, home repair answering service",
      canonical: "https://getringsnap.com/handyman"
    }
  }
};

export const getTradeConfig = (slug: string): TradeConfig | undefined => {
  return tradeConfigs[slug];
};

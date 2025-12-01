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
      headline: "Stop Bleeding $6,800/Month in Missed Plumbing Calls",
      subheadline: "The AI Receptionist That Captures Every Emergency Call—And Books Them While You're Under the Sink",
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
        quote: "We went from missing 40% of calls to capturing 98%. Emergency AND routine calls—all handled. That's an extra $23,400 in monthly revenue. The AI paid for itself in 3 days.",
        name: "Tommy Chen",
        business: "Tommy's Plumbing",
        location: "Austin, TX",
        metric: "+$23,400",
        metricLabel: "Monthly Revenue",
        avatar: "TC"
      },
      {
        quote: "I used to lose sleep worrying about midnight emergency calls. Now the AI handles it—gives them DIY safety tips, books the job, and only wakes me if it's life-threatening. My close rate jumped from 61% to 94%.",
        name: "Marcus Williams",
        business: "Rapid Response Plumbing",
        location: "Seattle, WA",
        metric: "94%",
        metricLabel: "Close Rate",
        avatar: "MW"
      },
      {
        quote: "The AI books 14 jobs per week while I'm working. It handles quote requests, emergency triage, and appointment scheduling. My revenue is up 38% and I haven't hired a single person.",
        name: "Lisa Rodriguez",
        business: "Rodriguez Plumbing & Drain",
        location: "Miami, FL",
        metric: "+38%",
        metricLabel: "Revenue Growth",
        avatar: "LR"
      }
    ],
    stats: {
      contractorCount: 327,
      avgJobValue: 485,
      emergencyRate: "61%"
    },
    seo: {
      title: "AI Answering Service for Plumbers | Never Miss Another Emergency Call",
      description: "Stop losing $6,800/month to unanswered calls. RingSnap's AI receptionist answers in under 1 second, handles emergencies, and books jobs 24/7. Made for plumbers who never want to miss a call.",
      keywords: "plumber answering service, plumbing call service, emergency plumber calls, AI for plumbers, plumbing receptionist, 24/7 plumber phone, burst pipe calls, after hours plumbing",
      canonical: "https://www.getringsnap.com/plumbers"
    }
  },

  hvac: {
    slug: "hvac",
    name: "HVAC",
    accentColor: "0 70% 55%", // Red/Orange
    icon: "❄️",
    hero: {
      headline: "Your HVAC Business Loses $8,200/Month When the Phone Rings and No One Answers",
      subheadline: "The AI That Captures Emergency Breakdowns AND Maintenance Calls—While You're in the Attic",
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
        quote: "HVAC emergencies AND quote requests come in around the clock. AI captured $31,000 worth of calls in the first month alone—both emergency repairs and scheduled maintenance.",
        name: "Sarah Martinez",
        business: "Arctic Heating & Cooling",
        location: "Denver, CO",
        metric: "+$31,000",
        metricLabel: "First Month",
        avatar: "SM"
      },
      {
        quote: "Summer breakdowns are chaos. The AI triages emergency vs routine, books both, and only escalates life-threatening situations. Our emergency revenue jumped 43% while I maintained the same crew size.",
        name: "David Kim",
        business: "Comfort Zone HVAC",
        location: "Phoenix, AZ",
        metric: "+43%",
        metricLabel: "Emergency Revenue",
        avatar: "DK"
      },
      {
        quote: "We used to lose maintenance contract opportunities because no one answered during install jobs. Now the AI captures every inquiry. We signed 89 new maintenance contracts in 3 months.",
        name: "Jennifer Walsh",
        business: "Premier Climate Control",
        location: "Dallas, TX",
        metric: "89",
        metricLabel: "New Contracts",
        avatar: "JW"
      }
    ],
    stats: {
      contractorCount: 241,
      avgJobValue: 850,
      emergencyRate: "58%"
    },
    seo: {
      title: "AI Answering Service for HVAC Contractors | Capture Every Emergency Call",
      description: "Stop losing $8,200/month to missed calls. RingSnap's AI handles AC breakdowns, furnace emergencies, and maintenance calls 24/7. Answers in under 1 second. Sounds human.",
      keywords: "HVAC answering service, AC repair calls, furnace emergency service, HVAC receptionist, 24/7 HVAC calls, air conditioning answering service, heating repair calls",
      canonical: "https://www.getringsnap.com/hvac"
    }
  },

  electricians: {
    slug: "electricians",
    name: "Electrical",
    accentColor: "45 100% 51%", // Yellow/Gold
    icon: "⚡",
    hero: {
      headline: "Electricians: You're Losing $7,400/Month Because You Can't Answer While Working Hot",
      subheadline: "The AI Receptionist That Books Emergency Calls AND Quotes—Even When You're in a Panel Box",
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
        quote: "I'm always on a ladder or in a panel box. AI books 127 calls monthly while I work—emergencies get routed immediately, routine calls get scheduled. My competitors are still missing calls.",
        name: "Mike Johnson",
        business: "Bolt Electric",
        location: "Phoenix, AZ",
        metric: "127",
        metricLabel: "Calls Booked/Month",
        avatar: "MJ"
      },
      {
        quote: "The AI handles emergency triage perfectly. It knows when to dispatch immediately (sparking panel) vs schedule next-day (outlet replacement). Our emergency close rate went from 54% to 91%.",
        name: "Rachel Adams",
        business: "Current Solutions Electric",
        location: "Atlanta, GA",
        metric: "91%",
        metricLabel: "Emergency Close Rate",
        avatar: "RA"
      },
      {
        quote: "Quote requests used to die in voicemail. Now the AI captures every one—even at 10 PM when someone's planning a kitchen remodel. We book 47% more quote appointments than before.",
        name: "James Park",
        business: "Park Electrical Services",
        location: "Portland, OR",
        metric: "+47%",
        metricLabel: "Quote Bookings",
        avatar: "JP"
      }
    ],
    stats: {
      contractorCount: 189,
      avgJobValue: 720,
      emergencyRate: "64%"
    },
    seo: {
      title: "AI Answering Service for Electricians | Never Miss Emergency or Quote Calls",
      description: "Stop losing $7,400/month to unanswered calls. RingSnap's AI answers in under 1 second, triages electrical emergencies, and books jobs 24/7. Made for electricians who work hot.",
      keywords: "electrician answering service, electrical emergency calls, panel upgrade quotes, electrician receptionist, 24/7 electrical service, sparking panel calls, electrical fire emergency",
      canonical: "https://www.getringsnap.com/electricians"
    }
  },

  roofing: {
    slug: "roofing",
    name: "Roofing",
    accentColor: "25 85% 45%", // Rust/Brown
    icon: "🏠",
    hero: {
      headline: "Roofing Contractors: Storm Season Brings $12K+ in Calls You're Missing on the Roof",
      subheadline: "The AI That Captures Emergency Leak Calls AND Inspection Requests—While You're 30 Feet Up",
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
        quote: "After every storm, my phone explodes. The AI handles emergency leaks, insurance claims, and inspection bookings simultaneously. Last month it captured $47,000 in storm damage work I would've missed.",
        name: "Carlos Mendez",
        business: "Mendez Roofing Solutions",
        location: "Houston, TX",
        metric: "$47,000",
        metricLabel: "Storm Revenue",
        avatar: "CM"
      },
      {
        quote: "Insurance restoration is timing-sensitive. The AI books inspections instantly while homeowners are motivated. Our inspection booking rate went from 38% to 84%. That's 3x more roofs we're quoting.",
        name: "Amanda Foster",
        business: "Summit Roofing & Repair",
        location: "Tampa, FL",
        metric: "84%",
        metricLabel: "Inspection Rate",
        avatar: "AF"
      },
      {
        quote: "Seasonal roofing means we're slammed 6 months and slow 6 months. The AI captures every call year-round. We book 214 inspections monthly now vs 89 before. Revenue is up 52%.",
        name: "Robert Chen",
        business: "Peak Performance Roofing",
        location: "Nashville, TN",
        metric: "+52%",
        metricLabel: "Revenue Growth",
        avatar: "RC"
      }
    ],
    stats: {
      contractorCount: 90,
      avgJobValue: 6800,
      emergencyRate: "45%"
    },
    seo: {
      title: "AI Answering Service for Roofers | Capture Every Storm Damage & Leak Call",
      description: "Stop losing $12,000/month in storm season. RingSnap's AI answers in under 1 second, books emergency leak repairs and inspections 24/7. Made for roofing contractors.",
      keywords: "roofing answering service, roof leak emergency, storm damage calls, roofing receptionist, 24/7 roofer calls, roof inspection booking, insurance claim calls",
      canonical: "https://www.getringsnap.com/roofing"
    }
  }
};

export const getTradeConfig = (slug: string): TradeConfig | undefined => {
  return tradeConfigs[slug];
};

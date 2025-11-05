export interface CarrierStep {
  title: string;
  content: string;
  code?: string;
  details?: string[];
}

export interface CarrierInstructions {
  name: string;
  activateCode?: string;
  deactivateCode?: string;
  steps: CarrierStep[];
  notes?: string;
  conditionalOptions?: Array<{
    label: string;
    activate: string;
    deactivate: string;
  }>;
}

export const carrierData: Record<string, CarrierInstructions> = {
  default: {
    name: "Default Instructions",
    steps: [
      {
        title: "Identify your carrier",
        content: "Check your latest phone bill or account email for the carrier name",
        details: [
          "AT&T: myatt.com or att.com account portal",
          "Verizon: verizon.com My Account",
          "T-Mobile: t-mobile.com account",
          "U.S. Cellular: uscellular.com My Account"
        ]
      },
      {
        title: "Try the most common codes",
        content: "Most carriers use these standard forwarding codes",
        code: "*72 + [your RingSnap number]",
        details: [
          "Dial *72 then your RingSnap number and press Call",
          "Wait for confirmation tone and hang up",
          "If that fails, try **21*[number]# on mobile"
        ]
      },
      {
        title: "Use your carrier portal",
        content: "Log in to your carrier account, open Call Settings or Call Forwarding, and enter your RingSnap number"
      },
      {
        title: "Call support if needed",
        content: "Contact your carrier's business support line",
        details: [
          "AT&T Business: 800-331-0500",
          "Verizon Business: 800-922-0204",
          "T-Mobile Business: 611 from device",
          "U.S. Cellular: 611 from device"
        ]
      }
    ]
  },
  att: {
    name: "AT&T",
    activateCode: "*72",
    deactivateCode: "*73",
    steps: [
      {
        title: "Forward all calls",
        content: "From the business line, wait for dial tone",
        code: "*72 + [your RingSnap number]",
        details: [
          "Dial *72 followed by your full RingSnap number",
          "Press Call and listen for confirmation tone",
          "Hang up once confirmed"
        ]
      },
      {
        title: "Turn off forwarding",
        content: "When you want to disable call forwarding",
        code: "*73"
      }
    ],
    notes: "Some AT&T systems place a verification call to your RingSnap number during setup"
  },
  verizon: {
    name: "Verizon",
    activateCode: "*72",
    deactivateCode: "*73",
    steps: [
      {
        title: "Forward all calls",
        content: "From the line you want to forward, open the dialer",
        code: "*72 + [your RingSnap number]",
        details: [
          "Dial *72 followed by your full RingSnap number",
          "Press Call and wait for the confirmation tone",
          "Hang up after confirmation"
        ]
      },
      {
        title: "Turn off forwarding",
        content: "To disable call forwarding",
        code: "*73"
      }
    ],
    notes: "For Business Digital Voice you can also enable Call Forwarding in the Verizon portal"
  },
  tmobile: {
    name: "T-Mobile",
    activateCode: "**21*",
    deactivateCode: "##21#",
    steps: [
      {
        title: "Forward all calls",
        content: "Open the dialer on the device tied to your business number",
        code: "**21*[your RingSnap number]#",
        details: [
          "Dial **21* followed by your RingSnap number and #",
          "Example: **21*5551234567#",
          "Press Call and wait for confirmation"
        ]
      },
      {
        title: "Turn off forwarding",
        content: "To disable all call forwarding",
        code: "##21#"
      }
    ],
    conditionalOptions: [
      { label: "Forward when no answer", activate: "**61*", deactivate: "##61#" },
      { label: "Forward when busy", activate: "**67*", deactivate: "##67#" },
      { label: "Forward when unreachable", activate: "**62*", deactivate: "##62#" }
    ]
  },
  uscellular: {
    name: "U.S. Cellular",
    activateCode: "*72",
    deactivateCode: "*73 or *720",
    steps: [
      {
        title: "Forward all calls",
        content: "From your business phone handset",
        code: "*72 + [your RingSnap number]",
        details: [
          "Dial *72 followed by your full RingSnap number",
          "Press Call and wait for confirmation",
          "Hang up after hearing confirmation"
        ]
      },
      {
        title: "Turn off forwarding",
        content: "To disable call forwarding",
        code: "*73 or *720",
        details: ["Try *73 first, if that doesn't work use *720"]
      }
    ],
    notes: "Some conditional codes exist for busy, no answer, or unreachable. Availability varies by region."
  }
};

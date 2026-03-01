import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Phone } from "lucide-react";
import { Link } from "react-router-dom";

export const ContractorFooter = () => {
  const faqs = [{
    question: "Will it sound like a robot?",
    answer: "No. Our Voice Agent uses advanced voice technology that sounds professional and natural. Callers get a fast, helpful answer every time. We offer branded voice options on Professional and Premium plans."
  }, {
    question: "What if it's a gas leak or electrical fire?",
    answer: "Life-threatening emergencies are always transferred to you immediately (typically in under 5 seconds). The Agent provides full context of the situation before transfer so you know exactly what you're walking into."
  }, {
    question: "Can it handle Spanish-speaking customers?",
    answer: "Yes. Professional and Premium plans include multi-language support. The Agent seamlessly switches between English and Spanish based on the customer's preference, ensuring you never lose a job due to language barriers."
  }, {
    question: "What if I'm already on a call?",
    answer: "The Agent books the appointment automatically and sends you an SMS/email notification. You can configure it to transfer to voicemail, send to a crew member, or schedule for your next available slot. No calls get missed."
  }, {
    question: "Do I need to change my phone number?",
    answer: "No. You keep your existing phone number. Setup takes about 10 minutes—just forward your number to your RingSnap Agent. Your customers will never know anything changed except that you suddenly answer every call."
  }, {
    question: "What about existing customers who want me personally?",
    answer: "You can configure VIP customers to transfer directly to you, or the Agent can recognize returning customers by phone number and offer to transfer. You maintain complete control over who gets through and when."
  }, {
    question: "How does the 3-day free trial work?",
    answer: "Your 3-day trial includes 150 minutes (approximately 40+ test calls) to fully test RingSnap with real scenarios—emergency calls, appointments, after-hours coverage, everything. No credit card required to start.\n\nIf you use all 150 minutes during the trial, your service simply pauses and you can upgrade instantly to continue. After 3 days, your selected plan begins automatically unless you cancel. You're in complete control and can cancel anytime with zero hassle."
  }, {
    question: "What if I go over my included minutes?",
    answer: "No problem! We never cut off your service mid-month. If you exceed your included minutes, additional minutes are billed at:\n\n• Starter: $0.16/minute\n• Professional: $0.13/minute\n• Premium: $0.11/minute\n\nYou'll receive email notifications at 75% and 90% usage so you're never surprised. Most customers stay within their plan limits, but busy months happen—we've got you covered.\n\nIf you consistently exceed your limit, we'll proactively suggest upgrading to the next tier, which usually saves you money compared to paying for additional minutes each month."
  }];

  const footerLinks = {
    product: [{
      label: "Features",
      href: "/#features"
    }, {
      label: "Hear it in action",
      href: "/#live-demo"
    }, {
      label: "Pricing",
      href: "/pricing"
    }, {
      label: "The Difference",
      href: "/difference"
    }, {
      label: "ROI Calculator",
      href: "/#roi-calculator"
    }],
    trades: [{
      label: "For Plumbers",
      href: "/plumbers"
    }, {
      label: "For HVAC",
      href: "/hvac"
    }, {
      label: "For Electricians",
      href: "/electricians"
    }, {
      label: "For Roofing",
      href: "/roofing"
    }],
    resources: [{
      label: "Resource Hub",
      href: "/resources"
    }, {
      label: "HVAC Scripts",
      href: "/resources/hvac-dispatcher-script-template"
    }, {
      label: "Plumbing Scripts",
      href: "/resources/plumbing-dispatcher-script-template"
    }, {
      label: "Electrician Scripts",
      href: "/resources/electrician-call-answering-script"
    }, {
      label: "Missed Call Calculator",
      href: "/resources/missed-call-revenue-calculator"
    }],
    company: [{
      label: "Privacy Policy",
      href: "/privacy"
    }, {
      label: "Terms of Service",
      href: "/terms"
    }]
  };

  const renderLink = (link: { label: string; href: string }, index: number) => {
    const isInternal = link.href.startsWith("/");

    if (isInternal && !link.href.includes("#")) {
      return (
        <li key={index}>
          <Link to={link.href} className="text-sm text-foreground/60 hover:text-primary transition-colors">
            {link.label}
          </Link>
        </li>
      );
    }

    // For anchors or external, use <a>
    return (
      <li key={index}>
        <a href={link.href} className="text-sm text-foreground/60 hover:text-primary transition-colors">
          {link.label}
        </a>
      </li>
    );
  };

  return <footer className="bg-gradient-to-br from-cream/30 to-off-white border-t border-charcoal/20">
    {/* FAQ Section */}
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8 py-16">
      <h2 className="text-3xl font-bold text-center mb-8">Common Questions from Contractors</h2>
      <Accordion type="single" collapsible className="max-w-3xl mx-auto">
        {faqs.map((faq, index) => <AccordionItem key={index} value={`item-${index}`}>
          <AccordionTrigger className="text-left font-semibold">
            {faq.question}
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground">
            {faq.answer}
          </AccordionContent>
        </AccordionItem>)}
      </Accordion>
    </div>

    {/* Footer Links */}
    <div className="border-t">
      <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-5 gap-8 mb-12">
          {/* Brand Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 gradient-core rounded-lg flex items-center justify-center">
                <Phone className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg">RingSnap</span>
            </div>
            <p className="text-sm text-foreground/60 font-secondary">
              Built to book jobs and protect your time.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="font-semibold mb-4">Product</h3>
            <ul className="space-y-2">
              {footerLinks.product.map(renderLink)}
            </ul>
          </div>

          {/* For Contractors */}
          <div>
            <h3 className="font-semibold mb-4">For Contractors</h3>
            <ul className="space-y-2">
              {footerLinks.trades.map(renderLink)}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-semibold mb-4">Resources</h3>
            <ul className="space-y-2">
              {footerLinks.resources.map(renderLink)}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              {footerLinks.company.map(renderLink)}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">© 2025 RingSnap • All rights reserved</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Data encrypted in transit</span>
              <span className="text-muted-foreground/50">•</span>
              <span>Account-level access controls</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </footer>;
};

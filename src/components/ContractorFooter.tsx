import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Phone, Mail, MapPin, Shield } from "lucide-react";

export const ContractorFooter = () => {
  const faqs = [
    {
      question: "Will it sound like a robot?",
      answer: "No. Our AI uses advanced voice technology that sounds completely natural. Customers typically can't tell they're speaking with AI. We offer premium voice cloning on Professional and Growth plans to match your team's voice exactly."
    },
    {
      question: "What if it's a gas leak or electrical fire?",
      answer: "Life-threatening emergencies are always transferred to you immediately (typically in under 5 seconds). The AI provides full context of the situation before transfer so you know exactly what you're walking into."
    },
    {
      question: "Can it handle Spanish-speaking customers?",
      answer: "Yes. Professional and Growth plans include multi-language support. The AI seamlessly switches between English and Spanish based on the customer's preference, ensuring you never lose a job due to language barriers."
    },
    {
      question: "What if I'm already on a call?",
      answer: "The AI books the appointment automatically and sends you an SMS/email notification. You can configure it to transfer to voicemail, send to a crew member, or schedule for your next available slot. No calls get missed."
    },
    {
      question: "Do I need to change my phone number?",
      answer: "No. You keep your existing phone number. Setup takes about 10 minutes—just forward your number to your AI receptionist. Your customers will never know anything changed except that you suddenly answer every call."
    },
    {
      question: "What about existing customers who want me personally?",
      answer: "You can configure VIP customers to transfer directly to you, or the AI can recognize returning customers by phone number and offer to transfer. You maintain complete control over who gets through and when."
    }
  ];

  const footerLinks = {
    product: [
      { label: "Features", href: "#solution" },
      { label: "Pricing", href: "#pricing" },
      { label: "Demo", href: "#demo" },
      { label: "ROI Calculator", href: "#calculator" }
    ],
    trades: [
      { label: "For Plumbers", href: "#calculator" },
      { label: "For HVAC", href: "#calculator" },
      { label: "For Electricians", href: "#calculator" },
      { label: "For Roofing", href: "#calculator" }
    ],
    resources: [
      { label: "FAQ", href: "#faq" },
      { label: "Get Started", href: "#pricing" },
      { label: "Try Demo", href: "#demo" },
      { label: "Support", href: "mailto:support@aivoiceagent.com" }
    ],
    company: [
      { label: "Contact", href: "mailto:support@aivoiceagent.com" },
      { label: "Privacy Policy", href: "#" },
      { label: "Terms of Service", href: "#" },
      { label: "Sitemap", href: "#" }
    ]
  };

  return (
    <footer className="bg-muted/30 border-t">
      {/* FAQ Section */}
      <div id="faq" className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-8">Common Questions from Contractors</h2>
        <Accordion type="single" collapsible className="max-w-3xl mx-auto">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left font-semibold">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      {/* Footer Links */}
      <div className="border-t">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-5 gap-8 mb-12">
            {/* Brand Column */}
            <div className="md:col-span-1 space-y-4">
              <div className="flex items-center gap-2">
                <Phone className="w-6 h-6 text-primary" />
                <span className="font-bold text-lg">AI Receptionist</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Never miss another emergency call
              </p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <span>support@aivoiceagent.com</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  <span>1-800-AI-CALLS</span>
                </div>
              </div>
            </div>

            {/* Product Links */}
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2">
                {footerLinks.product.map((link, index) => (
                  <li key={index}>
                    <a href={link.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* For Contractors */}
            <div>
              <h3 className="font-semibold mb-4">For Contractors</h3>
              <ul className="space-y-2">
                {footerLinks.trades.map((link, index) => (
                  <li key={index}>
                    <a href={link.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="font-semibold mb-4">Resources</h3>
              <ul className="space-y-2">
                {footerLinks.resources.map((link, index) => (
                  <li key={index}>
                    <a href={link.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2">
                {footerLinks.company.map((link, index) => (
                  <li key={index}>
                    <a href={link.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-sm text-muted-foreground">
                © 2025 AI Voice Agent • All rights reserved
              </p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Shield className="w-4 h-4 text-primary" />
                  SOC 2 Compliant
                </span>
                <span className="flex items-center gap-1">
                  <Shield className="w-4 h-4 text-primary" />
                  HIPAA Compliant
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

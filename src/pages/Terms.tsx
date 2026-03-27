import React from 'react';
import { Helmet } from 'react-helmet-async';
import { ContractorFooter } from '../components/ContractorFooter';
import { SiteHeader } from '../components/SiteHeader';

const sections = [
  { id: 'definitions', title: '1. Definitions' },
  { id: 'acceptance', title: '2. Acceptance of Terms' },
  { id: 'eligibility', title: '3. Eligibility' },
  { id: 'account-registration', title: '4. Account Registration and Security' },
  { id: 'description-of-service', title: '5. Description of Service' },
  { id: 'automated-systems-disclosure', title: '6. Automated Systems Disclosure' },
  { id: 'acceptable-use-policy', title: '7. Acceptable Use Policy' },
  { id: 'outbound-calling-compliance', title: '8. Outbound Calling Compliance' },
  { id: 'call-recording-compliance', title: '9. Call Recording Compliance' },
  { id: 'emergency-services-disclaimer', title: '10. Emergency Services Disclaimer' },
  { id: 'telecommunications-disclaimer', title: '11. Telecommunications Disclaimer' },
  { id: 'ai-accuracy-disclaimer', title: '12. AI Accuracy Disclaimer' },
  { id: 'third-party-services', title: '13. Third-Party Services' },
  { id: 'intellectual-property', title: '14. Intellectual Property' },
  { id: 'user-content', title: '15. User Content' },
  { id: 'data-usage-and-model-improvement', title: '16. Data Usage and Model Improvement' },
  { id: 'payment-and-billing', title: '17. Payment and Billing' },
  { id: 'subscription-terms', title: '18. Subscription Terms' },
  { id: 'free-trials', title: '19. Free Trials' },
  { id: 'fees-and-overage-charges', title: '20. Fees and Overage Charges' },
  { id: 'suspension-and-termination', title: '21. Suspension and Termination' },
  { id: 'service-availability', title: '22. Service Availability' },
  { id: 'warranty-disclaimer', title: '23. Warranty Disclaimer' },
  { id: 'limitation-of-liability', title: '24. Limitation of Liability' },
  { id: 'indemnification', title: '25. Indemnification' },
  { id: 'governing-law', title: '26. Governing Law' },
  { id: 'arbitration-agreement', title: '27. Arbitration Agreement' },
  { id: 'class-action-waiver', title: '28. Class Action Waiver' },
  { id: 'changes-to-terms', title: '29. Changes to Terms' },
  { id: 'contact-information', title: '30. Contact Information' },
];

const sectionHeadingClass = 'text-2xl sm:text-3xl font-semibold text-gray-900 mb-4 scroll-mt-24';
const paragraphClass = 'text-gray-700 leading-7 mb-4';
const listClass = 'list-disc pl-6 space-y-2 text-gray-700 leading-7 mb-4';

export default function Terms() {
  return (
    <>
      <Helmet>
        <title>Terms of Service | RingSnap</title>
        <meta
          name="description"
          content="RingSnap Terms of Service for AI-powered phone answering, automation, scheduling, and telecommunications workflows."
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://getringsnap.com/terms" />
      </Helmet>

      <SiteHeader />
      <div className="min-h-screen bg-background pt-14">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <header className="mb-10 sm:mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-[#D97757]">Terms of Service</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-3">
              Effective Date: <span className="font-semibold">February 2025</span> · Last Updated:{' '}
              <span className="font-semibold">March 8, 2026</span>
            </p>
            <p className="text-gray-700 leading-7 mt-6 max-w-4xl">
              These Terms of Service ("Terms") form a binding legal agreement between RingSnap ("RingSnap," "we," "us," or "our") and the business entity or individual
              acting on behalf of a business ("Customer," "you," or "your") that accesses or uses the RingSnap platform, including our websites, AI voice agents,
              call automation tools, messaging features, scheduling features, application interfaces, integrations, and related services (collectively, the "Service").
            </p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-8 lg:gap-12 items-start">
            <aside className="lg:sticky lg:top-24 self-start rounded-xl border border-[#F0E2DE] bg-[#FEF6F3] p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">On this page</h2>
              <nav aria-label="Terms of Service sections">
                <ol className="space-y-2 text-sm">
                  {sections.map((section) => (
                    <li key={section.id}>
                      <a href={`#${section.id}`} className="text-[#B4533D] hover:text-[#D97757] hover:underline transition-colors">
                        {section.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </aside>

            <main className="prose prose-gray max-w-none prose-headings:font-semibold prose-p:leading-7">
              <section id="definitions">
                <h2 className={sectionHeadingClass}>1. Definitions</h2>
                <p className={paragraphClass}>
                  "Authorized User" means any employee, contractor, representative, or agent authorized by Customer to access the Service under Customer&apos;s account.
                  "Caller" means any third party consumer or other person who places, receives, or participates in a communication processed through the Service.
                  "Customer Data" means data, content, recordings, transcripts, prompts, responses, business information, and other materials submitted to or processed
                  through the Service by or on behalf of Customer. "Output" means any content generated by AI or automation features, including call responses,
                  transcriptions, summaries, insights, recommendations, and scheduling actions.
                </p>
              </section>

              <section id="acceptance">
                <h2 className={sectionHeadingClass}>2. Acceptance of Terms</h2>
                <p className={paragraphClass}>
                  By accessing, registering for, or using the Service, you represent and warrant that you have authority to bind Customer and agree to these Terms.
                  If you do not agree, you must not access or use the Service. Customer is responsible for compliance with these Terms by all Authorized Users and
                  any person using Customer credentials.
                </p>
              </section>

              <section id="eligibility">
                <h2 className={sectionHeadingClass}>3. Eligibility</h2>
                <p className={paragraphClass}>
                  You may use the Service only if you are at least 18 years old, legally capable of entering contracts, and using the Service for lawful business purposes.
                  You represent and warrant that neither you nor Customer is prohibited from receiving the Service under applicable law.
                </p>
              </section>

              <section id="account-registration">
                <h2 className={sectionHeadingClass}>4. Account Registration and Security</h2>
                <p className={paragraphClass}>
                  You must provide accurate, current, and complete registration information and promptly update such information as needed. You are solely responsible for
                  safeguarding account credentials, restricting account access, and all activities occurring under your account. You must promptly notify RingSnap of any
                  suspected unauthorized access, security breach, or misuse. RingSnap may rely on account credentials as conclusive proof that instructions originate from
                  Customer.
                </p>
              </section>

              <section id="description-of-service">
                <h2 className={sectionHeadingClass}>5. Description of Service</h2>
                <p className={paragraphClass}>
                  RingSnap provides software tools and infrastructure for AI-powered phone answering, voice automation, call routing, messaging workflows, and scheduling
                  support for business customers. RingSnap is a technology provider only and is not a home services contractor, dispatcher, emergency operator, licensed
                  professional, insurer, broker, legal advisor, or fiduciary. RingSnap does not perform the underlying services offered by Customer and is not responsible
                  for Customer&apos;s business operations, customer outcomes, appointments, communications, promises, or representations.
                </p>
              </section>

              <section id="automated-systems-disclosure">
                <h2 className={sectionHeadingClass}>6. Automated Systems Disclosure</h2>
                <p className={paragraphClass}>
                  The Service uses automated systems and artificial intelligence to generate responses, route calls, transcribe communications, and perform workflow actions.
                  Callers may interact with automated agents or AI systems and may not interact with a human representative. AI and automation outputs may be incorrect,
                  incomplete, delayed, misleading, or unavailable, and are not guaranteed to be accurate or suitable for any purpose. Customer must independently verify all
                  critical information, including safety, pricing, legal, compliance, scheduling, dispatch, and customer-facing statements before reliance or action.
                </p>
                <p className={paragraphClass}>
                  Customer is solely responsible for determining and satisfying legal notice requirements regarding automated calling, AI interaction disclosures, and consent.
                </p>
              </section>

              <section id="acceptable-use-policy">
                <h2 className={sectionHeadingClass}>7. Acceptable Use Policy</h2>
                <p className={paragraphClass}>Customer must not, and must not permit others to, use the Service to:</p>
                <ul className={listClass}>
                  <li>Engage in illegal robocalling, unlawful telemarketing, spam campaigns, or prohibited bulk outreach.</li>
                  <li>Harass, threaten, stalk, or abuse any person, or disseminate hateful, violent, or unlawful content.</li>
                  <li>Impersonate any person or entity, misrepresent affiliation, or engage in deceptive practices or fraud.</li>
                  <li>Conduct unlawful political campaigns or restricted campaign calling in jurisdictions where prohibited.</li>
                  <li>Violate privacy, consumer protection, telecommunications, data protection, intellectual property, or other applicable laws.</li>
                  <li>Probe, scan, scrape, reverse engineer, or interfere with telecom infrastructure, networks, or Service security.</li>
                  <li>Introduce malware, harmful code, denial-of-service traffic, or any activity that degrades platform reliability.</li>
                </ul>
              </section>

              <section id="outbound-calling-compliance">
                <h2 className={sectionHeadingClass}>8. Outbound Calling Compliance</h2>
                <p className={paragraphClass}>
                  Customer is solely responsible for all outbound calls, texts, voicemails, and automated communications initiated through the Service, including campaign
                  setup, audience selection, consent collection, contact management, message content, timing, and frequency. Customer must comply with all applicable laws,
                  regulations, and industry rules, including the Telephone Consumer Protection Act (TCPA), Telemarketing Sales Rule, federal and state Do Not Call rules,
                  robocall restrictions, and carrier requirements. RingSnap provides infrastructure only and assumes no responsibility for Customer noncompliance.
                </p>
              </section>

              <section id="call-recording-compliance">
                <h2 className={sectionHeadingClass}>9. Call Recording Compliance</h2>
                <p className={paragraphClass}>
                  Customer is solely responsible for determining whether call recording, monitoring, transcription, or analysis is lawful in each relevant jurisdiction and for
                  obtaining all required notices, disclosures, and consents from Callers and participants. RingSnap does not provide legal advice and disclaims all liability
                  arising from Customer&apos;s failure to comply with one-party consent, two-party consent, wiretapping, biometric, consumer protection, or related laws.
                </p>
              </section>

              <section id="emergency-services-disclaimer">
                <h2 className={sectionHeadingClass}>10. Emergency Services Disclaimer</h2>
                <p className={paragraphClass}>
                  THE SERVICE IS NOT A 911 SERVICE, EMERGENCY DISPATCH SERVICE, OR PUBLIC SAFETY SYSTEM. THE SERVICE MUST NOT BE USED OR RELIED UPON FOR EMERGENCY
                  COMMUNICATIONS, MEDICAL EMERGENCIES, LAW ENFORCEMENT NEEDS, FIRE RESPONSE, OR LIFE-SAFETY EVENTS. CUSTOMER MUST MAINTAIN INDEPENDENT EMERGENCY
                  COMMUNICATION CHANNELS.
                </p>
              </section>

              <section id="telecommunications-disclaimer">
                <h2 className={sectionHeadingClass}>11. Telecommunications Disclaimer</h2>
                <p className={paragraphClass}>
                  The Service relies on third-party telecommunications networks, carriers, and infrastructure not controlled by RingSnap. RingSnap is not liable for dropped
                  calls, call routing failures, carrier outages, latency, jitter, call quality degradation, failed recordings, delayed or failed SMS/MMS delivery, missed
                  calls, blocked or flagged numbers, spam labeling, or other telecom-related failures, regardless of cause.
                </p>
              </section>

              <section id="ai-accuracy-disclaimer">
                <h2 className={sectionHeadingClass}>12. AI Accuracy Disclaimer</h2>
                <p className={paragraphClass}>
                  Output generated by AI systems may contain hallucinations, inaccuracies, offensive content, or omissions. RingSnap does not warrant that Output is correct,
                  complete, legally compliant, non-infringing, or fit for any specific purpose. Customer assumes all risk for use of Output and for decisions, actions,
                  communications, or transactions based on Output.
                </p>
              </section>

              <section id="third-party-services">
                <h2 className={sectionHeadingClass}>13. Third-Party Services</h2>
                <p className={paragraphClass}>
                  The Service may integrate with third-party providers, including telephony carriers, AI model providers, CRM systems, scheduling tools, analytics platforms,
                  hosting providers, and payment processors. Your use of third-party services is governed by those providers&apos; terms and privacy notices. RingSnap is not
                  responsible for third-party services, acts, omissions, policies, outages, security incidents, or data practices.
                </p>
              </section>

              <section id="intellectual-property">
                <h2 className={sectionHeadingClass}>14. Intellectual Property</h2>
                <p className={paragraphClass}>
                  RingSnap and its licensors retain all right, title, and interest in and to the Service, including software, code, APIs, voice systems, algorithms, models,
                  prompts, workflows, interfaces, documentation, trademarks, and derivative works. Except for limited rights expressly granted, no rights are licensed by
                  implication, estoppel, or otherwise.
                </p>
                <p className={paragraphClass}>Customer shall not and shall not permit others to:</p>
                <ul className={listClass}>
                  <li>Reverse engineer, decompile, disassemble, translate, or attempt to derive source code or model architecture.</li>
                  <li>Copy, reproduce, modify, create derivative works from, frame, mirror, or replicate Service functionality.</li>
                  <li>Scrape, data-mine, benchmark, or use output to build competing products or models.</li>
                  <li>Remove proprietary notices or circumvent usage limits, technical protections, or access controls.</li>
                </ul>
                <p className={paragraphClass}>
                  Customer is solely responsible for reviewing and determining whether Output may be used, published, distributed, or commercialized. RingSnap disclaims
                  liability for third-party intellectual property claims arising from Customer inputs, prompts, data, or use of Output.
                </p>
              </section>

              <section id="user-content">
                <h2 className={sectionHeadingClass}>15. User Content</h2>
                <p className={paragraphClass}>
                  Customer retains ownership of Customer Data. Customer grants RingSnap a worldwide, non-exclusive, royalty-free license to host, process, transmit, store,
                  reproduce, and otherwise use Customer Data solely as necessary to provide, secure, maintain, support, and improve the Service, comply with law, and enforce
                  these Terms.
                </p>
              </section>

              <section id="data-usage-and-model-improvement">
                <h2 className={sectionHeadingClass}>16. Data Usage and Model Improvement</h2>
                <p className={paragraphClass}>
                  RingSnap may use de-identified, anonymized, and aggregated interaction data to monitor performance, improve system quality, train and tune models, develop
                  new features, and perform analytics, provided such use excludes personally identifiable information where legally required. Customer represents it has all
                  rights and consents required for RingSnap&apos;s lawful processing of Customer Data under these Terms and applicable law.
                </p>
              </section>

              <section id="payment-and-billing">
                <h2 className={sectionHeadingClass}>17. Payment and Billing</h2>
                <p className={paragraphClass}>
                  Customer agrees to pay all fees, charges, taxes, and assessments associated with the Service. Billing may be processed through third-party payment processors.
                  Customer authorizes recurring charges for subscription and usage-based fees until cancellation is effective. Except as required by law, fees are non-refundable.
                </p>
              </section>

              <section id="subscription-terms">
                <h2 className={sectionHeadingClass}>18. Subscription Terms</h2>
                <p className={paragraphClass}>
                  Subscriptions renew automatically for successive billing periods unless canceled before the next renewal date through the account portal or written notice as
                  specified by RingSnap. Downgrades and cancellations become effective at the end of the current billing period unless otherwise stated.
                </p>
              </section>

              <section id="free-trials">
                <h2 className={sectionHeadingClass}>19. Free Trials</h2>
                <p className={paragraphClass}>
                  RingSnap may offer free trials at its discretion. Unless canceled before trial expiration, trial accounts may convert to paid subscriptions and Customer
                  authorizes RingSnap to charge the designated payment method. RingSnap may modify, suspend, or terminate trial offers at any time.
                </p>
              </section>

              <section id="fees-and-overage-charges">
                <h2 className={sectionHeadingClass}>20. Fees and Overage Charges</h2>
                <p className={paragraphClass}>
                  Plans may include usage limits and overage pricing for calls, minutes, messaging, transcripts, AI processing, integrations, and related consumption metrics.
                  Customer is responsible for all overages incurred, whether caused by Customer activity, Authorized Users, or third-party interactions with Customer&apos;s
                  configured workflows.
                </p>
              </section>

              <section id="suspension-and-termination">
                <h2 className={sectionHeadingClass}>21. Suspension and Termination</h2>
                <p className={paragraphClass}>
                  RingSnap may suspend or terminate access immediately, without liability, for nonpayment, suspected fraud, legal or regulatory risk, security concerns,
                  violation of these Terms, abusive calling behavior, or misuse of telecom infrastructure. RingSnap may also remove content or block traffic as needed to
                  protect users, carriers, or platform integrity.
                </p>
              </section>

              <section id="service-availability">
                <h2 className={sectionHeadingClass}>22. Service Availability</h2>
                <p className={paragraphClass}>
                  RingSnap does not guarantee any uptime level, response time, continuity, or uninterrupted availability of the Service. Maintenance, upgrades, third-party
                  outages, carrier actions, force majeure events, and technical failures may result in downtime, delays, or degraded performance.
                </p>
              </section>

              <section id="warranty-disclaimer">
                <h2 className={sectionHeadingClass}>23. Warranty Disclaimer</h2>
                <p className={paragraphClass}>
                  THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE. TO THE MAXIMUM
                  EXTENT PERMITTED BY LAW, RINGSNAP DISCLAIMS ALL WARRANTIES, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT,
                  UNINTERRUPTED SERVICE, AND ERROR-FREE OPERATION.
                </p>
              </section>

              <section id="limitation-of-liability">
                <h2 className={sectionHeadingClass}>24. Limitation of Liability</h2>
                <p className={paragraphClass}>
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, RINGSNAP&apos;S TOTAL CUMULATIVE LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATED TO THE SERVICE OR THESE TERMS
                  WILL NOT EXCEED THE GREATER OF (A) ONE HUNDRED U.S. DOLLARS (US $100), OR (B) THE TOTAL FEES PAID BY CUSTOMER TO RINGSNAP FOR THE SERVICE IN THE
                  TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM.
                </p>
                <p className={paragraphClass}>
                  IN NO EVENT WILL RINGSNAP BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, LOST
                  REVENUE, LOST BUSINESS OPPORTUNITIES, BUSINESS INTERRUPTION, LOSS OF GOODWILL, OR LOSS OF DATA, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
                </p>
              </section>

              <section id="indemnification">
                <h2 className={sectionHeadingClass}>25. Indemnification</h2>
                <p className={paragraphClass}>
                  Customer will defend, indemnify, and hold harmless RingSnap and its officers, directors, employees, affiliates, agents, and licensors from and against any
                  claims, actions, liabilities, damages, judgments, fines, penalties, losses, costs, and expenses (including reasonable attorneys&apos; fees) arising out of or
                  relating to: (a) Customer&apos;s use of the Service; (b) Customer&apos;s business operations; (c) Customer Data; (d) unlawful calling, messaging, recording,
                  marketing, or telecom practices; (e) alleged violations of TCPA, Do Not Call, robocall, privacy, data protection, consumer protection, or similar laws;
                  (f) misuse or reliance on AI Output; or (g) Customer&apos;s breach of these Terms.
                </p>
              </section>

              <section id="governing-law">
                <h2 className={sectionHeadingClass}>26. Governing Law</h2>
                <p className={paragraphClass}>
                  These Terms are governed by the laws of the State of Delaware, without regard to conflict-of-laws rules, except that the Federal Arbitration Act governs
                  interpretation and enforcement of Sections 27 and 28.
                </p>
              </section>

              <section id="arbitration-agreement">
                <h2 className={sectionHeadingClass}>27. Arbitration Agreement</h2>
                <p className={paragraphClass}>
                  Except for claims eligible for small claims court and claims seeking injunctive relief for intellectual property misuse, Customer and RingSnap agree that any
                  dispute, claim, or controversy arising out of or relating to these Terms or the Service will be resolved by final and binding arbitration administered by the
                  American Arbitration Association under its Commercial Arbitration Rules. Arbitration shall occur in Delaware, unless the parties agree otherwise.
                </p>
                <p className={paragraphClass}>
                  The arbitrator has exclusive authority to resolve all disputes regarding arbitrability, enforceability, scope, and interpretation of this arbitration agreement.
                  Judgment on any award may be entered in any court of competent jurisdiction. EACH PARTY WAIVES ANY RIGHT TO A JURY TRIAL.
                </p>
              </section>

              <section id="class-action-waiver">
                <h2 className={sectionHeadingClass}>28. Class Action Waiver</h2>
                <p className={paragraphClass}>
                  ALL CLAIMS MUST BE BROUGHT IN AN INDIVIDUAL CAPACITY, AND NOT AS A PLAINTIFF, CLASS MEMBER, OR REPRESENTATIVE IN ANY PURPORTED CLASS, COLLECTIVE,
                  CONSOLIDATED, OR REPRESENTATIVE ACTION. THE ARBITRATOR MAY NOT CONSOLIDATE CLAIMS OR PRESIDE OVER ANY FORM OF REPRESENTATIVE OR CLASS PROCEEDING.
                </p>
              </section>

              <section id="changes-to-terms">
                <h2 className={sectionHeadingClass}>29. Changes to Terms</h2>
                <p className={paragraphClass}>
                  RingSnap may update these Terms from time to time by posting a revised version on the website. Material changes may also be communicated via email or in-app
                  notice. Unless stated otherwise, revised Terms become effective on posting. Your continued use of the Service after the effective date constitutes acceptance
                  of the revised Terms.
                </p>
              </section>

              <section id="contact-information">
                <h2 className={sectionHeadingClass}>30. Contact Information</h2>
                <p className={paragraphClass}>
                  If you have questions about these Terms, contact RingSnap at{' '}
                  <a href="mailto:support@getringsnap.com" className="text-[#B4533D] hover:text-[#D97757] hover:underline">
                    support@getringsnap.com
                  </a>
                  .
                </p>
              </section>
            </main>
          </div>
        </div>
      </div>

      <ContractorFooter />
    </>
  );
}

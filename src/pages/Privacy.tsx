import React from 'react';
import { Helmet } from 'react-helmet-async';
import { ContractorFooter } from '../components/ContractorFooter';

const sections = [
  { id: 'information-we-collect', title: '1. Information We Collect' },
  { id: 'information-collected-automatically', title: '2. Information Collected Automatically' },
  { id: 'call-recording-and-transcription-data', title: '3. Call Recording and Transcription Data' },
  { id: 'how-we-use-information', title: '4. How We Use Information' },
  { id: 'ai-processing', title: '5. AI Processing' },
  { id: 'sharing-of-information', title: '6. Sharing of Information' },
  { id: 'third-party-service-providers', title: '7. Third-Party Service Providers' },
  { id: 'data-retention', title: '8. Data Retention' },
  { id: 'data-security', title: '9. Data Security' },
  { id: 'international-data-transfers', title: '10. International Data Transfers' },
  { id: 'your-privacy-rights', title: '11. Your Privacy Rights' },
  { id: 'ccpa-cpra-rights', title: '12. CCPA / CPRA Rights' },
  { id: 'gdpr-rights', title: '13. GDPR Rights' },
  { id: 'data-deletion-requests', title: '14. Data Deletion Requests' },
  { id: 'childrens-privacy', title: "15. Children's Privacy" },
  { id: 'policy-updates', title: '16. Policy Updates' },
  { id: 'contact-information', title: '17. Contact Information' },
];

const sectionHeadingClass = 'text-2xl sm:text-3xl font-semibold text-gray-900 mb-4 scroll-mt-24';
const paragraphClass = 'text-gray-700 leading-7 mb-4';
const listClass = 'list-disc pl-6 space-y-2 text-gray-700 leading-7 mb-4';

export default function Privacy() {
  return (
    <>
      <Helmet>
        <title>Privacy Policy | RingSnap</title>
        <meta
          name="description"
          content="RingSnap Privacy Policy for AI-powered telecommunications and call automation services."
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://getringsnap.com/privacy" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <header className="mb-10 sm:mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-[#D97757]">Privacy Policy</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-3">
              Effective Date: <span className="font-semibold">February 2025</span> · Last Updated:{' '}
              <span className="font-semibold">March 8, 2026</span>
            </p>
            <p className="text-gray-700 leading-7 mt-6 max-w-4xl">
              This Privacy Policy explains how RingSnap ("RingSnap," "we," "us," or "our") collects, uses, shares, stores, and protects information when customers use
              our AI-powered phone answering, voice automation, messaging, and scheduling platform, and when callers interact with communications handled through the
              platform. This Policy applies to our website, applications, APIs, and related services (collectively, the "Service").
            </p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-8 lg:gap-12 items-start">
            <aside className="lg:sticky lg:top-24 self-start rounded-xl border border-[#F0E2DE] bg-[#FEF6F3] p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">On this page</h2>
              <nav aria-label="Privacy Policy sections">
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
              <section id="information-we-collect">
                <h2 className={sectionHeadingClass}>1. Information We Collect</h2>
                <p className={paragraphClass}>We collect information that customers provide directly, including:</p>
                <ul className={listClass}>
                  <li>Account and profile details (name, business name, email address, username, and phone number).</li>
                  <li>Business contact data and caller information, including caller names, phone numbers, and appointment information.</li>
                  <li>Configuration data, scripts, prompts, workflows, routing rules, and communication preferences.</li>
                  <li>Billing and transaction information needed for subscription management and payment processing.</li>
                  <li>Support communications, feedback, and records of interactions with our support team.</li>
                </ul>
              </section>

              <section id="information-collected-automatically">
                <h2 className={sectionHeadingClass}>2. Information Collected Automatically</h2>
                <p className={paragraphClass}>
                  When the Service is used, we and our service providers automatically collect technical and usage information, such as device data, browser type, operating
                  system, IP address, session identifiers, interaction events, call metadata, referring URLs, feature usage patterns, and technical logs used for security,
                  troubleshooting, and performance monitoring.
                </p>
              </section>

              <section id="call-recording-and-transcription-data">
                <h2 className={sectionHeadingClass}>3. Call Recording and Transcription Data</h2>
                <p className={paragraphClass}>
                  Depending on customer settings, we may process call recordings, voicemail content, call transcripts, summaries, sentiment and intent signals, and appointment
                  outcomes. We process this information to provide call handling, transcription, analytics, quality assurance, and workflow automation features. Customers are
                  responsible for obtaining any legally required caller notices and recording consent.
                </p>
              </section>

              <section id="how-we-use-information">
                <h2 className={sectionHeadingClass}>4. How We Use Information</h2>
                <p className={paragraphClass}>We use information to:</p>
                <ul className={listClass}>
                  <li>Operate, maintain, and improve the Service and underlying infrastructure.</li>
                  <li>Process inbound and outbound communications and generate AI-assisted responses.</li>
                  <li>Transcribe calls, route conversations, and facilitate scheduling workflows.</li>
                  <li>Provide analytics, reporting, fraud detection, abuse prevention, and service integrity protections.</li>
                  <li>Process payments, administer subscriptions, and send service-related communications.</li>
                  <li>Comply with legal obligations, enforce our terms, and protect rights, safety, and security.</li>
                </ul>
              </section>

              <section id="ai-processing">
                <h2 className={sectionHeadingClass}>5. AI Processing</h2>
                <p className={paragraphClass}>
                  The Service uses automated and AI systems to process communications and generate outputs. AI-generated outputs may be incomplete or inaccurate. We may use
                  de-identified and aggregated interaction data to improve model performance, train systems, and develop new features, excluding personally identifiable
                  information where legally required.
                </p>
              </section>

              <section id="sharing-of-information">
                <h2 className={sectionHeadingClass}>6. Sharing of Information</h2>
                <p className={paragraphClass}>We may share information in the following circumstances:</p>
                <ul className={listClass}>
                  <li>With customer-authorized recipients and integrations selected by the customer.</li>
                  <li>With service providers and subprocessors that support platform functionality and operations.</li>
                  <li>When required by law, legal process, or valid governmental request.</li>
                  <li>To detect, investigate, prevent, or address fraud, abuse, security incidents, or technical issues.</li>
                  <li>In connection with a merger, financing, acquisition, reorganization, or sale of assets.</li>
                </ul>
                <p className={paragraphClass}>We do not sell personal information for monetary consideration.</p>
              </section>

              <section id="third-party-service-providers">
                <h2 className={sectionHeadingClass}>7. Third-Party Service Providers</h2>
                <p className={paragraphClass}>We use third-party providers in categories that include:</p>
                <ul className={listClass}>
                  <li>Telephony and messaging providers for call routing, call delivery, and messaging transport.</li>
                  <li>AI model and transcription providers for language processing and automation features.</li>
                  <li>Cloud hosting and infrastructure providers for secure application delivery and storage.</li>
                  <li>Analytics providers for usage monitoring and product performance insights.</li>
                  <li>Payment processors for subscription billing and transaction processing.</li>
                </ul>
              </section>

              <section id="data-retention">
                <h2 className={sectionHeadingClass}>8. Data Retention</h2>
                <p className={paragraphClass}>
                  We retain information for as long as reasonably necessary to provide the Service, satisfy legal obligations, resolve disputes, enforce agreements, and protect
                  platform integrity. Retention periods vary by data type and customer configuration. Call recordings, transcripts, and logs may be retained for operational,
                  compliance, and security purposes and may be deleted or de-identified according to our retention practices.
                </p>
              </section>

              <section id="data-security">
                <h2 className={sectionHeadingClass}>9. Data Security</h2>
                <p className={paragraphClass}>
                  We implement reasonable administrative, technical, and physical safeguards designed to protect information against unauthorized access, destruction, loss,
                  alteration, or misuse. However, no system is completely secure, and we cannot guarantee absolute security.
                </p>
              </section>

              <section id="international-data-transfers">
                <h2 className={sectionHeadingClass}>10. International Data Transfers</h2>
                <p className={paragraphClass}>
                  We may process and store information in the United States and other jurisdictions where we or our providers operate. When required, we implement safeguards
                  intended to support lawful international transfers, which may include contractual protections and supplementary measures.
                </p>
              </section>

              <section id="your-privacy-rights">
                <h2 className={sectionHeadingClass}>11. Your Privacy Rights</h2>
                <p className={paragraphClass}>
                  Subject to applicable law, you may request access to personal information we hold about you, request correction of inaccurate information, and request
                  deletion of personal information. We may need to verify identity and authority before processing requests.
                </p>
              </section>

              <section id="ccpa-cpra-rights">
                <h2 className={sectionHeadingClass}>12. CCPA / CPRA Rights</h2>
                <p className={paragraphClass}>
                  If you are a California resident, you may have rights under the California Consumer Privacy Act, as amended by the California Privacy Rights Act, including
                  the rights to know, access, correct, delete, and limit use of certain sensitive personal information, subject to statutory exceptions. You may also have the
                  right not to receive discriminatory treatment for exercising applicable privacy rights.
                </p>
              </section>

              <section id="gdpr-rights">
                <h2 className={sectionHeadingClass}>13. GDPR Rights</h2>
                <p className={paragraphClass}>
                  If the General Data Protection Regulation applies, you may have rights to access, rectification, erasure, restriction, objection, and data portability, and
                  the right to lodge a complaint with a supervisory authority. Where RingSnap processes personal data as a processor on behalf of a customer, requests should
                  generally be directed to that customer as the data controller.
                </p>
              </section>

              <section id="data-deletion-requests">
                <h2 className={sectionHeadingClass}>14. Data Deletion Requests</h2>
                <p className={paragraphClass}>
                  To submit a deletion request, contact{' '}
                  <a href="mailto:support@getringsnap.com" className="text-[#B4533D] hover:text-[#D97757] hover:underline">
                    support@getringsnap.com
                  </a>
                  . We will evaluate and respond to verified requests in accordance with applicable law. Certain information may be retained as required for legal, accounting,
                  security, fraud prevention, dispute resolution, backup integrity, or contractual obligations.
                </p>
              </section>

              <section id="childrens-privacy">
                <h2 className={sectionHeadingClass}>15. Children&apos;s Privacy</h2>
                <p className={paragraphClass}>
                  The Service is not directed to children under 13, and we do not knowingly collect personal information directly from children under 13. If you believe a
                  child has provided personal information in violation of this Policy, contact us so we can investigate and take appropriate action.
                </p>
              </section>

              <section id="policy-updates">
                <h2 className={sectionHeadingClass}>16. Policy Updates</h2>
                <p className={paragraphClass}>
                  We may update this Privacy Policy from time to time. Updated versions will be posted with a revised "Last Updated" date, and material changes may also be
                  communicated through additional notices where appropriate. Continued use of the Service after the effective date of updates constitutes acceptance of the
                  revised Policy.
                </p>
              </section>

              <section id="contact-information">
                <h2 className={sectionHeadingClass}>17. Contact Information</h2>
                <p className={paragraphClass}>
                  For privacy inquiries, rights requests, or complaints, contact RingSnap at{' '}
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

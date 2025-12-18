import React from 'react';
import { Helmet } from 'react-helmet-async';
import { ContractorFooter } from '../components/ContractorFooter';

export default function Terms() {
  const sections = [
    { id: 'intro', title: '1. Introduction', number: 1 },
    { id: 'eligibility', title: '2. Eligibility', number: 2 },
    { id: 'account', title: '3. Account Registration', number: 3 },
    { id: 'access', title: '4. Service Access and Use', number: 4 },
    { id: 'billing', title: '5. Subscriptions and Billing', number: 5 },
    { id: 'ip', title: '6. Intellectual Property', number: 6 },
    { id: 'security', title: '7. Data Protection and Security', number: 7 },
    { id: 'third', title: '8. Third Party Services', number: 8 },
    { id: 'disclaimers', title: '9. Disclaimers', number: 9 },
    { id: 'liability', title: '10. Limitation of Liability', number: 10 },
    { id: 'indemnity', title: '11. Indemnification', number: 11 },
    { id: 'termination', title: '12. Termination', number: 12 },
    { id: 'law', title: '13. Governing Law and Disputes', number: 13 },
    { id: 'changes', title: '14. Changes to These Terms', number: 14 },
    { id: 'contact', title: '15. Contact', number: 15 },
  ];

  return (
    <>
      <Helmet>
        <title>Terms of Service | RingSnap AI</title>
        <meta name="description" content="Terms of Service for RingSnap AI platform" />
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-4xl px-6 py-16 sm:py-20">
          {/* Header */}
          <header className="mb-12">
            <h1 className="text-4xl font-bold text-[#D97757] mb-2">Terms of Service</h1>
            <p className="text-sm text-gray-600">
              Effective Date: <span className="font-semibold">November 2024</span> · Last Updated: <span className="font-semibold">November 2024</span>
            </p>
          </header>

          {/* Table of Contents */}
          <nav className="mb-12 bg-[#FEF6F3] border border-[#F0E2DE] rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Contents</h2>
            <ol className="space-y-3">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-[#D97757] hover:underline transition-colors"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* Content Sections */}
          <main className="space-y-10 prose prose-sm max-w-none">
            {/* 1. Introduction */}
            <section id="intro" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
              <p className="text-gray-700 leading-relaxed">
                Welcome to RingSnap AI. These Terms of Service govern your access to and use of the RingSnap website at getringsnap.com and all related services. By using the Service you agree to these Terms and to the Privacy Policy. If you do not agree you must not use the Service.
              </p>
            </section>

            {/* 2. Eligibility */}
            <section id="eligibility" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Eligibility</h2>
              <p className="text-gray-700 leading-relaxed">
                You must be at least 18 years old and able to form a binding contract. By using the Service you represent that you meet these requirements.
              </p>
            </section>

            {/* 3. Account Registration */}
            <section id="account" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Account Registration</h2>
              <p className="text-gray-700 leading-relaxed">
                You may need an account to use the Service. You agree to provide accurate and complete information and to keep it current. You are responsible for maintaining the confidentiality of your credentials and for all activity on your account. Notify us promptly of any unauthorized use.
              </p>
            </section>

            {/* 4. Service Access and Use */}
            <section id="access" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Service Access and Use</h2>
              <p className="text-gray-700 leading-relaxed">
                RingSnap grants you a limited, non exclusive, non transferable right to access and use the Service in accordance with these Terms.
              </p>
              <div className="mt-4">
                <p className="text-gray-700 leading-relaxed font-medium">
                  Acceptable Use. You agree that you will not:
                </p>
                <ul className="mt-3 space-y-2 list-disc list-inside text-gray-700">
                  <li>Use the Service in violation of law or the rights of others.</li>
                  <li>Attempt to gain unauthorized access to the Service or related systems.</li>
                  <li>Reverse engineer or otherwise attempt to derive the source of any part of the Service where such restriction is permitted by law.</li>
                  <li>Interfere with or disrupt the integrity or performance of the Service.</li>
                </ul>
              </div>
              <p className="text-gray-700 leading-relaxed mt-4">
                RingSnap may modify, suspend, or discontinue any part of the Service. Where feasible RingSnap will provide notice of material changes.
              </p>
            </section>

            {/* 5. Subscriptions and Billing */}
            <section id="billing" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Subscriptions and Billing</h2>
              <p className="text-gray-700 leading-relaxed">
                Fees for subscriptions, overages, and add ons are charged through Stripe using the payment method you select. You authorize RingSnap and its payment processor to charge all applicable amounts.
              </p>
              <p className="text-gray-700 leading-relaxed mt-4">
                Subscriptions renew automatically unless you cancel before the renewal date. You can cancel in your account or by contacting <a href="mailto:support@getringsnap.com" className="text-[#D97757] hover:underline">support@getringsnap.com</a>. All payments are non refundable except as required by law or stated in writing by RingSnap.
              </p>
              <p className="text-gray-700 leading-relaxed mt-4">
                RingSnap may change prices with at least 30 days notice. Continued use after the effective date of the change constitutes acceptance.
              </p>
            </section>

            {/* 6. Intellectual Property */}
            <section id="ip" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Intellectual Property</h2>
              <p className="text-gray-700 leading-relaxed">
                The Service and all related materials are owned by RingSnap AI or its licensors. No ownership rights are transferred to you. You retain ownership of data you submit to the Service. You grant RingSnap a limited license to process that data only as needed to provide and improve the Service.
              </p>
            </section>

            {/* 7. Data Protection and Security */}
            <section id="security" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Data Protection and Security</h2>
              <p className="text-gray-700 leading-relaxed">
                RingSnap uses commercially reasonable safeguards to protect data, including secure hosting and encryption where appropriate. No system is perfectly secure and you are responsible for safeguarding your credentials and devices.
              </p>
            </section>

            {/* 8. Third Party Services */}
            <section id="third" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Third Party Services</h2>
              <p className="text-gray-700 leading-relaxed">
                The Service integrates with third parties that include Stripe for payments, Netlify for hosting, and Google Analytics for usage insights. Your use of third party services is subject to their terms. RingSnap is not responsible for third party practices.
              </p>
            </section>

            {/* 9. Disclaimers */}
            <section id="disclaimers" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Disclaimers</h2>
              <p className="text-gray-700 leading-relaxed">
                The Service is provided as is and as available. RingSnap disclaims all warranties to the fullest extent permitted by law, including merchantability, fitness for a particular purpose, and non infringement. RingSnap does not warrant that the Service will be uninterrupted or error free.
              </p>
            </section>

            {/* 10. Limitation of Liability */}
            <section id="liability" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Limitation of Liability</h2>
              <p className="text-gray-700 leading-relaxed">
                To the maximum extent permitted by law, RingSnap total liability for claims arising out of or related to the Service will not exceed the fees you paid in the twelve months before the event giving rise to liability. RingSnap will not be liable for indirect, incidental, special, or consequential damages, or for lost profits or lost data.
              </p>
            </section>

            {/* 11. Indemnification */}
            <section id="indemnity" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Indemnification</h2>
              <p className="text-gray-700 leading-relaxed">
                You will indemnify and hold harmless RingSnap AI and its affiliates from any claims and expenses arising from your use of the Service or your violation of these Terms.
              </p>
            </section>

            {/* 12. Termination */}
            <section id="termination" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Termination</h2>
              <p className="text-gray-700 leading-relaxed">
                RingSnap may suspend or terminate access if you breach these Terms or for security or legal reasons. Upon termination your right to use the Service ends and RingSnap may delete your data after a reasonable period consistent with the Privacy Policy.
              </p>
            </section>

            {/* 13. Governing Law and Disputes */}
            <section id="law" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Governing Law and Disputes</h2>
              <p className="text-gray-700 leading-relaxed">
                These Terms are governed by the laws of the State of Delaware without regard to conflict of law principles. The state and federal courts located in Delaware will have exclusive jurisdiction and venue. You consent to personal jurisdiction in those courts.
              </p>
            </section>

            {/* 14. Changes to These Terms */}
            <section id="changes" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">14. Changes to These Terms</h2>
              <p className="text-gray-700 leading-relaxed">
                RingSnap may update these Terms. The updated version will include a new Last Updated date. Continued use after an update means you accept the changes.
              </p>
            </section>

            {/* 15. Contact */}
            <section id="contact" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">15. Contact</h2>
              <p className="text-gray-700 leading-relaxed">
                RingSnap AI<br />
                Email: <a href="mailto:support@getringsnap.com" className="text-[#D97757] hover:underline">support@getringsnap.com</a>
              </p>
            </section>

            {/* Footer */}
            <hr className="my-8 border-gray-200" />
            <p className="text-sm text-gray-600">
              Legal entity: RingSnap AI, incorporated in Delaware, USA.
            </p>
          </main>
        </div>
      </div>

      <ContractorFooter />
    </>
  );
}

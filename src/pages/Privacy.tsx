import React from 'react';
import { Helmet } from 'react-helmet-async';
import { ContractorFooter } from '../components/ContractorFooter';

export default function Privacy() {
  const sections = [
    { id: 'intro', title: '1. Introduction', number: 1 },
    { id: 'scope', title: '2. Scope', number: 2 },
    { id: 'collect', title: '3. Information We Collect', number: 3 },
    { id: 'use', title: '4. How We Use Information', number: 4 },
    { id: 'cookies', title: '5. Cookies and Analytics', number: 5 },
    { id: 'share', title: '6. Sharing of Information', number: 6 },
    { id: 'retain', title: '7. Data Retention', number: 7 },
    { id: 'security', title: '8. Data Security', number: 8 },
    { id: 'children', title: '9. Children Privacy', number: 9 },
    { id: 'rights', title: '10. Your Rights', number: 10 },
    { id: 'transfers', title: '11. Data Transfers', number: 11 },
    { id: 'changes', title: '12. Changes to This Policy', number: 12 },
    { id: 'contact', title: '13. Contact', number: 13 },
  ];

  return (
    <>
      <Helmet>
        <title>Privacy Policy | RingSnap</title>
        <meta name="description" content="RingSnap's privacy policy explains how we collect, use, and protect your data." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://getringsnap.com/privacy" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-4xl px-6 py-16 sm:py-20">
          {/* Header */}
          <header className="mb-12">
            <h1 className="text-4xl font-bold text-[#D97757] mb-2">Privacy Policy</h1>
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
                RingSnap values your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard personal information when you visit getringsnap.com or use our services.
              </p>
            </section>

            {/* 2. Scope */}
            <section id="scope" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Scope</h2>
              <p className="text-gray-700 leading-relaxed">
                This policy applies to users in the United States and to information collected through our website and application. It does not cover third party sites or services that link to or from our site.
              </p>
            </section>

            {/* 3. Information We Collect */}
            <section id="collect" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Information We Collect</h2>
              <ul className="space-y-3 list-disc list-inside text-gray-700">
                <li>
                  <span className="font-medium">Account Information.</span> Name, email address, company name, phone number, and password that you provide when creating an account.
                </li>
                <li>
                  <span className="font-medium">Payment Information.</span> Card details and billing data collected and processed by Stripe. RingSnap does not store full card numbers.
                </li>
                <li>
                  <span className="font-medium">Usage Data.</span> IP address, device and browser data, pages viewed, and events captured through Google Analytics and application logs.
                </li>
                <li>
                  <span className="font-medium">Communications.</span> Messages, support requests, feedback, and preferences that you send to us.
                </li>
              </ul>
            </section>

            {/* 4. How We Use Information */}
            <section id="use" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. How We Use Information</h2>
              <ul className="space-y-2 list-disc list-inside text-gray-700">
                <li>Provide, operate, and maintain the Service.</li>
                <li>Process subscriptions, payments, and account changes.</li>
                <li>Respond to support requests and communicate about the Service.</li>
                <li>Monitor usage, improve performance, and enhance features.</li>
                <li>Send product updates and marketing where permitted. You can opt out of marketing at any time.</li>
                <li>Detect, prevent, and investigate security incidents and fraud.</li>
                <li>Comply with legal obligations and enforce terms.</li>
              </ul>
            </section>

            {/* 5. Cookies and Analytics */}
            <section id="cookies" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Cookies and Analytics</h2>
              <p className="text-gray-700 leading-relaxed">
                We use cookies and similar technologies to operate and analyze the Service. You can control cookies through your browser settings. Disabling cookies may limit some features.
              </p>
              <p className="text-gray-700 leading-relaxed mt-4">
                We use Google Analytics to understand aggregate usage. Google may collect or receive information from your browser or device subject to its privacy practices. You can learn about Google controls at policies.google.com.
              </p>
            </section>

            {/* 6. Sharing of Information */}
            <section id="share" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Sharing of Information</h2>
              <p className="text-gray-700 leading-relaxed">
                We do not sell or rent personal information. We share information as follows:
              </p>
              <ul className="mt-4 space-y-3 list-disc list-inside text-gray-700">
                <li>
                  <span className="font-medium">Service Providers.</span> Vendors that support our operations such as Stripe for payments, Netlify for hosting, and analytics providers. They are bound by confidentiality obligations and process data only on our instructions.
                </li>
                <li>
                  <span className="font-medium">Legal and Safety.</span> Where required by law or to protect rights, safety, or the integrity of the Service.
                </li>
                <li>
                  <span className="font-medium">Business Transfers.</span> In connection with a merger, acquisition, financing, or sale of assets, subject to appropriate safeguards.
                </li>
              </ul>
            </section>

            {/* 7. Data Retention */}
            <section id="retain" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Data Retention</h2>
              <p className="text-gray-700 leading-relaxed">
                We retain personal information for as long as needed to provide the Service, meet legal obligations, and resolve disputes. When information is no longer needed we delete or anonymize it.
              </p>
            </section>

            {/* 8. Data Security */}
            <section id="security" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Data Security</h2>
              <p className="text-gray-700 leading-relaxed">
                We use commercially reasonable safeguards such as encryption in transit, access controls, and secure hosting. No method of transmission or storage is perfectly secure.
              </p>
            </section>

            {/* 9. Children Privacy */}
            <section id="children" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Children Privacy</h2>
              <p className="text-gray-700 leading-relaxed">
                The Service is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided information please contact us so that we can delete it.
              </p>
            </section>

            {/* 10. Your Rights */}
            <section id="rights" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Your Rights</h2>
              <p className="text-gray-700 leading-relaxed">
                You may request access to, correction of, or deletion of your personal information by contacting <a href="mailto:support@getringsnap.com" className="text-[#D97757] hover:underline">support@getringsnap.com</a>. We will respond as required by applicable law.
              </p>
            </section>

            {/* 11. Data Transfers */}
            <section id="transfers" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Data Transfers</h2>
              <p className="text-gray-700 leading-relaxed">
                Information may be stored and processed in the United States. By using the Service you consent to these transfers within the scope of applicable law.
              </p>
            </section>

            {/* 12. Changes to This Policy */}
            <section id="changes" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Changes to This Policy</h2>
              <p className="text-gray-700 leading-relaxed">
                We may update this Privacy Policy. The updated version will include a new Last Updated date. Material changes may also be communicated by email or in product notice.
              </p>
            </section>

            {/* 13. Contact */}
            <section id="contact" className="scroll-mt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Contact</h2>
              <p className="text-gray-700 leading-relaxed">
                RingSnap<br />
                Email: <a href="mailto:support@getringsnap.com" className="text-[#D97757] hover:underline">support@getringsnap.com</a>
              </p>
            </section>

            {/* Footer */}
            <hr className="my-8 border-gray-200" />
            <p className="text-sm text-gray-600">
              Legal entity: RingSnap, incorporated in Delaware, USA.
            </p>
          </main>
        </div>
      </div>

      <ContractorFooter />
    </>
  );
}

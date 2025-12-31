export const metadata = {
  title: 'Terms of Service - CashFlow',
  description: 'CashFlow Terms of Service',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">
          Terms of Service
        </h1>
        
        <div className="prose prose-gray dark:prose-invert max-w-none">
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            <strong>Last updated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Acceptance of Terms
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              By accessing and using CashFlow, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Description of Service
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              CashFlow is a personal finance projection tool that helps you project future account balances based on expected transactions. The service allows you to track accounts, manage transactions, and view balance projections.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              User Accounts
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              To use CashFlow, you must create an account by signing in with Google or Apple. You are responsible for maintaining the confidentiality of your account and for all activities that occur under your account.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              User Responsibilities
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You agree to:
            </p>
            <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-2 mb-4">
              <li>Provide accurate and complete information</li>
              <li>Maintain the security of your account</li>
              <li>Use the service only for lawful purposes</li>
              <li>Not attempt to gain unauthorized access to the service</li>
              <li>Not use the service to transmit any harmful code or malware</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Financial Information
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              CashFlow is a projection tool and does not provide financial advice. The projections are estimates based on the information you provide and should not be considered as financial, legal, or tax advice. Always consult with qualified professionals for financial decisions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Service Availability
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              We strive to provide reliable service but do not guarantee uninterrupted or error-free operation. The service may be temporarily unavailable due to maintenance, updates, or unforeseen circumstances.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Limitation of Liability
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              CashFlow is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the service, including but not limited to financial losses resulting from reliance on projections.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Changes to Terms
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              We reserve the right to modify these terms at any time. We will notify users of significant changes. Continued use of the service after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Termination
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              We may terminate or suspend your account and access to the service immediately, without prior notice, for conduct that we believe violates these Terms of Service or is harmful to other users, us, or third parties.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Contact Us
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              If you have any questions about these Terms of Service, please contact us at{' '}
              <a href="mailto:cashflow@brasslogic.money" className="text-blue-600 dark:text-blue-400 hover:underline">
                cashflow@brasslogic.money
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}


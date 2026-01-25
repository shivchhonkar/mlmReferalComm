import { BarChart3, Lock, Infinity, Target } from "lucide-react";

export default function VisionPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="bg-white rounded-lg border border-gray-200 p-8 md:p-12">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-sm">
              <Target className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">Our Vision</h1>
          </div>
          
          <div className="space-y-6 text-base text-gray-800 leading-relaxed">
            <p className="text-lg font-semibold text-blue-600">
              Our vision is a transparent and scalable platform where income calculation is clear, BV-based,
              and consistent across unlimited depth.
            </p>
            <p>
              Admin controls service pricing and BV values, and all pages and calculations reflect those
              updates consistently. This ensures fairness and predictability for every network member.
            </p>
            <p>
              We envision a future where referral marketing is synonymous with trust, transparency, and mutual growth.
              Where every participant can see exactly how their efforts contribute to their income and the success of their network.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="text-center p-6 rounded-lg bg-white border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="mb-4 flex justify-center">
                <Infinity className="w-16 h-16 text-blue-600" />
              </div>
              <h3 className="font-bold text-lg mb-2 text-gray-900">Unlimited Depth</h3>
              <p className="text-sm text-gray-700">
                No arbitrary limits on network growth
              </p>
            </div>
            <div className="text-center p-6 rounded-lg bg-white border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="mb-4 flex justify-center">
                <BarChart3 className="w-16 h-16 text-blue-600" />
              </div>
              <h3 className="font-bold text-lg mb-2 text-gray-900">Real-Time Updates</h3>
              <p className="text-sm text-gray-700">
                Instant reflection of all changes
              </p>
            </div>
            <div className="text-center p-6 rounded-lg bg-white border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="mb-4 flex justify-center">
                <Lock className="w-16 h-16 text-blue-600" />
              </div>
              <h3 className="font-bold text-lg mb-2 text-gray-900">Secure & Fair</h3>
              <p className="text-sm text-gray-700">
                Built with security and fairness at core
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

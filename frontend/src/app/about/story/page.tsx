import { Gem, Sprout, BookOpen } from "lucide-react";

export default function OurStoryPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="bg-white rounded-lg border border-gray-200 p-8 md:p-12">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-sm">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">Our Story</h1>
          </div>
          
          <div className="space-y-6 text-base text-gray-800 leading-relaxed">
            <p className="text-lg font-semibold text-blue-600">
              ReferGrow is built around a simple yet powerful idea: reward community growth using Business Volume (BV)
              so that every purchase can contribute to structured, level-wise income.
            </p>
            <p>
              The platform is open to everyone. Users can join, purchase services, and build their network
              while the system automatically tracks BV and distributes income along the upline.
            </p>
            <p>
              Our journey began with a vision to create a transparent, fair, and sustainable referral system
              that benefits all participants. By leveraging blockchain-inspired transparency and modern technology,
              we’ve built a platform where trust and growth go hand in hand.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="p-6 rounded-lg bg-white border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="mb-4 flex justify-center">
                <Sprout className="w-12 h-12 text-green-600" />
              </div>
              <h3 className="font-bold text-lg mb-2 text-gray-900 text-center">Community First</h3>
              <p className="text-sm text-gray-700 text-center">
                We believe in empowering every member of our community to achieve financial growth through collaboration.
              </p>
            </div>
            <div className="p-6 rounded-lg bg-white border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="mb-4 flex justify-center">
                <Gem className="w-12 h-12 text-blue-600" />
              </div>
              <h3 className="font-bold text-lg mb-2 text-gray-900 text-center">Transparency</h3>
              <p className="text-sm text-gray-700 text-center">
                Every transaction, every BV distribution, every income calculation is clear and verifiable.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { BookOpen, Target, Star } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            About <span className="text-blue-600">ReferGrow</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Discover our mission, vision, and the success stories that define our community
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Link 
            className="bg-white rounded-lg border border-gray-200 p-8 hover:shadow-md transition-shadow group" 
            prefetch={false}
            href="/about/story"
          >
            <div className="w-14 h-14 mx-auto mb-6 rounded-lg bg-blue-100 flex items-center justify-center group-hover:scale-110 transition-transform">
              <BookOpen className="w-7 h-7 text-blue-600" />
            </div>
            <div className="text-center">
              <h2 className="font-bold text-xl text-gray-900 mb-3">Our Story</h2>
              <p className="text-sm text-gray-600">
                Learn how ReferGrow was built to empower communities through transparent reward systems
              </p>
            </div>
          </Link>

          <Link 
            className="bg-white rounded-lg border border-gray-200 p-8 hover:shadow-md transition-shadow group" 
            prefetch={false}
            href="/about/vision"
          >
            <div className="w-14 h-14 mx-auto mb-6 rounded-lg bg-blue-100 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Target className="w-7 h-7 text-blue-600" />
            </div>
            <div className="text-center">
              <h2 className="font-bold text-xl text-gray-900 mb-3">Vision</h2>
              <p className="text-sm text-gray-600">
                Explore our vision for a transparent, scalable platform that rewards network growth
              </p>
            </div>
          </Link>

          <Link
            className="bg-white rounded-lg border border-gray-200 p-8 hover:shadow-md transition-shadow group"
            prefetch={false}
            href="/about/success-stories"
          >
            <div className="w-14 h-14 mx-auto mb-6 rounded-lg bg-blue-100 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Star className="w-7 h-7 text-blue-600" />
            </div>
            <div className="text-center">
              <h2 className="font-bold text-xl text-gray-900 mb-3">Success Stories</h2>
              <p className="text-sm text-gray-600">
                Read inspiring stories from our thriving community members
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

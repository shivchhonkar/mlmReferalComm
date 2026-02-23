"use client";

import Link from "next/link";
import {
  Rocket,
  IndianRupee,
  TrendingUp,
  Network,
  ShieldCheck,
  Users,
} from "lucide-react";
import ImageSlider from "@/app/_components/ImageSlider";
import LandingContentSections from "@/app/_components/LandingContentSections";
import LandingHero from "@/app/_components/LandingHero";
import Image from "next/image";
import { useState, useEffect } from "react";

export default function Home() {
  const [sliderUpdate, setSliderUpdate] = useState(0);

  // Listen for slider updates from admin panel
  useEffect(() => {
    const handleStorageChange = () => {
      setSliderUpdate(prev => prev + 1);
    };

    // Listen for storage changes (when admin updates sliders)
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />
      {/* Hero Section with Slider */}
      <section className="relative h-[50vh] sm:h-[65vh] md:h-[65vh] max-h-[600px] sm:max-h-[900px]">
        {/* <ImageSlider 
          key={sliderUpdate}
          className="w-full h-full"
          autoPlay={true}
          interval={5000}
          showControls={true}
          showIndicators={true}
          externalUpdate={sliderUpdate}
        /> */}
        <Image
          src="/brand/banner2.jpg"
          alt="Hero Image"
          fill
          className="object-cover h-full w-full"
        />
      </section>

      {/* Hero Content Section */}
      <LandingHero />
      {/* Content Sections */}
      <LandingContentSections />
    </div>
  );
}

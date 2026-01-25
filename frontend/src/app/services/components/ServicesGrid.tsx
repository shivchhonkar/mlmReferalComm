import ServiceCard from "./ServiceCard";
import type { Service } from "@/store/slices/serviceSlice";

interface ServicesGridProps {
  services: Service[];
}

export default function ServicesGrid({ services }: ServicesGridProps) {
  return (
    <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {services.map((service) => (
        <ServiceCard key={service._id} service={service} />
      ))}
      
      {/* Empty State */}
      {services.length === 0 && (
        <div className="col-span-full text-center py-20">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-zinc-100 mb-6">
            <div className="w-10 h-10 text-zinc-600">📦</div>
          </div>
          <h3 className="text-2xl font-bold text-zinc-900 mb-3">
            No Services Available
          </h3>
          <p className="text-lg text-zinc-600 max-w-md mx-auto">
            We're currently updating our service catalog. Please check back soon for exciting new offerings!
          </p>
        </div>
      )}
    </div>
  );
}

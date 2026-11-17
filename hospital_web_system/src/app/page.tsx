import { CtaSection } from "@/components/public/cta-section";
import { FacilitiesSection } from "@/components/public/facilities-section";
import { HeroSection } from "@/components/public/hero-section";
import { JourneySection } from "@/components/public/journey-section";
import { ServicesSection } from "@/components/public/services-section";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <HeroSection />
        <ServicesSection />
        <JourneySection />
        <FacilitiesSection />
        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}

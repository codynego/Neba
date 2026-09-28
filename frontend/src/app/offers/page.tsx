import { NearbyList } from "@/components/nearby-list";
import { LoadingCards } from "@/components/loading-cards";
import { Suspense } from "react";
export default function OffersPage() { return <Suspense fallback={<main className="listing-page container"><LoadingCards people /></main>}><NearbyList people /></Suspense>; }

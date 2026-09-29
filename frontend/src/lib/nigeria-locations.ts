export type NigerianLocation = { city: string; state: string; neighborhoods: string[] };

export const nigeriaLocations: NigerianLocation[] = [
  { city: "Abuja", state: "FCT", neighborhoods: ["Asokoro", "Garki", "Gwarinpa", "Jabi", "Maitama", "Wuse"] },
  { city: "Abeokuta", state: "Ogun", neighborhoods: ["Adigbe", "Ijaye", "Kuto", "Leme", "Oke-Ilewo"] },
  { city: "Akure", state: "Ondo", neighborhoods: ["Alagbaka", "Futa South Gate", "Ijapo", "Oke-Ijebu"] },
  { city: "Benin City", state: "Edo", neighborhoods: ["Ekosodin", "GRA", "Ikpoba Hill", "Ugbowo", "Use"] },
  { city: "Enugu", state: "Enugu", neighborhoods: ["GRA", "Independence Layout", "New Haven", "Ogui", "Uwani"] },
  { city: "Ibadan", state: "Oyo", neighborhoods: ["Bodija", "Dugbe", "Jericho", "Mokola", "Oluyole"] },
  { city: "Ikeja", state: "Lagos", neighborhoods: ["Alausa", "Allen", "Maryland", "Opebi", "Oregun"] },
  { city: "Ilorin", state: "Kwara", neighborhoods: ["Fate", "GRA", "Tanke", "Unity", "Yidi"] },
  { city: "Kaduna", state: "Kaduna", neighborhoods: ["Barnawa", "Kawo", "Kakuri", "Malali", "Ungwan Rimi"] },
  { city: "Kano", state: "Kano", neighborhoods: ["Fagge", "Nassarawa", "Tarauni", "Wuse", "Zoo Road"] },
  { city: "Lagos", state: "Lagos", neighborhoods: ["Ajah", "Ikeja GRA", "Lekki", "Surulere", "Yaba"] },
  { city: "Owerri", state: "Imo", neighborhoods: ["Ikenegbu", "New Owerri", "Orji", "World Bank"] },
  { city: "Port Harcourt", state: "Rivers", neighborhoods: ["GRA", "Rumuola", "Trans Amadi", "Woji"] },
  { city: "Uyo", state: "Akwa Ibom", neighborhoods: ["Ewet", "Ibom Plaza", "Shelter Afrique", "Udo Udoma"] },
  { city: "Warri", state: "Delta", neighborhoods: ["Effurun", "GRA", "Okumagba", "Ugbuwangue"] },
];

export function citySuggestions(query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  return nigeriaLocations.filter(({ city, state }) => !normalized || `${city} ${state}`.toLocaleLowerCase().includes(normalized)).slice(0, 7);
}

export function neighborhoodSuggestions(city: string, query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  const selectedCity = nigeriaLocations.find((item) => item.city.toLocaleLowerCase() === city.trim().toLocaleLowerCase());
  const source = selectedCity ? selectedCity.neighborhoods : nigeriaLocations.flatMap((item) => item.neighborhoods);
  return [...new Set(source)].filter((name) => !normalized || name.toLocaleLowerCase().includes(normalized)).slice(0, 7);
}

"use client";

import { KeyboardEvent, useId, useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import { citySuggestions, neighborhoodSuggestions } from "@/lib/nigeria-locations";

type LocationSuggestionInputProps = {
  city?: string;
  kind: "city" | "neighborhood";
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
};

export function LocationSuggestionInput({ city = "", kind, label, onChange, placeholder, value }: LocationSuggestionInputProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = useId();
  const cityOptions = citySuggestions(value);
  const neighborhoodOptions = neighborhoodSuggestions(city, value);
  const options = kind === "city" ? cityOptions : neighborhoodOptions;
  const select = (nextValue: string) => { onChange(nextValue); setOpen(false); setActiveIndex(-1); };

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!options.length) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(index + 1, options.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.max(index - 1, 0)); }
    if (event.key === "Enter" && open && activeIndex >= 0) { event.preventDefault(); select(kind === "city" ? cityOptions[activeIndex].city : neighborhoodOptions[activeIndex]); }
    if (event.key === "Escape") { setOpen(false); setActiveIndex(-1); }
  }

  return <label className="location-suggestion">
    <span>{label}</span>
    <div className="location-suggestion-control">
      {kind === "city" ? <MapPin size={16} /> : <Navigation size={16} />}
      <input role="combobox" aria-autocomplete="list" aria-controls={listId} aria-expanded={open} aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined} placeholder={placeholder} value={value} onChange={(event) => { onChange(event.target.value); setOpen(true); setActiveIndex(-1); }} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 120)} onKeyDown={onKeyDown} />
    </div>
    {open && options.length > 0 && <div className="location-suggestion-list" id={listId} role="listbox" aria-label={`${label} suggestions`}>
      <p>{kind === "city" ? "Suggested cities" : city ? `Neighborhoods in ${city}` : "Choose a city for closer matches"}</p>
      {kind === "city" ? cityOptions.map((option, index) => <button type="button" role="option" aria-selected={activeIndex === index} className={activeIndex === index ? "active" : ""} id={`${listId}-${index}`} key={`${option.city}-${option.state}`} onMouseDown={(event) => event.preventDefault()} onClick={() => select(option.city)}><span>{option.city}</span><small>{option.state}</small></button>) : neighborhoodOptions.map((name, index) => <button type="button" role="option" aria-selected={activeIndex === index} className={activeIndex === index ? "active" : ""} id={`${listId}-${index}`} key={name} onMouseDown={(event) => event.preventDefault()} onClick={() => select(name)}><span>{name}</span></button>)}
    </div>}
  </label>;
}

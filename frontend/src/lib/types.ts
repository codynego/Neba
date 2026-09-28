export type Category = "errands" | "moving" | "events" | "tutoring" | "tech" | "other";
export type User = { id: number; username: string; display_name: string; city: string; state: string };
export type Task = {
  id: number; requester: number; requester_name: string; title: string; description: string;
  category: Category; city: string; state: string; neighborhood: string;
  reward_amount: string; reward_note: string; scheduled_for: string | null;
  status: "open" | "assigned" | "completed" | "cancelled"; application_count: number; created_at: string;
};
export type Offer = {
  id: number; provider: number; provider_name: string; title: string; description: string;
  category: Category; city: string; state: string; starting_price: string; active: boolean; created_at: string;
};
export type Application = {
  id: number; task: number; task_title: string; applicant: number; applicant_name: string;
  message: string; contact_phone: string; status: "pending" | "accepted" | "declined"; created_at: string;
};
export type Page<T> = { count: number; next: string | null; previous: string | null; results: T[] };
export const categories: { value: Category | ""; label: string }[] = [
  { value: "", label: "All categories" },
  { value: "errands", label: "Errands" },
  { value: "moving", label: "Moving & assembly" },
  { value: "events", label: "Event help" },
  { value: "tutoring", label: "Tutoring" },
  { value: "tech", label: "Tech help" },
  { value: "other", label: "Other" },
];
export const naira = (value: string | number) => "â‚¦" + Number(value).toLocaleString("en-NG", { maximumFractionDigits: 0 });


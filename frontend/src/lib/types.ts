export type Category = "errands" | "moving" | "events" | "tutoring" | "tech" | "other";
export type Trust = { phone_verified: boolean; identity_verified: boolean; photo_available?: boolean; profile_complete?: boolean; review_count?: number; rating?: number | null };
export type Availability = "flexible" | "weekdays" | "evenings" | "weekends" | "unavailable";
export type ItemType = "documents" | "food" | "clothing" | "electronics" | "furniture" | "other";
export type User = Trust & { id: number; username: string; display_name: string; city: string; state: string; phone?: string; photo_visible?: boolean; bio: string; skills: Category[]; neighborhood: string; address: string; latitude: string | null; longitude: string | null; availability: Availability };
export type Task = {
  id: number; requester: number; requester_name: string; title: string; description: string;
  category: Category; city: string; state: string; neighborhood: string;
  reward_amount: string; reward_note: string; scheduled_for: string | null;
  involves_item: boolean; item_type: ItemType | ""; item_value: string | null; item_already_paid: boolean;
  risk_level: "low" | "medium" | "high"; moderation_status: "approved" | "held" | "rejected"; moderation_reason: string;
  status: "open" | "assigned" | "completed" | "cancelled"; application_count: number; created_at: string; requester_trust?: Trust;
  is_private: boolean; target_helper: number | null; target_helper_name: string; requested_offer: number | null; has_booking: boolean;
};
export type Offer = {
  id: number; provider: number; provider_name: string; title: string; description: string;
  category: Category; city: string; state: string; starting_price: string; active: boolean; created_at: string; provider_trust?: Trust;
  provider_availability?: Availability; provider_neighborhood?: string;
};
export type Application = {
  id: number; task: number; task_title: string; applicant: number; applicant_name: string;
  message: string; contact_phone: string; status: "pending" | "accepted" | "declined" | "withdrawn"; created_at: string; applicant_trust?: Trust;
};
export type TaskChange = { id: number; proposer: number; kind: "complete" | "cancel" | "reschedule"; reason: string; scheduled_for: string | null; status: "pending" | "accepted" | "declined" | "withdrawn"; created_at: string };
export type TaskIssue = { id: number; reporter: number; kind: "no_show" | "dispute"; details: string; status: "open" | "reviewing" | "resolved"; outcome: string; resolution: string; created_at: string };
export type TaskMessage = { id: number; sender: number; sender_name: string; text: string; client_id: string; created_at: string };
export type Workspace = { task: Task; my_role: "helper" | "requester"; member: Trust & { id: number; display_name: string }; can_message: boolean; contact_phone: string; pending_change: TaskChange | null; active_issue: TaskIssue | null; changes: TaskChange[]; issues: TaskIssue[] };
export type Notification = { id: number; title: string; detail: string; path: string; read_at: string | null; created_at: string };
export type Conversation = { task_id: number; title: string; status: Task["status"]; member: Trust & { id: number; display_name: string }; last_message: string; last_message_at: string | null; updated_at: string };
export type MemberProfile = Trust & { id: number; display_name: string; city: string; state: string; neighborhood: string; bio: string; skills: Category[]; availability: Availability; completed_tasks: number; offers: Offer[]; reviews: { rating: number; comment: string; created_at: string }[] };
export const availabilityLabels: Record<Availability, string> = { flexible: "Flexible", weekdays: "Weekdays", evenings: "Evenings", weekends: "Weekends", unavailable: "Not taking work" };
export const itemTypeLabels: Record<ItemType, string> = { documents: "Documents", food: "Food or groceries", clothing: "Clothing", electronics: "Electronics", furniture: "Furniture", other: "Other" };
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
export const naira = (value: string | number) => "₦" + Number(value).toLocaleString("en-NG", { maximumFractionDigits: 0 });


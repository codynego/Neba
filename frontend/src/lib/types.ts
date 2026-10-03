export type Category = "errands" | "moving" | "events" | "tutoring" | "tech" | "other";
export type Trust = { phone_verified: boolean; identity_verified: boolean; public_id?: string; username?: string; photo_available?: boolean; profile_complete?: boolean; review_count?: number; rating?: number | null };
export type Availability = "flexible" | "weekdays" | "evenings" | "weekends" | "unavailable";
export type ItemType = "documents" | "food" | "clothing" | "electronics" | "furniture" | "other";
export type RewardType = "money" | "food" | "item" | "skill" | "service" | "exchange" | "combination" | "other";
export type User = Trust & { id: number; public_id: string; username: string; email: string; email_verified: boolean; nearby_task_emails: boolean; display_name: string; city: string; state: string; phone?: string; photo_visible?: boolean; bio: string; skills: Category[]; neighborhood: string; address: string; latitude: string | null; longitude: string | null; availability: Availability };
export type Task = {
  id: number; public_id: string; requester: number; requester_public_id?: string; requester_username?: string; requester_name: string; title: string; description: string;
  category: Category; city: string; state: string; neighborhood: string;
  reward_type: RewardType; reward_amount: string | null; reward_note: string; scheduled_for: string | null;
  is_recurring: boolean; helpers_needed: number; accepted_count: number; my_booking?: boolean; my_application?: { public_id: string; status: Application["status"]; has_unread_message: boolean } | null;
  involves_item: boolean; item_type: ItemType | ""; item_value: string | null; item_already_paid: boolean;
  risk_level: "low" | "medium" | "high"; moderation_status: "approved" | "held" | "rejected"; moderation_reason: string;
  status: "open" | "assigned" | "completed" | "cancelled"; application_count: number; created_at: string; requester_trust?: Trust;
  photo_count: number;
  is_private: boolean; target_helper: number | null; target_helper_name: string; requested_offer: number | null; has_booking: boolean;
};
export type Offer = {
  id: number; public_id: string; provider: number; provider_public_id?: string; provider_username?: string; provider_name: string; title: string; description: string;
  category: Category; city: string; state: string; starting_price: string; active: boolean; created_at: string; provider_trust?: Trust;
  photo_count: number;
  provider_availability?: Availability; provider_neighborhood?: string;
};
export type Application = {
  id: number; public_id: string; task: number; task_public_id?: string; task_title: string; applicant: number; applicant_public_id?: string; applicant_username?: string; applicant_name: string;
  message: string; booking_note: string; contact_phone: string; status: "pending" | "shortlisted" | "offered" | "accepted" | "declined" | "withdrawn"; created_at: string; applicant_trust?: Trust;
};
export type MessageAttachment = { key: string; name: string; content_type: string; size: number };
export type ApplicationMessage = { id: number; sender: number; sender_name: string; text: string; attachments: MessageAttachment[]; client_id: string; created_at: string };
export type TaskChange = { id: number; proposer: number; kind: "complete" | "cancel" | "reschedule"; reason: string; scheduled_for: string | null; status: "pending" | "accepted" | "declined" | "withdrawn"; created_at: string };
export type TaskIssue = { id: number; reporter: number; kind: "no_show" | "dispute"; details: string; status: "open" | "reviewing" | "resolved"; outcome: string; resolution: string; created_at: string };
export type TaskMessage = { id: number; sender: number; sender_name: string; text: string; attachments: MessageAttachment[]; client_id: string; created_at: string };
export type Workspace = { task: Task; my_role: "helper" | "requester"; member: Trust & { id: number; display_name: string }; members?: Array<Trust & { id: number; display_name: string }>; can_message: boolean; contact_phone: string; booking_completed: boolean; pending_change: TaskChange | null; active_issue: TaskIssue | null; changes: TaskChange[]; issues: TaskIssue[] };
export type Notification = { id: number; title: string; detail: string; path: string; read_at: string | null; created_at: string };
export type Conversation = { task_id: number; task_public_id?: string; title: string; status: Task["status"]; member: Trust & { id: number; display_name: string }; last_message: string; last_message_at: string | null; updated_at: string };
export type MemberReview = { rating: number; comment: string; created_at: string; reviewer_username: string; reviewer_public_id: string; reviewer_photo_available: boolean };
export type MemberProfile = Trust & { id: number; public_id: string; username: string; display_name: string; city: string; state: string; neighborhood: string; bio: string; skills: Category[]; availability: Availability; completed_tasks: number; offers: Offer[]; reviews: MemberReview[] };
export const availabilityLabels: Record<Availability, string> = { flexible: "Flexible", weekdays: "Weekdays", evenings: "Evenings", weekends: "Weekends", unavailable: "Not taking work" };
export const itemTypeLabels: Record<ItemType, string> = { documents: "Documents", food: "Food or groceries", clothing: "Clothing", electronics: "Electronics", furniture: "Furniture", other: "Other" };
export const rewardTypeLabels: Record<RewardType, string> = { money: "Money", food: "Food", item: "Item / goods", skill: "Skill / knowledge", service: "Service", exchange: "Exchange / barter", combination: "Combination", other: "Other" };
export type Page<T> = { count: number; next: string | null; previous: string | null; results: T[] };
export type Business = { id: number; name: string; service_type: string; city: string; phone: string; slug: string; job_count: number; created_at: string; updated_at: string };
export type Customer = { id: number; business: number; name: string; phone: string; address: string; notes: string; created_at: string };
export type JobStatus = "new" | "quoted" | "confirmed" | "in_progress" | "completed" | "cancelled";
export type Job = { id: number; business: number; customer: number; customer_name: string; customer_phone: string; title: string; description: string; address: string; requested_for: string | null; assignee_name: string; status: JobStatus; quote_amount: string | null; deposit_amount: string; amount_paid: string; payment_status: "unpaid" | "partial" | "paid"; balance_due: string; source: string; ai_summary: string; created_at: string; updated_at: string };
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
export function rewardLabel(reward: Pick<Task, "reward_type" | "reward_amount" | "reward_note">) {
  const cash = reward.reward_amount ? naira(reward.reward_amount) : "";
  if (reward.reward_type === "money") return cash;
  if (reward.reward_type === "combination" && cash) return `${cash} + ${reward.reward_note}`;
  return reward.reward_note;
}


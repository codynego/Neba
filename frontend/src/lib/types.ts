export type Category = "errands" | "moving" | "events" | "tutoring" | "tech" | "other";
export type Trust = { phone_verified: boolean; identity_verified: boolean; public_id?: string; username?: string; photo_available?: boolean; profile_complete?: boolean; review_count?: number; rating?: number | null };
export type Availability = "flexible" | "weekdays" | "evenings" | "weekends" | "unavailable";
export type ItemType = "documents" | "food" | "clothing" | "electronics" | "furniture" | "other";
export type RewardType = "money" | "food" | "item" | "skill" | "service" | "exchange" | "combination" | "other";
export type ProfileDocument = { public_id: string; document_type: string; document_type_label: string; name: string; content_type: string; size: number; created_at: string; download_url: string | null };
export type User = Trust & { id: number; public_id: string; username: string; email: string; email_verified: boolean; onboarding_complete?: boolean; nearby_task_emails: boolean; display_name: string; city: string; state: string; phone?: string; photo_visible?: boolean; bio: string; skills: string[]; neighborhood: string; address: string; latitude: string | null; longitude: string | null; availability: Availability; date_of_birth: string | null; gender: string; country: string; relocation_preference: "not_set" | "no" | "open" | "active"; relocation_countries: string[]; education_level: string; field_of_study: string; institution: string; graduation_year: number | null; gpa: string; employment_status: string; years_experience: string; industry: string; opportunity_interests: string[]; goals: string[]; business_status: string; financial_need: string; business_name: string; business_industry: string; business_description: string; business_website: string };
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
export type OpportunityCategory = "scholarship" | "grant" | "job" | "internship" | "fellowship" | "competition" | "training" | "startup" | "funding" | "tender";
export type OpportunityMatch = { score: number; eligibility: "eligible" | "likely" | "check" | "unlikely"; confidence: "high" | "medium" | "low"; reasons: string[]; missing: string[]; breakdown: { eligibility: number; interests: number; experience: number; location: number; activity: number }; version: "v3" };
export type Opportunity = { public_id: string; title: string; provider: string; summary: string; category: OpportunityCategory; application_mode: "internal" | "external"; application_channel: "website" | "email" | "phone"; application_url: string; application_email: string; application_phone: string; deadline: string | null; country: string; location_label: string; is_remote: boolean; requires_physical_presence: boolean; requires_local_residency: boolean; benefit: string; eligibility_notes: string; eligible_countries?: string[]; education_levels?: string[]; fields_of_study?: string[]; employment_statuses?: string[]; min_age?: number | null; max_age?: number | null; requires_business?: boolean; tracker_only?: boolean; source_url?: string; share_note?: string; view_count: number; application_count: number; thanks_count: number; thanked_by_me: boolean; created_at?: string; updated_at?: string; match: OpportunityMatch | null; saved_status: string | null; application_status: string | null; verification?: { kind: "neba" | "organization"; label: string } | null; contributor?: { name: string; public_id: string; identity_checked: boolean } | null };
export type SavedOpportunity = { id: number; opportunity_id: string; opportunity: Opportunity; status: string; note: string; saved_at: string; updated_at: string };
export type OpportunityMessage = { id: number; sender: number; sender_name: string; text: string; created_at: string; is_mine?: boolean };
export type OpportunityApplication = { id: number; public_id: string; opportunity_id: string; opportunity: Opportunity; status: string; applied_at: string | null; next_action: string; next_action_at: string | null; notes: string; application_message: string; additional_information: string; shared_fields: string[]; shared_profile: { profile?: { name: string; country: string; city: string; bio: string }; skills?: string[]; experience?: string; education?: { level: string; institution: string; field: string; graduation_year: number | null }; business?: { name: string; stage: string; industry: string; description: string; website: string }; documents?: { name: string; type: string; created_at: string }[] }; applicant_name: string; is_poster: boolean; messages: OpportunityMessage[]; unread_message_count: number; unread_activity_count: number; created_at: string; updated_at: string };
export type OpportunityCheckClaim = { claim: string; assessment: "confirmed" | "corroborated" | "unconfirmed" | "contradicted" | "not_applicable"; evidence_summary: string; source_url: string; source_authority: string };
export type OpportunityCheckSource = { url: string; title: string; authority: string; supports: string };
export type OpportunityCheckSignal = { key: string; status: "pass" | "warning" | "review"; label: string; detail: string };
export type OpportunityCheck = { public_id: string; input_type: "url" | "text"; submitted_url: string; submitted_text: string; status: "pending" | "completed" | "failed"; verdict: "confirmed" | "supported" | "suspicious" | "unable" | ""; evidence_confidence: "high" | "medium" | "low" | ""; risk_level: "high" | "medium" | "low" | ""; title: string; organization: string; opportunity_type: string; report_summary: string; recommended_action: string; deterministic_checks: OpportunityCheckSignal[]; claims: OpportunityCheckClaim[]; sources: OpportunityCheckSource[]; warnings: string[]; extracted_data: { resolved_url?: string; official_source_found?: boolean; application_route?: string }; failure_reason: string; checked_at: string | null; created_at: string };
export type OpportunityDashboard = { match_count: number; new_this_week: number; upcoming_deadlines: number; application_summary: Record<string, number>; top_matches: Opportunity[]; urgent: Opportunity[]; saved: SavedOpportunity[]; applications: OpportunityApplication[]; profile_completion: number; missing_profile_fields: string[]; readiness: { profile: boolean; eligibility: boolean; statement: boolean; interview: boolean } };
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

import Link from "next/link";
import { ArrowUpRight, MapPin, Clock3 } from "lucide-react";
import { Task, categories, rewardLabel, rewardTypeLabels } from "@/lib/types";
import { CategoryIcon } from "./category-icon";
import { TrustBadges } from "./trust";
import { ListingPhotoGallery } from "./listing-photos";
export function TaskCard({ task }: { task: Task }) {
  const category = categories.find((item) => item.value === task.category)?.label || "Task";
  return <Link href={`/tasks/${task.public_id || task.id}`} className="task-card">
    <div className="task-card-top"><CategoryIcon category={task.category} /><span className="task-location"><MapPin size={13} />{task.neighborhood || task.city}</span><ArrowUpRight className="card-arrow" size={18} /></div>
    <ListingPhotoGallery kind="tasks" id={task.public_id || task.id} count={task.photo_count} compact title={task.title} />
    <span className="card-category">{category}</span><h3>{task.title}</h3><p className="task-card-desc">{task.description}</p>
    <div className="task-card-meta"><span><Clock3 size={14} />{task.scheduled_for ? new Date(task.scheduled_for).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "Flexible timing"}</span></div>
    <div className="task-card-bottom"><div><small>{rewardTypeLabels[task.reward_type] || "Task reward"}</small><strong>{rewardLabel(task)}</strong></div><span className="status-pill">Open task</span></div>
    <div className="card-person"><span className="mini-avatar">{(task.requester_name || "N").charAt(0).toUpperCase()}</span><span>Posted by <strong>{task.requester_name || "a neighbor"}</strong></span></div>
    <TrustBadges trust={task.requester_trust} />
  </Link>;
}

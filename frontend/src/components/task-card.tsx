import Link from "next/link";
import { ArrowUpRight, MapPin, Clock3 } from "lucide-react";
import { Task, categories, naira } from "@/lib/types";
export function TaskCard({ task }: { task: Task }) {
  const category = categories.find((item) => item.value === task.category)?.label || "Task";
  return <Link href={`/tasks/${task.id}`} className="task-card">
    <div className="task-card-top"><span className="category-pill">{category}</span><ArrowUpRight size={20} /></div>
    <h3>{task.title}</h3><p className="task-card-desc">{task.description}</p>
    <div className="task-card-meta"><span><MapPin size={15} /> {task.neighborhood ? `${task.neighborhood}, ` : ""}{task.city}</span><span><Clock3 size={15} /> {task.scheduled_for ? new Date(task.scheduled_for).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : "Flexible"}</span></div>
    <div className="task-card-bottom"><strong>{naira(task.reward_amount)}</strong><span>View task <ArrowUpRight size={15} /></span></div>
  </Link>;
}

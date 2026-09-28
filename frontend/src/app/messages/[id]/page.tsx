"use client";
import { use } from "react";
import { TaskConversation } from "@/components/task-conversation";
export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TaskConversation key={id} taskId={Number(id)} />;
}

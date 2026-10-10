import { redirect } from "next/navigation";
import { Suspense } from "react";

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; spaceId: string; taskId: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <TaskRedirect params={params} />
    </Suspense>
  );
}

async function TaskRedirect({
  params,
}: {
  params: Promise<{ id: string; spaceId: string; taskId: string }>;
}) {
  const { id, spaceId } = await params;
  redirect(`/workspaces/${id}/spaces/${spaceId}`);
  return null;
}

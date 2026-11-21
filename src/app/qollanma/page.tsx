import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import GuideCenter from "@/components/guide/GuideCenter";

export default async function GuidePage({ searchParams }: { searchParams: Promise<{ lesson?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  return <GuideCenter userId={user.id} canEdit={user.role === "SHOP_ADMIN"} initialLessonId={params.lesson} />;
}

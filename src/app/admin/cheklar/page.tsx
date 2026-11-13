import { getCurrentUser } from "@/lib/auth";
import { isMax } from "@/lib/plans";
import ReceiptsPage from "@/components/pos/ReceiptsPage";
export default async function ChecksPage() {
  const user = await getCurrentUser();
  return (
    <ReceiptsPage
      canUpgrade={user?.role === "SHOP_ADMIN"}
      canExport={
        user?.role === "SUPER_ADMIN" ||
        (user?.role === "SHOP_ADMIN" && isMax(user.planCode))
      }
    />
  );
}

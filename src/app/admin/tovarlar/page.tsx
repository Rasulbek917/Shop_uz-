import { Barcode, Boxes, History, PackagePlus, Tags } from "lucide-react";
import ModuleHub from "@/components/pos/ModuleHub";

export default function ProductsMenu() {
  return <ModuleHub title="Tovarlar menyusi" subtitle="Mahsulot, narx, kategoriya va yorliqlar" tiles={[
    { label: "Tovarlar ro‘yxati", href: "/admin/mahsulotlar", icon: Boxes, description: "Narxlar va qoldiqlar" },
    { label: "Tovar qo‘shish", href: "/admin/mahsulotlar?new=1", icon: PackagePlus, description: "Yangi mahsulot yaratish" },
    { label: "Kategoriyalar", href: "/admin/kategoriyalar", icon: Tags },
    { label: "Shtrix-kod va yorliqlar", href: "/admin/shtrix-kodlar", icon: Barcode },
    { label: "Tovar harakati", href: "/admin/ombor", icon: History },
  ]} />;
}

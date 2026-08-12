"use client";
import { usePathname } from "next/navigation";
import { Users } from "lucide-react";
export function CloudShortcut(){const path=usePathname();if(path!=="/")return null;return <a className="cloud-admin-shortcut" href="/team"><Users size={15}/>团队与云端</a>}

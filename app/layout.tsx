import type { Metadata } from "next";
import "./globals.css";
import "./news.css";
import { CloudShortcut } from "./cloud-shortcut";

export const metadata: Metadata = {
  title: "墨子 · 内容工厂",
  description: "AI 内容生产与多平台发布工作台原型",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}<CloudShortcut/></body>
    </html>
  );
}

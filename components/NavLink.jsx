"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NavLink = ({ link }) => {
  const pathName = usePathname();
  const isAskAI = link.title.toLowerCase() === "ask my ai";

  return (
    <Link 
      className={`rounded p-1 ${
        pathName === link.url 
          ? "bg-black text-white" 
          : isAskAI 
            ? "bg-blue-500 text-white hover:bg-blue-600 transition-colors" 
            : "hover:bg-gray-200 transition-colors"
      } ${isAskAI ? "animate-pulse" : ""}`} 
      href={link.url}
    >
      {isAskAI ? "🤖 " : ""}{link.title}
    </Link>
  );
};

export default NavLink;

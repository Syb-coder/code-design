"use client";

import { ScrollFadeList } from "@/components/ui/scroll-fade-list";

const teams = [
  { code: "za", flag: "🇿🇦", name: "South Africa" },
  { code: "ca", flag: "🇨🇦", name: "Canada" },
  { code: "br", flag: "🇧🇷", name: "Brazil" },
  { code: "jp", flag: "🇯🇵", name: "Japan" },
  { code: "de", flag: "🇩🇪", name: "Germany" },
  { code: "py", flag: "🇵🇾", name: "Paraguay" },
  { code: "nl", flag: "🇳🇱", name: "Netherlands" },
  { code: "ma", flag: "🇲🇦", name: "Morocco" },
  { code: "ci", flag: "🇨🇮", name: "Ivory Coast" },
  { code: "no", flag: "🇳🇴", name: "Norway" },
  { code: "fr", flag: "🇫🇷", name: "France" },
  { code: "se", flag: "🇸🇪", name: "Sweden" },
  { code: "mx", flag: "🇲🇽", name: "Mexico" },
  { code: "ec", flag: "🇪🇨", name: "Ecuador" },
  { code: "en", flag: "🏴", name: "England" },
  { code: "cd", flag: "🇨🇩", name: "DR Congo" },
  { code: "be", flag: "🇧🇪", name: "Belgium" },
  { code: "sn", flag: "🇸🇳", name: "Senegal" },
  { code: "us", flag: "🇺🇸", name: "United States" },
  { code: "ba", flag: "🇧🇦", name: "Bosnia and Herzegovina" },
  { code: "es", flag: "🇪🇸", name: "Spain" },
  { code: "at", flag: "🇦🇹", name: "Austria" },
  { code: "pt", flag: "🇵🇹", name: "Portugal" },
  { code: "hr", flag: "🇭🇷", name: "Croatia" },
  { code: "ch", flag: "🇨🇭", name: "Switzerland" },
  { code: "dz", flag: "🇩🇿", name: "Algeria" },
  { code: "au", flag: "🇦🇺", name: "Australia" },
  { code: "eg", flag: "🇪🇬", name: "Egypt" },
  { code: "ar", flag: "🇦🇷", name: "Argentina" },
  { code: "cv", flag: "🇨🇻", name: "Cabo Verde" },
  { code: "co", flag: "🇨🇴", name: "Colombia" },
  { code: "gh", flag: "🇬🇭", name: "Ghana" },
];

export default function Default() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-neutral-100 p-8">
      <div className="w-72">
        <ScrollFadeList
          getKey={(team) => team.code}
          items={teams}
          renderItem={(team) => (
            <span className="flex items-center gap-2">
              <span aria-hidden="true">{team.flag}</span>
              <span>{team.name}</span>
            </span>
          )}
        />
      </div>
    </div>
  );
}

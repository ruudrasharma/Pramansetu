"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { truncateMiddle, cn } from "@/lib/utils";

interface Signer {
  did: string;
  signed: boolean;
}

/**
 * A signer fills solid the instant their signature lands. The action this row gates only unlocks
 * once `required` distinct signers have signed — see UI_UX_SPEC.md §Motion.
 */
export function SignerChips({ signers, required }: { signers: Signer[]; required: number }) {
  const signedCount = signers.filter((s) => s.signed).length;
  const met = signedCount >= required;

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-1.5">
        {signers.map((s) => (
          <motion.div
            key={s.did}
            initial={false}
            animate={{ scale: s.signed ? 1 : 0.94 }}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full border-2 border-graphite-900 text-[10px] font-semibold",
              s.signed ? "bg-verified-500 text-graphite-950" : "bg-graphite-800 text-ink-600"
            )}
            title={truncateMiddle(s.did)}
          >
            {s.signed ? <Check size={13} strokeWidth={3} /> : s.did.slice(10, 12).toUpperCase()}
          </motion.div>
        ))}
      </div>
      <span className={cn("mono-value text-[12px]", met ? "text-verified-400" : "text-ink-400")}>
        {signedCount}/{required} signed
      </span>
    </div>
  );
}

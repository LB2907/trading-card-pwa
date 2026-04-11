"use client";

import { inArray } from "drizzle-orm";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useDb } from "@/components/app-providers";
import { CardDetailPreview } from "@/components/card-detail-preview";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { rarityVisual } from "@/lib/card-visual";
import { cardTemplates, type CardInstance } from "@/lib/db/schema";
import { rarityLabel } from "@/lib/rarity";
type Props = {
  cards: CardInstance[];
  onDone: () => void;
};

export function PackOpening({ cards, onDone }: Props) {
  const db = useDb();
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<"case" | "reveal" | "done">(() =>
    !cards.length || reduce ? "done" : "case",
  );
  const [index, setIndex] = useState(0);
  const [layoutByTemplateId, setLayoutByTemplateId] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (!cards.length) return;
    const ids = [...new Set(cards.map((c) => c.templateId))];
    void (async () => {
      if (ids.length === 0) {
        setLayoutByTemplateId({});
        return;
      }
      const rows = await db
        .select()
        .from(cardTemplates)
        .where(inArray(cardTemplates.id, ids));
      const m: Record<string, string> = {};
      for (const t of rows) m[t.id] = t.layoutJson;
      setLayoutByTemplateId(m);
    })();
  }, [cards, db]);

  useEffect(() => {
    if (phase !== "case" || reduce || !cards.length) return;
    const t = setTimeout(() => setPhase("reveal"), 1100);
    return () => clearTimeout(t);
  }, [phase, reduce, cards.length]);

  useEffect(() => {
    if (phase !== "reveal" || reduce) return;
    if (index >= cards.length) {
      const t = setTimeout(() => setPhase("done"), 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setIndex((i) => i + 1), 720);
    return () => clearTimeout(t);
  }, [phase, index, cards.length, reduce]);

  const focusCard = cards[Math.min(index, Math.max(0, cards.length - 1))];
  const hueCard = focusCard ?? cards[0];
  const rv = rarityVisual(hueCard?.rarity ?? "common");

  if (phase === "case" && !reduce) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_center,_rgba(88,28,135,0.35)_0%,_#030012_55%,_#000_100%)] p-6">
        <div className="pointer-events-none absolute inset-0 opacity-[0.15]">
          <div
            className="absolute inset-0 animate-pulse"
            style={{
              background: `conic-gradient(from 180deg at 50% 50%, ${rv.primary}00 0deg, ${rv.primary} 120deg, ${rv.highlight} 240deg, ${rv.primary}00 360deg)`,
            }}
          />
        </div>
        <motion.p
          className="mb-8 text-center text-xs font-semibold uppercase tracking-[0.35em] text-violet-200/80"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Opening booster
        </motion.p>
        <motion.div
          className="relative perspective-[1200px]"
          initial={{ scale: 0.75, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 140, damping: 16 }}
        >
          <motion.div
            className="relative aspect-[5/7] w-[min(13rem,42vw)] rounded-2xl shadow-2xl"
            style={{
              background: `linear-gradient(145deg, color-mix(in srgb, ${rv.primary} 55%, #0f0a14), #06030c 48%, #0c0618)`,
              boxShadow: `0 0 80px color-mix(in srgb, ${rv.primary} 45%, transparent), 0 24px 48px rgba(0,0,0,0.65)`,
            }}
            animate={{
              rotateY: [0, 6, -4, 0],
              rotateX: [0, -2, 1, 0],
            }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/20" />
            <div className="absolute inset-[10%] rounded-xl border border-white/10 bg-black/25" />
            <motion.div
              className="absolute inset-x-[12%] top-[10%] h-[38%] rounded-lg bg-gradient-to-b from-white/25 to-transparent opacity-90"
              animate={{ opacity: [0.35, 0.7, 0.35] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
            <div className="absolute inset-x-0 bottom-[14%] flex justify-center">
              <span className="rounded-full border border-white/15 bg-black/30 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/90 backdrop-blur-sm">
                Booster pack
              </span>
            </div>
            <motion.div
              className="absolute -right-1 -top-1 flex h-9 w-9 items-center justify-center rounded-full border border-violet-400/40 bg-violet-950/80 text-violet-200 shadow-lg"
              animate={{ rotate: [0, 12, 0], scale: [1, 1.06, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            >
              <Sparkles className="h-4 w-4" strokeWidth={2} />
            </motion.div>
          </motion.div>
        </motion.div>
        <p className="mt-10 max-w-xs text-center text-sm text-zinc-500">
          Ripping the seal…
        </p>
      </div>
    );
  }

  if (phase === "reveal" && !reduce) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-b from-zinc-950 via-black to-zinc-950 p-4 pt-10">
        <div className="mx-auto mb-2 flex w-full max-w-4xl items-end justify-between gap-4 px-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-400/90">
              Reveal
            </p>
            <p className="text-lg font-semibold text-white">
              {index + 1} / {cards.length}
            </p>
          </div>
        </div>
        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 items-center justify-center overflow-x-auto overflow-y-hidden px-2 pb-8">
          <div className="flex items-end justify-center gap-3 py-4 md:gap-5">
            <AnimatePresence initial={false}>
              {cards.slice(0, index + 1).map((c, i) => {
                const layoutJson =
                  layoutByTemplateId[c.templateId] ?? "{}";
                const v = rarityVisual(c.rarity);
                return (
                  <motion.div
                    key={`${c.id}-${i}`}
                    layout
                    initial={{ y: 120, opacity: 0, scale: 0.85, rotateX: 25 }}
                    animate={{ y: 0, opacity: 1, scale: 1, rotateX: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 220,
                      damping: 22,
                      mass: 0.85,
                    }}
                    className="relative w-[min(11rem,28vw)] shrink-0 origin-bottom"
                    style={{
                      filter: `drop-shadow(0 0 20px color-mix(in srgb, ${v.primary} 40%, transparent))`,
                    }}
                  >
                    <div
                      className="rounded-2xl p-[2px]"
                      style={{
                        background: `linear-gradient(135deg, ${v.highlight}, ${v.primary}, ${v.accent2 ?? v.primary})`,
                      }}
                    >
                      <div className="overflow-hidden rounded-[14px] bg-zinc-950 ring-1 ring-black/60">
                        <CardDetailPreview
                          instance={c}
                          layoutJson={layoutJson}
                        />
                      </div>
                    </div>
                    <p className="mt-2 truncate text-center text-xs font-semibold text-white">
                      {c.name || "Card"}
                    </p>
                    <p
                      className="truncate text-center text-[10px] font-medium uppercase tracking-wide"
                      style={{ color: v.primary }}
                    >
                      {rarityLabel(c.rarity)}
                    </p>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/92 p-4 backdrop-blur-md">
      <Card className="max-h-[90vh] w-full max-w-lg overflow-hidden border-border/80 shadow-2xl">
        <CardHeader className="border-b border-border/60 bg-gradient-to-r from-violet-950/40 to-transparent pb-4">
          <CardTitle className="text-xl">Pack opened</CardTitle>
          <CardDescription>
            {cards.length} card{cards.length === 1 ? "" : "s"} added to your
            collection.
          </CardDescription>
        </CardHeader>
        <CardContent className="max-h-[min(52vh,28rem)] space-y-3 overflow-y-auto py-4">
          <ul className="space-y-3">
            {cards.map((c, pullIndex) => {
              const v = rarityVisual(c.rarity);
              return (
                <li
                  key={`${c.id}-pull-${pullIndex}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">
                    {c.name || "Untitled"}
                  </span>
                  <Badge
                    variant="outline"
                    className="shrink-0 border-0 font-semibold"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${v.primary} 22%, transparent)`,
                      color: v.highlight,
                    }}
                  >
                    {rarityLabel(c.rarity)}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </CardContent>
        <div className="border-t border-border/60 bg-muted/10 px-6 py-4">
          <Button className="w-full" size="lg" onClick={onDone}>
            Continue
          </Button>
        </div>
      </Card>
    </div>
  );
}

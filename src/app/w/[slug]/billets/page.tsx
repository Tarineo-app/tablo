import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadWidget } from "@/lib/widget";
import Tickets from "./Tickets";
import "../../widget.css";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ m?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await loadWidget((await params).slug);
  return { title: data ? `Entrées · ${data.venue.name}` : "Entrées" };
}

export default async function Page({ params, searchParams }: Props) {
  const [{ slug }, { m }] = await Promise.all([params, searchParams]);
  const data = await loadWidget(slug);
  if (!data || !data.venue.ticketsEnabled) notFound();
  return <Tickets data={data} managerCode={m?.slice(0, 40) ?? null} />;
}

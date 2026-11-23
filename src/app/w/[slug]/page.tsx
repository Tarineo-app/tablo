import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadWidget } from "@/lib/widget";
import Widget from "./Widget";
import "../widget.css";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ m?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await loadWidget((await params).slug);
  return { title: data ? `Réserver · ${data.venue.name}` : "Réserver" };
}

export default async function Page({ params, searchParams }: Props) {
  const [{ slug }, { m }] = await Promise.all([params, searchParams]);
  const data = await loadWidget(slug);
  if (!data) notFound();
  return <Widget data={data} managerCode={m?.slice(0, 40) ?? null} />;
}

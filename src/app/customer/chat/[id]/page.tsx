import PortalChat from "@/components/portal-chat";

export default async function CustomerChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PortalChat role="customer" conversationId={id} />;
}
